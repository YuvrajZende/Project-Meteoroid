/**
 * AI Learning Service
 *
 * Phase 1: Dependency Injection - Step 1.3
 * Refactored to use dependency injection instead of singleton pattern.
 *
 * Phase 18: Learning from Iterations
 *
 * This service enables the AI to learn and improve over time by:
 * - Storing generation iterations and their outcomes
 * - Learning from successful vs failed code generations
 * - Building pre-context from testing iterations
 * - Retrieving relevant past experiences for better generation
 *
 * The system improves code quality through:
 * 1. Storing each generation attempt with its result
 * 2. Indexing successful patterns
 * 3. Detecting and avoiding failed patterns
 * 4. Building context from similar past tasks
 */

import { injectable, inject, optional, unmanaged } from 'inversify';
import { TYPES } from '../../../di/types.js';
import type { IDatabase } from '../../../interfaces/database.interface.js';
import type { IVectorStore } from '../../../interfaces/vector-store.interface.js';
import type { ILearningService, LearningConfig, GenerationIteration, TestingIteration, LearnedPattern, PreContext } from '../../../interfaces/learning.interface.js';

// Re-export types for backward compatibility
export type { LearningConfig, GenerationIteration, TestingIteration, LearnedPattern, PreContext };

// Legacy imports for backward compatibility
import { getSupabaseAdmin } from '../../../infrastructure/database/database-client.js';
import { type VectorStoreService } from './vector-store.js';
import type { IGenerationIterationRepository } from '../../../repositories/generation-iteration.repository.js';
import type { ITestingIterationRepository } from '../../../repositories/testing-iteration.repository.js';
import type { ILearnedPatternRepository } from '../../../repositories/learned-pattern.repository.js';

// Database row types for Supabase queries
interface GenerationIterationRow {
    id: string;
    task_id: string;
    project_id: string;
    prompt: string;
    generated_code: any;
    config: any;
    success?: boolean;
    status?: string;
    errors: any;
    metrics: any;
    created_at: string;
}

// ============================================
// LEARNING SERVICE
// ============================================

@injectable()
export class LearningService implements ILearningService {
    private config: LearningConfig;
    private vectorStore: VectorStoreService | IVectorStore;
    private initialized = false;
    private memoryIterations: GenerationIteration[] = [];
    private memoryTestIterations: TestingIteration[] = [];
    private memoryPatterns: LearnedPattern[] = [];

    // Injected repositories
    private readonly generationIterationRepo: IGenerationIterationRepository;
    private readonly testingIterationRepo: ITestingIterationRepository;
    private readonly learnedPatternRepo: ILearnedPatternRepository;

    constructor(
        @inject(TYPES.GenerationIterationRepository) generationIterationRepo: IGenerationIterationRepository,
        @inject(TYPES.TestingIterationRepository) testingIterationRepo: ITestingIterationRepository,
        @inject(TYPES.LearnedPatternRepository) learnedPatternRepo: ILearnedPatternRepository,
        @inject(TYPES.Database) @optional() _database?: IDatabase,
        @inject(TYPES.VectorStore) @optional() vectorStore?: IVectorStore,
        @unmanaged() config?: Partial<LearningConfig>
    ) {
        this.generationIterationRepo = generationIterationRepo;
        this.testingIterationRepo = testingIterationRepo;
        this.learnedPatternRepo = learnedPatternRepo;

        this.config = {
            enabled: config?.enabled ?? true,
            relevanceThreshold: config?.relevanceThreshold ?? 0.65,
            maxExperiences: config?.maxExperiences ?? 5,
            successWeight: config?.successWeight ?? 1.0,
            failureWeight: config?.failureWeight ?? 0.8,
        };

        // Require vectorStore - no singleton fallback
        if (!vectorStore) {
            throw new Error('VectorStore is required for LearningService. Please provide it via DI container.');
        }
        this.vectorStore = vectorStore;
    }

    /**
     * Initialize the learning service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.vectorStore.initialize();

        // Load existing data from database
        await this.loadPatterns();
        await this.loadIterationsFromDatabase();

        console.log(`[LEARNING] Initialized with ${this.memoryIterations.length} iterations, ${this.memoryPatterns.length} patterns`);

        this.initialized = true;
    }

    /**
     * Load past iterations from database using repository
     */
    private async loadIterationsFromDatabase(): Promise<void> {
        try {
            const iterations = await this.generationIterationRepo.findRecent({ limit: 50 });
            this.memoryIterations = iterations;
            console.log(`[LEARNING] Loaded ${this.memoryIterations.length} iterations from database`);
        } catch (error) {
            console.warn('[LEARNING] Could not load iterations from database:', error);
        }
    }

