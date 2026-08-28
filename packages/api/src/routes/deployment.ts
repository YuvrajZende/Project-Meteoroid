/**
 * ============================================
 * DEPLOYMENT ROUTES
 * ============================================
 * 
 * Phase 15.3: Deployment API Routes
 * 
 * Provides HTTP endpoints for deploying projects,
 * managing deployments, and getting preview URLs.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
    getDeploymentService,
    getGitHubService,
    type DeploymentProvider,
} from '../services/index.js';

// ============================================
// OAUTH STATE STORE (In-memory with expiration)
// ============================================

interface OAuthState {
    state: string;
    createdAt: number;
    expiresAt: number;
}

const oauthStateStore = new Map<string, OAuthState>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ============================================
// IN-MEMORY SESSION STORE (Development Only)
// ============================================

interface UserSession {
    userId: string;
    accessToken: string;
    tokenPreview: string;
    provider: string;
    createdAt: number;
    expiresAt: number;
    userInfo: {
        id: string;
        login: string;
        avatarUrl?: string;
    };
}

const sessionStore = new Map<string, UserSession>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup expired sessions every hour
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessionStore.entries()) {
        if (now > value.expiresAt) {
            sessionStore.delete(key);
        }
    }
}, 60 * 60 * 1000);

function storeUserSession(sessionId: string, session: UserSession): void {
    sessionStore.set(sessionId, session);
}

function getUserSession(sessionId: string): UserSession | undefined {
    const session = sessionStore.get(sessionId);
    if (session && Date.now() > session.expiresAt) {
        sessionStore.delete(sessionId);
        return undefined;
    }
    return session;
}

function deleteUserSession(sessionId: string): void {
    sessionStore.delete(sessionId);
}

/**
 * Get all sessions for a user (by user ID)
 */
function getUserSessionsByUserId(userId: string): UserSession[] {
    const sessions: UserSession[] = [];
    const now = Date.now();

    for (const session of sessionStore.values()) {
        if (session.userId === userId && session.expiresAt > now) {
            sessions.push(session);
        }
    }

    return sessions;
}

/**
 * Delete all sessions for a user
 */
function deleteUserSessionsByUserId(userId: string): number {
    let count = 0;
    const now = Date.now();

    for (const [sessionId, session] of sessionStore.entries()) {
        if (session.userId === userId) {
            sessionStore.delete(sessionId);
            count++;
        }
    }

    return count;
}

/**
 * Get session by user ID and provider
 */
