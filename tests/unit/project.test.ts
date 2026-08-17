import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { inspectProjectWorkspace } from "@/lib/codeforge/project";
import { SecurityRejectionError } from "@/lib/codeforge/types";

describe("inspectProjectWorkspace - C Projects", () => {
  it("discovers C sources and headers and identifies single main()", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-c-project-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main.c"), '#include "student.h"\nint main() { return 0; }\n');
      await fs.writeFile(path.join(tmpDir, "student.h"), "typedef struct { int id; } Student;\n");
      await fs.writeFile(path.join(tmpDir, "student.c"), '#include "student.h"\nvoid helper(void) {}\n');

      const project = await inspectProjectWorkspace(tmpDir, "c");
      expect(project.projectType).toBe("multi");
      expect(project.language).toBe("c");
      expect(project.sourceFiles).toHaveLength(2);
      expect(project.headerFiles).toHaveLength(1);
      expect(project.entryPoint).toBe("main.c");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects C project with missing main() function", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-c-project-"));
    try {
      await fs.writeFile(path.join(tmpDir, "student.c"), "void helper(void) {}\n");
      await expect(inspectProjectWorkspace(tmpDir, "c")).rejects.toThrow(/No C entry point/i);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects C project with multiple main() functions", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-c-project-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main1.c"), "int main() { return 1; }\n");
      await fs.writeFile(path.join(tmpDir, "main2.c"), "int main(int argc, char** argv) { return 0; }\n");
      await expect(inspectProjectWorkspace(tmpDir, "c")).rejects.toThrow(/Multiple possible main/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects C project containing dangerous executables or scripts", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-c-project-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main.c"), "int main() { return 0; }\n");
      await fs.writeFile(path.join(tmpDir, "Makefile"), "all:\n\tgcc main.c\n");
      await fs.writeFile(path.join(tmpDir, "build.sh"), "#!/bin/sh\necho evil\n");
      await expect(inspectProjectWorkspace(tmpDir, "c")).rejects.toThrow(/disallowed executable or script/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects mixed C and C++ projects with controlled error", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-mixed-project-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main.c"), "int main() { return 0; }\n");
      await fs.writeFile(path.join(tmpDir, "utils.cpp"), "void helper() {}\n");
      await expect(inspectProjectWorkspace(tmpDir, "c")).rejects.toThrow("Mixed C and C++ projects are not currently supported.");
      await expect(inspectProjectWorkspace(tmpDir, "cpp")).rejects.toThrow("Mixed C and C++ projects are not currently supported.");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("inspectProjectWorkspace - Rust Projects", () => {
  it("discovers Rust sources and identifies src/main.rs entry point", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-rust-project-"));
    try {
      await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
      await fs.writeFile(path.join(tmpDir, "src", "main.rs"), "mod student;\nfn main() {}\n");
      await fs.writeFile(path.join(tmpDir, "src", "student.rs"), "pub fn hello() {}\n");

      const project = await inspectProjectWorkspace(tmpDir, "rust");
      expect(project.projectType).toBe("multi");
      expect(project.language).toBe("rust");
      expect(project.sourceFiles).toHaveLength(2);
      expect(project.entryPoint).toBe("src/main.rs");
      expect(project.sourceFiles[0]).toBe("src/main.rs");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("discovers Rust root main.rs if no src/main.rs", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-rust-root-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main.rs"), "mod utils;\nfn main() {}\n");
      await fs.writeFile(path.join(tmpDir, "utils.rs"), "pub fn util() {}\n");

      const project = await inspectProjectWorkspace(tmpDir, "rust");
      expect(project.projectType).toBe("multi");
      expect(project.entryPoint).toBe("main.rs");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects Rust project containing Cargo.toml", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-rust-cargo-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main.rs"), "fn main() {}\n");
      await fs.writeFile(path.join(tmpDir, "Cargo.toml"), '[package]\nname = "test"\n');
      await expect(inspectProjectWorkspace(tmpDir, "rust")).rejects.toThrow(/Cargo projects and external crate dependencies/i);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects Rust project with missing main() function", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-rust-nomain-"));
    try {
      await fs.writeFile(path.join(tmpDir, "lib.rs"), "pub fn foo() {}\n");
      await expect(inspectProjectWorkspace(tmpDir, "rust")).rejects.toThrow(/No Rust entry point was detected/i);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects mixed C and Rust project", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-rust-c-mixed-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main.rs"), "fn main() {}\n");
      await fs.writeFile(path.join(tmpDir, "helper.c"), "void helper() {}\n");
      await expect(inspectProjectWorkspace(tmpDir, "rust")).rejects.toThrow("Mixed language projects are not currently supported.");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("inspectProjectWorkspace - C++ Projects (Regression)", () => {
  it("discovers C++ sources and headers and identifies single main()", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-cpp-project-"));
    try {
      await fs.writeFile(path.join(tmpDir, "main.cpp"), '#include "Student.h"\nint main() { return 0; }\n');
      await fs.writeFile(path.join(tmpDir, "Student.h"), "struct Student {};\n");
      await fs.writeFile(path.join(tmpDir, "Student.cpp"), '#include "Student.h"\nvoid helper() {}\n');

      const project = await inspectProjectWorkspace(tmpDir, "cpp");
      expect(project.projectType).toBe("multi");
      expect(project.language).toBe("cpp");
      expect(project.sourceFiles).toHaveLength(2);
      expect(project.headerFiles).toHaveLength(1);
      expect(project.entryPoint).toBe("main.cpp");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
