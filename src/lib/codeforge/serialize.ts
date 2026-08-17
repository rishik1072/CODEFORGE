import fsSync from "node:fs";
import type { BuildRow } from "@/db/schema";
import type { BuildStageEvent, BuildStatus, PublicBuildRecord } from "./types";
import type { SupportedLanguage } from "./shared";

/**
 * Converts an internal DB row into the shape returned by the API.
 */
export function toPublicBuildRecord(row: BuildRow): PublicBuildRecord {
  const hasUsableArtifact =
    row.status === "success" &&
    !!row.artifactPath &&
    !!row.artifactFilename &&
    !!row.artifactSizeBytes &&
    (!row.artifactExpiresAt || row.artifactExpiresAt.getTime() > Date.now()) &&
    fsSync.existsSync(row.artifactPath);

  return {
    buildId: row.id,
    status: row.status as BuildStatus,
    language: (row.language as SupportedLanguage) ?? "cpp",
    originalFilename: row.originalFilename,
    projectType: (row.projectType as "single" | "multi") ?? "single",
    sourceFileCount: row.sourceFileCount ?? 1,
    headerFileCount: row.headerFileCount ?? 0,
    cppStandard: row.cppStandard,
    sourceSizeBytes: row.sourceSizeBytes,
    stages: (row.stages as BuildStageEvent[]) ?? [],
    stdout: row.stdout,
    stderr: row.stderr,
    errorMessage: row.errorMessage,
    compilerBackend: row.compilerBackend,
    artifact: hasUsableArtifact
      ? {
          filename: row.artifactFilename!,
          sizeBytes: row.artifactSizeBytes!,
          sha256: row.artifactSha256 ?? null,
          downloadUrl: `/api/build/${row.id}/download`,
          expiresAt: row.artifactExpiresAt ? row.artifactExpiresAt.toISOString() : null,
        }
      : null,
    durationMs: row.durationMs,
    workerId: row.workerId ?? null,
    createdAt: row.createdAt.toISOString(),
    queuedAt: row.queuedAt ? row.queuedAt.toISOString() : row.createdAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}