    // ============================================
    // ITERATION STORAGE
    // ============================================

    /**
     * Store a generation iteration for learning using repository
     */
    async storeIteration(iteration: GenerationIteration): Promise<string> {
        if (!this.config.enabled) return 'learning-disabled';

        console.log(`[LEARNING] Storing iteration for task ${iteration.taskId}`);

        const iterationWithId = {
            ...iteration,
            id: iteration.id || `iter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: iteration.createdAt || new Date(),
        };

        // Store in memory
        this.memoryIterations.push(iterationWithId);

        // Store in database via repository
        try {
            await this.generationIterationRepo.create(iteration);
            console.log('[LEARNING] Successfully stored iteration in database');
        } catch (error) {
            console.warn('[LEARNING] Failed to store iteration in DB:', error);
        }

        // Index the prompt for similarity search
        await this.vectorStore.indexFile(
            'learning-iterations',
            `iteration-${iterationWithId.id}`,
            `PROMPT: ${iteration.prompt}\n\nRESULT: ${iteration.success ? 'SUCCESS' : 'FAILURE'}\n\n${iteration.errors.join('\n')}`
        );

        // Extract and store patterns
        if (iteration.success) {
            await this.extractSuccessPatterns(iteration);
        } else {
            await this.extractFailurePatterns(iteration);
        }

        console.log(`[LEARNING] Iteration ${iterationWithId.id} stored`);
        return iterationWithId.id;
    }

    /**
     * Store a testing iteration for pre-context building using repository
     */
    async storeTestIteration(iteration: TestingIteration): Promise<string> {
        if (!this.config.enabled) return 'learning-disabled';

        console.log(`[LEARNING] Storing test iteration: ${iteration.testDescription}`);

        const iterationWithId = {
            ...iteration,
            id: iteration.id || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: iteration.createdAt || new Date(),
        };

        // Store in memory
        this.memoryTestIterations.push(iterationWithId);

        // Store in database via repository
        try {
            await this.testingIterationRepo.create(iteration);
            console.log('[LEARNING] Successfully stored test iteration in database');
        } catch (error) {
            console.warn('[LEARNING] Failed to store test iteration in DB:', error);
        }

        // Index for similarity search
        await this.vectorStore.indexFile(
            'testing-iterations',
            `test-${iterationWithId.id}`,
            `TEST: ${iteration.testDescription}\nQUERY: ${iteration.userQuery || 'N/A'}\nEXPECTED: ${iteration.expectedBehavior}\nACTUAL: ${iteration.actualResult}\nLESSONS: ${iteration.lessons.join('; ')}`
        );

        return iterationWithId.id;
    }

    // ============================================
    // PATTERN EXTRACTION
    // ============================================

    /**
     * Extract successful patterns from an iteration
     */
    private async extractSuccessPatterns(iteration: GenerationIteration): Promise<void> {
        // Identify what made this generation successful
        const patterns: LearnedPattern[] = [];

        // Pattern: Successful prompt structure
        patterns.push({
            patternType: 'success',
            description: 'Successful generation pattern',
            example: iteration.generatedCode[0]?.content.slice(0, 500) || '',
            context: iteration.prompt,
            frequency: 1,
            confidence: iteration.feedback?.rating ? iteration.feedback.rating / 5 : 0.7,
            relatedPrompts: [iteration.prompt],
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Store patterns
        for (const pattern of patterns) {
            await this.storePattern(pattern);
        }
    }

    /**
     * Extract failure patterns to avoid
     */
    private async extractFailurePatterns(iteration: GenerationIteration): Promise<void> {
        const patterns: LearnedPattern[] = [];

        for (const error of iteration.errors) {
            patterns.push({
                patternType: 'failure',
                description: `Error pattern: ${error}`,
                example: error,
                context: iteration.prompt,
                frequency: 1,
                confidence: 0.6,
                relatedPrompts: [iteration.prompt],
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        for (const pattern of patterns) {
            await this.storePattern(pattern);
        }
    }

    /**
     * Store a learned pattern using repository
     */
    private async storePattern(pattern: LearnedPattern): Promise<void> {
        // Check if similar pattern exists
        const existingIndex = this.memoryPatterns.findIndex(
            p => p.description === pattern.description && p.patternType === pattern.patternType
        );

        if (existingIndex >= 0) {
            // Update existing pattern in memory
            const existing = this.memoryPatterns[existingIndex];
            existing.frequency++;
            existing.confidence = Math.min(1, existing.confidence + 0.1);
            existing.relatedPrompts.push(...pattern.relatedPrompts);
            existing.updatedAt = new Date();

            // Update frequency in database
            try {
                await this.learnedPatternRepo.updateFrequency(existing.id!);
            } catch (error) {
                console.warn('[LEARNING] Failed to update pattern frequency:', error);
            }
        } else {
            // Store new pattern
            const patternWithId = {
                ...pattern,
                id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            };
            this.memoryPatterns.push(patternWithId);

            // Store in database via repository
            try {
                await this.learnedPatternRepo.create(pattern);
                console.log('[LEARNING] Pattern stored in database successfully');
            } catch (error) {
                console.warn('[LEARNING] Failed to store pattern:', error);
            }
        }
    }

    /**
     * Load patterns from database using repository
     */
    private async loadPatterns(): Promise<void> {
        try {
            const patterns = await this.learnedPatternRepo.findTopPatterns({ limit: 100 });
            this.memoryPatterns = patterns;
        } catch (error) {
            console.warn('[LEARNING] Could not load patterns from database:', error);
        }
    }

    // ============================================
    // PRE-CONTEXT BUILDING
    // ============================================

    /**
     * Build pre-context for a new generation task
     * This retrieves relevant past experiences to improve generation quality
     */
    async buildPreContext(prompt: string, projectId?: string): Promise<PreContext> {
        console.log('[LEARNING] Building pre-context for prompt');

        const preContext: PreContext = {
            experiences: [],
            patterns: [],
            warnings: [],
            successProbability: 0.7, // Default
        };

        // Search for similar past iterations
        const similarIterations = await this.findSimilarIterations(prompt);

        let successCount = 0;
        let totalCount = 0;

        for (const iter of similarIterations) {
            preContext.experiences.push({
                prompt: iter.prompt,
                solution: iter.generatedCode[0]?.content.slice(0, 1000) || '',
                success: iter.success,
                relevance: 0.8, // Would come from similarity search
            });

            if (iter.success) successCount++;
            totalCount++;
        }

        // Calculate success probability
        if (totalCount > 0) {
            preContext.successProbability = successCount / totalCount;
        }

        // Get relevant patterns
        preContext.patterns = this.memoryPatterns
            .filter(p => p.confidence >= 0.5)
            .slice(0, 5);

        // Extract warnings from failure patterns
        preContext.warnings = this.memoryPatterns
            .filter(p => p.patternType === 'failure' && p.frequency >= 2)
            .map(p => p.description)
            .slice(0, 5);

        // Search knowledge_embeddings for relevant code examples
        try {
            const knowledgeResults = await this.searchKnowledgeEmbeddings(prompt, projectId);
            if (knowledgeResults.length > 0) {
                // Add relevant code snippets from knowledge base
                const snippets = knowledgeResults.slice(0, 2).map(r =>
                    `File: ${r.filePath}\n${r.content.slice(0, 500)}...`
                ).join('\n\n');

                if (snippets) {
                    preContext.suggestedApproach = `RELEVANT CODE FROM KNOWLEDGE BASE:\n${snippets}`;
                }
            }
        } catch (error) {
            console.warn('[LEARNING] Could not search knowledge embeddings:', error);
        }

        // Generate suggested approach from past experiences
        if (!preContext.suggestedApproach && preContext.experiences.length > 0) {
            const successfulExperience = preContext.experiences.find(e => e.success);
            if (successfulExperience) {
                preContext.suggestedApproach = `Based on similar successful task: ${successfulExperience.prompt.slice(0, 100)}...`;
            }
        }

        console.log(`[LEARNING] Pre-context built: ${preContext.experiences.length} experiences, ${preContext.warnings.length} warnings, ${preContext.patterns.length} patterns`);

        return preContext;
    }

    /**
     * Search knowledge_embeddings for relevant code context
     */
    private async searchKnowledgeEmbeddings(prompt: string, projectId?: string): Promise<Array<{ filePath: string; content: string; similarity: number }>> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        try {
            // Generate embedding for the prompt
            const embedding = await this.vectorStore.generateEmbedding(prompt);

            // Search knowledge_embeddings table directly
            const { data, error } = await supabase.rpc('match_knowledge_embeddings', {
                query_embedding: embedding,
                match_threshold: 0.6,
                match_count: 5,
                p_project_id: projectId || null
            });

            if (error) {
                // If the RPC doesn't exist, try a simpler query
                console.warn('[LEARNING] match_knowledge_embeddings RPC not found, using fallback');
                return [];
            }

            return (data || []).map((row: Record<string, unknown>) => ({
                filePath: row.file_path as string || 'unknown',
                content: row.content as string || '',
                similarity: row.similarity as number || 0,
            }));
        } catch (error) {
            console.warn('[LEARNING] Knowledge embedding search failed:', error);
            // Try fallback direct query
            return await this.fallbackCodeSearch(projectId);
        }
    }

    /**
     * Fallback: Get recent code embeddings directly without vector search
     */
    private async fallbackCodeSearch(projectId?: string): Promise<Array<{ filePath: string; content: string; similarity: number }>> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        try {
            let query = supabase
                .from('code_embeddings')
                .select('file_path, content')
                .order('created_at', { ascending: false })
                .limit(5);

            if (projectId) {
                query = query.eq('project_id', projectId);
            }

            const { data, error } = await query;

            if (error || !data) {
                return [];
            }

            return data.map((row: { file_path: string; content: string }) => ({
                filePath: row.file_path || 'unknown',
                content: row.content || '',
                similarity: 0.5, // Default similarity for fallback
            }));
        } catch {
            return [];
        }
    }

    /**
     * Find similar past iterations using database + memory search
     * Uses the existing 200+ iterations stored in Supabase
     */
    private async findSimilarIterations(prompt: string): Promise<GenerationIteration[]> {
        const matchedIterations: GenerationIteration[] = [];

        // 1. Try database RPC search first (uses pg_trgm text similarity)
        const supabase = getSupabaseAdmin();
        if (supabase) {
            try {
                const { data, error } = await supabase.rpc('search_generation_iterations', {
                    search_query: prompt,
                    max_results: this.config.maxExperiences,
                    only_successful: false
                });

                if (!error && data && data.length > 0) {
                    console.log(`[LEARNING] Found ${data.length} similar iterations via RPC`);

                    for (const row of data) {
                        if (row.similarity > 0.1) { // Any relevance
                            matchedIterations.push({
                                id: row.id,
                                taskId: row.task_id,
                                projectId: row.project_id,
                                prompt: row.prompt,
                                generatedCode: row.generated_code || [],
                                config: row.config || {},
                                success: row.success,
                                errors: row.errors || [],
                                metrics: { duration: 0, tokensUsed: 0 },
                                createdAt: new Date(row.created_at),
                            });
                        }
                    }
                }
            } catch (rpcError) {
                console.warn('[LEARNING] RPC search failed, trying direct query');
            }
        }

        // 2. If RPC failed, try direct database query with keyword matching
        if (matchedIterations.length === 0 && supabase) {
            try {
                // Extract keywords from prompt
                const keywords = prompt.toLowerCase()
                    .split(/\s+/)
                    .filter(w => w.length > 3)
                    .slice(0, 5);

                if (keywords.length > 0) {
                    const { data, error } = await supabase
                        .from('generation_iterations')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(this.config.maxExperiences * 3);

                    if (!error && data) {
                        // Filter and score by keyword matches
                        const scored = data
                            .map((row: GenerationIterationRow) => {
                                const promptLower = (row.prompt || '').toLowerCase();
                                const matchCount = keywords.filter(kw => promptLower.includes(kw)).length;
                                return { row, score: matchCount / keywords.length };
                            })
                            .filter(item => item.score > 0.2)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, this.config.maxExperiences);

                        console.log(`[LEARNING] Found ${scored.length} iterations via keyword search`);

                        for (const { row } of scored) {
                            matchedIterations.push({
                                id: row.id,
                                taskId: row.task_id,
                                projectId: row.project_id,
                                prompt: row.prompt,
                                generatedCode: row.generated_code || [],
                                config: row.config || {},
                                success: row.success ?? false,
                                errors: row.errors || [],
                                metrics: row.metrics || { duration: 0, tokensUsed: 0 },
                                createdAt: new Date(row.created_at),
                            });
                        }
                    }
                }
            } catch (dbError) {
                console.warn('[LEARNING] Direct DB query failed:', dbError);
            }
        }

        // 3. Also try vector search for semantic matches
        if (matchedIterations.length < this.config.maxExperiences) {
            const searchResults = await this.vectorStore.search(prompt, {
                projectId: 'learning-iterations',
                limit: this.config.maxExperiences - matchedIterations.length,
                threshold: 0.5,
            });

            for (const result of searchResults) {
                const idMatch = result.chunk.filePath.match(/iteration-([a-z0-9-]+)/);
                if (idMatch) {
                    const iteration = this.memoryIterations.find(i => i.id === idMatch[1]);
                    if (iteration && !matchedIterations.find(m => m.id === iteration.id)) {
                        matchedIterations.push(iteration);
                    }
                }
            }
        }

        // 4. Final fallback: memory search with text similarity
        if (matchedIterations.length === 0 && this.memoryIterations.length > 0) {
            console.log('[LEARNING] Using memory fallback search');
            return this.memoryIterations
                .filter(i => this.textSimilarity(i.prompt, prompt) > 0.2)
                .slice(0, this.config.maxExperiences);
        }

        return matchedIterations;
    }

    /**
     * Simple text similarity (Jaccard)
     */
    private textSimilarity(a: string, b: string): number {
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));

        const intersection = Array.from(wordsA).filter(w => wordsB.has(w)).length;
        const union = new Set([...Array.from(wordsA), ...Array.from(wordsB)]).size;

        return union === 0 ? 0 : intersection / union;
    }

    // ============================================
    // FEEDBACK PROCESSING
    // ============================================

    /**
     * Process user feedback to improve learning
     */
    async processFeedback(
        iterationId: string,
        feedback: GenerationIteration['feedback']
    ): Promise<void> {
        const iteration = this.memoryIterations.find(i => i.id === iterationId);
        if (!iteration) return;

        iteration.feedback = feedback;

        // Update success weight based on rating
        if (feedback && feedback.rating >= 4) {
            await this.extractSuccessPatterns(iteration);
        } else if (feedback && feedback.rating <= 2) {
            await this.extractFailurePatterns({
                ...iteration,
                errors: [...iteration.errors, ...(feedback.issues || [])],
            });
        }

        // Store in database
        const supabase = getSupabaseAdmin();
        if (supabase) {
            try {
                await supabase
                    .from('generation_iterations')
                    .update({ feedback })
                    .eq('id', iterationId);
            } catch (error) {
                // Ignore
            }
        }

        console.log(`[LEARNING] Processed feedback for ${iterationId}: rating ${feedback?.rating}`);
    }

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Get learning statistics
     */
    getStatistics(): {
        totalIterations: number;
        successfulIterations: number;
        failedIterations: number;
        patternsLearned: number;
        successRate: number;
        testIterations: number;
    } {
        const successful = this.memoryIterations.filter(i => i.success).length;
        const total = this.memoryIterations.length;

        return {
            totalIterations: total,
            successfulIterations: successful,
            failedIterations: total - successful,
            patternsLearned: this.memoryPatterns.length,
            successRate: total > 0 ? successful / total : 0,
            testIterations: this.memoryTestIterations.length,
        };
    }

    /**
     * Get all learned patterns
     */
    getPatterns(): LearnedPattern[] {
        return [...this.memoryPatterns];
    }
}

// ============================================
// BACKWARD COMPATIBILITY
// ============================================
// These will be removed once all code is migrated to DI

let learningServiceInstance: LearningService | null = null;

/**
 * @deprecated Use DI container instead. Call getDIContainer().get(TYPES.LearningService)
 */
export function getLearningService(): LearningService {
    if (!learningServiceInstance) {
        // Try to get from DI container first
        try {
            const { getDIContainer } = require('../../../di/types.js');
            const { TYPES } = require('../../../di/types.js');
            const container = getDIContainer();
            learningServiceInstance = container.get(TYPES.LearningService);
        } catch {
            // Fallback to old pattern if DI not initialized
            throw new Error('LearningService requires DI container. Please initialize DI container first using initDIContainer().');
        }
    }
    return learningServiceInstance!;
}

/**
 * @deprecated Use DI container instead
 */
export function createLearningService(config?: Partial<LearningConfig>): LearningService {
    learningServiceInstance = new LearningService(undefined as any, undefined as any, undefined as any, undefined, undefined, config);
    return learningServiceInstance;
}
