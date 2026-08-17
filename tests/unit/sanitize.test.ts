import os from "node:os";
import { describe, expect, it } from "vitest";
import { sanitizeCompilerOutput } from "@/lib/codeforge/sanitize";
import { codeforgeConfig } from "@/lib/codeforge/config";

describe("sanitizeCompilerOutput", () => {
  it("replaces the configured data directory with a placeholder", () => {
    const raw = `${codeforgeConfig.dataDir}/workspaces/abc/main.cpp:3:1: error: foo`;
    const result = sanitizeCompilerOutput(raw);
    expect(result).not.toContain(codeforgeConfig.dataDir);
    expect(result).toContain("<workspace>");
  });

  it("strips generic /tmp and /home paths", () => {
    const raw = `${os.tmpdir()}/ccXXXXXX.o: undefined reference to 'foo'\n/home/someuser/secret.txt leaked`;
    const result = sanitizeCompilerOutput(raw);
    expect(result).not.toMatch(/\/home\/someuser/);
  });

  it("leaves normal compiler diagnostics untouched", () => {
    const raw = "main.cpp:12:5: error: 'coutt' was not declared in this scope";
    expect(sanitizeCompilerOutput(raw)).toBe(raw);
  });
});
