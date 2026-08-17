import { codeforgeConfig } from "./config";

/**
 * Simple in-memory, single-instance, per-IP fixed-window rate limiter.
 *
 * KNOWN LIMITATION: this resets on server restart and does not coordinate
 * across multiple server instances. That is acceptable for this
 * local-first MVP but would need a shared store (e.g. Redis) before this
 * is exposed as a multi-instance public service.
 */
const buckets = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(clientKey: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(clientKey);

  if (!existing || now - existing.windowStart > codeforgeConfig.rateLimitWindowMs) {
    buckets.set(clientKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= codeforgeConfig.rateLimitMaxBuilds) {
    const retryAfterMs = codeforgeConfig.rateLimitWindowMs - (now - existing.windowStart);
    return { allowed: false, retryAfterMs };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

// Prevent unbounded memory growth from one-off IPs.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of buckets.entries()) {
      if (now - value.windowStart > codeforgeConfig.rateLimitWindowMs * 2) {
        buckets.delete(key);
      }
    }
  },
  10 * 60 * 1000,
).unref();
