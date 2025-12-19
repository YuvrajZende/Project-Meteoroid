/**
 * Generation Context Service
 * Phase 24: Context Management System
 * 
 * Manages context throughout the entire code generation pipeline.
 * This is the "single source of truth" for what we're building.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    type ExtractedEntity,
    type ExtractedFeatures,
    type ExtractedIntegrations,
    type EntityExtractionResult,
} from './entity-extractor.js';
import { getSupabaseAdmin } from './database-client.js';

// ============================================
// TYPES
// ============================================

export interface GenerationDecision {
    timestamp: Date;
    phase: string;
    decision: string;
    reasoning?: string;
}

export interface GeneratedFileInfo {
    path: string;
    language: string;
    type: 'model' | 'route' | 'service' | 'config' | 'utility' | 'test';
    entityRelated?: string; // Which entity this file is for
}

export interface SubtaskResult {
    subtask: string;
    agent: string;
    success: boolean;
    filesGenerated: string[];
    error?: string;
    duration: number;
}

export interface GenerationContext {
    // Identity
    id: string;
    taskId: string;
    projectId: string;
    userId: string;

    // Original request - NEVER changes
    originalPrompt: string;
    createdAt: Date;

    // Extracted entities - Set once after extraction
    entities: ExtractedEntity[];
    features: ExtractedFeatures;
    integrations: ExtractedIntegrations;
    projectType: 'api' | 'fullstack' | 'microservice' | 'cli' | 'library';

    // Language and framework
    language: string;
    framework: string;

    // Current state - Updated as we progress
    currentPhase: 'extraction' | 'blueprint' | 'generation' | 'validation' | 'complete' | 'failed';
    currentSubtask?: string;

    // Accumulated context - Grows with each step
    generatedFiles: GeneratedFileInfo[];
    decisions: GenerationDecision[];
    subtaskResults: SubtaskResult[];

    // Metrics
    totalDuration?: number;
    totalCost?: number;
    qualityScore?: number;
}

export interface ContextSummary {
    id: string;
    originalPrompt: string;
    entityNames: string[];
    features: string[];
    filesGenerated: number;
    currentPhase: string;
    qualityScore?: number;
}

// ============================================
// GENERATION CONTEXT SERVICE
// ============================================

export class GenerationContextService {
    private contexts: Map<string, GenerationContext> = new Map();
    private supabaseEnabled: boolean;
    private pendingContexts: GenerationContext[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.supabaseEnabled = !!(
            process.env.SUPABASE_URL &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        if (this.supabaseEnabled) {
            // Flush to database every minute
            this.flushInterval = setInterval(
                () => this.flushPendingContexts(),
                60000
            );
        }
    }

    /**
     * Create a new generation context
     */
    createContext(
        taskId: string,
        projectId: string,
        userId: string,
        originalPrompt: string,
        language = 'typescript',
        framework = 'fastify'
    ): GenerationContext {
        const context: GenerationContext = {
            id: uuidv4(),
            taskId,
            projectId,
            userId,
            originalPrompt,
            createdAt: new Date(),
            entities: [],
            features: this.getDefaultFeatures(),
            integrations: this.getDefaultIntegrations(),
            projectType: 'api',
            language,
            framework,
            currentPhase: 'extraction',
            generatedFiles: [],
            decisions: [],
            subtaskResults: [],
        };

        this.contexts.set(context.id, context);
        console.log(`[CONTEXT] Created context ${context.id} for task ${taskId}`);

        return context;
    }

    /**
     * Get a context by ID
     */
    getContext(contextId: string): GenerationContext | undefined {
        return this.contexts.get(contextId);
    }

    /**
     * Update context with extracted entities
     */
    setEntities(contextId: string, extraction: EntityExtractionResult): void {
        const context = this.contexts.get(contextId);
        if (!context) {
            console.warn(`[CONTEXT] Context ${contextId} not found`);
            return;
        }

        context.entities = extraction.entities;
        context.features = extraction.features;
        context.integrations = extraction.integrations;
        context.projectType = extraction.projectType;

        this.addDecision(contextId, 'extraction',
            `Extracted ${extraction.entities.length} entities: ${extraction.entities.map(e => e.name).join(', ')}`,
            extraction.summary
        );

        console.log(`[CONTEXT] Set ${extraction.entities.length} entities for context ${contextId}`);
    }

    /**
     * Update current phase
     */
    setPhase(contextId: string, phase: GenerationContext['currentPhase']): void {
        const context = this.contexts.get(contextId);
        if (context) {
            context.currentPhase = phase;
            this.addDecision(contextId, phase, `Entered ${phase} phase`);
        }
    }

    /**
     * Set current subtask
     */
    setCurrentSubtask(contextId: string, subtask: string): void {
        const context = this.contexts.get(contextId);
        if (context) {
            context.currentSubtask = subtask;
        }
    }

    /**
     * Add a decision to the context
     */
    addDecision(contextId: string, phase: string, decision: string, reasoning?: string): void {
        const context = this.contexts.get(contextId);
        if (context) {
            context.decisions.push({
                timestamp: new Date(),
                phase,
                decision,
                reasoning,
            });
        }
    }

    /**
     * Add a generated file to the context
     */
    addGeneratedFile(contextId: string, file: GeneratedFileInfo): void {
        const context = this.contexts.get(contextId);
        if (context) {
            // Check for duplicates
            const existing = context.generatedFiles.find(f => f.path === file.path);
            if (existing) {
                console.warn(`[CONTEXT] Duplicate file detected: ${file.path}`);
                return;
            }
            context.generatedFiles.push(file);
        }
    }

    /**
     * Record a subtask result
     */
    addSubtaskResult(contextId: string, result: SubtaskResult): void {
        const context = this.contexts.get(contextId);
        if (context) {
            context.subtaskResults.push(result);
        }
    }

    /**
     * Finalize the context with metrics
     */
    finalize(
        contextId: string,
        success: boolean,
        metrics: { duration?: number; cost?: number; qualityScore?: number }
    ): void {
        const context = this.contexts.get(contextId);
        if (!context) return;

        context.currentPhase = success ? 'complete' : 'failed';
        context.totalDuration = metrics.duration;
        context.totalCost = metrics.cost;
        context.qualityScore = metrics.qualityScore;

        this.addDecision(contextId, 'finalize',
            success ? 'Generation completed successfully' : 'Generation failed',
            `Duration: ${metrics.duration}ms, Cost: $${metrics.cost?.toFixed(4)}`
        );

        // Queue for database persistence
        if (this.supabaseEnabled) {
            this.pendingContexts.push(context);
        }

        console.log(`[CONTEXT] Finalized context ${contextId}: ${success ? 'SUCCESS' : 'FAILED'}`);
    }

    /**
     * Get a summary of the context
     */
    getSummary(contextId: string): ContextSummary | null {
        const context = this.contexts.get(contextId);
        if (!context) return null;

        return {
            id: context.id,
            originalPrompt: context.originalPrompt,
            entityNames: context.entities.map(e => e.name),
            features: Object.entries(context.features)
                .filter(([, enabled]) => enabled === true)
                .map(([name]) => name),
            filesGenerated: context.generatedFiles.length,
            currentPhase: context.currentPhase,
            qualityScore: context.qualityScore,
        };
    }

    /**
     * Get entity names for the context
     */
    getEntityNames(contextId: string): string[] {
        const context = this.contexts.get(contextId);
        return context ? context.entities.map(e => e.name) : [];
    }

    /**
     * Check if an entity exists in the context
     */
    hasEntity(contextId: string, entityName: string): boolean {
        const context = this.contexts.get(contextId);
        return context ? context.entities.some(e =>
            e.name.toLowerCase() === entityName.toLowerCase()
        ) : false;
    }

    /**
     * Get generated files that haven't been written yet
     */
    getGeneratedFilePaths(contextId: string): string[] {
        const context = this.contexts.get(contextId);
        return context ? context.generatedFiles.map(f => f.path) : [];
    }

    /**
     * Validate that all expected entities have been implemented
     */
    validateEntitiesImplemented(contextId: string): { valid: boolean; missing: string[] } {
        const context = this.contexts.get(contextId);
        if (!context) return { valid: false, missing: [] };

        const implementedEntities = new Set<string>();

        // Check which entities have files generated
        for (const file of context.generatedFiles) {
            if (file.entityRelated) {
                implementedEntities.add(file.entityRelated.toLowerCase());
            }

            // Also check file paths for entity names
            const fileName = file.path.split('/').pop()?.replace(/\.(ts|js|prisma)$/, '') || '';
            for (const entity of context.entities) {
                if (fileName.toLowerCase().includes(entity.name.toLowerCase())) {
                    implementedEntities.add(entity.name.toLowerCase());
                }
            }
        }

        const missing = context.entities
            .filter(e => !implementedEntities.has(e.name.toLowerCase()))
            .map(e => e.name);

        return {
            valid: missing.length === 0,
            missing,
        };
    }

    // ============================================
    // DATABASE PERSISTENCE
    // ============================================

    /**
     * Flush pending contexts to database
     */
    private async flushPendingContexts(): Promise<void> {
        if (!this.supabaseEnabled || this.pendingContexts.length === 0) {
            return;
        }

        const contextsToFlush = [...this.pendingContexts];
        this.pendingContexts = [];

        try {
            const supabase = getSupabaseAdmin();
            if (!supabase) return;

            const dbRecords = contextsToFlush.map(ctx => ({
                id: ctx.id,
                task_id: ctx.taskId,
                project_id: this.isValidUUID(ctx.projectId) ? ctx.projectId : null,
                user_id: this.isValidUUID(ctx.userId) ? ctx.userId : null,
                original_prompt: ctx.originalPrompt,
                entities: ctx.entities,
                features: ctx.features,
                integrations: ctx.integrations,
                project_type: ctx.projectType,
                language: ctx.language,
                framework: ctx.framework,
                generated_files: ctx.generatedFiles,
                decisions: ctx.decisions,
                subtask_results: ctx.subtaskResults,
                total_duration: ctx.totalDuration,
                total_cost: ctx.totalCost,
                quality_score: ctx.qualityScore,
                status: ctx.currentPhase,
                created_at: ctx.createdAt.toISOString(),
            }));

            const { error } = await supabase
                .from('generation_contexts')
                .upsert(dbRecords, { onConflict: 'id' });

            if (error) {
                console.error('[CONTEXT] Failed to persist contexts:', error);
                this.pendingContexts.unshift(...contextsToFlush);
            } else {
                console.log(`[CONTEXT] Persisted ${contextsToFlush.length} contexts`);
            }
        } catch (error) {
            console.error('[CONTEXT] Persistence error:', error);
            this.pendingContexts.unshift(...contextsToFlush);
        }
    }

    /**
     * Validate UUID format
     */
    private isValidUUID(str: string | undefined): boolean {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        await this.flushPendingContexts();
        console.log('[CONTEXT] Shutdown complete');
    }

    // ============================================
    // DEFAULTS
    // ============================================

    private getDefaultFeatures(): ExtractedFeatures {
        return {
            authentication: false,
            realTime: false,
            fileUpload: false,
            payments: false,
            notifications: false,
            search: false,
            analytics: false,
            rateLimit: true,
            custom: [],
        };
    }

    private getDefaultIntegrations(): ExtractedIntegrations {
        return {
            database: 'postgresql',
            cache: 'none',
            queue: 'none',
            storage: 'none',
            email: 'none',
            websocket: false,
            custom: [],
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let instance: GenerationContextService | null = null;

export function getGenerationContext(): GenerationContextService {
    if (!instance) {
        instance = new GenerationContextService();
    }
    return instance;
}
