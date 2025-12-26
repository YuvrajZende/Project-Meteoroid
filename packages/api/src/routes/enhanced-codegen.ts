/**
 * Enhanced Code Generator Routes
 * 
 * API endpoints for multi-language code generation
 * Integrates Phase 17 improvements with Person 4's multi-language support
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    getEnhancedCodeGenerator,
    type EnhancedCodeGenRequest,
    type SupportedLanguage,
    type SupportedFramework,
} from '../services/generation/enhanced-code-generator.js';

// Request body schema
interface GenerateProjectBody {
    projectName: string;
    description: string;
    language: SupportedLanguage;
    framework?: SupportedFramework;
    entities?: Array<{
        name: string;
        tableName?: string;
        fields: Array<{
            name: string;
            type: string;
            required?: boolean;
            unique?: boolean;
        }>;
    }>;
    features?: Array<'auth' | 'crud' | 'pagination' | 'validation' | 'logging' | 'caching' | 'rate-limiting' | 'websocket' | 'graphql' | 'swagger'>;
    database?: 'prisma' | 'supabase' | 'drizzle';
    includeTests?: boolean;
    includeDocker?: boolean;
    includeAuth?: boolean;
    validate?: boolean;
}

export async function enhancedCodegenRoutes(app: FastifyInstance): Promise<void> {
    const generator = getEnhancedCodeGenerator();

    /**
     * POST /api/v1/codegen/generate
     * Generate a complete project with multi-language support
     */
    app.post('/api/v1/codegen/generate', async (
        request: FastifyRequest<{ Body: GenerateProjectBody }>,
        reply: FastifyReply
    ) => {
        const startTime = Date.now();

        try {
            const body = request.body;

            // Validate required fields
            if (!body.projectName || !body.description || !body.language) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required fields: projectName, description, language',
                });
            }

            // Convert to EnhancedCodeGenRequest
            const req: EnhancedCodeGenRequest = {
                projectName: body.projectName,
                description: body.description,
                language: body.language,
                framework: body.framework,
                entities: body.entities?.map(e => ({
                    name: e.name,
                    tableName: e.tableName || e.name.toLowerCase() + 's',
                    fields: e.fields.map(f => ({
                        name: f.name,
                        type: f.type as 'string' | 'int' | 'float' | 'boolean' | 'datetime' | 'json' | 'relation',
                        required: f.required,
                        unique: f.unique,
                    })),
                })),
                features: body.features,
                database: body.database,
                includeTests: body.includeTests ?? true,
                includeDocker: body.includeDocker ?? true,
                includeAuth: body.includeAuth ?? false,
                validate: body.validate ?? false,
            };

            const result = await generator.generate(req);

            const executionTime = Date.now() - startTime;

            return reply.send({
                success: result.success,
                data: {
                    projectName: result.projectName,
                    language: result.language,
                    framework: result.framework,
                    stats: result.stats,
                    files: result.files.map(f => ({
                        path: f.path,
                        type: f.type,
                        language: f.language,
                        size: f.content.length,
                    })),
                    dependencies: result.dependencies,
                    devDependencies: result.devDependencies,
                    scripts: result.scripts,
                    envVars: Object.keys(result.envVars),
                },
                executionTime,
                errors: result.errors,
                warnings: result.warnings,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Generation failed';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    /**
     * GET /api/v1/codegen/languages
     * Get supported languages and frameworks
     */
    app.get('/api/v1/codegen/languages', async (
        _request: FastifyRequest,
        reply: FastifyReply
    ) => {
        const configs = generator.getSupportedConfigs();
        return reply.send({
            success: true,
            data: configs,
        });
    });

    /**
     * POST /api/v1/codegen/scaffold
     * Generate only project scaffolding (config files)
     */
    app.post('/api/v1/codegen/scaffold', async (
        request: FastifyRequest<{ Body: { projectName: string; description: string; language?: SupportedLanguage } }>,
        reply: FastifyReply
    ) => {
        try {
            const body = request.body;

            if (!body.projectName) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required field: projectName',
                });
            }

            const result = await generator.generate({
                projectName: body.projectName,
                description: body.description || 'Generated project',
                language: body.language || 'typescript',
                includeTests: false,
                includeDocker: true,
                includeAuth: false,
            });

            return reply.send({
                success: result.success,
                data: {
                    projectName: result.projectName,
                    language: result.language,
                    framework: result.framework,
                    files: result.files,
                    dependencies: result.dependencies,
                    devDependencies: result.devDependencies,
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Scaffold generation failed';
            return reply.status(500).send({
                success: false,
                error: message,
            });
        }
    });

    app.log.info('✅ Enhanced CodeGen routes registered: /api/v1/codegen/*');
}
