import { db } from "@/db";
import { builds } from "@/db/schema";
import { desc } from "drizzle-orm";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";

export const dynamic = "force-dynamic";

/**
 * Returns a list of the latest public build records (safe metadata only).
 * Never exposes source code, client IPs, internal workspace paths, or server secrets.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 25) : 10;

  try {
    const { getAuthenticatedUser } = await import("@/lib/codeforge/auth");
    const user = await getAuthenticatedUser();

    const { eq, and, isNull } = await import("drizzle-orm");

    let whereClause;
    if (user) {
      // Return user's builds
      whereClause = eq(builds.userId, user.id);
    } else {
      // For anonymous users, only show public unowned legacy builds
      whereClause = isNull(builds.userId);
    }

    const rows = await db
      .select()
      .from(builds)
      .where(whereClause)
      .orderBy(desc(builds.createdAt))
      .limit(limit);

    const publicRecords = rows.map((row) => toPublicBuildRecord(row));
    return Response.json({ builds: publicRecords });
  } catch (err) {
    console.error("[codeforge] failed to fetch recent builds:", err);
    return Response.json({ builds: [] }, { status: 500 });
  }
}
