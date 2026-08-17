import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { builds } from "@/db/schema";
import { authenticateApiKey } from "@/lib/codeforge/api-keys";
import { cancelBuild } from "@/lib/codeforge/queue";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const auth = await authenticateApiKey(request, "build:cancel");
  if (!auth) {
    return Response.json(
      { error: { code: "unauthorized", message: "Valid API key with 'build:cancel' scope required." } },
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

  const result = await cancelBuild(id);
  if (!result.success) {
    return Response.json({ error: { code: "invalid_state", message: result.message } }, { status: 400 });
  }

  return Response.json({ message: result.message }, { status: 200 });
}
