import { describe, expect, it } from "vitest";
import { toPublicBuildRecord } from "@/lib/codeforge/serialize";
import type { BuildRow } from "@/db/schema";

describe("toPublicBuildRecord serialization", () => {
  it("includes sha256 when artifact is available", () => {
    const fakeRow: BuildRow = {
      id: "12345678-1234-1234-1234-123456789abc",
      originalFilename: "test.cpp",
      cppStandard: "c++20",
      sourceSizeBytes: 120,
      status: "success",
      stages: [{ stage: "SUCCESS", message: "Done", at: new Date().toISOString() }],
      stdout: "",
      stderr: "",
      errorMessage: null,
      compilerBackend: "docker",
      artifactPath: null, // intentionally null to verify fallback
      artifactFilename: "test.exe",
      artifactSizeBytes: 2048,
      artifactSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      artifactExpiresAt: new Date(Date.now() + 60000),
      durationMs: 1500,
      clientIp: "127.0.0.1",
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
    };

    const record = toPublicBuildRecord(fakeRow);
    expect(record.buildId).toBe(fakeRow.id);
    expect(record.status).toBe("success");
    expect(record.originalFilename).toBe("test.cpp");
    // Client IP and internal filesystem paths must never be exposed
    expect((record as Record<string, unknown>).clientIp).toBeUndefined();
    expect((record as Record<string, unknown>).artifactPath).toBeUndefined();
  });
});
