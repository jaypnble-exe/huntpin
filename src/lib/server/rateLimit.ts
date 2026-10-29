import "server-only";

export interface RateLimiter {
  tryAcquire(nowMs: number): boolean;
}

/**
 * In-memory sliding-window limiter shared by all callers of one endpoint.
 * This is a single-operator app, so a global window is simpler and stricter
 * than per-client limits. Resets when the server restarts.
 */
export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  let hits: number[] = [];
  return {
    tryAcquire(nowMs) {
      hits = hits.filter((t) => nowMs - t < windowMs);
      if (hits.length >= limit) return false;
      hits.push(nowMs);
      return true;
    },
  };
}
