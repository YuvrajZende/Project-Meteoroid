/**
 * Loveable Backend API - Entry Point
 * Production-ready Fastify server for the AI Orchestrator
 */

import { createApp, env, printStartupBanner } from './app.js';
import {
    getAgentRegistry,
    getMultiModelOrchestrator,
    getCostTracker,
    getBenchmarkingService,
    getPreviewService,
    getKeyManager,
    getIntegratedOrchestrator,
    initializeServiceRegistry,
    getConnectionManager,
    getGenerationContext,
} from './services/index.js';
import { initializeAdapters } from './services/adapters/adapter-factory.js';
import { checkSupabaseConnection, checkVectorStore } from './services/database-client.js';
import { flush } from './monitoring/index.js';
import { logger } from './utils/logger.js';
import Redis from 'ioredis';

/**
 * Check Redis connection
 */
async function checkRedisConnection(): Promise<{ connected: boolean; latency?: number }> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        return { connected: false };
    }

    try {
        const redis = new Redis(redisUrl, {
            connectTimeout: 3000,
            lazyConnect: true,
        });

        const start = Date.now();
        await redis.connect();
        await redis.ping();
        const latency = Date.now() - start;
        await redis.quit();

        return { connected: true, latency };
    } catch {
        return { connected: false };
    }
}

/**
 * Bootstrap and start the server
 */
