/**
 * Generation Service
 * Phase 1, Week 1, Day 7-8: AI Code Generation
 *
 * This service handles:
 * - Generating code from prompts using AI models
 * - Managing model selection and retries
 * - Tracking generation metrics
 * - Validating generated code
 *
 * Replaces the generation logic from the monolithic IntegratedOrchestrator.
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../di/types.js';
import type { IGenerationService, GenerationRequest, GenerationResult } from '../../../interfaces/generation.interface.js';
import type { ICodeGenerator, CodeGenerationRequest } from '../../../interfaces/generator.interface.js';
import type { IAIClient } from '../../../interfaces/generator.interface.js';
import type { Subtask } from '../../../interfaces/planning.interface.js';

@injectable()
export class GenerationService implements IGenerationService {
    private statistics = {
        totalGenerations: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        totalTokens: 0,
        totalDuration: 0,
    };

    constructor(
        @inject(TYPES.CodeGenerator) private codeGenerator?: ICodeGenerator,
        @inject(TYPES.AIClient) private readonly _aiClient?: IAIClient
    ) { }

    /**
     * Generate code based on a request
     */
    async generate(request: GenerationRequest): Promise<GenerationResult> {
        const startTime = Date.now();
        console.log(`[GenerationService] Generating for subtask: ${request.subtask.title}`);

        this.statistics.totalGenerations++;

        try {
            // Prepare the generation prompt
            const prompt = this.buildGenerationPrompt(request);

            // Call the code generator
            const generationRequest: CodeGenerationRequest = {
                prompt,
                context: {
                    language: request.options?.model || 'typescript',
                    framework: this.detectFramework(request.prompt),
                    existingCode: request.context?.previousCode,
                },
                config: {
                    subtask: request.subtask.title,
                    projectId: request.projectId,
                    userId: request.userId,
                    ...request.options,
                },
            };

            // Validate code generator exists before using
            if (!this.codeGenerator) {
                throw new Error('CodeGenerator not available. Check DI container configuration.');
            }

            const result = await this.codeGenerator.generate(generationRequest);
            const duration = Date.now() - startTime;

            // Build the response
            const generationResult: GenerationResult = {
                code: result.code,
                files: result.files.map(f => ({
                    path: f.path,
                    content: f.content,
                    language: f.language || 'typescript',
                })),
                explanation: result.explanation,
                success: result.success,
                errors: result.errors,
                metrics: {
                    duration,
                    tokensUsed: result.metadata?.tokensUsed as number || 0,
                    cost: result.metadata?.cost as number || 0,
                    model: request.options?.model || 'gpt-4',
                    retries: 0,
                },
                metadata: {
                    confidence: result.metadata?.confidence as number || 0.8,
                },
            };

            if (generationResult.success) {
                this.statistics.successfulGenerations++;
                this.statistics.totalTokens += generationResult.metrics.tokensUsed;
                this.statistics.totalDuration += duration;
            } else {
                this.statistics.failedGenerations++;
            }

            console.log(`[GenerationService] Generation ${generationResult.success ? 'succeeded' : 'failed'} in ${duration}ms`);

            return generationResult;
        } catch (error) {
            this.statistics.failedGenerations++;
            const duration = Date.now() - startTime;

            return {
                code: '',
                files: [],
                explanation: '',
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                metrics: {
                    duration,
                    tokensUsed: 0,
                    model: request.options?.model || 'gpt-4',
                    retries: 0,
                },
            };
        }
    }

    /**
     * Generate a specific subtask
     */
    async generateSubtask(
        subtask: Subtask,
        context: string,
        options?: GenerationRequest['options']
    ): Promise<GenerationResult> {
        return this.generate({
            prompt: `Generate code for: ${subtask.title}\n\nContext: ${context}`,
            subtask,
            context: { previousCode: context },
            options,
        });
    }

    /**
     * Generate with retry logic
     */
    async generateWithRetry(
        request: GenerationRequest,
        maxRetries: number = 3
    ): Promise<GenerationResult> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const result = await this.generate(request);
                if (result.success) {
                    result.metrics.retries = attempt;
                    return result;
                }
                lastError = new Error(result.errors.join(', '));
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
            }

            // Wait before retry with exponential backoff
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }

        // All retries failed
        return {
            code: '',
            files: [],
            explanation: '',
            success: false,
            errors: [lastError?.message || 'Generation failed after retries'],
            metrics: {
                duration: 0,
                tokensUsed: 0,
                model: request.options?.model || 'gpt-4',
                retries: maxRetries,
            },
        };
    }

    /**
     * Validate generation result
     */
    async validateGeneration(result: GenerationResult): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if code was generated
        if (!result.code || result.code.trim().length === 0) {
            errors.push('No code was generated');
        }

        // Check for syntax errors (basic)
        if (result.code) {
            const hasUnclosedBraces = (result.code.match(/{/g) || []).length !==
                (result.code.match(/}/g) || []).length;
            if (hasUnclosedBraces) {
                errors.push('Code has unclosed braces');
            }

            const hasUnclosedParens = (result.code.match(/\(/g) || []).length !==
                (result.code.match(/\)/g) || []).length;
            if (hasUnclosedParens) {
                errors.push('Code has unclosed parentheses');
            }
        }

        // Check for common issues
        if (result.code.includes('TODO') || result.code.includes('FIXME')) {
            warnings.push('Generated code contains TODO/FIXME comments');
        }

        if (result.code.length < 50) {
            warnings.push('Generated code is very short');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Get generation statistics
     */
    getStatistics() {
        return {
            totalGenerations: this.statistics.totalGenerations,
            successfulGenerations: this.statistics.successfulGenerations,
            failedGenerations: this.statistics.failedGenerations,
            averageTokens: this.statistics.totalGenerations > 0
                ? this.statistics.totalTokens / this.statistics.totalGenerations
                : 0,
            averageDuration: this.statistics.totalGenerations > 0
                ? this.statistics.totalDuration / this.statistics.totalGenerations
                : 0,
        };
    }

    /**
     * Build a comprehensive generation prompt
     */
    private buildGenerationPrompt(request: GenerationRequest): string {
        const parts: string[] = [];

        // Add task description
        parts.push(`Task: ${request.subtask.title}`);
        parts.push(`Description: ${request.subtask.description}`);

        // Add context if available
        if (request.context?.previousCode) {
            parts.push(`\nExisting Code:\n${request.context.previousCode}`);
        }

        if (request.context?.dependencies?.length) {
            parts.push(`\nDependencies: ${request.context.dependencies.join(', ')}`);
        }

        if (request.context?.constraints?.length) {
            parts.push(`\nConstraints:\n${request.context.constraints.join('\n')}`);
        }

        // Add requirements
        parts.push('\nRequirements:');
        parts.push('- Write clean, production-ready code');
        parts.push('- Include proper error handling');
        parts.push('- Follow TypeScript best practices');
        parts.push('- Add relevant comments for complex logic');

        if (request.options?.includeTests) {
            parts.push('- Include unit tests');
        }

        if (request.options?.includeComments) {
            parts.push('- Include detailed comments');
        }

        return parts.join('\n');
    }

    /**
     * Detect framework from prompt
     */
    private detectFramework(prompt: string): string {
        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes('fastify')) return 'fastify';
        if (lowerPrompt.includes('express')) return 'express';
        if (lowerPrompt.includes('fastapi')) return 'fastapi';
        if (lowerPrompt.includes('django')) return 'django';
        if (lowerPrompt.includes('spring')) return 'spring';

        return 'fastify'; // Default
    }
}
