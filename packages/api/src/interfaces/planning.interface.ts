/**
 * Planning Service Interface
 *
 * Defines the contract for request analysis and task planning.
 * This service handles:
 * - Analyzing user prompts to understand requirements
 * - Breaking down complex tasks into subtasks
 * - Estimating complexity and resource needs
 * - Determining execution strategy
 */

export interface PlanningRequest {
    /** User's original prompt */
    prompt: string;
    /** Project ID for context */
    projectId?: string;
    /** User ID for personalization */
    userId?: string;
    /** Additional context from previous conversations */
    context?: string;
    /** Tech stack constraints */
    techStack?: string[];
}

export interface Subtask {
    id: string;
    title: string;
    description: string;
    order: number;
    dependencies: string[];
    estimatedDuration: number;
    complexity: 'simple' | 'moderate' | 'complex';
    requiredCapabilities: string[];
}

export interface PlanningResult {
    /** Overall analysis of the request */
    analysis: {
        complexity: 'simple' | 'moderate' | 'complex';
        estimatedDuration: number;
        estimatedSubtasks: number;
        confidence: number;
    };
    /** Breakdown into subtasks */
    subtasks: Subtask[];
    /** Required resources */
    requirements: {
        needsAuthentication: boolean;
        needsDatabase: boolean;
        needsAPI: boolean;
        needsFileOperations: boolean;
        suggestedFramework?: string;
        suggestedLanguage?: string;
    };
    /** Execution strategy */
    strategy: {
        approach: 'incremental' | 'parallel' | 'sequential';
        reasoning: string;
        recommendedFirstStep: string;
    };
}

export interface ComplexityAnalysis {
    complexity: 'simple' | 'moderate' | 'complex';
    confidence: number;
    factors: {
        hasMultipleFiles: boolean;
        hasDatabaseOperations: boolean;
        hasAuthentication: boolean;
        hasExternalAPIs: boolean;
        estimatedLinesOfCode: number;
    };
    reasoning: string;
}

/**
 * Planning Service interface
 * Analyzes requests and creates execution plans
 */
export interface IPlanningService {
    /**
     * Analyze a request and create a plan
     */
    plan(request: PlanningRequest): Promise<PlanningResult>;

    /**
     * Analyze the complexity of a request
     */
    analyzeComplexity(request: PlanningRequest): Promise<ComplexityAnalysis>;

    /**
     * Break down a request into subtasks
     */
    createSubtasks(request: PlanningRequest, complexity: ComplexityAnalysis): Promise<Subtask[]>;

    /**
     * Determine execution strategy
     */
    determineStrategy(subtasks: Subtask[], complexity: ComplexityAnalysis): {
        approach: 'incremental' | 'parallel' | 'sequential';
        reasoning: string;
        recommendedFirstStep: string;
    };
}
