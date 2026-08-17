import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds, projects } from "@/db/schema";
import { authenticateApiKey } from "@/lib/codeforge/api-keys";
import { codeforgeConfig } from "@/lib/codeforge/config";
import { enqueueBuild } from "@/lib/codeforge/queue";
import { checkRateLimit } from "@/lib/codeforge/rateLimit";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";
import { newBuildId } from "@/lib/codeforge/workspace";
import { SecurityRejectionError } from "@/lib/codeforge/types";
import { validateLanguage, validateStandard } from "@/lib/codeforge/validation";

export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Validates GitHub repository slug (owner/repo) and branch/tag name.
 */
function parseAndValidateGitHubRepo(repoInput: string, branchInput = "main"): { owner: string; repo: string; branch: string } {
  const cleanRepo = repoInput.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  const parts = cleanRepo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new SecurityRejectionError("Invalid GitHub repository. Format must be 'owner/repo' or 'https://github.com/owner/repo'.");
  }

  const [owner, repo] = parts;
  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    throw new SecurityRejectionError("Repository contains illegal characters.");
  }

  const cleanBranch = branchInput.trim() || "main";
  if (!/^[a-zA-Z0-9._\-/]+$/.test(cleanBranch) || cleanBranch.includes("..")) {
    throw new SecurityRejectionError("Invalid branch name.");
  }

  return { owner, repo, branch: cleanBranch };
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, "build:create");
  if (!auth) {
    return errorResponse("unauthorized", "Valid API key with 'build:create' scope required.", 401);
  }

  const rateLimit = checkRateLimit(`github:${auth.user.id}`);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: { code: "rate_limited", message: "Rate limit exceeded. Please wait before importing more repositories." } },
      { status: 429 },
    );
  }

  let body: { repository?: string; branch?: string; language?: string; standard?: string; projectId?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Invalid JSON request body.", 400);
  }

  const { repository, branch, language: langField, standard: stdField, projectId } = body;
  if (!repository || typeof repository !== "string") {
    return errorResponse("missing_repository", "GitHub repository is required.", 400);
  }

  try {
    const { owner, repo, branch: safeBranch } = parseAndValidateGitHubRepo(repository, branch);
    const language = validateLanguage(typeof langField === "string" ? langField : null);
    const standard = validateStandard(typeof stdField === "string" ? stdField : null, language);

    if (projectId) {
      const [p] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, auth.user.id)))
        .limit(1);

      if (!p) {
        return errorResponse("project_not_found", "Project not found or you do not have permission.", 404);
      }
    }

    // Securely fetch public repository archive directly from GitHub codeload domain
    const zipUrl = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/refs/heads/${encodeURIComponent(safeBranch)}`;

    let ghRes: Response;
    try {
      ghRes = await fetch(zipUrl, {
        headers: { "User-Agent": "CodeForge-Build-Pipeline/1.0" },
      });
    } catch {
      return errorResponse("fetch_failed", "Failed to connect to GitHub to download repository.", 502);
    }

    if (!ghRes.ok) {
      return errorResponse(
        "repository_not_found",
        `Could not download repository ${owner}/${repo} on branch '${safeBranch}'. Verify it is public and the branch exists.`,
        404,
      );
    }

    const arrayBuffer = await ghRes.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    if (zipBuffer.byteLength > codeforgeConfig.maxProjectUploadBytes) {
      return errorResponse(
        "payload_too_large",
        `Repository archive exceeds maximum allowed size of ${Math.floor(codeforgeConfig.maxProjectUploadBytes / (1024 * 1024))} MB.`,
        413,
      );
    }

    const buildId = newBuildId();

    await enqueueBuild({
      buildId,
      userId: auth.user.id,
      projectId: projectId || null,
      language,
      originalFilename: `${repo}-${safeBranch}.zip`,
      standard,
      sourceBuffer: zipBuffer,
      clientIp: "github-import",
    });

    const [row] = await db.select().from(builds).where(eq(builds.id, buildId)).limit(1);
    if (!row) {
      return errorResponse("internal_error", "Build record could not be created.", 500);
    }

    return Response.json(toPublicBuildRecord(row), { status: 202 });
  } catch (err) {
    if (err instanceof SecurityRejectionError) {
      return errorResponse("security_rejected", err.message, 400);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse("internal_error", msg, 500);
  }
}
