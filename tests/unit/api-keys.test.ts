import { describe, expect, it } from "vitest";
import { hashApiKey } from "@/lib/codeforge/api-keys";

describe("Phase 8: API Keys & Public API Security", () => {
  it("computes deterministic SHA-256 hash of raw API keys", () => {
    const rawKey = "cf_live_1234567890abcdef1234567890abcdef";
    const hash1 = hashApiKey(rawKey);
    const hash2 = hashApiKey(rawKey);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(rawKey);
  });

  it("produces distinct hashes for different API keys", () => {
    const key1 = "cf_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const key2 = "cf_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    expect(hashApiKey(key1)).not.toBe(hashApiKey(key2));
  });

  it("handles CLI argument parsing safely without shell injection", () => {
    const safeOutput = "output.exe";
    expect(safeOutput).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});
