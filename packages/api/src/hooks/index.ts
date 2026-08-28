/**
 * Hooks Registration Module
 * Registers all Fastify hooks
 */

import type { FastifyInstance } from 'fastify';
import { registerRequestIdHook } from './request-id.js';

/**
 * Register all hooks to the Fastify instance
 */
export function registerHooks(app: FastifyInstance): void {
    app.log.info('[HOOKS] Registering hooks...');

    registerRequestIdHook(app);

    // Request timing hook
    app.addHook('onRequest', async (request) => {
        (request as { startTime?: bigint }).startTime = process.hrtime.bigint();
    });

    app.addHook('onResponse', async (request, reply) => {
        const startTime = (request as { startTime?: bigint }).startTime;
        if (startTime) {
            const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000; // Convert to ms
            app.log.info({
                requestId: request.id,
                method: request.method,
                url: request.url,
                statusCode: reply.statusCode,
                duration: `${duration.toFixed(2)}ms`,
            }, 'Request completed');
        }
    });

    app.log.info('[HOOKS] All hooks registered successfully');
}

export { registerRequestIdHook };
