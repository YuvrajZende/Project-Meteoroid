/**
 * Auth Routes
 * Authentication endpoints using Supabase Auth
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getSupabaseClient, getSupabaseAdmin } from '../services/infrastructure/database-client.js';

// Supported OAuth providers
type OAuthProvider = 'github' | 'google' | 'gitlab';

const OAUTH_PROVIDERS: OAuthProvider[] = ['github', 'google', 'gitlab'];

// OAuth callback query schema
const oauthCallbackSchema = z.object({
    code: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    state: z.string().optional(),
});

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

        try {
            const supabase = getSupabaseClient();

            // Sign up with Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name || email.split('@')[0],
                    },
                },
            });

            if (error) {
                return reply.status(400).send({
                    success: false,
                    error: 'Signup failed',
                    details: error.message,
                });
            }

            // Sync to users table
            if (data.user) {
                const supabaseAdmin = getSupabaseAdmin();
                await supabaseAdmin.from('users').upsert({
                    id: data.user.id,
                    email: data.user.email,
                    name: name || email.split('@')[0],
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
            }

            return reply.status(201).send({
                success: true,
                message: 'User registered successfully. Please verify your email.',
                user: {
                    id: data.user?.id || 'pending',
                    email,
                    name,
                },
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Signup failed',
                details: errorMessage,
            });
        }
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

        try {
            const supabase = getSupabaseClient();

            // Sign in with Supabase Auth
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return reply.status(401).send({
                    success: false,
                    error: 'Invalid credentials',
                    details: error.message,
                });
            }

            if (!data.session) {
                return reply.status(401).send({
                    success: false,
                    error: 'Login failed - no session returned',
                });
            }

            return reply.send({
                success: true,
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresIn: data.session.expires_in,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.user_metadata?.name,
                },
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Login failed',
                details: errorMessage,
            });
        }
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

        try {
            const supabase = getSupabaseClient();

            // Refresh the session using Supabase
            const { data, error } = await supabase.auth.refreshSession({
                refresh_token: refreshToken,
            });

            if (error) {
                return reply.status(401).send({
                    success: false,
                    error: 'Invalid or expired refresh token',
                    details: error.message,
                });
            }

            if (!data.session) {
                return reply.status(401).send({
                    success: false,
                    error: 'Failed to refresh session',
                });
            }

            return reply.send({
                success: true,
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresIn: data.session.expires_in,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Token refresh failed',
                details: errorMessage,
            });
        }
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
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.status(401).send({
                error: 'Authentication required',
                message: 'Please provide a valid Bearer token in the Authorization header',
            });
        }

        const token = authHeader.slice(7); // Remove 'Bearer ' prefix

        try {
            const supabase = getSupabaseAdmin();

            // Verify the token and get user
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                return reply.status(401).send({
                    error: 'Invalid or expired token',
                    details: error?.message,
                });
            }

            // Fetch additional user data from our users table
            const { data: userData } = await supabase
                .from('users')
                .select('tier, api_quota_used, created_at')
                .eq('id', user.id)
                .single();

            return reply.send({
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0],
                avatar: user.user_metadata?.avatar_url,
                provider: user.app_metadata?.provider,
                tier: userData?.tier || 'free',
                apiQuotaUsed: userData?.api_quota_used || 0,
                createdAt: userData?.created_at || user.created_at,
                emailVerified: !!user.email_confirmed_at,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            return reply.status(500).send({
                error: 'Failed to get user information',
                details: errorMessage,
            });
        }
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

    // ========================================================================
    // 🔐 OAUTH SOCIAL LOGIN ROUTES
    // ========================================================================

    /**
     * GET /api/v1/auth/providers - List available OAuth providers
     */
    app.get('/api/v1/auth/providers', {
        schema: {
            tags: ['Auth', 'OAuth'],
            summary: 'List available OAuth providers',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        providers: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    enabled: { type: 'boolean' },
                                    authUrl: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const providers = OAUTH_PROVIDERS.map(provider => ({
            id: provider,
            name: provider.charAt(0).toUpperCase() + provider.slice(1),
            enabled: true,
            authUrl: `/api/v1/auth/oauth/${provider}`,
        }));

        return reply.send({ providers });
    });

    /**
     * GET /api/v1/auth/oauth/:provider - Initiate OAuth flow
     * Redirects user to the provider's authorization page
     */
    app.get<{ Params: { provider: string }; Querystring: { redirect_to?: string } }>(
        '/api/v1/auth/oauth/:provider',
        {
            schema: {
                tags: ['Auth', 'OAuth'],
                summary: 'Initiate OAuth login flow',
                params: {
                    type: 'object',
                    properties: {
                        provider: { type: 'string', enum: OAUTH_PROVIDERS },
                    },
                    required: ['provider'],
                },
                querystring: {
                    type: 'object',
                    properties: {
                        redirect_to: { type: 'string', description: 'URL to redirect after login' },
                    },
                },
            },
        },
        async (request, reply) => {
            const { provider } = request.params;
            const { redirect_to } = request.query;

            if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
                return reply.status(400).send({
                    success: false,
                    error: `Invalid OAuth provider: ${provider}`,
                    availableProviders: OAUTH_PROVIDERS,
                });
            }

            try {
                const supabase = getSupabaseClient();

                // Build the redirect URL for after OAuth completes
                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
                const redirectTo = redirect_to || `${siteUrl}/auth/callback`;

                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: provider as OAuthProvider,
                    options: {
                        redirectTo,
                        scopes: provider === 'github'
                            ? 'read:user user:email'
                            : provider === 'gitlab'
                                ? 'read_user openid profile email'
                                : 'openid email profile',
                    },
                });

                if (error) {
                    app.log.error(`OAuth initiation failed for ${provider}: ${error.message}`);
                    return reply.status(500).send({
                        success: false,
                        error: 'OAuth initiation failed',
                        details: error.message,
                    });
                }

                if (data.url) {
                    app.log.info(`[OAuth] Redirecting to ${provider} authorization page`);
                    return reply.redirect(data.url);
                }

                return reply.status(500).send({
                    success: false,
                    error: 'Failed to generate OAuth URL',
                });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                app.log.error(`OAuth error: ${errorMessage}`);
                return reply.status(500).send({
                    success: false,
                    error: 'OAuth initiation failed',
                    details: errorMessage,
                });
            }
        }
    );

    /**
     * GET /api/v1/auth/callback - OAuth callback handler
     * Handles the redirect from OAuth providers
     */
    app.get<{ Querystring: z.infer<typeof oauthCallbackSchema> }>(
        '/api/v1/auth/callback',
        {
            schema: {
                tags: ['Auth', 'OAuth'],
                summary: 'OAuth callback handler',
                querystring: {
                    type: 'object',
                    properties: {
                        code: { type: 'string' },
                        error: { type: 'string' },
                        error_description: { type: 'string' },
                        state: { type: 'string' },
                    },
                },
            },
        },
        async (request, reply) => {
            const { code, error, error_description } = request.query;

            // Handle OAuth errors
            if (error) {
                app.log.error(`OAuth callback error: ${error} - ${error_description}`);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                return reply.redirect(
                    `${frontendUrl}/auth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || 'OAuth failed')}`
                );
            }

            if (!code) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing authorization code',
                });
            }

            try {
                const supabase = getSupabaseClient();

                // Exchange the code for a session
                const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                if (exchangeError) {
                    app.log.error(`OAuth code exchange failed: ${exchangeError.message}`);
                    return reply.status(401).send({
                        success: false,
                        error: 'Failed to exchange OAuth code',
                        details: exchangeError.message,
                    });
                }

                if (!data.session) {
                    return reply.status(401).send({
                        success: false,
                        error: 'No session returned from OAuth',
                    });
                }

                const { session, user } = data;

                // Log the successful OAuth login
                app.log.info(`[OAuth] User ${user.email} logged in via ${user.app_metadata?.provider || 'unknown'}`);

                // Sync user to our users table (upsert)
                const supabaseAdmin = getSupabaseAdmin();
                await supabaseAdmin.from('users').upsert({
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
                    avatar_url: user.user_metadata?.avatar_url,
                    provider: user.app_metadata?.provider,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

                // Option 1: Return JSON (for API clients)
                const acceptHeader = request.headers.accept || '';
                if (acceptHeader.includes('application/json')) {
                    return reply.send({
                        success: true,
                        message: 'OAuth login successful',
                        accessToken: session.access_token,
                        refreshToken: session.refresh_token,
                        expiresIn: session.expires_in,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.user_metadata?.full_name || user.user_metadata?.name,
                            avatar: user.user_metadata?.avatar_url,
                            provider: user.app_metadata?.provider,
                        },
                    });
                }

                // Option 2: Redirect to frontend (for browser clients)
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const tokenParam = encodeURIComponent(session.access_token);
                return reply.redirect(`${frontendUrl}/auth/success?token=${tokenParam}`);

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                app.log.error(`OAuth callback error: ${errorMessage}`);
                return reply.status(500).send({
                    success: false,
                    error: 'OAuth callback processing failed',
                    details: errorMessage,
                });
            }
        }
    );

    /**
     * POST /api/v1/auth/oauth/link/:provider - Link OAuth provider to existing account
     * Requires authenticated user
     */
    app.post<{ Params: { provider: string } }>(
        '/api/v1/auth/oauth/link/:provider',
        {
            schema: {
                tags: ['Auth', 'OAuth'],
                summary: 'Link OAuth provider to existing account',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    properties: {
                        provider: { type: 'string', enum: OAUTH_PROVIDERS },
                    },
                    required: ['provider'],
                },
            },
        },
        async (request, reply) => {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return reply.status(401).send({ error: 'Authentication required' });
            }

            const { provider } = request.params;

            if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
                return reply.status(400).send({
                    success: false,
                    error: `Invalid OAuth provider: ${provider}`,
                });
            }

            try {
                const supabase = getSupabaseClient();
                const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

                const { data, error } = await supabase.auth.linkIdentity({
                    provider: provider as OAuthProvider,
                    options: {
                        redirectTo: `${siteUrl}/auth/linked`,
                    },
                });

                if (error) {
                    return reply.status(400).send({
                        success: false,
                        error: 'Failed to initiate account linking',
                        details: error.message,
                    });
                }

                return reply.send({
                    success: true,
                    message: `Redirect to link ${provider} account`,
                    url: data.url,
                });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                return reply.status(500).send({
                    success: false,
                    error: 'Account linking failed',
                    details: errorMessage,
                });
            }
        }
    );

    /**
     * GET /api/v1/auth/session - Get current session from Supabase
     */
    app.get('/api/v1/auth/session', {
        schema: {
            tags: ['Auth'],
            summary: 'Get current session',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        session: { type: 'object' },
                        user: { type: 'object' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                return reply.status(401).send({
                    success: false,
                    error: 'Failed to get session',
                    details: error.message,
                });
            }

            return reply.send({
                session: data.session,
                user: data.session?.user || null,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            return reply.status(500).send({
                success: false,
                error: 'Session retrieval failed',
                details: errorMessage,
            });
        }
    });

    app.log.info('[ROUTES] Auth routes registered: /api/v1/auth/*');
    app.log.info('[ROUTES] OAuth routes registered: /api/v1/auth/oauth/* (GitHub, Google, GitLab)');
}
