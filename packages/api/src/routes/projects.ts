/**
 * Project Routes
 * Project management endpoints
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Validation schemas
const createProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required').max(100),
    description: z.string().max(500).optional(),
    config: z.record(z.unknown()).optional(),
});

const updateProjectSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    config: z.record(z.unknown()).optional(),
});

const listProjectsQuerySchema = z.object({
    status: z.enum(['pending', 'generating', 'completed', 'failed']).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
});

// Type definitions
type CreateProjectBody = z.infer<typeof createProjectSchema>;
type UpdateProjectBody = z.infer<typeof updateProjectSchema>;
type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

/**
 * Register project routes
 */
export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {

    /**
     * POST /api/v1/projects - Create project
     */
    app.post('/api/v1/projects', {
        schema: {
            tags: ['Projects'],
            summary: 'Create new project',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    description: { type: 'string', maxLength: 500 },
                    config: { type: 'object' },
                },
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        status: { type: 'string' },
                        createdAt: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: CreateProjectBody }>, reply: FastifyReply) => {
        const validation = createProjectSchema.safeParse(request.body);

        if (!validation.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: validation.error.flatten(),
            });
        }

        // TODO: Authenticate user
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({
                error: 'Authentication required',
            });
        }

        const { name, description, config } = validation.data;

        // TODO: Create project in database
        // const project = await projectsService.create({ user_id: userId, name, description, config });

        // Placeholder response
        const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return reply.status(201).send({
            id: projectId,
            name,
            description: description || null,
            config: config || {},
            status: 'pending',
            createdAt: new Date().toISOString(),
        });
    });

    /**
     * GET /api/v1/projects - List user's projects
     */
    app.get('/api/v1/projects', {
        schema: {
            tags: ['Projects'],
            summary: 'List user projects',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['pending', 'generating', 'completed', 'failed'] },
                    limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
                    offset: { type: 'number', default: 0, minimum: 0 },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        projects: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    status: { type: 'string' },
                                    createdAt: { type: 'string' },
                                    updatedAt: { type: 'string' },
                                },
                            },
                        },
                        total: { type: 'number' },
                        limit: { type: 'number' },
                        offset: { type: 'number' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Querystring: ListProjectsQuery }>, reply: FastifyReply) => {
        const validation = listProjectsQuerySchema.safeParse(request.query);

        if (!validation.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: validation.error.flatten(),
            });
        }

        const { limit, offset } = validation.data;

        // TODO: Authenticate and get projects
        // const { projects, total } = await projectsService.getByUserId(userId, { status, limit, offset });

        return reply.send({
            projects: [],
            total: 0,
            limit,
            offset,
        });
    });

    /**
     * GET /api/v1/projects/:id - Get project details
     */
    app.get('/api/v1/projects/:id', {
        schema: {
            tags: ['Projects'],
            summary: 'Get project details',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        config: { type: 'object' },
                        status: { type: 'string' },
                        tasks: { type: 'array' },
                        createdAt: { type: 'string' },
                        updatedAt: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;

        // TODO: Authenticate and get project
        // const project = await projectsService.getById(id);

        return reply.status(404).send({
            error: `Project ${id} not found`,
        });
    });

    /**
     * PUT /api/v1/projects/:id - Update project
     */
    app.put('/api/v1/projects/:id', {
        schema: {
            tags: ['Projects'],
            summary: 'Update project',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    description: { type: 'string', maxLength: 500 },
                    config: { type: 'object' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        status: { type: 'string' },
                        updatedAt: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateProjectBody }>, reply: FastifyReply) => {
        const { id } = request.params;

        const validation = updateProjectSchema.safeParse(request.body);

        if (!validation.success) {
            return reply.status(400).send({
                error: 'Validation failed',
                details: validation.error.flatten(),
            });
        }

        // TODO: Authenticate and update project
        // const project = await projectsService.update(id, validation.data);

        return reply.status(404).send({
            error: `Project ${id} not found`,
        });
    });

    /**
     * DELETE /api/v1/projects/:id - Delete project
     */
    app.delete('/api/v1/projects/:id', {
        schema: {
            tags: ['Projects'],
            summary: 'Delete project',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;

        // TODO: Authenticate and delete project
        // await projectsService.delete(id);

        return reply.send({
            success: true,
            message: `Project ${id} deleted`,
        });
    });

    /**
     * GET /api/v1/projects/:id/download - Download generated code as ZIP
     */
    app.get('/api/v1/projects/:id/download', {
        schema: {
            tags: ['Projects'],
            summary: 'Download project as ZIP',
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                },
                required: ['id'],
            },
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;

        // TODO: Authenticate and check project ownership
        // const project = await projectsService.getById(id);

        // TODO: Generate ZIP file from project files
        // For now, return not implemented
        return reply.status(501).send({
            error: 'Download not yet implemented',
            projectId: id,
        });
    });

    app.log.info('[ROUTES] Project routes registered: /api/v1/projects/*');
}
