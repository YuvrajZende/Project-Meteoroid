/**
 * Integrated Orchestrator Service
 * 
 * This orchestrator properly connects ALL core services:
 * - ThinkingEngine: Task analysis and planning
 * - ContextManager: Working memory and conversation history
 * - AgentMonitor: Agent status tracking
 * - MCPHub: Inter-agent communication
 * - AIClient: Real AI API calls
 * 
 * This is the REAL orchestrator, not demo mode.
 */

import { AIClient, getAIClient } from './ai-client.js';
import {
    ThinkingEngineService,
    ContextManagerService,
    AgentMonitorService,
    MCPHubService,
    getThinkingEngine,
    getContextManager,
    getAgentMonitor,
    getMCPHub,
    type TaskAnalysis,
    type ThinkingTrace,
    type ContextWindow,
    type AgentExecutionStatus,
} from './core-services.js';
import { FileWriterService, getFileWriter, type WriteResult } from './file-writer.js';
import { checkSupabaseConnection } from './database-client.js';

// ============================================
// TYPES
// ============================================

export interface IntegratedOrchestratorConfig {
    /** Enable AI-powered thinking */
    useAIThinking: boolean;
    /** Enable context management */
    useContextManager: boolean;
    /** Enable agent monitoring */
    useAgentMonitor: boolean;
    /** Enable MCP messaging */
    useMCPHub: boolean;
    /** Enable file writing to disk */
    useFileWriter: boolean;
    /** Maximum subtasks to process */
    maxSubtasks: number;
    /** Project details */
    project?: {
        name: string;
        techStack: string[];
        description?: string;
    };
}

export interface OrchestrationInput {
    taskId: string;
    userId: string;
    projectId: string;
    prompt: string;
    config?: Partial<IntegratedOrchestratorConfig>;
}

export interface OrchestrationStep {
    stepNumber: number;
    phase: 'init' | 'thinking' | 'analysis' | 'agent-selection' | 'execution' | 'code-generation' | 'finalize';
    agent?: string;
    message: string;
    timestamp: Date;
    duration?: number;
    data?: unknown;
}

export interface OrchestrationResult {
    success: boolean;
    taskId: string;
    projectId: string;

    // Timing
    startTime: Date;
    endTime: Date;
    totalDuration: number;

    // Thinking & Analysis
    taskAnalysis: TaskAnalysis | null;
    thinkingTraces: ThinkingTrace[];
    aiAnalysis?: {
        complexity: string;
        subtasks: string[];
        suggestedAgents: string[];
        estimatedSteps: number;
    };

    // Execution
    steps: OrchestrationStep[];
    agentsExecuted: string[];
    agentStatuses: AgentExecutionStatus[];

    // Output
    generatedCode: Array<{
        subtask: string;
        code: string;
        explanation: string;
        agent: string;
    }>;

    // File Output
    fileWriteResult?: WriteResult;

    // Context
    contextWindow: ContextWindow | null;

    // Errors
    errors: string[];
}

// ============================================
// INTEGRATED ORCHESTRATOR CLASS
// ============================================

export class IntegratedOrchestrator {
    private config: IntegratedOrchestratorConfig;
    private aiClient: AIClient;
    private thinkingEngine: ThinkingEngineService;
    private contextManager: ContextManagerService;
    private agentMonitor: AgentMonitorService;
    private mcpHub: MCPHubService;
    private fileWriter: FileWriterService;
    private isInitialized = false;

    constructor(config?: Partial<IntegratedOrchestratorConfig>) {
        this.config = {
            useAIThinking: config?.useAIThinking ?? true,
            useContextManager: config?.useContextManager ?? true,
            useAgentMonitor: config?.useAgentMonitor ?? true,
            useMCPHub: config?.useMCPHub ?? true,
            useFileWriter: config?.useFileWriter ?? true,
            maxSubtasks: config?.maxSubtasks ?? 3,
            project: config?.project,
        };

        // Initialize all services
        this.aiClient = getAIClient();
        this.thinkingEngine = getThinkingEngine();
        this.contextManager = getContextManager();
        this.agentMonitor = getAgentMonitor();
        this.mcpHub = getMCPHub();
        this.fileWriter = getFileWriter();
    }

