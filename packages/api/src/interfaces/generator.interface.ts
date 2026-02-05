/**
 * Code Generator Interfaces
 *
 * Defines the contract for AI-powered code generation services.
 */

import type { OrchestrationInput } from './orchestration.interface.js';

export interface CodeGenerationRequest {
    prompt: string;
    context: GenerationContext;
    agent?: string;
    config?: Record<string, unknown>;
}

export interface CodeGenerationResult {
    code: string;
    files: GeneratedFile[];
    explanation: string;
    success: boolean;
    errors: string[];
    metadata?: Record<string, unknown>;
}

export interface GeneratedFile {
    path: string;
    content: string;
    language: string;
    type: 'code' | 'config' | 'test' | 'doc' | 'schema';
}

export interface GenerationContext {
    language?: string;
    framework?: string;
    database?: string;
    authProvider?: string;
    features?: string[];
    techStack?: string[];
    existingCode?: string;
    entities?: ExtractedEntity[];
    previousDecisions?: ContextDecision[];
    corrections?: string[];
}

export interface ExtractedEntity {
    type: string;
    name: string;
    properties: Record<string, unknown>;
    source: 'user' | 'system' | 'inferred';
}

export interface ContextDecision {
    id: string;
    description: string;
    reasoning: string;
    timestamp: Date;
}

export interface AITool {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
}

/**
 * AI Client interface
 * Handles communication with AI/LLM providers
 */
export interface IAIClient {
    /**
     * Complete a chat prompt
     */
    complete(
        prompt: string,
        options?: {
            model?: string;
            maxTokens?: number;
            temperature?: number;
            tools?: AITool[];
        }
    ): Promise<string>;

    /**
     * Complete with messages (for chat-style APIs)
     */
    chat(
        messages: Array<{ role: string; content: string }>,
        options?: {
            model?: string;
            maxTokens?: number;
            temperature?: number;
        }
    ): Promise<string>;

    /**
     * Get available models
     */
    getAvailableModels(): string[];

    /**
     * Estimate token count
     */
    estimateTokens(text: string): number;
}

/**
 * Multi-Model Orchestrator interface
 * Coordinates multiple AI models for different tasks
 */
export interface IMultiModelOrchestrator {
    /**
     * Analyze a request using a fast model
     */
    analyze(request: OrchestrationInput): Promise<AnalysisResult>;

    /**
     * Generate code using the appropriate model
     */
    generate(request: CodeGenerationRequest): Promise<CodeGenerationResult>;

    /**
     * Select the best model for a task
     */
    selectModel(task: string, complexity: string): string;
}

export interface AnalysisResult {
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedSubtasks: number;
    estimatedDuration: number;
    needsAuthentication: boolean;
    needsDatabase: boolean;
    needsAPI: boolean;
}

/**
 * Code Generator interface
 * Main code generation service
 */
export interface ICodeGenerator {
    /**
     * Generate code based on input
     */
    generate(request: CodeGenerationRequest): Promise<CodeGenerationResult>;

    /**
     * Generate from template
     */
    generateFromTemplate(template: string, context: GenerationContext): Promise<CodeGenerationResult>;

    /**
     * Validate generated code
     */
    validate(result: CodeGenerationResult): Promise<ValidationResult>;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

export interface ValidationWarning {
    file: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
}
