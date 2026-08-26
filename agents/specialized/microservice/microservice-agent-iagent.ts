/**
 * Microservice Agent - IAgent Implementation
 */

import type { IAgent, AgentConfig, AgentInput, AgentOutput } from '@loveable/shared';
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

    async initialize(_config: AgentConfig): Promise<void> {
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

    async execute(_input: AgentInput): Promise<AgentOutput> {
        const STUB_PATH = 'src/microservices/service-map.json';
        const CONTENT = [
            '{',
            '  "services": [{ "name": "api", "type": "monolith-module" }]',
            '}',
            '',
        ].join('\n');
        return {
            success: true,
            files: [{ path: STUB_PATH, content: CONTENT, type: 'asset' as const }],
            message: 'stub output (full implementation pending)',
            metadata: { data: { stub: true } },
        };
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
