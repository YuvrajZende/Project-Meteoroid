/**
 * Context Management Routes
 * Phase 24: Context Management System
 * 
 * API endpoints for entity extraction and context management.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getEntityExtractor } from '../services/entity-extractor.js';
import { getGenerationContext } from '../services/generation-context.js';

// ============================================
// ROUTE DEFINITIONS
// ============================================

export async function contextRoutes(app: FastifyInstance): Promise<void> {
    const entityExtractor = getEntityExtractor();
    const contextService = getGenerationContext();

    // ============================================
    // Entity Extraction
    // ============================================

    /**
     * Extract entities from a prompt
     * POST /api/v1/context/extract
     */
    app.post('/api/v1/context/extract', async (
        request: FastifyRequest<{
            Body: {
                prompt: string;
            };
        }>,
        reply: FastifyReply
    ) => {
        try {
            const { prompt } = request.body;

            if (!prompt || typeof prompt !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing or invalid prompt',
                });
            }

            if (prompt.length < 10) {
                return reply.status(400).send({
                    success: false,
                    error: 'Prompt too short (min 10 characters)',
                });
            }

            const result = await entityExtractor.extract(prompt);

            return {
                success: result.success,
                entities: result.entities,
                entityCount: result.entities.length,
                entityNames: result.entities.map(e => e.name),
                features: result.features,
                integrations: result.integrations,
                projectType: result.projectType,
                summary: result.summary,
                extractionTime: result.extractionTime,
                error: result.error,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CONTEXT-ROUTES] Extract error:', errorMsg);
            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    // ============================================
    // Context Management
    // ============================================

    /**
     * Create a new generation context
     * POST /api/v1/context/create
     */
    app.post('/api/v1/context/create', async (
        request: FastifyRequest<{
            Body: {
                taskId: string;
                projectId?: string;
                userId?: string;
                prompt: string;
                language?: string;
                framework?: string;
            };
        }>,
        reply: FastifyReply
    ) => {
        try {
            const { taskId, projectId, userId, prompt, language, framework } = request.body;

            if (!taskId || !prompt) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing taskId or prompt',
                });
            }

            // Create context
            const context = contextService.createContext(
                taskId,
                projectId || 'default',
                userId || 'anonymous',
                prompt,
                language || 'typescript',
                framework || 'fastify'
            );

            // Extract entities and set on context
            const extraction = await entityExtractor.extract(prompt);
            contextService.setEntities(context.id, extraction);

            // Get enabled features as string array
            const enabledFeatures: string[] = [];
            const features = extraction.features;
            if (features.authentication) enabledFeatures.push('authentication');
            if (features.realTime) enabledFeatures.push('realTime');
            if (features.fileUpload) enabledFeatures.push('fileUpload');
            if (features.payments) enabledFeatures.push('payments');
            if (features.notifications) enabledFeatures.push('notifications');
            if (features.search) enabledFeatures.push('search');
            if (features.analytics) enabledFeatures.push('analytics');
            if (features.rateLimit) enabledFeatures.push('rateLimit');

            return {
                success: true,
                contextId: context.id,
                entityCount: extraction.entities.length,
                entityNames: extraction.entities.map(e => e.name),
                features: enabledFeatures,
                projectType: extraction.projectType,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CONTEXT-ROUTES] Create context error:', errorMsg);
            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    /**
     * Get context details
     * GET /api/v1/context/:contextId
     */
    app.get('/api/v1/context/:contextId', async (
        request: FastifyRequest<{
            Params: {
                contextId: string;
            };
        }>,
        reply: FastifyReply
    ) => {
        try {
            const { contextId } = request.params;
            const context = contextService.getContext(contextId);

            if (!context) {
                return reply.status(404).send({
                    success: false,
                    error: 'Context not found',
                });
            }

            return {
                success: true,
                context: {
                    id: context.id,
                    taskId: context.taskId,
                    originalPrompt: context.originalPrompt,
                    entities: context.entities,
                    entityNames: context.entities.map(e => e.name),
                    features: context.features,
                    integrations: context.integrations,
                    projectType: context.projectType,
                    language: context.language,
                    framework: context.framework,
                    currentPhase: context.currentPhase,
                    generatedFiles: context.generatedFiles,
                    decisions: context.decisions,
                    totalDuration: context.totalDuration,
                    totalCost: context.totalCost,
                    qualityScore: context.qualityScore,
                    createdAt: context.createdAt,
                },
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CONTEXT-ROUTES] Get context error:', errorMsg);
            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    /**
     * Get context summary
     * GET /api/v1/context/:contextId/summary
     */
    app.get('/api/v1/context/:contextId/summary', async (
        request: FastifyRequest<{
            Params: {
                contextId: string;
            };
        }>,
        reply: FastifyReply
    ) => {
        try {
            const { contextId } = request.params;
            const summary = contextService.getSummary(contextId);

            if (!summary) {
                return reply.status(404).send({
                    success: false,
                    error: 'Context not found',
                });
            }

            return {
                success: true,
                summary,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CONTEXT-ROUTES] Get summary error:', errorMsg);
            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    /**
     * Validate entities implementation
     * GET /api/v1/context/:contextId/validate
     */
    app.get('/api/v1/context/:contextId/validate', async (
        request: FastifyRequest<{
            Params: {
                contextId: string;
            };
        }>,
        reply: FastifyReply
    ) => {
        try {
            const { contextId } = request.params;
            const context = contextService.getContext(contextId);

            if (!context) {
                return reply.status(404).send({
                    success: false,
                    error: 'Context not found',
                });
            }

            const validation = contextService.validateEntitiesImplemented(contextId);

            return {
                success: true,
                valid: validation.valid,
                expectedEntities: context.entities.map(e => e.name),
                missingEntities: validation.missing,
                filesGenerated: context.generatedFiles.length,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CONTEXT-ROUTES] Validate error:', errorMsg);
            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    /**
     * Add a decision to context
     * POST /api/v1/context/:contextId/decision
     */
    app.post('/api/v1/context/:contextId/decision', async (
        request: FastifyRequest<{
            Params: {
                contextId: string;
            };
            Body: {
                phase: string;
                decision: string;
                reasoning?: string;
            };
        }>,
        reply: FastifyReply
    ) => {
        try {
            const { contextId } = request.params;
            const { phase, decision, reasoning } = request.body;

            const context = contextService.getContext(contextId);
            if (!context) {
                return reply.status(404).send({
                    success: false,
                    error: 'Context not found',
                });
            }

            contextService.addDecision(contextId, phase, decision, reasoning);

            return {
                success: true,
                message: 'Decision recorded',
                decisionCount: context.decisions.length + 1,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CONTEXT-ROUTES] Add decision error:', errorMsg);
            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    /**
     * Finalize context
     * POST /api/v1/context/:contextId/finalize
     */
    app.post('/api/v1/context/:contextId/finalize', async (
        request: FastifyRequest<{
            Params: {
                contextId: string;
            };
            Body: {
                success: boolean;
                duration?: number;
                cost?: number;
                qualityScore?: number;
            };
        }>,
        reply: FastifyReply
    ) => {
        try {
            const { contextId } = request.params;
            const { success, duration, cost, qualityScore } = request.body;

            const context = contextService.getContext(contextId);
            if (!context) {
                return reply.status(404).send({
                    success: false,
                    error: 'Context not found',
                });
            }

            contextService.finalize(contextId, success, {
                duration,
                cost,
                qualityScore,
            });

            return {
                success: true,
                message: 'Context finalized',
                status: success ? 'complete' : 'failed',
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CONTEXT-ROUTES] Finalize error:', errorMsg);
            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    console.log('[ROUTES] Context management routes registered: /api/v1/context/*');
}
