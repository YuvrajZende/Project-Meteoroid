/**
 * Orchestrator Integration
 * Connects the LangGraph orchestrator and agents to the API server
 */

import type { FastifyInstance } from 'fastify';

// Import orchestrator components
// Note: These imports will work once the orchestrator package is properly built
// Placeholder types until proper import

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
    /** Enable thinking mode */
    thinkingEnabled?: boolean;
    /** Enable real-time monitoring */
    monitoringEnabled?: boolean;
    /** Enable auto-correction */
    correctionEnabled?: boolean;
    /** Recursion limit for graph execution */
    recursionLimit?: number;
    /** Model name to use */
    modelName?: string;
}

/**
 * Orchestrator execution context
 */
export interface ExecutionContext {
    taskId: string;
    userId: string;
    prompt: string;
    projectId?: string;
    config?: OrchestratorConfig;
}

/**
 * Orchestrator execution result
 */
export interface ExecutionResult {
    success: boolean;
    taskId: string;
    steps: number;
    duration: number;
    agentsExecuted: string[];
    generatedFiles: Array<{
        path: string;
        content: string;
        type: string;
    }>;
    thinking?: {
        traces: number;
        confidence: number;
    };
    error?: string;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: {
    step: number;
    stage: string;
    agent?: string;
    message: string;
    progress: number;
}) => void;

/**
 * OrchestratorService - Bridge between API and Orchestrator
 */
export class OrchestratorService {
    private config: Required<OrchestratorConfig>;
    private isInitialized = false;

    constructor(config: OrchestratorConfig = {}) {
        this.config = {
            thinkingEnabled: config.thinkingEnabled ?? true,
            monitoringEnabled: config.monitoringEnabled ?? true,
            correctionEnabled: config.correctionEnabled ?? true,
            recursionLimit: config.recursionLimit ?? 50,
            modelName: config.modelName || process.env.MODEL_NAME || 'gpt-4o-mini',
        };
    }

    /**
     * Initialize the orchestrator
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Check for API key (warn but don't crash)
        const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEYS?.split(',')[0];
        const hasValidKey = apiKey && apiKey !== 'your_key_here' && apiKey.length > 10;

        console.log('[ORCHESTRATOR] Initializing Orchestrator Service...');
        console.log(`   Model: ${this.config.modelName}`);
        console.log(`   Thinking: ${this.config.thinkingEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   Monitoring: ${this.config.monitoringEnabled ? 'ENABLED' : 'DISABLED'}`);

        if (!hasValidKey) {
            console.log('[ORCHESTRATOR] No AI API key configured - running in DEMO mode');
            console.log('[ORCHESTRATOR] Set OPENAI_API_KEY in .env for full functionality');
        } else {
            console.log('[ORCHESTRATOR] AI API key configured');
        }

        // TODO: Import and initialize the actual LangGraph orchestrator
        // const { graph } = await import('@loveable/orchestrator');

        this.isInitialized = true;
        console.log('[ORCHESTRATOR] Service initialized');
    }

    /**
     * Execute a generation task
     */
    async execute(
        context: ExecutionContext,
        onProgress?: ProgressCallback
    ): Promise<ExecutionResult> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const agentsExecuted: string[] = [];
        const generatedFiles: ExecutionResult['generatedFiles'] = [];
        let stepCount = 0;

        console.log(`\n[ORCHESTRATOR] Starting orchestration for task: ${context.taskId}`);
        console.log(`[ORCHESTRATOR] Prompt: "${context.prompt.substring(0, 50)}..."`);

        try {
            // Report initial progress
            onProgress?.({
                step: 0,
                stage: 'init',
                message: 'Initializing orchestration...',
                progress: 0,
            });

            // TODO: Create actual orchestrator execution
            // This is a placeholder that simulates the orchestrator behavior

            // Step 1: Analyze requirements
            stepCount++;
            onProgress?.({
                step: stepCount,
                stage: 'analyze',
                message: 'Analyzing requirements...',
                progress: 10,
            });
            await this.delay(500);

            // Step 2: Plan execution
            stepCount++;
            onProgress?.({
                step: stepCount,
                stage: 'plan',
                message: 'Planning execution strategy...',
                progress: 20,
            });
            await this.delay(300);

            // Step 3: Execute agents (simulation)
            const relevantAgents = this.analyzePromptForAgents(context.prompt);

            for (let i = 0; i < relevantAgents.length; i++) {
                stepCount++;
                const agent = relevantAgents[i];
                const progressPercent = 20 + ((i + 1) / relevantAgents.length) * 60;

                onProgress?.({
                    step: stepCount,
                    stage: 'execute',
                    agent,
                    message: `Executing ${agent}...`,
                    progress: Math.round(progressPercent),
                });

                agentsExecuted.push(agent);
                await this.delay(400);
            }

            // Step 4: Generate files
            stepCount++;
            onProgress?.({
                step: stepCount,
                stage: 'generate',
                message: 'Generating output files...',
                progress: 85,
            });

            // Generate placeholder files based on agents
            for (const agent of agentsExecuted) {
                generatedFiles.push(
                    ...this.getPlaceholderFilesForAgent(agent, context.prompt)
                );
            }

            // Step 5: Finalize
            stepCount++;
            onProgress?.({
                step: stepCount,
                stage: 'finalize',
                message: 'Finalizing output...',
                progress: 95,
            });
            await this.delay(200);

            // Complete
            onProgress?.({
                step: stepCount,
                stage: 'complete',
                message: 'Orchestration complete!',
                progress: 100,
            });

            const duration = Date.now() - startTime;

            return {
                success: true,
                taskId: context.taskId,
                steps: stepCount,
                duration,
                agentsExecuted,
                generatedFiles,
                thinking: {
                    traces: stepCount * 2,
                    confidence: 85,
                },
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            console.error(`❌ Orchestration failed: ${errorMessage}`);

            return {
                success: false,
                taskId: context.taskId,
                steps: stepCount,
                duration,
                agentsExecuted,
                generatedFiles: [],
                error: errorMessage,
            };
        }
    }

