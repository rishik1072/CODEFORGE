"use client";

import { useState, useCallback } from "react";
import type { BuildStageEvent, UiState } from "./types";

interface BuildConsoleProps {
  uiState: UiState;
  visibleStages: BuildStageEvent[];
  stdout: string | null;
  stderr: string | null;
  errorMessage: string | null;
}

const TERMINAL_LINE_PREFIX: Record<BuildStageEvent["stage"], string> = {
  VALIDATING: "Validating source...",
  PREPARING: "Creating secure build workspace...",
  COMPILING: "Starting MinGW-w64 cross-compiler inside sandbox...",
  LINKING: "Linking static runtime into portable executable...",
  FINALIZING: "Validating generated PE artifact (MZ header)...",
  SUCCESS: "Build successful.",
  FAILED: "Build failed.",
};

export function BuildConsole({ uiState, visibleStages, stdout, stderr, errorMessage }: BuildConsoleProps) {
  const [copied, setCopied] = useState(false);

  const getFullLogText = useCallback(() => {
    const lines: string[] = [];
    lines.push("=== CODEFORGE BUILD LOGS ===");
    for (const s of visibleStages) {
      lines.push(`[${s.at}] [${s.stage}] ${s.message || TERMINAL_LINE_PREFIX[s.stage]}`);
    }
    if (errorMessage) lines.push(`[ERROR] ${errorMessage}`);
    if (stderr) {
      lines.push("\n=== STDERR ===");
      lines.push(stderr);
    }
    if (stdout) {
      lines.push("\n=== STDOUT ===");
      lines.push(stdout);
    }
    return lines.join("\n");
  }, [visibleStages, errorMessage, stderr, stdout]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getFullLogText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  }, [getFullLogText]);

  if (uiState === "idle" || uiState === "file_selected") return null;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 font-mono text-[13px] shadow-2xl transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          <span className="ml-2 text-xs font-semibold tracking-wider text-slate-400">BUILD CONSOLE</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy build console logs"
          className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-sans font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700"
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-emerald-400">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              <span className="text-emerald-300">Copied</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-400">
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12a1.5 1.5 0 0 1 .439 1.061V16.5A1.5 1.5 0 0 1 15.5 18h-7A1.5 1.5 0 0 1 7 16.5v-13Z" />
                <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h1a.75.75 0 0 1 0 1.5h-1a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-1a.75.75 0 0 1 1.5 0v1A1.5 1.5 0 0 1 13.5 19.5h-7A1.5 1.5 0 0 1 5 18V6.5Z" />
              </svg>
              <span>Copy Output</span>
            </>
          )}
        </button>
      </div>

      {/* Terminal lines */}
      <div className="max-h-[380px] overflow-y-auto px-4 py-4 leading-relaxed scrollbar-thin">
        {uiState === "uploading" && (
          <p className="text-slate-400">
            <span className="text-emerald-400">$</span> Uploading source to CodeForge...
          </p>
        )}

        {visibleStages.map((s, idx) => (
          <div key={idx} className="my-1 flex items-start gap-2">
            <span className={s.stage === "FAILED" ? "text-red-400 font-bold" : "text-emerald-400"}>&gt;</span>
            <span className={s.stage === "FAILED" ? "text-red-300 font-medium" : "text-slate-300"}>
              {s.message || TERMINAL_LINE_PREFIX[s.stage]}
            </span>
          </div>
        ))}

        {uiState === "success" && (
          <div className="mt-3 border-t border-slate-800/80 pt-3">
            <p className="font-semibold text-emerald-400">✓ BUILD SUCCESSFUL — Windows PE binary created</p>
          </div>
        )}

        {(uiState === "compile_error" || uiState === "timeout" || uiState === "internal_error" || uiState === "security_rejected") && (
          <div className="mt-3 border-t border-slate-800/80 pt-3">
            <p className="font-semibold text-red-400">
              ✕ {uiState === "timeout" ? "BUILD TIMED OUT" : uiState === "security_rejected" ? "REQUEST REJECTED" : "BUILD FAILED"}
            </p>
          </div>
        )}

        {errorMessage && (
          <p className="mt-2 text-xs text-red-300/90 whitespace-pre-wrap rounded bg-red-950/40 border border-red-500/20 p-2.5">
            {errorMessage}
          </p>
        )}

        {stderr && (
          <div className="mt-3 rounded border border-red-500/20 bg-red-950/20 p-3">
            <p className="mb-1 text-[11px] font-sans font-semibold tracking-wide uppercase text-red-400">Compiler Diagnostics (stderr):</p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-red-200/90 text-xs leading-normal">{stderr}</pre>
          </div>
        )}

        {stdout && (
          <div className="mt-3 rounded border border-slate-800 bg-slate-900/40 p-3">
            <p className="mb-1 text-[11px] font-sans font-semibold tracking-wide uppercase text-slate-400">Compiler Output (stdout):</p>
            <pre className="overflow-x-auto whitespace-pre-wrap text-slate-300 text-xs leading-normal">{stdout}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
