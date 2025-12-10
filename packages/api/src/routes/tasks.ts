/**
 * Task Routes
 * Task submission, status, and streaming endpoints
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Validation schemas
const createTaskSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required').max(10000, 'Prompt too long'),
    projectId: z.string().uuid().optional(),
    priority: z.number().min(1).max(10).optional(),
    config: z.record(z.unknown()).optional(),
});

const listTasksQuerySchema = z.object({
    status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
});

// Type definitions
type CreateTaskBody = z.infer<typeof createTaskSchema>;
type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

/**
 * Register task routes
 */
export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {

    /**
     * POST /api/v1/tasks - Submit new generation task
     */
    app.post('/api/v1/tasks', {
        schema: {
            tags: ['Tasks'],
            summary: 'Submit new generation task',
            description: 'Submit a new code generation task. Returns immediately with task ID for tracking.',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['prompt'],
                properties: {
                    prompt: { type: 'string', minLength: 1, maxLength: 10000 },
                    projectId: { type: 'string', format: 'uuid' },
                    priority: { type: 'number', minimum: 1, maximum: 10 },
                    config: { type: 'object' },
                },
            },
            response: {
                202: {
                    type: 'object',
                    properties: {
                        taskId: { type: 'string' },
                        status: { type: 'string' },
                        message: { type: 'string' },
                        estimatedTime: { type: 'number', description: 'Estimated time in seconds' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: CreateTaskBody }>, reply: FastifyReply) => {
        // Validate input
        const validation = createTaskSchema.safeParse(request.body);

        if (!validation.success) {
            return reply.status(400).send({
                success: false,
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

        const { prompt, projectId, priority } = validation.data;

        // TODO: Check user quota
        // const hasQuota = await usersService.hasQuotaRemaining(userId);

        // TODO: Create task in database
        // const task = await tasksService.create({ user_id: userId, project_id: projectId, prompt });

        // TODO: Queue job in BullMQ
        // await queue.add('generate', { taskId: task.id, prompt, priority });

        // Placeholder response
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return reply.status(202).send({
            taskId,
            status: 'queued',
            message: 'Task queued successfully',
            estimatedTime: 30,
            prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
            projectId: projectId || null,
            priority: priority || 5,
        });
    });

    /**
     * GET /api/v1/tasks/:id - Get task status
     */
    app.get('/api/v1/tasks/:id', {
        schema: {
            tags: ['Tasks'],
            summary: 'Get task status',
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
                        status: { type: 'string' },
                        progress: { type: 'number' },
                        prompt: { type: 'string' },
                        result: { type: 'object' },
                        error: { type: 'string' },
                        agentsUsed: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string' },
                        startedAt: { type: 'string' },
                        completedAt: { type: 'string' },
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

        // TODO: Authenticate and get task
        // const task = await tasksService.getById(id);

        // Placeholder - simulate task not found
        return reply.status(404).send({
            error: `Task ${id} not found`,
        });
    });

    /**
     * GET /api/v1/tasks/:id/stream - SSE stream for real-time progress
     */
    app.get('/api/v1/tasks/:id/stream', {
        schema: {
            tags: ['Tasks'],
            summary: 'Stream task progress (SSE)',
            description: 'Server-Sent Events stream for real-time task progress updates',
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

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // For nginx
        });

        // Send initial connection event
        reply.raw.write(`event: connected\ndata: ${JSON.stringify({ taskId: id })}\n\n`);

        // TODO: Subscribe to task updates via Redis pub/sub or BullMQ events

        // Simulate progress updates (replace with real implementation)
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;

            if (progress <= 100) {
                reply.raw.write(`event: progress\ndata: ${JSON.stringify({
                    taskId: id,
                    progress,
                    status: progress < 100 ? 'processing' : 'completed'
                })}\n\n`);
            }

            if (progress >= 100) {
                reply.raw.write(`event: complete\ndata: ${JSON.stringify({
                    taskId: id,
                    status: 'completed',
                    message: 'Task completed successfully'
                })}\n\n`);
                clearInterval(interval);
                reply.raw.end();
            }
        }, 1000);

        // Clean up on client disconnect
        request.raw.on('close', () => {
            clearInterval(interval);
            reply.raw.end();
        });
    });

    /**
     * GET /api/v1/tasks - List user's tasks
     */
    app.get('/api/v1/tasks', {
        schema: {
            tags: ['Tasks'],
            summary: 'List user tasks',
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'] },
                    limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
                    offset: { type: 'number', default: 0, minimum: 0 },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        tasks: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    status: { type: 'string' },
                                    progress: { type: 'number' },
                                    prompt: { type: 'string' },
                                    createdAt: { type: 'string' },
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
    }, async (request: FastifyRequest<{ Querystring: ListTasksQuery }>, reply: FastifyReply) => {
        const validation = listTasksQuerySchema.safeParse(request.query);

        if (!validation.success) {
            return reply.status(400).send({
                error: 'Invalid query parameters',
                details: validation.error.flatten(),
            });
        }

        const { limit, offset } = validation.data;

        // TODO: Authenticate and get tasks
        // const { tasks, total } = await tasksService.getByUserId(userId, { status, limit, offset });

        return reply.send({
            tasks: [],
            total: 0,
            limit,
            offset,
        });
    });

    /**
     * DELETE /api/v1/tasks/:id - Cancel a pending task
     */
    app.delete('/api/v1/tasks/:id', {
        schema: {
            tags: ['Tasks'],
            summary: 'Cancel pending task',
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
                400: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;

        // TODO: Authenticate and cancel task
        // const task = await tasksService.cancel(id);

        return reply.send({
            success: true,
            message: `Task ${id} cancelled`,
        });
    });

    app.log.info('[ROUTES] Task routes registered: /api/v1/tasks/*');
}
