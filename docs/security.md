# CodeForge Security Model & Threat Model

CodeForge compiles **untrusted, user-supplied C, C++, and Rust source code**. This document describes the assumptions, defense-in-depth controls, and residual risks of the current implementation.

> **Important Security Boundary Note:** While Docker and Linux kernel cgroups/namespaces provide strong isolation boundaries, container isolation is not mathematically guaranteed against zero-day Linux kernel vulnerabilities or hardware-level speculative execution attacks. CodeForge implements multi-layered defense-in-depth controls to minimize attack surfaces.

---

## 1. Threat Model & Untrusted Inputs

Assume an adversary can submit:
- Malicious C, C++, or Rust source code attempting host compromise or exfiltration.
- Hostile preprocessor macros, infinite include loops, and recursion designed to exhaust host resources.
- Fork bombs, thread floods, and uncontrolled process spawning.
- Pathological compiler inputs designed to trigger memory corruption or segfaults in GCC/Clang/Rustc.
- Path traversal archives (`../`), absolute paths, Windows drive paths (`C:\`), and symbolic link escapes.
- Zip bombs and nested compression attacks attempting disk exhaustion.
- Network connection and port scanning attempts targeting localhost, host networking, or external IPs.
- Probes seeking host secrets, `DATABASE_URL`, cloud credentials, or Docker socket (`/var/run/docker.sock`).

---

## 2. Multi-Layer Defense-in-Depth Architecture

```
[Untrusted Client Request]
          │
          ▼
1. Validation & Scrubbing Layer
   ├── Strict Filename / Standard Allowlisting
   ├── Content-Type & Binary File Size Capping
   └── Zip-Bomb / Path-Traversal Streaming Guard
          │
          ▼
2. Asynchronous PostgreSQL Queue
   ├── Immutable Job Records in PostgreSQL
   └── Atomic Claiming (SELECT FOR UPDATE SKIP LOCKED)
          │
          ▼
3. Worker Process & Environment Isolation
   ├── Strict Clean Environment (Zero Host Secret Leakage)
   └── Per-Build Isolated Workspace (0700 permissions)
          │
          ▼
4. Docker Sandbox Isolation
   ├── --network none (Zero Network Access)
   ├── --read-only (Read-Only Root Filesystem)
   ├── --tmpfs /tmp:size=64m (Capped In-Memory Temp)
   ├── --memory 1536m (Hard Memory Capping)
   ├── --cpus 1 (Single CPU Core Limit)
   ├── --pids-limit 64 (Fork-Bomb Protection)
   ├── --cap-drop ALL (Zero Linux Capabilities)
   ├── --security-opt no-new-privileges (SetUID Disabled)
   └── --user 1000:1000 (Non-Root Unprivileged User)
          │
          ▼
5. Artifact & Output Verification
   ├── PE/MZ Binary Signature Verification
   ├── lstat Check (Refuses Symlinks and Directories)
   ├── SHA-256 Checksum Calculation
   ├── ANSI / OSC Terminal Escape Sequence Scrubbing
   └── Safe Workspace Retention Sweep (Automatic Deletion)
```

---

## 3. Sandboxing Controls Detail

### 3.1 Network Isolation
Containers run with `--network none`. No network namespaces, socket creation, DNS resolution, or external/localhost egress are possible from within compilation containers.

### 3.2 Filesystem & Socket Isolation
- Only the specific build's workspace directory (`codeforge-data/workspaces/<build-id>`) is mounted to `/work:rw`.
- Root filesystem is mounted read-only (`--read-only`).
- The Docker socket (`/var/run/docker.sock`) is **never mounted**.
- Host directories (`/`, `C:\`, `/home`, `.git`, `.env`) are **never mounted**.

### 3.3 Resource Limit Enforcement
- Memory: Capped at 1536 MB (`--memory 1536m`).
- CPU: Capped at 1 core (`--cpus 1`) and 15 seconds CPU time.
- Wall-Clock Timeout: 20 seconds hard termination via container kill.
- Processes / Threads: Capped at 64 PIDs (`--pids-limit 64`).

### 3.4 Archive Decompression Rules
- Path Traversal: Rejects `..`, `\`, absolute paths, and Windows drive letters.
- Depth Limit: Maximum 5 nested directory levels.
- File Count Limit: Maximum 100 files per archive.
- Total Extracted Size: Maximum 25 MB.
- Symlinks & Hardlinks: Disallowed and rejected.

### 3.5 Compiler Argument Injection Guard
- No shell interpolation is used (`exec` / `spawn` with direct argument arrays).
- No user-controlled flags are accepted.
- Filenames and language standards must match strict regex patterns.

---

## 4. Known Limitations & Residual Risks

1. **Standard Library Only**: External package manager downloads (Cargo crates, vcpkg, Conan) are disabled to preserve total network isolation.
2. **Host Kernel Shared Boundary**: Containers share the Linux kernel (or WSL2 VM kernel on Windows). Kernel-level vulnerabilities could theoretically weaken container boundaries, which is why non-root users, capability dropping, and `no-new-privileges` are enforced.
