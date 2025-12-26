/**
 * Phase 26 Routes - Project Validation & Dependencies
 * 
 * API endpoints for project validation and dependency management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    getDependencyRegistry,
    getImportRegistry,
    getProjectIntegrityValidator,
} from '../services/index.js';

// ============================================
// TYPES
// ============================================

interface AnalyzeDependenciesBody {
    code: string;
    filePath?: string;
}

interface DeduplicateImportsBody {
    code: string;
    filePath?: string;
}

interface ValidateReplacementBody {
    originalCode: string;
    newCode: string;
    filePath: string;
    fileType?: 'route' | 'service' | 'controller' | 'middleware' | 'utility' | 'config' | 'test';
    isCompleteRewrite?: boolean;
    reason?: string;
}

// ============================================
// ROUTES
// ============================================

export async function phase26Routes(app: FastifyInstance): Promise<void> {
    const dependencyRegistry = getDependencyRegistry();
    const importRegistry = getImportRegistry();
    const projectValidator = getProjectIntegrityValidator();

    // Initialize services
    await dependencyRegistry.initialize();
    await importRegistry.initialize();
    await projectValidator.initialize();

    /**
     * GET /api/v1/project/status
     * Get status of Phase 26 services
     */
    app.get('/api/v1/project/status', async (_request: FastifyRequest, _reply: FastifyReply) => {
        return {
            success: true,
            services: {
                dependencyRegistry: dependencyRegistry.getStatus(),
                importRegistry: importRegistry.getStatus(),
                projectValidator: projectValidator.getStatus(),
            },
        };
    });

    /**
     * POST /api/v1/project/dependencies
     * Analyze code and detect required dependencies
     */
    app.post('/api/v1/project/dependencies', async (request: FastifyRequest<{ Body: AnalyzeDependenciesBody }>, reply: FastifyReply) => {
        try {
            const { code, filePath = 'analysis.ts' } = request.body;

            if (!code) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required field: code',
                });
            }

            // Clear and analyze
            dependencyRegistry.clear();
            const detected = dependencyRegistry.analyzeCode(code, filePath);
            const allDeps = dependencyRegistry.getDependencies();

            // Generate package.json
            const packageJson = dependencyRegistry.generatePackageJson('analyzed-project');

            return {
                success: true,
                detected,
                dependencies: Object.fromEntries(allDeps),
                packageJson,
            };
        } catch (error) {
            console.error('[PHASE26-ROUTES] Dependency analysis error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Dependency analysis failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    /**
     * POST /api/v1/project/imports/deduplicate
     * Deduplicate imports in code
     */
    app.post('/api/v1/project/imports/deduplicate', async (request: FastifyRequest<{ Body: DeduplicateImportsBody }>, reply: FastifyReply) => {
        try {
            const { code, filePath = 'file.ts' } = request.body;

            if (!code) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required field: code',
                });
            }

            // Clear and process
            importRegistry.clear();
            const result = importRegistry.deduplicateImports(code, filePath);

            return {
                success: true,
                deduplicatedCode: result.deduplicatedCode,
                changesMade: result.changesMade,
                removed: result.removed.length,
                merged: result.merged.length,
            };
        } catch (error) {
            console.error('[PHASE26-ROUTES] Import deduplication error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Import deduplication failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    /**
     * POST /api/v1/project/validate-replacement
     * Validate a code replacement to prevent code loss
     */
    app.post('/api/v1/project/validate-replacement', async (request: FastifyRequest<{ Body: ValidateReplacementBody }>, reply: FastifyReply) => {
        try {
            const {
                originalCode,
                newCode,
                filePath,
                fileType = 'code' as 'route' | 'service' | 'controller' | 'middleware' | 'utility' | 'config' | 'test',
                isCompleteRewrite = false,
                reason = 'Code replacement',
            } = request.body;

            if (!originalCode || !newCode || !filePath) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: originalCode, newCode, filePath',
                });
            }

            const validation = projectValidator.validateReplacement(
                originalCode,
                newCode,
                {
                    filePath,
                    fileType,
                    isCompleteRewrite,
                    reason,
                }
            );

            return {
                success: true,
                validation: {
                    isValid: validation.isValid,
                    reason: validation.reason,
                    recommendation: validation.recommendation,
                    sizeAnalysis: {
                        originalSize: validation.originalSize,
                        newSize: validation.newSize,
                        sizeRatio: Math.round(validation.sizeRatio * 100) + '%',
                    },
                },
            };
        } catch (error) {
            console.error('[PHASE26-ROUTES] Replacement validation error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Replacement validation failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    console.log('[ROUTES] Phase 26 routes registered: /api/v1/project/*');
}
