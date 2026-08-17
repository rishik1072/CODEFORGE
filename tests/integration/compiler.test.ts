import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import { compileWithNamespaceSandbox, detectNamespaceSandboxSupport } from "@/lib/codeforge/sandbox/namespace-backend";
import { compileWithDocker, detectDockerSupport } from "@/lib/codeforge/sandbox/docker-backend";
import { createWorkspace, removeWorkspace } from "@/lib/codeforge/workspace";

// C++ test fixtures
const CPP_HELLO_SOURCE = `#include <iostream>\n\nint main() {\n    std::cout << "Hello from CodeForge!" << std::endl;\n    return 0;\n}\n`;
const CPP_BROKEN_SOURCE = `#include <iostream>\nint main() { coutt << "x"; }\n`;

const STUDENT_H = `
#ifndef STUDENT_H
#define STUDENT_H
#include <string>

class Student {
public:
    std::string name;
    int grade;
    Student(std::string n, int g);
    void print() const;
};
#endif
`;

const STUDENT_CPP = `
#include <iostream>
#include "Student.h"

Student::Student(std::string n, int g) : name(n), grade(g) {}

void Student::print() const {
    std::cout << "Student: " << name << " | Grade: " << grade << std::endl;
}
`;

const MULTI_MAIN_CPP = `
#include <iostream>
#include "Student.h"

int main() {
    Student s("Alice", 98);
    s.print();
    return 0;
}
`;

// C test fixtures
const C_HELLO_SOURCE = `#include <stdio.h>\n\nint main(void) {\n    printf("Hello from CodeForge C!\\n");\n    return 0;\n}\n`;
const C_BROKEN_SOURCE = `#include <stdio.h>\nint main(void) { printff("x"); }\n`;

const C_STUDENT_H = `
#ifndef STUDENT_H
#define STUDENT_H

typedef struct {
    char name[32];
    int grade;
} Student;

void print_student(const Student *s);
#endif
`;

const C_STUDENT_C = `
#include <stdio.h>
#include "student.h"

void print_student(const Student *s) {
    printf("Student: %s | Grade: %d\\n", s->name, s->grade);
}
`;

const C_MULTI_MAIN_C = `
#include <stdio.h>
#include <string.h>
#include "student.h"

int main(void) {
    Student s;
    strncpy(s.name, "Bob", sizeof(s.name));
    s.grade = 95;
    print_student(&s);
    return 0;
}
`;

// Rust test fixtures
const RUST_HELLO_SOURCE = `fn main() {\n    println!("Hello from CodeForge Rust!");\n}\n`;
const RUST_BROKEN_SOURCE = `fn main() {\n    printlln!("broken");\n}\n`;

const RUST_STUDENT_RS = `pub fn hello() {\n    println!("Hello from multi-file CodeForge Rust!");\n}\n`;
const RUST_MULTI_MAIN_RS = `mod student;\n\nfn main() {\n    student::hello();\n}\n`;

const isDocker = await detectDockerSupport();
const isLinuxNamespace = await detectNamespaceSandboxSupport();

const describeIfDocker = isDocker ? describe : describe.skip;
const describeIfLinuxNamespace = isLinuxNamespace ? describe : describe.skip;

