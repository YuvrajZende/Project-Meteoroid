/**
 * Orchestration Service
 * Phase 1, Week 1, Day 9-10: Service Facade
 *
 * This service acts as a facade that coordinates:
 * - PlanningService: Analyze and break down tasks
 * - GenerationService: Generate code
 * - ValidationService: Validate generated code
 *
 * Replaces the monolithic IntegratedOrchestrator with a clean,
 * coordinated architecture following the Facade pattern.
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../di/types.js';
import type { IOrchestrator, OrchestrationInput, OrchestrationResult, OrchestratorStatus, ProgressCallback } from '../../../interfaces/orchestration.interface.js';
import type { IPlanningService } from '../../../interfaces/planning.interface.js';
import type { IGenerationService } from '../../../interfaces/generation.interface.js';
import type { IValidationService } from '../../../interfaces/validation.interface.js';
import type { IContextManager } from '../../../interfaces/context.interface.js';
import type { ILearningService } from '../../../interfaces/learning.interface.js';

// Import ValidationResult for use in method
import type { ValidationResult } from '../../../interfaces/validation.interface.js';

@injectable()
export class OrchestrationService implements IOrchestrator {
    constructor(
        @inject(TYPES.PlanningService) private planningService: IPlanningService,
        @inject(TYPES.GenerationService) private generationService: IGenerationService,
        @inject(TYPES.ValidationService) private validationService: IValidationService,
        @inject(TYPES.ContextManager) private readonly _contextManager?: IContextManager,
        @inject(TYPES.LearningService) private learningService?: ILearningService
    ) { }

    /**
     * Main orchestration method
     * Coordinates planning, generation, and validation
     */
    async orchestrate(
        input: OrchestrationInput,
        onProgress?: ProgressCallback
    ): Promise<OrchestrationResult> {
        const requestId = input.taskId || crypto.randomUUID();
        console.log(`[OrchestrationService] Starting orchestration ${requestId}`);
        console.log(`[OrchestrationService] Prompt: ${input.prompt.slice(0, 100)}...`);

        const startTime = Date.now();
        const errors: string[] = [];
        const warnings: string[] = [];
        const generatedFiles: OrchestrationResult['files'] = [];
        const subtaskResults: OrchestrationResult['subtasks'] = [];

        try {
            // Step 1: Planning
            console.log(`[OrchestrationService] Step 1: Planning`);
            if (onProgress) {
                onProgress({
                    phase: 'planning',
                    step: 'analyze',
                    message: 'Analyzing request and creating plan',
                    progress: 10,
                });
            }

            const planningResult = await this.planningService.plan({
                prompt: input.prompt,
                projectId: input.projectId,
                userId: input.userId,
                context: typeof input.context === 'string' ? input.context : undefined,
                techStack: input.context?.techStack || [],
            });

            // Step 2: Generate code for each subtask
            console.log(`[OrchestrationService] Step 2: Generation (${planningResult.subtasks.length} subtasks)`);

            if (onProgress) {
                onProgress({
                    phase: 'generation',
                    step: 'start',
                    message: `Starting generation for ${planningResult.subtasks.length} subtasks`,
                    progress: 30,
                });
            }

            for (let i = 0; i < planningResult.subtasks.length; i++) {
                const subtask = planningResult.subtasks[i];
                console.log(`[OrchestrationService] Generating subtask: ${subtask.title}`);

                const genResult = await this.generationService.generateSubtask(
                    subtask,
                    typeof input.context === 'string' ? input.context : '',
                    {
                        model: input.context?.language || 'typescript',
                        includeTests: true,
                        includeComments: true,
                    }
                );

                // Track subtask result
                subtaskResults.push({
                    subtask: subtask.id,
                    code: genResult.code,
                    files: genResult.files.map(f => ({
                        path: f.path,
                        content: f.content,
                        language: f.language,
                        type: 'code' as const,
                    })),
                    explanation: genResult.explanation,
                    success: genResult.success,
                    errors: genResult.errors,
                    duration: genResult.metrics.duration,
                });

                if (!genResult.success) {
                    errors.push(`Failed to generate ${subtask.title}: ${genResult.errors.join(', ')}`);
                }

                // Collect generated files
                genResult.files.forEach(file => {
                    generatedFiles.push({
                        path: file.path,
                        content: file.content,
                        language: file.language,
                        type: 'code' as const,
                    });
                });

                if (onProgress) {
                    onProgress({
                        phase: 'generation',
                        step: subtask.id,
                        message: `Generated ${genResult.files.length} files for ${subtask.title}`,
                        progress: 30 + (i + 1) * 50 / planningResult.subtasks.length,
                    });
                }
            }

            // Step 3: Validation
            console.log(`[OrchestrationService] Step 3: Validation`);

            if (onProgress) {
                onProgress({
                    phase: 'validation',
                    step: 'validate',
                    message: `Validating ${generatedFiles.length} generated files`,
                    progress: 85,
                });
            }

            const validationResults: ValidationResult[] = [];
            let overallValid = true;

            for (const file of generatedFiles) {
                const validationResult = await this.validationService.validate({
                    code: file.content,
                    language: file.language,
                    filePath: file.path,
                });

                validationResults.push(validationResult);

                if (!validationResult.isValid) {
                    overallValid = false;
                    errors.push(...validationResult.errors.map(e => `${e.file}:${e.line} - ${e.message}`));
                }

                warnings.push(...validationResult.warnings.map(w => `${w.file} - ${w.message}`));
            }

            // Step 4: Store results in learning service
            if (this.learningService) {
                await this.learningService.storeIteration({
                    taskId: requestId,
                    projectId: input.projectId,
                    userId: input.userId,
                    prompt: input.prompt,
                    generatedCode: generatedFiles.map(f => ({
                        path: f.path,
                        content: f.content,
                        language: f.language,
                    })),
                    config: {},
                    success: overallValid && errors.length === 0,
                    errors,
                    metrics: {
                        duration: Date.now() - startTime,
                        tokensUsed: this.estimateTokens(input.prompt),
                    },
                    createdAt: new Date(),
                });
            }

            const totalDuration = Date.now() - startTime;

            if (onProgress) {
                onProgress({
                    phase: 'complete',
                    step: 'done',
                    message: 'Orchestration complete',
                    progress: 100,
                });
            }

            return {
                success: overallValid && errors.length === 0,
                taskId: requestId,
                files: generatedFiles,
                subtasks: subtaskResults,
                warnings,
                errors,
                duration: totalDuration,
                metadata: {
                    complexity: planningResult.analysis.complexity,
                    confidence: planningResult.analysis.confidence,
                    subtasksCompleted: planningResult.subtasks.length,
                },
            };

        } catch (error) {
            console.error(`[OrchestrationService] Orchestration failed:`, error);

            return {
                success: false,
                taskId: requestId,
                files: generatedFiles,
                subtasks: subtaskResults,
                warnings,
                errors: [
                    ...errors,
                    error instanceof Error ? error.message : 'Unknown error',
                ],
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Get current orchestrator status
     */
    getStatus(): OrchestratorStatus {
        // Basic status - can be enhanced later with active task tracking
        return {
            activeTasks: 0,
            totalTasks: 0,
            uptime: 0,
        };
    }

    /**
     * Cancel a running orchestration
     */
    async cancel(taskId: string): Promise<void> {
        console.log(`[OrchestrationService] Cancel request for task ${taskId}`);
        // Task cancellation would be implemented here for async operations
        // For now, this is a no-op as the service processes synchronously
    }

    /**
     * Estimate tokens (rough approximation)
     */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }
}
