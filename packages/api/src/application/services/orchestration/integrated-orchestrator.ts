/**
 * Integrated Orchestrator Service (Refactored)
 * 
 * ARCH-001 REFACTORING COMPLETE
 * 
 * This orchestrator coordinates ALL core services by delegating to extracted services:
 * - OrchestrationContextService: Context management, entity extraction
 * - OrchestrationAnalysisService: Thinking, analysis, agent selection
 * - OrchestrationGenerationService: Code generation, learning context
 * - OrchestrationFileService: File writing, post-processing
 * - OrchestrationQualityService: Quality assessment, architecture storage
 * - OrchestrationPersistenceService: Database saves, learning storage
 * 
 * Main orchestrator is now a thin coordination layer (~400 lines).
 */

// ARCH-001: Extracted Services
import {
    OrchestrationContextService,
    OrchestrationAnalysisService,
    OrchestrationGenerationService,
    OrchestrationFileService,
    OrchestrationQualityService,
    OrchestrationPersistenceService,
    type CodeGenerationRequest,
} from './services/index.js';

// Infrastructure
import { broadcastPipelineStep } from '../../../routes/websocket.js';
import { getBenchmarkingService } from '../../../infrastructure/benchmarking.js';
import { getMCPHub, type MCPHubService } from '../../../domain/services/context/core-services.js';

// ============================================
// TYPES
// ============================================

export interface IntegratedOrchestratorConfig {
    useAIThinking: boolean;
    useContextManager: boolean;
    useAgentMonitor: boolean;
    useMCPHub: boolean;
    useFileWriter: boolean;
    useMultiModel: boolean;
    useQualityAssessment: boolean;
    maxSubtasks: number;
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
    context?: {
        language?: string;
        framework?: string;
        techStack?: string[];
        existingCode?: string;
    };
}

export interface OrchestrationStep {
    stepNumber: number;
    phase: string;
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
    startTime: Date;
    endTime: Date;
    totalDuration: number;
    taskAnalysis: unknown;
    thinkingTraces: unknown[];
    aiAnalysis?: {
        complexity: string;
        subtasks: string[];
        suggestedAgents: string[];
        estimatedSteps: number;
    };
    steps: OrchestrationStep[];
    agentsExecuted: string[];
    agentStatuses: unknown[];
    generatedCode: Array<{
        subtask: string;
        code: string;
        explanation: string;
        agent: string;
    }>;
    fileWriteResult?: {
        success: boolean;
        projectPath: string;
        filesWritten: string[];
        errors: string[];
    };
    contextWindow: unknown;
    errors: string[];
}

// ============================================
// INTEGRATED ORCHESTRATOR CLASS (REFACTORED)
// ============================================

export class IntegratedOrchestrator {
    private config: IntegratedOrchestratorConfig;
    private mcpHub: MCPHubService;
    
    // ARCH-001: Extracted Services
    private contextService: OrchestrationContextService;
    private analysisService: OrchestrationAnalysisService;
    private generationService: OrchestrationGenerationService;
    private fileService: OrchestrationFileService;
    private qualityService: OrchestrationQualityService;
    private persistenceService: OrchestrationPersistenceService;
    
    private isInitialized = false;

    constructor(config?: Partial<IntegratedOrchestratorConfig>) {
        this.config = {
            useAIThinking: config?.useAIThinking ?? true,
            useContextManager: config?.useContextManager ?? true,
            useAgentMonitor: config?.useAgentMonitor ?? true,
            useMCPHub: config?.useMCPHub ?? true,
            useFileWriter: config?.useFileWriter ?? true,
            useMultiModel: config?.useMultiModel ?? true,
            useQualityAssessment: config?.useQualityAssessment ?? true,
            maxSubtasks: config?.maxSubtasks ?? 3,
            project: config?.project,
        };

        this.mcpHub = getMCPHub();
        
        // Initialize extracted services
        this.contextService = new OrchestrationContextService();
        this.analysisService = new OrchestrationAnalysisService();
        this.generationService = new OrchestrationGenerationService();
        this.fileService = new OrchestrationFileService();
        this.qualityService = new OrchestrationQualityService();
        this.persistenceService = new OrchestrationPersistenceService();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        const knownAgents = ['auth-agent', 'security-agent', 'api-agent', 'database-agent', 'monitoring-agent'];
        this.analysisService.registerAgents(knownAgents);
        
        await this.generationService.initialize();
        await this.fileService.initialize();
        await this.qualityService.initialize();
        await this.persistenceService.initialize();

        this.logInitialization();
        this.isInitialized = true;
    }

