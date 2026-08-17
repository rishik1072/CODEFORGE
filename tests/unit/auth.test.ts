import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/codeforge/auth";

describe("Phase 7: User Accounts & Authentication Security", () => {
  it("hashes password with salt using scrypt", async () => {
    const rawPassword = "SuperSecretPassword123!";
    const hash = await hashPassword(rawPassword);

    expect(hash).toContain(":");
    expect(hash).not.toBe(rawPassword);

    const [salt, key] = hash.split(":");
    expect(salt).toHaveLength(32);
    expect(key.length).toBeGreaterThan(64);
  });

  it("verifies correct password against hash", async () => {
    const rawPassword = "CorrectHorseBatteryStaple!";
    const hash = await hashPassword(rawPassword);

    const isMatch = await verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);
  });

  it("rejects incorrect password against hash", async () => {
    const rawPassword = "CorrectPassword123";
    const hash = await hashPassword(rawPassword);

    const isMatch = await verifyPassword("WrongPassword456", hash);
    expect(isMatch).toBe(false);
  });

  it("generates unique salts for identical passwords", async () => {
    const rawPassword = "IdenticalPassword99";
    const hash1 = await hashPassword(rawPassword);
    const hash2 = await hashPassword(rawPassword);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(rawPassword, hash1)).toBe(true);
    expect(await verifyPassword(rawPassword, hash2)).toBe(true);
  });
});
