import os from "node:os";
import path from "node:path";
import {
  CPP_STANDARDS,
  C_STANDARDS,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  isSupportedStandardForLanguage,
  type CppStandard,
  type CStandard,
  type SupportedLanguage,
} from "./shared";

export {
  CPP_STANDARDS,
  C_STANDARDS,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  isSupportedStandardForLanguage,
};
export type { CppStandard, CStandard, SupportedLanguage };

export function boundedIntFromEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

/**
 * Central, auditable configuration for every resource limit and boundary
 * used by the compiler sandbox.
 */
export const codeforgeConfig = {
  dataDir: process.env.CODEFORGE_DATA_DIR ?? path.join(os.tmpdir(), "codeforge-data"),

  // Upload constraints
  maxUploadBytes: boundedIntFromEnv("CODEFORGE_MAX_UPLOAD_BYTES", 2 * 1024 * 1024, 1024, 10 * 1024 * 1024), // 2 MB (min 1KB, max 10MB)
  allowedExtensions: [".cpp", ".cc", ".cxx", ".c", ".rs", ".zip"] as const,

  // Multi-file ZIP project constraints (ZIP bomb & abuse prevention)
  maxProjectUploadBytes: boundedIntFromEnv("CODEFORGE_MAX_PROJECT_UPLOAD_BYTES", 10 * 1024 * 1024, 1024, 50 * 1024 * 1024), // 10 MB ZIP
  maxProjectExtractedBytes: boundedIntFromEnv("CODEFORGE_MAX_PROJECT_EXTRACTED_BYTES", 25 * 1024 * 1024, 1024, 100 * 1024 * 1024), // 25 MB max total
  maxProjectFileCount: boundedIntFromEnv("CODEFORGE_MAX_PROJECT_FILE_COUNT", 100, 1, 1000), // max 100 files
  maxProjectFileBytes: boundedIntFromEnv("CODEFORGE_MAX_PROJECT_FILE_BYTES", 5 * 1024 * 1024, 1024, 25 * 1024 * 1024), // 5 MB max per file
  maxProjectDepth: boundedIntFromEnv("CODEFORGE_MAX_PROJECT_DEPTH", 5, 1, 20), // max 5 directory levels
  allowedProjectSourceExtensions: [".cpp", ".cc", ".cxx", ".c", ".rs", ".h", ".hpp", ".hxx"] as const,

  // Compiler resource limits
  cpuTimeSeconds: boundedIntFromEnv("CODEFORGE_CPU_SECONDS", 15, 1, 60),
  wallClockTimeoutMs: boundedIntFromEnv("CODEFORGE_WALL_TIMEOUT_MS", 20_000, 1000, 120_000),
  maxProcesses: boundedIntFromEnv("CODEFORGE_MAX_PROCESSES", 64, 10, 256),
  maxVirtualMemoryKb: boundedIntFromEnv("CODEFORGE_MAX_VMEM_KB", 1_536_000, 256_000, 4_194_304), // ~1.5 GB
  maxFileSizeBlocks: boundedIntFromEnv("CODEFORGE_MAX_FILE_BLOCKS", 204_800, 1024, 1_048_576), // ~100 MB (512B blocks)

  // Worker and queue settings
  workerConcurrency: boundedIntFromEnv("CODEFORGE_WORKER_CONCURRENCY", 2, 1, 16),
  workerPollIntervalMs: boundedIntFromEnv("CODEFORGE_WORKER_POLL_INTERVAL_MS", 1000, 100, 30_000),
  staleJobThresholdMs: boundedIntFromEnv("CODEFORGE_STALE_JOB_THRESHOLD_MS", 3 * 60 * 1000, 10_000, 30 * 60 * 1000), // 3 minutes
  maxJobAttempts: boundedIntFromEnv("CODEFORGE_MAX_JOB_ATTEMPTS", 2, 1, 5),

  // Output/artifact constraints
  maxArtifactBytes: boundedIntFromEnv("CODEFORGE_MAX_ARTIFACT_BYTES", 50 * 1024 * 1024, 1024, 200 * 1024 * 1024), // 50 MB
  maxCapturedOutputBytes: boundedIntFromEnv("CODEFORGE_MAX_LOG_BYTES", 200_000, 1024, 2_000_000),

  // How long a produced .exe is kept on disk before automatic cleanup
  artifactTtlMs: boundedIntFromEnv("CODEFORGE_ARTIFACT_TTL_MS", 30 * 60 * 1000, 60_000, 24 * 60 * 60 * 1000), // 30 minutes

  // Basic per-IP throttling
  rateLimitWindowMs: boundedIntFromEnv("CODEFORGE_RATE_LIMIT_WINDOW_MS", 5 * 60 * 1000, 1000, 60 * 60 * 1000),
  rateLimitMaxBuilds: boundedIntFromEnv("CODEFORGE_RATE_LIMIT_MAX_BUILDS", 10, 1, 500),
} as const;
