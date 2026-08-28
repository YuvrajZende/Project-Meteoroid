export type AgentId =
    | 'analysis-agent' | 'database-agent' | 'api-agent' | 'auth-agent'
    | 'security-agent' | 'codegen-agent' | 'test-agent'
    | 'monitoring-agent' | 'queue-agent' | 'cicd-agent'
    | 'infra-agent' | 'microservice-agent' | 'email-agent';

export interface DependencyEntry {
    dependsOn: AgentId[];
    timeoutMs?: number;      // default 60000
    stub?: boolean;          // report label
    expectFiles?: boolean;   // default true; false for analysis-agent
}
/** String-keyed so mock-agent tests can use arbitrary ids ('a', 'b', ...) */
export type DependencyMap = { [agentId: string]: DependencyEntry };

export type AgentRunStatus = 'success' | 'degraded' | 'failed' | 'skipped';

export interface PipelineError {
    agentId: string;
    code: string;
    message: string;
    attempts: number;
}

export interface AgentAttemptResult {
    agentId: string;
    status: AgentRunStatus;
    attempts: number;
    durationMs: number;
    filesProduced: number;
    error?: PipelineError;
}

export interface RunResult {
    results: AgentAttemptResult[];
    errors: PipelineError[];
    exitCode: 0 | 1 | 2;
    totalDurationMs: number;
}
