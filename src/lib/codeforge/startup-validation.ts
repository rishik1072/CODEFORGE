import { codeforgeConfig } from "./config";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates critical environment and security parameters at startup.
 * Throws an error in production if critical requirements are missing or dangerous.
 */
export function validateProductionStartup(isProduction = process.env.NODE_ENV === "production"): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    errors.push("DATABASE_URL is missing. PostgreSQL connection string is required.");
  } else if (isProduction && (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1"))) {
    warnings.push("DATABASE_URL points to localhost/127.0.0.1 in production mode.");
  }

  if (codeforgeConfig.workerConcurrency > 16) {
    errors.push(`Worker concurrency (${codeforgeConfig.workerConcurrency}) exceeds maximum safe limit of 16.`);
  }

  if (codeforgeConfig.cpuTimeSeconds > 60) {
    errors.push(`CPU timeout limit (${codeforgeConfig.cpuTimeSeconds}s) is dangerously high (max 60s).`);
  }

  if (codeforgeConfig.maxProjectExtractedBytes > 100 * 1024 * 1024) {
    errors.push("Project extraction byte limit exceeds maximum safe boundary of 100 MB.");
  }

  const valid = errors.length === 0;

  if (!valid && isProduction) {
    throw new Error(`[CodeForge Startup Aborted] Critical configuration errors:\n${errors.map((e) => ` - ${e}`).join("\n")}`);
  }

  return { valid, errors, warnings };
}
