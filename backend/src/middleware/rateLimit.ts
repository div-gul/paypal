import { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  message?: string;
  countFailuresOnly?: boolean;
  skipAuthenticated?: boolean;
}

const buckets = new Map<string, Bucket>();
let requestsSinceSweep = 0;

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function applyLimit(req: Request, res: Response, next: NextFunction, options: RateLimitOptions, namespace: string): void {
  if (options.skipAuthenticated && req.user) {
    next();
    return;
  }

  const key = `${namespace}:${(options.key || (r => r.user?.id ? `user:${r.user.id}` : `ip:${clientIp(r)}`))(req)}`;
  const now = Date.now();
  if (++requestsSinceSweep >= 1000 || buckets.size > 10_000) {
    requestsSinceSweep = 0;
    for (const [entryKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(entryKey);
  }
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + options.windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= options.max) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: options.message || 'Too many requests. Please try again later.' } });
    return;
  }

  if (options.countFailuresOnly) {
    res.once('finish', () => {
      if (res.statusCode >= 400 && res.statusCode !== 429) bucket!.count++;
    });
  } else {
    bucket.count++;
  }
  next();
}

export function rateLimit(options: RateLimitOptions, namespace: string) {
  return (req: Request, res: Response, next: NextFunction) => applyLimit(req, res, next, options, namespace);
}

export const unauthenticatedApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  key: req => `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`,
  skipAuthenticated: true,
}, 'unauthenticated-api');

export function loginFailureLimit(windowMs: number, max: number, key: (req: Request) => string, namespace: string) {
  return rateLimit({ windowMs, max, key, countFailuresOnly: true, message: 'Too many login attempts. Please try again later.' }, namespace);
}

export function resetRateLimitStore(): void {
  buckets.clear();
  requestsSinceSweep = 0;
}
