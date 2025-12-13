/**
 * Integrated Orchestrator Service
 * 
 * This orchestrator properly connects ALL core services:
 * - ThinkingEngine: Task analysis and planning
 * - ContextManager: Working memory and conversation history
 * - AgentMonitor: Agent status tracking
 * - MCPHub: Inter-agent communication
 * - AIClient: Real AI API calls
 * - MultiModelOrchestrator: Two-stage AI pipeline (FAST + POWER)
 * - CostTracker: Real-time cost tracking
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
import { getBenchmarkingService } from './benchmarking.js';
import { getMultiModelOrchestrator, type MultiModelOrchestrator } from './multi-model-orchestrator.js';
import { getCostTracker } from './cost-tracker.js';
import { getCodePostProcessor, type CodePostProcessor } from './code-postprocessor.js';
import { getEnhancedCodeGenerator, type EnhancedCodeGenerator } from './enhanced-code-generator.js';
import { getVectorStore, type VectorStoreService } from './vector-store.js';
import { getLearningService, type LearningService } from './learning-service.js';


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
    phase: 'init' | 'thinking' | 'analysis' | 'agent-selection' | 'execution' | 'code-generation' | 'multi-model' | 'enhanced-codegen' | 'cost-tracking' | 'finalize';
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
    private config: IntegratedOrchestratorConfig & { useMultiModel: boolean };
    private aiClient: AIClient;
    private multiModelOrchestrator: MultiModelOrchestrator;
    private thinkingEngine: ThinkingEngineService;
    private contextManager: ContextManagerService;
    private agentMonitor: AgentMonitorService;
    private mcpHub: MCPHubService;
    private fileWriter: FileWriterService;
    private codePostProcessor: CodePostProcessor;
    private enhancedCodeGenerator: EnhancedCodeGenerator;
    private vectorStore: VectorStoreService;
    private learningService: LearningService;
    private isInitialized = false;

    constructor(config?: Partial<IntegratedOrchestratorConfig & { useMultiModel: boolean }>) {
        this.config = {
            useAIThinking: config?.useAIThinking ?? true,
            useContextManager: config?.useContextManager ?? true,
            useAgentMonitor: config?.useAgentMonitor ?? true,
            useMCPHub: config?.useMCPHub ?? true,
            useFileWriter: config?.useFileWriter ?? true,
            useMultiModel: config?.useMultiModel ?? true, // Enable multi-model by default!
            maxSubtasks: config?.maxSubtasks ?? 3,
            project: config?.project,
        };

        // Initialize all services
        this.aiClient = getAIClient();
        this.multiModelOrchestrator = getMultiModelOrchestrator();
        this.thinkingEngine = getThinkingEngine();
        this.contextManager = getContextManager();
        this.agentMonitor = getAgentMonitor();
        this.mcpHub = getMCPHub();
        this.fileWriter = getFileWriter();
        this.codePostProcessor = getCodePostProcessor();
        this.enhancedCodeGenerator = getEnhancedCodeGenerator();
        this.vectorStore = getVectorStore();
        this.learningService = getLearningService();
    }

    /**
     * Initialize the orchestrator and all services
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Register known agents with the monitor
        const knownAgents = ['auth-agent', 'security-agent', 'api-agent', 'database-agent', 'monitoring-agent'];
        for (const agent of knownAgents) {
            this.agentMonitor.registerAgent(agent);
        }

        this.isInitialized = true;
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

                let codeGenStart = Date.now(); // Declare outside try for error tracking
                try {
                    // Generate code for this subtask
                    addStep('code-generation', `Generating code for: "${subtask.substring(0, 50)}..."`, undefined, agent);

                    codeGenStart = Date.now();

                    let codeResult: { code: string; explanation: string; files?: Array<{ path: string }> };
                    let tokenUsage = { prompt: 0, completion: 0, total: 0 };
                    let totalCost = 0;

                    // Use Multi-Model Pipeline if enabled (default: true)
                    if (this.config.useMultiModel) {
                        addStep('multi-model', `Using two-stage pipeline: FAST (analysis) → POWER (generation)`, undefined, agent);

                        const multiModelResult = await this.multiModelOrchestrator.execute({
                            prompt: subtask,
                            taskId: input.taskId,
                            projectId: input.projectId,
                            userId: input.userId,
                            context: {
                                existingCode: '', // Could be populated from context
                                framework: 'Fastify',
                                language: 'TypeScript',
                            },
                        });

                        // Extract code and files from multi-model result
                        codeResult = {
                            code: multiModelResult.files.map(f => `// ${f.path}\n${f.content}`).join('\n\n') || multiModelResult.code,
                            explanation: multiModelResult.explanation || 'Generated using multi-model pipeline',
                            files: multiModelResult.files.map(f => ({ path: f.path })),
                        };

                        // Get token usage from cost records
                        const analysisTokens = multiModelResult.analysisCost ?
                            (multiModelResult.analysisCost.inputTokens + multiModelResult.analysisCost.outputTokens) : 0;
                        const generationTokens = multiModelResult.generationCost ?
                            (multiModelResult.generationCost.inputTokens + multiModelResult.generationCost.outputTokens) : 0;

                        tokenUsage = {
                            prompt: (multiModelResult.analysisCost?.inputTokens || 0) + (multiModelResult.generationCost?.inputTokens || 0),
                            completion: (multiModelResult.analysisCost?.outputTokens || 0) + (multiModelResult.generationCost?.outputTokens || 0),
                            total: analysisTokens + generationTokens,
                        };
                        totalCost = multiModelResult.totalCost;

                        addStep('multi-model', `Pipeline complete: ${multiModelResult.files.length} files, $${totalCost.toFixed(6)} cost`, {
                            files: multiModelResult.files.length,
                            cost: totalCost,
                            tokens: tokenUsage.total,
                            stages: {
                                analysis: multiModelResult.analysisTime,
                                generation: multiModelResult.generationTime,
                            }
                        }, agent);
                    } else {
                        // Fallback to single-model (legacy)
                        codeResult = await this.aiClient.generateCode(subtask, {
                            language: 'TypeScript',
                            framework: 'Fastify',
                        });
                        // Estimate tokens for legacy path
                        tokenUsage = {
                            prompt: Math.ceil((subtask.length + 500) / 4),
                            completion: Math.ceil(codeResult.code.length / 4),
                            total: Math.ceil((subtask.length + 500 + codeResult.code.length) / 4),
                        };
                    }

                    const codeGenDuration = Date.now() - codeGenStart;

                    generatedCode.push({
                        subtask,
                        code: codeResult.code,
                        explanation: codeResult.explanation,
                        agent,
                    });

                    // Add generated file to context
                    if (config.useContextManager && (codeResult.files?.length ?? 0) > 0) {
                        for (const file of codeResult.files!) {
                            this.contextManager.addGeneratedFile(input.projectId, input.userId, file.path);
                        }
                    }

                    // Mark agent as complete
                    if (config.useAgentMonitor) {
                        this.agentMonitor.completeExecution(agent, true);
                    }

                    // Record benchmark data
                    const benchmarking = getBenchmarkingService();
                    benchmarking.recordAgentExecution({
                        agentId: agent,
                        agentName: agent,
                        executionTime: codeGenDuration,
                        tokenUsage,
                        success: true,
                        filesGenerated: codeResult.files?.length || 0,
                        timestamp: new Date().toISOString(),
                        taskId: input.taskId,
                        projectId: input.projectId,
                        userId: input.userId,
                    });

                    // Record to cost tracker
                    const costTracker = getCostTracker();
                    if (this.config.useMultiModel && totalCost > 0) {
                        // Cost already tracked by multi-model orchestrator
                        addStep('cost-tracking', `Cost recorded: $${totalCost.toFixed(6)}`, {
                            daily: costTracker.getDailyCost(),
                            monthly: costTracker.getMonthlyCost(),
                        }, agent);
                    }

                    addStep('code-generation', `Code generated (${codeGenDuration}ms, ${codeResult.code.length} chars)`, {
                        codeLength: codeResult.code.length,
                        filesGenerated: codeResult.files?.length || 0,
                        multiModel: this.config.useMultiModel,
                        cost: totalCost,
                    }, agent);

                    // Send completion notification via MCP
                    if (config.useMCPHub) {
                        this.mcpHub.send(agent, 'orchestrator', 'notification', {
                            type: 'subtask-complete',
                            subtask,
                            success: true,
                            multiModel: this.config.useMultiModel,
                        });
                    }

                } catch (error) {
                    const executionTime = Date.now() - codeGenStart;
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Code generation failed for "${subtask}": ${errorMsg}`);

                    if (config.useAgentMonitor) {
                        this.agentMonitor.completeExecution(agent, false, errorMsg);
                    }

                    // Record failed execution benchmark
                    const benchmarking = getBenchmarkingService();
                    benchmarking.recordAgentExecution({
                        agentId: agent,
                        agentName: agent,
                        executionTime,
                        tokenUsage: { prompt: 0, completion: 0, total: 0 },
                        success: false,
                        error: errorMsg,
                        filesGenerated: 0,
                        timestamp: new Date().toISOString(),
                        taskId: input.taskId,
                        projectId: input.projectId,
                        userId: input.userId,
                    });

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
                addStep('finalize', 'Processing and writing generated code...');

                // Combine all generated code for post-processing
                const allCode = generatedCode.map(gc => gc.code).join('\n\n');

                // Post-process to extract proper files, fix imports, etc.
                addStep('finalize', 'Post-processing code for proper file structure...');
                const processedOutput = await this.codePostProcessor.process(
                    allCode,
                    config.project?.name || input.projectId
                );

                if (processedOutput.warnings.length > 0) {
                    console.log('[CODE-POSTPROCESSOR] Warnings:', processedOutput.warnings.join(', '));
                }

                // Prepare files to write (processed files + entry point)
                const mapFileType = (type?: string): 'code' | 'config' | 'doc' | undefined => {
                    if (type === 'schema' || type === 'migration') return 'code';
                    return type as 'code' | 'config' | 'doc' | undefined;
                };

                const filesToWrite = [
                    ...processedOutput.files.map(f => ({
                        path: f.path.startsWith('src/') ? f.path : `src/${f.path}`,
                        content: f.content,
                        type: mapFileType(f.type),
                    })),
                    {
                        path: processedOutput.entryPoint.path,
                        content: processedOutput.entryPoint.content,
                        type: 'code' as const,
                    },
                ];

                addStep('finalize', `Extracted ${processedOutput.stats.totalFiles} files, generated entry point`, {
                    totalFiles: processedOutput.stats.totalFiles,
                    fixedImports: processedOutput.stats.fixedImports,
                    removedJsonBlocks: processedOutput.stats.removedJsonBlocks,
                });

                fileWriteResult = await this.fileWriter.writeProject(
                    input.projectId,
                    filesToWrite,
                    { projectName: config.project?.name || input.projectId }
                );

                if (fileWriteResult.success) {
                    addStep('finalize', `Files written to: ${fileWriteResult.projectPath}`, {
                        filesWritten: fileWriteResult.filesWritten,
                        stats: processedOutput.stats,
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

                    // UUID validation helper
                    const isValidUUID = (str: string): boolean => {
                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                        return uuidRegex.test(str);
                    };

                    // Determine the user_id to use for database saves
                    let dbUserId: string | null = null;

                    if (isValidUUID(input.userId)) {
                        // Check if user exists
                        const { data: existingUser } = await supabase
                            .from('users')
                            .select('id')
                            .eq('id', input.userId)
                            .single();

                        if (existingUser) {
                            dbUserId = input.userId;
                        }
                    }

                    // If no valid user, use TEST_USER_ID from environment for development
                    if (!dbUserId && process.env.TEST_USER_ID) {
                        const testUserId = process.env.TEST_USER_ID;

                        // Validate it's a proper UUID
                        if (isValidUUID(testUserId)) {
                            // Check if this user exists in public.users
                            const { data: testUser } = await supabase
                                .from('users')
                                .select('id')
                                .eq('id', testUserId)
                                .single();

                            if (testUser) {
                                dbUserId = testUserId;
                                console.log('[ORCHESTRATOR] Using TEST_USER_ID from environment:', testUserId.substring(0, 8) + '...');
                            } else {
                                console.log('[ORCHESTRATOR] TEST_USER_ID not found in public.users table. Please run the SQL to create user entry.');
                            }
                        } else {
                            console.log('[ORCHESTRATOR] TEST_USER_ID is not a valid UUID');
                        }
                    }

                    // Only save to projects/tasks if we have a valid user
                    if (dbUserId) {
                        // Save/Update Project
                        let projectId: string | null = null;

                        const { data: existingProject } = await supabase
                            .from('projects')
                            .select('id')
                            .eq('user_id', dbUserId)
                            .eq('name', input.projectId)
                            .single();

                        if (!existingProject) {
                            const { data: newProject, error: projectError } = await supabase.from('projects').insert({
                                user_id: dbUserId,
                                name: input.projectId,
                                description: config.project?.description || `Generated project: ${input.prompt.substring(0, 100)}`,
                                config: {
                                    techStack: config.project?.techStack || [],
                                    agentsUsed: agentsExecuted,
                                },
                                status: errors.length === 0 ? 'completed' : 'failed',
                            }).select('id').single();

                            if (projectError) {
                                console.error('[ORCHESTRATOR] Failed to create project:', projectError.message);
                            } else {
                                projectId = newProject?.id || null;
                                console.log('[ORCHESTRATOR] Created project:', projectId);
                            }
                        } else {
                            projectId = existingProject.id;
                            const { error: updateError } = await supabase.from('projects')
                                .update({
                                    status: errors.length === 0 ? 'completed' : 'failed',
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', existingProject.id);

                            if (updateError) {
                                console.error('[ORCHESTRATOR] Failed to update project:', updateError.message);
                            }
                        }

                        // Save Task
                        const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
                            user_id: dbUserId,
                            project_id: projectId,
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
                        }).select('id').single();

                        if (taskError) {
                            console.error('[ORCHESTRATOR] Failed to create task:', taskError.message);
                        } else {
                            console.log('[ORCHESTRATOR] Created task:', newTask?.id);
                        }

                        // Log to audit
                        const { error: auditError } = await supabase.from('audit_logs').insert({
                            user_id: dbUserId,
                            action: 'orchestration_execute',
                            resource_type: 'task',
                            resource_id: newTask?.id || null,
                            metadata: {
                                taskId: input.taskId,
                                projectId: input.projectId,
                                agentsExecuted,
                                codeGenerated: generatedCode.length,
                                duration: totalDuration,
                                success: errors.length === 0,
                            },
                        });

                        if (auditError) {
                            console.error('[ORCHESTRATOR] Failed to create audit log:', auditError.message);
                        } else {
                            console.log('[ORCHESTRATOR] Created audit log for task');
                        }

                        addStep('finalize', '✅ Results saved to Supabase database');
                    } else {
                        addStep('finalize', '⚠️ Skipping projects/tasks save (no valid user)');
                        console.log('[ORCHESTRATOR] Skipping projects/tasks - user not found. Cost and benchmark records still saved.');
                    }
                } else {
                    addStep('finalize', '⚠️ Database unavailable, skipping persistence');
                }

                // Record to benchmarking service for performance tracking
                const benchmarking = getBenchmarkingService();
                await benchmarking.recordOrchestrationToDb({
                    taskId: input.taskId,
                    projectId: input.projectId,
                    userId: input.userId,
                    totalDuration,
                    thinkingTime: aiAnalysis ? undefined : 0, // TODO: track actual thinking time
                    agentsUsed: agentsExecuted,
                    subtasksCount: subtasks.length,
                    filesGenerated: fileWriteResult?.filesWritten?.length || 0,
                    success: errors.length === 0,
                    error: errors.length > 0 ? errors.join('; ') : undefined,
                    totalTokens: 0, // TODO: aggregate from multi-model
                    totalCost: 0, // TODO: aggregate from cost tracker
                    analysisModel: this.config.useMultiModel ? 'deepseek/deepseek-chat' : undefined,
                    generationModel: this.config.useMultiModel ? 'glm-4.6' : undefined,
                });
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
        enhancedCodeGenerator: EnhancedCodeGenerator;
        vectorStore: VectorStoreService;
        learningService: LearningService;
    } {
        return {
            aiClient: this.aiClient,
            thinkingEngine: this.thinkingEngine,
            contextManager: this.contextManager,
            agentMonitor: this.agentMonitor,
            mcpHub: this.mcpHub,
            enhancedCodeGenerator: this.enhancedCodeGenerator,
            vectorStore: this.vectorStore,
            learningService: this.learningService,
        };
    }

    /**
     * Generate a multi-language project using the Enhanced Code Generator
     * This is a convenience method that wraps the EnhancedCodeGenerator
     */
    async generateMultiLangProject(request: {
        projectName: string;
        description: string;
        language: 'typescript' | 'python' | 'go' | 'rust' | 'java';
        framework?: string;
        includeTests?: boolean;
        includeDocker?: boolean;
        includeAuth?: boolean;
    }): Promise<{
        success: boolean;
        files: Array<{ path: string; content: string; type: string }>;
        dependencies: string[];
        errors: string[];
    }> {
        console.log(`[INTEGRATED-ORCHESTRATOR] Generating ${request.language} project: ${request.projectName}`);

        const result = await this.enhancedCodeGenerator.generate({
            projectName: request.projectName,
            description: request.description,
            language: request.language,
            framework: request.framework as any,
            includeTests: request.includeTests ?? true,
            includeDocker: request.includeDocker ?? true,
            includeAuth: request.includeAuth ?? false,
        });

        return {
            success: result.success,
            files: result.files.map(f => ({
                path: f.path,
                content: f.content,
                type: f.type,
            })),
            dependencies: result.dependencies,
            errors: result.errors,
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
