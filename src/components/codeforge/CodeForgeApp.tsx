"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_STANDARD,
  DISPLAY_MAX_UPLOAD_KB,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  getStandardLabelsForLanguage,
  getStandardsForLanguage,
  type SupportedLanguage,
} from "@/lib/codeforge/shared";
import { BuildConsole } from "./BuildConsole";
import { BuildResultCard } from "./BuildResultCard";
import { FileDropzone } from "./FileDropzone";
import { RecentBuilds } from "./RecentBuilds";
import { SecurityCard } from "./SecurityCard";
import { AuthModal } from "./AuthModal";
import { ProjectsManager } from "./ProjectsManager";
import { ApiKeysManager } from "./ApiKeysManager";
import type { ApiError, BuildRecord, BuildStageEvent, UiState, UserAccount } from "./types";

export function CodeForgeApp() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [language, setLanguage] = useState<SupportedLanguage>("cpp");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [standard, setStandard] = useState<string>("c++20");
  const [uiState, setUiState] = useState<UiState>("idle");
  const [clientError, setClientError] = useState<string | null>(null);
  const [visibleStages, setVisibleStages] = useState<BuildStageEvent[]>([]);
  const [record, setRecord] = useState<BuildRecord | null>(null);
  const [topLevelError, setTopLevelError] = useState<string | null>(null);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState(0);
  const runToken = useRef(0);

  const isBusy = uiState === "uploading" || uiState === "validating" || uiState === "queued" || uiState === "building";

  const standards = useMemo(() => getStandardsForLanguage(language), [language]);
  const standardLabels = useMemo(() => getStandardLabelsForLanguage(language), [language]);

  // Check authenticated session on load
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => undefined);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/me", { method: "POST" });
      setUser(null);
      setActiveProjectId(null);
      setRefreshHistoryTrigger((prev) => prev + 1);
    } catch {
      // Ignore
    }
  };

  const handleLanguageChange = useCallback((newLang: SupportedLanguage) => {
    setLanguage(newLang);
    setStandard(DEFAULT_STANDARD[newLang]);
    setSelectedFile(null);
    setRecord(null);
    setVisibleStages([]);
    setClientError(null);
    setTopLevelError(null);
    setUiState("idle");
  }, []);

  const handleFileSelected = useCallback((file: File) => {
    setClientError(null);
    setTopLevelError(null);
    setRecord(null);
    setVisibleStages([]);

    const lowerName = file.name.toLowerCase();
    const isZip = lowerName.endsWith(".zip");
    const isCpp = lowerName.endsWith(".cpp") || lowerName.endsWith(".cc") || lowerName.endsWith(".cxx");
    const isC = lowerName.endsWith(".c");
    const isRust = lowerName.endsWith(".rs");

    if (language === "cpp" && !isCpp && !isZip) {
      setClientError("Unsupported file type for C++. Upload .cpp / .cc / .cxx or a .zip project.");
      return;
    }

    if (language === "c" && !isC && !isZip) {
      setClientError("Unsupported file type for C. Upload .c source or a .zip project.");
      return;
    }

    if (language === "rust" && !isRust && !isZip) {
      setClientError("Unsupported file type for Rust. Upload .rs source or a .zip project.");
      return;
    }

    if (file.size === 0) {
      setClientError("The selected file is empty.");
      return;
    }
    const maxKb = isZip ? DISPLAY_MAX_UPLOAD_KB : 2048;
    if (file.size > maxKb * 1024) {
      setClientError(`File exceeds the maximum allowed size of ${Math.floor(maxKb / 1024)} MB.`);
      return;
    }

    setSelectedFile(file);
    setUiState("file_selected");
  }, [language]);

  const handleRemoveFile = useCallback(() => {
    runToken.current += 1;
    setSelectedFile(null);
    setUiState("idle");
    setVisibleStages([]);
    setRecord(null);
    setClientError(null);
    setTopLevelError(null);
  }, []);

  const handleBuild = useCallback(async () => {
    if (!selectedFile || isBusy) return;

    setTopLevelError(null);
    setClientError(null);
    setRecord(null);
    setVisibleStages([]);
    setUiState("uploading");

    const currentRun = (runToken.current += 1);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("language", language);
    formData.append("standard", standard);
    if (activeProjectId) {
      formData.append("projectId", activeProjectId);
    }

    let res: Response;
    try {
      res = await fetch("/api/build", {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      if (currentRun !== runToken.current) return;
      const message = err instanceof Error ? err.message : "Network error. Please verify the server is running.";
      setTopLevelError(message);
      setUiState("internal_error");
      return;
    }

    let payload: BuildRecord | ApiError;
    try {
      payload = await res.json();
    } catch {
      if (currentRun !== runToken.current) return;
      setTopLevelError(`Server returned status ${res.status} with non-JSON body.`);
      setUiState("internal_error");
      return;
    }

    if (currentRun !== runToken.current) return;

    if (!res.ok || "error" in payload) {
      const err = "error" in payload ? payload.error : { code: "http_error", message: `Request failed with status ${res.status}.` };
      setTopLevelError(err.message);
      setUiState(err.code === "security_rejected" ? "security_rejected" : "internal_error");
      return;
    }

    const initialRecord = payload as BuildRecord;
    setRecord(initialRecord);
    setUiState(initialRecord.status as UiState);
    setVisibleStages(initialRecord.stages ?? []);

    const buildId = initialRecord.buildId;

    // Terminal statuses that end the build lifecycle
    const terminalStatuses = new Set([
      "success",
      "compile_error",
      "security_rejected",
      "timeout",
      "cancelled",
      "internal_error",
    ]);

    if (terminalStatuses.has(initialRecord.status)) {
      setRefreshHistoryTrigger((prev) => prev + 1);
      return;
    }

    // Polling loop for asynchronous status updates
    const startTime = Date.now();
    const maxPollTimeMs = 120_000; // 2 minutes max polling
    const pollIntervalMs = 1000; // Poll every 1 second

    while (Date.now() - startTime < maxPollTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      if (currentRun !== runToken.current) return;

      let pollRes: Response;
      try {
        pollRes = await fetch(`/api/build/${buildId}`);
      } catch {
        continue;
      }

      if (!pollRes.ok) continue;

      let latestRecord: BuildRecord;
      try {
        latestRecord = await pollRes.json();
      } catch {
        continue;
      }

      if (currentRun !== runToken.current) return;

      setRecord(latestRecord);
      setVisibleStages(latestRecord.stages ?? []);
      const mappedUiState =
        latestRecord.status === "compiling"
          ? "building"
          : (latestRecord.status as UiState);
      setUiState(mappedUiState);

      if (terminalStatuses.has(latestRecord.status)) {
        setRefreshHistoryTrigger((prev) => prev + 1);
        break;
      }
    }
  }, [selectedFile, isBusy, language, standard, activeProjectId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.12),rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-slate-950">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.261.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.261.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866ZM12 16.5c-2.485 0-4.5-1.567-4.5-3.5h9c0 1.933-2.015 3.5-4.5 3.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">CodeForge</h1>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  v0.5.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Multi-User Cloud Code Compilation &amp; Sandbox Pipeline</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-medium text-slate-200">{user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md hover:from-emerald-400 hover:to-teal-400 transition-all"
              >
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </header>

        {/* Main 2-Column Grid */}
        <main className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Projects, API Keys, Compiler Config & Upload */}
          <section className="flex flex-col gap-6 lg:col-span-7">
            {user && (
              <>
                <ProjectsManager
                  activeProjectId={activeProjectId}
                  onSelectProject={setActiveProjectId}
                />
                <ApiKeysManager />
              </>
            )}

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                1. Compiler Target &amp; Standards
              </h2>

              {/* Language Selection */}
              <div className="mt-4">
                <label htmlFor="language-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Language
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleLanguageChange(lang)}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                        language === lang
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm"
                          : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <span>{LANGUAGE_LABELS[lang]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Standard / Toolchain Selection */}
              <div className="mt-4">
                <label htmlFor="standard-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                  {LANGUAGE_LABELS[language]} {language === "rust" ? "Toolchain" : "Language Standard"}
                </label>
                <select
                  id="standard-select"
                  value={standard}
                  disabled={isBusy}
                  onChange={(e) => setStandard(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs font-medium text-slate-200 outline-none transition-colors hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {standards.map((s) => (
                    <option key={s} value={s}>
                      {standardLabels[s] ?? s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Dropzone */}
              <div className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  2. Source Upload ({language === "rust" ? ".rs" : language === "c" ? ".c" : ".cpp"}, or .zip)
                </h2>
                <FileDropzone
                  language={language}
                  selectedFile={selectedFile}
                  disabled={isBusy}
                  onFileSelected={handleFileSelected}
                  onRemoveFile={handleRemoveFile}
                  clientError={clientError}
                />
              </div>

              {/* Compile Action Button */}
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={!selectedFile || isBusy}
                  onClick={handleBuild}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:from-emerald-500 disabled:hover:to-teal-500"
                >
                  {isBusy ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>COMPILING IN DOCKER SANDBOX...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
                      </svg>
                      <span>BUILD WINDOWS EXECUTABLE (.EXE)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Security Guarantee Card */}
            <SecurityCard />
          </section>

          {/* Right Column: Real-time Build Console & Results */}
          <section className="flex flex-col gap-6 lg:col-span-5">
            <BuildConsole
              uiState={uiState}
              visibleStages={visibleStages}
              stdout={record?.stdout ?? null}
              stderr={record?.stderr ?? null}
              errorMessage={topLevelError || record?.errorMessage || null}
            />

            {record && record.status === "success" && <BuildResultCard record={record} />}

            <RecentBuilds refreshTrigger={refreshHistoryTrigger} />
          </section>
        </main>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          setRefreshHistoryTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
}
