import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { codeforgeConfig } from "./config";

const WORKSPACE_ROOT = path.join(codeforgeConfig.dataDir, "workspaces");

export function newBuildId(): string {
  return randomUUID();
}

export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(WORKSPACE_ROOT, { recursive: true, mode: 0o700 });
}

/**
 * Creates an isolated, per-build directory. Every build gets its own
 * workspace so concurrent builds cannot see or interfere with each
 * other's source or output.
 */
export async function createWorkspace(buildId: string): Promise<string> {
  await ensureDataDirs();
  const dir = path.join(WORKSPACE_ROOT, buildId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function workspacePathFor(buildId: string): string {
  return path.join(WORKSPACE_ROOT, buildId);
}

export function sourcePathFor(buildId: string): string {
  return path.join(WORKSPACE_ROOT, buildId, "__source_input.bin");
}

export async function storeUploadedSource(buildId: string, buffer: Buffer): Promise<void> {
  const ws = await createWorkspace(buildId);
  const srcPath = path.join(ws, "__source_input.bin");
  await fs.writeFile(srcPath, buffer, { mode: 0o600 });
}

export async function readUploadedSource(buildId: string): Promise<Buffer> {
  const srcPath = sourcePathFor(buildId);
  return fs.readFile(srcPath);
}

export async function removeWorkspace(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Best-effort retention sweep: deletes workspace directories (which hold
 * both source and the compiled artifact) older than the configured TTL.
 * We do not keep build artifacts forever - this is called opportunistically
 * on every new build request and on a background interval.
 */
export async function sweepExpiredWorkspaces(): Promise<number> {
  await ensureDataDirs();
  let removed = 0;
  let entries: string[];
  try {
    entries = await fs.readdir(WORKSPACE_ROOT);
  } catch {
    return 0;
  }

  const now = Date.now();
  for (const entry of entries) {
    const dir = path.join(WORKSPACE_ROOT, entry);
    try {
      const stat = await fs.stat(dir);
      if (now - stat.mtimeMs > codeforgeConfig.artifactTtlMs) {
        await fs.rm(dir, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // Directory may have been removed concurrently - ignore.
    }
  }
  return removed;
}

let sweepIntervalStarted = false;

/** Starts a background cleanup timer exactly once per server process. */
export function startBackgroundCleanup(): void {
  const globalFlag = globalThis as typeof globalThis & {
    __codeforgeCleanupStarted?: boolean;
  };
  if (globalFlag.__codeforgeCleanupStarted || sweepIntervalStarted) return;
  sweepIntervalStarted = true;
  globalFlag.__codeforgeCleanupStarted = true;

  const interval = setInterval(() => {
    sweepExpiredWorkspaces().catch((err) => {
      console.error("[codeforge] background cleanup sweep failed:", err);
    });
  }, Math.min(codeforgeConfig.artifactTtlMs, 5 * 60 * 1000));
  interval.unref();
}
