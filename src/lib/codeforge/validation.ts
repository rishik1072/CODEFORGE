import {
  codeforgeConfig,
  isSupportedLanguage,
  isSupportedStandardForLanguage,
  type SupportedLanguage,
} from "./config";
import { CompilerRegistry } from "./compilers";
import { SecurityRejectionError } from "./types";

/**
 * All uploaded source is untrusted input. Every check here fails closed:
 * anything ambiguous is rejected rather than "probably fine".
 */

const FILENAME_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function validateLanguage(value: string | null | undefined): SupportedLanguage {
  if (!value) return "cpp"; // Default to C++ for backwards compatibility
  if (!isSupportedLanguage(value)) {
    throw new SecurityRejectionError(`Unsupported language: "${value}". Supported: cpp, c, rust`);
  }
  return value;
}

export function validateFilename(name: string, language?: SupportedLanguage): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new SecurityRejectionError("Filename is required.");
  }
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
    throw new SecurityRejectionError("Filename contains illegal path characters.");
  }
  if (trimmed.includes("\0")) {
    throw new SecurityRejectionError("Filename contains a null byte.");
  }
  if (!FILENAME_PATTERN.test(trimmed)) {
    throw new SecurityRejectionError(
      "Filename must only contain letters, numbers, dots, dashes, and underscores.",
    );
  }

  const lower = trimmed.toLowerCase();

  // If a specific language is provided, enforce that language's allowed single-file extensions or .zip
  if (language) {
    const compiler = CompilerRegistry.getCompiler(language);
    const allowed = [...compiler.sourceExtensions, ".zip"];
    const matches = allowed.some((ext) => lower.endsWith(ext));
    if (!matches) {
      throw new SecurityRejectionError(
        `Unsupported file extension for ${language.toUpperCase()}. Allowed: ${allowed.join(", ")}`,
      );
    }
  } else {
    const hasAllowedExtension = codeforgeConfig.allowedExtensions.some((ext) =>
      lower.endsWith(ext),
    );
    if (!hasAllowedExtension) {
      throw new SecurityRejectionError(
        `Unsupported file extension. Allowed: ${codeforgeConfig.allowedExtensions.join(", ")}`,
      );
    }
  }

  return trimmed;
}

export function validateStandard(value: string | null, language: SupportedLanguage = "cpp"): string {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new SecurityRejectionError("Unsupported or missing language standard.");
  }
  const trimmed = value.trim();
  if (!isSupportedStandardForLanguage(language, trimmed)) {
    const compiler = CompilerRegistry.getCompiler(language);
    throw new SecurityRejectionError(
      `Unsupported standard "${trimmed}" for ${language.toUpperCase()}. Allowed: ${compiler.supportedStandards.join(", ")}`,
    );
  }
  return trimmed;
}

export function validateSize(sizeBytes: number, isZip = false): void {
  if (sizeBytes <= 0) {
    throw new SecurityRejectionError("Uploaded file is empty.");
  }
  const maxBytes = isZip ? codeforgeConfig.maxProjectUploadBytes : codeforgeConfig.maxUploadBytes;
  if (sizeBytes > maxBytes) {
    throw new SecurityRejectionError(
      `File exceeds the maximum allowed size of ${Math.floor(
        maxBytes / (1024 * 1024),
      )} MB.`,
    );
  }
}

/**
 * Validates file content depending on type (source text vs .zip).
 */
export function validateUploadContent(buffer: Buffer, isZip = false): void {
  if (isZip) {
    // ZIP magic bytes check: PK\x03\x04 or PK\x05\x06
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new SecurityRejectionError("Invalid archive format: expected ZIP file signature.");
    }
    return;
  }

  // Source text validation
  if (buffer.includes(0)) {
    throw new SecurityRejectionError("File appears to be binary, not source text.");
  }

  let text: string;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    text = decoder.decode(buffer);
  } catch {
    throw new SecurityRejectionError("File is not valid UTF-8 text.");
  }

  let controlChars = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const isPrintable = code === 9 || code === 10 || code === 13 || code >= 32;
    if (!isPrintable) controlChars += 1;
  }
  if (controlChars > 0) {
    throw new SecurityRejectionError("File contains disallowed control characters.");
  }
}

export function validateSourceContent(buffer: Buffer): string {
  validateUploadContent(buffer, false);
  return buffer.toString("utf-8");
}
