import fs from "node:fs/promises";
import path from "node:path";
import { SecurityRejectionError } from "./types";
import { CompilerRegistry } from "./compilers";
import type { SupportedLanguage } from "./shared";

export interface DiscoveredProject {
  projectType: "single" | "multi";
  language: SupportedLanguage;
  sourceFiles: string[];
  headerFiles: string[];
  entryPoint: string;
  totalSourceBytes: number;
}

// Conservative regex for detecting C/C++ main entry point
const C_CPP_MAIN_PATTERN = /\bint\s+main\s*\([^)]*\)/;
// Conservative regex for detecting Rust main entry point
const RUST_MAIN_PATTERN = /\bfn\s+main\s*\([^)]*\)/;

// Disallowed dangerous extensions inside extracted project
const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".vbs",
  ".msi",
]);

/**
 * Scans a directory recursively to discover files.
 */
async function scanDir(dir: string, baseDir: string, list: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanDir(fullPath, baseDir, list);
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      list.push(relPath);
    }
  }
}

/**
 * Inspects an extracted project workspace:
 * - Discovers all source and header files matching the requested language
 * - Rejects any dangerous binary or executable script files
 * - Detects the entry point containing main()
 * - Rejects projects without an entry point or with multiple main() functions
 */
export async function inspectProjectWorkspace(
  workspaceDir: string,
  language: SupportedLanguage,
): Promise<DiscoveredProject> {
  const compiler = CompilerRegistry.getCompiler(language);
  const sourceExts = new Set(compiler.sourceExtensions);
  const headerExts = new Set(compiler.headerExtensions);

  const allFiles: string[] = [];
  await scanDir(workspaceDir, workspaceDir, allFiles);

  if (allFiles.length === 0) {
    throw new SecurityRejectionError("Project workspace contains no files.");
  }

  const sourceFiles: string[] = [];
  const headerFiles: string[] = [];
  let totalSourceBytes = 0;

  for (const relPath of allFiles) {
    const ext = path.extname(relPath).toLowerCase();
    const baseName = path.basename(relPath).toLowerCase();

    if (DANGEROUS_EXTENSIONS.has(ext)) {
      throw new SecurityRejectionError(
        `Project contains a disallowed executable or script file ("${relPath}").`,
      );
    }

    if (baseName === "cargo.toml" || baseName === "cargo.lock" || baseName === "build.rs") {
      throw new SecurityRejectionError(
        "Cargo projects and external crate dependencies are not supported in Phase 4B. Only standard-library Rust projects are compiled.",
      );
    }

    if (sourceExts.has(ext as never)) {
      sourceFiles.push(relPath);
      const stat = await fs.stat(path.join(workspaceDir, relPath));
      totalSourceBytes += stat.size;
    } else if (headerExts.has(ext as never)) {
      headerFiles.push(relPath);
      const stat = await fs.stat(path.join(workspaceDir, relPath));
      totalSourceBytes += stat.size;
    }
  }

  // Disallow mixed language projects
  const cppExts = new Set([".cpp", ".cc", ".cxx"]);
  const cExts = new Set([".c"]);
  const rustExts = new Set([".rs"]);
  let hasCpp = false;
  let hasC = false;
  let hasRust = false;

  for (const relPath of allFiles) {
    const ext = path.extname(relPath).toLowerCase();
    if (cppExts.has(ext)) hasCpp = true;
    if (cExts.has(ext)) hasC = true;
    if (rustExts.has(ext)) hasRust = true;
  }

  if (hasCpp && hasC) {
    throw new SecurityRejectionError("Mixed C and C++ projects are not currently supported.");
  }

  const activeLangs = [hasCpp, hasC, hasRust].filter(Boolean).length;
  if (activeLangs > 1) {
    throw new SecurityRejectionError("Mixed language projects are not currently supported.");
  }

  if (sourceFiles.length === 0) {
    const exts = Array.from(sourceExts).join(", ");
    throw new SecurityRejectionError(
      `No ${compiler.language.toUpperCase()} source files (${exts}) were found in the uploaded project.`,
    );
  }

  // Detect main entry point across all discovered source files
  const mainPattern = language === "rust" ? RUST_MAIN_PATTERN : C_CPP_MAIN_PATTERN;
  const entryPoints: string[] = [];

  // For Rust multi-file projects, prioritize src/main.rs or main.rs if present
  if (language === "rust") {
    const srcMain = sourceFiles.find((s) => s === "src/main.rs");
    const rootMain = sourceFiles.find((s) => s === "main.rs");

    for (const src of sourceFiles) {
      const content = await fs.readFile(path.join(workspaceDir, src), "utf-8");
      if (mainPattern.test(content)) {
        entryPoints.push(src);
      }
    }

    if (entryPoints.length === 0) {
      throw new SecurityRejectionError(
        "No Rust entry point was detected. Your project must contain a main.rs with a fn main() function.",
      );
    }

    // If src/main.rs or main.rs contains main(), select it as the primary entry point
    let primaryEntry: string | undefined;
    if (srcMain && entryPoints.includes(srcMain)) {
      primaryEntry = srcMain;
    } else if (rootMain && entryPoints.includes(rootMain)) {
      primaryEntry = rootMain;
    } else if (entryPoints.length === 1) {
      primaryEntry = entryPoints[0];
    } else {
      throw new SecurityRejectionError(
        `Multiple ambiguous Rust entry points were detected: ${entryPoints.join(", ")}. CodeForge requires a single src/main.rs or main.rs entry point.`,
      );
    }

    // Reorder sourceFiles so the primary entry point is first
    const reorderedSources = [primaryEntry, ...sourceFiles.filter((s) => s !== primaryEntry)];

    return {
      projectType: sourceFiles.length > 1 ? "multi" : "single",
      language,
      sourceFiles: reorderedSources,
      headerFiles,
      entryPoint: primaryEntry,
      totalSourceBytes,
    };
  }

  // C / C++ entry point logic
  for (const src of sourceFiles) {
    const content = await fs.readFile(path.join(workspaceDir, src), "utf-8");
    if (mainPattern.test(content)) {
      entryPoints.push(src);
    }
  }

  if (entryPoints.length === 0) {
    throw new SecurityRejectionError(
      `No ${compiler.language.toUpperCase()} entry point was detected. Your project must contain a main() function.`,
    );
  }

  if (entryPoints.length > 1) {
    throw new SecurityRejectionError(
      `Multiple possible main() functions were detected in: ${entryPoints.join(", ")}. CodeForge requires a single executable entry point.`,
    );
  }

  return {
    projectType: sourceFiles.length > 1 ? "multi" : "single",
    language,
    sourceFiles,
    headerFiles,
    entryPoint: entryPoints[0],
    totalSourceBytes,
  };
}
