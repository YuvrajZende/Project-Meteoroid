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

        console.log(`🔐 [${this.name}] Executing task: ${input.task.substring(0, 50)}...`);

        try {
            // Analyze requirements from task
            const config = await this.agent.analyzeRequirements(input.task);

            // Generate auth system
            const result = await this.agent.generateAuthSystem(config);

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                files: result.files.map(f => ({
                    path: f.path,
                    content: f.content,
                    type: 'code' as const,
                    language: 'typescript',
                })),
                message: `Generated ${result.files.length} authentication files`,
                metadata: {
                    executionTime,
                    dependencies: result.dependencies,
                    envVariables: result.envVariables,
                    instructions: result.instructions,
                },
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'AUTH_GENERATION_ERROR',
                    message: errorMessage,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                },
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
