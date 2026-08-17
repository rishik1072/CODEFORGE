import type { SupportedLanguage } from "./shared";

/** Full lifecycle of a build job, surfaced verbatim to the frontend. */
export type BuildStatus =
  | "validating"
  | "queued"
  | "compiling"
  | "success"
  | "compile_error"
  | "security_rejected"
  | "timeout"
  | "cancelled"
  | "internal_error";

export interface BuildStageEvent {
  stage:
    | "VALIDATING"
    | "PREPARING"
    | "COMPILING"
    | "LINKING"
    | "FINALIZING"
    | "SUCCESS"
    | "FAILED";
  message: string;
  at: string; // ISO timestamp
}

export interface CompileRequest {
  buildId: string;
  workspaceDir: string;
  language: SupportedLanguage;
  sourceFiles: string[]; // e.g. ["main.c"] or ["main.cpp", "Student.cpp"]
  standard: string; // validated C or C++ standard string
}

export interface CompileOutcome {
  status: "success" | "compile_error" | "timeout" | "internal_error";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  artifactPath: string | null;
  artifactSizeBytes: number | null;
  durationMs: number;
  backend: "namespace-sandbox" | "docker";
}

export interface PublicArtifactInfo {
  filename: string;
  sizeBytes: number;
  sha256: string | null;
  downloadUrl: string;
  expiresAt: string | null;
}

export interface PublicBuildRecord {
  buildId: string;
  status: BuildStatus;
  language: SupportedLanguage;
  originalFilename: string;
  projectType: "single" | "multi";
  sourceFileCount: number;
  headerFileCount: number;
  cppStandard: string; // Named cppStandard for backwards DB/API compatibility or standard
  sourceSizeBytes: number;
  stages: BuildStageEvent[];
  stdout: string | null;
  stderr: string | null;
  errorMessage: string | null;
  compilerBackend: string | null;
  artifact: PublicArtifactInfo | null;
  durationMs: number | null;
  workerId?: string | null;
  createdAt: string;
  queuedAt?: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export class SecurityRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityRejectionError";
  }
}
