CodeForge ⚡
Version License: MIT Tests: 80 Passed Docker: Hardened

CodeForge is a secure, cloud-native code compilation platform that transforms untrusted C, C++, and Rust source code and multi-file project archives into native Windows Portable Executables (.exe) inside isolated, air-gapped Docker sandboxes.

Designed with a defense-in-depth security model, CodeForge decouples HTTP request lifecycles from compilation execution using an atomic PostgreSQL job queue, dedicated worker pools, and strictly enforced Linux kernel isolation parameters.

🚀 Key Features
Multi-Language Cross-Compilation:
C: C11, C17, C23 (gcc-mingw-w64).
C++: C++11, C++14, C++17, C++20, C++23 (g++-mingw-w64).
Rust: 2018, 2021, 2024 Editions (rustc --target x86_64-pc-windows-gnu).
Single source files (.c, .cpp, .rs) and multi-file .zip projects.
Air-Gapped Sandbox Security:
Complete network isolation (--network none) — zero outbound or inbound traffic.
Read-only root filesystem (--read-only) with bounded tmpfs scratch spaces (/tmp:size=64m).
Process limits (--pids-limit 64) and memory caps (1.5 GB) to prevent fork bombs and heap exhaustion.
Dropped Linux capabilities (--cap-drop ALL, --security-opt no-new-privileges) and non-root execution (UID 1000:1000).
Archive & Payload Hardening:
Streaming ZIP decompression protecting against Zip Slip path traversal (../), absolute paths, and compression bombs.
Mandatory PE/MZ binary header validation and SHA-256 integrity checksum verification.
ANSI and OSC terminal escape sequence scrubbing for compiler diagnostic logs.
Transactional Job Queue:
PostgreSQL queue using SELECT ... FOR UPDATE SKIP LOCKED for atomic, race-free job claiming.
Graceful worker shutdown, automatic stale job recovery, and build cancellation.
Multi-Tenant User Platform:
Secure scrypt password hashing with unique 16-byte random salts.
Database-backed sessions with HttpOnly, SameSite=Lax cookies.
Workspaces/Projects dashboard with build history and per-user artifact access authorization.
Developer Tools & Integrations:
Versioned REST API (/api/v1/): Complete OpenAPI 3.0.3 specification with discrete API scopes.
Official CLI (@codeforge/cli): Terminal tool to compile, poll, and download binaries.
Public GitHub Import: Compile public repositories directly (POST /api/v1/github/build).
🏗️ Architecture Topology
                              INTERNET
                                 │
                                 ▼
                          Reverse Proxy
                                 │ (HTTPS / TLS 443)
                                 ▼
                     ┌───────────────────────┐
                     │   Next.js API & UI    │
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
PostgreSQL Database                              Build Queue Table
(Users, Sessions, Projects)                              │
                                               ┌─────────┴─────────┐
                                               ▼                   ▼
                                        Build Worker 1      Build Worker 2
                                               │                   │
                                               ▼                   ▼
                                       Docker Sandbox      Docker Sandbox
                                       (C / C++ / Rust)    (C / C++ / Rust)
📦 Quick Start
Prerequisites
Node.js: v20+
Docker Desktop or Docker Engine
PostgreSQL 16+ (or run via Docker Compose)
1. Installation & Database Setup
git clone https://github.com/your-username/codeforge.git
cd codeforge

# Install dependencies
npm install

# Push database schema (users, sessions, projects, builds, api_keys)
npx drizzle-kit push
2. Running Locally
Terminal 1 — Next.js Application Dashboard:

npm run dev
Open http://localhost:3000 in your browser.

Terminal 2 — Standalone Build Worker (Optional in dev, required in production):

npm run worker
💻 CodeForge CLI Usage
CodeForge includes a standalone terminal client located in packages/codeforge-cli:

# Link the CLI globally
cd packages/codeforge-cli
npm link

# 1. Login with your CodeForge API Key
codeforge login cf_live_your_api_key_here

# 2. Compile a single C++ source file and wait for the result
codeforge build hello.cpp --language cpp --standard c++20 --wait

# 3. Download the generated Windows executable (.exe)
codeforge download <BUILD_ID> --output my_program.exe

