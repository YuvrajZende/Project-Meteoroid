import type { IAgent, AgentConfig, AgentInput, AgentOutput, AgentHealthStatus } from '@loveable/shared';

export class AnalysisLoaderAgent implements IAgent {
    readonly id = 'analysis-agent';
    readonly name = 'Analysis Loader Agent';
    readonly tier = 1 as const;
    readonly capabilities = ['analysis-loading', 'analysis-validation'];
    readonly description = 'Loads and validates a FrontendAnalysisResult JSON into the pipeline';
    readonly version = '1.0.0';

    async initialize(_config: AgentConfig): Promise<void> {}
    async healthCheck(): Promise<AgentHealthStatus> {
        return { healthy: true, message: 'ready' };
    }
    async shutdown(): Promise<void> {}
    async execute(_input: AgentInput): Promise<AgentOutput> {
        return { success: true, files: [] };   // replaced in Task 8
    }
}

export const analysisLoaderAgent = new AnalysisLoaderAgent();
