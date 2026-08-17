# CodeForge API Documentation (v1)

Welcome to the **CodeForge REST API v1**. The API enables programmatic builds of C, C++, and Rust source code and multi-file projects inside isolated, network-disabled Docker sandboxes.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All protected endpoints require an API key passed via the standard HTTP `Authorization` header:

```http
Authorization: Bearer cf_live_...
```

You can generate and manage API keys via the Web UI (`Settings -> API Keys`) or via the `POST /api/api-keys` endpoint.

### API Scopes

| Scope | Description |
|---|---|
| `build:create` | Enqueue a new source file, ZIP project, or GitHub repo build |
| `build:read` | Inspect build status, stages, logs, and download artifacts |
| `build:cancel` | Cancel queued or active compilation jobs |
| `project:read` | List and inspect user projects and their build history |
| `project:write` | Create and delete workspace projects |

---

## Endpoints

### 1. Health Check

```http
GET /api/v1/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "v1",
  "service": "codeforge-compilation-api",
  "timestamp": "2026-08-16T10:00:00.000Z"
}
```

---

### 2. Enqueue Build

```http
POST /api/v1/builds
```

Accepts `multipart/form-data`:
- `file`: Source file (`.cpp`, `.c`, `.rs`) or `.zip` project archive
- `language`: `cpp` | `c` | `rust`
- `standard`: `c++11` | `c++14` | `c++17` | `c++20` | `c++23` | `c11` | `c17` | `c23` | `stable` | `2021`
- `projectId` *(optional)*: UUID of an existing workspace project

**Optional Headers:**
- `Idempotency-Key`: Client-supplied unique token. Subsequent requests with the same key return the existing build record instead of duplicating jobs.

**Response (202 Accepted):**
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

---

### 3. Build Status

```http
GET /api/v1/builds/:id
```

**Response (200 OK):**
```json
{
  "buildId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "success",
  "language": "cpp",
  "cppStandard": "c++20",
  "originalFilename": "hello.cpp",
  "durationMs": 842,
  "artifact": {
    "filename": "hello.exe",
    "sizeBytes": 142848,
    "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
  },
  "stages": [
    { "stage": "VALIDATING", "message": "Source file passed checks", "at": "..." },
    { "stage": "COMPILING", "message": "Running g++ in sandbox", "at": "..." },
    { "stage": "SUCCESS", "message": "Executable generated successfully", "at": "..." }
  ]
}
```

---

### 4. Download Artifact

```http
GET /api/v1/builds/:id/artifact
```

Streams the compiled Windows PE binary (`application/vnd.microsoft.portable-executable`).

---

### 5. Cancel Build

```http
POST /api/v1/builds/:id/cancel
```

**Response (200 OK):**
```json
{
  "message": "Build cancelled successfully."
}
```

---

### 6. Public GitHub Import & Build

```http
POST /api/v1/github/build
```

**Request (application/json):**
```json
{
  "repository": "owner/repo",
  "branch": "main",
  "language": "cpp",
  "standard": "c++20"
}
```

**Response (202 Accepted):**
```json
{
  "buildId": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
  "status": "queued"
}
```

---

## Rate Limits

- Build Creation: 10 requests / minute per user/IP
- Status & Downloads: 60 requests / minute
- HTTP Status on exceed: `429 Too Many Requests` with standard `Retry-After` header.

## CLI Usage

Install the CodeForge CLI locally:

```bash
cd packages/codeforge-cli
npm link
```

### CLI Quick Reference

```bash
# Login & save API key to ~/.codeforge/config.json
codeforge login cf_live_...

# Compile single file and wait for artifact
codeforge build main.cpp --language cpp --standard c++20 --wait

# Download executable
codeforge download <build-id> --output app.exe

# Compile Rust project archive
codeforge build project.zip --language rust --standard 2021 --wait
```
