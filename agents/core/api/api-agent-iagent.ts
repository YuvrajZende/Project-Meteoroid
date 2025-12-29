/**
 * API Agent - IAgent Implementation
 * Wrapper that makes APIAgent conform to the IAgent interface
 * 
 * @author Person 3 (API Specialist)
 */

import type { IAgent } from '@loveable/shared';
import { APIAgent, getAPIAgent, type APIGenerationResult } from './api-agent.js';

const AGENT_ID = 'api-agent';
const AGENT_NAME = 'API Agent';
const AGENT_VERSION = '1.0.0';
const AGENT_DESCRIPTION = 'REST/GraphQL/tRPC API generation with OpenAPI documentation';

const CAPABILITIES = [
    // Frameworks
    'express',
    'fastify',
    'nestjs',
    'hono',

    // API Types
    'rest-api',
    'graphql',
    'trpc',
    'openapi',

    // Features
    'endpoint-generation',
    'crud-endpoints',
    'auth-endpoints',
    'validation',
    'error-handling',
    'rate-limiting',
    'cors',
    'documentation',
    'swagger',

    // Middleware
    'middleware-generation',
    'request-validation',
    'response-formatting',
];

export class APIAgentWrapper implements IAgent {
    readonly id = AGENT_ID;
    readonly name = AGENT_NAME;
    readonly version = AGENT_VERSION;
    readonly description = AGENT_DESCRIPTION;
    readonly capabilities = CAPABILITIES;

    private agent: APIAgent;
    private isReady = false;
    private executionCount = 0;
    private successCount = 0;

    constructor() {
        this.agent = getAPIAgent();
    }

    async initialize(config?: Record<string, unknown>): Promise<void> {
        this.isReady = true;
        console.log(`[${AGENT_NAME}] Initialized with config:`, config);
    }

    async shutdown(): Promise<void> {
        this.isReady = false;
        console.log(`[${AGENT_NAME}] Shutdown complete`);
    }

    async healthCheck(): Promise<{ healthy: boolean; message: string }> {
        return {
            healthy: this.isReady,
            message: this.isReady ? 'API Agent is ready' : 'API Agent not initialized',
        };
    }

    async execute(task: {
        type: string;
        input: Record<string, unknown>;
        options?: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        output: unknown;
        metadata?: Record<string, unknown>;
    }> {
        this.executionCount++;
        const startTime = Date.now();

        try {
            let result: unknown;

            switch (task.type) {
                case 'generate':
                case 'generate-api':
                    result = await this.handleGenerate(task.input);
                    break;
                case 'analyze':
                    result = await this.handleAnalyze(task.input);
                    break;
                case 'generate-openapi':
                    result = await this.handleGenerateOpenAPI(task.input);
                    break;
                default:
                    // Default to generate
                    result = await this.handleGenerate(task.input);
            }

            this.successCount++;

            return {
                success: true,
                output: result,
                metadata: {
                    executionTime: Date.now() - startTime,
                    agent: AGENT_ID,
                    type: task.type,
                },
            };
        } catch (error) {
            return {
                success: false,
                output: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                    agent: AGENT_ID,
                },
            };
        }
    }

    private async handleGenerate(input: Record<string, unknown>): Promise<APIGenerationResult> {
        const requirements = (input.requirements as string) || (input.prompt as string) || '';
        return this.agent.generate(requirements);
    }

    private async handleAnalyze(input: Record<string, unknown>) {
        const requirements = (input.requirements as string) || '';
        return this.agent.analyzeRequirements(requirements);
    }

    private async handleGenerateOpenAPI(input: Record<string, unknown>) {
        const requirements = (input.requirements as string) || '';
        const routers = await this.agent.analyzeRequirements(requirements);
        return this.agent.generateOpenAPIDoc(routers);
    }

    canHandle(capability: string): boolean {
        return this.capabilities.includes(capability.toLowerCase());
    }

    suggestNextAgents(): string[] {
        return ['database-agent', 'auth-agent', 'test-agent'];
    }

    getStatistics() {
        return {
            successCount: this.successCount,
            failureCount: this.executionCount - this.successCount,
            successRate: this.executionCount > 0
                ? `${((this.successCount / this.executionCount) * 100).toFixed(1)}%`
                : 'N/A',
        };
    }
}

// Singleton
let wrapperInstance: APIAgentWrapper | null = null;

export function getAPIAgentWrapper(): APIAgentWrapper {
    if (!wrapperInstance) {
        wrapperInstance = new APIAgentWrapper();
    }
    return wrapperInstance;
}

export const apiAgentIAgent = getAPIAgentWrapper();
export default apiAgentIAgent;
