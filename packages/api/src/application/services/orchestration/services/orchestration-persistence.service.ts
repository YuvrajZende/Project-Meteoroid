/**
 * Orchestration Persistence Service
 * 
 * Handles database saves for projects, tasks, audit logs, and learning iterations.
 * 
 * Extracted from IntegratedOrchestrator to improve maintainability.
 */

import { checkSupabaseConnection, getSupabaseAdmin } from '../../../../infrastructure/database/database-client.js';
import { getLearningService, type LearningService } from '../../../../domain/services/learning/learning-service.js';
import { getVectorStore, type VectorStoreService } from '../../../../domain/services/learning/vector-store.js';
import { getBenchmarkingService } from '../../../../infrastructure/benchmarking.js';
import { getCostTracker } from '../../../../infrastructure/cost-tracker.js';

export interface IterationData {
    taskId: string;
    projectId: string;
    userId: string;
    prompt: string;
    generatedCode: Array<{ path: string; content: string; language: string }>;
    config: Record<string, unknown>;
    success: boolean;
    errors: string[];
    metrics: {
        duration: number;
        tokensUsed: number;
        cost?: number;
    };
}

export interface TaskData {
    taskId: string;
    projectId: string;
    userId: string;
    prompt: string;
    generatedCode: Array<{
        subtask: string;
        agent: string;
        codeLength: number;
        explanation: string;
    }>;
    filesWritten: string[];
    totalDuration: number;
    errors: string[];
    agentsExecuted: string[];
    startTime: Date;
    endTime: Date;
}

export interface CostData {
    orchestrationStartTime: number;
    totalDuration: number;
    thinkingTime: number;
    agentsExecuted: string[];
    subtasksCount: number;
    filesGenerated: number;
    success: boolean;
    error?: string;
}

export class OrchestrationPersistenceService {
    private learningService: LearningService;
    private vectorStore: VectorStoreService;

    constructor() {
        this.learningService = getLearningService();
        this.vectorStore = getVectorStore();
    }

    async initialize(): Promise<void> {
        await this.learningService.initialize();
        await this.vectorStore.initialize();
    }

    async storeIteration(data: IterationData): Promise<void> {
        await this.learningService.storeIteration({
            taskId: data.taskId,
            projectId: data.projectId,
            userId: data.userId,
            prompt: data.prompt,
            generatedCode: data.generatedCode,
            config: data.config,
            success: data.success,
            errors: data.errors,
            metrics: data.metrics,
            createdAt: new Date(),
        });
    }

    async indexGeneratedCode(
        projectId: string,
        files: Array<{ path: string; content: string }>,
        language: string
    ): Promise<{ chunksCreated: number }> {
        if (files.length === 0) {
            return { chunksCreated: 0 };
        }

        const filesToIndex = files.map((gen, idx) => ({
            path: `generated/${projectId}/gen-${idx}.${language === 'python' ? 'py' : 'ts'}`,
            content: gen.content,
        }));

        const result = await this.vectorStore.indexProject(projectId, filesToIndex);
        return { chunksCreated: result.chunksCreated };
    }

    async storeKnowledgeEmbeddings(
        projectId: string,
        taskId: string,
        prompt: string,
        files: Array<{ path: string; content: string; type?: string }>,
        language: string,
        framework: string,
        success: boolean
    ): Promise<number> {
        try {
            const supabase = getSupabaseAdmin();
            let stored = 0;

            for (const file of files) {
                const embedding = await this.vectorStore.generateEmbedding(
                    `File: ${file.path}\nType: ${file.type || 'code'}\nContent: ${file.content.slice(0, 2000)}`
                );

                await supabase.from('knowledge_embeddings').insert({
                    content: `Project: ${projectId}\nPrompt: ${prompt.slice(0, 500)}\nFile: ${file.path}\n\n${file.content.slice(0, 5000)}`,
                    embedding: `[${embedding.join(',')}]`,
                    metadata: {
                        projectId,
                        taskId,
                        filePath: file.path,
                        fileType: file.type,
                        language,
                        framework,
                        success,
                    },
                });
                stored++;
            }

            return stored;
        } catch (error) {
            console.warn('[PERSISTENCE] Failed to store knowledge embeddings:', error);
            return 0;
        }
    }

