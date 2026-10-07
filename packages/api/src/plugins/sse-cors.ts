/**
 * CORS headers for hijacked SSE responses.
 * Hijacked replies bypass @fastify/cors, so streams must set these themselves.
 * Mirrors plugins/cors.ts: any origin in development, CORS_ORIGINS allow-list in production.
 */

import type { FastifyRequest } from 'fastify';
import { env, isProduction } from '../config/index.js';

const allowedOrigins = new Set(
    env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
);

export function isOriginAllowed(origin: string | undefined): origin is string {
    if (!origin) return false;
    return !isProduction || allowedOrigins.has(origin);
}

export function sseCorsHeaders(request: FastifyRequest): Record<string, string> {
    const origin = request.headers.origin;
    if (!isOriginAllowed(origin)) {
        return {};
    }
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
    };
}
