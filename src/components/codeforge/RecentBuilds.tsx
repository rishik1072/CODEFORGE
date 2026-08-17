"use client";

import { useEffect, useState, useCallback } from "react";
import type { BuildRecord } from "./types";

interface RecentBuildsProps {
  onSelectBuild?: (build: BuildRecord) => void;
  currentBuildId?: string;
  refreshTrigger?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function timeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export function RecentBuilds({ onSelectBuild, currentBuildId, refreshTrigger }: RecentBuildsProps) {
  const [builds, setBuilds] = useState<BuildRecord[]>([]);

  const fetchBuilds = useCallback(async () => {
    try {
      const res = await fetch("/api/builds?limit=10");
      if (res.ok) {
        const data = (await res.json()) as { builds: BuildRecord[] };
        setBuilds(data.builds ?? []);
      }
    } catch {
      // Ignore network errors on polling
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/builds?limit=10");
        if (res.ok && !ignore) {
          const data = (await res.json()) as { builds: BuildRecord[] };
          setBuilds(data.builds ?? []);
        }
      } catch {
        // Ignore network errors on polling
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  if (builds.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            RECENT BUILDS
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{builds.length} builds recorded</span>
          <button
            type="button"
            onClick={fetchBuilds}
            aria-label="Refresh build list"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-3 divide-y divide-slate-800/50">
        {builds.map((b) => {
          const isSuccess = b.status === "success";
          const isSelected = b.buildId === currentBuildId;

          return (
            <div
              key={b.buildId}
              onClick={() => onSelectBuild?.(b)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectBuild?.(b);
              }}
              className={`flex items-center justify-between py-3 px-2 rounded-lg transition-colors cursor-pointer ${
                isSelected
                  ? "bg-slate-800/80 border border-slate-700"
                  : "hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isSuccess
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/15 text-red-400 border border-red-500/30"
                  }`}
                >
                  {isSuccess ? "✓" : "✕"}
                </span>

                <div className="truncate">
                  <p className="font-mono text-xs font-semibold text-slate-200 truncate">
                    {b.originalFilename}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    <span className="uppercase font-mono text-slate-300">{b.cppStandard}</span>
                    {b.artifact ? ` · ${formatBytes(b.artifact.sizeBytes)}` : ""}
                    {b.durationMs !== null ? ` · ${(b.durationMs / 1000).toFixed(1)}s` : ""}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 ml-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    isSuccess
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-300 border border-red-500/20"
                  }`}
                >
                  {b.status}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(b.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