    async saveToDatabase(
        data: TaskData,
        projectConfig: { name?: string; description?: string; techStack?: string[] }
    ): Promise<{ success: boolean; projectId: string | null; taskId: string | null; error?: string }> {
        try {
            const dbCheck = await checkSupabaseConnection();

            if (!dbCheck.connected) {
                return { success: false, projectId: null, taskId: null, error: 'Database unavailable' };
            }

            const supabase = getSupabaseAdmin();

            const isValidUUID = (str: string): boolean => {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return uuidRegex.test(str);
            };

            let dbUserId: string | null = null;

            if (isValidUUID(data.userId)) {
                const { data: existingUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', data.userId)
                    .single();

                if (existingUser) {
                    dbUserId = data.userId;
                }
            }

            if (!dbUserId && process.env.TEST_USER_ID) {
                const testUserId = process.env.TEST_USER_ID;
                if (isValidUUID(testUserId)) {
                    const { data: testUser } = await supabase
                        .from('users')
                        .select('id')
                        .eq('id', testUserId)
                        .single();

                    if (testUser) {
                        dbUserId = testUserId;
                    }
                }
            }

            if (!dbUserId) {
                return { success: false, projectId: null, taskId: null, error: 'No valid user' };
            }

            let projectId: string | null = null;

            const { data: existingProject } = await supabase
                .from('projects')
                .select('id')
                .eq('user_id', dbUserId)
                .eq('name', data.projectId)
                .single();

            if (!existingProject) {
                const { data: newProject, error: projectError } = await supabase.from('projects').insert({
                    user_id: dbUserId,
                    name: data.projectId,
                    description: projectConfig.description || `Generated project: ${data.prompt.substring(0, 100)}`,
                    config: {
                        techStack: projectConfig.techStack || [],
                        agentsUsed: data.agentsExecuted,
                    },
                    status: data.errors.length === 0 ? 'completed' : 'failed',
                }).select('id').single();

                if (projectError) {
                    return { success: false, projectId: null, taskId: null, error: projectError.message };
                }
                projectId = newProject?.id || null;
            } else {
                projectId = existingProject.id;
                await supabase.from('projects')
                    .update({
                        status: data.errors.length === 0 ? 'completed' : 'failed',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingProject.id);
            }

            const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
                user_id: dbUserId,
                project_id: projectId,
                prompt: data.prompt,
                status: data.errors.length === 0 ? 'completed' : 'failed',
                progress: 100,
                result: {
                    generatedCode: data.generatedCode,
                    filesWritten: data.filesWritten,
                    totalDuration: data.totalDuration,
                },
                error: data.errors.length > 0 ? data.errors.join('; ') : null,
                agents_used: data.agentsExecuted,
                started_at: data.startTime.toISOString(),
                completed_at: data.endTime.toISOString(),
            }).select('id').single();

            if (taskError) {
                return { success: false, projectId, taskId: null, error: taskError.message };
            }

            await supabase.from('audit_logs').insert({
                user_id: dbUserId,
                action: 'orchestration_execute',
                resource_type: 'task',
                resource_id: newTask?.id || null,
                metadata: {
                    taskId: data.taskId,
                    projectId: data.projectId,
                    agentsExecuted: data.agentsExecuted,
                    codeGenerated: data.generatedCode.length,
                    duration: data.totalDuration,
                    success: data.errors.length === 0,
                },
            });

            return { success: true, projectId, taskId: newTask?.id || null };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
            return { success: false, projectId: null, taskId: null, error: errorMsg };
        }
    }

    async recordBenchmark(
        taskId: string,
        projectId: string,
        userId: string,
        data: CostData
    ): Promise<void> {
        const benchmarking = getBenchmarkingService();
        const costTracker = getCostTracker();

        const costSummary = costTracker.getSummary(
            new Date(data.orchestrationStartTime),
            new Date()
        );

        await benchmarking.recordOrchestrationToDb({
            taskId,
            projectId,
            userId,
            totalDuration: data.totalDuration,
            thinkingTime: data.thinkingTime,
            agentsUsed: data.agentsExecuted,
            subtasksCount: data.subtasksCount,
            filesGenerated: data.filesGenerated,
            success: data.success,
            error: data.error,
            totalTokens: costSummary.totalInputTokens + costSummary.totalOutputTokens,
            totalCost: costSummary.totalCost,
        });
    }

    getCostSummary(startTime: number): {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCost: number;
    } {
        const costTracker = getCostTracker();
        return costTracker.getSummary(new Date(startTime), new Date());
    }
}
