/**
 * CORS Plugin Configuration
 * Configures Cross-Origin Resource Sharing for the API
 */

import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { env, isProduction } from '../config/index.js';

export async function registerCors(app: FastifyInstance): Promise<void> {
    const allowedOrigins = env.CORS_ORIGINS.split(',').map(origin => origin.trim());

    await app.register(cors, {
        origin: isProduction
            ? allowedOrigins
            : true, // Allow all origins in development
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Request-ID',
            'X-API-Key',
        ],
        exposedHeaders: [
            'X-Request-ID',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
        ],
        credentials: true,
        maxAge: 86400, // 24 hours
    });

    app.log.info('[PLUGINS] CORS plugin registered');
}
