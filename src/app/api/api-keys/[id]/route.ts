import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/codeforge/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: { code: "unauthorized", message: "Please log in." } }, { status: 401 });
  }

  const [keyRow] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
    .limit(1);

  if (!keyRow) {
    return Response.json({ error: { code: "not_found", message: "API key not found." } }, { status: 404 });
  }

  // Revoke key
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id));

  return Response.json({ success: true, message: "API key revoked successfully." });
}
