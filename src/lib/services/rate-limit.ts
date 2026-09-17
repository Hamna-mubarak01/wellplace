
type Bucket = { count: number; windowStartedAt: number };

const MAX_TRACKED_KEYS = 10_000;

const buckets = new Map<string, Bucket>();

export type RateLimitVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

function evictIfFull(): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  const toDrop = Math.ceil(MAX_TRACKED_KEYS / 10);
  let dropped = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++dropped >= toDrop) break;
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMinutes: number,
  now: number = Date.now(),
  enabled = true,
): RateLimitVerdict {
  if (!enabled) {
    buckets.delete(key);
    return { allowed: true, remaining: limit };
  }
  const windowMs = windowMinutes * 60_000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    evictIfFull();
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    const elapsed = now - existing.windowStartedAt;
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - elapsed) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count };
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function trackedKeyCount(): number {
  return buckets.size;
}
