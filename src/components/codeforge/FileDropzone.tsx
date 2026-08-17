"use client";

import { useCallback, useRef, useState } from "react";
import { DISPLAY_MAX_UPLOAD_KB, DISPLAY_MAX_SINGLE_FILE_KB, type SupportedLanguage } from "@/lib/codeforge/shared";

interface FileDropzoneProps {
  language: SupportedLanguage;
  selectedFile: File | null;
  disabled: boolean;
  onFileSelected: (file: File) => void;
  onRemoveFile: () => void;
  clientError: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileDropzone({
  language,
  selectedFile,
  disabled,
  onFileSelected,
  onRemoveFile,
  clientError,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  const isZip = selectedFile?.name.toLowerCase().endsWith(".zip");
  const langLabel = language === "cpp" ? "C++" : language === "c" ? "C" : "Rust";
  const acceptExts =
    language === "cpp"
      ? ".cpp,.cc,.cxx,.zip"
      : language === "c"
        ? ".c,.zip"
        : ".rs,.zip";
  const singleExtLabel = language === "cpp" ? ".cpp" : language === "c" ? ".c" : ".rs";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptExts}
        className="hidden"
        disabled={disabled}
        aria-label={`Upload ${langLabel} source or project archive`}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {selectedFile ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              {isZip ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-medium text-emerald-300 break-all">{selectedFile.name}</p>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  {isZip ? `${langLabel} Project` : `${langLabel} Source`}
                </span>
              </div>
              <p className="text-xs text-slate-400">{formatBytes(selectedFile.size)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onRemoveFile}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Upload ${langLabel} source or project dropzone`}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragActive(false);
            if (!disabled) handleFiles(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
            disabled
              ? "cursor-not-allowed border-slate-800 bg-slate-900/30 opacity-60"
              : isDragActive
                ? "border-emerald-400 bg-emerald-400/5 shadow-inner"
                : "border-slate-700 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/70"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-6 w-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3.75 3.75 0 0 1 4.133 6.058A4.502 4.502 0 0 1 18.75 19.5H6.75Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              Drop your <span className="font-mono text-emerald-400">{singleExtLabel}</span> source or <span className="font-mono text-emerald-400">.zip</span> project
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Single file (max {Math.floor(DISPLAY_MAX_SINGLE_FILE_KB / 1024)} MB) &middot; ZIP project (max {Math.floor(DISPLAY_MAX_UPLOAD_KB / 1024)} MB)
            </p>
          </div>
        </div>
      )}

      {clientError && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <span>{clientError}</span>
        </div>
      )}
    </div>
  );
}
