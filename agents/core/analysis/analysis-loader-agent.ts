import type { IAgent, AgentConfig, AgentInput, AgentOutput, AgentHealthStatus } from '@loveable/shared';
import type { FrontendAnalysisResult } from './types';

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
    async execute(input: AgentInput): Promise<AgentOutput> {
        const json = (input.context as Record<string, unknown> | undefined)?.analysisJson;

        if (!json || typeof json !== 'object') {
            return { success: false, error: { code: 'INVALID_ANALYSIS', message: 'context.analysisJson is missing or not an object' } };
        }
        const j = json as Record<string, any>;
        const problems: string[] = [];
        if (!j.framework || typeof j.framework.type !== 'string') problems.push('framework.type');
        if (!Array.isArray(j.dataModels)) problems.push('dataModels');
        if (!Array.isArray(j.apiCalls)) problems.push('apiCalls');
        if (!j.authStrategy || typeof j.authStrategy.provider !== 'string') problems.push('authStrategy.provider');
        if (!j.suggestions) problems.push('suggestions');
        if (problems.length > 0) {
            return { success: false, error: { code: 'INVALID_ANALYSIS', message: `invalid analysis JSON, bad fields: ${problems.join(', ')}` } };
        }

        const result = {
            ...j,
            analyzedAt: j.analyzedAt ? new Date(j.analyzedAt) : new Date(),
        } as FrontendAnalysisResult;

        return {
            success: true,
            files: [],
            message: `loaded analysis for ${result.repositoryPath}`,
            metadata: { data: result },
        };
    }
}

export const analysisLoaderAgent = new AnalysisLoaderAgent();
