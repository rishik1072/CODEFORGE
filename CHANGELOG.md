# Changelog

All notable changes to **CodeForge** are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-08-16

### Added
- **Multi-Language Cross-Compilation**:
  - C (`gcc-mingw-w64`) with C11, C17, and C23 standards.
  - C++ (`g++-mingw-w64`) with C++11, C++14, C++17, C++20, and C++23 standards.
  - Rust (`rustc --target x86_64-pc-windows-gnu`) with stable 2018, 2021, and 2024 editions.
  - Native Windows Portable Executable (`.exe`) binary generation.
- **Transactional Build Queue & Distributed Workers**:
  - PostgreSQL-backed transactional queue using `SELECT ... FOR UPDATE SKIP LOCKED` for atomic job claiming.
  - Bounded concurrency controls (`CODEFORGE_WORKER_CONCURRENCY`).
  - Stale worker detection and automatic job requeueing.
  - Graceful shutdown (`SIGTERM`/`SIGINT`) with in-flight compilation draining.
- **Hardened Docker Compiler Sandbox**:
  - Complete network isolation (`--network none`).
  - Read-only container root (`--read-only`) and bounded memory `/tmp` tmpfs (`--tmpfs /tmp:size=64m`).
  - Strict resource caps: CPU cores, wall-clock timeout (20s), memory (1.5GB), and process limits (`--pids-limit 64`).
  - Dropped Linux capabilities (`--cap-drop ALL`, `--security-opt no-new-privileges`) and non-root execution (`1000:1000`).
- **Archive & File Security**:
  - Streaming ZIP validation preventing path traversals (`../`), absolute paths, and Windows drive prefixes.
  - ZIP bomb guards enforcing uncompressed size and directory depth limits.
  - Automatic entry-point discovery (`main()` / `fn main()`).
  - Binary PE/MZ header verification and SHA-256 integrity checksums.
  - ANSI/OSC escape sequence scrubbing for all compiler diagnostic logs.
- **Multi-Tenant User Platform**:
  - User registration and authentication using scrypt password hashing.
  - Persistent database sessions with secure `HttpOnly`, `SameSite=Lax` cookies.
  - User workspaces/projects and build history tracking.
  - Strict per-user authorization boundaries for builds and artifact downloads.
- **Public Versioned REST API & CLI**:
  - OpenAPI 3.0.3 specification (`/docs/openapi.yaml`).
  - Versioned API (`/api/v1/`) with discrete API scopes (`build:create`, `build:read`, etc.).
  - SHA-256 hashed API keys (`cf_live_...`) with constant-time verification.
  - Rate limiting and idempotency key support (`Idempotency-Key`).
  - Official CodeForge CLI (`@codeforge/cli`) for terminal builds and downloads.
  - Public GitHub repository archive import and sandboxed compilation (`POST /api/v1/github/build`).
- **Production Reliability & Observability**:
  - Minimal health (`/api/v1/health`) and internal readiness (`/api/health/ready`) endpoints.
  - Real-time build duration and status distribution metrics.
  - Production security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy).
  - Configurable artifact lifecycle TTL and automated disk sweepers.
