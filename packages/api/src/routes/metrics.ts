/**
 * Metrics Route
 * Expose Prometheus-compatible metrics endpoint
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMetrics } from '../monitoring/metrics.js';

/**
 * Register metrics routes
 */
export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {

    /**
     * GET /metrics - Prometheus metrics
     */
    app.get('/metrics', {
        schema: {
            tags: ['Monitoring'],
            summary: 'Prometheus metrics',
            description: 'Exposes application metrics in Prometheus format',
            response: {
                200: {
                    type: 'string',
                    description: 'Prometheus text format metrics',
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const metrics = getMetrics();

        reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        return reply.send(metrics.export());
    });

    /**
     * GET /metrics/json - JSON format metrics
     */
    app.get('/metrics/json', {
        schema: {
            tags: ['Monitoring'],
            summary: 'JSON metrics',
            description: 'Exposes application metrics in JSON format',
            response: {
                200: {
                    type: 'object',
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const metrics = getMetrics();

        return reply.send({
            timestamp: new Date().toISOString(),
            metrics: metrics.toJSON(),
        });
    });

    app.log.info('[ROUTES] Metrics routes registered: /metrics');
}
