/**
 * CodeGen Routes
 * API endpoints for code generation functionality
 * 
 * Exposes Person 4's CodeGen Agent pipeline:
 * - Project scaffolding (multi-language)
 * - Module generation
 * - Code generation status
 * 
 * POST /codegen/project    - Generate a complete project
 * POST /codegen/module     - Generate a single module
 * GET  /codegen/languages  - Get supported languages/frameworks
 * GET  /codegen/health     - Check CodeGen service health
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getCodeGenService, type SupportedLanguage, type SupportedFramework } from '../services/codegen-service.js';
import * as path from 'path';

// ============================================
// REQUEST/RESPONSE SCHEMAS
// ============================================

interface GenerateProjectBody {
    taskId?: string;
    projectName: string;
    outputPath?: string;
    language?: SupportedLanguage;
    framework?: SupportedFramework;
    description?: string;
    modules?: string[];
    installDependencies?: boolean;
    verify?: boolean;
}

interface GenerateModuleBody {
    taskId?: string;
    moduleName: string;
    projectPath: string;
}

// ============================================
// ROUTE HANDLER
// ============================================

export async function registerCodeGenRoutes(app: FastifyInstance): Promise<void> {
    const codeGenService = getCodeGenService();

    // Initialize the service
    await codeGenService.initialize();

    // ============================================
    // POST /codegen/project - Generate Complete Project
    // ============================================
    app.post<{
        Body: GenerateProjectBody;
    }>('/codegen/project', {
        schema: {
            description: 'Generate a complete project with AI-powered code generation',
            tags: ['codegen'],
            body: {
                type: 'object',
                required: ['projectName'],
                properties: {
                    taskId: { type: 'string', description: 'Optional task ID for tracking' },
                    projectName: { type: 'string', minLength: 1, maxLength: 100, description: 'Name of the project' },
                    outputPath: { type: 'string', description: 'Where to create the project (defaults to ./output)' },
                    language: {
                        type: 'string',
                        enum: ['typescript', 'python', 'go', 'rust', 'java'],
                        description: 'Programming language (default: typescript)',
                    },
                    framework: {
                        type: 'string',
                        enum: [
                            'express', 'fastify', 'nestjs', 'nextjs',      // TypeScript
                            'fastapi', 'django', 'flask',                  // Python
                            'gin', 'echo', 'fiber',                        // Go
                            'actix', 'rocket', 'axum',                     // Rust
                            'spring', 'quarkus', 'micronaut',              // Java
                        ],
                        description: 'Framework to use',
                    },
                    description: { type: 'string', description: 'Project description/prompt' },
                    modules: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of modules to generate (e.g., User, Product)',
                    },
                    installDependencies: { type: 'boolean', default: true, description: 'Install dependencies after generation' },
                    verify: { type: 'boolean', default: false, description: 'Run verification after generation' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        taskId: { type: 'string' },
                        projectPath: { type: 'string' },
                        language: { type: 'string' },
                        framework: { type: 'string' },
                        filesCreated: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    path: { type: 'string' },
                                    language: { type: 'string' },
                                },
                            },
                        },
                        dependenciesInstalled: { type: 'boolean' },
                        verified: { type: 'boolean' },
                        errors: { type: 'array', items: { type: 'string' } },
                        executionTime: { type: 'number' },
                        cost: { type: 'number' },
                        tokenUsage: {
                            type: 'object',
                            properties: {
                                prompt: { type: 'number' },
                                completion: { type: 'number' },
                                total: { type: 'number' },
                            },
                        },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: GenerateProjectBody }>, reply: FastifyReply) => {
        const { body } = request;
        const userId = (request as any).user?.id || 'anonymous';

        // Validate framework matches language
        if (body.framework && body.language) {
            const validCombos: Record<SupportedLanguage, SupportedFramework[]> = {
                typescript: ['express', 'fastify', 'nestjs', 'nextjs'],
                python: ['fastapi', 'django', 'flask'],
                go: ['gin', 'echo', 'fiber'],
                rust: ['actix', 'rocket', 'axum'],
                java: ['spring', 'quarkus', 'micronaut'],
            };

            if (!validCombos[body.language]?.includes(body.framework)) {
                return reply.status(400).send({
                    success: false,
                    error: `Framework ${body.framework} is not valid for language ${body.language}. Valid options: ${validCombos[body.language]?.join(', ')}`,
                });
            }
        }

        const taskId = body.taskId || `codegen-${Date.now()}`;
        const outputPath = body.outputPath || path.resolve(process.cwd(), 'output');

        app.log.info(`[CODEGEN] Starting project generation: ${body.projectName}`);

        try {
            const result = await codeGenService.generateProject({
                taskId,
                userId,
                prompt: body.description || `Generate ${body.projectName} project`,
                config: {
                    projectName: body.projectName,
                    outputPath,
                    language: body.language,
                    framework: body.framework,
                    description: body.description,
                    modules: body.modules,
                    installDependencies: body.installDependencies ?? true,
                    verify: body.verify ?? false,
                },
                onProgress: (step, progress, message) => {
                    app.log.debug(`[CODEGEN] ${step}: ${progress}% - ${message}`);
                },
            });

            return reply.send(result);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            app.log.error(`[CODEGEN] Generation failed: ${errorMsg}`);

            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    // ============================================
    // POST /codegen/module - Generate Single Module
    // ============================================
    app.post<{
        Body: GenerateModuleBody;
    }>('/codegen/module', {
        schema: {
            description: 'Generate a module (controller + service + repository) for an existing project',
            tags: ['codegen'],
            body: {
                type: 'object',
                required: ['moduleName', 'projectPath'],
                properties: {
                    taskId: { type: 'string', description: 'Optional task ID for tracking' },
                    moduleName: { type: 'string', minLength: 1, maxLength: 50, description: 'Name of the module (e.g., User, Product)' },
                    projectPath: { type: 'string', description: 'Path to the existing project' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        taskId: { type: 'string' },
                        filesCreated: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    path: { type: 'string' },
                                    language: { type: 'string' },
                                },
                            },
                        },
                        errors: { type: 'array', items: { type: 'string' } },
                        executionTime: { type: 'number' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: GenerateModuleBody }>, reply: FastifyReply) => {
        const { body } = request;
        const userId = (request as any).user?.id || 'anonymous';
        const taskId = body.taskId || `module-${Date.now()}`;

        app.log.info(`[CODEGEN] Generating module: ${body.moduleName}`);

        try {
            const result = await codeGenService.generateModule(
                body.moduleName,
                body.projectPath,
                { taskId, userId }
            );

            return reply.send(result);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            app.log.error(`[CODEGEN] Module generation failed: ${errorMsg}`);

            return reply.status(500).send({
                success: false,
                error: errorMsg,
            });
        }
    });

    // ============================================
    // GET /codegen/languages - Get Supported Languages
    // ============================================
    app.get('/codegen/languages', {
        schema: {
            description: 'Get supported languages and frameworks for code generation',
            tags: ['codegen'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        languages: { type: 'array', items: { type: 'string' } },
                        frameworks: {
                            type: 'object',
                            additionalProperties: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const configs = codeGenService.getSupportedConfigs();
        return reply.send(configs);
    });

    // ============================================
    // GET /codegen/health - Health Check
    // ============================================
    app.get('/codegen/health', {
        schema: {
            description: 'Check CodeGen service health',
            tags: ['codegen'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        healthy: { type: 'boolean' },
                        message: { type: 'string' },
                        details: { type: 'object' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const health = await codeGenService.healthCheck();
        return reply.send(health);
    });

    app.log.info('[ROUTES] CodeGen routes registered: /codegen/*');
}

export default registerCodeGenRoutes;
