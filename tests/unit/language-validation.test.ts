import { describe, expect, it } from "vitest";
import {
  validateFilename,
  validateLanguage,
  validateStandard,
} from "@/lib/codeforge/validation";
import { SecurityRejectionError } from "@/lib/codeforge/types";

describe("validateLanguage", () => {
  it("defaults to cpp when undefined or null", () => {
    expect(validateLanguage(undefined)).toBe("cpp");
    expect(validateLanguage(null)).toBe("cpp");
  });

  it("accepts valid languages 'cpp', 'c', and 'rust'", () => {
    expect(validateLanguage("cpp")).toBe("cpp");
    expect(validateLanguage("c")).toBe("c");
    expect(validateLanguage("rust")).toBe("rust");
  });

  it("rejects unsupported languages", () => {
    expect(() => validateLanguage("golang")).toThrow(SecurityRejectionError);
    expect(() => validateLanguage("python")).toThrow(SecurityRejectionError);
    expect(() => validateLanguage("java")).toThrow(SecurityRejectionError);
  });
});

describe("validateFilename with language", () => {
  it("accepts valid C source files for C language", () => {
    expect(validateFilename("main.c", "c")).toBe("main.c");
    expect(validateFilename("utils.c", "c")).toBe("utils.c");
    expect(validateFilename("project.zip", "c")).toBe("project.zip");
  });

  it("rejects C++ and Rust files when language is C", () => {
    expect(() => validateFilename("main.cpp", "c")).toThrow(SecurityRejectionError);
    expect(() => validateFilename("main.cxx", "c")).toThrow(SecurityRejectionError);
    expect(() => validateFilename("main.rs", "c")).toThrow(SecurityRejectionError);
  });

  it("accepts valid C++ source files for C++ language", () => {
    expect(validateFilename("main.cpp", "cpp")).toBe("main.cpp");
    expect(validateFilename("test.cxx", "cpp")).toBe("test.cxx");
    expect(validateFilename("project.zip", "cpp")).toBe("project.zip");
  });

  it("rejects C and Rust files when language is C++", () => {
    expect(() => validateFilename("main.c", "cpp")).toThrow(SecurityRejectionError);
    expect(() => validateFilename("main.rs", "cpp")).toThrow(SecurityRejectionError);
  });

  it("accepts valid Rust source files for Rust language", () => {
    expect(validateFilename("main.rs", "rust")).toBe("main.rs");
    expect(validateFilename("hello.rs", "rust")).toBe("hello.rs");
    expect(validateFilename("project.zip", "rust")).toBe("project.zip");
  });

  it("rejects C and C++ files when language is Rust", () => {
    expect(() => validateFilename("main.c", "rust")).toThrow(SecurityRejectionError);
    expect(() => validateFilename("main.cpp", "rust")).toThrow(SecurityRejectionError);
  });
});

describe("validateStandard for C, C++, and Rust", () => {
  it("validates C standards", () => {
    expect(validateStandard("c11", "c")).toBe("c11");
    expect(validateStandard("c17", "c")).toBe("c17");
    expect(validateStandard("c23", "c")).toBe("c23");
  });

  it("rejects unsupported C standards", () => {
    expect(() => validateStandard(null, "c")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("", "c")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("c99", "c")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("c++20", "c")).toThrow(SecurityRejectionError);
  });

  it("validates C++ standards", () => {
    expect(validateStandard("c++11", "cpp")).toBe("c++11");
    expect(validateStandard("c++14", "cpp")).toBe("c++14");
    expect(validateStandard("c++17", "cpp")).toBe("c++17");
    expect(validateStandard("c++20", "cpp")).toBe("c++20");
    expect(validateStandard("c++23", "cpp")).toBe("c++23");
  });

  it("rejects unsupported C++ standards", () => {
    expect(() => validateStandard(null, "cpp")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("", "cpp")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("c++98", "cpp")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("c17", "cpp")).toThrow(SecurityRejectionError);
  });

  it("validates Rust toolchains", () => {
    expect(validateStandard("stable", "rust")).toBe("stable");
  });

  it("rejects unsupported Rust toolchains or standards", () => {
    expect(() => validateStandard(null, "rust")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("", "rust")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("nightly", "rust")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("beta", "rust")).toThrow(SecurityRejectionError);
    expect(() => validateStandard("c++20", "rust")).toThrow(SecurityRejectionError);
  });
});
