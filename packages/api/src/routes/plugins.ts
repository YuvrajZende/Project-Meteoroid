/**
 * Plugin Routes - Phase 28
 * 
 * API endpoints for the plugin system:
 * - GET  /api/v1/plugins/catalog       → Full plugin catalog with fields
 * - POST /api/v1/plugins/validate      → Validate plugin configs
 * - POST /api/v1/plugins/test          → Test connectivity to services
 * - POST /api/v1/plugins/context       → Build AI generation context from active plugins
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPluginRegistry, type PluginConfig } from '../domain/services/plugins/index.js';

// ============================================
// SCHEMAS
// ============================================

const PluginConfigSchema = z.object({
    pluginId: z.string().optional(),
    name: z.string(),
    category: z.string(),
    config: z.record(z.string(), z.string()),
});

const ValidateSchema = z.object({
    plugins: z.array(PluginConfigSchema),
});

const TestConnectionSchema = z.object({
    plugins: z.array(PluginConfigSchema),
});

const BuildContextSchema = z.object({
    plugins: z.array(PluginConfigSchema),
});

// ============================================
// ROUTE HANDLER
// ============================================

export async function registerPluginRoutes(app: FastifyInstance): Promise<void> {
    const registry = getPluginRegistry();

    /**
     * GET /api/v1/plugins/catalog
     * Returns the full plugin catalog with all field definitions
     */
    app.get('/api/v1/plugins/catalog', {
        schema: {
            tags: ['Plugins'],
            summary: 'Get plugin catalog',
            description: 'Returns all available plugins organized by category, with required credential fields',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        catalog: {
                            type: 'object',
                            additionalProperties: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        name: { type: 'string' },
                                        category: { type: 'string' },
                                        description: { type: 'string' },
                                        fields: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    key: { type: 'string' },
                                                    label: { type: 'string' },
                                                    type: { type: 'string' },
                                                    required: { type: 'boolean' },
                                                    placeholder: { type: 'string' },
                                                },
                                            },
                                        },
                                        tags: { type: 'array', items: { type: 'string' } },
                                        connectionTest: { type: 'string' },
                                    },
                                },
                            },
                        },
                        totalPlugins: { type: 'number' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const catalog = registry.getCatalogByCategory();
        const total = registry.getCatalog().length;

        return reply.send({
            success: true,
            catalog,
            totalPlugins: total,
        });
    });

    /**
     * GET /api/v1/plugins/:pluginId
     * Returns a single plugin definition
     */
    app.get('/api/v1/plugins/:pluginId', {
        schema: {
            tags: ['Plugins'],
            summary: 'Get plugin details',
            params: {
                type: 'object',
                properties: {
                    pluginId: { type: 'string' },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { pluginId } = request.params as { pluginId: string };
        const plugin = registry.getPlugin(pluginId);

        if (!plugin) {
            return reply.code(404).send({
                success: false,
                error: `Plugin not found: ${pluginId}`,
            });
        }

        return reply.send({
            success: true,
            plugin,
        });
    });

    /**
     * POST /api/v1/plugins/validate
     * Validates plugin configurations (checks required fields, URL format, etc.)
     */
    app.post('/api/v1/plugins/validate', {
        schema: {
            tags: ['Plugins'],
            summary: 'Validate plugin configurations',
            description: 'Checks all required fields, URL formats, and secret lengths for each plugin config',
            body: {
                type: 'object',
                required: ['plugins'],
                properties: {
                    plugins: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                pluginId: { type: 'string' },
                                name: { type: 'string' },
                                category: { type: 'string' },
                                config: { type: 'object', additionalProperties: { type: 'string' } },
                            },
                        },
                    },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        valid: { type: 'boolean' },
                        results: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    pluginId: { type: 'string' },
                                    valid: { type: 'boolean' },
                                    errors: { type: 'array', items: { type: 'string' } },
                                    warnings: { type: 'array', items: { type: 'string' } },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = ValidateSchema.parse(request.body);
        const validation = registry.validateAllConfigs(body.plugins as PluginConfig[]);

        app.log.info(`[PLUGINS] Validated ${body.plugins.length} plugin configs: ${validation.valid ? 'ALL VALID' : 'HAS ERRORS'}`);

        return reply.send({
            success: true,
            valid: validation.valid,
            results: validation.results,
        });
    });

    /**
     * POST /api/v1/plugins/test
     * Tests connectivity to services (HTTP ping, endpoint check)
     */
    app.post('/api/v1/plugins/test', {
        schema: {
            tags: ['Plugins'],
            summary: 'Test plugin connectivity',
            description: 'Pings each service endpoint to verify reachability and measure latency',
            body: {
                type: 'object',
                required: ['plugins'],
                properties: {
                    plugins: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                pluginId: { type: 'string' },
                                name: { type: 'string' },
                                category: { type: 'string' },
                                config: { type: 'object', additionalProperties: { type: 'string' } },
                            },
                        },
                    },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        results: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    pluginId: { type: 'string' },
                                    reachable: { type: 'boolean' },
                                    latencyMs: { type: 'number' },
                                    error: { type: 'string' },
                                    details: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = TestConnectionSchema.parse(request.body);

        app.log.info(`[PLUGINS] Testing connectivity for ${body.plugins.length} plugins...`);

        const results = await registry.testAllConnections(body.plugins as PluginConfig[]);

        const reachableCount = results.filter(r => r.reachable).length;
        app.log.info(`[PLUGINS] Connectivity: ${reachableCount}/${results.length} reachable`);

        return reply.send({
            success: true,
            results,
        });
    });

    /**
     * POST /api/v1/plugins/context
     * Builds AI generation context from active plugin configs
     */
    app.post('/api/v1/plugins/context', {
        schema: {
            tags: ['Plugins'],
            summary: 'Build generation context from plugins',
            description: 'Returns the system prompt section, tech stack, env vars, and packages for AI code generation',
            body: {
                type: 'object',
                required: ['plugins'],
                properties: {
                    plugins: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                pluginId: { type: 'string' },
                                name: { type: 'string' },
                                category: { type: 'string' },
                                config: { type: 'object', additionalProperties: { type: 'string' } },
                            },
                        },
                    },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        context: {
                            type: 'object',
                            properties: {
                                systemPromptSection: { type: 'string' },
                                techStack: { type: 'array', items: { type: 'string' } },
                                envVars: { type: 'object', additionalProperties: { type: 'string' } },
                                packages: { type: 'object' },
                                contextTree: { type: 'array' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = BuildContextSchema.parse(request.body);
        const context = registry.buildPluginContext(body.plugins as PluginConfig[]);

        app.log.info(`[PLUGINS] Built context: ${context.techStack.length} plugins, ${Object.keys(context.envVars).length} env vars`);

        return reply.send({
            success: true,
            context,
        });
    });

    app.log.info('[ROUTES] Plugin routes registered (Phase 28)');
}
