/**
 * AI Learning Service
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

import { getSupabaseAdmin } from './database-client.js';
import { getVectorStore, type VectorStoreService } from './vector-store.js';

// ============================================
// TYPES
// ============================================

export interface LearningConfig {
    /** Enable learning (store iterations) */
    enabled: boolean;
    /** Minimum similarity to consider as relevant experience */
    relevanceThreshold: number;
    /** Maximum number of past experiences to retrieve */
    maxExperiences: number;
    /** Weight given to successful iterations */
    successWeight: number;
    /** Weight given to failed iterations (for avoidance) */
    failureWeight: number;
}

export interface GenerationIteration {
    id?: string;
    taskId: string;
    projectId: string;
    userId?: string;
    /** The original user prompt */
    prompt: string;
    /** Generated code files */
    generatedCode: Array<{
        path: string;
        content: string;
        language: string;
    }>;
    /** Configuration used for generation */
    config: Record<string, unknown>;
    /** Was the generation successful? */
    success: boolean;
    /** Any errors encountered */
    errors: string[];
    /** User feedback (if provided) */
    feedback?: {
        rating: 1 | 2 | 3 | 4 | 5;
        comments?: string;
        issues?: string[];
    };
    /** Test results (if tests were run) */
    testResults?: {
        passed: number;
        failed: number;
        skipped: number;
        coverage?: number;
    };
    /** Execution metrics */
    metrics: {
        duration: number;
        tokensUsed: number;
        cost?: number;
    };
    /** Timestamp */
    createdAt: Date;
}

export interface TestingIteration {
    id?: string;
    projectId: string;
    testType: 'unit' | 'integration' | 'e2e' | 'manual';
    /** What was tested */
    testDescription: string;
    /** User query/action that prompted the test */
    userQuery?: string;
    /** Expected behavior */
    expectedBehavior: string;
    /** Actual result */
    actualResult: string;
    /** Was the test successful? */
    success: boolean;
    /** Lessons learned */
    lessons: string[];
    /** Related file paths */
    relatedFiles: string[];
    /** Tags for categorization */
    tags: string[];
    createdAt: Date;
}

export interface LearnedPattern {
    id?: string;
    patternType: 'success' | 'failure' | 'warning';
    /** Description of the pattern */
    description: string;
    /** Code example */
    example: string;
    /** When this pattern applies */
    context: string;
    /** How often this pattern was seen */
    frequency: number;
    /** Confidence score (0-1) */
    confidence: number;
    /** Related prompts that triggered this pattern */
    relatedPrompts: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface PreContext {
    /** Relevant past experiences */
    experiences: Array<{
        prompt: string;
        solution: string;
        success: boolean;
        relevance: number;
    }>;
    /** Common patterns for this type of task */
    patterns: LearnedPattern[];
    /** Warnings/pitfalls to avoid */
    warnings: string[];
    /** Suggested approach based on past iterations */
    suggestedApproach?: string;
    /** Estimated success probability */
    successProbability: number;
}

// ============================================
// LEARNING SERVICE
// ============================================

export class LearningService {
    private config: LearningConfig;
    private vectorStore: VectorStoreService;
    private initialized = false;
    private memoryIterations: GenerationIteration[] = [];
    private memoryTestIterations: TestingIteration[] = [];
    private memoryPatterns: LearnedPattern[] = [];

    constructor(config?: Partial<LearningConfig>) {
        this.config = {
            enabled: config?.enabled ?? true,
            relevanceThreshold: config?.relevanceThreshold ?? 0.65,
            maxExperiences: config?.maxExperiences ?? 5,
            successWeight: config?.successWeight ?? 1.0,
            failureWeight: config?.failureWeight ?? 0.8,
        };

        this.vectorStore = getVectorStore();
    }

