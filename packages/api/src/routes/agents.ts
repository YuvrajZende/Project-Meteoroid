/**
 * Agent Routes
 * API endpoints for discovering and querying registered agents
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAgentRegistry } from '../services/agent-registry.js';

/**
 * Agent list response
 */
interface AgentListResponse {
    count: number;
    agents: Array<{
        id: string;
        name: string;
        tier: number;
        capabilities: string[];
        description?: string;
        version?: string;
        status: string;
    }>;
}

/**
 * Agent detail response
 */
interface AgentDetailResponse {
    id: string;
    name: string;
    tier: number;
    capabilities: string[];
    description?: string;
    version?: string;
    status: string;
    loadedAt: string;
    path: string;
}

/**
 * Register agent routes
 */
export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
    const registry = getAgentRegistry();

    /**
     * List all registered agents
     */
    app.get('/api/v1/agents', {
        schema: {
            tags: ['Agents'],
            summary: 'List all registered agents',
            description: 'Returns a list of all agents currently registered with the orchestrator',
            querystring: {
                type: 'object',
                properties: {
                    tier: { type: 'integer', enum: [1, 2, 3], description: 'Filter by tier' },
                    capability: { type: 'string', description: 'Filter by capability' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        count: { type: 'number' },
                        agents: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    tier: { type: 'number' },
                                    capabilities: { type: 'array', items: { type: 'string' } },
                                    description: { type: 'string' },
                                    version: { type: 'string' },
                                    status: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (
        request: FastifyRequest<{ Querystring: { tier?: number; capability?: string } }>,
        _reply: FastifyReply
    ): Promise<AgentListResponse> => {
        const { tier, capability } = request.query;

        let agents = registry.getAllMetadata();

        // Filter by tier if specified
        if (tier !== undefined) {
            agents = agents.filter(a => a.tier === tier);
        }

        // Filter by capability if specified
        if (capability) {
            agents = agents.filter(a => a.capabilities.includes(capability));
        }

        return {
            count: agents.length,
            agents: agents.map(a => ({
                id: a.id,
                name: a.name,
                tier: a.tier,
                capabilities: a.capabilities,
                description: a.description,
                version: a.version,
                status: a.status,
            })),
        };
    });

    /**
     * Get agent details by ID
     */
    app.get('/api/v1/agents/:id', {
        schema: {
            tags: ['Agents'],
            summary: 'Get agent details',
            description: 'Returns detailed information about a specific agent',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Agent ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        tier: { type: 'number' },
                        capabilities: { type: 'array', items: { type: 'string' } },
                        description: { type: 'string' },
                        version: { type: 'string' },
                        status: { type: 'string' },
                        loadedAt: { type: 'string' },
                        path: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ): Promise<AgentDetailResponse | void> => {
        const { id } = request.params;
        const metadata = registry.getMetadata(id);

        if (!metadata) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: `Agent with ID "${id}" not found`,
            });
        }

        return {
            id: metadata.id,
            name: metadata.name,
            tier: metadata.tier,
            capabilities: metadata.capabilities,
            description: metadata.description,
            version: metadata.version,
            status: metadata.status,
            loadedAt: metadata.loadedAt.toISOString(),
            path: metadata.path,
        };
    });

    /**
     * Get agent health by ID
     */
    app.get('/api/v1/agents/:id/health', {
        schema: {
            tags: ['Agents'],
            summary: 'Check agent health',
            description: 'Runs a health check on a specific agent',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Agent ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        agentId: { type: 'string' },
                        healthy: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'object' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        statusCode: { type: 'number' },
                        error: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) => {
        const { id } = request.params;
        const agent = registry.getById(id);

        if (!agent) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: `Agent with ID "${id}" not found`,
            });
        }

        try {
            const healthStatus = await agent.healthCheck();
            registry.updateStatus(id, healthStatus.healthy ? 'healthy' : 'unhealthy');

            return {
                agentId: id,
                healthy: healthStatus.healthy,
                message: healthStatus.message,
                details: healthStatus.details,
            };
        } catch (error) {
            registry.updateStatus(id, 'unhealthy');

            return {
                agentId: id,
                healthy: false,
                message: error instanceof Error ? error.message : 'Health check failed',
                details: {},
            };
        }
    });

    /**
     * Get all capabilities
     */
    app.get('/api/v1/agents/capabilities', {
        schema: {
            tags: ['Agents'],
            summary: 'List all capabilities',
            description: 'Returns a list of all unique capabilities across all registered agents',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        count: { type: 'number' },
                        capabilities: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        },
    }, async (): Promise<{ count: number; capabilities: string[] }> => {
        const capabilities = registry.getAllCapabilities();

        return {
            count: capabilities.length,
            capabilities,
        };
    });

    /**
     * Get agent summary
     */
    app.get('/api/v1/agents/summary', {
        schema: {
            tags: ['Agents'],
            summary: 'Get agent summary',
            description: 'Returns a summary of all registered agents grouped by tier and status',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        byTier: {
                            type: 'object',
                            properties: {
                                tier1: { type: 'number' },
                                tier2: { type: 'number' },
                                tier3: { type: 'number' },
                            },
                        },
                        byStatus: { type: 'object' },
                        capabilities: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        },
    }, async () => {
        return registry.getSummary();
    });

    app.log.info('[ROUTES] Agent routes registered: /api/v1/agents/*');
}
