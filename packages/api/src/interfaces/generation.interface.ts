/**
 * Generation Service Interface
 *
 * Defines the contract for AI-powered code generation.
 * This service handles:
 * - Generating code from prompts
 * - Managing AI model selection
 * - Handling generation retries and fallbacks
 * - Tracking generation metrics
 */

import type { Subtask } from './planning.interface.js';

export interface GenerationRequest {
    /** What to generate */
    prompt: string;
    /** Subtask being worked on */
    subtask: Subtask;
    /** Project context */
    projectId?: string;
    /** User preferences */
    userId?: string;
    /** Additional context from previous steps */
    context?: {
        previousCode?: string;
        dependencies?: string[];
        constraints?: string[];
    };
    /** Generation options */
    options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        includeTests?: boolean;
        includeComments?: boolean;
    };
}

export interface GenerationMetrics {
    /** Time taken to generate */
    duration: number;
    /** Tokens used */
    tokensUsed: number;
    /** Estimated cost */
    cost?: number;
    /** Model used */
    model: string;
    /** Number of retries */
    retries: number;
}

export interface GenerationResult {
    /** Generated code */
    code: string;
    /** Generated files */
    files: Array<{
        path: string;
        content: string;
        language: string;
    }>;
    /** Explanation of what was generated */
    explanation: string;
    /** Whether generation was successful */
    success: boolean;
    /** Any errors encountered */
    errors: string[];
    /** Generation metrics */
    metrics: GenerationMetrics;
    /** Additional metadata */
    metadata?: {
        confidence?: number;
        suggestions?: string[];
        warnings?: string[];
    };
}

/**
 * Generation Service interface
 * Handles AI code generation
 */
export interface IGenerationService {
    /**
     * Generate code based on a request
     */
    generate(request: GenerationRequest): Promise<GenerationResult>;

    /**
     * Generate a specific subtask
     */
    generateSubtask(
        subtask: Subtask,
        context: string,
        options?: GenerationRequest['options']
    ): Promise<GenerationResult>;

    /**
     * Generate with retry logic
     */
    generateWithRetry(
        request: GenerationRequest,
        maxRetries?: number
    ): Promise<GenerationResult>;

    /**
     * Validate generation result before returning
     */
    validateGeneration(result: GenerationResult): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }>;

    /**
     * Get generation statistics
     */
    getStatistics(): {
        totalGenerations: number;
        successfulGenerations: number;
        failedGenerations: number;
        averageTokens: number;
        averageDuration: number;
    };
}
