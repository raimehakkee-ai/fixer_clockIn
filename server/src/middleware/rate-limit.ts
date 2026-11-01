import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../lib/errors';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  message?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

/**
 * Rate limiter in-memory untuk satu instance API. Untuk deployment multi-instance,
 * ganti dengan penyimpanan bersama (Redis) pada fase deployment.
 */
export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    if (buckets.size > 5_000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(key);
        }
      }
    }

    const key = options.key?.(req) ?? req.ip ?? 'unknown';
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    current.count += 1;

    if (current.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      next(
        new ApiError(
          429,
          'RATE_LIMITED',
          options.message ?? 'Terlalu banyak percobaan. Coba lagi nanti.',
        ),
      );
      return;
    }

    next();
  };
}
