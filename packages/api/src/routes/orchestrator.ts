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
    getMultiModelOrchestrator,
    type OrchestrationStep,
} from '../services/index.js';
import { getAgentRegistry } from '../services/agent-registry.js';
import { getContextManager, getThinkingEngine } from '../services/core-services.js';
import { getArchitectureBlueprintGenerator } from '../services/architecture-blueprint.js';

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
    /** Context for code generation - language, framework, etc. */
    context: z.object({
        language: z.string().optional(),
        framework: z.string().optional(),
        techStack: z.array(z.string()).optional(),
        existingCode: z.string().optional(),
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
                    context: {
                        type: 'object',
                        description: 'Context for code generation - specify language and framework',
                        properties: {
                            language: { type: 'string', description: 'Programming language (e.g., python, typescript, go)' },
                            framework: { type: 'string', description: 'Framework to use (e.g., flask, fastify, django)' },
                            techStack: { type: 'array', items: { type: 'string' }, description: 'Additional technologies' },
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

        // ============================================
        // PHASE 22: AI-DRIVEN INTELLIGENCE
        // ============================================
        const { getAIIntentAnalyzer, getVectorLearningSystem } = await import('../services/index.js');

        // Use AI to determine intent and best language/framework
        const aiIntent = getAIIntentAnalyzer();
        const intentAnalysis = await aiIntent.analyze(body.prompt, {
            hasExistingProject: !!body.projectId
        });

        app.log.info(`[AI-INTENT] Detected: ${intentAnalysis.intent} | ${intentAnalysis.language}/${intentAnalysis.framework}`);
        app.log.info(`[AI-INTENT] Reasoning: ${intentAnalysis.reasoning} (${(intentAnalysis.confidence * 100).toFixed(0)}% confidence)`);

        // Handle QUESTION intent - don't generate code, just answer
        if (intentAnalysis.intent === 'QUESTION') {
            app.log.info(`[ORCHESTRATOR] Answering question instead of generating code`);

            const aiClient = getAIClient();
            const answer = await aiClient.chat([
                {
                    role: 'system',
                    content: 'You are a helpful backend development expert. Answer the user\'s question clearly and concisely.'
                },
                { role: 'user', content: body.prompt }
            ]);

            // Write answer to file (curl might truncate)
            try {
                const fs = await import('fs/promises');
                const path = await import('path');

                const outputDir = path.join(process.cwd(), 'output');
                await fs.mkdir(outputDir, { recursive: true });

                const answerFile = path.join(outputDir, 'last-question-answer.txt');
                await fs.writeFile(answerFile, `QUESTION:\n${body.prompt}\n\nANSWER:\n${answer}`, 'utf-8');
                app.log.info('[ORCHESTRATOR] ✅ Answer saved to output/last-question-answer.txt');
            } catch (e) {
                // Ignore
            }

            return reply.send({
                success: true,
                taskId,
                projectId,
                intent: intentAnalysis.intent,
                answer,
                isQuestion: true,
                suggestion: 'If you want to generate code, please rephrase as a request (e.g., "Build..." or "Create...")',
            });
        }

        // Use AI-determined language and framework
        const context = body.context || {};
        if (!context.language) {
            context.language = intentAnalysis.language;
            app.log.info(`[AI-INTENT] Auto-selected language: ${context.language}`);
        }
        if (!context.framework) {
            context.framework = intentAnalysis.framework;
            app.log.info(`[AI-INTENT] Auto-selected framework: ${context.framework}`);
        }

        // ============================================
        // PHASE 22: VECTOR-BASED LEARNING
        // ============================================
        let vectorContext = '';
        try {
            const vectorLearning = getVectorLearningSystem();
            const learningContext = await vectorLearning.buildContext(body.prompt, {
                language: context.language,
                framework: context.framework,
                maxCodeExamples: 5,
                maxPractices: 10
            });

            vectorContext = vectorLearning.formatForLLM(learningContext);

            if (vectorContext && vectorContext.length > 50) {
                app.log.info(`[VECTOR-LEARNING] Injected ${learningContext.similarProjects.length} similar projects, ${learningContext.bestPractices.length} best practices`);
                (context as any).vectorLearningContext = vectorContext;
            }
        } catch (error: any) {
            app.log.warn(`[VECTOR-LEARNING] Could not build context: ${error?.message || error}`);
        }

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
                context, // Pass language, framework, techStack (now with auto-detection)
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
            // Phase 22: Include AI intent  analysis and vector learning context
            intentAnalysis: {
                intent: intentAnalysis.intent,
                confidence: intentAnalysis.confidence,
                language: intentAnalysis.language,
                framework: intentAnalysis.framework,
                reasoning: intentAnalysis.reasoning,
            },
            vectorLearningUsed: !!vectorContext,
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

    /**
     * POST /api/v1/orchestrator/blueprint - Generate ASCII Architecture Blueprint (Phase 20)
     * Test the fast model's ASCII diagram generation
     */
    app.post('/api/v1/orchestrator/blueprint', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Generate ASCII Architecture Blueprint',
            description: 'Generate an ASCII art architecture diagram for a backend system based on the prompt',
            body: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: { type: 'string', minLength: 5, maxLength: 5000 },
                    projectName: { type: 'string', default: 'MyProject' },
                    framework: { type: 'string', default: 'fastify' },
                    language: { type: 'string', default: 'typescript' },
                    features: { type: 'array', items: { type: 'string' } },
                    includeAuth: { type: 'boolean', default: true },
                    includeDatabase: { type: 'boolean', default: true },
                    includeMonitoring: { type: 'boolean', default: false },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        blueprint: { type: 'object' },
                        asciiDiagram: { type: 'string' },
                        duration: { type: 'number' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: {
            prompt: string;
            projectName?: string;
            framework?: string;
            language?: string;
            features?: string[];
            includeAuth?: boolean;
            includeDatabase?: boolean;
            includeMonitoring?: boolean;
        }
    }>, reply: FastifyReply) => {
        const {
            prompt,
            projectName = 'MyProject',
            framework = 'fastify',
            language = 'typescript',
            features = [],
            includeAuth = true,
            includeDatabase = true,
            includeMonitoring = false,
        } = request.body;
        const startTime = Date.now();

        try {
            // Extract features from prompt if not provided
            const extractedFeatures = features.length > 0 ? features : extractFeaturesFromPrompt(prompt);

            const blueprintGenerator = getArchitectureBlueprintGenerator();
            const blueprint = blueprintGenerator.generateBlueprint({
                prompt,
                projectName,
                framework,
                language,
                features: extractedFeatures,
                includeAuth,
                includeDatabase,
                includeMonitoring,
            });

            return reply.send({
                success: true,
                blueprint,
                asciiDiagram: blueprint.asciiDiagram,
                duration: Date.now() - startTime,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Blueprint generation failed',
                message: errorMessage,
            });
        }
    });

    /**
     * Helper: Extract features from a natural language prompt
     */
    function extractFeaturesFromPrompt(prompt: string): string[] {
        const features: string[] = [];
        const lowerPrompt = prompt.toLowerCase();

        // Common feature keywords
        const featureKeywords: Record<string, string[]> = {
            'auth': ['auth', 'authentication', 'login', 'signup', 'user'],
            'posts': ['post', 'blog', 'article'],
            'comments': ['comment', 'reply'],
            'products': ['product', 'item', 'catalog'],
            'orders': ['order', 'checkout', 'cart'],
            'payments': ['payment', 'stripe', 'billing'],
            'notifications': ['notification', 'alert', 'email'],
            'monitoring': ['monitor', 'metrics', 'logging'],
        };

        for (const [feature, keywords] of Object.entries(featureKeywords)) {
            if (keywords.some(kw => lowerPrompt.includes(kw))) {
                features.push(feature);
            }
        }

        return features.length > 0 ? features : ['auth'];
    }

    /**
     * POST /api/v1/orchestrator/generate - Full Multi-Model Pipeline (Phase 20)
     * Uses fast model for analysis + blueprint, then power model for code generation
     */
    app.post('/api/v1/orchestrator/generate', {
        schema: {
            tags: ['Orchestrator'],
            summary: 'Full Multi-Model Code Generation',
            description: 'Execute the full two-stage pipeline: Fast model (analysis + blueprint) → Power model (code generation)',
            body: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: { type: 'string', minLength: 10, maxLength: 5000 },
                    taskId: { type: 'string' },
                    projectId: { type: 'string' },
                    context: {
                        type: 'object',
                        properties: {
                            techStack: { type: 'array', items: { type: 'string' } },
                            framework: { type: 'string' },
                            language: { type: 'string' },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: {
            prompt: string;
            taskId?: string;
            projectId?: string;
            context?: { techStack?: string[]; framework?: string; language?: string };
        }
    }>, reply: FastifyReply) => {
        const { prompt, taskId, projectId, context } = request.body;

        try {
            const multiModel = getMultiModelOrchestrator();
            await multiModel.initialize();

            const result = await multiModel.execute({
                prompt,
                taskId: taskId || `task-${Date.now()}`,
                projectId: projectId || `project-${Date.now()}`,
                context,
            });

            return reply.send({
                success: result.success,
                code: result.code,
                explanation: result.explanation,
                files: result.files,
                architectureDiagram: result.architectureDiagram,
                contextAnalysis: result.contextAnalysis,
                costs: {
                    analysis: result.analysisCost,
                    generation: result.generationCost,
                    total: result.totalCost,
                },
                timing: {
                    analysis: result.analysisTime,
                    generation: result.generationTime,
                    total: result.totalTime,
                },
                models: {
                    analysis: result.analysisModel,
                    generation: result.generationModel,
                },
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Multi-model generation failed',
                message: errorMessage,
            });
        }
    });

    /**
     * GET /api/v1/orchestrator/learning/stats - Get AI Learning Statistics
     * Check how many iterations, patterns, and embeddings have been stored
     */
    app.get('/api/v1/orchestrator/learning/stats', {
        schema: {
            tags: ['Orchestrator', 'Learning'],
            summary: 'Get AI Learning Statistics',
            description: 'Retrieve statistics about stored learning data including iterations, patterns, embeddings, and success rates',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        learning: {
                            type: 'object',
                            properties: {
                                totalIterations: { type: 'number' },
                                successfulIterations: { type: 'number' },
                                failedIterations: { type: 'number' },
                                patternsLearned: { type: 'number' },
                                successRate: { type: 'number' },
                                testIterations: { type: 'number' },
                            },
                        },
                        database: {
                            type: 'object',
                            properties: {
                                generationIterations: { type: 'number' },
                                codeEmbeddings: { type: 'number' },
                                knowledgeEmbeddings: { type: 'number' },
                                learnedPatterns: { type: 'number' },
                                testingIterations: { type: 'number' },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Import learning service
            const { getLearningService } = await import('../services/learning-service.js');
            const { getSupabaseAdmin } = await import('../services/database-client.js');

            const learningService = getLearningService();
            await learningService.initialize();

            // Get in-memory stats
            const memoryStats = learningService.getStatistics();

            // Get database counts
            const supabase = getSupabaseAdmin();
            let dbStats = {
                generationIterations: 0,
                codeEmbeddings: 0,
                knowledgeEmbeddings: 0,
                learnedPatterns: 0,
                testingIterations: 0,
            };

            if (supabase) {
                try {
                    const [genIter, codeEmbed, knowledgeEmbed, patterns, testIter] = await Promise.all([
                        supabase.from('generation_iterations').select('id', { count: 'exact', head: true }),
                        supabase.from('code_embeddings').select('id', { count: 'exact', head: true }),
                        supabase.from('knowledge_embeddings').select('id', { count: 'exact', head: true }),
                        supabase.from('learned_patterns').select('id', { count: 'exact', head: true }),
                        supabase.from('testing_iterations').select('id', { count: 'exact', head: true }),
                    ]);

                    dbStats = {
                        generationIterations: genIter.count || 0,
                        codeEmbeddings: codeEmbed.count || 0,
                        knowledgeEmbeddings: knowledgeEmbed.count || 0,
                        learnedPatterns: patterns.count || 0,
                        testingIterations: testIter.count || 0,
                    };
                } catch (dbError) {
                    console.warn('[LEARNING] Failed to get database counts:', dbError);
                }
            }

            return reply.send({
                success: true,
                learning: {
                    totalIterations: memoryStats.totalIterations,
                    successfulIterations: memoryStats.successfulIterations,
                    failedIterations: memoryStats.failedIterations,
                    patternsLearned: memoryStats.patternsLearned,
                    successRate: Math.round(memoryStats.successRate * 100) / 100,
                    testIterations: memoryStats.testIterations,
                },
                database: dbStats,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Failed to get learning statistics',
                message: errorMessage,
            });
        }
    });

    /**
     * GET /api/v1/orchestrator/learning/patterns - Get Learned Patterns
     * Retrieve patterns learned from successful and failed generations
     */
    app.get('/api/v1/orchestrator/learning/patterns', {
        schema: {
            tags: ['Orchestrator', 'Learning'],
            summary: 'Get Learned Patterns',
            description: 'Retrieve all patterns learned from past code generations',
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { getLearningService } = await import('../services/learning-service.js');
            const learningService = getLearningService();
            await learningService.initialize();

            const patterns = learningService.getPatterns();

            return reply.send({
                success: true,
                count: patterns.length,
                patterns: patterns.map(p => ({
                    type: p.patternType,
                    description: p.description,
                    example: p.example.slice(0, 200),
                    context: p.context.slice(0, 100),
                    frequency: p.frequency,
                    confidence: p.confidence,
                })),
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Failed to get patterns',
                message: errorMessage,
            });
        }
    });

    app.log.info('[ROUTES] Orchestrator routes registered: /api/v1/orchestrator/* (INTEGRATED MODE)');
}
