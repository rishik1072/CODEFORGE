"use client";

import { useState, useCallback } from "react";
import type { BuildRecord } from "./types";
import { LANGUAGE_LABELS } from "@/lib/codeforge/shared";

interface BuildResultCardProps {
  record: BuildRecord;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BuildResultCard({ record }: BuildResultCardProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const artifact = record.artifact;
  const sha256 = artifact?.sha256;
  const downloadUrl = artifact?.downloadUrl;
  const filename = artifact?.filename;

  const handleCopyHash = useCallback(async () => {
    if (!sha256) return;
    try {
      await navigator.clipboard.writeText(sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  }, [sha256]);

  const handleDownload = useCallback(async () => {
    if (!downloadUrl || !filename) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message ?? `Download failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Failed to download artifact");
    } finally {
      setDownloading(false);
    }
  }, [downloadUrl, filename]);

  if (!artifact) return null;

  const durationSec = record.durationMs !== null ? (record.durationMs / 1000).toFixed(2) : null;
  const isMultiFile = record.projectType === "multi" || record.sourceFileCount > 1;
  const langLabel = LANGUAGE_LABELS[record.language] ?? "C++";
  const compilerLabel =
    record.language === "rust"
      ? "Rust / rustc"
      : record.language === "c"
        ? "MinGW-w64 GCC"
        : "MinGW-w64 G++";
  const standardTitle = record.language === "rust" ? "Toolchain" : "Standard";

  return (
    <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-slate-950/60 p-6 shadow-xl shadow-emerald-950/10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
            </span>
            <h3 className="text-base font-semibold text-emerald-300">BUILD SUCCESSFUL</h3>
          </div>
          <p className="mt-1 font-mono text-lg font-bold text-slate-100 break-all">{artifact.filename}</p>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-95 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          {downloading ? "Downloading..." : "DOWNLOAD EXE"}
        </button>
      </div>

      {downloadError && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {downloadError}
        </div>
      )}

      {/* Grid of build specs */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="block text-slate-400">Language</span>
          <span className="mt-1 font-semibold text-slate-200">{langLabel}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="block text-slate-400">Compiler</span>
          <span className="mt-1 font-semibold text-slate-200">{compilerLabel}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="block text-slate-400">{standardTitle}</span>
          <span className="mt-1 font-semibold uppercase text-slate-200">{record.cppStandard}</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="block text-slate-400">Artifact Size</span>
          <span className="mt-1 font-semibold text-slate-200">{formatBytes(artifact.sizeBytes)}</span>
        </div>
      </div>

      {/* Multi-file metadata row if applicable */}
      {isMultiFile && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="block text-slate-400">Project Type</span>
            <span className="mt-0.5 font-semibold text-slate-200">Multi-File Project</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="block text-slate-400">Source Files</span>
            <span className="mt-0.5 font-semibold text-slate-200">{record.sourceFileCount}</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 col-span-2 sm:col-span-1">
            <span className="block text-slate-400">Header / Mod Files</span>
            <span className="mt-0.5 font-semibold text-slate-200">{record.headerFileCount}</span>
          </div>
        </div>
      )}

      {/* Timing, Platform & SHA-256 Checksum */}
      <div className="mt-4 flex flex-col gap-3 pt-3 border-t border-slate-800/60 text-xs">
        <div className="flex items-center justify-between text-slate-400">
          <span>Target Platform:</span>
          <span className="font-semibold text-slate-200">Windows x64 (PE binary)</span>
        </div>

        {durationSec && (
          <div className="flex items-center justify-between text-slate-400">
            <span>Build Time:</span>
            <span className="font-mono text-slate-200">{durationSec} seconds</span>
          </div>
        )}

        {artifact.sha256 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-semibold text-slate-400 shrink-0">SHA-256:</span>
              <span className="font-mono text-[11px] text-emerald-300 truncate" title={artifact.sha256}>
                {artifact.sha256}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyHash}
              aria-label="Copy SHA-256 hash"
              className="self-end sm:self-auto shrink-0 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              {copiedHash ? "Copied" : "Copy Hash"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
