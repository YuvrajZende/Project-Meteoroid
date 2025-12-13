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
} from './services/index.js';
import { initSentry } from './monitoring/index.js';
import { logger } from './utils/logger.js';
import path from 'path';
import Redis from 'ioredis';


/**
 * Create and configure the Fastify application
 */
export async function createApp(): Promise<FastifyInstance> {
    // Initialize Sentry for error tracking
    initSentry();

    // Initialize Fastify with configuration - QUIET logger during startup
    const app = Fastify({
        logger: {
            level: 'warn', // Only warn and error during startup
            transport: isDevelopment
                ? {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'HH:MM:ss',
                        ignore: 'pid,hostname',
                        singleLine: true,
                    },
                }
                : undefined,
        },
        requestIdHeader: 'x-request-id',
        genReqId: () => crypto.randomUUID(),
        trustProxy: isProduction,
        disableRequestLogging: true, // Disable noisy request logs during startup
        bodyLimit: 10 * 1024 * 1024,
    });

    // Register core components silently
    registerErrorHandler(app);
    await registerSecurityMiddleware(app);
    registerHooks(app);
    await registerPlugins(app);
    await loadAgents(app);
    await registerOrchestrator(app);
    await registerRoutes(app);

    // Root endpoint
    app.get('/', {
        schema: {
            tags: ['Health'],
            summary: 'API Root',
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

    // Re-enable full logging after startup
    app.log.level = env.LOG_LEVEL;

    return app;
}

/**
 * Load agents from the agents directory (silent mode)
 */
async function loadAgents(app: FastifyInstance): Promise<void> {
    const agentsDir = path.resolve(process.cwd(), '..', '..', 'agents');

    try {
        const loader = createAgentLoader({
            agentsDir,
            verbose: false, // Keep agent loading quiet
        });

        await loader.loadAllAgents();
    } catch (error) {
        // Will be reported in the summary
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

        return { connected: true, message: 'Connected' };
    } catch {
        return { connected: false, message: 'Not available' };
    }
}

/**
 * Print startup status and check services
 */
export async function printStartupBanner(): Promise<void> {
    logger.resetTimer();

    // Print main banner only - detailed sections printed after server starts
    logger.banner('1.0.0');
}

export { env };
