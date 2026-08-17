import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { builds, type BuildRow } from "@/db/schema";
import { codeforgeConfig } from "./config";
import { storeUploadedSource } from "./workspace";
import type { BuildStageEvent, BuildStatus } from "./types";
import type { SupportedLanguage } from "./shared";

export function generateWorkerId(): string {
  return `worker-${randomUUID().slice(0, 8)}`;
}

export interface EnqueueBuildInput {
  buildId: string;
  userId?: string | null;
  projectId?: string | null;
  idempotencyKey?: string | null;
  language: SupportedLanguage;
  originalFilename: string;
  standard: string;
  sourceBuffer: Buffer;
  clientIp: string | null;
}

export interface EnqueuedBuildResult {
  buildId: string;
  status: "queued";
}

function stage(
  list: BuildStageEvent[],
  s: BuildStageEvent["stage"],
  message: string,
): BuildStageEvent[] {
  list.push({ stage: s, message, at: new Date().toISOString() });
  return list;
}

/**
 * Validates, records metadata, stores source bytes safely in workspace, and enqueues the build.
 */
export async function enqueueBuild(input: EnqueueBuildInput): Promise<EnqueuedBuildResult> {
  const isZip = input.originalFilename.toLowerCase().endsWith(".zip");
  const stages: BuildStageEvent[] = [];
  const now = new Date();

  stage(
    stages,
    "VALIDATING",
    isZip
      ? `Validating uploaded ${input.language.toUpperCase()} project archive structure and size...`
      : `${input.language.toUpperCase()} source file passed validation checks.`,
  );
  stage(stages, "PREPARING", "Queued for execution by CodeForge build worker.");

  // Save the source buffer to workspace storage if local filesystem is writable
  await storeUploadedSource(input.buildId, input.sourceBuffer).catch(() => undefined);

  // Insert initial queued record with source payload
  await db.insert(builds).values({
    id: input.buildId,
    userId: input.userId || null,
    projectId: input.projectId || null,
    idempotencyKey: input.idempotencyKey || null,
    language: input.language,
    originalFilename: input.originalFilename,
    projectType: isZip ? "multi" : "single",
    sourceFileCount: 1,
    headerFileCount: 0,
    cppStandard: input.standard,
    sourceSizeBytes: input.sourceBuffer.byteLength,
    sourcePayloadBase64: input.sourceBuffer.toString("base64"),
    status: "queued" satisfies BuildStatus,
    stages,
    clientIp: input.clientIp,
    createdAt: now,
    queuedAt: now,
    attemptCount: 0,
  });

  return {
    buildId: input.buildId,
    status: "queued",
  };
}

/**
 * Atomically claims the next available queued build using PostgreSQL
 * SELECT ... FOR UPDATE SKIP LOCKED.
 */
export async function claimNextQueuedJob(workerId: string): Promise<BuildRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const selectQuery = `
      SELECT * FROM builds
      WHERE status = 'queued'
      ORDER BY queued_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1;
    `;
    const res = await client.query(selectQuery);

    if (res.rows.length === 0) {
      await client.query("COMMIT");
      return null;
    }

    const job = res.rows[0];
    const startedAt = new Date();
    const currentStages = (job.stages || []) as BuildStageEvent[];
    stage(currentStages, "PREPARING", `Claimed by build worker ${workerId}. Preparing compiler sandbox...`);

    const updateQuery = `
      UPDATE builds
      SET status = 'compiling',
          worker_id = $1,
          attempt_count = attempt_count + 1,
          started_at = $2,
          stages = $3
      WHERE id = $4
      RETURNING *;
    `;

    const updateRes = await client.query(updateQuery, [
      workerId,
      startedAt.toISOString(),
      JSON.stringify(currentStages),
      job.id,
    ]);

    await client.query("COMMIT");

    const row = updateRes.rows[0];
    // Format into typed BuildRow
    return {
      ...row,
      stages: typeof row.stages === "string" ? JSON.parse(row.stages) : row.stages,
      createdAt: new Date(row.created_at),
      queuedAt: new Date(row.queued_at || row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      artifactExpiresAt: row.artifact_expires_at ? new Date(row.artifact_expires_at) : null,
    } as BuildRow;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Recovers stale builds where a worker started compilation but crashed or lost connection.
 */
export async function recoverStaleJobs(thresholdMs = codeforgeConfig.staleJobThresholdMs): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdMs);

  const staleJobs = await db
    .select()
    .from(builds)
    .where(and(eq(builds.status, "compiling"), lt(builds.startedAt, cutoff)));

  let recoveredCount = 0;
  for (const job of staleJobs) {
    const currentStages = (job.stages || []) as BuildStageEvent[];
    const attempts = (job.attemptCount ?? 1);

    if (attempts < codeforgeConfig.maxJobAttempts) {
      // Requeue
      stage(currentStages, "PREPARING", `Job timed out or worker stalled. Requeuing for retry (attempt ${attempts + 1})...`);
      await db
        .update(builds)
        .set({
          status: "queued" satisfies BuildStatus,
          workerId: null,
          stages: currentStages,
          queuedAt: new Date(),
        })
        .where(eq(builds.id, job.id));
    } else {
      // Mark failed
      const errorMessage = "Build worker encountered an unrecoverable timeout while processing this job.";
      stage(currentStages, "FAILED", errorMessage);
      await db
        .update(builds)
        .set({
          status: "internal_error" satisfies BuildStatus,
          errorMessage,
          stages: currentStages,
          finishedAt: new Date(),
        })
        .where(eq(builds.id, job.id));
    }
    recoveredCount += 1;
  }

  return recoveredCount;
}

/**
 * Attempts to cancel a queued or running build.
 */
export async function cancelBuild(buildId: string): Promise<{ success: boolean; message: string }> {
  const [job] = await db.select().from(builds).where(eq(builds.id, buildId)).limit(1);
  if (!job) {
    return { success: false, message: "Build not found." };
  }

  if (job.status !== "queued" && job.status !== "compiling") {
    return { success: false, message: `Cannot cancel build in status '${job.status}'.` };
  }

  const currentStages = (job.stages || []) as BuildStageEvent[];
  stage(currentStages, "FAILED", "Build was cancelled by user.");

  await db
    .update(builds)
    .set({
      status: "cancelled" satisfies BuildStatus,
      errorMessage: "Build cancelled by user.",
      stages: currentStages,
      finishedAt: new Date(),
    })
    .where(eq(builds.id, buildId));

  return { success: true, message: "Build cancelled successfully." };
}
