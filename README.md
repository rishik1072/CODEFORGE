Absolutely 👍 I cleaned up the Git merge-conflict markers, removed the duplicated sections, fixed the formatting, and combined the strongest parts into **one clean GitHub-ready `README.md`**. The content is based on your uploaded CodeForge README. 

**Copy everything below directly into `README.md`:**

````markdown
# ⚡ CodeForge

<p align="center">
  <strong>Secure, High-Performance Multi-User Cloud Compilation & Build Platform</strong><br>
  Compile C, C++, and Rust into standalone Windows Portable Executables (.exe)
  inside hardened, zero-network sandboxes.
</p>

<p align="center">
  <a href="#-key-features">
    <img src="https://img.shields.io/badge/Languages-C%20%7C%20C%2B%2B%20%7C%20Rust-blue?style=flat-square" alt="Languages">
  </a>
  <a href="#-security-model">
    <img src="https://img.shields.io/badge/Isolation-Docker%20%7C%20Linux%20Namespaces-emerald?style=flat-square" alt="Isolation">
  </a>
  <a href="#-queue-system">
    <img src="https://img.shields.io/badge/Queue-PostgreSQL%20SKIP%20LOCKED-blueviolet?style=flat-square" alt="Queue">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-amber?style=flat-square" alt="License">
  </a>
</p>

---

## 🌟 Overview

**CodeForge** is a secure, cloud-native compilation platform and developer workbench that transforms untrusted **C, C++, and Rust** source code into native Windows Portable Executables (`.exe`).

It supports:

- Single source files
- Multi-file ZIP projects
- Public GitHub repositories
- Asynchronous compilation
- Real-time build status
- REST API access
- CLI-based compilation workflows
- Multi-user project workspaces

Every compilation runs inside an **ephemeral, hardened Docker sandbox** with network isolation, filesystem restrictions, resource quotas, dropped Linux capabilities, and non-root execution.

CodeForge is designed around **defense-in-depth security**, reliable asynchronous job processing, and developer-friendly tooling.

---

# ✨ Key Features

## 🧑‍💻 Multi-Language Cross-Compilation

### C

- C11
- C17
- C23
- Compiler: `gcc-mingw-w64`

### C++

- C++11
- C++14
- C++17
- C++20
- C++23
- Compiler: `g++-mingw-w64`

### Rust

- Rust 2018 Edition
- Rust 2021 Edition
- Rust 2024 Edition
- Target: `x86_64-pc-windows-gnu`

### Project Input

CodeForge accepts:

- `.c`
- `.cpp`
- `.rs`
- Multi-file `.zip` projects
- Public GitHub repositories

---

# 🔐 Security & Sandboxing

Security is one of the core design principles of CodeForge.

Untrusted source code is never executed directly on the host system.

Each build runs inside an isolated, short-lived Docker sandbox.

### Defense-in-Depth Controls

| Security Control | Implementation | Purpose |
|---|---|---|
| Network Isolation | `--network none` | Prevents outbound/inbound network communication |
| Filesystem | `--read-only` | Prevents persistent filesystem modifications |
| Temporary Storage | Isolated `tmpfs` | Provides bounded scratch space |
| Privileges | `--cap-drop ALL` | Removes Linux capabilities |
| Privilege Escalation | `--security-opt no-new-privileges` | Prevents privilege escalation |
| User | UID `1000:1000` | Prevents root execution |
| Process Limit | `--pids-limit 64` | Prevents fork bombs |
| Memory Limit | 1.5 GB | Prevents excessive memory consumption |
| CPU Limit | Hard CPU quota | Prevents CPU exhaustion |
| Wall Timeout | 20 seconds | Stops runaway compilations |
| Artifact Validation | PE/MZ header check | Verifies Windows executable format |
| Integrity | SHA-256 | Verifies generated artifacts |

---

# 🛡️ Security Threat Mitigation

CodeForge includes protections against several classes of attacks.

