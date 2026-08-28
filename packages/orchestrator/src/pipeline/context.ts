import type { GeneratedFile } from '@loveable/shared';
import type { FrontendAnalysisResult } from '@loveable/agents/core/analysis/types';
import type { SchemaDefinition as DbSchemaDefinition } from '@loveable/agents/core/database/types';
import type { APIGenerationResult } from '@loveable/agents/core/api/api-agent';
import type { PipelineError } from './types';

export interface UpstreamResults {
    [agentId: string]: unknown;
}

export interface AuthSetupInfo {
    provider: string;
    filesCount: number;
}

export interface PipelineContextData {
    requestName: string;
    analysisJson?: unknown;
    analysis?: FrontendAnalysisResult;
    dataModels?: DbSchemaDefinition;
    apiResult?: APIGenerationResult;
    authSetup?: AuthSetupInfo;
    securityConfig?: unknown;
    files: Map<string, GeneratedFile>;
    errors: PipelineError[];
    upstream: UpstreamResults;
}

export class FileCollisionError extends Error {
    constructor(public readonly path: string) {
        super(`File collision: two agents produced "${path}"`);
    }
}

export function createContext(requestName: string): PipelineContextData {
    return {
        requestName,
        files: new Map(),
        errors: [],
        upstream: {},
    };
}

export function recordFile(ctx: PipelineContextData, file: GeneratedFile): void {
    if (ctx.files.has(file.path)) throw new FileCollisionError(file.path);
    ctx.files.set(file.path, file);
}
