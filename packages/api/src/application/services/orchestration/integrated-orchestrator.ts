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
import { broadcastActivity, broadcastPipelineStep } from '../../../routes/websocket.js';
import { formatResearchNotes, isWebSearchConfigured, webSearch } from '../../../infrastructure/web-search.js';
import { formatAgentInstructions } from '../../../domain/services/agents/custom-agents.js';
import { getBenchmarkingService } from '../../../infrastructure/benchmarking.js';
import { getMCPHub, type MCPHubService } from '../../../domain/services/context/core-services.js';

// ============================================
// CONCURRENCY
// ============================================

/** Max subtasks generated in parallel (each subtask = 1 fast + 1 power model call). */
const SUBTASK_CONCURRENCY = Math.max(1, parseInt(process.env.SUBTASK_CONCURRENCY || '3', 10) || 3);

/**
 * Run `fn` over `items` with at most `limit` in flight; results keep input order.
 * Stays on the caller's async chain so AsyncLocalStorage context (projectId tagging) is preserved.
 */
async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

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
    /** Research current docs on the web before generating (needs a search provider key) */
    useWebSearch: boolean;
    maxSubtasks: number;
    /** User-defined agents; each gets its own subtask with its instructions */
    customAgents?: Array<{ id: string; name: string; role: string; instructions: string }>;
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
            useWebSearch: config?.useWebSearch ?? true,
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
            broadcastPipelineStep(step.stepNumber, phase, message, agent);
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
            broadcastActivity({ kind: 'thinking', status: 'start' });
            const thinkingStart = Date.now();
            const analysisResult = await this.analysisService.analyze(
                input.prompt,
                config.useAIThinking,
                ['auth-agent', 'security-agent', 'api-agent', 'database-agent']
            );
            broadcastActivity({
                kind: 'thinking',
                status: 'end',
                complexity: analysisResult.aiAnalysis?.complexity ?? analysisResult.taskAnalysis.complexity,
                summary: analysisResult.subtasks.length > 1
                    ? `Split into ${analysisResult.subtasks.length} subtasks for ${analysisResult.selectedAgents.join(', ')}`
                    : 'Single subtask plan',
                durationMs: Date.now() - thinkingStart,
            });

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
            // Subtasks are independent: generate them with bounded concurrency, preserving result order.
            const customAgents = config.customAgents ?? [];
            const subtasks = [
                ...analysisResult.subtasks.slice(0, Math.max(1, config.maxSubtasks - customAgents.length)),
                ...customAgents.map(a => `${a.name}: ${a.role}`),
            ];
            const customByIndex = new Map(customAgents.map((a, i) => [subtasks.length - customAgents.length + i, a]));
            const language = input.context?.language || 'typescript';
            const framework = input.context?.framework || 'fastify';
            addStep('execution', `Processing ${subtasks.length} subtasks (concurrency ${SUBTASK_CONCURRENCY})...`);

            const subtaskAgents = subtasks.map((_, i) =>
                customByIndex.get(i)?.id
                    ?? analysisResult.selectedAgents[i % analysisResult.selectedAgents.length]
                    ?? 'api-agent'
            );
            agentsExecuted.push(...subtaskAgents);
            broadcastActivity({
                kind: 'plan',
                subtasks: subtasks.map((title, id) => ({ id, title, agent: subtaskAgents[id] })),
            });

            // PHASE 3.5: WEB RESEARCH (optional tool use)
            let researchNotes = '';
            if (config.useWebSearch && isWebSearchConfigured()) {
                const query = `${framework} ${language} ${input.prompt.slice(0, 120)} best practices latest`;
                const toolId = `search-${Date.now()}`;
                const searchStart = Date.now();
                addStep('research', `Searching the web: ${query}`);
                broadcastActivity({ kind: 'tool', id: toolId, tool: 'web_search', status: 'running', query });
                try {
                    const results = await webSearch(query, 5);
                    researchNotes = formatResearchNotes(results);
                    broadcastActivity({
                        kind: 'tool', id: toolId, tool: 'web_search', status: 'done', query,
                        results: results.map(r => ({ title: r.title, url: r.url })),
                        durationMs: Date.now() - searchStart,
                    });
                    addStep('research', `Found ${results.length} sources`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    broadcastActivity({ kind: 'tool', id: toolId, tool: 'web_search', status: 'error', query, error: message, durationMs: Date.now() - searchStart });
                    addStep('research', `Web search unavailable: ${message}`);
                }
            }

            const subtaskResults = await mapWithConcurrency(subtasks, SUBTASK_CONCURRENCY, async (subtask, i) => {
                const agent = subtaskAgents[i];
                const agentStart = Date.now();
                broadcastActivity({ kind: 'agent', id: i, agent, status: 'running' });
                this.analysisService.startAgentExecution(agent, subtask);
                addStep('execution', `Agent "${agent}" processing subtask ${i + 1}/${subtasks.length}`, { subtask, agent }, agent);

                try {
                    addStep('code-generation', `Generating code for: "${subtask.substring(0, 50)}..."`, undefined, agent);

                    const genRequest: CodeGenerationRequest = {
                        prompt: input.prompt,
                        subtask,
                        taskId: input.taskId,
                        projectId: input.projectId,
                        userId: input.userId,
                        language,
                        framework,
                        techStack: input.context?.techStack,
                        existingCode: input.context?.existingCode,
                        generationContext: contextResult.generationContext,
                        entityConstraints: contextResult.entityConstraints,
                        researchNotes,
                        agentInstructions: customByIndex.has(i) ? formatAgentInstructions(customByIndex.get(i)!) : undefined,
                        originalPrompt: input.prompt,
                    };

                    const codeResult = await this.generationService.generate(genRequest);

                    this.analysisService.updateAgentProgress(agent, 100);
                    this.analysisService.completeAgentExecution(agent, true);

                    getBenchmarkingService().recordAgentExecution({
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

                    broadcastActivity({ kind: 'agent', id: i, agent, status: 'done', files: codeResult.files.length, durationMs: Date.now() - agentStart });
                    return {
                        ok: true as const,
                        gen: { subtask, code: codeResult.code, explanation: codeResult.explanation, agent },
                    };
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    broadcastActivity({ kind: 'agent', id: i, agent, status: 'failed', error: errorMsg, durationMs: Date.now() - agentStart });
                    this.analysisService.completeAgentExecution(agent, false, errorMsg);
                    addStep('code-generation', `Failed: ${errorMsg}`, undefined, agent);
                    return { ok: false as const, error: `Code generation failed: ${errorMsg}` };
                }
            });

            for (const result of subtaskResults) {
                if (result.ok) generatedCode.push(result.gen);
                else errors.push(result.error);
            }

            // PHASE 5: QUALITY ASSESSMENT (runs concurrently with file processing/writing)
            let qualityPromise: Promise<Awaited<ReturnType<OrchestrationQualityService['assessQuality']>> | null> = Promise.resolve(null);
            if (config.useQualityAssessment && generatedCode.length > 0) {
                addStep('quality', 'Assessing code quality...');
                qualityPromise = this.qualityService.assessQuality(
                    generatedCode.map((gen, idx) => ({
                        path: `generated/${gen.agent}/file-${idx}.ts`,
                        content: gen.code,
                    })),
                    null,
                    language,
                    framework
                ).catch((error: unknown) => {
                    console.warn('[ORCHESTRATOR] Quality assessment failed:', error);
                    return null;
                });
            }

            // PHASE 6: FILE PROCESSING & WRITING
            // Must complete before responding: the UI fetches the files right after.
            let fileWriteResult: OrchestrationResult['fileWriteResult'];

            if (config.useFileWriter && generatedCode.length > 0) {
                addStep('finalize', 'Processing and writing files...');

                const allCode = generatedCode.map(gc => gc.code).join('\n\n');
                const processingResult = await this.fileService.processFiles(
                    allCode,
                    config.project?.name || input.projectId,
                    language,
                    null
                );

                const writeResult = await this.fileService.writeProject(
                    input.projectId,
                    processingResult.filesToWrite,
                    config.project?.name || input.projectId,
                    language
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
            }

            const qualityResult = await qualityPromise;
            const qualityScore = qualityResult?.score ?? 0;
            if (qualityResult) {
                addStep('quality', `Quality: ${qualityResult.score}/100 (${qualityResult.passed ? 'PASS' : 'NEEDS WORK'})`);
            }

            // PHASE 7: PERSISTENCE (fire-and-forget, off the response path)
            if (fileWriteResult) {
                addStep('finalize', 'Storing results in background...');
                this.persistInBackground({
                    input,
                    config,
                    language,
                    framework,
                    generatedCode: [...generatedCode],
                    errors: [...errors],
                    agentsExecuted: [...agentsExecuted],
                    filesWritten: [...fileWriteResult.filesWritten],
                    qualityScore,
                    startTime,
                    orchestrationStartTime,
                    thinkingTime: analysisResult.thinkingTime,
                    subtasksCount: subtasks.length,
                });
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
            console.error('[ORCHESTRATOR] Orchestration failed:', error);
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

    /**
     * Persist learning, index, architecture, DB records and benchmark in parallel without
     * blocking the HTTP response. Failures are logged, never thrown.
     */
    private persistInBackground(data: {
        input: OrchestrationInput;
        config: IntegratedOrchestratorConfig;
        language: string;
        framework: string;
        generatedCode: OrchestrationResult['generatedCode'];
        errors: string[];
        agentsExecuted: string[];
        filesWritten: string[];
        qualityScore: number;
        startTime: Date;
        orchestrationStartTime: number;
        thinkingTime: number;
        subtasksCount: number;
    }): void {
        const { input, config, language, generatedCode, errors, agentsExecuted, filesWritten, startTime } = data;
        const success = errors.length === 0;
        const totalDuration = Date.now() - startTime.getTime();

        const tasks: Array<[string, Promise<unknown>]> = [
            ['storeIteration', Promise.all(generatedCode.map(gen => this.persistenceService.storeIteration({
                taskId: input.taskId,
                projectId: input.projectId,
                userId: input.userId,
                prompt: input.prompt,
                generatedCode: [{ path: `${gen.agent}/${gen.subtask.slice(0, 30)}`, content: gen.code, language }],
                config: { language: input.context?.language, framework: input.context?.framework, agentsUsed: agentsExecuted },
                success,
                errors,
                metrics: { duration: totalDuration, tokensUsed: 0 },
            })))],
            ['indexGeneratedCode', this.persistenceService.indexGeneratedCode(
                input.projectId,
                generatedCode.map(g => ({ path: g.subtask, content: g.code })),
                language
            ).then(r => console.log(`[ORCHESTRATOR] Indexed ${r.chunksCreated} code chunks`))],
            ['storeArchitecture', this.qualityService.storeArchitecture(
                input.projectId,
                input.prompt,
                language,
                data.framework,
                filesWritten,
                data.qualityScore
            )],
            ['saveToDatabase', this.persistenceService.saveToDatabase(
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
                    filesWritten,
                    totalDuration,
                    errors,
                    agentsExecuted,
                    startTime,
                    endTime: new Date(),
                },
                { name: config.project?.name, description: config.project?.description, techStack: config.project?.techStack }
            ).then(r => {
                if (r.success) console.log('[ORCHESTRATOR] Results saved to database');
                else console.warn(`[ORCHESTRATOR] Database save skipped: ${r.error}`);
            })],
            ['recordBenchmark', this.persistenceService.recordBenchmark(
                input.taskId,
                input.projectId,
                input.userId,
                {
                    orchestrationStartTime: data.orchestrationStartTime,
                    totalDuration,
                    thinkingTime: data.thinkingTime,
                    agentsExecuted,
                    subtasksCount: data.subtasksCount,
                    filesGenerated: filesWritten.length,
                    success,
                }
            )],
        ];

        void Promise.allSettled(tasks.map(([, p]) => p)).then(results => {
            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    console.error(`[ORCHESTRATOR] Background ${tasks[i][0]} failed for task ${input.taskId}:`, result.reason);
                }
            });
        });
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
