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

  // 1. API Key Authentication & Scope Verification
  const auth = await authenticateApiKey(request, "build:create");
  if (!auth) {
    return errorResponse(
      "unauthorized",
      "Valid API key with 'build:create' scope required in Authorization: Bearer header.",
      401,
    );
  }

  // 2. Rate Limiting (keyed on API key user)
  const rateLimit = checkRateLimit(`apikey:${auth.user.id}:${clientKey}`);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: { code: "rate_limited", message: "Rate limit exceeded. Please wait before creating more builds." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  // 3. Idempotency handling
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;
  if (idempotencyKey) {
    const [existing] = await db
      .select()
      .from(builds)
      .where(and(eq(builds.userId, auth.user.id), eq(builds.idempotencyKey, idempotencyKey)))
      .limit(1);

    if (existing) {
      return Response.json(toPublicBuildRecord(existing), { status: 200 });
    }
  }

  // 4. Request size check
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  const absoluteMaxPayload = codeforgeConfig.maxProjectUploadBytes + 128 * 1024;
  if (declaredLength > absoluteMaxPayload) {
    return errorResponse(
      "payload_too_large",
      `Upload exceeds maximum allowed size of ${Math.floor(codeforgeConfig.maxProjectUploadBytes / (1024 * 1024))} MB.`,
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
  const projectIdField = formData.get("projectId");

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

    const requestedProjectId = typeof projectIdField === "string" && projectIdField.trim() ? projectIdField.trim() : null;
    if (requestedProjectId) {
      const [proj] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, requestedProjectId), eq(projects.userId, auth.user.id)))
        .limit(1);

      if (!proj) {
        return errorResponse("project_not_found", "Project not found or you do not have access.", 404);
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isProjectZip = filename.toLowerCase().endsWith(".zip");
    validateSize(buffer.byteLength, isProjectZip);
    validateUploadContent(buffer, isProjectZip);

    const buildId = newBuildId();

    await enqueueBuild({
      buildId,
      userId: auth.user.id,
      projectId: requestedProjectId,
      idempotencyKey,
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
    console.error(`[codeforge-v1] build submission error: ${errorMessage}`);
    return errorResponse("internal_error", "An internal error occurred while processing the build.", 500);
  }
}
