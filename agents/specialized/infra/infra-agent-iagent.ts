/**
 * Infrastructure Agent - IAgent Implementation
 */

import type { IAgent } from '@loveable/shared';
import { InfraAgent, getInfraAgent, type InfraGenerationResult } from './infra-agent.js';

const AGENT_ID = 'infra-agent';
const AGENT_NAME = 'Infrastructure Agent';
const AGENT_VERSION = '1.0.0';
const AGENT_DESCRIPTION = 'Infrastructure as Code generation (Terraform, AWS, GCP, Azure)';

const CAPABILITIES = [
    'terraform',
    'pulumi',
    'aws',
    'gcp',
    'azure',
    'vpc',
    'ecs',
    'ec2',
    'rds',
    's3',
    'lambda',
    'elasticache',
    'cloudformation',
    'iac',
    'infrastructure',
];

export class InfraAgentWrapper implements IAgent {
    readonly id = AGENT_ID;
    readonly name = AGENT_NAME;
    readonly tier = 2 as const;
    readonly version = AGENT_VERSION;
    readonly description = AGENT_DESCRIPTION;
    readonly capabilities = CAPABILITIES;

    private agent: InfraAgent;
    private isReady = false;

    constructor() {
        this.agent = getInfraAgent();
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
            message: this.isReady ? 'Infrastructure Agent is ready' : 'Infrastructure Agent not initialized',
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
        return ['cicd-agent', 'monitoring-agent'];
    }
}

let wrapperInstance: InfraAgentWrapper | null = null;

export function getInfraAgentWrapper(): InfraAgentWrapper {
    if (!wrapperInstance) {
        wrapperInstance = new InfraAgentWrapper();
    }
    return wrapperInstance;
}

export const infraAgentIAgent = getInfraAgentWrapper();
export default infraAgentIAgent;