    /**
     * Analyze prompt to determine relevant agents
     */
    private analyzePromptForAgents(prompt: string): string[] {
        const lowerPrompt = prompt.toLowerCase();
        const agents: string[] = [];

        const agentKeywords: Record<string, string[]> = {
            'auth_agent': ['auth', 'login', 'clerk', 'jwt', 'oauth', 'session'],
            'db_agent': ['database', 'prisma', 'drizzle', 'postgresql', 'mongodb'],
            'api_agent': ['api', 'rest', 'graphql', 'endpoint', 'route'],
            'security_agent': ['security', 'helmet', 'cors', 'csrf', 'xss'],
            'monitoring_agent': ['monitoring', 'logging', 'metrics', 'sentry'],
            'queue_agent': ['queue', 'bullmq', 'redis', 'background', 'job'],
            'test_agent': ['test', 'vitest', 'jest', 'unit', 'integration'],
        };

        for (const [agent, keywords] of Object.entries(agentKeywords)) {
            if (keywords.some(kw => lowerPrompt.includes(kw))) {
                agents.push(agent);
            }
        }

        // If no specific agents matched, use a default set
        if (agents.length === 0) {
            agents.push('api_agent', 'db_agent');
        }

        return agents;
    }

    /**
     * Get placeholder files for an agent
     */
    private getPlaceholderFilesForAgent(
        agent: string,
        prompt: string
    ): ExecutionResult['generatedFiles'] {
        const files: ExecutionResult['generatedFiles'] = [];

        switch (agent) {
            case 'auth_agent':
                files.push({
                    path: 'src/auth/index.ts',
                    content: `// Generated by ${agent}\n// Prompt: ${prompt.substring(0, 50)}...\n\nexport * from './auth.service';`,
                    type: 'typescript',
                });
                break;
            case 'db_agent':
                files.push({
                    path: 'src/db/schema.ts',
                    content: `// Generated by ${agent}\n// Database schema\n\nexport const schema = {};`,
                    type: 'typescript',
                });
                break;
            case 'api_agent':
                files.push({
                    path: 'src/routes/index.ts',
                    content: `// Generated by ${agent}\n// API routes\n\nexport const routes = [];`,
                    type: 'typescript',
                });
                break;
            default:
                files.push({
                    path: `src/${agent.replace('_agent', '')}/index.ts`,
                    content: `// Generated by ${agent}\n\nexport {};`,
                    type: 'typescript',
                });
        }

        return files;
    }

    /**
     * Simple delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get service status
     */
    getStatus(): {
        initialized: boolean;
        config: OrchestratorConfig;
    } {
        return {
            initialized: this.isInitialized,
            config: this.config,
        };
    }
}

// Singleton instance
let orchestratorInstance: OrchestratorService | null = null;

export function getOrchestrator(): OrchestratorService {
    if (!orchestratorInstance) {
        orchestratorInstance = new OrchestratorService();
    }
    return orchestratorInstance;
}

export function createOrchestrator(config?: OrchestratorConfig): OrchestratorService {
    orchestratorInstance = new OrchestratorService(config);
    return orchestratorInstance;
}

/**
 * Register orchestrator as a Fastify plugin
 */
export async function registerOrchestrator(app: FastifyInstance): Promise<void> {
    const orchestrator = getOrchestrator();

    // Initialize on server start
    await orchestrator.initialize();

    // Decorate fastify instance
    app.decorate('orchestrator', orchestrator);

    app.log.info('🧠 Orchestrator service registered');
}

// Extend Fastify types
declare module 'fastify' {
    interface FastifyInstance {
        orchestrator: OrchestratorService;
    }
}
