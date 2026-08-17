import { describe, expect, it } from "vitest";
import { validateProductionStartup } from "@/lib/codeforge/startup-validation";
import { getInternalMetricsSnapshot, recordBuildMetric } from "@/lib/codeforge/metrics";

describe("Phase 9: Production Reliability, Observability & Config Validation", () => {
  it("validates production configuration and detects missing values safely", () => {
    const result = validateProductionStartup(false);
    expect(result).toHaveProperty("valid");
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("accurately increments and tracks internal build metrics", () => {
    const before = getInternalMetricsSnapshot();
    const initialTotal = before.buildsTotal;
    const initialSuccess = before.buildsSuccess;

    recordBuildMetric("success", 1250);

    const after = getInternalMetricsSnapshot();
    expect(after.buildsTotal).toBe(initialTotal + 1);
    expect(after.buildsSuccess).toBe(initialSuccess + 1);
    expect(after.averageDurationMs).toBeGreaterThan(0);
  });

  it("correctly tracks compile_error and timeout metrics", () => {
    const before = getInternalMetricsSnapshot();
    recordBuildMetric("compile_error", 500);
    recordBuildMetric("timeout", 20000);

    const after = getInternalMetricsSnapshot();
    expect(after.buildsCompileError).toBe(before.buildsCompileError + 1);
    expect(after.buildsTimeout).toBe(before.buildsTimeout + 1);
  });
});
