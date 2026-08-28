/**
 * Vector Store & Learning Routes
 * 
 * Phase 18: Vector Database Context Retrieval & AI Learning
 * 
 * API endpoints for:
 * - Code embedding and indexing
 * - Semantic similarity search
 * - AI learning iterations
 * - Pre-context building
 * - Testing iterations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    getVectorStore,
    getLearningService,
    type GenerationIteration,
    type TestingIteration,
} from '../services/index.js';

// ============================================
// REQUEST SCHEMAS
// ============================================

interface IndexFileBody {
    projectId: string;
    filePath: string;
    content: string;
}

interface IndexProjectBody {
    projectId: string;
    files: Array<{
        path: string;
        content: string;
    }>;
}

interface SearchBody {
    query: string;
    projectId?: string;
    language?: string;
    limit?: number;
    threshold?: number;
}

interface StoreIterationBody {
    taskId: string;
    projectId: string;
    userId?: string;
    prompt: string;
    generatedCode: Array<{
        path: string;
        content: string;
        language: string;
    }>;
    config?: Record<string, unknown>;
    success: boolean;
    errors?: string[];
    metrics?: {
        duration: number;
        tokensUsed: number;
        cost?: number;
    };
}

interface StoreTestIterationBody {
    projectId: string;
    testType: 'unit' | 'integration' | 'e2e' | 'manual';
    testDescription: string;
    userQuery?: string;
    expectedBehavior: string;
    actualResult: string;
    success: boolean;
    lessons?: string[];
    relatedFiles?: string[];
    tags?: string[];
}

interface FeedbackBody {
    iterationId: string;
    rating: 1 | 2 | 3 | 4 | 5;
    comments?: string;
    issues?: string[];
}

interface PreContextBody {
    prompt: string;
    projectId?: string;
}

// ============================================
// ROUTE REGISTRATION
// ============================================

export async function vectorLearningRoutes(app: FastifyInstance): Promise<void> {
    const vectorStore = getVectorStore();
    const learningService = getLearningService();

    // Initialize services
    await vectorStore.initialize();
    await learningService.initialize();

    // ============================================
    // VECTOR STORE ROUTES
    // ============================================

    /**
     * POST /api/v1/vector/index/file
     * Index a single file for semantic search
     */
    app.post('/api/v1/vector/index/file', async (
        request: FastifyRequest<{ Body: IndexFileBody }>,
        reply: FastifyReply
    ) => {
        try {
            const { projectId, filePath, content } = request.body;

            if (!projectId || !filePath || !content) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: projectId, filePath, content',
                });
            }

            const result = await vectorStore.indexFile(projectId, filePath, content);

            return reply.send({
                success: result.success,
                data: {
                    projectId,
                    filePath,
                    chunksCreated: result.chunksCreated,
                },
                error: result.error,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Indexing failed';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * POST /api/v1/vector/index/project
     * Index multiple files for a project
     */
    app.post('/api/v1/vector/index/project', async (
        request: FastifyRequest<{ Body: IndexProjectBody }>,
        reply: FastifyReply
    ) => {
        try {
            const { projectId, files } = request.body;

            if (!projectId || !files || files.length === 0) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: projectId, files',
                });
            }

            const result = await vectorStore.indexProject(projectId, files);

            return reply.send({
                success: result.success,
                data: {
                    projectId,
                    filesIndexed: files.length,
                    chunksCreated: result.chunksCreated,
                    errors: result.errors,
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Project indexing failed';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * POST /api/v1/vector/search
     * Semantic similarity search for code chunks
     */
    app.post('/api/v1/vector/search', async (
        request: FastifyRequest<{ Body: SearchBody }>,
        reply: FastifyReply
    ) => {
        try {
            const { query, projectId, language, limit, threshold } = request.body;

            if (!query) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required field: query',
                });
            }

            const results = await vectorStore.search(query, {
                projectId,
                language,
                limit: limit || 10,
                threshold: threshold || 0.7,
                includeContent: true,
            });

            return reply.send({
                success: true,
                data: {
                    query,
                    resultsCount: results.length,
                    results: results.map(r => ({
                        filePath: r.chunk.filePath,
                        startLine: r.chunk.startLine,
                        endLine: r.chunk.endLine,
                        language: r.chunk.language,
                        similarity: r.similarity,
                        relevanceScore: r.relevanceScore,
                        content: r.chunk.content.slice(0, 500) + (r.chunk.content.length > 500 ? '...' : ''),
                    })),
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Search failed';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * POST /api/v1/vector/context
     * Get relevant context for a prompt
     */
    app.post('/api/v1/vector/context', async (
        request: FastifyRequest<{ Body: { prompt: string; projectId: string; maxChunks?: number; maxTokens?: number } }>,
        reply: FastifyReply
    ) => {
        try {
            const { prompt, projectId, maxChunks, maxTokens } = request.body;

            if (!prompt || !projectId) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: prompt, projectId',
                });
            }

            const result = await vectorStore.getRelevantContext(prompt, projectId, {
                maxChunks: maxChunks || 5,
                maxTokens: maxTokens || 2000,
            });

            return reply.send({
                success: true,
                data: {
                    context: result.context,
                    files: result.files,
                    tokenEstimate: result.tokenEstimate,
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Context retrieval failed';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * DELETE /api/v1/vector/project/:projectId
     * Delete all embeddings for a project
     */
    app.delete('/api/v1/vector/project/:projectId', async (
        request: FastifyRequest<{ Params: { projectId: string } }>,
        reply: FastifyReply
    ) => {
        try {
            const { projectId } = request.params;
            const success = await vectorStore.deleteProject(projectId);

            return reply.send({
                success,
                message: success ? 'Project embeddings deleted' : 'Delete failed',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Delete failed';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    // ============================================
    // LEARNING SERVICE ROUTES
    // ============================================

    /**
     * POST /api/v1/learning/iteration
     * Store a generation iteration for learning
     */
    app.post('/api/v1/learning/iteration', async (
        request: FastifyRequest<{ Body: StoreIterationBody }>,
        reply: FastifyReply
    ) => {
        try {
            const body = request.body;

            if (!body.taskId || !body.projectId || !body.prompt) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: taskId, projectId, prompt',
                });
            }

            const iteration: GenerationIteration = {
                taskId: body.taskId,
                projectId: body.projectId,
                userId: body.userId,
                prompt: body.prompt,
                generatedCode: body.generatedCode || [],
                config: body.config || {},
                success: body.success,
                errors: body.errors || [],
                metrics: body.metrics || { duration: 0, tokensUsed: 0 },
                createdAt: new Date(),
            };

            const iterationId = await learningService.storeIteration(iteration);

            return reply.status(201).send({
                success: true,
                data: {
                    iterationId,
                    stored: true,
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to store iteration';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * POST /api/v1/learning/test-iteration
     * Store a testing iteration for pre-context
     */
    app.post('/api/v1/learning/test-iteration', async (
        request: FastifyRequest<{ Body: StoreTestIterationBody }>,
        reply: FastifyReply
    ) => {
        try {
            const body = request.body;

            if (!body.projectId || !body.testDescription || !body.expectedBehavior || !body.actualResult) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields',
                });
            }

            const iteration: TestingIteration = {
                projectId: body.projectId,
                testType: body.testType,
                testDescription: body.testDescription,
                userQuery: body.userQuery,
                expectedBehavior: body.expectedBehavior,
                actualResult: body.actualResult,
                success: body.success,
                lessons: body.lessons || [],
                relatedFiles: body.relatedFiles || [],
                tags: body.tags || [],
                createdAt: new Date(),
            };

            const iterationId = await learningService.storeTestIteration(iteration);

            return reply.status(201).send({
                success: true,
                data: {
                    iterationId,
                    stored: true,
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to store test iteration';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * POST /api/v1/learning/feedback
     * Submit feedback for an iteration
     */
    app.post('/api/v1/learning/feedback', async (
        request: FastifyRequest<{ Body: FeedbackBody }>,
        reply: FastifyReply
    ) => {
        try {
            const { iterationId, rating, comments, issues } = request.body;

            if (!iterationId || !rating) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: iterationId, rating',
                });
            }

            await learningService.processFeedback(iterationId, {
                rating,
                comments,
                issues,
            });

            return reply.send({
                success: true,
                message: 'Feedback processed',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to process feedback';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * POST /api/v1/learning/pre-context
     * Build pre-context for a new generation task
     */
    app.post('/api/v1/learning/pre-context', async (
        request: FastifyRequest<{ Body: PreContextBody }>,
        reply: FastifyReply
    ) => {
        try {
            const { prompt, projectId } = request.body;

            if (!prompt) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required field: prompt',
                });
            }

            const preContext = await learningService.buildPreContext(prompt, projectId);

            return reply.send({
                success: true,
                data: {
                    experiencesFound: preContext.experiences.length,
                    patternsApplied: preContext.patterns.length,
                    warningsCount: preContext.warnings.length,
                    successProbability: preContext.successProbability,
                    suggestedApproach: preContext.suggestedApproach,
                    warnings: preContext.warnings,
                    experiences: preContext.experiences.map(e => ({
                        prompt: e.prompt.slice(0, 200),
                        success: e.success,
                        relevance: e.relevance,
                    })),
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to build pre-context';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * GET /api/v1/learning/statistics
     * Get learning system statistics
     */
    app.get('/api/v1/learning/statistics', async (
        _request: FastifyRequest,
        reply: FastifyReply
    ) => {
        const stats = learningService.getStatistics();

        return reply.send({
            success: true,
            data: stats,
        });
    });

    /**
     * GET /api/v1/learning/patterns
     * Get learned patterns
     */
    app.get('/api/v1/learning/patterns', async (
        request: FastifyRequest<{ Querystring: { type?: string; limit?: string } }>,
        reply: FastifyReply
    ) => {
        const patterns = learningService.getPatterns();
        const type = request.query.type;
        const limit = parseInt(request.query.limit || '20', 10);

        let filtered = patterns;
        if (type) {
            filtered = patterns.filter(p => p.patternType === type);
        }

        return reply.send({
            success: true,
            data: {
                total: filtered.length,
                patterns: filtered.slice(0, limit).map(p => ({
                    type: p.patternType,
                    description: p.description,
                    frequency: p.frequency,
                    confidence: p.confidence,
                    example: p.example?.slice(0, 200),
                })),
            },
        });
    });

    app.log.info('✅ Vector Store & Learning routes registered: /api/v1/vector/*, /api/v1/learning/*');
}
