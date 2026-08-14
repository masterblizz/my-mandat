// Lightweight in-memory rate limiter for the AI-powered API routes
// (advisor, news). Fixed-window counter keyed by client IP — no external
// store (Upstash/Vercel KV) is configured in this project, so this is
// per-instance only, which is acceptable for the request volume these
// routes see. If the project later adopts a shared store, swap the
// implementation here without touching call sites.

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.windowStart + windowMs - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

// Client IP is the rate-limit key: these routes are called anonymously
// (no auth session), so IP is the only stable identifier available.
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Periodic sweep so `buckets` doesn't grow unbounded across a long-lived
// server instance — stale entries are harmless but pointless to keep.
const SWEEP_INTERVAL_MS = 5 * 60_000;
const sweepTimer = setInterval(() => {
  const now = Date.now();
  buckets.forEach((bucket, key) => {
    if (now - bucket.windowStart >= SWEEP_INTERVAL_MS) buckets.delete(key);
  });
}, SWEEP_INTERVAL_MS);
sweepTimer.unref?.();
