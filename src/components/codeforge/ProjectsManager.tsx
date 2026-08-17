"use client";

import { useEffect, useState } from "react";
import type { ProjectItem } from "./types";

interface ProjectsManagerProps {
  activeProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}

export function ProjectsManager({ activeProjectId, onSelectProject }: ProjectsManagerProps) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("cpp");
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : { projects: [] }))
      .then((data) => {
        if (!ignore) {
          setProjects(data.projects || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, defaultLanguage }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create project.");
        return;
      }
      setName("");
      setDescription("");
      setIsCreating(false);
      await fetchProjects();
      onSelectProject(data.project.id);
    } catch {
      setError("Network error creating project.");
    }
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project and all its builds?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        if (activeProjectId === projectId) onSelectProject(null);
        await fetchProjects();
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Workspace Projects
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Organize and track persistent build history</p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
        >
          {isCreating ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Create Project</h3>
          {error && <div className="mb-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-300">{error}</div>}
          <div className="flex flex-col gap-2.5">
            <div>
              <label htmlFor="project-name-input" className="block text-xs font-medium text-slate-400 mb-1">Project Name</label>
              <input
                id="project-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Flight Simulator Engine"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label htmlFor="project-desc-input" className="block text-xs font-medium text-slate-400 mb-1">Description (Optional)</label>
              <input
                id="project-desc-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="C++ simulation core with portable PE output"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="project-lang-select" className="block text-xs font-medium text-slate-400 mb-1">Default Language</label>
              <select
                id="project-lang-select"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="rust">Rust</option>
              </select>
            </div>
            <button
              type="submit"
              className="mt-1 rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Save Project
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
            activeProjectId === null
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm"
              : "border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <div>
            <div className="text-xs font-bold">Standalone Sandbox (No Project)</div>
            <div className="text-[11px] text-slate-500">Ad-hoc single-file and ZIP builds</div>
          </div>
        </button>

        {loading ? (
          <div className="py-4 text-center text-xs text-slate-500">Loading projects...</div>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className={`group flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                activeProjectId === p.id
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm"
                  : "border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">{p.name}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 uppercase">
                    {p.defaultLanguage}
                  </span>
                </div>
                {p.description && <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</div>}
                <div className="text-[10px] text-slate-500 mt-1">
                  {p.buildCount} {p.buildCount === 1 ? "build" : "builds"}
                  {p.lastBuildAt && ` • Last build: ${new Date(p.lastBuildAt).toLocaleDateString()}`}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => handleDelete(p.id, e)}
                title="Delete project"
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
