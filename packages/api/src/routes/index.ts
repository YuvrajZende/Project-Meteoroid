/**
 * Routes Registration Module
 * Registers all API routes to the Fastify instance
 */

import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.js';
import { registerAgentRoutes } from './agents.js';
import { registerAuthRoutes } from './auth.js';
import { registerTaskRoutes } from './tasks.js';
import { registerProjectRoutes } from './projects.js';
import { registerWebhookRoutes } from './webhooks.js';
import { registerMetricsRoutes } from './metrics.js';
import { registerOrchestratorRoutes } from './orchestrator.js';
import { registerTemplateRoutes } from './templates.js';
import { registerSSERoutes } from './websocket.js';

/**
 * Register all routes to the Fastify instance
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
    app.log.info('[ROUTES] Registering routes...');

    // Health check routes (no auth required)
    await registerHealthRoutes(app);

    // Metrics routes (for Prometheus)
    await registerMetricsRoutes(app);

    // Agent discovery routes
    await registerAgentRoutes(app);

    // Orchestrator routes
    await registerOrchestratorRoutes(app);

    // Template routes
    await registerTemplateRoutes(app);

    // SSE routes for real-time updates
    await registerSSERoutes(app);

    // Authentication routes
    await registerAuthRoutes(app);

    // Task management routes
    await registerTaskRoutes(app);

    // Project management routes
    await registerProjectRoutes(app);

    // External webhook handlers
    await registerWebhookRoutes(app);

    app.log.info('[ROUTES] All routes registered successfully');
}

// Export individual route registrars
export {
    registerHealthRoutes,
    registerAgentRoutes,
    registerAuthRoutes,
    registerTaskRoutes,
    registerProjectRoutes,
    registerWebhookRoutes,
    registerMetricsRoutes,
    registerOrchestratorRoutes,
    registerTemplateRoutes,
    registerSSERoutes,
};