    private logInitialization(): void {
        console.log('╭──────────────────────────────────────────────────────────╮');
        console.log('│  ✅ ARCH-001 REFACTORED ORCHESTRATOR                     │');
        console.log('├──────────────────────────────────────────────────────────┤');
        console.log('│  🎯 ContextService        : ✓ Active                      │');
        console.log('│  🧠 AnalysisService       : ✓ Active                      │');
        console.log('│  ⚡ GenerationService     : ✓ Active                      │');
        console.log('│  📁 FileService           : ✓ Active                      │');
        console.log('│  📊 QualityService        : ✓ Active                      │');
        console.log('│  💾 PersistenceService    : ✓ Active                      │');
        console.log('╰──────────────────────────────────────────────────────────╯');
    }

    async orchestrate(
        input: OrchestrationInput,
        onProgress?: (step: OrchestrationStep) => void
    ): Promise<OrchestrationResult> {
        const startTime = new Date();
        const steps: OrchestrationStep[] = [];
        const errors: string[] = [];
        const generatedCode: OrchestrationResult['generatedCode'] = [];
        const agentsExecuted: string[] = [];
        const orchestrationStartTime = Date.now();

        const config = { ...this.config, ...input.config };

        if (!this.isInitialized) {
            await this.initialize();
        }

        this.analysisService.clearTraces();

        const addStep = (
            phase: string,
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
            broadcastPipelineStep(step.stepNumber, phase, message);
            return step;
        };

        try {
            // PHASE 1: INITIALIZATION
            addStep('init', 'Starting orchestration pipeline...');

            if (config.useContextManager) {
                this.contextService.setupProjectContext(
                    input.projectId,
                    input.userId,
                    config.project?.name,
                    config.project?.description,
                    config.project?.techStack
                );
                this.contextService.addUserMessage(input.projectId, input.userId, input.prompt);
                addStep('init', 'Context initialized');
            }

            // PHASE 1.1: INTENT DETECTION
            addStep('init', 'Detecting user intent...');
            const intentAnalysis = await this.contextService.analyzeIntent(input.prompt);
            
            if (intentAnalysis) {
                addStep('init', `Intent: ${intentAnalysis.intent} (${(intentAnalysis.confidence * 100).toFixed(0)}%)`);
            }

            // FAST PATH for simple scripts
            if (intentAnalysis?.intent === 'SIMPLE_SCRIPT') {
                return this.generateSimpleScript(input, intentAnalysis.language || 'python', addStep, startTime);
            }

            // PHASE 1.5: ENTITY EXTRACTION
            addStep('init', 'Extracting entities...');
            const contextResult = await this.contextService.extractEntities(
                input.taskId,
                input.projectId,
                input.userId,
                input.prompt,
                input.context?.language || 'typescript',
                input.context?.framework || 'fastify'
            );

            if (contextResult.entities.length > 0) {
                addStep('init', `Extracted ${contextResult.entities.length} entities`);
            }

            // PHASE 2: ANALYSIS
            addStep('thinking', 'Analyzing task...');
            const analysisResult = await this.analysisService.analyze(
                input.prompt,
                config.useAIThinking,
                ['auth-agent', 'security-agent', 'api-agent', 'database-agent']
            );

            addStep('thinking', `Analysis complete (${analysisResult.thinkingTime}ms)`, {
                complexity: analysisResult.taskAnalysis.complexity,
                agents: analysisResult.selectedAgents,
            });

            // PHASE 3: AGENT SELECTION
            addStep('agent-selection', `Selected ${analysisResult.selectedAgents.length} agents`, {
                agents: analysisResult.selectedAgents,
            });

            if (config.useMCPHub) {
                this.mcpHub.send('orchestrator', 'broadcast', 'broadcast', {
                    type: 'agent-selection',
                    agents: analysisResult.selectedAgents,
                });
            }

            // PHASE 4: EXECUTION & CODE GENERATION
            const subtasks = analysisResult.subtasks.slice(0, config.maxSubtasks);
            addStep('execution', `Processing ${subtasks.length} subtasks...`);

            for (let i = 0; i < subtasks.length; i++) {
                const subtask = subtasks[i];
                const agent = analysisResult.selectedAgents[i % analysisResult.selectedAgents.length] || 'api-agent';

                this.analysisService.startAgentExecution(agent, subtask);
                agentsExecuted.push(agent);

                addStep('execution', `Agent "${agent}" processing subtask ${i + 1}/${subtasks.length}`, { subtask, agent }, agent);

                try {
                    addStep('code-generation', `Generating code for: "${subtask.substring(0, 50)}..."`, undefined, agent);

                    const genRequest: CodeGenerationRequest = {
                        prompt: input.prompt,
                        subtask,
                        taskId: input.taskId,
                        projectId: input.projectId,
                        userId: input.userId,
                        language: input.context?.language || 'typescript',
                        framework: input.context?.framework || 'fastify',
                        techStack: input.context?.techStack,
                        existingCode: input.context?.existingCode,
                        generationContext: contextResult.generationContext,
                        entityConstraints: contextResult.entityConstraints,
                        originalPrompt: input.prompt,
                    };

                    const codeResult = await this.generationService.generate(genRequest);

                    generatedCode.push({
                        subtask,
                        code: codeResult.code,
                        explanation: codeResult.explanation,
                        agent,
                    });

                    this.analysisService.updateAgentProgress(agent, 100);
                    this.analysisService.completeAgentExecution(agent, true);

                    // Record benchmark
                    const benchmarking = getBenchmarkingService();
                    benchmarking.recordAgentExecution({
                        agentId: agent,
                        agentName: agent,
                        executionTime: codeResult.analysisTime + codeResult.generationTime,
                        tokenUsage: codeResult.tokenUsage,
                        success: true,
                        filesGenerated: codeResult.files.length,
                        timestamp: new Date().toISOString(),
                        taskId: input.taskId,
                        projectId: input.projectId,
                        userId: input.userId,
                    });

                    addStep('code-generation', `Code generated (${codeResult.files.length} files)`, {
                        files: codeResult.files.length,
                        cost: codeResult.cost,
                    }, agent);

                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Code generation failed: ${errorMsg}`);
                    this.analysisService.completeAgentExecution(agent, false, errorMsg);
                    addStep('code-generation', `Failed: ${errorMsg}`, undefined, agent);
                }
            }

            // PHASE 5: QUALITY ASSESSMENT
            let qualityScore = 0;
            if (config.useQualityAssessment && generatedCode.length > 0) {
                addStep('quality', 'Assessing code quality...');
                
                const filesToAssess = generatedCode.map((gen, idx) => ({
                    path: `generated/${gen.agent}/file-${idx}.ts`,
                    content: gen.code,
                }));

                const qualityResult = await this.qualityService.assessQuality(
                    filesToAssess,
                    null,
                    input.context?.language || 'typescript',
                    input.context?.framework || 'fastify'
                );

                qualityScore = qualityResult.score;
                addStep('quality', `Quality: ${qualityResult.score}/100 (${qualityResult.passed ? 'PASS' : 'NEEDS WORK'})`);
            }

            // PHASE 6: FILE PROCESSING & WRITING
            let fileWriteResult: OrchestrationResult['fileWriteResult'];
            
            if (config.useFileWriter && generatedCode.length > 0) {
                addStep('finalize', 'Processing and writing files...');

                const allCode = generatedCode.map(gc => gc.code).join('\n\n');
                const processingResult = await this.fileService.processFiles(
                    allCode,
                    config.project?.name || input.projectId,
                    input.context?.language || 'typescript',
                    null
                );

                const writeResult = await this.fileService.writeProject(
                    input.projectId,
                    processingResult.filesToWrite,
                    config.project?.name || input.projectId,
                    input.context?.language || 'typescript'
                );

                fileWriteResult = {
                    success: writeResult.success,
                    projectPath: writeResult.projectPath,
                    filesWritten: writeResult.filesWritten || [],
                    errors: writeResult.errors,
                };

                addStep('finalize', `Files written to: ${writeResult.projectPath}`, {
                    filesWritten: writeResult.filesWritten?.length || 0,
                    integrityScore: processingResult.validationReport.score,
                });

                // PHASE 7: PERSISTENCE
                addStep('finalize', 'Storing results...');

                // Store learning iteration
                for (const gen of generatedCode) {
                    await this.persistenceService.storeIteration({
                        taskId: input.taskId,
                        projectId: input.projectId,
                        userId: input.userId,
                        prompt: input.prompt,
                        generatedCode: [{ path: `${gen.agent}/${gen.subtask.slice(0, 30)}`, content: gen.code, language: input.context?.language || 'typescript' }],
                        config: { language: input.context?.language, framework: input.context?.framework, agentsUsed: agentsExecuted },
                        success: errors.length === 0,
                        errors,
                        metrics: {
                            duration: Date.now() - startTime.getTime(),
                            tokensUsed: 0,
                        },
                    });
                }

                // Index for learning
                const indexResult = await this.persistenceService.indexGeneratedCode(
                    input.projectId,
                    generatedCode.map(g => ({ path: g.subtask, content: g.code })),
                    input.context?.language || 'typescript'
                );
                addStep('finalize', `Indexed ${indexResult.chunksCreated} code chunks`);

                // Store architecture
                await this.qualityService.storeArchitecture(
                    input.projectId,
                    input.prompt,
                    input.context?.language || 'typescript',
                    input.context?.framework || 'fastify',
                    fileWriteResult.filesWritten,
                    qualityScore
                );

                // Save to database
                const dbResult = await this.persistenceService.saveToDatabase(
                    {
                        taskId: input.taskId,
                        projectId: input.projectId,
                        userId: input.userId,
                        prompt: input.prompt,
                        generatedCode: generatedCode.map(g => ({
                            subtask: g.subtask,
                            agent: g.agent,
                            codeLength: g.code.length,
                            explanation: g.explanation.substring(0, 200),
                        })),
                        filesWritten: fileWriteResult.filesWritten,
                        totalDuration: Date.now() - startTime.getTime(),
                        errors,
                        agentsExecuted,
                        startTime,
                        endTime: new Date(),
                    },
                    { name: config.project?.name, description: config.project?.description, techStack: config.project?.techStack }
                );

                if (dbResult.success) {
                    addStep('finalize', '✅ Results saved to database');
                }

                // Record benchmark
                await this.persistenceService.recordBenchmark(
                    input.taskId,
                    input.projectId,
                    input.userId,
                    {
                        orchestrationStartTime,
                        totalDuration: Date.now() - startTime.getTime(),
                        thinkingTime: analysisResult.thinkingTime,
                        agentsExecuted,
                        subtasksCount: subtasks.length,
                        filesGenerated: fileWriteResult.filesWritten.length,
                        success: errors.length === 0,
                    }
                );
            }

            // Finalize context
            if (contextResult.generationContext) {
                this.contextService.finalizeContext(contextResult.generationContext.id, errors.length === 0, {
                    duration: Date.now() - startTime.getTime(),
                    cost: 0,
                    qualityScore,
                });
            }

            const endTime = new Date();
            
            console.log(`\n${'='.repeat(70)}`);
            console.log(`  ORCHESTRATION COMPLETE`);
            console.log(`  Duration: ${endTime.getTime() - startTime.getTime()}ms | Agents: ${agentsExecuted.length}`);
            console.log(`${'='.repeat(70)}\n`);

            return {
                success: errors.length === 0,
                taskId: input.taskId,
                projectId: input.projectId,
                startTime,
                endTime,
                totalDuration: endTime.getTime() - startTime.getTime(),
                taskAnalysis: analysisResult.taskAnalysis,
                thinkingTraces: this.analysisService.getTraces(),
                aiAnalysis: analysisResult.aiAnalysis,
                steps,
                agentsExecuted,
                agentStatuses: this.analysisService.getAllAgentStatuses(),
                generatedCode,
                fileWriteResult,
                contextWindow: this.contextService.getContext(input.projectId, input.userId),
                errors,
            };

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(errorMsg);
            addStep('finalize', `Orchestration failed: ${errorMsg}`);

            return {
                success: false,
                taskId: input.taskId,
                projectId: input.projectId,
                startTime,
                endTime: new Date(),
                totalDuration: Date.now() - startTime.getTime(),
                taskAnalysis: null,
                thinkingTraces: this.analysisService.getTraces(),
                steps,
                agentsExecuted,
                agentStatuses: this.analysisService.getAllAgentStatuses(),
                generatedCode,
                contextWindow: null,
                errors,
            };
        }
    }

    private async generateSimpleScript(
        input: OrchestrationInput,
        language: string,
        addStep: (phase: string, message: string, data?: unknown, agent?: string) => OrchestrationStep,
        startTime: Date
    ): Promise<OrchestrationResult> {
        addStep('code-generation', `Generating ${language} script (fast path)...`);

        const { getAIClient } = await import('../../../infrastructure/ai-client.js');
        const aiClient = getAIClient();

        const promptText = `Generate a clean, production-ready ${language} script for:

${input.prompt}

Requirements:
1. Write clean, well-documented code
2. Include proper error handling
3. Follow best practices
4. Add docstrings/comments
5. Make it runnable standalone

Return ONLY the code.`;

        const response = await aiClient.generateCode(promptText, { language });
        const code = response.code || '';

        const extensions: Record<string, string> = {
            python: 'py', typescript: 'ts', javascript: 'js', go: 'go', rust: 'rs', java: 'java'
        };
        const ext = extensions[language.toLowerCase()] || 'txt';
        const fileName = `script.${ext}`;

        let fileWriteResult: OrchestrationResult['fileWriteResult'];
        if (this.config.useFileWriter) {
            const writeResult = await this.fileService.writeProject(
                input.projectId,
                [{ path: fileName, content: code, type: 'code' }],
                input.projectId,
                language
            );
            fileWriteResult = {
                success: writeResult.success,
                projectPath: writeResult.projectPath,
                filesWritten: writeResult.filesWritten || [],
                errors: writeResult.errors,
            };
        }

        const endTime = new Date();

        return {
            success: true,
            taskId: input.taskId,
            projectId: input.projectId,
            startTime,
            endTime,
            totalDuration: endTime.getTime() - startTime.getTime(),
            taskAnalysis: null,
            thinkingTraces: [],
            steps: [],
            agentsExecuted: ['fast-path'],
            agentStatuses: [],
            generatedCode: [{
                subtask: 'Simple script generation',
                code,
                explanation: `Generated ${language} script`,
                agent: 'fast-path',
            }],
            fileWriteResult,
            contextWindow: null,
            errors: [],
        };
    }

    getStatus(): { initialized: boolean; config: IntegratedOrchestratorConfig } {
        return {
            initialized: this.isInitialized,
            config: this.config,
        };
    }

    async getServiceContext(_userId: string): Promise<{
        connectedServices: Array<{
            serviceId: string;
            serviceName: string;
            category: string;
            capabilities: string[];
        }>;
        serviceInstructions: string;
    }> {
        return {
            connectedServices: [],
            serviceInstructions: '',
        };
    }
}

// Singleton
let instance: IntegratedOrchestrator | null = null;

export function getIntegratedOrchestrator(): IntegratedOrchestrator {
    if (!instance) {
        instance = new IntegratedOrchestrator();
    }
    return instance;
}

export function createIntegratedOrchestrator(config?: Partial<IntegratedOrchestratorConfig>): IntegratedOrchestrator {
    instance = new IntegratedOrchestrator(config);
    return instance;
}
