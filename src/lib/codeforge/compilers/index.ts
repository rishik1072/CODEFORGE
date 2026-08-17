import {
  CPP_STANDARDS,
  C_STANDARDS,
  RUST_TOOLCHAINS,
  type CppStandard,
  type CStandard,
  type RustToolchain,
  type SupportedLanguage,
} from "../shared";

/**
 * Interface representing a specific language compiler definition and toolchain.
 */
export interface LanguageCompiler {
  language: SupportedLanguage;
  dockerImage: string;
  compilerBinary: string;
  defaultStandard: string;
  supportedStandards: readonly string[];
  sourceExtensions: readonly string[];
  headerExtensions: readonly string[];
  singleSourceEntrypointName: string;
  buildCompilerArgs(files: string[], standard: string): string[];
}

export class CppCompiler implements LanguageCompiler {
  language: SupportedLanguage = "cpp";
  dockerImage = process.env.CODEFORGE_DOCKER_CPP_IMAGE ?? "codeforge-cpp-windows:latest";
  compilerBinary = "x86_64-w64-mingw32-g++";
  defaultStandard: CppStandard = "c++20";
  supportedStandards = CPP_STANDARDS;
  sourceExtensions = [".cpp", ".cc", ".cxx"] as const;
  headerExtensions = [".h", ".hpp", ".hxx"] as const;
  singleSourceEntrypointName = "main.cpp";

  buildCompilerArgs(files: string[], standard: string): string[] {
    return [
      `-std=${standard}`,
      "-O2",
      "-Wall",
      "-Wextra",
      "-static",
      "-static-libgcc",
      "-static-libstdc++",
      "-I/work",
      "-o",
      "/work/output.exe",
      ...files.map((f) => `/work/${f.replace(/\\/g, "/")}`),
    ];
  }
}

export class CCompiler implements LanguageCompiler {
  language: SupportedLanguage = "c";
  dockerImage = process.env.CODEFORGE_DOCKER_C_IMAGE ?? "codeforge-c-windows:latest";
  compilerBinary = "x86_64-w64-mingw32-gcc";
  defaultStandard: CStandard = "c17";
  supportedStandards = C_STANDARDS;
  sourceExtensions = [".c"] as const;
  headerExtensions = [".h"] as const;
  singleSourceEntrypointName = "main.c";

  buildCompilerArgs(files: string[], standard: string): string[] {
    // Map standard "c23" to GCC 12 "-std=c2x"
    const gccStandard = standard === "c23" ? "c2x" : standard;
    return [
      `-std=${gccStandard}`,
      "-O2",
      "-Wall",
      "-Wextra",
      "-static",
      "-static-libgcc",
      "-I/work",
      "-o",
      "/work/output.exe",
      ...files.map((f) => `/work/${f.replace(/\\/g, "/")}`),
    ];
  }
}

export class RustCompiler implements LanguageCompiler {
  language: SupportedLanguage = "rust";
  dockerImage = process.env.CODEFORGE_DOCKER_RUST_IMAGE ?? "codeforge-rust-windows:latest";
  compilerBinary = "rustc";
  defaultStandard: RustToolchain = "stable";
  supportedStandards = RUST_TOOLCHAINS;
  sourceExtensions = [".rs"] as const;
  headerExtensions = [] as const;
  singleSourceEntrypointName = "main.rs";

  buildCompilerArgs(files: string[], _standard: string): string[] {
    // For Rust, the root entrypoint is compiled and rustc resolves modules.
    const entrypoint = files[0] ?? "main.rs";
    return [
      "--target",
      "x86_64-pc-windows-gnu",
      "-C",
      "opt-level=2",
      "-o",
      "/work/output.exe",
      `/work/${entrypoint.replace(/\\/g, "/")}`,
    ];
  }
}

const compilers: Record<SupportedLanguage, LanguageCompiler> = {
  cpp: new CppCompiler(),
  c: new CCompiler(),
  rust: new RustCompiler(),
};

export class CompilerRegistry {
  static getCompiler(language: SupportedLanguage): LanguageCompiler {
    const compiler = compilers[language];
    if (!compiler) {
      throw new Error(`Unsupported compiler language: ${language}`);
    }
    return compiler;
  }
}
