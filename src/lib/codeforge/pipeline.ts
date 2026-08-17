import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { builds, type BuildRow } from "@/db/schema";
import { eq } from "drizzle-orm";
import { codeforgeConfig } from "./config";
import { sanitizeCompilerOutput } from "./sanitize";
import { compileSourceInSandbox } from "./sandbox";
import { extractZipSafely } from "./unzip";
import { inspectProjectWorkspace } from "./project";
import { CompilerRegistry } from "./compilers";
import type { BuildStageEvent, BuildStatus } from "./types";
import type { SupportedLanguage } from "./shared";
import {
  createWorkspace,
  readUploadedSource,
  removeWorkspace,
  sweepExpiredWorkspaces,
} from "./workspace";

function stage(
  list: BuildStageEvent[],
  s: BuildStageEvent["stage"],
  message: string,
): BuildStageEvent[] {
  list.push({ stage: s, message, at: new Date().toISOString() });
  return list;
}

function deriveArtifactFilename(originalFilename: string): string {
  const base = originalFilename.replace(/\.(cpp|cc|cxx|c|rs|zip)$/i, "");
  const safeBase = base.replace(/[^A-Za-z0-9._-]/g, "_") || "program";
  return `${safeBase}.exe`;
}

/**
 * Executes a claimed build job from start to finish.
 * Called by the background worker.
 */
