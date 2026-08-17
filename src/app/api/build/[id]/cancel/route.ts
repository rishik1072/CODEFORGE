import { cancelBuild } from "@/lib/codeforge/queue";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const uuidPattern = /^[0-9a-f-]{36}$/i;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
  }

  const { db } = await import("@/db");
  const { builds } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select().from(builds).where(eq(builds.id, id)).limit(1);
  if (!row) {
    return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
  }

  if (row.userId) {
    const { getAuthenticatedUser } = await import("@/lib/codeforge/auth");
    const user = await getAuthenticatedUser();
    if (!user || user.id !== row.userId) {
      return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
    }
  }

  const result = await cancelBuild(id);
  if (!result.success) {
    return Response.json({ error: { code: "invalid_state", message: result.message } }, { status: 400 });
  }

  return Response.json({ message: result.message }, { status: 200 });
}
