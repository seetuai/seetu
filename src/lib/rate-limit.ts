/**
 * Rate Limiting Utility
 * Uses Redis when available (distributed), falls back to in-memory (single instance).
 */

import { redis } from './redis';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (fallback when Redis is unavailable)
const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60000); // Clean every minute

export interface RateLimitConfig {
  requests: number;    // Max requests
  windowMs: number;    // Time window in ms
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

/**
 * Check rate limit using Redis (atomic INCR + EXPIRE)
 */
async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const count = await redis!.incr(key);
  if (count === 1) {
    await redis!.pexpire(key, config.windowMs);
  }

  if (count > config.requests) {
    const ttl = await redis!.pttl(key);
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + ttl,
      retryAfterMs: ttl,
    };
  }

  return {
    allowed: true,
    remaining: config.requests - count,
    resetAt: Date.now() + config.windowMs,
  };
}

/**
 * Check rate limit using in-memory store (single instance only)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // New entry or expired
  if (!entry || entry.resetAt < now) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: config.requests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Check and consume rate limit.
 * Uses Redis when available, falls back to in-memory.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (redis) {
    try {
      return await checkRateLimitRedis(key, config);
    } catch (err) {
      console.warn('[RATE_LIMIT] Redis error, falling back to in-memory:', err);
      return checkRateLimitMemory(key, config);
    }
  }
  return checkRateLimitMemory(key, config);
}

/**
 * Pre-defined rate limits for different endpoints
 */
export const RATE_LIMITS = {
  // Expensive AI operations (Gemini generation)
  aiGeneration: {
    requests: 10,
    windowMs: 60 * 1000, // 10 per minute
  },

  // Product detection
  detection: {
    requests: 20,
    windowMs: 60 * 1000, // 20 per minute
  },

  // Brand analysis
  brandAnalysis: {
    requests: 5,
    windowMs: 60 * 1000, // 5 per minute
  },

  // File uploads
  upload: {
    requests: 30,
    windowMs: 60 * 1000, // 30 per minute
  },

  // Authentication attempts
  auth: {
    requests: 5,
    windowMs: 15 * 60 * 1000, // 5 per 15 minutes
  },

  // General API
  api: {
    requests: 100,
    windowMs: 60 * 1000, // 100 per minute
  },
} as const;

/**
 * Get rate limit key for a user/endpoint combination
 */
export function getRateLimitKey(
  userId: string | null,
  endpoint: string,
  ip?: string
): string {
  // Use user ID if authenticated, otherwise use IP
  const identifier = userId || ip || 'anonymous';
  return `ratelimit:${endpoint}:${identifier}`;
}

/**
 * Middleware helper - returns error response if rate limited
 */
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.allowed) {
    return null;
  }

  const retryAfterSeconds = Math.ceil((result.retryAfterMs || 0) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}
