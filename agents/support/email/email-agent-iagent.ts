/**
 * Email Agent - IAgent Implementation
 */

import type { IAgent, AgentConfig, AgentInput, AgentOutput } from '@loveable/shared';
import { EmailAgent, getEmailAgent, type EmailGenerationResult } from './email-agent.js';

const AGENT_ID = 'email-agent';
const AGENT_NAME = 'Email Agent';
const AGENT_VERSION = '1.0.0';
const AGENT_DESCRIPTION = 'Email service and template generation';

const CAPABILITIES = [
    'resend',
    'nodemailer',
    'sendgrid',
    'transactional-emails',
    'email-templates',
    'email-queue',
    'welcome-email',
    'password-reset',
    'verification-email',
    'invoice-email',
    'notification-email',
    'digest-email',
    'invite-email',
];

export class EmailAgentWrapper implements IAgent {
    readonly id = AGENT_ID;
    readonly name = AGENT_NAME;
    readonly tier = 3 as const;
    readonly version = AGENT_VERSION;
    readonly description = AGENT_DESCRIPTION;
    readonly capabilities = CAPABILITIES;

    private agent: EmailAgent;
    private isReady = false;

    constructor() {
        this.agent = getEmailAgent();
    }

    async initialize(_config: AgentConfig): Promise<void> {
        this.isReady = true;
        console.log(`[${AGENT_NAME}] Initialized`);
    }

    async shutdown(): Promise<void> {
        this.isReady = false;
    }

    async healthCheck(): Promise<{ healthy: boolean; message: string }> {
        return {
            healthy: this.isReady,
            message: this.isReady ? 'Email Agent is ready' : 'Email Agent not initialized',
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
        return ['queue-agent', 'api-agent'];
    }
}

let wrapperInstance: EmailAgentWrapper | null = null;

export function getEmailAgentWrapper(): EmailAgentWrapper {
    if (!wrapperInstance) {
        wrapperInstance = new EmailAgentWrapper();
    }
    return wrapperInstance;
}

export const emailAgentIAgent = getEmailAgentWrapper();
export default emailAgentIAgent;