function getUserSessionByProvider(userId: string, provider: string): UserSession | undefined {
    const now = Date.now();

    for (const session of sessionStore.values()) {
        if (session.userId === userId && session.provider === provider && session.expiresAt > now) {
            return session;
        }
    }

    return undefined;
}
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of oauthStateStore.entries()) {
        if (now > value.expiresAt) {
            oauthStateStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

function storeOAuthState(state: string): void {
    const now = Date.now();
    oauthStateStore.set(state, {
        state,
        createdAt: now,
        expiresAt: now + STATE_TTL_MS,
    });
}

function verifyOAuthState(state: string): boolean {
    const stored = oauthStateStore.get(state);
    if (!stored) {
        return false;
    }

    // Check if expired
    if (Date.now() > stored.expiresAt) {
        oauthStateStore.delete(state);
        return false;
    }

    // Remove after successful verification
    oauthStateStore.delete(state);
    return true;
}

// ============================================
// SCHEMAS
// ============================================

const deployProjectSchema = z.object({
    provider: z.enum(['netlify', 'vercel']).optional(),
    production: z.boolean().optional().default(false),
    commitMessage: z.string().optional(),
    files: z.array(z.object({
        path: z.string(),
        content: z.string(),
    })).optional(),
});

const projectIdParamsSchema = z.object({
    id: z.string().min(1, 'Project ID is required'),
});

const deploymentIdParamsSchema = z.object({
    id: z.string().min(1, 'Project ID is required'),
    deployId: z.string().min(1, 'Deployment ID is required'),
});

const listDeploymentsQuerySchema = z.object({
    page: z.string().transform(Number).optional(),
    perPage: z.string().transform(Number).optional(),
});

// ============================================
// ROUTES
// ============================================

export async function deploymentRoutes(app: FastifyInstance): Promise<void> {
    const deploymentService = getDeploymentService();
    const githubService = getGitHubService();

    // Dynamic import to avoid circular dependency
    const { getAutoDeployManager } = await import('../services/index.js');
    const autoDeployManager = getAutoDeployManager();

    // Initialize services
    await deploymentService.initialize();
    await githubService.initialize();
    await autoDeployManager.initialize();

    /**
     * GET /api/v1/deployments/stream/:projectId
     * SSE stream for deployment progress
     */
    app.get('/api/v1/deployments/stream/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const params = projectIdParamsSchema.parse(request.params);
        const projectId = params.id;

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Send initial connection event
        reply.raw.write(`data: ${JSON.stringify({
            type: 'connected',
            projectId,
            message: 'Connected to deployment stream',
            timestamp: new Date().toISOString(),
        })}\n\n`);

        // Get current state
        const currentState = autoDeployManager.getProjectState(projectId);
        reply.raw.write(`data: ${JSON.stringify({
            type: 'state',
            projectId,
            state: currentState,
            timestamp: new Date().toISOString(),
        })}\n\n`);

        // Subscribe to deployment events
        const unsubscribe = autoDeployManager.subscribeToProject(projectId, (event: { type: string; timestamp: Date }) => {
            try {
                reply.raw.write(`data: ${JSON.stringify({
                    ...event,
                    timestamp: event.timestamp.toISOString(),
                })}\n\n`);
            } catch (error) {
                // Client disconnected
                unsubscribe();
            }
        });

        // Keep-alive ping every 30 seconds
        const pingInterval = setInterval(() => {
            try {
                reply.raw.write(`: ping\n\n`);
            } catch {
                clearInterval(pingInterval);
                unsubscribe();
            }
        }, 30000);

        // Cleanup on close
        request.raw.on('close', () => {
            clearInterval(pingInterval);
            unsubscribe();
            app.log.info({ projectId }, 'Deployment SSE stream closed');
        });

        app.log.info({ projectId }, 'Deployment SSE stream opened');
    });

    /**
     * POST /api/v1/projects/:id/auto-deploy
     * Trigger auto-deployment for a project
     */
    app.post('/api/v1/projects/:id/auto-deploy', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = projectIdParamsSchema.parse(request.params);
            const body = z.object({
                files: z.array(z.object({
                    path: z.string(),
                    content: z.string(),
                })),
                commitMessage: z.string().optional(),
                immediate: z.boolean().optional(),
            }).parse(request.body);

            const projectId = params.id;

            if (!autoDeployManager.isEnabled()) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'AUTO_DEPLOY_DISABLED',
                        message: 'Auto-deploy is not enabled',
                    },
                });
            }

            // Trigger auto-deploy (async - returns immediately)
            autoDeployManager.triggerDeployAfterCodeGen(projectId, body.files, {
                commitMessage: body.commitMessage,
                immediate: body.immediate,
            });

            return reply.status(202).send({
                success: true,
                message: 'Deployment queued',
                data: {
                    projectId,
                    fileCount: body.files.length,
                    streamUrl: `/api/v1/deployments/stream/${projectId}`,
                },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Auto-deploy trigger failed');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'AUTO_DEPLOY_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to trigger auto-deploy',
                },
            });
        }
    });

    /**
     * GET /api/v1/projects/:id/deployment-history
     * Get deployment history from database
     */
    app.get('/api/v1/projects/:id/deployment-history', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = projectIdParamsSchema.parse(request.params);
            const query = z.object({
                limit: z.string().transform(Number).optional(),
                offset: z.string().transform(Number).optional(),
            }).parse(request.query);

            const projectId = params.id;

            const history = await autoDeployManager.getDeploymentHistory(projectId, {
                limit: query.limit,
                offset: query.offset,
            });

            return reply.send({
                success: true,
                data: {
                    deployments: history,
                    count: history.length,
                },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Failed to get deployment history');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'HISTORY_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to get deployment history',
                },
            });
        }
    });

    /**
     * DELETE /api/v1/projects/:id/pending-deploy
     * Cancel a pending auto-deploy
     */
    app.delete('/api/v1/projects/:id/pending-deploy', async (request: FastifyRequest, reply: FastifyReply) => {
        const params = projectIdParamsSchema.parse(request.params);
        const projectId = params.id;

        const cancelled = autoDeployManager.cancelPendingDeploy(projectId);

        return reply.send({
            success: true,
            data: {
                cancelled,
                message: cancelled ? 'Pending deploy cancelled' : 'No pending deploy found',
            },
        });
    });


    /**
     * GET /api/v1/deployments/status
     * Get deployment service status
     */
    app.get('/api/v1/deployments/status', async (_request: FastifyRequest, reply: FastifyReply) => {
        const providers = deploymentService.getAvailableProviders();
        const githubConfigured = githubService.isConfigured();

        return reply.send({
            success: true,
            data: {
                configured: providers.length > 0,
                providers,
                github: {
                    configured: githubConfigured,
                    oauthUrl: githubConfigured ? '/api/v1/github/auth' : null,
                },
            },
        });
    });

    /**
     * POST /api/v1/projects/:id/deploy
     * Deploy a project
     */
    app.post('/api/v1/projects/:id/deploy', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = projectIdParamsSchema.parse(request.params);
            const body = deployProjectSchema.parse(request.body);

            const projectId = params.id;

            // Check if provider is available
            const provider = (body.provider || 'netlify') as DeploymentProvider;
            if (!deploymentService.isProviderConfigured(provider)) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'PROVIDER_NOT_CONFIGURED',
                        message: `Deployment provider ${provider} is not configured`,
                    },
                });
            }

            // Get files from request or from project directory
            let files = body.files;

            if (!files || files.length === 0) {
                // TODO: Fetch files from project storage/database
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'NO_FILES',
                        message: 'No files provided for deployment',
                    },
                });
            }

            // Start deployment
            app.log.info({ projectId, provider, fileCount: files.length }, 'Starting deployment');

            const result = await deploymentService.deploy({
                projectId,
                projectName: `project-${projectId}`,
                files,
                provider,
                production: body.production,
                commitMessage: body.commitMessage,
            });

            app.log.info({ projectId, deployId: result.id, url: result.url }, 'Deployment complete');

            return reply.status(201).send({
                success: true,
                data: {
                    deployment: result,
                },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Deployment failed');

            if (error.name === 'ZodError') {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request data',
                        details: error.errors,
                    },
                });
            }

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'DEPLOYMENT_FAILED',
                    message: error instanceof Error ? error.message : 'Deployment failed',
                },
            });
        }
    });

    /**
     * GET /api/v1/projects/:id/deployments
     * List deployments for a project
     */
    app.get('/api/v1/projects/:id/deployments', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = projectIdParamsSchema.parse(request.params);
            const query = listDeploymentsQuerySchema.parse(request.query);

            const projectId = params.id;
            const siteId = `loveable-${projectId}`;

            // Get deployments from Netlify
            const deployments = await deploymentService.listNetlifyDeployments(siteId, {
                page: query.page,
                perPage: query.perPage,
            });

            return reply.send({
                success: true,
                data: {
                    deployments,
                    pagination: {
                        page: query.page || 1,
                        perPage: query.perPage || 20,
                    },
                },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Failed to list deployments');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'LIST_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to list deployments',
                },
            });
        }
    });

    /**
     * GET /api/v1/projects/:id/preview
     * Get the current preview URL for a project
     */
    app.get('/api/v1/projects/:id/preview', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = projectIdParamsSchema.parse(request.params);
            const projectId = params.id;
            const siteId = `loveable-${projectId}`;

            // Get site info
            const site = await deploymentService.getNetlifySite(siteId);

            if (!site) {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: 'SITE_NOT_FOUND',
                        message: 'No deployment found for this project',
                    },
                });
            }

            // Get latest deployment
            const deployments = await deploymentService.listNetlifyDeployments(siteId, {
                perPage: 1,
            });

            const latestDeployment = deployments[0];

            return reply.send({
                success: true,
                data: {
                    site: {
                        id: site.id,
                        name: site.name,
                        url: site.url,
                        adminUrl: site.adminUrl,
                    },
                    latestDeployment: latestDeployment || null,
                },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Failed to get preview');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'PREVIEW_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to get preview URL',
                },
            });
        }
    });

    /**
     * POST /api/v1/projects/:id/deployments/:deployId/rollback
     * Rollback to a previous deployment
     */
    app.post('/api/v1/projects/:id/deployments/:deployId/rollback', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = deploymentIdParamsSchema.parse(request.params);
            const projectId = params.id;
            const deployId = params.deployId;
            const siteId = `loveable-${projectId}`;

            app.log.info({ projectId, deployId }, 'Rolling back deployment');

            const result = await deploymentService.rollbackNetlifyDeploy(siteId, deployId);

            app.log.info({ projectId, newDeployId: result.id }, 'Rollback complete');

            return reply.send({
                success: true,
                data: {
                    deployment: result,
                },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Rollback failed');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'ROLLBACK_FAILED',
                    message: error instanceof Error ? error.message : 'Rollback failed',
                },
            });
        }
    });

    /**
     * DELETE /api/v1/projects/:id/site
     * Delete deployment site for a project
     */
    app.delete('/api/v1/projects/:id/site', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const params = projectIdParamsSchema.parse(request.params);
            const projectId = params.id;
            const siteId = `loveable-${projectId}`;

            app.log.info({ projectId, siteId }, 'Deleting deployment site');

            await deploymentService.deleteNetlifySite(siteId);

            return reply.send({
                success: true,
                message: 'Deployment site deleted',
            });

        } catch (error: unknown) {
            app.log.error(error, 'Failed to delete site');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'DELETE_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to delete site',
                },
            });
        }
    });
    app.log.info('[ROUTES] Deployment routes registered: /api/v1/projects/:id/deploy, deployments, preview, rollback');
}