    /**
     * Initialize the learning service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.vectorStore.initialize();

        // Load existing patterns from database
        await this.loadPatterns();

        this.initialized = true;
    }

    // ============================================
    // ITERATION STORAGE
    // ============================================

    /**
     * Store a generation iteration for learning
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

        // Store in database
        const supabase = getSupabaseAdmin();
        if (supabase) {
            try {
                await supabase.from('generation_iterations').insert({
                    id: iterationWithId.id,
                    task_id: iteration.taskId,
                    project_id: iteration.projectId,
                    user_id: iteration.userId,
                    prompt: iteration.prompt,
                    generated_code: iteration.generatedCode,
                    config: iteration.config,
                    success: iteration.success,
                    errors: iteration.errors,
                    feedback: iteration.feedback,
                    test_results: iteration.testResults,
                    metrics: iteration.metrics,
                    created_at: iterationWithId.createdAt.toISOString(),
                });
            } catch (error) {
                console.warn('[LEARNING] Failed to store iteration in DB:', error);
            }
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
     * Store a testing iteration for pre-context building
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

        // Store in database
        const supabase = getSupabaseAdmin();
        if (supabase) {
            try {
                await supabase.from('testing_iterations').insert({
                    id: iterationWithId.id,
                    project_id: iteration.projectId,
                    test_type: iteration.testType,
                    test_description: iteration.testDescription,
                    user_query: iteration.userQuery,
                    expected_behavior: iteration.expectedBehavior,
                    actual_result: iteration.actualResult,
                    success: iteration.success,
                    lessons: iteration.lessons,
                    related_files: iteration.relatedFiles,
                    tags: iteration.tags,
                    created_at: iterationWithId.createdAt.toISOString(),
                });
            } catch (error) {
                console.warn('[LEARNING] Failed to store test iteration in DB:', error);
            }
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
     * Store a learned pattern
     */
    private async storePattern(pattern: LearnedPattern): Promise<void> {
        // Check if similar pattern exists
        const existingIndex = this.memoryPatterns.findIndex(
            p => p.description === pattern.description && p.patternType === pattern.patternType
        );

        if (existingIndex >= 0) {
            // Update existing pattern
            const existing = this.memoryPatterns[existingIndex];
            existing.frequency++;
            existing.confidence = Math.min(1, existing.confidence + 0.1);
            existing.relatedPrompts.push(...pattern.relatedPrompts);
            existing.updatedAt = new Date();
        } else {
            // Store new pattern
            const patternWithId = {
                ...pattern,
                id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            };
            this.memoryPatterns.push(patternWithId);

            // Store in database
            const supabase = getSupabaseAdmin();
            if (supabase) {
                try {
                    await supabase.from('learned_patterns').insert({
                        id: patternWithId.id,
                        pattern_type: pattern.patternType,
                        description: pattern.description,
                        example: pattern.example,
                        context: pattern.context,
                        frequency: pattern.frequency,
                        confidence: pattern.confidence,
                        related_prompts: pattern.relatedPrompts,
                    });
                } catch (error) {
                    // Table might not exist, that's ok
                }
            }
        }
    }

    /**
     * Load patterns from database
     */
    private async loadPatterns(): Promise<void> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return;

        try {
            const { data, error } = await supabase
                .from('learned_patterns')
                .select('*')
                .order('frequency', { ascending: false })
                .limit(100);

            if (!error && data) {
                this.memoryPatterns = data.map((row: Record<string, unknown>) => ({
                    id: row.id as string,
                    patternType: row.pattern_type as LearnedPattern['patternType'],
                    description: row.description as string,
                    example: row.example as string,
                    context: row.context as string,
                    frequency: row.frequency as number,
                    confidence: row.confidence as number,
                    relatedPrompts: row.related_prompts as string[],
                    createdAt: new Date(row.created_at as string),
                    updatedAt: new Date(row.updated_at as string),
                }));
            }
        } catch (error) {
            // Table might not exist yet
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

        // Generate suggested approach
        if (preContext.experiences.length > 0) {
            const successfulExperience = preContext.experiences.find(e => e.success);
            if (successfulExperience) {
                preContext.suggestedApproach = `Based on similar successful task: ${successfulExperience.prompt.slice(0, 100)}...`;
            }
        }

        console.log(`[LEARNING] Pre-context built: ${preContext.experiences.length} experiences, ${preContext.warnings.length} warnings`);

        return preContext;
    }

    /**
     * Find similar past iterations using vector search
     */
    private async findSimilarIterations(prompt: string): Promise<GenerationIteration[]> {
        // First try vector search
        const searchResults = await this.vectorStore.search(prompt, {
            projectId: 'learning-iterations',
            limit: this.config.maxExperiences,
            threshold: this.config.relevanceThreshold,
        });

        // If we got results, find the matching iterations
        const matchedIterations: GenerationIteration[] = [];

        for (const result of searchResults) {
            // Extract iteration ID from file path
            const idMatch = result.chunk.filePath.match(/iteration-([a-z0-9-]+)/);
            if (idMatch) {
                const iteration = this.memoryIterations.find(i => i.id === idMatch[1]);
                if (iteration) {
                    matchedIterations.push(iteration);
                }
            }
        }

        // Fall back to memory search if no results
        if (matchedIterations.length === 0) {
            return this.memoryIterations
                .filter(i => this.textSimilarity(i.prompt, prompt) > this.config.relevanceThreshold)
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
// SINGLETON
// ============================================

let learningServiceInstance: LearningService | null = null;

export function getLearningService(): LearningService {
    if (!learningServiceInstance) {
        learningServiceInstance = new LearningService();
    }
    return learningServiceInstance;
}

export function createLearningService(config?: Partial<LearningConfig>): LearningService {
    learningServiceInstance = new LearningService(config);
    return learningServiceInstance;
}
