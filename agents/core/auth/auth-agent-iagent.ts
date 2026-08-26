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

            return {
                success: true,
                files: result.files.map(file => ({
                    path: file.path, content: file.content, type: 'code' as const, language: 'typescript',
                })),
                message: `generated ${result.files.length} auth files (${config.provider})`,
                metadata: {
                    executionTime: Date.now() - startTime,
                    data: { provider: config.provider },
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
