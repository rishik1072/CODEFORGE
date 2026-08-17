import { detectDockerSupport, compileWithDocker } from "./docker-backend";
import { detectNamespaceSandboxSupport, compileWithNamespaceSandbox } from "./namespace-backend";
import type { CompileOutcome, CompileRequest } from "../types";

/**
 * Backend selection strategy:
 * 1. Prefer Docker (containerized isolation) when a Docker daemon is reachable.
 * 2. If Docker is unavailable and the host is Linux supporting MinGW / namespaces,
 *    fall back to the namespace sandbox.
 * 3. If neither backend is available (e.g. Windows without Docker running),
 *    return a controlled error instead of crashing or invoking Linux commands.
 */
export async function compileSourceInSandbox(request: CompileRequest): Promise<CompileOutcome> {
  const dockerAvailable = await detectDockerSupport();
  if (dockerAvailable) {
    return compileWithDocker(request);
  }

  const namespaceAvailable = await detectNamespaceSandboxSupport();
  if (namespaceAvailable) {
    return compileWithNamespaceSandbox(request);
  }

  return {
    status: "internal_error",
    exitCode: null,
    stdout: "",
    stderr: "No supported compilation backend is available on this host. Please ensure Docker Desktop is running.",
    artifactPath: null,
    artifactSizeBytes: null,
    durationMs: 0,
    backend: "docker",
  };
}
