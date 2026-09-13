import type { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../db/index.js';
import * as schema from '../db/schema.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

interface MemoryCounter {
  count: number;
  windowStartMs: number;
}

const memoryCounters = new Map<string, MemoryCounter>();

function windowStartFor(nowMs: number, windowMs: number): Date {
  const startMs = Math.floor(nowMs / windowMs) * windowMs;
  return new Date(startMs);
}

function memoryKey(tenantId: number, bucket: string, identifier: string, windowStart: Date): string {
  return `${tenantId}:${bucket}:${identifier}:${windowStart.getTime()}`;
}

export async function consumeRateLimit(params: {
  tenantId: number;
  bucket: string;
  limit: number;
  windowMs: number;
  identifier?: string;
}): Promise<RateLimitResult> {
  const identifier = params.identifier ?? 'default';
  const now = Date.now();
  const windowStart = windowStartFor(now, params.windowMs);
  const resetAt = new Date(windowStart.getTime() + params.windowMs);

  if (!isDatabaseConfigured) {
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, remaining: 0, resetAt };
    }
    const key = memoryKey(params.tenantId, params.bucket, identifier, windowStart);
    const current = memoryCounters.get(key) ?? { count: 0, windowStartMs: windowStart.getTime() };
    current.count += 1;
    memoryCounters.set(key, current);
    const allowed = current.count <= params.limit;
    return {
      allowed,
      remaining: Math.max(0, params.limit - current.count),
      resetAt,
    };
  }

  const rows = await db
    .insert(schema.rateLimitCounters)
    .values({
      tenantId: params.tenantId,
      bucket: params.bucket,
      identifier,
      windowStart,
      requestCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.rateLimitCounters.tenantId,
        schema.rateLimitCounters.bucket,
        schema.rateLimitCounters.identifier,
        schema.rateLimitCounters.windowStart,
      ],
      set: {
        requestCount: sql`${schema.rateLimitCounters.requestCount} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ requestCount: schema.rateLimitCounters.requestCount });

  const requestCount = rows[0]?.requestCount ?? 1;
  const allowed = requestCount <= params.limit;
  return {
    allowed,
    remaining: Math.max(0, params.limit - requestCount),
    resetAt,
  };
}

export function createPersistedRateLimiter(options: {
  bucket: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = typeof req.user?.tenantId === 'number' ? req.user.tenantId : 0;
    const identifier = req.ip || 'unknown';

    try {
      const result = await consumeRateLimit({
        tenantId,
        bucket: options.bucket,
        limit: options.limit,
        windowMs: options.windowMs,
        identifier,
      });

      res.setHeader('RateLimit-Limit', String(options.limit));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));

      if (!result.allowed) {
        return res.status(429).json({
          error: options.message ?? 'Rate limit exceeded.',
        });
      }
      return next();
    } catch (error) {
      console.error('[RateLimiter] Persistence error:', error);
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ error: 'Rate limiter unavailable.' });
      }
      return next();
    }
  };
}

/** Test-only reset for in-memory fallback counters. */
export function resetMemoryRateLimitCountersForTests(): void {
  memoryCounters.clear();
}
