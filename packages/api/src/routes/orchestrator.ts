/**
 * Orchestrator Routes
 * API endpoints for REAL AI-powered orchestration
 * Uses IntegratedOrchestrator (not demo mode)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
    getIntegratedOrchestrator,
    getAIClient,
    type OrchestrationStep,
} from '../services/index.js';
import { getAgentRegistry } from '../services/agent-registry.js';
import { getContextManager, getThinkingEngine } from '../services/core-services.js';

// ============================================
// SCHEMAS
// ============================================

const ExecuteTaskSchema = z.object({
    prompt: z.string().min(10).max(5000),
    projectId: z.string().optional(),
    userId: z.string().optional(),
    config: z.object({
        useAIThinking: z.boolean().optional(),
        useContextManager: z.boolean().optional(),
        useAgentMonitor: z.boolean().optional(),
        useMCPHub: z.boolean().optional(),
        maxSubtasks: z.number().min(1).max(10).optional(),
    }).optional(),
});

const ChatSchema = z.object({
    message: z.string().min(1).max(5000),
    systemPrompt: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(8000).optional(),
});

const ThinkAnalysisSchema = z.object({
    task: z.string().min(5),
    useAI: z.boolean().optional(),
});

// ============================================
// ROUTE HANDLERS
// ============================================

/**
 * Register orchestrator routes
 */
