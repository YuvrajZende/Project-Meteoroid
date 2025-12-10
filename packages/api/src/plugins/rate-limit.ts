/**
 * Rate Limiting Plugin Configuration
 * Configures request rate limiting with Redis backend
 */

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/index.js';

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
    await app.register(rateLimit, {
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
        errorResponseBuilder: (request, context) => {
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

        // TODO: Enable Redis store for production
        // redis: new Redis(env.REDIS_URL),
    });

    app.log.info(`✅ Rate limiting registered (${env.RATE_LIMIT_MAX} req/${env.RATE_LIMIT_WINDOW_MS}ms)`);
}
