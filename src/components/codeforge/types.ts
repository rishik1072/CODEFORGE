// Client-side mirror of the public API contract.

export type SupportedLanguage = "cpp" | "c" | "rust";

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
  stage: "VALIDATING" | "PREPARING" | "COMPILING" | "LINKING" | "FINALIZING" | "SUCCESS" | "FAILED";
  message: string;
  at: string;
}

export interface BuildArtifact {
  filename: string;
  sizeBytes: number;
  sha256: string | null;
  downloadUrl: string;
  expiresAt: string | null;
}

export interface BuildRecord {
  buildId: string;
  status: BuildStatus;
  language: SupportedLanguage;
  originalFilename: string;
  projectType: "single" | "multi";
  sourceFileCount: number;
  headerFileCount: number;
  cppStandard: string;
  sourceSizeBytes: number;
  stages: BuildStageEvent[];
  stdout: string | null;
  stderr: string | null;
  errorMessage: string | null;
  compilerBackend: string | null;
  artifact: BuildArtifact | null;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string | null;
  createdAt?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  defaultLanguage: SupportedLanguage;
  buildCount: number;
  lastBuildAt: string | null;
  lastBuildStatus: BuildStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export type UiState =
  | "idle"
  | "file_selected"
  | "uploading"
  | "validating"
  | "queued"
  | "building"
  | "success"
  | "compile_error"
  | "security_rejected"
  | "timeout"
  | "cancelled"
  | "internal_error";
