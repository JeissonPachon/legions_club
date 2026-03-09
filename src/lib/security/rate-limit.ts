import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

type RateLimitWindow = `${number} s` | `${number} m` | `${number} h`;

type RateLimitRule = {
  keyPrefix: string;
  limit: number;
  window: RateLimitWindow;
};

type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const globalForRateLimit = globalThis as unknown as {
  upstashRedis?: Redis;
  ratelimiters?: Map<string, Ratelimit>;
};

function getRedisClient() {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!globalForRateLimit.upstashRedis) {
    globalForRateLimit.upstashRedis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return globalForRateLimit.upstashRedis;
}

function getLimiter(rule: RateLimitRule) {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const id = `${rule.keyPrefix}:${rule.limit}:${rule.window}`;
  if (!globalForRateLimit.ratelimiters) {
    globalForRateLimit.ratelimiters = new Map<string, Ratelimit>();
  }

  const existing = globalForRateLimit.ratelimiters.get(id);
  if (existing) {
    return existing;
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
    prefix: `legions:${rule.keyPrefix}`,
  });

  globalForRateLimit.ratelimiters.set(id, limiter);
  return limiter;
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitDecision> {
  const limiter = getLimiter(rule);
  if (!limiter) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  try {
    const result = await limiter.limit(identifier);
    if (result.success) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
    };
  } catch {
    // Fail open to avoid auth outages if Redis has an incident.
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
