import { describe, expect, it, vi } from "vitest";
import { generateWorkerId } from "@/lib/codeforge/queue";
import { BuildWorker } from "@/lib/codeforge/worker";

describe("Queue and Worker Architecture", () => {
  it("generates distinct worker IDs", () => {
    const id1 = generateWorkerId();
    const id2 = generateWorkerId();
    expect(id1).toMatch(/^worker-[0-9a-f]{8}$/);
    expect(id2).toMatch(/^worker-[0-9a-f]{8}$/);
    expect(id1).not.toBe(id2);
  });

  it("instantiates BuildWorker with custom options", () => {
    const worker = new BuildWorker({
      workerId: "test-worker-1",
      concurrency: 4,
      pollIntervalMs: 500,
    });
    expect(worker.workerId).toBe("test-worker-1");
    expect(worker.concurrency).toBe(4);
    expect(worker.pollIntervalMs).toBe(500);
  });

  it("supports start and stop lifecycle without error", async () => {
    const worker = new BuildWorker({
      workerId: "test-worker-lifecycle",
      concurrency: 1,
      pollIntervalMs: 10_000,
    });
    worker.start();
    await worker.stop();
  });
});
