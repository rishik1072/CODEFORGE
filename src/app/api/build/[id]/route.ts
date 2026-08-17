import { db } from "@/db";
import { builds } from "@/db/schema";
import { eq } from "drizzle-orm";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // Build IDs are UUIDs generated server-side; reject anything else
  // outright rather than hitting the database with malformed input.
  const uuidPattern = /^[0-9a-f-]{36}$/i;
  if (!uuidPattern.test(id)) {
    return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
  }

  const [row] = await db.select().from(builds).where(eq(builds.id, id)).limit(1);
  if (!row) {
    return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
  }

  // Authorization boundary: if build is associated with a user, require that user
  if (row.userId) {
    const { getAuthenticatedUser } = await import("@/lib/codeforge/auth");
    const user = await getAuthenticatedUser();
    if (!user || user.id !== row.userId) {
      return Response.json({ error: { code: "not_found", message: "Build not found." } }, { status: 404 });
    }
  }

  return Response.json(toPublicBuildRecord(row));
}
