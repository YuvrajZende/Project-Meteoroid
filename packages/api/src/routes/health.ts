/**
 * Health Check Routes
 * Provides endpoints for monitoring system health
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

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
        database: {
            status: 'healthy' | 'unhealthy';
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
                                database: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
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
        // TODO: Implement actual health checks when services are connected
        const databaseCheck = await checkDatabase();
        const redisCheck = await checkRedis();
        const agentsCheck = await checkAgents();

        // Determine overall status
        const allHealthy =
            databaseCheck.status === 'healthy' &&
            redisCheck.status === 'healthy' &&
            agentsCheck.status === 'healthy';

        const anyUnhealthy =
            databaseCheck.status === 'unhealthy' ||
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
                database: databaseCheck,
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
                loaded: 0, // TODO: Get from agent registry
                capabilities: [], // TODO: Get from agent registry
            },
        };
    });

    app.log.info('[ROUTES] Health routes registered: /health, /health/deep, /status');
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
    // TODO: Implement actual database check with Supabase
    // For now, return a placeholder
    return {
        status: 'healthy',
        latency: 0,
    };
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
    // TODO: Implement actual Redis check
    // For now, return a placeholder
    return {
        status: 'healthy',
        latency: 0,
    };
}

/**
 * Check agent status
 */
async function checkAgents(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; loaded: number; total: number }> {
    // TODO: Implement actual agent check from AgentRegistry
    // For now, return a placeholder
    return {
        status: 'healthy',
        loaded: 0,
        total: 0,
    };
}
