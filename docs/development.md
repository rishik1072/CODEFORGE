# CodeForge — Development Guide

## Prerequisites

| Tool | Verified version in this project | Notes |
|---|---|---|
| Node.js | 22.x | Runs the Next.js app |
| npm | 10.x | Package management |
| PostgreSQL | provided via `DATABASE_URL` | Build metadata storage |
| `x86_64-w64-mingw32-g++` (MinGW-w64) | GCC 12 (win32 runtime) | The actual C++ -> Windows PE cross-compiler |
| `unshare`, `ulimit`, `timeout` (util-linux/coreutils) | present on any standard Linux host | Namespace + rlimit sandboxing |
| Docker (optional) | any recent version | Enables the stronger isolation backend automatically when present |

### Installing MinGW-w64 (Debian/Ubuntu-based hosts)

```bash
sudo apt-get update
sudo apt-get install -y mingw-w64
x86_64-w64-mingw32-g++ --version   # sanity check
```

If this package is not installed, `POST /api/build` will fail every
request with an `internal_error` reporting that the compiler sandbox could
not be started - this is a real failure, not a simulated one; CodeForge
does not fall back to a fake compiler.

### Windows development hosts

The cross-compiler toolchain here targets Linux/macOS development hosts
(consistent with the project's Docker/WSL-first design). On native Windows,
run this project inside WSL2 (Debian/Ubuntu) and follow the Linux
instructions above.

## Environment variables

Configured in `.env` (already present in this project):

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

All compiler/sandbox limits are optional and have safe defaults - see
`src/lib/codeforge/config.ts` for the full list (`CODEFORGE_MAX_UPLOAD_BYTES`,
`CODEFORGE_CPU_SECONDS`, `CODEFORGE_WALL_TIMEOUT_MS`, `CODEFORGE_MAX_PROCESSES`,
`CODEFORGE_MAX_VMEM_KB`, `CODEFORGE_ARTIFACT_TTL_MS`,
`CODEFORGE_RATE_LIMIT_MAX_BUILDS`, etc).

## Running locally

```bash
npm install
npx drizzle-kit push     # creates/updates the `builds` table
npm run build
npm run start             # or: npm run dev
```

Then open the app and:

1. Drag & drop (or browse to) a `.cpp` file.
2. Pick a C++ standard.
3. Click **BUILD**.
4. Watch the build console; download the `.exe` on success.

## Manual end-to-end verification (what was actually run for this build)

```bash
# 1. Prove the compiler pipeline works standalone (Phase 2-style check):
mkdir -p /tmp/cf-manual && cd /tmp/cf-manual
cat > hello.cpp <<'EOF'
#include <iostream>
int main() {
    std::cout << "Hello from CodeForge!" << std::endl;
    return 0;
}
EOF
x86_64-w64-mingw32-g++ -std=c++20 -O2 -static -o hello.exe hello.cpp
# -> produced a real Windows PE binary (verified via the "MZ" header)

# 2. Exercise the same code path the app uses, end-to-end, via automated tests:
npx vitest run
```

`tests/integration/compiler.test.ts` runs the exact sandbox function the
API uses (`compileWithNamespaceSandbox`) against both valid and
intentionally broken C++ source, and asserts:

- a real `MZ`-headed PE executable is produced for valid source,
- a real compiler diagnostic mentioning the actual typo is returned for
  invalid source,
- an in-namespace network call to an external host fails, proving the
  network isolation is real and not just configured.

## API reference

### `GET /api/health`
Returns `{ ok: true, service: "codeforge-api" }` after a live database
round-trip, or `500` if the database is unreachable.

### `POST /api/build`
`multipart/form-data` with fields:
- `file` — the `.cpp` source file
- `standard` — one of `c++11`, `c++14`, `c++17`, `c++20`, `c++23`

Returns `201` with a build record (see `src/lib/codeforge/types.ts`
`PublicBuildRecord`), or a structured `{ error: { code, message } }` with
`400` (validation/security rejection), `413` (payload too large), `429`
(rate limited), or `500` (internal error).

### `GET /api/build/:id`
Returns the current build record, or `404` if the ID is unknown.

### `GET /api/build/:id/download`
Streams the compiled `.exe` with `Content-Disposition: attachment` if the
build succeeded and the artifact has not expired; otherwise `409` (no
artifact), `410` (expired), or `404` (unknown build).

## Testing

```bash
npx vitest run
```

Covers: filename/path-traversal/extension/size/content validation, output
sanitization, workspace creation/cleanup/TTL sweeping, and real
compiler-sandbox integration (success, compile error, network isolation).

Not currently automated (documented, not faked):
- Full HTTP-level tests of the Next.js route handlers (would require
  spinning up the Next server plus a live Postgres instance in CI).
- Docker-backend-specific tests (no Docker daemon available in this
  environment - the code path is implemented and structurally mirrors the
  namespace backend's contract, see `docs/security.md` section 2).
- A deterministic "compilation timeout" trigger (crafting C++ that reliably
  makes GCC itself hang within a short test budget is impractical; the
  timeout mechanism is exercised structurally by `timeout --signal=KILL`
  and the Node-level backstop timer, both plain, auditable code).
