/**
 * Auth Routes
 * Authentication endpoints using Supabase Auth
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Validation schemas
const signupSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

const apiKeyCreateSchema = z.object({
    name: z.string().min(1, 'API key name is required'),
    scopes: z.array(z.enum(['read', 'write', 'admin'])).optional(),
    expiresInDays: z.number().positive().optional(),
});

// Type definitions
type SignupBody = z.infer<typeof signupSchema>;
type LoginBody = z.infer<typeof loginSchema>;
type ApiKeyCreateBody = z.infer<typeof apiKeyCreateSchema>;

/**
 * Register auth routes
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {

    /**
     * POST /api/v1/auth/signup - Register new user
     */
    app.post('/api/v1/auth/signup', {
        schema: {
            tags: ['Auth'],
            summary: 'Register new user',
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' },
                },
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: SignupBody }>, reply: FastifyReply) => {
        const validation = signupSchema.safeParse(request.body);

        if (!validation.success) {
            return reply.status(400).send({
                success: false,
                error: 'Validation failed',
                details: validation.error.flatten(),
            });
        }

        const { email, password, name } = validation.data;

        // TODO: Integrate with Supabase Auth
        // const { data, error } = await supabase.auth.signUp({ email, password });

        // Placeholder response
        return reply.status(201).send({
            success: true,
            message: 'User registered successfully. Please verify your email.',
            user: {
                id: 'placeholder-id',
                email,
                name,
            },
        });
    });

    /**
     * POST /api/v1/auth/login - Login user
     */
    app.post('/api/v1/auth/login', {
        schema: {
            tags: ['Auth'],
            summary: 'Login user',
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                        expiresIn: { type: 'number' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
        const validation = loginSchema.safeParse(request.body);

        if (!validation.success) {
            return reply.status(400).send({
                success: false,
                error: 'Validation failed',
                details: validation.error.flatten(),
            });
        }

        const { email, password } = validation.data;

        // TODO: Integrate with Supabase Auth
        // const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        // For now, reject all logins until Supabase is configured
        return reply.status(401).send({
            success: false,
            error: 'Invalid credentials',
            message: `Auth not configured. Email: ${email}, Pass length: ${password.length}`,
        });
    });

    /**
     * POST /api/v1/auth/logout - Logout user
     */
    app.post('/api/v1/auth/logout', {
        schema: {
            tags: ['Auth'],
            summary: 'Logout user',
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
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        // TODO: Integrate with Supabase Auth
        // await supabase.auth.signOut();

        return reply.send({
            success: true,
            message: 'Logged out successfully',
        });
    });

    /**
     * POST /api/v1/auth/refresh - Refresh access token
     */
    app.post('/api/v1/auth/refresh', {
        schema: {
            tags: ['Auth'],
            summary: 'Refresh access token',
            body: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                    refreshToken: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                        expiresIn: { type: 'number' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
        const { refreshToken } = request.body;

        if (!refreshToken) {
            return reply.status(400).send({
                success: false,
                error: 'Refresh token is required',
            });
        }

        // TODO: Integrate with Supabase Auth
        // const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

        return reply.status(401).send({
            success: false,
            error: 'Invalid refresh token',
        });
    });

    /**
     * GET /api/v1/auth/me - Get current user
     */
    app.get('/api/v1/auth/me', {
        schema: {
            tags: ['Auth'],
            summary: 'Get current user',
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string' },
                        tier: { type: 'string' },
                        apiQuotaUsed: { type: 'number' },
                        createdAt: { type: 'string' },
                    },
                },
                401: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        // TODO: Extract user from JWT token
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({
                error: 'Authentication required',
            });
        }

        // TODO: Validate token and get user from database
        return reply.status(401).send({
            error: 'Invalid or expired token',
        });
    });

    /**
     * POST /api/v1/auth/api-key - Generate API key
     */
    app.post('/api/v1/auth/api-key', {
        schema: {
            tags: ['Auth'],
            summary: 'Generate API key',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    scopes: { type: 'array', items: { type: 'string' } },
                    expiresInDays: { type: 'number' },
                },
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        apiKey: { type: 'string', description: 'Full API key (shown only once)' },
                        keyPrefix: { type: 'string' },
                        name: { type: 'string' },
                        expiresAt: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: ApiKeyCreateBody }>, reply: FastifyReply) => {
        const validation = apiKeyCreateSchema.safeParse(request.body);

        if (!validation.success) {
            return reply.status(400).send({
                success: false,
                error: 'Validation failed',
                details: validation.error.flatten(),
            });
        }

        // TODO: Get user from JWT and generate API key
        // const { key, record } = await apiKeysService.generate(userId, name, { scopes, expiresInDays });

        return reply.status(401).send({
            success: false,
            error: 'Authentication required',
        });
    });

    /**
     * GET /api/v1/auth/api-keys - List user's API keys
     */
    app.get('/api/v1/auth/api-keys', {
        schema: {
            tags: ['Auth'],
            summary: 'List API keys',
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        keys: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    keyPrefix: { type: 'string' },
                                    scopes: { type: 'array', items: { type: 'string' } },
                                    expiresAt: { type: 'string' },
                                    lastUsedAt: { type: 'string' },
                                    createdAt: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({
                error: 'Authentication required',
            });
        }

        // TODO: Get user's API keys
        return reply.send({
            keys: [],
        });
    });

    /**
     * DELETE /api/v1/auth/api-key/:id - Revoke API key
     */
    app.delete('/api/v1/auth/api-key/:id', {
        schema: {
            tags: ['Auth'],
            summary: 'Revoke API key',
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
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({
                error: 'Authentication required',
            });
        }

        const { id } = request.params;

        // TODO: Revoke API key
        // await apiKeysService.revoke(id, userId);

        return reply.send({
            success: true,
            message: `API key ${id} revoked successfully`,
        });
    });

    app.log.info('[ROUTES] Auth routes registered: /api/v1/auth/*');
}
