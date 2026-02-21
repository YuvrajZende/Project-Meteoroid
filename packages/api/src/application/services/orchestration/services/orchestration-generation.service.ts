/**
 * Orchestration Code Generation Service
 * 
 * Handles code generation, multi-model orchestration, and learning context building.
 * 
 * Extracted from IntegratedOrchestrator to improve maintainability.
 */

import type { MultiModelOrchestrator } from '../multi-model-orchestrator.js';
import { LearningService, type PreContext } from '../../../../domain/services/learning/learning-service.js';
import { getMultiModelOrchestrator } from '../multi-model-orchestrator.js';
import { getLearningService } from '../../../../domain/services/learning/learning-service.js';
import { buildSubtaskPrompt } from '../../generation/templates/prompt-templates.js';
import type { GenerationContext } from '../../../../domain/services/context/generation-context.js';

export type LearningPreContext = PreContext;

export interface CodeGenerationRequest {
    prompt: string;
    subtask: string;
    taskId: string;
    projectId: string;
    userId: string;
    language: string;
    framework: string;
    techStack?: string[];
    existingCode?: string;
    generationContext: GenerationContext | null;
    entityConstraints: string;
    originalPrompt: string;
}

export interface CodeGenerationResult {
    code: string;
    explanation: string;
    files: Array<{ path: string; content: string }>;
    tokenUsage: { prompt: number; completion: number; total: number };
    cost: number;
    analysisTime: number;
    generationTime: number;
}

export class OrchestrationGenerationService {
    private multiModelOrchestrator: MultiModelOrchestrator;
    private learningService: LearningService;

    constructor() {
        this.multiModelOrchestrator = getMultiModelOrchestrator();
        this.learningService = getLearningService();
    }

    async buildLearningContext(subtask: string, projectId: string): Promise<LearningPreContext> {
        try {
            return await this.learningService.buildPreContext(subtask, projectId);
        } catch (error) {
            console.warn('[ORCHESTRATOR] Could not build learning context:', error);
            return {
                experiences: [],
                warnings: [],
                patterns: [],
                successProbability: 0.5,
            };
        }
    }

    formatLearningContext(preContext: LearningPreContext): string {
        if (preContext.experiences.length === 0 && preContext.warnings.length === 0 && preContext.patterns.length === 0) {
            return '';
        }

        let context = `
LEARNING FROM PAST GENERATIONS:
================================
`;

        const successfulExperiences = preContext.experiences.filter((e: { success: boolean }) => e.success).slice(0, 2);
        if (successfulExperiences.length > 0) {
            context += `✅ SUCCESSFUL PATTERNS (do similar):\n`;
            for (const exp of successfulExperiences) {
                context += `- Previous task: "${exp.prompt.slice(0, 100)}..." worked well\n`;
            }
        }

        if (preContext.warnings.length > 0) {
            context += `\n⚠️ AVOID THESE MISTAKES:\n`;
            for (const warning of preContext.warnings.slice(0, 3)) {
                context += `- ${warning}\n`;
            }
        }

        const goodPatterns = preContext.patterns.filter((p: { patternType: string }) => p.patternType === 'success').slice(0, 2);
        if (goodPatterns.length > 0) {
            context += `\n📌 LEARNED BEST PRACTICES:\n`;
            for (const pattern of goodPatterns) {
                context += `- ${pattern.description}\n`;
            }
        }

        context += `\nSuccess probability based on history: ${(preContext.successProbability * 100).toFixed(0)}%\n================================\n\n`;

        return context;
    }

    async generate(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
        const learningContext = await this.buildLearningContext(request.subtask, request.projectId);
        let enhancedPrompt = this.formatLearningContext(learningContext);

        if (request.generationContext && request.generationContext.entities.length > 0) {
            enhancedPrompt += buildSubtaskPrompt(request.subtask, request.generationContext);
        } else {
            enhancedPrompt += `
ORIGINAL USER REQUEST (Maintain this context for ALL code generation):
================================================================================
${request.originalPrompt}
================================================================================

CURRENT SUBTASK: ${request.subtask}

IMPORTANT: You are generating code for a specific system described above.
- Stay focused on the ORIGINAL REQUEST, not generic patterns
- All generated code should directly relate to: "${request.originalPrompt.substring(0, 100)}..."
- Do NOT generate unrelated CRUD operations or generic scaffolding
- Match your output to the user's specific domain

`;
        }

        if (request.entityConstraints) {
            enhancedPrompt += request.entityConstraints;
        }

        const result = await this.multiModelOrchestrator.execute({
            prompt: enhancedPrompt,
            taskId: request.taskId,
            projectId: request.projectId,
            userId: request.userId,
            context: {
                existingCode: request.existingCode || '',
                framework: request.framework,
                language: request.language,
                techStack: request.techStack,
            },
        });

        if (!result) {
            throw new Error('Multi-model execution returned null or undefined');
        }

        const analysisTokens = result.analysisCost
            ? (result.analysisCost.inputTokens + result.analysisCost.outputTokens)
            : 0;
        const generationTokens = result.generationCost
            ? (result.generationCost.inputTokens + result.generationCost.outputTokens)
            : 0;

        return {
            code: result.files?.map((f: { path: string; content: string }) => `// ${f.path}\n${f.content}`).join('\n\n') || result.code,
            explanation: result.explanation || 'Generated using multi-model pipeline',
            files: result.files?.map((f: { path: string; content: string }) => ({ path: f.path, content: f.content })) || [],
            tokenUsage: {
                prompt: (result.analysisCost?.inputTokens || 0) + (result.generationCost?.inputTokens || 0),
                completion: (result.analysisCost?.outputTokens || 0) + (result.generationCost?.outputTokens || 0),
                total: analysisTokens + generationTokens,
            },
            cost: result.totalCost,
            analysisTime: result.analysisTime,
            generationTime: result.generationTime,
        };
    }

    async initialize(): Promise<void> {
        await this.learningService.initialize();
    }
}
