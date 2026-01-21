import { Redis } from 'ioredis';

// Check if Redis is configured (Railway or Upstash)
const isRedisConfigured = () => {
  // Railway Redis
  if (process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL) {
    return true;
  }
  // Upstash Redis (legacy)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  return upstashUrl && !upstashUrl.includes('example');
};

// Get Redis URL (Railway or Upstash)
const getRedisUrl = () => {
  // Railway Redis (preferred)
  if (process.env.REDIS_PRIVATE_URL) {
    return process.env.REDIS_PRIVATE_URL;
  }
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  // Upstash Redis (legacy)
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) {
    return null;
  }
  return url.replace('https://', 'rediss://').replace('.upstash.io', '.upstash.io:6379');
};

// Singleton pattern for Redis connection
const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
};

// Only create Redis client if configured
let redis: Redis | null = null;

if (isRedisConfigured()) {
  const redisUrl = getRedisUrl();
  if (redisUrl) {
    const redisOptions: Record<string, unknown> = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    // Only add password for Upstash (Railway includes it in URL)
    if (process.env.UPSTASH_REDIS_REST_TOKEN && !process.env.REDIS_URL) {
      redisOptions.password = process.env.UPSTASH_REDIS_REST_TOKEN;
    }

    redis = globalForRedis.redis ?? new Redis(redisUrl, redisOptions);

    if (process.env.NODE_ENV !== 'production') {
      globalForRedis.redis = redis;
    }

    console.log('[REDIS] Connected to Redis:', redisUrl.replace(/\/\/.*@/, '//***@'));
  }
}

// Queue names (no colons - BullMQ restriction)
export const QUEUES = {
  GENERATION: 'seetu-generation',
  EXPORT: 'seetu-export',
  BACKGROUND_REMOVAL: 'seetu-background-removal',
} as const;

// Mock queue for development (in-memory)
const devQueue: Record<string, string[]> = {
  [QUEUES.GENERATION]: [],
  [QUEUES.EXPORT]: [],
  [QUEUES.BACKGROUND_REMOVAL]: [],
};

// Queue helpers that work with or without Redis
export async function queuePush(queue: string, data: string): Promise<void> {
  if (redis) {
    await redis.rpush(queue, data);
  } else {
    // Development: store in memory (won't persist)
    devQueue[queue] = devQueue[queue] || [];
    devQueue[queue].push(data);
  }
}

export async function queuePop(queue: string): Promise<string | null> {
  if (redis) {
    return redis.lpop(queue);
  } else {
    const q = devQueue[queue] || [];
    return q.shift() || null;
  }
}

// Cache helpers (noop if no Redis)
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  expiresInSeconds = 3600
): Promise<void> {
  if (!redis) return;
  await redis.setex(key, expiresInSeconds, JSON.stringify(value));
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redis) return;
  await redis.del(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  if (!redis) return;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export { redis, isRedisConfigured };
export default redis;
