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
import { registerBenchmarkRoutes } from './benchmarks.js';
import { deploymentRoutes, githubRoutes } from './deployment.js';
import { registerPreviewRoutes } from './preview.js';
import { enhancedCodegenRoutes } from './enhanced-codegen.js';
import { vectorLearningRoutes } from './vector-learning.js';
import { servicesRoutes } from './services/index.js';
import { connectionsRoutes } from './connections/index.js';
import { contextRoutes } from './context.js';
import { phase26Routes } from './phase26.js';

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

    // Authentication routes (Supabase-based)
    await registerAuthRoutes(app);

    // Task management routes
    await registerTaskRoutes(app);

    // Project management routes
    await registerProjectRoutes(app);

    // External webhook handlers
    await registerWebhookRoutes(app);

    // Benchmarking routes
    await registerBenchmarkRoutes(app);

    // Phase 15: Deployment routes
    await deploymentRoutes(app);
    await githubRoutes(app);

    // Phase 16: Preview routes (real-time preview & collaboration)
    await registerPreviewRoutes(app);

    // Phase 17: Enhanced CodeGen routes (multi-language code generation)
    await enhancedCodegenRoutes(app);

    // Phase 18: Vector Store & Learning routes
    await vectorLearningRoutes(app);

    // Phase 21: Service Integration Framework routes
    await app.register(servicesRoutes, { prefix: '/api/v1/services' });
    await app.register(connectionsRoutes, { prefix: '/api/v1/connections' });

    // Phase 24: Context Management routes
    await contextRoutes(app);

    // Phase 26: Project Validation & Dependencies routes
    await phase26Routes(app);

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
    registerBenchmarkRoutes,
    deploymentRoutes,
    githubRoutes,
    registerPreviewRoutes,
    enhancedCodegenRoutes,
    vectorLearningRoutes,
    servicesRoutes,
    connectionsRoutes,
    phase26Routes,
};