| Threat | Protection |
|---|---|
| Malicious Code Execution | Ephemeral Docker sandbox |
| Network Exploitation | `--network none` |
| Host Filesystem Access | Read-only isolated filesystem |
| Privilege Escalation | Non-root + dropped capabilities |
| Fork Bombs | PID limits |
| Memory Exhaustion | Memory quotas |
| CPU Exhaustion | CPU limits |
| Infinite Compilation | Wall-clock timeout |
| Zip Slip | Path normalization and validation |
| Zip Bombs | File count and decompressed-size limits |
| Symlink Escapes | Secure extraction validation |
| Terminal Injection | ANSI / OSC sanitization |
| Unauthorized Artifact Access | Per-user authorization |
| Artifact Tampering | SHA-256 verification |

---

# 🏗️ Architecture

```text
                              INTERNET
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Reverse Proxy  │
                         │   HTTPS / TLS   │
                         └────────┬────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │     Next.js API & UI    │
                    │     Authentication      │
                    │     REST API v1         │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴────────────────┐
                 │                                │
                 ▼                                ▼
        ┌─────────────────┐              ┌─────────────────┐
        │   PostgreSQL    │              │   Build Queue   │
        │                 │              │                 │
        │ Users           │              │ Pending Jobs    │
        │ Sessions        │              │ Active Jobs     │
        │ Projects        │              │ Failed Jobs     │
        │ Builds          │              │ Completed Jobs  │
        │ API Keys        │              └────────┬────────┘
        └─────────────────┘                       │
                                                  │
                                    ┌─────────────┴─────────────┐
                                    │                           │
                                    ▼                           ▼
                           ┌────────────────┐          ┌────────────────┐
                           │ Build Worker 1 │          │ Build Worker 2 │
                           └───────┬────────┘          └───────┬────────┘
                                   │                           │
                                   ▼                           ▼
                           ┌────────────────┐          ┌────────────────┐
                           │ Docker Sandbox │          │ Docker Sandbox │
                           │ C / C++ / Rust │          │ C / C++ / Rust │
                           └───────┬────────┘          └───────┬────────┘
                                   │                           │
                                   └─────────────┬─────────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────┐
                                      │ Verified .exe       │
                                      │ PE/MZ + SHA-256     │
                                      └─────────────────────┘
````

---

# ⚙️ Build Pipeline

A typical CodeForge build follows this flow:

```text
Client
   │
   │ POST /api/v1/builds
   ▼
Input Validation
   │
   ├── File Validation
   ├── Language Validation
   ├── ZIP Security Checks
   └── Payload Limits
   │
   ▼
PostgreSQL Job Queue
   │
   │ SELECT ... FOR UPDATE SKIP LOCKED
   ▼
Build Worker
   │
   ▼
Ephemeral Docker Sandbox
   │
   ├── Network Disabled
   ├── Read-only Filesystem
   ├── Non-root User
   ├── CPU Limit
   ├── Memory Limit
   └── PID Limit
   │
   ▼
Compiler
   │
   ├── MinGW-w64
   └── rustc
   │
   ▼
.exe Artifact
   │
   ├── PE/MZ Validation
   └── SHA-256 Verification
   │
   ▼
Artifact Storage
   │
   ▼
Client Download
```

---

# 📦 Project Archive Security

ZIP project uploads are processed using a hardened streaming extraction pipeline.

CodeForge protects against:

* `../` path traversal
* Absolute filesystem paths
* Windows path traversal such as `C:\`
* Zip Slip
* Symbolic-link escapes
* Compression bombs
* Excessive file counts
* Excessive decompressed size

The system can also automatically detect likely project entry points such as:

```text
main()
fn main()
```

---

# 🔄 Queue System

CodeForge uses **PostgreSQL as a transactional job queue**.

Jobs are claimed atomically using:

```sql
SELECT ...
FROM builds
WHERE status = 'queued'
FOR UPDATE SKIP LOCKED;
```

This provides:

* Race-free job claiming
* Multiple worker support
* Worker concurrency
* Stale worker detection
* Automatic job recovery
* Build cancellation
* Graceful shutdown
* Reliable asynchronous execution

Workers can safely operate concurrently without multiple workers processing the same build.

---

# 👥 Multi-Tenant Platform

CodeForge supports multiple users with isolated project and build access.

### Authentication

* `scrypt` password hashing
* Unique random salts
* Database-backed sessions
* HttpOnly cookies
* `SameSite=Lax`
* API key authentication

### User Workspaces

Each user can manage:

* Projects
* Build history
* Build logs
* API keys
* Generated artifacts

Artifact downloads are protected by per-user authorization checks.

---

# 🧰 Developer Tools

CodeForge provides both REST API and CLI interfaces.

## REST API

The public API is versioned under:

```text
/api/v1/
```

## CLI

The official CLI package is:

```text
@codeforge/cli
```

Developers can compile projects directly from the terminal.

---

# 🚀 Quick Start

## Option A — Docker Compose

Docker Compose is the recommended way to run the complete CodeForge stack.

### 1. Clone the repository

```bash
git clone https://github.com/your-username/codeforge.git
cd codeforge
```

### 2. Start the application

```bash
docker compose up --build
```

The web interface will be available at:

```text
http://localhost:3000
```

---

# 💻 Local Development

## Prerequisites

Make sure the following are installed:

* Node.js 20+
* PostgreSQL 15+
* Docker Desktop or Docker Engine
* MinGW-w64
* Rust toolchain (optional)

For Ubuntu / Debian / WSL2:

```bash
sudo apt-get update

