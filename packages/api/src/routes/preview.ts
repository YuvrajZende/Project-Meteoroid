/**
 * Preview Routes (Phase 16)
 * 
 * API endpoints for real-time preview and collaboration:
 * - GET /api/v1/preview/status - Get preview service status
 * - POST /api/v1/preview - Create/update preview session
 * - GET /api/v1/preview/:sessionId - Get preview HTML
 * - GET /api/v1/preview/:sessionId/html - Get raw preview HTML
 * - POST /api/v1/preview/:sessionId/refresh - Trigger HMR refresh
 * - POST /api/v1/preview/:sessionId/files - Update files (triggers HMR)
 * - DELETE /api/v1/preview/:sessionId - Delete preview session
 * - GET /api/v1/preview/:sessionId/stream - SSE stream for HMR updates
 * - POST /api/v1/preview/:sessionId/collaborate/join - Join collaboration
 * - POST /api/v1/preview/:sessionId/collaborate/cursor - Update cursor position
 * - GET /api/v1/preview/:sessionId/collaborate - Get collaboration state
 * - POST /api/v1/preview/:sessionId/collaborate/leave - Leave collaboration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    getPreviewService,
    type PreviewRequest,
    type PreviewFile,
    type HMRUpdate,
} from '../services/preview-service.js';

// ============================================
// TYPE DEFINITIONS FOR REQUEST BODIES
// ============================================

interface CreatePreviewBody {
    projectId: string;
    files: PreviewFile[];
    entryPoint?: string;
    framework?: 'react' | 'vue' | 'vanilla' | 'svelte' | 'preact';
    dependencies?: Record<string, string>;
    customHead?: string;
    theme?: 'light' | 'dark' | 'system';
}

interface UpdateFilesBody {
    files: PreviewFile[];
}

interface JoinCollaborationBody {
    clientId: string;
    userId?: string;
    username?: string;
}

interface UpdateCursorBody {
    clientId: string;
    line: number;
    column: number;
    file: string;
}

interface LeaveCollaborationBody {
    clientId: string;
}

interface SessionParams {
    sessionId: string;
}

// ============================================
// ROUTE REGISTRATION
// ============================================

export async function registerPreviewRoutes(app: FastifyInstance): Promise<void> {
    const previewService = getPreviewService();

    // ============================================
    // SERVICE STATUS
    // ============================================

    /**
     * GET /api/v1/preview/status
     * Get preview service status and configuration
     */
    app.get('/api/v1/preview/status', {
        schema: {
            description: 'Get preview service status',
            tags: ['Preview'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        status: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                enabled: { type: 'boolean' },
                                activeSessions: { type: 'number' },
                                totalClients: { type: 'number' },
                                collaborationEnabled: { type: 'boolean' },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, _reply: FastifyReply) => {
        const status = previewService.getStatus();
        return {
            success: true,
            status: status.enabled ? 'ready' : 'disabled',
            data: status,
        };
    });

    // ============================================
    // PREVIEW SESSION MANAGEMENT
    // ============================================

    /**
     * POST /api/v1/preview
     * Create or update a preview session
     */
    app.post<{ Body: CreatePreviewBody }>('/api/v1/preview', {
        schema: {
            description: 'Create or update a preview session',
            tags: ['Preview'],
            body: {
                type: 'object',
                required: ['projectId', 'files'],
                properties: {
                    projectId: { type: 'string' },
                    files: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['path', 'content', 'language'],
                            properties: {
                                path: { type: 'string' },
                                content: { type: 'string' },
                                language: {
                                    type: 'string',
                                    enum: ['typescript', 'javascript', 'jsx', 'tsx', 'css', 'html', 'json'],
                                },
                            },
                        },
                    },
                    entryPoint: { type: 'string' },
                    framework: {
                        type: 'string',
                        enum: ['react', 'vue', 'vanilla', 'svelte', 'preact'],
                    },
                    dependencies: { type: 'object' },
                    customHead: { type: 'string' },
                    theme: {
                        type: 'string',
                        enum: ['light', 'dark', 'system'],
                    },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                sessionId: { type: 'string' },
                                previewUrl: { type: 'string' },
                                framework: { type: 'string' },
                                version: { type: 'number' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: CreatePreviewBody }>, reply: FastifyReply) => {
        if (!previewService.isEnabled()) {
            return reply.status(503).send({
                success: false,
                error: 'Preview service is disabled',
            });
        }

        try {
            const result = await previewService.createPreview(request.body as PreviewRequest);
            return {
                success: true,
                data: {
                    sessionId: result.sessionId,
                    previewUrl: result.previewUrl,
                    framework: result.framework,
                    version: result.version,
                    dependencies: result.dependencies,
                },
            };
        } catch (error) {
            request.log.error(error, 'Failed to create preview');
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create preview',
            });
        }
    });

    /**
     * GET /api/v1/preview/:sessionId
     * Serve the preview HTML directly (for iframe embedding)
     */
    app.get<{ Params: SessionParams }>('/api/v1/preview/:sessionId', {
        schema: {
            description: 'Get preview HTML for iframe embedding',
            tags: ['Preview'],
            params: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                    sessionId: { type: 'string' },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
        const { sessionId } = request.params;
        const html = previewService.getPreviewHtml(sessionId);

        if (!html) {
            return reply.status(404).send({
                success: false,
                error: 'Preview session not found',
            });
        }

        return reply
            .header('Content-Type', 'text/html; charset=utf-8')
            .header('X-Frame-Options', 'SAMEORIGIN')
            .send(html);
    });

    /**
     * GET /api/v1/preview/:sessionId/html
     * Get raw preview HTML as JSON response
     */
    app.get<{ Params: SessionParams }>('/api/v1/preview/:sessionId/html', {
        schema: {
            description: 'Get preview HTML as JSON',
            tags: ['Preview'],
            params: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                    sessionId: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                html: { type: 'string' },
                                sessionId: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
        const { sessionId } = request.params;
        const html = previewService.getPreviewHtml(sessionId);
        const session = previewService.getSession(sessionId);

        if (!html || !session) {
            return reply.status(404).send({
                success: false,
                error: 'Preview session not found',
            });
        }

        return {
            success: true,
            data: {
                html,
                sessionId,
                framework: session.framework,
                version: session.version,
            },
        };
    });

    /**
     * POST /api/v1/preview/:sessionId/refresh
     * Trigger a full HMR refresh for all connected clients
     */
    app.post<{ Params: SessionParams }>('/api/v1/preview/:sessionId/refresh', {
        schema: {
            description: 'Trigger HMR refresh for all clients',
            tags: ['Preview'],
            params: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                    sessionId: { type: 'string' },
                },
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
    }, async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
        const { sessionId } = request.params;
        const session = previewService.getSession(sessionId);

        if (!session) {
            return reply.status(404).send({
                success: false,
                error: 'Preview session not found',
            });
        }

        previewService.forceRefresh(sessionId);
        return {
            success: true,
            message: 'Refresh triggered',
            version: session.version + 1,
        };
    });

    /**
     * POST /api/v1/preview/:sessionId/files
     * Update files and trigger HMR (hot update if possible, full reload otherwise)
     */
    app.post<{ Params: SessionParams; Body: UpdateFilesBody }>('/api/v1/preview/:sessionId/files', {
        schema: {
            description: 'Update preview files and trigger HMR',
            tags: ['Preview'],
            params: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                    sessionId: { type: 'string' },
                },
            },
            body: {
                type: 'object',
                required: ['files'],
                properties: {
                    files: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['path', 'content', 'language'],
                            properties: {
                                path: { type: 'string' },
                                content: { type: 'string' },
                                language: { type: 'string' },
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
                        data: {
                            type: 'object',
                            properties: {
                                type: { type: 'string' },
                                version: { type: 'number' },
                                files: { type: 'array', items: { type: 'string' } },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: SessionParams; Body: UpdateFilesBody }>, reply: FastifyReply) => {
        const { sessionId } = request.params;
        const { files } = request.body;

        try {
            const update = await previewService.updateFiles(sessionId, files);
            return {
                success: true,
                data: update,
            };
        } catch (error) {
            return reply.status(404).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update files',
            });
        }
    });

    /**
     * DELETE /api/v1/preview/:sessionId
     * Delete a preview session
     */
    app.delete<{ Params: SessionParams }>('/api/v1/preview/:sessionId', {
        schema: {
            description: 'Delete a preview session',
            tags: ['Preview'],
            params: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                    sessionId: { type: 'string' },
                },
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
    }, async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
        const { sessionId } = request.params;
        const deleted = previewService.deleteSession(sessionId);

        if (!deleted) {
            return reply.status(404).send({
                success: false,
                error: 'Preview session not found',
            });
        }

        return {
            success: true,
            message: 'Preview session deleted',
        };
    });

    // ============================================
    // HMR STREAM (Server-Sent Events)
    // ============================================

    /**
     * GET /api/v1/preview/:sessionId/stream
     * SSE stream for HMR updates (alternative to WebSocket)
     */
    app.get<{ Params: SessionParams }>('/api/v1/preview/:sessionId/stream', {
        schema: {
            description: 'SSE stream for HMR updates',
            tags: ['Preview'],
            params: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                    sessionId: { type: 'string' },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
        const { sessionId } = request.params;
        const session = previewService.getSession(sessionId);

        if (!session) {
            return reply.status(404).send({
                success: false,
                error: 'Preview session not found',
            });
        }

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Send initial connection message
        reply.raw.write(`data: ${JSON.stringify({
            type: 'connected',
            sessionId,
            version: session.version,
            message: 'Connected to HMR stream',
        })}\n\n`);

        // Subscribe to HMR updates
        const unsubscribe = previewService.subscribeToHMR(sessionId, (update: HMRUpdate) => {
            try {
                reply.raw.write(`data: ${JSON.stringify(update)}\n\n`);
            } catch (error) {
                // Client disconnected
                unsubscribe();
            }
        });

        // Handle client disconnect
        request.raw.on('close', () => {
            unsubscribe();
            request.log.info(`[PREVIEW] SSE client disconnected from ${sessionId}`);
        });

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(() => {
            try {
                reply.raw.write(`: heartbeat\n\n`);
            } catch (error) {
                clearInterval(heartbeat);
                unsubscribe();
            }
        }, 30000);

        request.raw.on('close', () => {
            clearInterval(heartbeat);
        });
    });

    // ============================================
    // COLLABORATION ENDPOINTS
    // ============================================

    /**
     * POST /api/v1/preview/:sessionId/collaborate/join
     * Join a collaboration session
     */
    app.post<{ Params: SessionParams; Body: JoinCollaborationBody }>(
        '/api/v1/preview/:sessionId/collaborate/join',
        {
            schema: {
                description: 'Join a collaboration session',
                tags: ['Preview', 'Collaboration'],
                params: {
                    type: 'object',
                    required: ['sessionId'],
                    properties: {
                        sessionId: { type: 'string' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['clientId'],
                    properties: {
                        clientId: { type: 'string' },
                        userId: { type: 'string' },
                        username: { type: 'string' },
                    },
                },
            },
        },
        async (request: FastifyRequest<{ Params: SessionParams; Body: JoinCollaborationBody }>, reply: FastifyReply) => {
            const { sessionId } = request.params;
            const { clientId, userId, username } = request.body;

            try {
                const state = previewService.joinCollaboration(sessionId, clientId, { userId, username });

                // Convert Maps to objects for JSON response
                const activeUsers = Object.fromEntries(state.activeUsers);
                const cursors = Object.fromEntries(
                    Array.from(state.cursors.entries()).map(([k, v]) => [k, v])
                );

                return {
                    success: true,
                    data: {
                        sessionId,
                        activeUsers,
                        cursors,
                        yourColor: activeUsers[clientId]?.color,
                    },
                };
            } catch (error) {
                return reply.status(400).send({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to join collaboration',
                });
            }
        }
    );

    /**
     * POST /api/v1/preview/:sessionId/collaborate/cursor
     * Update cursor position
     */
    app.post<{ Params: SessionParams; Body: UpdateCursorBody }>(
        '/api/v1/preview/:sessionId/collaborate/cursor',
        {
            schema: {
                description: 'Update cursor position in collaboration',
                tags: ['Preview', 'Collaboration'],
                params: {
                    type: 'object',
                    required: ['sessionId'],
                    properties: {
                        sessionId: { type: 'string' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['clientId', 'line', 'column', 'file'],
                    properties: {
                        clientId: { type: 'string' },
                        line: { type: 'number' },
                        column: { type: 'number' },
                        file: { type: 'string' },
                    },
                },
            },
        },
        async (request: FastifyRequest<{ Params: SessionParams; Body: UpdateCursorBody }>, _reply: FastifyReply) => {
            const { sessionId } = request.params;
            const { clientId, line, column, file } = request.body;

            previewService.updateCursor(sessionId, clientId, { line, column, file });

            return {
                success: true,
                message: 'Cursor updated',
            };
        }
    );

    /**
     * GET /api/v1/preview/:sessionId/collaborate
     * Get current collaboration state
     */
    app.get<{ Params: SessionParams }>(
        '/api/v1/preview/:sessionId/collaborate',
        {
            schema: {
                description: 'Get collaboration state',
                tags: ['Preview', 'Collaboration'],
                params: {
                    type: 'object',
                    required: ['sessionId'],
                    properties: {
                        sessionId: { type: 'string' },
                    },
                },
            },
        },
        async (request: FastifyRequest<{ Params: SessionParams }>, _reply: FastifyReply) => {
            const { sessionId } = request.params;
            const state = previewService.getCollaborationState(sessionId);

            if (!state) {
                return {
                    success: true,
                    data: {
                        sessionId,
                        activeUsers: {},
                        cursors: {},
                    },
                };
            }

            return {
                success: true,
                data: {
                    sessionId,
                    activeUsers: Object.fromEntries(state.activeUsers),
                    cursors: Object.fromEntries(
                        Array.from(state.cursors.entries()).map(([k, v]) => [k, v])
                    ),
                },
            };
        }
    );

    /**
     * POST /api/v1/preview/:sessionId/collaborate/leave
     * Leave a collaboration session
     */
    app.post<{ Params: SessionParams; Body: LeaveCollaborationBody }>(
        '/api/v1/preview/:sessionId/collaborate/leave',
        {
            schema: {
                description: 'Leave a collaboration session',
                tags: ['Preview', 'Collaboration'],
                params: {
                    type: 'object',
                    required: ['sessionId'],
                    properties: {
                        sessionId: { type: 'string' },
                    },
                },
                body: {
                    type: 'object',
                    required: ['clientId'],
                    properties: {
                        clientId: { type: 'string' },
                    },
                },
            },
        },
        async (request: FastifyRequest<{ Params: SessionParams; Body: LeaveCollaborationBody }>, _reply: FastifyReply) => {
            const { sessionId } = request.params;
            const { clientId } = request.body;

            previewService.leaveCollaboration(sessionId, clientId);

            return {
                success: true,
                message: 'Left collaboration session',
            };
        }
    );

    // NOTE: /api/v1/projects/:id/preview is already registered in deployment.ts
    // Use /api/v1/preview/:sessionId for direct preview access

    app.log.info('[ROUTES] Preview routes registered: /api/v1/preview/*');
}