// ============================================
// GITHUB OAUTH ROUTES
// ============================================

export async function githubRoutes(app: FastifyInstance): Promise<void> {
    const githubService = getGitHubService();

    await githubService.initialize();

    /**
     * GET /api/v1/github/auth
     * Start GitHub OAuth flow
     */
    app.get('/api/v1/github/auth', async (_request: FastifyRequest, reply: FastifyReply) => {
        if (!githubService.isConfigured()) {
            return reply.status(503).send({
                success: false,
                error: {
                    code: 'GITHUB_NOT_CONFIGURED',
                    message: 'GitHub OAuth is not configured',
                },
            });
        }

        // Generate state for CSRF protection
        const state = crypto.randomUUID();
        storeOAuthState(state);

        const authUrl = githubService.getAuthorizationUrl(state);

        return reply.redirect(authUrl);
    });

    /**
     * GET /api/v1/github/callback
     * GitHub OAuth callback
     */
    app.get('/api/v1/github/callback', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const query = request.query as { code?: string; state?: string; error?: string };

            if (query.error) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'OAUTH_ERROR',
                        message: query.error,
                    },
                });
            }

            if (!query.code) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'NO_CODE',
                        message: 'Authorization code not provided',
                    },
                });
            }

            if (!query.state || !verifyOAuthState(query.state)) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: 'INVALID_STATE',
                        message: 'Invalid or expired OAuth state',
                    },
                });
            }

            // Exchange code for token
            const accessToken = await githubService.exchangeCodeForToken(query.code);

            // Get user info
            const user = await githubService.getUser(accessToken);

            app.log.info({ userId: user.id, login: user.login }, 'GitHub OAuth successful');

            // TODO: Store token securely (encrypted in database)

            // Create/update user session (in-memory for development)
            const sessionId = crypto.randomUUID();
            const now = Date.now();
            const tokenPreview = `${accessToken.substring(0, 8)}...`;

            storeUserSession(sessionId, {
                userId: user.id,
                accessToken,
                tokenPreview,
                provider: 'github',
                createdAt: now,
                expiresAt: now + SESSION_TTL_MS,
                userInfo: {
                    id: user.id,
                    login: user.login,
                    avatarUrl: user.avatarUrl,
                },
            });

            // Set session cookie
            reply.setCookie('session_id', sessionId, {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: SESSION_TTL_MS / 1000,
            });

            return reply.send({
                success: true,
                data: {
                    user,
                    sessionId,
                    // Don't expose the full token in response
                    tokenPreview,
                    note: 'Session stored in-memory (development mode). Database integration pending.',
                },
            });

        } catch (error: unknown) {
            app.log.error(error, 'GitHub OAuth callback failed');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'OAUTH_FAILED',
                    message: error instanceof Error ? error.message : 'OAuth authentication failed',
                },
            });
        }
    });

    /**
     * POST /api/v1/github/repos
     * Create a new GitHub repository
     */
    app.post('/api/v1/github/repos', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Try to get session ID from cookie
            const sessionId = request.cookies.session_id;

            if (!sessionId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: 'NO_SESSION',
                        message: 'No active GitHub session. Please authenticate first.',
                    },
                });
            }

            // Get user session from session store
            const session = getUserSession(sessionId);

            if (!session || session.provider !== 'github') {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: 'INVALID_SESSION',
                        message: 'Invalid or expired GitHub session. Please authenticate again.',
                    },
                });
            }

            const body = z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                private: z.boolean().optional(),
            }).parse(request.body);

            // Use access token from session instead of request body
            const repo = await githubService.createRepository(session.accessToken, {
                name: body.name,
                description: body.description,
                private: body.private,
            });

            app.log.info({ repoId: repo.id, name: repo.name }, 'GitHub repository created');

            return reply.status(201).send({
                success: true,
                data: { repo },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Failed to create GitHub repository');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'REPO_CREATION_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to create repository',
                },
            });
        }
    });

    /**
     * POST /api/v1/github/repos/:owner/:repo/commit
     * Commit files to a GitHub repository
     */
    app.post('/api/v1/github/repos/:owner/:repo/commit', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Try to get session ID from cookie
            const sessionId = request.cookies.session_id;

            if (!sessionId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: 'NO_SESSION',
                        message: 'No active GitHub session. Please authenticate first.',
                    },
                });
            }

            // Get user session from session store
            const session = getUserSession(sessionId);

            if (!session || session.provider !== 'github') {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: 'INVALID_SESSION',
                        message: 'Invalid or expired GitHub session. Please authenticate again.',
                    },
                });
            }

            const params = z.object({
                owner: z.string(),
                repo: z.string(),
            }).parse(request.params);

            const body = z.object({
                message: z.string().min(1),
                files: z.array(z.object({
                    path: z.string(),
                    content: z.string(),
                })),
                branch: z.string().optional(),
            }).parse(request.body);

            // Use access token from session instead of request body
            const result = await githubService.commitFiles(session.accessToken, {
                owner: params.owner,
                repo: params.repo,
                message: body.message,
                files: body.files,
                branch: body.branch,
            });

            app.log.info({
                owner: params.owner,
                repo: params.repo,
                sha: result.sha,
            }, 'Files committed to GitHub');

            return reply.status(201).send({
                success: true,
                data: { commit: result },
            });

        } catch (error: unknown) {
            app.log.error(error, 'Failed to commit to GitHub');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'COMMIT_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to commit files',
                },
            });
        }
    });

    /**
     * DELETE /api/v1/github/session
     * Delete current GitHub session
     */
    app.delete('/api/v1/github/session', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const sessionId = request.cookies.session_id;

            if (sessionId) {
                deleteUserSession(sessionId);

                // Clear session cookie
                reply.clearCookie('session_id', {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                });
            }

            return reply.send({
                success: true,
                message: 'Session deleted successfully',
            });
        } catch (error: unknown) {
            app.log.error(error, 'Failed to delete session');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'SESSION_DELETE_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to delete session',
                },
            });
        }
    });

    /**
     * GET /api/v1/github/session
     * Get current GitHub session info
     */
    app.get('/api/v1/github/session', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const sessionId = request.cookies.session_id;

            if (!sessionId) {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: 'NO_SESSION',
                        message: 'No active GitHub session',
                    },
                });
            }

            const session = getUserSession(sessionId);

            if (!session || session.provider !== 'github') {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: 'INVALID_SESSION',
                        message: 'Invalid or expired GitHub session',
                    },
                });
            }

            return reply.send({
                success: true,
                data: {
                    userInfo: session.userInfo,
                    tokenPreview: session.tokenPreview,
                    createdAt: new Date(session.createdAt).toISOString(),
                    expiresAt: new Date(session.expiresAt).toISOString(),
                },
            });
        } catch (error: unknown) {
            app.log.error(error, 'Failed to get session');

            return reply.status(500).send({
                success: false,
                error: {
                    code: 'SESSION_GET_FAILED',
                    message: error instanceof Error ? error.message : 'Failed to get session',
                },
            });
        }
    });

    app.log.info('[ROUTES] GitHub routes registered: /api/v1/github/auth, callback, repos, commit, session');
}

export default {
    deploymentRoutes,
    githubRoutes,
};