sudo apt-get install -y \
  mingw-w64 \
  util-linux \
  coreutils
```

---

## 1. Clone Repository

```bash
git clone https://github.com/your-username/codeforge.git
cd codeforge
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment

Create your local environment file:

```bash
cp .env.example .env.local
```

Configure:

```env
DATABASE_URL=your_postgresql_connection_string
```

---

## 4. Push Database Schema

```bash
npx drizzle-kit push
```

---

## 5. Start the Web Application

Open Terminal 1:

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

---

## 6. Start the Compilation Worker

Open Terminal 2:

```bash
npm run worker
```

The worker is responsible for processing queued compilation jobs.

---

# 💻 CodeForge CLI

CodeForge includes a standalone CLI located at:

```text
packages/codeforge-cli
```

## Install / Link CLI

```bash
cd packages/codeforge-cli
npm link
```

---

## Authenticate

```bash
codeforge login cf_live_your_api_key_here
```

---

## Compile C++

```bash
codeforge build hello.cpp \
  --language cpp \
  --standard c++20 \
  --wait
```

---

## Compile Rust Project

```bash
codeforge build project.zip \
  --language rust \
  --standard 2021 \
  --wait
```

---

## Check Build Status

```bash
codeforge status <BUILD_ID>
```

---

## Download Executable

```bash
codeforge download <BUILD_ID> \
  --output my_program.exe
```

---

# 📡 REST API

Base URL:

```text
http://localhost:3000/api/v1
```

Protected endpoints use:

```http
Authorization: Bearer cf_live_...
```

---

## API Endpoints

| Method | Endpoint                      | Scope           | Description                     |
| ------ | ----------------------------- | --------------- | ------------------------------- |
| GET    | `/api/v1/health`              | Public          | Service health check            |
| POST   | `/api/v1/builds`              | `build:create`  | Create a compilation job        |
| GET    | `/api/v1/builds/:id`          | `build:read`    | Get build status                |
| GET    | `/api/v1/builds/:id/artifact` | `build:read`    | Download verified `.exe`        |
| POST   | `/api/v1/builds/:id/cancel`   | `build:cancel`  | Cancel compilation              |
| POST   | `/api/v1/github/build`        | `build:create`  | Import public GitHub repository |
| GET    | `/api/v1/projects`            | `project:read`  | List projects                   |
| POST   | `/api/v1/projects`            | `project:write` | Create project                  |

Full OpenAPI specification:

```text
docs/openapi.yaml
```

---

# 🔌 API Example

Create a compilation job using `curl`:

```bash
curl -X POST http://localhost:3000/api/v1/builds \
  -H "Authorization: Bearer cf_live_..." \
  -H "Idempotency-Key: my-unique-key-123" \
  -F "file=@hello.cpp" \
  -F "language=cpp" \
  -F "standard=c++20"
```

### Response

```json
{
  "buildId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued",
  "language": "cpp",
  "cppStandard": "c++20",
  "originalFilename": "hello.cpp",
  "createdAt": "2026-08-16T10:00:00.000Z",
  "stages": []
}
```

HTTP status:

```text
202 Accepted
```

---

# ⚙️ Environment Variables

