import type { Request, Response, NextFunction } from 'express';

/**
 * Strict, focused rate limit for credential endpoints (email sign-in / sign-up)
 * to blunt password brute-forcing and account-enumeration. The global throttler
 * (30/min) is deliberately loose so it does not block session polling that
 * happens on every navigation; this middleware only touches the few POST routes
 * where an attacker hammers passwords.
 *
 * In-memory and per-process — good enough for a single instance. For a multi
 * instance deploy, back this with Redis (see the upgrade roadmap).
 */
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 10;

const GUARDED = [
  '/api/auth/sign-in/email',
  '/api/auth/sign-up/email',
  '/api/auth/forget-password',
  '/api/auth/reset-password',
];

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, WINDOW_MS).unref?.();

function clientIp(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket.remoteAddress || 'unknown';
}

export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST' || !GUARDED.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const now = Date.now();
  const key = `${clientIp(req)}:${req.path}`;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      message: 'Too many attempts. Please wait a few minutes and try again.',
    });
  }

  next();
}
