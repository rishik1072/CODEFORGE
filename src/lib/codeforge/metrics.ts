interface MetricCounts {
  buildsTotal: number;
  buildsSuccess: number;
  buildsCompileError: number;
  buildsTimeout: number;
  buildsSecurityRejected: number;
  buildsCancelled: number;
  buildsInternalError: number;
  totalDurationMs: number;
}

const metrics: MetricCounts = {
  buildsTotal: 0,
  buildsSuccess: 0,
  buildsCompileError: 0,
  buildsTimeout: 0,
  buildsSecurityRejected: 0,
  buildsCancelled: 0,
  buildsInternalError: 0,
  totalDurationMs: 0,
};

export function recordBuildMetric(status: string, durationMs?: number | null) {
  metrics.buildsTotal += 1;
  if (durationMs && durationMs > 0) {
    metrics.totalDurationMs += durationMs;
  }

  switch (status) {
    case "success":
      metrics.buildsSuccess += 1;
      break;
    case "compile_error":
      metrics.buildsCompileError += 1;
      break;
    case "timeout":
      metrics.buildsTimeout += 1;
      break;
    case "security_rejected":
      metrics.buildsSecurityRejected += 1;
      break;
    case "cancelled":
      metrics.buildsCancelled += 1;
      break;
    case "internal_error":
      metrics.buildsInternalError += 1;
      break;
  }
}

export function getInternalMetricsSnapshot() {
  const avgDuration = metrics.buildsTotal > 0 ? Math.round(metrics.totalDurationMs / metrics.buildsTotal) : 0;
  return {
    ...metrics,
    averageDurationMs: avgDuration,
    collectedAt: new Date().toISOString(),
  };
}
