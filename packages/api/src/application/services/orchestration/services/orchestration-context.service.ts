/**
 * Orchestration Context Service
 * 
 * Handles context management, entity extraction, and intent analysis
 * for the orchestration pipeline.
 * 
 * Extracted from IntegratedOrchestrator to improve maintainability.
 */

import {
    getContextManager,
    type ContextManagerService,
    type ContextWindow,
} from '../../../../domain/services/context/core-services.js';
import {
    getGenerationContext,
    type GenerationContextService,
    type GenerationContext,
} from '../../../../domain/services/context/generation-context.js';
import {
    getEntityExtractor,
    type EntityExtractorService,
} from '../../../../domain/services/analysis/entity-extractor.js';
import {
    getAIIntentAnalyzer,
    type AIIntentAnalyzer,
    type AIIntentAnalysis,
} from '../../../../domain/services/analysis/ai-intent-analyzer.js';
import { getEntityConstraints } from '../../generation/templates/prompt-templates.js';

export interface ContextResult {
    generationContext: GenerationContext | null;
    entityConstraints: string;
    intentAnalysis: AIIntentAnalysis | null;
    entities: Array<{ name: string; type: string }>;
}

export class OrchestrationContextService {
    private generationContextService: GenerationContextService;
    private entityExtractor: EntityExtractorService;
    private intentAnalyzer: AIIntentAnalyzer;
    private contextManager: ContextManagerService;

    constructor() {
        this.generationContextService = getGenerationContext();
        this.entityExtractor = getEntityExtractor();
        this.intentAnalyzer = getAIIntentAnalyzer();
        this.contextManager = getContextManager();
    }

    async analyzeIntent(prompt: string): Promise<AIIntentAnalysis | null> {
        try {
            return await this.intentAnalyzer.analyze(prompt);
        } catch (error) {
            console.warn('[ORCHESTRATOR] Intent detection failed:', error);
            return null;
        }
    }

    async extractEntities(
        taskId: string,
        projectId: string,
        userId: string,
        prompt: string,
        language: string,
        framework: string
    ): Promise<ContextResult> {
        let generationContext: GenerationContext | null = null;
        let entityConstraints = '';
        const entities: Array<{ name: string; type: string }> = [];

        try {
            generationContext = this.generationContextService.createContext(
                taskId,
                projectId,
                userId,
                prompt,
                language,
                framework
            );

            const extraction = await this.entityExtractor.extract(prompt);

            if (extraction.success && extraction.entities.length > 0) {
                this.generationContextService.setEntities(generationContext.id, extraction);
                entityConstraints = getEntityConstraints(generationContext);
                extraction.entities.forEach((e: { name: string; type: string }) => 
                    entities.push({ name: e.name, type: e.type })
                );
                console.log(`[ORCHESTRATOR] Extracted entities: ${entities.map(e => e.name).join(', ')}`);
            }
        } catch (error) {
            console.warn('[ORCHESTRATOR] Entity extraction failed:', error);
        }

        return {
            generationContext,
            entityConstraints,
            intentAnalysis: null,
            entities,
        };
    }

    setupProjectContext(
        projectId: string,
        userId: string,
        projectName: string | undefined,
        description: string | undefined,
        techStack: string[] | undefined
    ): void {
        this.contextManager.getContext(projectId, userId);

        if (projectName) {
            this.contextManager.updateProjectContext(projectId, userId, {
                name: projectName,
                description,
                techStack: techStack || [],
            });
        }
    }

    addUserMessage(projectId: string, userId: string, content: string): void {
        this.contextManager.addMemory(projectId, userId, {
            role: 'user',
            content,
        });
    }

    addAssistantMessage(
        projectId: string,
        userId: string,
        content: string,
        metadata: { agentsUsed: string[]; codeGenerated: number; filesWritten?: string[] }
    ): void {
        this.contextManager.addMemory(projectId, userId, {
            role: 'assistant',
            content,
            metadata,
        });
    }

    addGeneratedFile(projectId: string, userId: string, filePath: string): void {
        this.contextManager.addGeneratedFile(projectId, userId, filePath);
    }

    setCurrentSubtask(contextId: string, subtask: string): void {
        if (contextId) {
            this.generationContextService.setCurrentSubtask(contextId, subtask);
        }
    }

    addGeneratedFileToContext(contextId: string, file: { path: string; language: string; type: 'model' | 'service' | 'utility' | 'route' | 'config' | 'test' }): void {
        if (contextId) {
            this.generationContextService.addGeneratedFile(contextId, file);
        }
    }

    finalizeContext(
        contextId: string,
        success: boolean,
        metrics: { duration: number; cost: number; qualityScore: number }
    ): void {
        if (contextId) {
            this.generationContextService.finalize(contextId, success, metrics);
        }
    }

    validateEntitiesImplemented(contextId: string): { valid: boolean; missing: string[] } {
        if (contextId) {
            return this.generationContextService.validateEntitiesImplemented(contextId);
        }
        return { valid: true, missing: [] };
    }

    getContext(projectId: string, userId: string): ContextWindow | null {
        return this.contextManager.getContext(projectId, userId);
    }
}