| Variable                             |                Default | Description                            |
| ------------------------------------ | ---------------------: | -------------------------------------- |
| `DATABASE_URL`                       |               Required | PostgreSQL connection string           |
| `CODEFORGE_DATA_DIR`                 | `./data` / System Temp | Build workspace and artifact directory |
| `CODEFORGE_WORKER_CONCURRENCY`       |                    `2` | Parallel compilation jobs per worker   |
| `CODEFORGE_CPU_SECONDS`              |                   `15` | Maximum CPU execution time             |
| `CODEFORGE_WALL_TIMEOUT_MS`          |                `20000` | Maximum wall-clock time                |
| `CODEFORGE_MAX_VMEM_KB`              |              `1536000` | Maximum virtual memory                 |
| `CODEFORGE_MAX_UPLOAD_BYTES`         |              `2097152` | Maximum single-file upload             |
| `CODEFORGE_MAX_PROJECT_UPLOAD_BYTES` |             `10485760` | Maximum ZIP upload                     |
| `CODEFORGE_ARTIFACT_TTL_MS`          |              `1800000` | Artifact expiration time               |

---

# 🧪 Testing & Quality Assurance

CodeForge includes an automated test suite covering security, queue management, compilation, and authentication.

## Run Tests

```bash
npx vitest run
```

## Watch Mode

```bash
npx vitest
```

## Type Checking

```bash
npm run typecheck
```

## Linting

```bash
npm run lint
```

## Production Build

```bash
npm run build
```

---

# 🔍 Security Test Coverage

The test suite validates:

### Sandbox Security

* Path traversal
* Zip bombs
* Symlink escapes
* ANSI injection
* OSC terminal escape sequences
* Resource limits

### Queue Operations

* Concurrent workers
* Atomic job claiming
* Queue state transitions
* Stale job recovery
* Cancellation

### Compilation

* C compilation
* C++ compilation
* Rust compilation
* Compiler errors
* Exit code handling
* PE/MZ artifact validation

### Authentication

* Session security
* API authorization
* Per-user artifact access

---

# 📊 Benchmarks

Example compilation benchmarks:

| Language | Standard | Project Type | Files | Avg. Time | Artifact Size |
| -------- | -------- | ------------ | ----: | --------: | ------------: |
| C        | C17      | Single File  |     1 |    415 ms |       ~128 KB |
| C        | C17      | Multi-file   |     3 |    532 ms |       ~134 KB |
| C++      | C++20    | Single File  |     1 |    734 ms |       ~142 KB |
| C++      | C++20    | Multi-file   |     4 |    955 ms |       ~158 KB |
| Rust     | 2021     | Single File  |     1 |  1,325 ms |       ~186 KB |
| Rust     | 2021     | Multi-file   |     3 |  1,560 ms |       ~198 KB |

> Benchmark results depend on hardware, compiler versions, Docker configuration, and system load.

Full benchmark documentation:

```text
docs/benchmark.md
```

---

# 📁 Repository Structure

```text
CodeForge/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── builds/
│   │   │   │   ├── projects/
│   │   │   │   └── github/
│   │   │   └── auth/
│   │   │
│   │   └── dashboard/
│   │
│   ├── components/
│   │   └── codeforge/
│   │
│   ├── db/
│   │   └── Drizzle PostgreSQL schema
│   │
│   ├── lib/
│   │   └── codeforge/
│   │       ├── compilers/
│   │       ├── sandbox/
│   │       ├── queue.ts
│   │       ├── worker.ts
│   │       └── unzip.ts
│   │
│   └── worker.ts
│
├── packages/
│   └── codeforge-cli/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── openapi.yaml
│   ├── security.md
│   ├── security-evaluation.md
│   ├── benchmark.md
│   └── deployment.md
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── drizzle.config.ts
├── .env.example
└── LICENSE
```

---

# 📚 Documentation

| Document                      | Description                                                           |
| ----------------------------- | --------------------------------------------------------------------- |
| `docs/architecture.md`        | System architecture, queue mechanics, state machines, and data models |
| `docs/security.md`            | Security model and sandbox boundaries                                 |
| `docs/security-evaluation.md` | Threat analysis and security evaluation                               |
| `docs/api.md`                 | REST API documentation                                                |
| `docs/openapi.yaml`           | OpenAPI 3 specification                                               |
| `docs/benchmark.md`           | Compilation benchmarks and performance                                |
| `docs/deployment.md`          | Production deployment and scaling                                     |

