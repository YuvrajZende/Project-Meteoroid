/**
 * Security Agent - IAgent Implementation
 * Wrapper that makes SecurityAgent conform to the IAgent interface
 */

import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus
} from '@loveable/shared';
import { SecurityAgent, SecurityConfig } from './security-agent.js';

/**
 * SecurityAgentWrapper - Implements IAgent interface
 */
export class SecurityAgentWrapper implements IAgent {
    readonly id = 'security-agent';
    readonly name = 'Security Agent';
    readonly tier = 2 as const;
    readonly capabilities = [
        'sast',
        'dast',
        'secrets-detection',
        'dependency-scanning',
        'security-headers',
        'helmet',
        'cors',
        'csrf',
        'rate-limiting',
        'input-sanitization',
        'xss-prevention',
        'sql-injection-prevention',
        'compliance',
    ];
    readonly description = 'Generates security middleware and scans for vulnerabilities';
    readonly version = '1.0.0';

    private agent: SecurityAgent;
    private isInitialized = false;

    constructor() {
        this.agent = new SecurityAgent();
    }

    /**
     * Initialize the agent
     */
    async initialize(_config: AgentConfig): Promise<void> {
        this.isInitialized = true;
    }

    /**
     * Execute security task
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();

        console.log(`🔒 [${this.name}] Executing task: ${input.task.substring(0, 50)}...`);

        try {
            // Default security config
            const config: SecurityConfig = {
                scanTypes: ['sast', 'secrets', 'dependencies'],
                complianceFrameworks: ['owasp-top10'],
                enforcementLevel: 'standard',
                middleware: {
                    helmet: true,
                    cors: true,
                    csrf: true,
                    rateLimit: true,
                    inputSanitization: true,
                    securityHeaders: true,
                },
                rateLimiting: {
                    windowMs: 60000,
                    maxRequests: 100,
                },
            };

            // Generate security system
            const result = await this.agent.generateSecuritySystem(config);

            const upstream = ((input.context as Record<string, unknown> | undefined)?.upstream
                ?? {}) as Record<string, any>;
            const securedEndpoints = Number(upstream['api-agent']?.endpoints ?? 0);
            const authProvider = String(upstream['auth-agent']?.provider ?? 'custom');

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                files: result.files.map(f => ({
                    path: f.path,
                    content: f.content,
                    type: 'code' as const,
                    language: 'typescript',
                })),
                message: `Generated ${result.files.length} security files`,
                metadata: {
                    executionTime,
                    data: { securedEndpoints, authProvider },
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
                    code: 'SECURITY_GENERATION_ERROR',
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
            message: this.isInitialized ? 'Security agent is ready' : 'Agent not initialized',
        };
    }

    /**
     * Shutdown
     */
    async shutdown(): Promise<void> {
        console.log(`🔒 [${this.name}] Shutting down...`);
        this.isInitialized = false;
    }
}

// Export singleton instance conforming to IAgent
export const securityAgentIAgent = new SecurityAgentWrapper();

// Default export for dynamic loading
export default securityAgentIAgent;
