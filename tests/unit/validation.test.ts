import { describe, expect, it } from "vitest";
import {
  validateFilename,
  validateSize,
  validateSourceContent,
  validateStandard,
} from "@/lib/codeforge/validation";
import { SecurityRejectionError } from "@/lib/codeforge/types";
import { codeforgeConfig } from "@/lib/codeforge/config";

describe("validateFilename", () => {
  it("accepts a normal .cpp filename", () => {
    expect(validateFilename("hello.cpp")).toBe("hello.cpp");
  });

  it("rejects path traversal attempts", () => {
    expect(() => validateFilename("../../etc/passwd.cpp")).toThrow(SecurityRejectionError);
    expect(() => validateFilename("..\\..\\windows\\system32.cpp")).toThrow(SecurityRejectionError);
  });

  it("rejects absolute paths", () => {
    expect(() => validateFilename("/etc/passwd.cpp")).toThrow(SecurityRejectionError);
  });

  it("rejects unsupported extensions", () => {
    expect(() => validateFilename("hello.exe")).toThrow(SecurityRejectionError);
    expect(() => validateFilename("hello.py")).toThrow(SecurityRejectionError);
    expect(() => validateFilename("hello")).toThrow(SecurityRejectionError);
  });

  it("rejects filenames with a null byte", () => {
    expect(() => validateFilename("hello.cpp\0.exe")).toThrow(SecurityRejectionError);
  });

  it("rejects empty filenames", () => {
    expect(() => validateFilename("   ")).toThrow(SecurityRejectionError);
  });
});

describe("validateStandard", () => {
  it("accepts every supported standard", () => {
    expect(validateStandard("c++11")).toBe("c++11");
    expect(validateStandard("c++20")).toBe("c++20");
    expect(validateStandard("c++23")).toBe("c++23");
  });

  it("rejects unsupported or missing standards", () => {
    expect(() => validateStandard("c++98")).toThrow(SecurityRejectionError);
    expect(() => validateStandard(null)).toThrow(SecurityRejectionError);
    expect(() => validateStandard("-fpermissive")).toThrow(SecurityRejectionError);
  });
});

describe("validateSize", () => {
  it("rejects empty files", () => {
    expect(() => validateSize(0)).toThrow(SecurityRejectionError);
  });

  it("rejects files over the configured maximum", () => {
    expect(() => validateSize(codeforgeConfig.maxUploadBytes + 1)).toThrow(SecurityRejectionError);
  });

  it("accepts files within the limit", () => {
    expect(() => validateSize(1024)).not.toThrow();
  });
});

describe("validateSourceContent", () => {
  it("accepts normal C++ source text", () => {
    const src = '#include <iostream>\nint main() { std::cout << "hi"; }\n';
    expect(validateSourceContent(Buffer.from(src, "utf-8"))).toBe(src);
  });

  it("rejects binary content containing NUL bytes", () => {
    const buffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x02]);
    expect(() => validateSourceContent(buffer)).toThrow(SecurityRejectionError);
  });

  it("rejects content with disallowed control characters", () => {
    const buffer = Buffer.from("int main() {\x01\x02}", "utf-8");
    expect(() => validateSourceContent(buffer)).toThrow(SecurityRejectionError);
  });
});
