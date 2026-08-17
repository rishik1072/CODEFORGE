# CodeForge: Engineering a Secure, Isolated Multi-User Cloud Compilation Platform

## Executive Summary

Building a web-based code compilation service introduces severe security risks: users can upload arbitrary, hostile code designed to exhaust resources, access the local filesystem, establish outbound command-and-control networks, or compromise the host server.

**CodeForge** is an engineering portfolio project that demonstrates a multi-tier defense-in-depth architecture capable of compiling C, C++, and Rust code into native Windows Portable Executables (`.exe`) without exposing the host system.

---

## 1. Key Engineering Highlights

1. **Defense-in-Depth Container Sandboxing**:
   - Compilers execute in transient Docker containers with zero network access (`--network none`), read-only rootfilesystems, dropped Linux capabilities, and non-root users (`UID 1000`).
   - Resource limits (CPU, 1.5GB RAM, 64 PIDs) prevent fork bombs and memory exhaustion.
2. **Transactional Asynchronous Queue**:
   - HTTP requests are decoupled from compilation lifecycle using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` for atomic job claiming across worker pools.
3. **Multi-Language Compiler Abstraction**:
   - `CompilerRegistry` unifies GCC MinGW (C), G++ MinGW (C++), and Rust GNU (`rustc --target x86_64-pc-windows-gnu`) toolchains.
4. **Archive Hardening & Entry-Point Discovery**:
   - Streaming unzip protects against path traversal (`../`), absolute paths, and zip bombs.
   - Code inspection enforces strict single-entrypoint rules (`main()` / `fn main()`) while blocking hostile build scripts (`Makefile`, `build.sh`, `Cargo.toml`).
5. **Zero-Trust Multi-User Platform**:
   - Passwords hashed with `scrypt`; sessions stored in PostgreSQL with `HttpOnly` cookies.
   - Per-user ownership verification ensures users can only access their own builds, projects, and `.exe` artifacts.
6. **Programmatic REST API & CLI**:
   - Complete OpenAPI 3.0.3 specification, SHA-256 hashed API keys (`cf_live_...`), rate limiting, and dedicated `@codeforge/cli`.

---

## 2. Technology Stack

- **Core Application**: Next.js 16 (App Router), React 19, TypeScript
- **Database & Queue**: PostgreSQL 16, Drizzle ORM, `node-postgres`
- **Compiler Sandboxes**: Docker Engine, MinGW-w64 (`gcc`/`g++`), Rust GNU Toolchain
- **CLI & Client**: Node.js CLI with secure config storage
- **Testing**: Vitest (80 unit & integration tests)
