/**
 * Health Check Routes
 * Provides endpoints for monitoring system health
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkVectorStore, checkDatabaseHealth } from '../infrastructure/database/database-client.js';
import Redis from 'ioredis';
import { getAgentRegistry } from '../services/index.js';

/**
 * Health check response interface
 */
interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
}

/**
 * Deep health check response interface
 */
interface DeepHealthResponse extends HealthResponse {
    checks: {
        supabase: {
            status: 'healthy' | 'unhealthy';
            latency?: number;
            error?: string;
        };
        vectorStore: {
            status: 'healthy' | 'unhealthy';
            tableExists: boolean;
            functionExists: boolean;
            embeddingsCount?: number;
            latency?: number;
            error?: string;
        };
        redis: {
            status: 'healthy' | 'unhealthy';
            latency?: number;
            error?: string;
        };
        agents: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            loaded: number;
            total: number;
        };
    };
}

/**
 * System status response interface
 */
interface StatusResponse {
    name: string;
    version: string;
    environment: string;
    uptime: number;
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    agents: {
        loaded: number;
        capabilities: string[];
    };
}

/**
 * Register health check routes
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
    /**
     * Basic health check
     * Returns 200 if the server is running
     */
    app.get('/health', {
        schema: {
            tags: ['Health'],
            summary: 'Basic health check',
            description: 'Returns 200 if the server is running and accepting requests',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                        version: { type: 'string' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, _reply: FastifyReply): Promise<HealthResponse> => {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '1.0.0',
        };
    });

    /**
     * Deep health check
     * Checks all dependencies (database, Redis, agents)
     */
    app.get('/health/deep', {
        schema: {
            tags: ['Health'],
            summary: 'Deep health check',
            description: 'Performs comprehensive health checks on all system dependencies',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                        version: { type: 'string' },
                        checks: {
                            type: 'object',
                            properties: {
                                supabase: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        latency: { type: 'number' },
                                        error: { type: 'string' },
                                    },
                                },
                                vectorStore: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        tableExists: { type: 'boolean' },
                                        functionExists: { type: 'boolean' },
                                        embeddingsCount: { type: 'number' },
                                        latency: { type: 'number' },
                                        error: { type: 'string' },
                                    },
                                },
                                redis: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        latency: { type: 'number' },
                                        error: { type: 'string' },
                                    },
                                },
                                agents: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        loaded: { type: 'number' },
                                        total: { type: 'number' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, _reply: FastifyReply): Promise<DeepHealthResponse> => {
        // Run all health checks in parallel
        const [dbHealth, vectorStoreCheck, redisCheck, agentsCheck] = await Promise.all([
            checkDatabaseHealth(),
            checkVectorStoreHealth(),
            checkRedis(),
            checkAgents(),
        ]);

        // Determine overall status
        const allHealthy =
            dbHealth.supabase.connected &&
            vectorStoreCheck.status === 'healthy' &&
            redisCheck.status === 'healthy' &&
            agentsCheck.status === 'healthy';

        const anyUnhealthy =
            !dbHealth.supabase.connected ||
            vectorStoreCheck.status === 'unhealthy' ||
            redisCheck.status === 'unhealthy' ||
            agentsCheck.status === 'unhealthy';

        let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (anyUnhealthy) {
            overallStatus = 'unhealthy';
        } else if (!allHealthy) {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '1.0.0',
            checks: {
                supabase: {
                    status: dbHealth.supabase.connected ? 'healthy' : 'unhealthy',
                    latency: dbHealth.supabase.latency,
                    error: dbHealth.supabase.error,
                },
                vectorStore: vectorStoreCheck,
                redis: redisCheck,
                agents: agentsCheck,
            },
        };
    });

    /**
     * System status endpoint
     * Returns detailed system information
     */
    app.get('/status', {
        schema: {
            tags: ['Health'],
            summary: 'System status',
            description: 'Returns detailed information about the system including memory usage and loaded agents',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        version: { type: 'string' },
                        environment: { type: 'string' },
                        uptime: { type: 'number' },
                        memory: {
                            type: 'object',
                            properties: {
                                used: { type: 'number' },
                                total: { type: 'number' },
                                percentage: { type: 'number' },
                            },
                        },
                        agents: {
                            type: 'object',
                            properties: {
                                loaded: { type: 'number' },
                                capabilities: { type: 'array', items: { type: 'string' } },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, _reply: FastifyReply): Promise<StatusResponse> => {
        const memoryUsage = process.memoryUsage();
        const totalMemory = memoryUsage.heapTotal;
        const usedMemory = memoryUsage.heapUsed;

        const registry = getAgentRegistry();
        const summary = registry.getSummary();

        return {
            name: 'Loveable Backend API',
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            memory: {
                used: Math.round(usedMemory / 1024 / 1024), // MB
                total: Math.round(totalMemory / 1024 / 1024), // MB
                percentage: Math.round((usedMemory / totalMemory) * 100),
            },
            agents: {
                loaded: summary.total,
                capabilities: summary.capabilities,
            },
        };
    });

    app.log.info('[ROUTES] Health routes registered: /health, /health/deep, /status');
}

/**
 * Check Vector Store connectivity
 */
async function checkVectorStoreHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    tableExists: boolean;
    functionExists: boolean;
    embeddingsCount?: number;
    latency?: number;
    error?: string;
}> {
    const result = await checkVectorStore();
    return {
        status: result.connected ? 'healthy' : 'unhealthy',
        tableExists: result.tableExists,
        functionExists: result.functionExists,
        embeddingsCount: result.embeddingsCount,
        latency: result.latency,
        error: result.error,
    };
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
        const startTime = Date.now();
        const redis = new Redis(redisUrl, {
            connectTimeout: 5000,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
        });

        await redis.connect();
        await redis.ping();
        const latency = Date.now() - startTime;
        await redis.quit();

        return { status: 'healthy', latency };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { status: 'unhealthy', error: errorMsg };
    }
}

/**
 * Check agent status
 */
async function checkAgents(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; loaded: number; total: number }> {
    try {
        const registry = getAgentRegistry();
        const count = registry.count;

        if (count === 0) {
            return { status: 'unhealthy', loaded: 0, total: 0 };
        } else if (count < 3) {
            return { status: 'degraded', loaded: count, total: count };
        }

        return { status: 'healthy', loaded: count, total: count };
    } catch (error) {
        return { status: 'unhealthy', loaded: 0, total: 0 };
    }
}
