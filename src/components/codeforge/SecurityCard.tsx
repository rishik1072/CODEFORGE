"use client";

export function SecurityCard() {
  const securityFeatures = [
    { label: "Docker isolated", desc: "Linux container sandbox" },
    { label: "Network disabled", desc: "--network none" },
    { label: "Resource limits", desc: "1 CPU, ~1.5 GB memory, 64 PIDs" },
    { label: "Read-only root fs", desc: "Write restricted to temporary /work" },
    { label: "Dropped capabilities", desc: "--cap-drop ALL, no-new-privileges" },
    { label: "Non-root compiler", desc: "Unprivileged UID 1000:1000" },
    { label: "Controlled standard", desc: "Whitelisted standards only (no arbitrary argv)" },
    { label: "Ephemeral workspace", desc: "Auto-cleaned after 30-min retention TTL" },
  ];

  return (
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            SECURE BUILD ENVIRONMENT
          </h3>
        </div>
        <span className="text-[11px] text-emerald-400/80 font-mono">ISOLATION ACTIVE</span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {securityFeatures.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 rounded-lg bg-slate-900/40 p-2.5 border border-slate-800/60">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-slate-200">{item.label}</p>
              <p className="text-[11px] text-slate-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        CodeForge compiles source code inside isolated sandboxes and never executes untrusted binaries on the host system.
      </p>
    </div>
  );
}
