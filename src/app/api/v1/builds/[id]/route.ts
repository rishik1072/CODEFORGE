import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds } from "@/db/schema";
import { authenticateApiKey } from "@/lib/codeforge/api-keys";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const auth = await authenticateApiKey(request, "build:read");
  if (!auth) {
    return Response.json(
      { error: { code: "unauthorized", message: "Valid API key with 'build:read' scope required." } },
      { status: 401 },
    );
  }

  const uuidPattern = /^[0-9a-f-]{36}$/i;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
  }

  const [row] = await db
    .select()
    .from(builds)
    .where(and(eq(builds.id, id), eq(builds.userId, auth.user.id)))
    .limit(1);

  if (!row) {
    return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
  }

  return Response.json(toPublicBuildRecord(row));
}
