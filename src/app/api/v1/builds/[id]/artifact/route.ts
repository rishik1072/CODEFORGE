import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds } from "@/db/schema";
import { authenticateApiKey } from "@/lib/codeforge/api-keys";
import { codeforgeConfig } from "@/lib/codeforge/config";

export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const auth = await authenticateApiKey(request, "build:read");
  if (!auth) {
    return errorResponse("unauthorized", "Valid API key with 'build:read' scope required.", 401);
  }

  const uuidPattern = /^[0-9a-f-]{36}$/i;
  if (!uuidPattern.test(id)) {
    return errorResponse("not_found", "Build not found.", 404);
  }

  const [row] = await db
    .select()
    .from(builds)
    .where(and(eq(builds.id, id), eq(builds.userId, auth.user.id)))
    .limit(1);

  if (!row) {
    return errorResponse("not_found", "Build not found.", 404);
  }

  if (row.status !== "success" || !row.artifactPath || !row.artifactFilename) {
    return errorResponse("no_artifact", "This build did not produce a downloadable artifact.", 409);
  }

  if (row.artifactExpiresAt && row.artifactExpiresAt.getTime() < Date.now()) {
    return errorResponse(
      "expired",
      "This build artifact has expired and was automatically removed. Please rebuild.",
      410,
    );
  }

  let fileBuffer: Buffer | null = null;
  if (row.artifactPayloadBase64) {
    fileBuffer = Buffer.from(row.artifactPayloadBase64, "base64");
  } else if (row.artifactPath) {
    const workspaceRoot = path.join(codeforgeConfig.dataDir, "workspaces");
    const resolved = path.resolve(row.artifactPath);
    if (resolved.startsWith(path.resolve(workspaceRoot) + path.sep)) {
      try {
        fileBuffer = await fs.readFile(resolved);
      } catch {
        fileBuffer = null;
      }
    }
  }

  if (!fileBuffer) {
    return errorResponse(
      "expired",
      "This build artifact is no longer available. Please rebuild.",
      410,
    );
  }

  return new Response(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.microsoft.portable-executable",
      "Content-Disposition": `attachment; filename="${row.artifactFilename}"`,
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
