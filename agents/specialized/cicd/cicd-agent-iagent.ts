/**
 * CI/CD Agent - IAgent Implementation
 */

import type { IAgent, AgentConfig, AgentInput, AgentOutput } from '@loveable/shared';
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
    readonly tier = 2 as const;
    readonly version = AGENT_VERSION;
    readonly description = AGENT_DESCRIPTION;
    readonly capabilities = CAPABILITIES;

    private agent: CICDAgent;
    private isReady = false;

    constructor() {
        this.agent = getCICDAgent();
    }

    async initialize(_config: AgentConfig): Promise<void> {
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

    async execute(input: AgentInput): Promise<AgentOutput> {
        // Shim: preserve legacy {type, input} contract until wrapper rewrite (T13/T14)
        const task = input as unknown as {
            type: string;
            input: Record<string, unknown>;
        };
        const startTime = Date.now();

        try {
            const requirements = (task.input.requirements as string) || '';
            const result = await this.agent.generate(requirements);

            return {
                success: true,
                output: result,
                metadata: { executionTime: Date.now() - startTime, agent: AGENT_ID },
            } as AgentOutput;
        } catch (error) {
            return {
                success: false,
                output: { error: error instanceof Error ? error.message : 'Unknown error' },
                metadata: { executionTime: Date.now() - startTime, agent: AGENT_ID },
            } as AgentOutput;
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
