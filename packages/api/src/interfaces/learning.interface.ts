/**
 * Learning Service Interface
 *
 * Defines the contract for AI learning and pattern extraction services.
 */

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

/**
 * Learning Service interface
 * Manages AI learning from iterations and pattern extraction
 */
export interface ILearningService {
    /**
     * Initialize the learning service
     */
    initialize(): Promise<void>;

    /**
     * Store a generation iteration for learning
     */
    storeIteration(iteration: GenerationIteration): Promise<string>;

    /**
     * Store a testing iteration for pre-context building
     */
    storeTestIteration(iteration: TestingIteration): Promise<string>;

    /**
     * Build pre-context for a new generation task
     */
    buildPreContext(prompt: string, projectId?: string): Promise<PreContext>;

    /**
     * Process user feedback to improve learning
     */
    processFeedback(
        iterationId: string,
        feedback: GenerationIteration['feedback']
    ): Promise<void>;

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
    };

    /**
     * Get all learned patterns
     */
    getPatterns(): LearnedPattern[];
}
