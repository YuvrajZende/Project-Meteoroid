/**
 * Auth Agent - IAgent Implementation
 * Wrapper that makes AuthAgent conform to the IAgent interface
 */

import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus
} from '@loveable/shared';
import { AuthAgent, AuthConfig } from './auth-agent.js';
import type { AuthFeature } from './auth-agent.js';

/**
 * AuthAgentWrapper - Implements IAgent interface
 */
export class AuthAgentWrapper implements IAgent {
    readonly id = 'auth-agent';
    readonly name = 'Authentication Agent';
    readonly tier = 1 as const;
    readonly capabilities = [
        'clerk-auth',
        'jwt-auth',
        'oauth',
        'rbac',
        'abac',
        'mfa',
        'session-management',
        'password-hashing',
        'rate-limiting',
    ];
    readonly description = 'Generates authentication and authorization code';
    readonly version = '1.0.0';

    private agent: AuthAgent;
    private isInitialized = false;

    constructor() {
        this.agent = new AuthAgent();
    }

    /**
     * Initialize the agent
     */
    async initialize(_config: AgentConfig): Promise<void> {
        this.isInitialized = true;
    }

    /**
     * Execute authentication task
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();
        try {
            const ctx = input.context as Record<string, unknown> | undefined;
            const upstream = ctx?.upstream as Record<string, unknown> | undefined;
            const analysis = upstream?.['analysis-agent'] as
                import('../analysis/types').FrontendAnalysisResult | undefined;
            if (!analysis) {
                return { success: false, error: { code: 'MISSING_UPSTREAM', message: 'auth agent requires upstream analysis-agent output' } };
            }

            const PROVIDER_MAP: Record<string, 'clerk' | 'custom' | 'auth0' | 'supabase'> = {
                clerk: 'clerk', auth0: 'auth0', supabase: 'supabase',
                'custom-jwt': 'custom', 'session-based': 'custom', passport: 'custom',
                nextauth: 'custom', firebase: 'custom', none: 'custom', unknown: 'custom',
            };
            const f = analysis.authStrategy.features;
            const features: AuthFeature[] = [
                'login', 'register', 'logout', 'forgot-password', 'reset-password', 'session', 'refresh-token',
                ...(f.socialLogin ? ['oauth' as const] : []),
                ...(f.mfa ? ['mfa' as const] : []),
            ];

            const config: AuthConfig = { provider: PROVIDER_MAP[analysis.authStrategy.provider] ?? 'custom', features };
            const result = await this.agent.generateAuthSystem(config);

            // Route templates (api-agent) import { authenticate } from
            // '../middleware/auth.js' — emit it here so the generated backend runs.
            const files = result.files
                .map(file => ({
                    path: file.path, content: file.content, type: 'code' as const, language: 'typescript' as const,
                }))
                // Drop Next.js-flavored artifacts (clerk.config, webhook headers) —
                // the generated backend is an Express server; next/* imports would
                // break `tsc` and ship dead code.
                .filter(file => !/from ["'](@clerk\/nextjs|next\/)/.test(file.content));
            const { middlewareFile, dependencies } = this.buildAuthMiddleware(config.provider);
            files.push(middlewareFile);

            return {
                success: true,
                files,
                message: `generated ${files.length} auth files (${config.provider})`,
                metadata: {
                    executionTime: Date.now() - startTime,
                    data: { provider: config.provider, dependencies },
                    envVariables: result.envVariables,
                    instructions: result.instructions,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: { code: 'AUTH_GENERATION_ERROR', message: error instanceof Error ? error.message : String(error) },
                metadata: { executionTime: Date.now() - startTime },
            };
        }
    }

    /**
     * Build the express middleware that route templates import as
     * `authenticate`, plus the runtime deps the codegen agent must install.
     */
    private buildAuthMiddleware(provider: 'clerk' | 'custom' | 'auth0' | 'supabase'): {
        middlewareFile: { path: string; content: string; type: 'code'; language: 'typescript' };
        dependencies: string[];
    } {
        const path = 'src/middleware/auth.ts';
        if (provider === 'clerk') {
            return {
                middlewareFile: {
                    path,
                    type: 'code',
                    language: 'typescript',
                    content: [
                        "import { requireAuth } from '@clerk/express';",
                        '',
                        '// Clerk session verification — configure CLERK keys in .env',
                        'export const authenticate = requireAuth();',
                        '',
                    ].join('\n'),
                },
                dependencies: ['@clerk/express', 'svix', 'ioredis'],
            };
        }
        const shared = [
            "import type { Request, Response, NextFunction } from 'express';",
            'import jwt from \'jsonwebtoken\';',
            '',
            'const SECRET = process.env.AUTH_JWT_SECRET ?? process.env.JWT_SECRET;',
            '',
            'export interface AuthenticatedUser { id: string; [key: string]: unknown }',
            '',
            'export function authenticate(req: Request, res: Response, next: NextFunction): void {',
            '    if (!SECRET) {',
            "        res.status(500).json({ error: 'AUTH_NOT_CONFIGURED', message: 'Set AUTH_JWT_SECRET to enable authentication.' });",
            '        return;',
            '    }',
            '    const header = req.headers.authorization;',
            "    if (!header?.startsWith('Bearer ')) {",
            "        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Bearer token.' });",
            '        return;',
            '    }',
            '    try {',
            '        const payload = jwt.verify(header.slice(7), SECRET);',
            '        (req as unknown as { user: AuthenticatedUser }).user = payload as AuthenticatedUser;',
            '        next();',
            '    } catch {',
            "        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token.' });",
            '    }',
            '}',
            '',
        ];
        return {
            middlewareFile: { path, type: 'code', language: 'typescript', content: shared.join('\n') },
            dependencies: ['jsonwebtoken', '@types/jsonwebtoken', 'ioredis'],
        };
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<AgentHealthStatus> {
        return {
            healthy: this.isInitialized,
            message: this.isInitialized ? 'Auth agent is ready' : 'Agent not initialized',
        };
    }

    /**
     * Shutdown
     */
    async shutdown(): Promise<void> {
        console.log(`🔐 [${this.name}] Shutting down...`);
        this.isInitialized = false;
    }
}

// Export singleton instance conforming to IAgent
export const authAgentIAgent = new AuthAgentWrapper();

// Default export for dynamic loading
export default authAgentIAgent;
