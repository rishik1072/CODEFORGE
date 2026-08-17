import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getInternalMetricsSnapshot } from "@/lib/codeforge/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  // Check internal database connectivity
  let dbStatus = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "unavailable";
  }

  const metrics = getInternalMetricsSnapshot();
  const isReady = dbStatus === "ok";

  return Response.json(
    {
      status: isReady ? "ready" : "degraded",
      service: "codeforge-core",
      readiness: {
        database: dbStatus,
      },
      metrics,
      timestamp: new Date().toISOString(),
    },
    { status: isReady ? 200 : 503 },
  );
}
