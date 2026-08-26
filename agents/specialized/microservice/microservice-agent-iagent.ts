/**
 * Microservice Agent - IAgent Implementation
 */

import type { IAgent } from '@loveable/shared';
import { MicroserviceAgent, getMicroserviceAgent, type MicroserviceGenerationResult } from './microservice-agent.js';

const AGENT_ID = 'microservice-agent';
const AGENT_NAME = 'Microservice Agent';
const AGENT_VERSION = '1.0.0';
const AGENT_DESCRIPTION = 'Microservice architecture and patterns generation';

const CAPABILITIES = [
    'microservices',
    'service-mesh',
    'istio',
    'linkerd',
    'grpc',
    'kafka',
    'rabbitmq',
    'event-driven',
    'saga-pattern',
    'circuit-breaker',
    'service-discovery',
    'load-balancing',
];

export class MicroserviceAgentWrapper implements IAgent {
    readonly id = AGENT_ID;
    readonly name = AGENT_NAME;
    readonly tier = 2 as const;
    readonly version = AGENT_VERSION;
    readonly description = AGENT_DESCRIPTION;
    readonly capabilities = CAPABILITIES;

    private agent: MicroserviceAgent;
    private isReady = false;

    constructor() {
        this.agent = getMicroserviceAgent();
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
            message: this.isReady ? 'Microservice Agent is ready' : 'Microservice Agent not initialized',
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
        return ['api-agent', 'queue-agent', 'database-agent'];
    }
}

let wrapperInstance: MicroserviceAgentWrapper | null = null;

export function getMicroserviceAgentWrapper(): MicroserviceAgentWrapper {
    if (!wrapperInstance) {
        wrapperInstance = new MicroserviceAgentWrapper();
    }
    return wrapperInstance;
}

export const microserviceAgentIAgent = getMicroserviceAgentWrapper();
export default microserviceAgentIAgent;