---

# 🔒 Production Security Considerations

For production deployments, CodeForge should be operated with:

* HTTPS/TLS
* Secure reverse proxy
* Restricted Docker daemon access
* Dedicated worker infrastructure
* PostgreSQL authentication
* Strong API keys
* Environment secret management
* Resource monitoring
* Log monitoring
* Disk cleanup
* Artifact expiration
* Regular dependency updates

The build worker should be treated as a security-sensitive component because it processes untrusted source code.

---

# 🚀 Deployment Architecture

A production deployment can be structured as:

```text
                        ┌──────────────────┐
                        │      Users       │
                        │ Browser / CLI    │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Reverse Proxy    │
                        │ HTTPS / TLS      │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Next.js API/UI   │
                        └────────┬─────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   │                           │
                   ▼                           ▼
          ┌──────────────────┐       ┌──────────────────┐
          │   PostgreSQL     │       │   Build Queue    │
          └──────────────────┘       └────────┬─────────┘
                                              │
                                ┌─────────────┴─────────────┐
                                │                           │
                                ▼                           ▼
                       ┌─────────────────┐        ┌─────────────────┐
                       │ Build Worker 1  │        │ Build Worker 2  │
                       └────────┬────────┘        └────────┬────────┘
                                │                           │
                                ▼                           ▼
                       ┌─────────────────┐        ┌─────────────────┐
                       │ Docker Sandbox  │        │ Docker Sandbox  │
                       └────────┬────────┘        └────────┬────────┘
                                │                           │
                                └────────────┬──────────────┘
                                             │
                                             ▼
                                     ┌──────────────┐
                                     │ Verified EXE │
                                     └──────────────┘
```

---

# 🎯 Design Goals

CodeForge is designed around five major principles:

### 1. Security First

Never execute untrusted code directly on the host.

### 2. Isolation

Every compilation runs inside an isolated, ephemeral sandbox.

### 3. Reliability

Compilation requests are decoupled from HTTP request lifecycles using a transactional job queue.

### 4. Developer Experience

Provide simple browser, REST API, and CLI workflows.

### 5. Scalability

Multiple workers can process compilation jobs concurrently.

---

# 🧩 Core Technology Stack

| Layer          | Technology                 |
| -------------- | -------------------------- |
| Frontend       | Next.js / React            |
| Backend        | Next.js API                |
| Database       | PostgreSQL                 |
| ORM / Schema   | Drizzle ORM                |
| Queue          | PostgreSQL `SKIP LOCKED`   |
| Sandbox        | Docker                     |
| C Compiler     | MinGW-w64                  |
| C++ Compiler   | MinGW-w64                  |
| Rust Compiler  | rustc                      |
| Testing        | Vitest                     |
| API            | REST / OpenAPI 3           |
| CLI            | Node.js                    |
| Authentication | scrypt + database sessions |

---

# 📈 Future Improvements

Potential future enhancements include:

* Distributed worker autoscaling
* Build caching
* Private GitHub repository integration
* GitHub OAuth
* WebSocket-based live logs
* Artifact object storage
* Build analytics
* Compiler version selection
* Custom compiler flags
* Webhook notifications
* Team workspaces
* Organization accounts
* Usage quotas
* Billing integration
* Advanced security policies
* Kubernetes-based worker orchestration

---

# 🤝 Contributing

Contributions are welcome.

### Development Workflow

```bash
# Clone the project
git clone https://github.com/your-username/codeforge.git

# Enter project
cd codeforge

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Push database schema
npx drizzle-kit push

# Start development server
npm run dev
```

Before submitting a pull request, run:

```bash
npm run typecheck
npm run lint
npx vitest run
npm run build
```

---

# 📄 License

CodeForge is licensed under the **MIT License**.

See:

```text
LICENSE
```

---

# ⚡ CodeForge

**Secure compilation. Isolated execution. Developer-first tooling.**

CodeForge turns untrusted source code into verified Windows executables through a hardened, asynchronous, multi-user compilation infrastructure.

```
```