export async function executeBuildJob(job: BuildRow): Promise<{ status: BuildStatus; durationMs?: number }> {
  const buildId = job.id;
  const language = (job.language as SupportedLanguage) ?? "cpp";
  const standard = job.cppStandard;
  const originalFilename = job.originalFilename;
  const isZip = originalFilename.toLowerCase().endsWith(".zip");
  const compiler = CompilerRegistry.getCompiler(language);
  const stages: BuildStageEvent[] = (job.stages as BuildStageEvent[]) || [];

  sweepExpiredWorkspaces().catch((err) => {
    console.error("[codeforge] cleanup sweep failed:", err);
  });

  const workspaceDir = await createWorkspace(buildId);
  const startedAt = job.startedAt ?? new Date();

  try {
    let sourceBuffer: Buffer;
    if (job.sourcePayloadBase64) {
      sourceBuffer = Buffer.from(job.sourcePayloadBase64, "base64");
    } else {
      sourceBuffer = await readUploadedSource(buildId);
    }

    let sourceFiles: string[] = [];
    let sourceFileCount = 1;
    let headerFileCount = 0;
    let projectType: "single" | "multi" = "single";

    if (isZip) {
      stage(
        stages,
        "PREPARING",
        "Extracting project archive safely with path traversal & zip-bomb protection...",
      );
      const extracted = await extractZipSafely(sourceBuffer, workspaceDir);

      stage(
        stages,
        "PREPARING",
        `Extracted ${extracted.fileCount} files (${extracted.totalExtractedBytes} bytes). Inspecting project...`,
      );
      const project = await inspectProjectWorkspace(workspaceDir, language);

      sourceFiles = project.sourceFiles;
      sourceFileCount = project.sourceFiles.length;
      headerFileCount = project.headerFiles.length;
      projectType = project.projectType;

      stage(
        stages,
        "PREPARING",
        `Discovered ${sourceFileCount} ${compiler.language.toUpperCase()} sources and ${headerFileCount} headers. Entry point: ${project.entryPoint}`,
      );
    } else {
      const sourceFilename = compiler.singleSourceEntrypointName;
      await fs.writeFile(path.join(workspaceDir, sourceFilename), sourceBuffer, {
        mode: 0o600,
      });
      sourceFiles = [sourceFilename];
    }

    const stdLabel = language === "rust" ? `toolchain: ${standard}` : `-std=${standard}`;
    stage(
      stages,
      "COMPILING",
      `Invoking ${compiler.language.toUpperCase()} cross-compiler on ${sourceFiles.length} source ${sourceFiles.length === 1 ? "file" : "files"} (${stdLabel})...`,
    );

    await db
      .update(builds)
      .set({
        status: "compiling" satisfies BuildStatus,
        stages,
        projectType,
        sourceFileCount,
        headerFileCount,
        startedAt,
      })
      .where(eq(builds.id, buildId));

    const outcome = await compileSourceInSandbox({
      buildId,
      workspaceDir,
      language,
      sourceFiles,
      standard,
    });

    const sanitizedStdout = sanitizeCompilerOutput(outcome.stdout).slice(
      0,
      codeforgeConfig.maxCapturedOutputBytes,
    );
    const sanitizedStderr = sanitizeCompilerOutput(outcome.stderr).slice(
      0,
      codeforgeConfig.maxCapturedOutputBytes,
    );

    const finishedAt = new Date();

    if (outcome.status === "success" && outcome.artifactPath) {
      stage(stages, "LINKING", "Linking static runtime into portable Windows executable...");
      stage(stages, "FINALIZING", "Validating generated PE artifact...");
      stage(stages, "SUCCESS", "Build succeeded.");

      const artifactFilename = deriveArtifactFilename(originalFilename);
      const artifactExpiresAt = new Date(Date.now() + codeforgeConfig.artifactTtlMs);

      let artifactSha256: string | null = null;
      let artifactPayloadBase64: string | null = null;
      try {
        const artifactContent = await fs.readFile(outcome.artifactPath);
        artifactSha256 = createHash("sha256").update(artifactContent).digest("hex");
        artifactPayloadBase64 = artifactContent.toString("base64");
      } catch (hashErr) {
        console.error(`[codeforge] failed to compute SHA-256 for build ${buildId}:`, hashErr);
      }

      await db
        .update(builds)
        .set({
          status: "success" satisfies BuildStatus,
          stages,
          stdout: sanitizedStdout,
          stderr: sanitizedStderr,
          compilerBackend: outcome.backend,
          artifactPath: outcome.artifactPath,
          artifactPayloadBase64,
          artifactFilename,
          artifactSizeBytes: outcome.artifactSizeBytes,
          artifactSha256,
          artifactExpiresAt,
          durationMs: outcome.durationMs,
          finishedAt,
        })
        .where(eq(builds.id, buildId));
      return { status: "success", durationMs: outcome.durationMs };
    }

    const status: BuildStatus =
      outcome.status === "timeout"
        ? "timeout"
        : outcome.status === "internal_error"
          ? "internal_error"
          : "compile_error";

    const errorMessage =
      status === "timeout"
        ? `Build exceeded the maximum allowed time of ${Math.ceil(codeforgeConfig.wallClockTimeoutMs / 1000)}s and was terminated.`
        : status === "internal_error"
          ? outcome.stderr || "An internal error occurred while compiling. This has been logged for investigation."
          : "Compilation failed. See build output for compiler diagnostics.";

    stage(stages, "FAILED", errorMessage);

    await db
      .update(builds)
      .set({
        status,
        stages,
        stdout: sanitizedStdout,
        stderr: sanitizedStderr,
        errorMessage,
        compilerBackend: outcome.backend,
        durationMs: outcome.durationMs,
        finishedAt,
      })
      .where(eq(builds.id, buildId));

    await removeWorkspace(workspaceDir);
    return { status, durationMs: outcome.durationMs };
  } catch (err) {
    const isSecurityErr =
      err && typeof err === "object" && "name" in err && err.name === "SecurityRejectionError";
    const errorMessage = err instanceof Error ? err.message : "An internal error occurred.";

    console.error(`[codeforge] build ${buildId} failed: ${errorMessage}`);
    stage(stages, "FAILED", errorMessage);

    const finalStatus: BuildStatus = isSecurityErr ? "security_rejected" : "internal_error";

    await db
      .update(builds)
      .set({
        status: finalStatus,
        stages,
        errorMessage,
        finishedAt: new Date(),
      })
      .where(eq(builds.id, buildId));

    await removeWorkspace(workspaceDir).catch(() => undefined);
    return { status: finalStatus, durationMs: 0 };
  }
}
