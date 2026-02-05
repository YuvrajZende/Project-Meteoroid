/**
 * Rate Limiting Plugin Configuration
 * Configures request rate limiting with Redis backend
 * Falls back to in-memory storage if Redis is not available
 */

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/index.js';
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

// Initialize Redis client if configured
async function getRedisStore() {
    if (!env.REDIS_URL) {
        return null;
    }

    if (!redisClient) {
        try {
            redisClient = createClient({
                url: env.REDIS_URL,
                socket: {
                    reconnectStrategy: () => 5000, // Reconnect after 5 seconds
                    connectTimeout: 10000,
                },
            });

            await redisClient.connect();
            return redisClient;
        } catch (error) {
            console.warn('[RATE-LIMIT] Redis connection failed, using in-memory store:', error);
            return null;
        }
    }

    return redisClient;
}

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
    // Try to initialize Redis
    const redis = await getRedisStore();

    await app.register(rateLimit, {
        global: true,
        max: env.RATE_LIMIT_MAX,
        timeWindow: env.RATE_LIMIT_WINDOW_MS,
        store: redis ? 'redis' : undefined,

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

        // Redis store configuration (only if Redis is available)
        redis: redis ? redis : undefined,
    });

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
