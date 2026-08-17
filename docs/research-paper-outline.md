# Towards Robust Containerized Sandboxing for Untrusted Native Code Compilation

## Abstract
Web-based multi-tenant compilation platforms must execute untrusted, potentially adversarial user source code without risking host compromise, denial-of-service, or data exfiltration. This paper outlines the architectural principles, container isolation boundaries, and transactional job queues implemented in **CodeForge**, an open-source platform that compiles C, C++, and Rust source into Windows Portable Executable binaries.

---

## Paper Structure & Outline

### 1. Introduction
- The challenge of safe multi-tenant native code compilation.
- Threat modeling for cloud-based compilation platforms.
- Objectives and contributions of the CodeForge architecture.

### 2. Threat Model & Adversarial Capabilities
- Remote Code Execution (RCE) via compiler bugs or malicious `#include` / build scripts.
- Resource exhaustion attacks: CPU monopolization, fork bombs, and allocation exhaustion.
- Malicious archive payloads: Directory traversal (`Zip Slip`), compression bombs, and symbolic link escalation.
- Terminal control injection (ANSI/OSC escape vulnerabilities).

### 3. System Architecture
- Separation of web lifecycle from compiler execution via PostgreSQL transactional queues.
- Dynamic compiler registry abstraction across MinGW-w64 and Rust GNU toolchains.
- Per-tenant isolation and session security model.

### 4. Compiler Sandbox Design
- OCI container isolation: `--network none`, `--read-only`, non-root user namespaces, and tmpfs boundaries.
- Capability dropping (`CAP_DROP_ALL`) and `no-new-privileges` enforcement.
- Bounded process limits (`pids-limit`) and wall-clock timeout watchdog.

### 5. Experimental Evaluation
- Compilation latency across single-file and multi-file project archives.
- Throughput and latency scaling under varying worker concurrency levels.
- Adversarial robustness: Verification against a 17-threat attack suite.

### 6. Limitations & Future Work
- Hypervisor-based microVMs (e.g. Firecracker) vs. container sandboxing.
- Secure caching of external package dependencies in air-gapped sandboxes.

### 7. References
- Real-world vulnerability case studies and OCI security standards.
