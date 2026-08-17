import os from "node:os";
import { codeforgeConfig } from "./config";

/**
 * Strips ANSI terminal escape sequences (colors, cursor manipulation, title spoofing, bell).
 */
export function stripAnsiEscapes(text: string): string {
  // Matches ANSI escape codes, CSI sequences, OSC sequences
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/**
 * Defense-in-depth output scrubbing. The sandbox is designed so compiler
 * diagnostics only ever reference the relative filename "main.cpp"
 * (because compilation always runs with that file as the cwd-relative
 * argument), but this strips any absolute host paths that could
 * theoretically leak through compiler-internal temp file names, linker
 * messages, or crash output.
 */
export function sanitizeCompilerOutput(raw: string): string {
  let out = stripAnsiEscapes(raw);
  const hostPaths = [codeforgeConfig.dataDir, os.tmpdir()];
  for (const hostPath of hostPaths) {
    if (!hostPath) continue;
    out = out.split(hostPath).join("<workspace>");
  }
  // Strip any remaining absolute /tmp/... or /home/... style paths.
  out = out.replace(/\/(?:tmp|home|root)\/[^\s:]*/g, "<workspace>");

  // If output was truncated to maxCapturedOutputBytes, append indicator
  if (out.length >= codeforgeConfig.maxCapturedOutputBytes) {
    out = `${out.slice(0, codeforgeConfig.maxCapturedOutputBytes)}\n\n[output truncated]`;
  }

  return out;
}
