import fs from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorkspace, removeWorkspace, sweepExpiredWorkspaces, workspacePathFor } from "@/lib/codeforge/workspace";

describe("workspace lifecycle", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdIds.map((id) => removeWorkspace(workspacePathFor(id))));
  });

  it("creates an isolated, per-build directory", async () => {
    const id = "test-build-fresh";
    createdIds.push(id);
    const dir = await createWorkspace(id);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("removes a workspace directory on cleanup", async () => {
    const id = "test-build-remove";
    createdIds.push(id);
    const dir = await createWorkspace(id);
    await removeWorkspace(dir);
    await expect(fs.stat(dir)).rejects.toThrow();
  });

  it("sweeps workspaces older than the retention TTL", async () => {
    const id = "test-build-expired";
    createdIds.push(id);
    const dir = await createWorkspace(id);

    // Simulate an old workspace by backdating its mtime well past the TTL.
    const old = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    await fs.utimes(dir, old, old);

    const removed = await sweepExpiredWorkspaces();
    expect(removed).toBeGreaterThanOrEqual(1);
    await expect(fs.stat(dir)).rejects.toThrow();
  });
});
