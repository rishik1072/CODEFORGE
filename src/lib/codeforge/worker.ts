import { codeforgeConfig } from "./config";
import { claimNextQueuedJob, generateWorkerId, recoverStaleJobs } from "./queue";
import { executeBuildJob } from "./pipeline";

import { recordBuildMetric } from "./metrics";

export interface WorkerOptions {
  workerId?: string;
  concurrency?: number;
  pollIntervalMs?: number;
}

export class BuildWorker {
  readonly workerId: string;
  readonly concurrency: number;
  readonly pollIntervalMs: number;
  private isRunning = false;
  private activeJobs = 0;
  private startedAt: Date | null = null;
  private loopTimer: NodeJS.Timeout | null = null;
  private recoverTimer: NodeJS.Timeout | null = null;

  getStatus() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      concurrency: this.concurrency,
      activeJobs: this.activeJobs,
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
    };
  }

  constructor(options: WorkerOptions = {}) {
    this.workerId = options.workerId ?? generateWorkerId();
    this.concurrency = options.concurrency ?? codeforgeConfig.workerConcurrency;
    this.pollIntervalMs = options.pollIntervalMs ?? codeforgeConfig.workerPollIntervalMs;
  }

  /**
   * Starts the background worker polling loop.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startedAt = new Date();
    console.log(
      `[codeforge-worker] ${this.workerId} started (concurrency: ${this.concurrency}, poll: ${this.pollIntervalMs}ms)`,
    );

    // Initial stale job recovery
    recoverStaleJobs().catch((err) => {
      console.error(`[codeforge-worker] initial stale recovery error:`, err);
    });

    // Periodic stale job recovery every minute
    this.recoverTimer = setInterval(() => {
      recoverStaleJobs().catch((err) => {
        console.error(`[codeforge-worker] periodic stale recovery error:`, err);
      });
    }, 60_000);

    this.scheduleNextTick(0);
  }

  /**
   * Stops the worker gracefully.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    if (this.recoverTimer) clearInterval(this.recoverTimer);

    // Wait for in-flight jobs to complete
    while (this.activeJobs > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.log(`[codeforge-worker] ${this.workerId} stopped cleanly.`);
  }

  private scheduleNextTick(delayMs = this.pollIntervalMs): void {
    if (!this.isRunning) return;
    this.loopTimer = setTimeout(() => {
      this.tick().catch((err) => {
        console.error(`[codeforge-worker] uncaught tick error:`, err);
        this.scheduleNextTick();
      });
    }, delayMs);
  }

  /**
   * Performs one tick: attempts to fill concurrency slots by claiming queued jobs.
   */
  async tick(): Promise<void> {
    if (!this.isRunning) return;

    while (this.activeJobs < this.concurrency && this.isRunning) {
      let job;
      try {
        job = await claimNextQueuedJob(this.workerId);
      } catch (err) {
        console.error(`[codeforge-worker] failed to claim job:`, err);
        break;
      }

      if (!job) {
        // No queued jobs available right now
        break;
      }

      this.activeJobs += 1;
      // Execute asynchronously in background without blocking the loop
      this.runJob(job).finally(() => {
        this.activeJobs -= 1;
        if (this.isRunning) {
          this.scheduleNextTick(0);
        }
      });
    }

    this.scheduleNextTick(this.pollIntervalMs);
  }

  private async runJob(job: Parameters<typeof executeBuildJob>[0]): Promise<void> {
    console.log(`[codeforge-worker] processing build ${job.id} (${job.language}, ${job.cppStandard})...`);
    try {
      const result = await executeBuildJob(job);
      recordBuildMetric(result.status, result.durationMs);
      console.log(`[codeforge-worker] finished processing build ${job.id} with status ${result.status}`);
    } catch (err) {
      recordBuildMetric("internal_error");
      console.error(`[codeforge-worker] error executing build ${job.id}:`, err);
    }
  }
}

// In Next.js dev or standalone server, start an in-process worker if enabled
let defaultWorkerInstance: BuildWorker | null = null;

export function ensureInProcessWorker(): BuildWorker {
  if (!defaultWorkerInstance) {
    defaultWorkerInstance = new BuildWorker();
    defaultWorkerInstance.start();
  }
  return defaultWorkerInstance;
}
