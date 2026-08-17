import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { codeforgeConfig } from "../config";
import { CompilerRegistry } from "../compilers";
import type { CompileOutcome, CompileRequest } from "../types";

let unshareSupportCache: boolean | null = null;

export async function detectNamespaceSandboxSupport(): Promise<boolean> {
  if (process.platform === "win32") return false;
  return detectUnshareSupport();
}

async function detectUnshareSupport(): Promise<boolean> {
  if (process.platform === "win32") return false;
  if (unshareSupportCache !== null) return unshareSupportCache;
  unshareSupportCache = await new Promise<boolean>((resolve) => {
    const probe = spawn("unshare", ["--net", "--map-root-user", "--pid", "--fork", "true"], {
      stdio: "ignore",
    });
    probe.on("error", () => resolve(false));
    probe.on("exit", (code) => resolve(code === 0));
  });
  return unshareSupportCache;
}

function buildCompilerScript(
  compilerBinary: string,
  sourceFiles: string[],
  standard: string,
): string {
  const wallSeconds = Math.ceil(codeforgeConfig.wallClockTimeoutMs / 1000);
  const filesList = sourceFiles.map((f) => `"${f.replace(/["\\]/g, "")}"`).join(" ");
  return [
    `ulimit -t ${codeforgeConfig.cpuTimeSeconds}`,
    `ulimit -u ${codeforgeConfig.maxProcesses}`,
    `ulimit -v ${codeforgeConfig.maxVirtualMemoryKb}`,
    `ulimit -f ${codeforgeConfig.maxFileSizeBlocks}`,
    `exec timeout --signal=KILL ${wallSeconds}s ${compilerBinary} ` +
      `-std=${standard} -O2 -Wall -Wextra -static -static-libgcc -I. ` +
      `-o output.exe ${filesList}`,
  ].join(" && ");
}

export async function compileWithNamespaceSandbox(
  request: CompileRequest,
): Promise<CompileOutcome> {
  const startedAt = Date.now();
  const compiler = CompilerRegistry.getCompiler(request.language);
  const script = buildCompilerScript(compiler.compilerBinary, request.sourceFiles, request.standard);
  const useNamespaces = await detectUnshareSupport();

  const args = useNamespaces
    ? ["--net", "--map-root-user", "--pid", "--fork", "--", "bash", "-c", script]
    : [];

  const executable = useNamespaces ? "unshare" : "bash";
  const finalArgs = useNamespaces ? args : ["-c", script];

  const outcome = await new Promise<CompileOutcome>((resolve) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    const cap = codeforgeConfig.maxCapturedOutputBytes;

    const child = spawn(executable, finalArgs, {
      cwd: request.workspaceDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < cap) stdout = Buffer.concat([stdout, chunk]).subarray(0, cap);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < cap) stderr = Buffer.concat([stderr, chunk]).subarray(0, cap);
    });

    child.on("error", (err) => {
      resolve({
        status: "internal_error",
        exitCode: null,
        stdout: stdout.toString("utf-8"),
        stderr: `Failed to spawn compiler process: ${err.message}`,
        artifactPath: null,
        artifactSizeBytes: null,
        durationMs: Date.now() - startedAt,
        backend: "namespace-sandbox",
      });
    });

    child.on("exit", (code, signal) => {
      const wasKilledByTimeout = code === 124 || code === 137 || signal === "SIGKILL";
      resolve({
        status: wasKilledByTimeout ? "timeout" : code === 0 ? "success" : "compile_error",
        exitCode: code,
        stdout: stdout.toString("utf-8"),
        stderr: stderr.toString("utf-8"),
        artifactPath: null,
        artifactSizeBytes: null,
        durationMs: Date.now() - startedAt,
        backend: "namespace-sandbox",
      });
    });
  });

  if (outcome.status === "success") {
    const artifactPath = path.join(request.workspaceDir, "output.exe");
    try {
      const stat = await fs.stat(artifactPath);
      if (stat.size === 0 || stat.size > codeforgeConfig.maxArtifactBytes) {
        return { ...outcome, status: "internal_error", stderr: "Artifact failed post-build validation." };
      }

      const fh = await fs.open(artifactPath, "r");
      const header = Buffer.alloc(2);
      await fh.read(header, 0, 2, 0);
      await fh.close();
      if (header.toString("ascii") !== "MZ") {
        return { ...outcome, status: "internal_error", stderr: "Compiled output is not a valid PE executable." };
      }

      return { ...outcome, artifactPath, artifactSizeBytes: stat.size };
    } catch {
      return { ...outcome, status: "internal_error", stderr: "No output artifact was produced." };
    }
  }

  return outcome;
}