describeIfDocker("compileWithDocker (C and C++ multi-language compiler in Docker)", () => {
  const workspaces: string[] = [];

  afterAll(async () => {
    await Promise.all(workspaces.map((dir) => removeWorkspace(dir)));
  });

  // --- C Language Tests ---
  it("compiles single C source (C17) into a real Windows PE executable using Docker", async () => {
    const buildId = "integration-docker-c-single";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.c`, C_HELLO_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "c",
      sourceFiles: ["main.c"],
      standard: "c17",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
    expect(outcome.artifactSizeBytes).toBeGreaterThan(0);

    const header = await fs.readFile(outcome.artifactPath!, { encoding: null });
    expect(header.subarray(0, 2).toString("ascii")).toBe("MZ");
  }, 30_000);

  it("compiles C source with C11 standard", async () => {
    const buildId = "integration-docker-c11";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.c`, C_HELLO_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "c",
      sourceFiles: ["main.c"],
      standard: "c11",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
  }, 30_000);

  it("compiles C source with C23 standard", async () => {
    const buildId = "integration-docker-c23";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.c`, C_HELLO_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "c",
      sourceFiles: ["main.c"],
      standard: "c23",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
  }, 30_000);

  it("compiles multi-file C project into a real Windows PE executable using Docker", async () => {
    const buildId = "integration-docker-c-multi";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/student.h`, C_STUDENT_H);
    await fs.writeFile(`${dir}/student.c`, C_STUDENT_C);
    await fs.writeFile(`${dir}/main.c`, C_MULTI_MAIN_C);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "c",
      sourceFiles: ["main.c", "student.c"],
      standard: "c17",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
    expect(outcome.artifactSizeBytes).toBeGreaterThan(0);

    const header = await fs.readFile(outcome.artifactPath!, { encoding: null });
    expect(header.subarray(0, 2).toString("ascii")).toBe("MZ");
  }, 30_000);

  it("reports a compile error with a useful diagnostic for invalid C using Docker", async () => {
    const buildId = "integration-docker-c-broken";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.c`, C_BROKEN_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "c",
      sourceFiles: ["main.c"],
      standard: "c17",
    });

    expect(outcome.status).toBe("compile_error");
    expect(outcome.artifactPath).toBeNull();
    expect(outcome.stderr).toMatch(/printff/);
  }, 30_000);

  // --- Rust Language Tests ---
  it("compiles single Rust source (stable) into a real Windows PE executable using Docker", async () => {
    const buildId = "integration-docker-rust-single";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.rs`, RUST_HELLO_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "rust",
      sourceFiles: ["main.rs"],
      standard: "stable",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
    expect(outcome.artifactSizeBytes).toBeGreaterThan(0);

    const header = await fs.readFile(outcome.artifactPath!, { encoding: null });
    expect(header.subarray(0, 2).toString("ascii")).toBe("MZ");
  }, 45_000);

  it("compiles multi-file Rust project into a real Windows PE executable using Docker", async () => {
    const buildId = "integration-docker-rust-multi";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/student.rs`, RUST_STUDENT_RS);
    await fs.writeFile(`${dir}/main.rs`, RUST_MULTI_MAIN_RS);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "rust",
      sourceFiles: ["main.rs", "student.rs"],
      standard: "stable",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
    expect(outcome.artifactSizeBytes).toBeGreaterThan(0);

    const header = await fs.readFile(outcome.artifactPath!, { encoding: null });
    expect(header.subarray(0, 2).toString("ascii")).toBe("MZ");
  }, 45_000);

  it("reports a compile error with a useful diagnostic for invalid Rust using Docker", async () => {
    const buildId = "integration-docker-rust-broken";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.rs`, RUST_BROKEN_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "rust",
      sourceFiles: ["main.rs"],
      standard: "stable",
    });

    expect(outcome.status).toBe("compile_error");
    expect(outcome.artifactPath).toBeNull();
    expect(outcome.stderr).toMatch(/printlln/);
  }, 45_000);

  // --- C++ Regression Tests ---
  it("compiles single C++ source into a real Windows PE executable (C++ regression)", async () => {
    const buildId = "integration-docker-cpp-single";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.cpp`, CPP_HELLO_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "cpp",
      sourceFiles: ["main.cpp"],
      standard: "c++17",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
    expect(outcome.artifactSizeBytes).toBeGreaterThan(0);

    const header = await fs.readFile(outcome.artifactPath!, { encoding: null });
    expect(header.subarray(0, 2).toString("ascii")).toBe("MZ");
  }, 30_000);

  it("compiles multi-file C++ project into a real Windows PE executable (C++ ZIP regression)", async () => {
    const buildId = "integration-docker-cpp-multi";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/Student.h`, STUDENT_H);
    await fs.writeFile(`${dir}/Student.cpp`, STUDENT_CPP);
    await fs.writeFile(`${dir}/main.cpp`, MULTI_MAIN_CPP);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "cpp",
      sourceFiles: ["main.cpp", "Student.cpp"],
      standard: "c++20",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
    expect(outcome.artifactSizeBytes).toBeGreaterThan(0);

    const header = await fs.readFile(outcome.artifactPath!, { encoding: null });
    expect(header.subarray(0, 2).toString("ascii")).toBe("MZ");
  }, 30_000);

  it("reports a compile error with a useful diagnostic for invalid C++ using Docker", async () => {
    const buildId = "integration-docker-cpp-broken";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.cpp`, CPP_BROKEN_SOURCE);

    const outcome = await compileWithDocker({
      buildId,
      workspaceDir: dir,
      language: "cpp",
      sourceFiles: ["main.cpp"],
      standard: "c++17",
    });

    expect(outcome.status).toBe("compile_error");
    expect(outcome.artifactPath).toBeNull();
    expect(outcome.stderr).toMatch(/coutt/);
  }, 30_000);
});

describeIfLinuxNamespace("compileWithNamespaceSandbox (real MinGW-w64 compiler on Linux)", () => {
  const workspaces: string[] = [];

  afterAll(async () => {
    await Promise.all(workspaces.map((dir) => removeWorkspace(dir)));
  });

  it("compiles valid C++ source into a real Windows PE executable", async () => {
    const buildId = "integration-hello";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.cpp`, CPP_HELLO_SOURCE);

    const outcome = await compileWithNamespaceSandbox({
      buildId,
      workspaceDir: dir,
      language: "cpp",
      sourceFiles: ["main.cpp"],
      standard: "c++20",
    });

    expect(outcome.status).toBe("success");
    expect(outcome.artifactPath).toBeTruthy();
    expect(outcome.artifactSizeBytes).toBeGreaterThan(0);

    const header = await fs.readFile(outcome.artifactPath!, { encoding: null });
    expect(header.subarray(0, 2).toString("ascii")).toBe("MZ");
  }, 30_000);

  it("reports a compile error with a useful diagnostic for invalid C++", async () => {
    const buildId = "integration-broken";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    await fs.writeFile(`${dir}/main.cpp`, CPP_BROKEN_SOURCE);

    const outcome = await compileWithNamespaceSandbox({
      buildId,
      workspaceDir: dir,
      language: "cpp",
      sourceFiles: ["main.cpp"],
      standard: "c++20",
    });

    expect(outcome.status).toBe("compile_error");
    expect(outcome.artifactPath).toBeNull();
    expect(outcome.stderr).toMatch(/coutt/);
  }, 30_000);

  it("blocks network access from inside the compiler sandbox", async () => {
    const buildId = "integration-network";
    const dir = await createWorkspace(buildId);
    workspaces.push(dir);
    let networkBlocked = false;
    try {
      execSync(
        'unshare --net --map-root-user bash -c \'curl -s -m 2 -o /dev/null http://example.com\'',
        { stdio: "ignore" },
      );
    } catch {
      networkBlocked = true;
    }
    expect(networkBlocked).toBe(true);
  }, 15_000);
});
