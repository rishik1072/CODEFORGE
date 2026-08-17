"use client";

import { useState } from "react";
import type { UserAccount } from "./types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserAccount) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isSignup ? "signup" : "login",
          email,
          password,
          name: isSignup ? name : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Authentication failed.");
        return;
      }

      onSuccess(data.user);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-bold text-slate-100">
            {isSignup ? "Create CodeForge Account" : "Sign In to CodeForge"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3.5">
          {isSignup && (
            <div>
              <label htmlFor="auth-name-input" className="block text-xs font-medium text-slate-400 mb-1">Full Name (Optional)</label>
              <input
                id="auth-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email-input" className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
            <input
              id="auth-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@example.com"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="auth-password-input" className="block text-xs font-medium text-slate-400 mb-1">Password</label>
            <input
              id="auth-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          {isSignup && (
            <div>
              <label htmlFor="auth-confirm-password-input" className="block text-xs font-medium text-slate-400 mb-1">Confirm Password</label>
              <input
                id="auth-confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-bold text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignup ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 border-t border-slate-800/80 pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError(null);
            }}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {isSignup
              ? "Already have an account? Sign in"
              : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
