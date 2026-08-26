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

    async execute(_input: AgentInput): Promise<AgentOutput> {
        const STUB_PATH = '.github/workflows/ci.yml';
        const CONTENT = [
            '# STUB — full implementation pending',
            'name: CI',
            'on: [push]',
            'jobs:',
            '  build:',
            '    runs-on: ubuntu-latest',
            '    steps:',
            '      - uses: actions/checkout@v4',
            '      - run: npm install && npm test',
            '',
        ].join('\n');
        return {
            success: true,
            files: [{ path: STUB_PATH, content: CONTENT, type: 'config' as const }],
            message: 'stub output (full implementation pending)',
            metadata: { data: { stub: true } },
        };
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
