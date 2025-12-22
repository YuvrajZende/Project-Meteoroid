/**
 * Phase 26 Routes - Project Validation & Dependencies
 * 
 * API endpoints for project validation and dependency management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDependencyRegistry } from '../services/dependency-registry.js';
import { getImportRegistry } from '../services/import-registry.js';
import { getProjectIntegrityValidator } from '../services/project-integrity-validator.js';
import { getCompleteProjectGenerator } from '../services/complete-project-generator.js';

// ============================================
// TYPES
// ============================================

interface ValidateProjectBody {
    projectName: string;
    files: Array<{ path: string; content: string }>;
}

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

interface GenerateProjectBody {
    name: string;
    description: string;
    features: string[];
    files?: Array<{ path: string; content: string }>;
}

// ============================================
// ROUTES
// ============================================

export async function phase26Routes(app: FastifyInstance): Promise<void> {
    const dependencyRegistry = getDependencyRegistry();
    const importRegistry = getImportRegistry();
    const projectValidator = getProjectIntegrityValidator();
    const projectGenerator = getCompleteProjectGenerator();

    // Initialize services
    await dependencyRegistry.initialize();
    await importRegistry.initialize();
    await projectValidator.initialize();
    await projectGenerator.initialize();

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
                projectGenerator: projectGenerator.getStatus(),
            },
        };
    });

    /**
     * POST /api/v1/project/validate
     * Validate a complete project for issues
     */
    app.post('/api/v1/project/validate', async (request: FastifyRequest<{ Body: ValidateProjectBody }>, reply: FastifyReply) => {
        try {
            const { projectName, files } = request.body;

            if (!projectName || !files || !Array.isArray(files)) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: projectName and files array',
                });
            }

            // Convert to map for generator
            const fileMap = new Map<string, string>();
            for (const file of files) {
                fileMap.set(file.path, file.content);
            }

            // Generate complete project structure for validation
            const project = await projectGenerator.generateProject(
                projectName,
                'Project for validation',
                [],
                fileMap
            );

            // Validate the project
            const report = await projectValidator.validateProject(project);

            return {
                success: true,
                validation: {
                    isValid: report.isValid,
                    score: report.score,
                    summary: report.summary,
                    issues: report.issues,
                    recommendations: report.recommendations,
                },
                completeness: {
                    score: project.completenessScore,
                    isComplete: project.isComplete,
                    missingComponents: project.missingComponents,
                },
            };
        } catch (error) {
            console.error('[PHASE26-ROUTES] Validation error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Validation failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
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

    /**
     * POST /api/v1/project/generate
     * Generate a complete project structure
     */
    app.post('/api/v1/project/generate', async (request: FastifyRequest<{ Body: GenerateProjectBody }>, reply: FastifyReply) => {
        try {
            const { name, description, features, files = [] } = request.body;

            if (!name || !description) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: name, description',
                });
            }

            // Convert to map
            const fileMap = new Map<string, string>();
            for (const file of files) {
                fileMap.set(file.path, file.content);
            }

            const project = await projectGenerator.generateProject(
                name,
                description,
                features || [],
                fileMap
            );

            // Convert project to files array
            const projectFiles = projectGenerator.projectToFiles(project);

            return {
                success: true,
                project: {
                    name: project.name,
                    framework: project.framework,
                    language: project.language,
                    features: project.features,
                    completenessScore: project.completenessScore,
                    isComplete: project.isComplete,
                    missingComponents: project.missingComponents,
                },
                files: projectFiles.map(f => ({
                    path: f.path,
                    type: f.type,
                    language: f.language,
                    contentLength: f.content.length,
                })),
                packageJson: project.packageJson,
            };
        } catch (error) {
            console.error('[PHASE26-ROUTES] Project generation error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Project generation failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    console.log('[ROUTES] Phase 26 routes registered: /api/v1/project/*');
}
