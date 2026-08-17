"use client";

import { useEffect, useState } from "react";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  displayKey: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.apiKeys || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch("/api/api-keys")
      .then((res) => (res.ok ? res.json() : { apiKeys: [] }))
      .then((data) => {
        if (!ignore) {
          setKeys(data.apiKeys || []);
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
    if (!keyName.trim()) return;
    setError(null);

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create API key.");
        return;
      }

      setNewlyCreatedKey(data.apiKey.rawKey);
      setKeyName("");
      setIsCreating(false);
      await fetchKeys();
    } catch {
      setError("Network error creating API key.");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? Any CLI or external scripts using it will stop working immediately.")) return;

    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchKeys();
      }
    } catch {
      // Ignore
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            API Keys &amp; Programmatic Access
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Use with the CodeForge CLI or Versioned REST API</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsCreating(!isCreating);
            setNewlyCreatedKey(null);
          }}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
        >
          {isCreating ? "Cancel" : "+ Generate Key"}
        </button>
      </div>

      {newlyCreatedKey && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>API Key Generated — Copy it now!</span>
          </div>
          <p className="text-[11px] text-slate-300 mb-2">
            This key will <strong className="text-white">never be shown again</strong>. Store it securely in your password manager or CLI config.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={newlyCreatedKey}
              className="flex-1 font-mono text-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-emerald-300 selection:bg-emerald-500 selection:text-slate-950 select-all"
            />
            <button
              type="button"
              onClick={() => handleCopy(newlyCreatedKey)}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Create New API Key</h3>
          {error && <div className="mb-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-300">{error}</div>}
          <div className="flex flex-col gap-2">
            <div>
              <label htmlFor="key-name-input" className="block text-xs font-medium text-slate-400 mb-1">Key Description / Name</label>
              <input
                id="key-name-input"
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. CI/CD GitHub Action or Laptop CLI"
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <button
              type="submit"
              className="mt-2 rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors"
            >
              Create API Key
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {loading ? (
          <div className="py-4 text-center text-xs text-slate-500">Loading API keys...</div>
        ) : keys.length === 0 ? (
          <div className="py-3 text-center text-xs text-slate-500">No API keys created yet. Generate one to use the CLI.</div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200">{k.name}</span>
                  {k.revokedAt ? (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                      Revoked
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-slate-400 mt-0.5">{k.displayKey}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt && ` • Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                </div>
              </div>
              {!k.revokedAt && (
                <button
                  type="button"
                  onClick={() => handleRevoke(k.id)}
                  className="rounded border border-slate-800 px-2 py-1 text-[11px] text-slate-400 hover:border-rose-500/40 hover:text-rose-400 transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
