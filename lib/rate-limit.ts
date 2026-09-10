// In-memory token-bucket rate limiter. Fine for a single server instance; a fleet needs a
// shared store (Redis) — see docs/architecture.md §7.
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
}

export function checkRateLimit(
  key: string,
  { capacity, refillPerSecond }: RateLimitOptions
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, lastRefill: now };

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

export const RATE_LIMITS = {
  AUTH: { capacity: 10, refillPerSecond: 10 / 60 }, // 10 attempts / minute
  AI: { capacity: 20, refillPerSecond: 20 / 60 }, // 20 AI-backed requests / minute
} as const;