async function bootstrap(): Promise<void> {
    try {
        // Print startup banner and check services
        await printStartupBanner();

        // Create the Fastify application (silent during init)
        const app = await createApp();

        // Graceful shutdown handlers
        const shutdown = async (signal: string) => {
            console.log(`\n  Shutting down (${signal})...`);

            try {
                const costTracker = getCostTracker();
                await costTracker.shutdown();

                const benchmarking = getBenchmarkingService();
                await benchmarking.shutdown();

                const previewService = getPreviewService();
                await previewService.shutdown();

                // Phase 24: Flush generation contexts
                const generationContext = getGenerationContext();
                await generationContext.shutdown();

                await flush(5000);
                await app.close();

                console.log('  Goodbye!\n');
                process.exit(0);
            } catch (error) {
                console.error('  Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            console.error('  Fatal error:', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('  Unhandled rejection:', reason);
            process.exit(1);
        });

        // Start the server
        const address = await app.listen({
            host: env.HOST,
            port: env.PORT,
        });

        // Get service stats
        const registry = getAgentRegistry();
        const summary = registry.getSummary();
        const allAgents = registry.getAll();
        const multiModel = getMultiModelOrchestrator();
        const modelStatus = multiModel.getStatus();
        const costTracker = getCostTracker();
        const budgetStatus = costTracker.getBudgetStatus();
        const keyManager = getKeyManager();
        const keyStats = keyManager.getStats();
        const orchestrator = getIntegratedOrchestrator();
        const orchestratorStatus = orchestrator.getStatus();

        // Agents Section
        logger.section('Agents');
        logger.info('Loaded', `${summary.total} agents`);
        logger.info('Capabilities', `${summary.capabilities.length} total`);

        // List agent names
        const agentNames = allAgents.map((a: { name: string }) => a.name).join(', ');
        logger.info('Active', agentNames || 'None');

        // API Keys Section
        logger.section('API Keys');
        logger.list([
            { label: 'Z.AI', value: `${keyStats.zai?.totalKeys || 0} key(s)`, ok: (keyStats.zai?.totalKeys || 0) > 0 },
            { label: 'Groq', value: process.env.GROQ_API_KEY ? '1 key' : '0 keys', ok: !!process.env.GROQ_API_KEY },
            { label: 'OpenAI', value: `${keyStats.openai?.totalKeys || 0} key(s)`, ok: (keyStats.openai?.totalKeys || 0) > 0 },
            { label: 'Anthropic', value: `${keyStats.anthropic?.totalKeys || 0} key(s)`, ok: (keyStats.anthropic?.totalKeys || 0) > 0 },
        ]);

        // Models Section
        logger.section('AI Models');
        logger.table('Pipeline', [
            {
                key: 'Fast (Analysis)',
                value: `${modelStatus.fastModel.id} via ${modelStatus.fastModel.provider.toUpperCase()}`,
                status: modelStatus.fastModel.configured
            },
            {
                key: 'Power (CodeGen)',
                value: `${modelStatus.powerModel.id} via ${modelStatus.powerModel.provider.toUpperCase()}`,
                status: modelStatus.powerModel.configured
            },
        ]);

        // Budget Section
        logger.section('Budget');
        logger.info('Daily', `$${budgetStatus.daily.limit.toFixed(2)} (${budgetStatus.daily.percentage.toFixed(0)}% used)`);
        logger.info('Monthly', `$${budgetStatus.monthly.limit.toFixed(2)} (${budgetStatus.monthly.percentage.toFixed(0)}% used)`);

        // Infrastructure Section
        logger.section('Infrastructure');

        // Check Database
        const dbStatus = await checkSupabaseConnection();
        logger.status('Database', dbStatus.connected ? `Connected (${dbStatus.latency}ms)` : 'Not connected', dbStatus.connected);

        // Check Vector Store
        const vectorStatus = await checkVectorStore();
        logger.status('Vector Store', vectorStatus.connected ? `Ready (${vectorStatus.embeddingsCount} embeddings)` : 'Not configured', vectorStatus.connected);

        // Check Redis
        const redisStatus = await checkRedisConnection();
        logger.status('Redis', redisStatus.connected ? `Connected (${redisStatus.latency}ms)` : 'Not configured', redisStatus.connected);

        // Services Section
        logger.section('Services');
        const previewEnabled = process.env.PREVIEW_ENABLED !== 'false';
        const deployEnabled = !!(process.env.NETLIFY_AUTH_TOKEN || process.env.VERCEL_TOKEN);

        logger.status('Orchestrator', orchestratorStatus.initialized ? 'Ready' : 'Not initialized', orchestratorStatus.initialized);
        logger.info('Mode', 'Integrated (Real AI)');
        logger.status('Preview', previewEnabled ? 'Enabled' : 'Disabled', previewEnabled);
        logger.status('Auto-Deploy', deployEnabled ? 'Netlify' : 'Disabled', deployEnabled);

        // Phase 21: Service Integration Framework
        const serviceIntegrationEnabled = process.env.SERVICE_INTEGRATION_ENABLED !== 'false';
        if (serviceIntegrationEnabled) {
            try {
                // Initialize service registry and adapters
                const registry = await initializeServiceRegistry();
                await initializeAdapters();
                const registryStats = registry.getStats();
                const allServices = registry.getAllServices();

                logger.section('Service Integration (Phase 21)');
                logger.status('Service Registry', `${registryStats.totalServices} services registered`, registryStats.totalServices > 0);

                // List registered services
                const serviceList = allServices.map(s => s.name).join(', ');
                logger.info('Available', serviceList);

                // Show categories with counts
                const categoryInfo = Object.entries(registryStats.byCategory)
                    .filter(([_, count]) => count > 0)
                    .map(([cat, count]) => `${cat}(${count})`)
                    .join(', ');
                logger.info('Categories', categoryInfo);

                logger.status('Adapters', 'Initialized', true);

                // Get connection manager ready (if DB available)
                if (dbStatus.connected) {
                    getConnectionManager(); // Initialize singleton
                    logger.status('Connection Manager', 'Ready', true);
                } else {
                    logger.status('Connection Manager', 'DB not connected', false);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                logger.status('Service Integration', `Failed: ${errorMsg}`, false);
            }
        } else {
            logger.section('Service Integration (Phase 21)');
            logger.status('Service Registry', 'Disabled via env', false);
        }

        // Routes Section
        logger.section('Endpoints');
        logger.info('API Base', '/api/v1');
        logger.info('Auth', '/api/v1/auth/*');
        logger.info('Orchestrator', '/api/v1/orchestrator/*');
        logger.info('CodeGen', '/api/v1/codegen/*');
        logger.info('Preview', '/api/v1/preview/*');
        logger.info('Services', '/api/v1/services/*');
        logger.info('Connections', '/api/v1/connections/*');
        logger.info('Context', '/api/v1/context/*');

        // Final ready message
        logger.ready(address, `${address}/docs`);

    } catch (error) {
        console.error('\n  Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
bootstrap();
