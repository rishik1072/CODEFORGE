import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { codeforgeConfig } from "../config";
import { CompilerRegistry } from "../compilers";
import type { CompileOutcome, CompileRequest } from "../types";

let dockerSupportCache: boolean | null = null;

export async function detectDockerSupport(): Promise<boolean> {
  if (dockerSupportCache !== null) return dockerSupportCache;
  dockerSupportCache = await new Promise<boolean>((resolve) => {
    const probe = spawn("docker", ["info"], { stdio: "ignore" });
    probe.on("error", () => resolve(false));
    probe.on("exit", (code) => resolve(code === 0));
  });
  return dockerSupportCache;
}

/**
 * Normalizes host workspace paths into a format accepted by Docker CLI
 * regardless of host OS (Windows or POSIX).
 */
export function formatDockerMountPath(hostPath: string): string {
  const resolved = path.resolve(hostPath);
  return `${resolved}:/work:rw`;
}

export async function compileWithDocker(request: CompileRequest): Promise<CompileOutcome> {
  const startedAt = Date.now();
  const compiler = CompilerRegistry.getCompiler(request.language);
  const containerName = `codeforge-build-${request.buildId}`;
  const mountSpec = formatDockerMountPath(request.workspaceDir);

  const baseDockerArgs = [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network",
    "none", // no network access
    "--memory",
    `${Math.floor(codeforgeConfig.maxVirtualMemoryKb / 1024)}m`,
    "--cpus",
    "1",
    "--pids-limit",
    String(codeforgeConfig.maxProcesses),
    "--read-only", // root filesystem is read-only
    "--tmpfs",
    "/tmp:size=64m",
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    "--user",
    "1000:1000", // non-root container user
    "-v",
    mountSpec,
    "-w",
    "/work",
  ];

  let args: string[];

  // Single-file mode: maintain full compatibility with container entrypoint script
  if (request.sourceFiles.length === 1 && request.sourceFiles[0] === compiler.singleSourceEntrypointName) {
    const standardEnvVar =
      request.language === "c"
        ? "C_STANDARD"
        : request.language === "rust"
          ? "RUST_TOOLCHAIN"
          : "CPP_STANDARD";
    args = [
      ...baseDockerArgs,
      "-e",
      `${standardEnvVar}=${request.standard}`,
      "-e",
      `SOURCE_FILE=${compiler.singleSourceEntrypointName}`,
      compiler.dockerImage,
    ];
  } else {
    // Multi-file / custom source file mode: invoke compiler binary directly via --entrypoint
    const compilerArgs = compiler.buildCompilerArgs(request.sourceFiles, request.standard);

    args = [
      ...baseDockerArgs,
      "--entrypoint",
      compiler.compilerBinary,
      compiler.dockerImage,
      ...compilerArgs,
    ];
  }

  const outcome = await new Promise<CompileOutcome>((resolve) => {
    let timedOut = false;
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    const cap = codeforgeConfig.maxCapturedOutputBytes;

    const child = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      const killer = spawn("docker", ["rm", "-f", containerName], { stdio: "ignore" });
      killer.on("exit", () => {
        child.kill("SIGKILL");
      });
      killer.on("error", () => {
        child.kill("SIGKILL");
      });
    }, codeforgeConfig.wallClockTimeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < cap) stdout = Buffer.concat([stdout, chunk]).subarray(0, cap);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < cap) stderr = Buffer.concat([stderr, chunk]).subarray(0, cap);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        status: "internal_error",
        exitCode: null,
        stdout: stdout.toString("utf-8"),
        stderr: `Failed to start Docker sandbox: ${err.message}`,
        artifactPath: null,
        artifactSizeBytes: null,
        durationMs: Date.now() - startedAt,
        backend: "docker",
      });
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      const wasKilledByTimeout = timedOut || code === 124 || code === 137 || signal === "SIGKILL";
      resolve({
        status: wasKilledByTimeout ? "timeout" : code === 0 ? "success" : "compile_error",
        exitCode: code,
        stdout: stdout.toString("utf-8"),
        stderr: stderr.toString("utf-8"),
        artifactPath: null,
        artifactSizeBytes: null,
        durationMs: Date.now() - startedAt,
        backend: "docker",
      });
    });
  });

  if (outcome.status === "success") {
    const artifactPath = path.join(request.workspaceDir, "output.exe");
    try {
      const lstat = await fs.lstat(artifactPath);
      if (!lstat.isFile() || lstat.isSymbolicLink()) {
        return { ...outcome, status: "internal_error", stderr: "Artifact failed security validation: not a regular file." };
      }
      if (lstat.size === 0 || lstat.size > codeforgeConfig.maxArtifactBytes) {
        return { ...outcome, status: "internal_error", stderr: "Artifact failed post-build validation." };
      }

      // Verify it is actually a Windows PE binary ("MZ" magic header)
      const fh = await fs.open(artifactPath, "r");
      const header = Buffer.alloc(2);
      await fh.read(header, 0, 2, 0);
      await fh.close();
      if (header.toString("ascii") !== "MZ") {
        return { ...outcome, status: "internal_error", stderr: "Compiled output is not a valid PE executable." };
      }

      return { ...outcome, artifactPath, artifactSizeBytes: lstat.size };
    } catch {
      return { ...outcome, status: "internal_error", stderr: "No output artifact was produced." };
    }
  }

  return outcome;
}
