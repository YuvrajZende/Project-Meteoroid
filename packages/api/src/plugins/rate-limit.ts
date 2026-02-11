/**
 * Rate Limiting Plugin Configuration
 * Configures request rate limiting with Redis backend
 * Falls back to in-memory storage if Redis is not available
 */

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/index.js';
import Redis from 'ioredis';

let redisClient: Redis | null = null;

// Initialize Redis client if configured
async function getRedisClient(): Promise<Redis | null> {
    if (!env.REDIS_URL) {
        return null;
    }

    if (!redisClient) {
        try {
            redisClient = new Redis(env.REDIS_URL, {
                connectTimeout: 10000,
                maxRetriesPerRequest: 1,
                lazyConnect: true,
            });

            await redisClient.connect();
            await redisClient.ping();
            return redisClient;
        } catch (error) {
            console.warn('[RATE-LIMIT] Redis connection failed, using in-memory store:', error);
            redisClient = null;
            return null;
        }
    }

    return redisClient;
}

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
    // Try to initialize Redis
    const redis = await getRedisClient();

    const rateLimitOptions: Parameters<typeof rateLimit>[1] = {
        global: true,
        max: env.RATE_LIMIT_MAX,
        timeWindow: env.RATE_LIMIT_WINDOW_MS,

        // Custom key generator (by IP + User ID if authenticated)
        keyGenerator: (request) => {
            // Use user ID if available, otherwise use IP
            const userId = (request as { userId?: string }).userId;
            const ip = request.ip;
            return userId ? `user:${userId}` : `ip:${ip}`;
        },

        // Rate limit exceeded handler
        errorResponseBuilder: (_request, context) => {
            return {
                statusCode: 429,
                error: 'Too Many Requests',
                message: `Rate limit exceeded. You can make ${context.max} requests per ${context.after}. Please try again later.`,
                retryAfter: context.after,
            };
        },

        // Add rate limit headers to response
        addHeaders: {
            'x-ratelimit-limit': true,
            'x-ratelimit-remaining': true,
            'x-ratelimit-reset': true,
            'retry-after': true,
        },

        // Skip rate limiting for health checks
        allowList: (request) => {
            return request.url === '/health' || request.url === '/';
        },
    };

    // Only attach Redis if connected
    if (redis) {
        (rateLimitOptions as any).redis = redis;
    }

    await app.register(rateLimit, rateLimitOptions);

    const storeType = redis ? 'Redis' : 'in-memory';
    app.log.info(`[PLUGINS] Rate limiting registered (${env.RATE_LIMIT_MAX} req/${env.RATE_LIMIT_WINDOW_MS}ms, store: ${storeType})`);
}

// Cleanup function for graceful shutdown
export async function closeRateLimitRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}
