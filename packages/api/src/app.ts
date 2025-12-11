/**
 * Fastify Application Configuration
 * Creates and configures the Fastify application instance
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { env, isProduction, isDevelopment } from './config/index.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';
import { registerHooks } from './hooks/index.js';
import { registerErrorHandler } from './utils/index.js';
import { registerSecurityMiddleware } from './middleware/index.js';
import {
    registerOrchestrator,
    createAgentLoader,
    getAgentRegistry,
    getKeyManager,
    getIntegratedOrchestrator,
} from './services/index.js';
import { initSentry } from './monitoring/index.js';
import { checkSupabaseConnection, checkVectorStore } from './services/database-client.js';
import path from 'path';
import Redis from 'ioredis';


/**
 * Create and configure the Fastify application
 */
export async function createApp(): Promise<FastifyInstance> {
    // Initialize Sentry for error tracking
    initSentry();

    // Initialize Fastify with configuration
    const app = Fastify({
        // Logger configuration (Pino is built-in)
        logger: {
            level: env.LOG_LEVEL,
            transport: isDevelopment
                ? {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'UTC:yyyy-mm-dd HH:MM:ss',
                        ignore: 'pid,hostname',
                        singleLine: true,
                    },
                }
                : undefined, // Use JSON logging in production
        },

        // Request ID configuration
        requestIdHeader: 'x-request-id',
        genReqId: () => crypto.randomUUID(),

        // Trust proxy for accurate IP detection behind load balancer
        trustProxy: isProduction,

        // Disable default error handler (we use custom)
        disableRequestLogging: false,

        // Body size limits
        bodyLimit: 10 * 1024 * 1024, // 10MB
    });

    // Register error handler first
    registerErrorHandler(app);

    // Register security middleware
    await registerSecurityMiddleware(app);

    // Register hooks
    registerHooks(app);

    // Register plugins
    await registerPlugins(app);

    // Load agents from the agents directory
    await loadAgents(app);

    // Register orchestrator service
    await registerOrchestrator(app);

    // Register routes
    await registerRoutes(app);

    // Root endpoint
    app.get('/', {
        schema: {
            tags: ['Health'],
            summary: 'API Root',
            description: 'Returns basic API information',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        version: { type: 'string' },
                        docs: { type: 'string' },
                        agents: { type: 'number' },
                    },
                },
            },
        },
    }, async () => {
        const registry = getAgentRegistry();
        return {
            name: 'Loveable Backend API',
            version: '1.0.0',
            docs: '/docs',
            agents: registry.count,
        };
    });

    return app;
}

/**
 * Load agents from the agents directory
 */
async function loadAgents(app: FastifyInstance): Promise<void> {
    // Path to agents directory (relative to project root)
    const agentsDir = path.resolve(process.cwd(), '..', '..', 'agents');

    app.log.info(`[AGENTS] Loading from: ${agentsDir}`);

    try {
        const loader = createAgentLoader({
            agentsDir,
            verbose: isDevelopment,
        });

        const result = await loader.loadAllAgents();
        const registry = getAgentRegistry();

        app.log.info(`[AGENTS] Loaded ${result.loaded.length} agents successfully`);

        if (result.failed.length > 0) {
            app.log.warn(`[AGENTS] Failed to load ${result.failed.length} agents`);
        }

        // Log agent summary
        const summary = registry.getSummary();
        app.log.info(`[AGENTS] Tier 1 (Core): ${summary.byTier.tier1}`);
        app.log.info(`[AGENTS] Tier 2 (Specialized): ${summary.byTier.tier2}`);
        app.log.info(`[AGENTS] Tier 3 (Support): ${summary.byTier.tier3}`);
        app.log.info(`[AGENTS] Total capabilities: ${summary.capabilities.length}`);

    } catch (error) {
        app.log.warn(`[AGENTS] Failed to load agents: ${error}`);
        app.log.warn('[AGENTS] Server will continue without agents');
    }
}

/**
 * Check Redis connectivity
 */
export async function checkRedisConnection(): Promise<{ connected: boolean; message: string }> {
    const redisUrl = env.REDIS_URL || 'redis://localhost:6379';

    try {
        const redis = new Redis(redisUrl, {
            connectTimeout: 5000,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
        });

        await redis.connect();
        await redis.ping();
        await redis.quit();

        return { connected: true, message: `Connected to ${redisUrl}` };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { connected: false, message: `Failed to connect: ${errorMsg}` };
    }
}

/**
 * Print startup banner with service status
 */
export async function printStartupBanner(): Promise<void> {
    console.log('');
    console.log('================================================================');
    console.log('');
    console.log('    LOVEABLE BACKEND API SERVER');
    console.log('    Version 1.0.0');
    console.log('    Production-Ready AI-Powered Code Generation');
    console.log('    Mode: INTEGRATED ORCHESTRATOR (Real AI)');
    console.log('');
    console.log('================================================================');
    console.log('');

    // Log key manager status
    const keyManager = getKeyManager();
    const keyStats = keyManager.getStats();

    console.log('[CONFIG] API Keys Configured:');
    console.log(`         - OpenAI:    ${keyStats.openai?.totalKeys || 0} keys`);
    console.log(`         - Anthropic: ${keyStats.anthropic?.totalKeys || 0} keys`);
    console.log(`         - Z.AI:      ${keyStats.zai?.totalKeys || 0} keys`);
    console.log('');

    // Check Supabase Database
    console.log('[DATABASE] Checking Supabase connection...');
    const dbStatus = await checkSupabaseConnection();
    if (dbStatus.connected) {
        console.log(`[DATABASE] ✅ ${dbStatus.message} (${dbStatus.latency}ms)`);
    } else {
        console.log(`[DATABASE] ❌ ${dbStatus.message}`);
        if (dbStatus.error) {
            console.log(`[DATABASE]    Error: ${dbStatus.error}`);
        }
    }

    // Check Vector Store
    console.log('[VECTOR STORE] Checking pgvector...');
    const vectorStatus = await checkVectorStore();
    if (vectorStatus.connected) {
        console.log(`[VECTOR STORE] ✅ ${vectorStatus.message} (${vectorStatus.latency}ms)`);
        console.log(`[VECTOR STORE]    Table: ${vectorStatus.tableExists ? '✓' : '✗'} | Function: ${vectorStatus.functionExists ? '✓' : '✗'}`);
    } else {
        console.log(`[VECTOR STORE] ⚠️ ${vectorStatus.message}`);
        console.log(`[VECTOR STORE]    Table: ${vectorStatus.tableExists ? '✓' : '✗'} | Function: ${vectorStatus.functionExists ? '✗' : '✗'}`);
        if (vectorStatus.error) {
            console.log(`[VECTOR STORE]    Error: ${vectorStatus.error}`);
        }
    }
    console.log('');

    // Check Redis
    const redisStatus = await checkRedisConnection();
    console.log('[REDIS] ' + (redisStatus.connected ? '✅ ' : '⚠️ ') + redisStatus.message);

    // Log orchestrator status
    const orchestrator = getIntegratedOrchestrator();
    const status = orchestrator.getStatus();
    console.log(`[ORCHESTRATOR] Initialized: ${status.initialized}`);
    console.log(`[ORCHESTRATOR] Mode: INTEGRATED (Real AI calls)`);
    console.log('');
}

export { env };