export async function registerOrchestratorRoutes(app: FastifyInstance): Promise<void> {

    // Initialize the orchestrator at startup
    const orchestrator = getIntegratedOrchestrator();
    await orchestrator.initialize();

    /**
     * POST /api/v1/orchestrator/execute - Execute REAL AI orchestration
     */
    app.post('/api/v1/orchestrator/execute', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Execute AI-powered orchestration',
            description: 'Submit a task to the REAL orchestrator for AI-powered code generation using all core services',
            body: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: { type: 'string', minLength: 10, maxLength: 5000 },
                    projectId: { type: 'string' },
                    userId: { type: 'string' },
                    config: {
                        type: 'object',
                        properties: {
                            useAIThinking: { type: 'boolean', default: true },
                            useContextManager: { type: 'boolean', default: true },
                            useAgentMonitor: { type: 'boolean', default: true },
                            useMCPHub: { type: 'boolean', default: true },
                            maxSubtasks: { type: 'number', default: 3 },
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
                        projectId: { type: 'string' },
                        totalDuration: { type: 'number' },
                        steps: { type: 'number' },
                        agentsExecuted: { type: 'array', items: { type: 'string' } },
                        generatedCode: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    subtask: { type: 'string' },
                                    code: { type: 'string' },
                                    explanation: { type: 'string' },
                                    agent: { type: 'string' },
                                },
                            },
                        },
                        taskAnalysis: { type: 'object' },
                        errors: { type: 'array', items: { type: 'string' } },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = ExecuteTaskSchema.parse(request.body);

        // Generate task ID
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const projectId = body.projectId || `project-${Date.now()}`;
        const userId = body.userId || (request as any).user?.id || 'anonymous';

        app.log.info(`[ORCHESTRATOR] Executing task: ${taskId}`);
        app.log.info(`[ORCHESTRATOR] Prompt: ${body.prompt.substring(0, 100)}...`);

        // Progress tracking for SSE (future)
        const progressSteps: OrchestrationStep[] = [];

        // Execute REAL orchestration
        const result = await orchestrator.orchestrate(
            {
                taskId,
                userId,
                projectId,
                prompt: body.prompt,
                config: body.config,
            },
            (step) => {
                progressSteps.push(step);
                app.log.info(`[STEP ${step.stepNumber}] ${step.phase}: ${step.message}`);
            }
        );

        app.log.info(`[ORCHESTRATOR] Task ${taskId} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);

        return reply.send({
            success: result.success,
            taskId: result.taskId,
            projectId: result.projectId,
            totalDuration: result.totalDuration,
            steps: result.steps.length,
            agentsExecuted: result.agentsExecuted,
            generatedCode: result.generatedCode,
            taskAnalysis: result.taskAnalysis,
            aiAnalysis: result.aiAnalysis,
            thinkingTraces: result.thinkingTraces,
            errors: result.errors,
        });
    });

    /**
     * POST /api/v1/orchestrator/chat - Direct AI chat
     */
    app.post('/api/v1/orchestrator/chat', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Direct AI Chat',
            description: 'Send a message directly to the AI without full orchestration',
            body: {
                type: 'object',
                required: ['message'],
                properties: {
                    message: { type: 'string', minLength: 1, maxLength: 5000 },
                    systemPrompt: { type: 'string' },
                    temperature: { type: 'number' },
                    maxTokens: { type: 'number' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        response: { type: 'string' },
                        model: { type: 'string' },
                        duration: { type: 'number' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = ChatSchema.parse(request.body);
        const aiClient = getAIClient();
        const config = aiClient.getConfig();

        const startTime = Date.now();

        const response = await aiClient.chat(
            [
                { role: 'system', content: body.systemPrompt || 'You are a helpful coding assistant.' },
                { role: 'user', content: body.message },
            ],
            {
                temperature: body.temperature,
                maxTokens: body.maxTokens,
            }
        );

        return reply.send({
            response,
            model: config.model,
            duration: Date.now() - startTime,
        });
    });

    /**
     * GET /api/v1/orchestrator/status - Get orchestrator status
     */
    app.get('/api/v1/orchestrator/status', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Get orchestrator status',
            description: 'Returns the current status of the REAL orchestrator and all connected services',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        initialized: { type: 'boolean' },
                        mode: { type: 'string' },
                        config: { type: 'object' },
                        services: { type: 'object' },
                        agents: { type: 'object' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const status = orchestrator.getStatus();
        const services = orchestrator.getServices();
        const registry = getAgentRegistry();
        const summary = registry.getSummary();
        const aiConfig = services.aiClient.getConfig();

        return reply.send({
            initialized: status.initialized,
            mode: 'INTEGRATED', // Not demo mode!
            config: status.config,
            services: {
                aiClient: {
                    status: 'connected',
                    model: aiConfig.model,
                    baseUrl: aiConfig.baseUrl,
                },
                thinkingEngine: 'available',
                contextManager: 'available',
                agentMonitor: 'available',
                mcpHub: 'available',
            },
            agents: {
                total: summary.total,
                byTier: summary.byTier,
                statuses: status.agentStatuses,
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
                        agents: { type: 'array' },
                        summary: { type: 'object' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const registry = getAgentRegistry();
        const agents = registry.getAll();
        const summary = registry.getSummary();
        const status = orchestrator.getStatus();

        // Merge agent registry with monitor status
        const agentStatusMap = new Map(status.agentStatuses.map(s => [s.agentId, s]));

        return reply.send({
            agents: agents.map(agent => ({
                id: agent.id,
                name: agent.name,
                tier: agent.tier,
                capabilities: agent.capabilities,
                status: agentStatusMap.get(agent.id)?.status || 'idle',
                lastExecution: agentStatusMap.get(agent.id)?.lastExecution,
            })),
            summary: {
                total: summary.total,
                byTier: summary.byTier,
                capabilities: summary.capabilities,
            },
        });
    });

    /**
     * POST /api/v1/orchestrator/think - Trigger thinking analysis (local + AI)
     */
    app.post('/api/v1/orchestrator/think', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Analyze task with thinking engine',
            description: 'Analyze a task using both local ThinkingEngine and optional AI analysis',
            body: {
                type: 'object',
                required: ['task'],
                properties: {
                    task: { type: 'string', minLength: 5 },
                    useAI: { type: 'boolean', default: true },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        localAnalysis: { type: 'object' },
                        aiAnalysis: { type: 'object' },
                        thinkingTraces: { type: 'array' },
                        duration: { type: 'number' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = ThinkAnalysisSchema.parse(request.body);
        const thinkingEngine = getThinkingEngine();
        const aiClient = getAIClient();

        const startTime = Date.now();
        thinkingEngine.clearTraces();

        // Local analysis
        const localAnalysis = await thinkingEngine.analyzeTask(body.task);

        // AI analysis if requested
        let aiAnalysis = null;
        if (body.useAI !== false) {
            try {
                aiAnalysis = await aiClient.analyzeTask(body.task);
            } catch (error) {
                app.log.warn(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
        }

        return reply.send({
            localAnalysis: {
                complexity: localAnalysis.complexity,
                requirements: localAnalysis.requirements,
                suggestedAgents: localAnalysis.suggestedAgents,
                estimatedSteps: localAnalysis.estimatedSteps,
                subTasks: localAnalysis.subTasks,
            },
            aiAnalysis: aiAnalysis ? {
                complexity: aiAnalysis.complexity,
                subtasks: aiAnalysis.subtasks,
                suggestedAgents: aiAnalysis.suggestedAgents,
                estimatedSteps: aiAnalysis.estimatedSteps,
            } : null,
            thinkingTraces: thinkingEngine.getTraces(),
            duration: Date.now() - startTime,
        });
    });

    /**
     * GET /api/v1/orchestrator/context/:projectId - Get project context
     */
    app.get('/api/v1/orchestrator/context/:projectId', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Get project context',
            description: 'Returns the current context window for a project',
            params: {
                type: 'object',
                properties: {
                    projectId: { type: 'string' },
                },
            },
            querystring: {
                type: 'object',
                properties: {
                    userId: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        projectId: { type: 'string' },
                        userId: { type: 'string' },
                        projectContext: { type: 'object' },
                        conversationHistory: { type: 'array' },
                        lastUpdated: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Params: { projectId: string },
        Querystring: { userId?: string }
    }>, reply: FastifyReply) => {
        const { projectId } = request.params;
        const userId = request.query.userId || (request as any).user?.id || 'anonymous';
        const contextManager = getContextManager();

        const context = contextManager.getContext(projectId, userId);

        return reply.send({
            projectId: context.projectId,
            userId: context.userId,
            projectContext: context.projectContext,
            conversationHistory: context.conversationHistory,
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

    app.log.info('[ROUTES] Orchestrator routes registered: /api/v1/orchestrator/* (INTEGRATED MODE)');
}
