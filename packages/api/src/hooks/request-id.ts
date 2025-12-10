/**
 * Request ID Hook
 * Adds a unique request ID to each request for tracing
 */

import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';

/**
 * Register request ID hook
 * Generates or uses existing X-Request-ID header
 */
export function registerRequestIdHook(app: FastifyInstance): void {
    app.addHook('onRequest', async (request, reply) => {
        // Use existing request ID from header or generate new one
        const requestId = request.headers['x-request-id'] as string || randomUUID();

        // Attach request ID to the request for logging
        request.id = requestId;

        // Add request ID to response headers
        void reply.header('x-request-id', requestId);
    });

    app.log.info('[HOOKS] Request ID hook registered');
}
