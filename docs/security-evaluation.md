# CodeForge Security Evaluation & Threat Model

## 1. Threat Model & Defense-in-Depth Architecture

CodeForge accepts and compiles **completely untrusted source code and ZIP archives** submitted by anonymous or authenticated users. The platform treats every input as potentially hostile.

```
Untrusted Input (Source / ZIP / GitHub Repo)
                 │
                 ▼
[ Layer 1: Boundary Validation ] ─────────> Reject if illegal filename, size, or magic header
                 │
                 ▼
[ Layer 2: Safe Archive Extraction ] ────> Reject if directory traversal, symlink, or zip bomb
                 │
                 ▼
[ Layer 3: Project Structure Discovery ] ─> Enforce exactly 1 entrypoint (main / fn main)
                 │
                 ▼
[ Layer 4: Hardened Docker Sandbox ] ────> --network none, --read-only, --tmpfs /tmp, --user 1000:1000
                 │
                 ▼
[ Layer 5: Output Scrubbing & PE Check ] ─> Strip ANSI/OSC escapes, verify PE/MZ signature, SHA-256
                 │
                 ▼
[ Layer 6: Per-User Authorization ] ─────> Private download tokens, owner-only authorization
```

---

## 2. Security Test Matrix

| Threat Category | Specific Attack Vector | Mitigation Control | Automated Test Suite | Residual Risk Level |
|---|---|---|---|---|
| **Archive Exploitation** | Path Traversal (`../../etc/passwd`) | Strict path normalization and prefix verification in streaming unzipper | `tests/unit/unzip.test.ts` | **Negligible** |
| **Archive Exploitation** | ZIP Bomb (Compression ratio attack) | Bounded byte counter during decompression (max 25 MB) | `tests/unit/unzip.test.ts` | **Negligible** |
| **Sandbox Escape** | Network Exfiltration / Botnets | Docker `--network none` flag enforced unconditionally | `tests/unit/security.test.ts` | **Negligible** (Kernel isolation) |
| **Sandbox Abuse** | Fork Bomb / Process Spawning | Docker `--pids-limit 64` and `ulimit -u` | `tests/unit/security.test.ts` | **Low** |
| **Sandbox Abuse** | Memory / Heap Exhaustion | Docker `--memory 1536m` and `--tmpfs /tmp:size=64m` | `tests/unit/security.test.ts` | **Low** |
| **Sandbox Abuse** | Infinite Loop / CPU Hogging | Hard wall-clock timeout (20s) and SIGKILL enforcement | `tests/unit/security.test.ts` | **Low** |
| **Privilege Escalation** | Root filesystem tampering | Read-only rootfs (`--read-only`), `--cap-drop ALL`, `--security-opt no-new-privileges`, UID `1000:1000` | `tests/unit/security.test.ts` | **Low** (Container breakout kernel CVE) |
| **Diagnostic Injection** | Terminal Control Escapes (ANSI/OSC) | Regex-based ANSI, OSC, and control byte stripping | `tests/unit/sanitize.test.ts` | **Negligible** |
| **Binary Tampering** | Non-executable artifact generation | Mandatory MZ/PE header verification prior to saving | `tests/unit/validation.test.ts` | **Negligible** |
| **Auth Bypass** | Cross-tenant artifact downloading | Server-side user ownership verification (`build.userId === auth.user.id`) | `tests/unit/auth.test.ts` | **Negligible** |
| **SSRF** | GitHub internal IP import | Alphanumeric owner/repo regex and direct GitHub codeload domain restriction | `tests/unit/api-keys.test.ts` | **Low** |

---

## 3. Residual Risks & Security Honesty

- **Kernel Vulnerabilities**: Container isolation relies on the underlying Linux/WSL2 kernel. A zero-day Linux kernel privilege escalation could hypothetically break container containment.
- **Side-Channel Attacks**: CPU cache timing attacks (e.g. Spectre-like side channels) across shared multi-tenant hosts are mitigated at the hardware level by modern cloud hypervisors.
