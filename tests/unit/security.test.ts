import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { codeforgeConfig, boundedIntFromEnv } from "@/lib/codeforge/config";
import { stripAnsiEscapes, sanitizeCompilerOutput } from "@/lib/codeforge/sanitize";
import { sanitizeAndValidateEntryPath, extractZipSafely } from "@/lib/codeforge/unzip";
import { formatDockerMountPath } from "@/lib/codeforge/sandbox/docker-backend";
import { createWorkspace, removeWorkspace, workspacePathFor } from "@/lib/codeforge/workspace";
import { validateFilename, validateStandard } from "@/lib/codeforge/validation";
import { SecurityRejectionError } from "@/lib/codeforge/types";

describe("Phase 6: Advanced Sandbox Security & Hardening", () => {
  describe("1. Configuration Bounds & Integer Validation", () => {
    it("clamps negative or excessively high worker concurrency", () => {
      expect(boundedIntFromEnv("TEST_NONEXISTENT", 2, 1, 16)).toBe(2);
      process.env.TEST_CONCURRENCY = "-5";
      expect(boundedIntFromEnv("TEST_CONCURRENCY", 2, 1, 16)).toBe(1);
      process.env.TEST_CONCURRENCY = "99999";
      expect(boundedIntFromEnv("TEST_CONCURRENCY", 2, 1, 16)).toBe(16);
      delete process.env.TEST_CONCURRENCY;
    });

    it("ensures all security critical defaults are positive and bounded", () => {
      expect(codeforgeConfig.workerConcurrency).toBeGreaterThanOrEqual(1);
      expect(codeforgeConfig.workerConcurrency).toBeLessThanOrEqual(16);
      expect(codeforgeConfig.maxProcesses).toBe(64);
      expect(codeforgeConfig.cpuTimeSeconds).toBe(15);
      expect(codeforgeConfig.wallClockTimeoutMs).toBe(20000);
      expect(codeforgeConfig.maxProjectDepth).toBe(5);
    });
  });

  describe("2. Terminal Escape & ANSI Sanitization", () => {
    it("strips ANSI color codes and cursor movement sequences", () => {
      const malicious = "\x1b[31;1mError:\x1b[0m \x1b[2J\x1b[HHidden text";
      const cleaned = stripAnsiEscapes(malicious);
      expect(cleaned).toBe("Error: Hidden text");
    });

    it("strips OSC window title change sequences and bells", () => {
      const malicious = "\x1b]0;Pwned Title\x07Compiling file...";
      const cleaned = stripAnsiEscapes(malicious);
      expect(cleaned).toBe("Compiling file...");
    });

    it("scrubs internal workspace and tmp paths from output", () => {
      const raw = `Fatal error in ${codeforgeConfig.dataDir}/workspaces/test-123/main.cpp: undefined reference`;
      const sanitized = sanitizeCompilerOutput(raw);
      expect(sanitized).not.toContain(codeforgeConfig.dataDir);
      expect(sanitized).toContain("<workspace>");
    });
  });

  describe("3. Path Normalization & ZIP Security", () => {
    it("rejects directory traversal attempts with ../", () => {
      expect(() => sanitizeAndValidateEntryPath("../../../etc/passwd")).toThrow(SecurityRejectionError);
      expect(() => sanitizeAndValidateEntryPath("src/../../secret.txt")).toThrow(SecurityRejectionError);
    });

    it("rejects absolute paths and Windows drive letters", () => {
      expect(() => sanitizeAndValidateEntryPath("/etc/shadow")).toThrow(SecurityRejectionError);
      expect(() => sanitizeAndValidateEntryPath("C:/Windows/System32/cmd.exe")).toThrow(SecurityRejectionError);
      expect(() => sanitizeAndValidateEntryPath("D:\\evil.cpp")).toThrow(SecurityRejectionError);
    });

    it("rejects null bytes in entry names", () => {
      expect(() => sanitizeAndValidateEntryPath("main.cpp\0.txt")).toThrow(SecurityRejectionError);
    });

    it("rejects paths exceeding maximum directory depth", () => {
      const deepPath = "a/b/c/d/e/f/g/main.cpp";
      expect(() => sanitizeAndValidateEntryPath(deepPath)).toThrow(SecurityRejectionError);
    });
  });

  describe("4. Compiler Argument & Command Injection Defense", () => {
    it("rejects filenames containing command injection syntax", () => {
      expect(() => validateFilename("main.cpp;rm -rf /", "cpp")).toThrow(SecurityRejectionError);
      expect(() => validateFilename("main.cpp`reboot`", "cpp")).toThrow(SecurityRejectionError);
      expect(() => validateFilename("main.cpp$(whoami)", "cpp")).toThrow(SecurityRejectionError);
      expect(() => validateFilename("--output=/tmp/evil.exe", "cpp")).toThrow(SecurityRejectionError);
    });

    it("rejects standard/toolchain injection attempts", () => {
      expect(() => validateStandard("c++20; cat /etc/passwd", "cpp")).toThrow(SecurityRejectionError);
      expect(() => validateStandard("c17 -O3 -fno-stack-protector", "c")).toThrow(SecurityRejectionError);
      expect(() => validateStandard("stable $(id)", "rust")).toThrow(SecurityRejectionError);
    });
  });

  describe("5. Docker Mount & Workspace Isolation", () => {
    it("formats mount path strictly scoped to /work with rw permissions", () => {
      const hostDir = path.resolve("./codeforge-data/workspaces/test-uuid");
      const mount = formatDockerMountPath(hostDir);
      expect(mount).toBe(`${hostDir}:/work:rw`);
      expect(mount).not.toContain("/var/run/docker.sock");
    });

    it("creates isolated workspaces per build ID preventing cross-contamination", async () => {
      const buildA = "sec-test-build-a";
      const buildB = "sec-test-build-b";
      const wsA = await createWorkspace(buildA);
      const wsB = await createWorkspace(buildB);

      expect(wsA).not.toBe(wsB);
      await fs.writeFile(path.join(wsA, "secret.txt"), "secret-a");
      await fs.writeFile(path.join(wsB, "secret.txt"), "secret-b");

      const contentA = await fs.readFile(path.join(wsA, "secret.txt"), "utf-8");
      const contentB = await fs.readFile(path.join(wsB, "secret.txt"), "utf-8");
      expect(contentA).toBe("secret-a");
      expect(contentB).toBe("secret-b");

      await removeWorkspace(wsA);
      await removeWorkspace(wsB);
    });
  });
});