    /**
     * Initialize the orchestrator and all services
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('[INTEGRATED-ORCHESTRATOR] Initializing...');
        console.log(`[INTEGRATED-ORCHESTRATOR] AI Thinking: ${this.config.useAIThinking ? 'ENABLED' : 'DISABLED'}`);
        console.log(`[INTEGRATED-ORCHESTRATOR] Context Manager: ${this.config.useContextManager ? 'ENABLED' : 'DISABLED'}`);
        console.log(`[INTEGRATED-ORCHESTRATOR] Agent Monitor: ${this.config.useAgentMonitor ? 'ENABLED' : 'DISABLED'}`);
        console.log(`[INTEGRATED-ORCHESTRATOR] MCP Hub: ${this.config.useMCPHub ? 'ENABLED' : 'DISABLED'}`);
        console.log(`[INTEGRATED-ORCHESTRATOR] File Writer: ${this.config.useFileWriter ? 'ENABLED' : 'DISABLED'}`);

        // Register known agents with the monitor
        const knownAgents = ['auth-agent', 'security-agent', 'api-agent', 'database-agent', 'monitoring-agent'];
        for (const agent of knownAgents) {
            this.agentMonitor.registerAgent(agent);
        }

        this.isInitialized = true;
        console.log('[INTEGRATED-ORCHESTRATOR] Initialization complete');
    }

    /**
     * Execute a full orchestration pipeline
     */
    async orchestrate(
        input: OrchestrationInput,
        onProgress?: (step: OrchestrationStep) => void
    ): Promise<OrchestrationResult> {
        const startTime = new Date();
        const steps: OrchestrationStep[] = [];
        const errors: string[] = [];
        const generatedCode: OrchestrationResult['generatedCode'] = [];
        let taskAnalysis: TaskAnalysis | null = null;
        let aiAnalysis: OrchestrationResult['aiAnalysis'] | undefined;
        const agentsExecuted: string[] = [];

        // Merge config
        const config = { ...this.config, ...input.config };

        // Initialize if not already done
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Clear previous thinking traces
        this.thinkingEngine.clearTraces();

        console.log(`\n${'='.repeat(70)}`);
        console.log(`  INTEGRATED ORCHESTRATION - Task: ${input.taskId}`);
        console.log(`${'='.repeat(70)}\n`);

        const addStep = (
            phase: OrchestrationStep['phase'],
            message: string,
            data?: unknown,
            agent?: string
        ): OrchestrationStep => {
            const step: OrchestrationStep = {
                stepNumber: steps.length + 1,
                phase,
                message,
                timestamp: new Date(),
                data,
                agent,
            };
            steps.push(step);
            console.log(`[STEP ${step.stepNumber}] [${phase.toUpperCase()}] ${message}`);
            onProgress?.(step);
            return step;
        };

        try {
            // ============================================
            // PHASE 1: INITIALIZATION
            // ============================================
            addStep('init', 'Starting orchestration pipeline...');

            // Set up context if enabled
            if (config.useContextManager) {
                this.contextManager.getContext(input.projectId, input.userId);

                // Update project context if provided
                if (config.project) {
                    this.contextManager.updateProjectContext(input.projectId, input.userId, {
                        name: config.project.name,
                        description: config.project.description,
                        techStack: config.project.techStack,
                    });
                }

                // Add user request to memory
                this.contextManager.addMemory(input.projectId, input.userId, {
                    role: 'user',
                    content: input.prompt,
                });

                addStep('init', 'Context initialized', { contextKey: `${input.projectId}:${input.userId}` });
            }

            // ============================================
            // PHASE 2: THINKING (Local + AI)
            // ============================================
            addStep('thinking', 'Starting thinking phase...');

            // Local thinking engine analysis
            const localAnalysisStart = Date.now();
            taskAnalysis = await this.thinkingEngine.analyzeTask(input.prompt);
            const localAnalysisDuration = Date.now() - localAnalysisStart;

            addStep('thinking', `Local analysis complete (${localAnalysisDuration}ms)`, {
                complexity: taskAnalysis.complexity,
                requirements: taskAnalysis.requirements,
                suggestedAgents: taskAnalysis.suggestedAgents,
            });

            // AI-powered analysis if enabled
            if (config.useAIThinking) {
                try {
                    addStep('thinking', 'Requesting AI analysis...');
                    const aiAnalysisStart = Date.now();
                    aiAnalysis = await this.aiClient.analyzeTask(input.prompt);
                    const aiAnalysisDuration = Date.now() - aiAnalysisStart;

                    addStep('thinking', `AI analysis complete (${aiAnalysisDuration}ms)`, {
                        complexity: aiAnalysis.complexity,
                        subtasksCount: aiAnalysis.subtasks.length,
                        suggestedAgents: aiAnalysis.suggestedAgents,
                    });

                    // Merge AI suggestions with local analysis
                    const mergedAgents = [...new Set([
                        ...taskAnalysis.suggestedAgents,
                        ...aiAnalysis.suggestedAgents,
                    ])];
                    taskAnalysis.suggestedAgents = mergedAgents;

                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown AI error';
                    errors.push(`AI Analysis failed: ${errorMsg}`);
                    addStep('thinking', `AI analysis failed: ${errorMsg} (continuing with local analysis)`);
                }
            }

            // ============================================
            // PHASE 3: AGENT SELECTION
            // ============================================
            const selectedAgents = aiAnalysis?.suggestedAgents || taskAnalysis.suggestedAgents;
            addStep('agent-selection', `Selected ${selectedAgents.length} agents`, { agents: selectedAgents });

            // Broadcast agent selection via MCP
            if (config.useMCPHub) {
                this.mcpHub.send('orchestrator', 'broadcast', 'broadcast', {
                    type: 'agent-selection',
                    agents: selectedAgents,
                    task: input.prompt,
                });
            }

            // ============================================
            // PHASE 4: AGENT EXECUTION & CODE GENERATION
            // ============================================
            const subtasks = aiAnalysis?.subtasks || ['Implement the requested functionality'];
            const subtasksToProcess = subtasks.slice(0, config.maxSubtasks);

            addStep('execution', `Processing ${subtasksToProcess.length} subtasks...`);

            for (let i = 0; i < subtasksToProcess.length; i++) {
                const subtask = subtasksToProcess[i];
                const agent = selectedAgents[i % selectedAgents.length] || 'api-agent';

                // Mark agent as running
                if (config.useAgentMonitor) {
                    this.agentMonitor.startExecution(agent, subtask);
                }

                agentsExecuted.push(agent);

                addStep('execution', `Agent "${agent}" processing subtask ${i + 1}/${subtasksToProcess.length}`, {
                    subtask,
                    agent,
                }, agent);

                // Update progress
                if (config.useAgentMonitor) {
                    this.agentMonitor.updateProgress(agent, 50);
                }

                try {
                    // Generate code for this subtask
                    addStep('code-generation', `Generating code for: "${subtask.substring(0, 50)}..."`, undefined, agent);

                    const codeGenStart = Date.now();
                    const codeResult = await this.aiClient.generateCode(subtask, {
                        language: 'TypeScript',
                        framework: 'Fastify',
                    });
                    const codeGenDuration = Date.now() - codeGenStart;

                    generatedCode.push({
                        subtask,
                        code: codeResult.code,
                        explanation: codeResult.explanation,
                        agent,
                    });

                    // Add generated file to context
                    if (config.useContextManager && codeResult.files?.length > 0) {
                        for (const file of codeResult.files) {
                            this.contextManager.addGeneratedFile(input.projectId, input.userId, file.path);
                        }
                    }

                    // Mark agent as complete
                    if (config.useAgentMonitor) {
                        this.agentMonitor.completeExecution(agent, true);
                    }

                    addStep('code-generation', `Code generated (${codeGenDuration}ms, ${codeResult.code.length} chars)`, {
                        codeLength: codeResult.code.length,
                        filesGenerated: codeResult.files?.length || 0,
                    }, agent);

                    // Send completion notification via MCP
                    if (config.useMCPHub) {
                        this.mcpHub.send(agent, 'orchestrator', 'notification', {
                            type: 'subtask-complete',
                            subtask,
                            success: true,
                        });
                    }

                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Code generation failed for "${subtask}": ${errorMsg}`);

                    if (config.useAgentMonitor) {
                        this.agentMonitor.completeExecution(agent, false, errorMsg);
                    }

                    addStep('code-generation', `Code generation failed: ${errorMsg}`, undefined, agent);
                }
            }

            // ============================================
            // PHASE 5: FINALIZATION
            // ============================================
            addStep('finalize', 'Finalizing orchestration...');

            // Write generated code to files
            let fileWriteResult: WriteResult | undefined;
            if (config.useFileWriter && generatedCode.length > 0) {
                addStep('finalize', 'Writing generated code to files...');

                const filesToWrite = generatedCode.map((gc, index) => ({
                    path: `src/generated-${index + 1}.ts`,
                    content: `/**\n * Generated for: ${gc.subtask}\n * Agent: ${gc.agent}\n * \n * ${gc.explanation}\n */\n\n${gc.code}`,
                    type: 'code' as const,
                }));

                fileWriteResult = await this.fileWriter.writeProject(
                    input.projectId,
                    filesToWrite,
                    { projectName: config.project?.name || input.projectId }
                );

                if (fileWriteResult.success) {
                    addStep('finalize', `Files written to: ${fileWriteResult.projectPath}`, {
                        filesWritten: fileWriteResult.filesWritten,
                    });
                } else {
                    errors.push(...fileWriteResult.errors);
                    addStep('finalize', `File writing had errors: ${fileWriteResult.errors.join(', ')}`);
                }
            }

            // Add assistant response to context
            if (config.useContextManager) {
                this.contextManager.addMemory(input.projectId, input.userId, {
                    role: 'assistant',
                    content: `Generated ${generatedCode.length} code components for: ${input.prompt}`,
                    metadata: {
                        agentsUsed: agentsExecuted,
                        codeGenerated: generatedCode.length,
                        filesWritten: fileWriteResult?.filesWritten,
                    },
                });
            }

            const endTime = new Date();
            const totalDuration = endTime.getTime() - startTime.getTime();

            addStep('finalize', `Orchestration complete in ${totalDuration}ms`);

            // ============================================
            // SAVE TO SUPABASE DATABASE
            // ============================================
            try {
                // Check if database is available
                const dbCheck = await checkSupabaseConnection();

                if (dbCheck.connected) {
                    addStep('finalize', 'Saving orchestration results to database...');

                    // Dynamically import database services to avoid circular dependencies
                    const { getSupabaseAdmin } = await import('./database-client.js');
                    const supabase = getSupabaseAdmin();

                    // Save/Update Project
                    const { data: existingProject } = await supabase
                        .from('projects')
                        .select('id')
                        .eq('user_id', input.userId)
                        .eq('name', input.projectId)
                        .single();

                    if (!existingProject) {
                        await supabase.from('projects').insert({
                            user_id: input.userId,
                            name: input.projectId,
                            description: config.project?.description || `Generated project: ${input.prompt.substring(0, 100)}`,
                            config: {
                                techStack: config.project?.techStack || [],
                                agentsUsed: agentsExecuted,
                            },
                            status: errors.length === 0 ? 'completed' : 'failed',
                        });
                    } else {
                        await supabase.from('projects')
                            .update({
                                status: errors.length === 0 ? 'completed' : 'failed',
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', existingProject.id);
                    }

                    // Save Task
                    await supabase.from('tasks').insert({
                        user_id: input.userId,
                        project_id: existingProject?.id,
                        prompt: input.prompt,
                        status: errors.length === 0 ? 'completed' : 'failed',
                        progress: 100,
                        result: {
                            generatedCode: generatedCode.map(gc => ({
                                subtask: gc.subtask,
                                agent: gc.agent,
                                codeLength: gc.code.length,
                                explanation: gc.explanation.substring(0, 200),
                            })),
                            filesWritten: fileWriteResult?.filesWritten || [],
                            totalDuration,
                        },
                        error: errors.length > 0 ? errors.join('; ') : null,
                        agents_used: agentsExecuted,
                        started_at: startTime.toISOString(),
                        completed_at: endTime.toISOString(),
                    });

                    // Log to audit
                    await supabase.from('audit_logs').insert({
                        user_id: input.userId,
                        action: 'orchestration_execute',
                        resource_type: 'task',
                        resource_id: null,
                        metadata: {
                            taskId: input.taskId,
                            projectId: input.projectId,
                            agentsExecuted,
                            codeGenerated: generatedCode.length,
                            duration: totalDuration,
                            success: errors.length === 0,
                        },
                    });

                    addStep('finalize', '✅ Results saved to Supabase database');
                } else {
                    addStep('finalize', '⚠️ Database unavailable, skipping persistence');
                }
            } catch (dbError) {
                const dbErrorMsg = dbError instanceof Error ? dbError.message : 'Unknown database error';
                errors.push(`Database save failed: ${dbErrorMsg}`);
                addStep('finalize', `⚠️ Database save failed: ${dbErrorMsg}`);
                console.warn('[ORCHESTRATOR] Database save failed:', dbError);
            }

            // Get final context and agent statuses
            const contextWindow = config.useContextManager
                ? this.contextManager.getContext(input.projectId, input.userId)
                : null;

            const agentStatuses = config.useAgentMonitor
                ? this.agentMonitor.getAllStatus()
                : [];

            console.log(`\n${'='.repeat(70)}`);
            console.log(`  ORCHESTRATION COMPLETE`);
            console.log(`  Duration: ${totalDuration}ms | Agents: ${agentsExecuted.length} | Code: ${generatedCode.length}`);
            if (fileWriteResult) {
                console.log(`  Files Written: ${fileWriteResult.filesWritten.length} → ${fileWriteResult.projectPath}`);
            }
            console.log(`${'='.repeat(70)}\n`);

            return {
                success: errors.length === 0,
                taskId: input.taskId,
                projectId: input.projectId,
                startTime,
                endTime,
                totalDuration,
                taskAnalysis,
                thinkingTraces: this.thinkingEngine.getTraces(),
                aiAnalysis,
                steps,
                agentsExecuted,
                agentStatuses,
                generatedCode,
                fileWriteResult,
                contextWindow,
                errors,
            };

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown orchestration error';
            errors.push(errorMsg);

            addStep('finalize', `Orchestration failed: ${errorMsg}`);

            const endTime = new Date();

            return {
                success: false,
                taskId: input.taskId,
                projectId: input.projectId,
                startTime,
                endTime,
                totalDuration: endTime.getTime() - startTime.getTime(),
                taskAnalysis,
                thinkingTraces: this.thinkingEngine.getTraces(),
                aiAnalysis,
                steps,
                agentsExecuted,
                agentStatuses: this.agentMonitor.getAllStatus(),
                generatedCode,
                contextWindow: null,
                errors,
            };
        }
    }

    /**
     * Get current status
     */
    getStatus(): {
        initialized: boolean;
        config: IntegratedOrchestratorConfig;
        agentStatuses: AgentExecutionStatus[];
    } {
        return {
            initialized: this.isInitialized,
            config: this.config,
            agentStatuses: this.agentMonitor.getAllStatus(),
        };
    }

    /**
     * Get services for direct access
     */
    getServices(): {
        aiClient: AIClient;
        thinkingEngine: ThinkingEngineService;
        contextManager: ContextManagerService;
        agentMonitor: AgentMonitorService;
        mcpHub: MCPHubService;
    } {
        return {
            aiClient: this.aiClient,
            thinkingEngine: this.thinkingEngine,
            contextManager: this.contextManager,
            agentMonitor: this.agentMonitor,
            mcpHub: this.mcpHub,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let integratedOrchestratorInstance: IntegratedOrchestrator | null = null;

export function getIntegratedOrchestrator(): IntegratedOrchestrator {
    if (!integratedOrchestratorInstance) {
        integratedOrchestratorInstance = new IntegratedOrchestrator();
    }
    return integratedOrchestratorInstance;
}

export function createIntegratedOrchestrator(
    config?: Partial<IntegratedOrchestratorConfig>
): IntegratedOrchestrator {
    integratedOrchestratorInstance = new IntegratedOrchestrator(config);
    return integratedOrchestratorInstance;
}