# 4. Compile a multi-file Rust project archive
codeforge build project.zip --language rust --standard 2021 --wait
🔌 Public REST API
All public endpoints are versioned under /api/v1/ and authenticate via Bearer tokens:

Authorization: Bearer cf_live_...
Method	Endpoint	Scope	Description
GET	/api/v1/health	Public	Service liveness check
POST	/api/v1/builds	build:create	Enqueue a source file or ZIP build (HTTP 202)
GET	/api/v1/builds/:id	build:read	Inspect build status, stages, and duration
GET	/api/v1/builds/:id/artifact	build:read	Download verified Windows .exe binary
POST	/api/v1/builds/:id/cancel	build:cancel	Cancel an active or queued compilation job
POST	/api/v1/github/build	build:create	Import and build a public GitHub repository
GET	/api/v1/projects	project:read	List user workspace projects
POST	/api/v1/projects	project:write	Create a new user workspace project
📖 Full API Spec: See docs/api.md and docs/openapi.yaml.

🔒 Security Model & Defense-in-Depth
Threat	Control & Mitigation	Verification
Malicious Code Execution	Transient Docker sandbox with --network none, --read-only, and non-root UID 1000.	tests/unit/security.test.ts
Path Traversal (Zip Slip)	Streaming unzip path normalization and prefix guards.	tests/unit/unzip.test.ts
Zip Bombs & DoS	Enforced limits on uncompressed byte size (25MB) and file counts (100).	tests/unit/unzip.test.ts
Fork Bombs & Resource Exhaustion	Strict Docker process limits (--pids-limit 64), memory caps (1.5GB), and wall-clock timeouts (20s).	tests/unit/security.test.ts
Terminal Control Injection	Sanitization regexes strip ANSI, OSC, and control byte sequences.	tests/unit/sanitize.test.ts
Unauthorized Artifact Access	Database-level per-user authorization checks on all download streams.	tests/unit/auth.test.ts
🛡️ Full Threat Analysis: See docs/security-evaluation.md and docs/security.md.

📊 Benchmarks
Language	Standard	Project Type	Files	Avg Time	Artifact Size
C	C17	Single File (hello.c)	1	415 ms	~128 KB
C	C17	Multi-file (math.zip)	3	532 ms	~134 KB
C++	C++20	Single File (hello.cpp)	1	734 ms	~142 KB
C++	C++20	Multi-file (engine.zip)	4	955 ms	~158 KB
Rust	2021	Single File (hello.rs)	1	1,325 ms	~186 KB
Rust	2021	Multi-file (calc.zip)	3	1,560 ms	~198 KB
📈 Full Benchmark Suite: See docs/benchmark.md.

🧪 Testing & Verification
CodeForge includes a 80-test automated suite:

# Run unit & integration test suite
npx vitest run

# Run ESLint check
npm run lint

# Run Next.js production build
npm run build
📁 Repository Structure
.
├── src/
│   ├── app/                         # Next.js App Router (Dashboard & API routes)
│   │   ├── api/v1/                  # Versioned Public REST API (builds, projects, github)
│   │   └── api/auth/                # Authentication & session endpoints
│   ├── components/codeforge/        # React UI Dashboard components
│   ├── db/                          # PostgreSQL Drizzle schema & database pool
│   ├── lib/codeforge/               # Core compilation, sandboxing, and queue logic
│   │   ├── compilers/               # CompilerRegistry (C, C++, Rust drivers)
│   │   ├── sandbox/                 # Docker container runner with security flags
│   │   ├── queue.ts                 # PostgreSQL transactional queue & claiming
│   │   ├── worker.ts                # Background worker lifecycle & concurrency
│   │   └── unzip.ts                 # Hardened streaming ZIP extraction engine
│   └── worker.ts                    # Standalone background worker process
├── packages/
│   └── codeforge-cli/               # Official Node.js CLI tool
├── docs/                            # Architecture, API, Security, and Runbook specs
├── tests/                           # Vitest unit and integration test suites
├── Dockerfile                       # Multi-stage production container
└── docker-compose.yml               # Production deployment topology
📄 License
This project is licensed under the MIT License.
