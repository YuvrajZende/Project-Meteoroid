/**
 * Orchestrator Routes
 * API endpoints for orchestrator control and agent coordination
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getOrchestrator } from '../services/orchestrator.js';
import { getAgentRegistry } from '../services/agent-registry.js';

// ============================================
// SCHEMAS
// ============================================

const ExecuteTaskSchema = z.object({
    prompt: z.string().min(10).max(5000),
    projectId: z.string().optional(),
    config: z.object({
        thinkingEnabled: z.boolean().optional(),
        monitoringEnabled: z.boolean().optional(),
        correctionEnabled: z.boolean().optional(),
        modelName: z.string().optional(),
    }).optional(),
});

const ThinkAnalysisSchema = z.object({
    task: z.string().min(5),
    context: z.record(z.unknown()).optional(),
});

// ============================================
// ROUTE HANDLERS
// ============================================

/**
 * Register orchestrator routes
 */
export async function registerOrchestratorRoutes(app: FastifyInstance): Promise<void> {

    /**
     * POST /api/v1/orchestrator/execute - Execute orchestration task
     */
    app.post('/api/v1/orchestrator/execute', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Execute orchestration task',
            description: 'Submit a task to the orchestrator for AI-powered code generation',
            body: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: { type: 'string', minLength: 10, maxLength: 5000 },
                    projectId: { type: 'string' },
                    config: {
                        type: 'object',
                        properties: {
                            thinkingEnabled: { type: 'boolean' },
                            monitoringEnabled: { type: 'boolean' },
                            correctionEnabled: { type: 'boolean' },
                            modelName: { type: 'string' },
                        },
                    },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        taskId: { type: 'string' },
                        steps: { type: 'number' },
                        duration: { type: 'number' },
                        agentsExecuted: { type: 'array', items: { type: 'string' } },
                        generatedFiles: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    path: { type: 'string' },
                                    type: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = ExecuteTaskSchema.parse(request.body);
        const orchestrator = getOrchestrator();

        // Generate task ID
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Execute orchestration
        const result = await orchestrator.execute({
            taskId,
            userId: (request as any).user?.id || 'anonymous',
            prompt: body.prompt,
            projectId: body.projectId,
            config: body.config,
        });

        return reply.send(result);
    });

    /**
     * GET /api/v1/orchestrator/status - Get orchestrator status
     */
    app.get('/api/v1/orchestrator/status', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Get orchestrator status',
            description: 'Returns the current status of the orchestrator and connected services',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        initialized: { type: 'boolean' },
                        config: { type: 'object' },
                        services: {
                            type: 'object',
                            properties: {
                                brainCore: { type: 'string' },
                                thinkingEngine: { type: 'string' },
                                contextManager: { type: 'string' },
                                taskManager: { type: 'string' },
                                agentMonitor: { type: 'string' },
                                knowledgeBase: { type: 'string' },
                                mcpHub: { type: 'string' },
                            },
                        },
                        agents: {
                            type: 'object',
                            properties: {
                                total: { type: 'number' },
                                initialized: { type: 'number' },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const orchestrator = getOrchestrator();
        const registry = getAgentRegistry();
        const status = orchestrator.getStatus();
        const summary = registry.getSummary();

        return reply.send({
            ...status,
            services: {
                brainCore: 'available',
                thinkingEngine: 'available',
                contextManager: 'available',
                taskManager: 'available',
                agentMonitor: 'available',
                knowledgeBase: 'available',
                mcpHub: 'available',
            },
            agents: {
                total: summary.total,
                initialized: summary.byStatus['healthy'] || 0,
                byTier: summary.byTier,
            },
        });
    });

    /**
     * GET /api/v1/orchestrator/agents - List connected agents
     */
    app.get('/api/v1/orchestrator/agents', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'List connected agents',
            description: 'Returns all agents connected to the orchestrator',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        agents: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    tier: { type: 'number' },
                                    capabilities: { type: 'array', items: { type: 'string' } },
                                    status: { type: 'string' },
                                },
                            },
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                total: { type: 'number' },
                                byTier: { type: 'object' },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const registry = getAgentRegistry();
        const agents = registry.getAll();
        const summary = registry.getSummary();

        return reply.send({
            agents: agents.map(agent => ({
                id: agent.id,
                name: agent.name,
                tier: agent.tier,
                capabilities: agent.capabilities,
                status: 'ready',
            })),
            summary: {
                total: summary.total,
                byTier: summary.byTier,
                capabilities: summary.capabilities,
            },
        });
    });

    /**
     * POST /api/v1/orchestrator/think - Trigger thinking analysis
     */
    app.post('/api/v1/orchestrator/think', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Trigger thinking analysis',
            description: 'Analyze a task using the thinking engine without executing',
            body: {
                type: 'object',
                required: ['task'],
                properties: {
                    task: { type: 'string', minLength: 5 },
                    context: { type: 'object' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        analysis: {
                            type: 'object',
                            properties: {
                                requirements: { type: 'array', items: { type: 'string' } },
                                suggestedAgents: { type: 'array', items: { type: 'string' } },
                                complexity: { type: 'string' },
                                estimatedSteps: { type: 'number' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = ThinkAnalysisSchema.parse(request.body);
        const registry = getAgentRegistry();

        // Analyze task to determine required agents
        const taskLower = body.task.toLowerCase();
        const suggestedAgents: string[] = [];

        // Match keywords to agents
        const agentKeywords: Record<string, string[]> = {
            'auth-agent': ['auth', 'login', 'jwt', 'session', 'clerk', 'oauth'],
            'security-agent': ['security', 'helmet', 'cors', 'csrf', 'rate limit', 'xss'],
            'monitoring-agent': ['monitoring', 'logging', 'metrics', 'health', 'sentry'],
        };

        for (const [agentId, keywords] of Object.entries(agentKeywords)) {
            if (keywords.some(kw => taskLower.includes(kw))) {
                const agent = registry.getById(agentId);
                if (agent) {
                    suggestedAgents.push(agentId);
                }
            }
        }

        // If no specific match, suggest based on general requirements
        if (suggestedAgents.length === 0) {
            suggestedAgents.push('auth-agent'); // Default
        }

        // Analyze complexity
        const wordCount = body.task.split(' ').length;
        const complexity = wordCount < 20 ? 'simple' : wordCount < 50 ? 'moderate' : 'complex';

        return reply.send({
            analysis: {
                task: body.task,
                requirements: suggestedAgents.map(id => `Requires ${id}`),
                suggestedAgents,
                complexity,
                estimatedSteps: suggestedAgents.length * 3 + 2,
                estimatedDuration: `${suggestedAgents.length * 2 + 1} seconds`,
            },
        });
    });

    /**
     * GET /api/v1/orchestrator/context/:projectId - Get project context
     */
    app.get('/api/v1/orchestrator/context/:projectId', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Get project context',
            description: 'Returns the current context for a project',
            params: {
                type: 'object',
                properties: {
                    projectId: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        context: { type: 'object' },
                        memory: { type: 'array' },
                        lastUpdated: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
        const { projectId } = request.params;

        // Placeholder - would integrate with actual ContextManager
        return reply.send({
            projectId,
            context: {
                name: 'Project Context',
                description: 'Working memory for this project',
            },
            memory: [],
            lastUpdated: new Date().toISOString(),
        });
    });

    /**
     * POST /api/v1/orchestrator/agents/:agentId/execute - Execute specific agent
     */
    app.post('/api/v1/orchestrator/agents/:agentId/execute', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Execute specific agent',
            description: 'Directly execute a specific agent with a task',
            params: {
                type: 'object',
                properties: {
                    agentId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                required: ['task'],
                properties: {
                    task: { type: 'string' },
                    context: { type: 'object' },
                    priority: { type: 'number' },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Params: { agentId: string },
        Body: { task: string; context?: Record<string, unknown>; priority?: number }
    }>, reply: FastifyReply) => {
        const { agentId } = request.params;
        const { task, context, priority } = request.body;

        const registry = getAgentRegistry();
        const agent = registry.getById(agentId);

        if (!agent) {
            return reply.status(404).send({
                error: 'Agent not found',
                message: `No agent with ID '${agentId}' is registered`,
            });
        }

        const startTime = Date.now();

        try {
            const result = await agent.execute({
                task,
                context,
                priority,
                requestId: request.id,
            });

            return reply.send({
                agentId,
                agentName: agent.name,
                executionTime: Date.now() - startTime,
                result,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return reply.status(500).send({
                error: 'Agent execution failed',
                message: errorMessage,
                agentId,
            });
        }
    });

    app.log.info('[ROUTES] Orchestrator routes registered: /api/v1/orchestrator/*');
}
