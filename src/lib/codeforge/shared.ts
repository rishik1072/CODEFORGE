// Pure, environment-agnostic constants safe to import from both server
// code and client components (no Node builtins here).

export const SUPPORTED_LANGUAGES = ["cpp", "c", "rust"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  cpp: "C++",
  c: "C",
  rust: "Rust",
};

export const CPP_STANDARDS = ["c++11", "c++14", "c++17", "c++20", "c++23"] as const;
export type CppStandard = (typeof CPP_STANDARDS)[number];

export const C_STANDARDS = ["c11", "c17", "c23"] as const;
export type CStandard = (typeof C_STANDARDS)[number];

export const RUST_TOOLCHAINS = ["stable"] as const;
export type RustToolchain = (typeof RUST_TOOLCHAINS)[number];

export type LanguageStandard = CppStandard | CStandard | RustToolchain;

export const CPP_STANDARD_LABELS: Record<CppStandard, string> = {
  "c++11": "C++11",
  "c++14": "C++14",
  "c++17": "C++17",
  "c++20": "C++20",
  "c++23": "C++23",
};

export const C_STANDARD_LABELS: Record<CStandard, string> = {
  c11: "C11",
  c17: "C17 (Default)",
  c23: "C23",
};

export const RUST_TOOLCHAIN_LABELS: Record<RustToolchain, string> = {
  stable: "Stable (Default)",
};

export const DEFAULT_STANDARD: Record<SupportedLanguage, string> = {
  cpp: "c++20",
  c: "c17",
  rust: "stable",
};

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  if (!value) return false;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function isSupportedStandardForLanguage(language: SupportedLanguage, standard: string): boolean {
  if (language === "cpp") {
    return (CPP_STANDARDS as readonly string[]).includes(standard);
  }
  if (language === "c") {
    return (C_STANDARDS as readonly string[]).includes(standard);
  }
  if (language === "rust") {
    return (RUST_TOOLCHAINS as readonly string[]).includes(standard);
  }
  return false;
}

export function getStandardsForLanguage(language: SupportedLanguage): readonly string[] {
  if (language === "cpp") return CPP_STANDARDS;
  if (language === "c") return C_STANDARDS;
  return RUST_TOOLCHAINS;
}

export function getStandardLabelsForLanguage(language: SupportedLanguage): Record<string, string> {
  if (language === "cpp") return CPP_STANDARD_LABELS;
  if (language === "c") return C_STANDARD_LABELS;
  return RUST_TOOLCHAIN_LABELS;
}

export function getLanguageForFilename(filename: string): SupportedLanguage | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".cpp") || lower.endsWith(".cc") || lower.endsWith(".cxx")) {
    return "cpp";
  }
  if (lower.endsWith(".c")) {
    return "c";
  }
  if (lower.endsWith(".rs")) {
    return "rust";
  }
  return null;
}

// Informational upload limits for UI display
export const DISPLAY_MAX_UPLOAD_KB = 10240; // 10 MB for projects
export const DISPLAY_MAX_SINGLE_FILE_KB = 2048; // 2 MB for single files
