import { db } from "@/db";
import { builds } from "@/db/schema";
import { eq } from "drizzle-orm";
import { codeforgeConfig } from "@/lib/codeforge/config";
import { enqueueBuild } from "@/lib/codeforge/queue";
import { checkRateLimit } from "@/lib/codeforge/rateLimit";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";
import { newBuildId } from "@/lib/codeforge/workspace";
import { SecurityRejectionError } from "@/lib/codeforge/types";
import {
  validateFilename,
  validateLanguage,
  validateSize,
  validateStandard,
  validateUploadContent,
} from "@/lib/codeforge/validation";

export const dynamic = "force-dynamic";

function clientKeyFor(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const clientKey = clientKeyFor(request);

  const rateLimit = checkRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: {
          code: "rate_limited",
          message: "Too many build requests. Please wait before trying again.",
        },
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  // Fast-fail on obviously oversized payloads before parsing multipart body
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  const absoluteMaxPayload = codeforgeConfig.maxProjectUploadBytes + 128 * 1024;
  if (declaredLength > absoluteMaxPayload) {
    return errorResponse(
      "payload_too_large",
      `Upload exceeds the maximum allowed project size of ${Math.floor(
        codeforgeConfig.maxProjectUploadBytes / (1024 * 1024),
      )} MB.`,
      413,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("invalid_request", "Could not parse upload. Expected multipart/form-data.", 400);
  }

  const file = formData.get("file");
  const languageField = formData.get("language");
  const standardField = formData.get("standard");

  if (!(file instanceof File)) {
    return errorResponse("missing_file", "No source file or project was provided.", 400);
  }

  try {
    const language = validateLanguage(typeof languageField === "string" ? languageField : null);
    const filename = validateFilename(file.name, language);
    const standard = validateStandard(
      typeof standardField === "string" ? standardField : null,
      language,
    );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isProjectZip = filename.toLowerCase().endsWith(".zip");
    validateSize(buffer.byteLength, isProjectZip);
    validateUploadContent(buffer, isProjectZip);

    const projectIdField = formData.get("projectId");
    const requestedProjectId = typeof projectIdField === "string" && projectIdField.trim() ? projectIdField.trim() : null;

    // Check optional authenticated user
    const { getAuthenticatedUser } = await import("@/lib/codeforge/auth");
    const user = await getAuthenticatedUser();

    // If projectId is specified, ensure it belongs to the authenticated user
    if (requestedProjectId) {
      if (!user) {
        return errorResponse("unauthorized", "Authentication required to associate build with a project.", 401);
      }
      const { projects } = await import("@/db/schema");
      const { and } = await import("drizzle-orm");
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, requestedProjectId), eq(projects.userId, user.id)))
        .limit(1);

      if (!project) {
        return errorResponse("project_not_found", "Project not found or you do not have permission to build in it.", 404);
      }
    }

    const buildId = newBuildId();

    await enqueueBuild({
      buildId,
      userId: user?.id || null,
      projectId: requestedProjectId,
      language,
      originalFilename: filename,
      standard,
      sourceBuffer: buffer,
      clientIp: clientKey,
    });

    const [row] = await db.select().from(builds).where(eq(builds.id, buildId)).limit(1);
    if (!row) {
      return errorResponse("internal_error", "Build record could not be found after enqueuing.", 500);
    }

    return Response.json(toPublicBuildRecord(row), { status: 202 });
  } catch (err) {
    if (err instanceof SecurityRejectionError) {
      return errorResponse("security_rejected", err.message, 400);
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error(`[codeforge] unexpected error handling build request: ${errorMessage}`, errorStack ? `\n${errorStack}` : "");
    return errorResponse("internal_error", "An internal error occurred. Please try again.", 500);
  }
}
