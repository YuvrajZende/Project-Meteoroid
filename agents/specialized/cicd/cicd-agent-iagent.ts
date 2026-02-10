/**
 * CI/CD Agent - IAgent Implementation
 */

import type { IAgent } from '@loveable/shared';
import { CICDAgent, getCICDAgent, type CICDGenerationResult } from './cicd-agent.js';

const AGENT_ID = 'cicd-agent';
const AGENT_NAME = 'CI/CD Agent';
const AGENT_VERSION = '1.0.0';
const AGENT_DESCRIPTION = 'CI/CD pipeline and deployment configuration generation';

const CAPABILITIES = [
    'github-actions',
    'gitlab-ci',
    'jenkins',
    'circleci',
    'docker',
    'dockerfile',
    'docker-compose',
    'kubernetes',
    'k8s',
    'deployment',
    'ci',
    'cd',
    'pipeline',
];

export class CICDAgentWrapper implements IAgent {
    readonly id = AGENT_ID;
    readonly name = AGENT_NAME;
    readonly version = AGENT_VERSION;
    readonly description = AGENT_DESCRIPTION;
    readonly capabilities = CAPABILITIES;

    private agent: CICDAgent;
    private isReady = false;

    constructor() {
        this.agent = getCICDAgent();
    }

    async initialize(config?: Record<string, unknown>): Promise<void> {
        this.isReady = true;
    }

    async shutdown(): Promise<void> {
        this.isReady = false;
    }

    async healthCheck(): Promise<{ healthy: boolean; message: string }> {
        return {
            healthy: this.isReady,
            message: this.isReady ? 'CI/CD Agent is ready' : 'CI/CD Agent not initialized',
        };
    }

    async execute(task: {
        type: string;
        input: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        output: unknown;
        metadata?: Record<string, unknown>;
    }> {
        const startTime = Date.now();

        try {
            const requirements = (task.input.requirements as string) || '';
            const result = await this.agent.generate(requirements);

            return {
                success: true,
                output: result,
                metadata: { executionTime: Date.now() - startTime, agent: AGENT_ID },
            };
        } catch (error) {
            return {
                success: false,
                output: { error: error instanceof Error ? error.message : 'Unknown error' },
                metadata: { executionTime: Date.now() - startTime, agent: AGENT_ID },
            };
        }
    }

    canHandle(capability: string): boolean {
        return this.capabilities.includes(capability.toLowerCase());
    }

    suggestNextAgents(): string[] {
        return ['infra-agent', 'monitoring-agent'];
    }
}

let wrapperInstance: CICDAgentWrapper | null = null;

export function getCICDAgentWrapper(): CICDAgentWrapper {
    if (!wrapperInstance) {
        wrapperInstance = new CICDAgentWrapper();
    }
    return wrapperInstance;
}

export const cicdAgentIAgent = getCICDAgentWrapper();
export default cicdAgentIAgent;
