/**
 * API Agent - IAgent Implementation
 * Wrapper that makes APIAgent conform to the IAgent interface
 * 
 * @author Person 3 (API Specialist)
 */

import type { IAgent, AgentConfig, AgentInput, AgentOutput } from '@loveable/shared';
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
    readonly tier = 1 as const;
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

    async initialize(config: AgentConfig): Promise<void> {
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

    /**
     * Execute an API generation task.
     *
     * Deterministic path: model names from the upstream analysis feed the engine's
     * regex-based resource extraction (analyzeRequirements), which drives router
     * generation — no LLM involved.
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();
        try {
            // NOTE: each cast kept on a single line — a cast chain split across lines
            // before `as` is a TS parse error (see database-agent-iagent.ts note).
            const ctx = (input.context as Record<string, unknown> | undefined) ?? {};
            const upstream = ctx.upstream as Record<string, unknown> | undefined;
            const analysis = upstream?.['analysis-agent'] as import('../analysis/types').FrontendAnalysisResult | undefined;
            const requestName = (ctx.requestName as string | undefined) ?? 'project';

            const modelNames = analysis?.dataModels.map(m => m.name).join(' ') ?? '';
            const userRequest = `${requestName} backend with ${modelNames}`.toLowerCase();

            const result: APIGenerationResult = await this.agent.generate(userRequest);

            this.executionCount++;
            this.successCount++;

            return {
                success: true,
                files: result.files.map(file => ({
                    path: file.path,
                    content: file.content,
                    type: (file.type === 'documentation' ? 'doc' : 'code') as 'doc' | 'code',
                    language: 'typescript',
                })),
                message: `generated ${result.files.length} API files (${result.endpoints} endpoints)`,
                metadata: { executionTime: Date.now() - startTime, data: result },
            };
        } catch (error) {
            this.executionCount++;
            return {
                success: false,
                error: { code: 'API_GENERATION_ERROR', message: error instanceof Error ? error.message : String(error) },
                metadata: { executionTime: Date.now() - startTime },
            };
        }
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
