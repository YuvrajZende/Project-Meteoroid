import type { IAgent, AgentConfig, AgentInput, AgentOutput, AgentHealthStatus } from '@loveable/shared';

export type Cue = (input: AgentInput, callNumber: number) => AgentOutput | Promise<AgentOutput>;

export interface MockAgent extends IAgent {
    calls: number;
    lastInput?: AgentInput;
}

export function makeMockAgent(id: string, cue: Cue, tier: 1 | 2 | 3 = 1): MockAgent {
    const agent: MockAgent = {
        id,
        name: id,
        tier,
        capabilities: ['mock'],
        calls: 0,
        async initialize(_config: AgentConfig): Promise<void> {},
        async healthCheck(): Promise<AgentHealthStatus> {
            return { healthy: true };
        },
        async shutdown(): Promise<void> {},
        async execute(input: AgentInput): Promise<AgentOutput> {
            agent.calls += 1;
            agent.lastInput = input;
            return cue(input, agent.calls);
        },
    };
    return agent;
}

/** Standard successful output */
export const ok = (files: string[] = ['out.txt'], data?: unknown): AgentOutput => ({
    success: true,
    files: files.map(path => ({ path, content: '// generated', type: 'code' as const })),
    metadata: { data },
});

/** Deterministic failure output */
export const fail = (code = 'MOCK_FAIL', message = 'mock failure'): AgentOutput => ({
    success: false,
    error: { code, message },
});
