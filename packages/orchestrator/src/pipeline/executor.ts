import type { IAgent, AgentHealthStatus, AgentInput, AgentOutput } from '@loveable/shared';
import type { AgentAttemptResult, AgentId, DependencyEntry, DependencyMap, PipelineError, RunResult } from './types';
import type { PipelineContextData } from './context';
import { recordFile, FileCollisionError } from './context';
import type { AgentRegistry } from './registry';

export interface ExecuteOptions {
    deps: DependencyMap;
    health?: Map<AgentId, AgentHealthStatus>;
    maxAttempts?: number;
    defaultTimeoutMs?: number;
}

export class FatalPipelineError extends Error {} // root failure signal (never thrown by executePlan; encoded in exitCode)

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;

function transitiveDependents(deps: DependencyMap, root: AgentId): Set<string> {
    const affected = new Set<string>();
    const stack = [root];
    while (stack.length > 0) {
        const current = stack.pop()!;
        // Keys are cast to AgentId (same convention as planLevels' `Object.keys(deps) as AgentId[]`);
        // at runtime they may be any string, hence the string-keyed DependencyMap.
        for (const [id, entry] of Object.entries(deps) as [AgentId, DependencyEntry][]) {
            if (entry.dependsOn.includes(current) && !affected.has(id)) {
                affected.add(id);
                stack.push(id);
            }
        }
    }
    affected.delete(root);
    return affected;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
        promise.then(
            value => { clearTimeout(timer); resolve(value); },
            err => { clearTimeout(timer); reject(err); },
        );
    });
}

export async function executePlan(
    levels: AgentId[][],
    registry: AgentRegistry,
    ctx: PipelineContextData,
    opts: ExecuteOptions,
): Promise<RunResult> {
    const startedAll = Date.now();
    const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
    const defaultTimeout = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const results = new Map<string, AgentAttemptResult>();
    const errors: PipelineError[] = [];
    let aborted = false;

    const markSkipped = (id: string, message: string) => {
        if (results.has(id)) return;
        const error: PipelineError = { agentId: id, code: 'SKIPPED', message, attempts: 0 };
        results.set(id, { agentId: id, status: 'skipped', attempts: 0, durationMs: 0, filesProduced: 0, error });
        errors.push(error);
    };

    const applyContextAssignments = (id: AgentId, output: AgentOutput) => {
        const data = output.metadata?.data;
        if (data === undefined) return;
        ctx.upstream[id] = data;
        switch (id) {
            case 'analysis-agent': ctx.analysis = data as never; break;
            case 'database-agent': ctx.dataModels = (data as { schema?: never }).schema ?? (data as never); break;
            case 'api-agent': ctx.apiResult = data as never; break;
            case 'auth-agent': {
                const d = data as { provider?: string };
                ctx.authSetup = { provider: d.provider ?? 'custom', filesCount: output.files?.length ?? 0 };
                break;
            }
            case 'security-agent': ctx.securityConfig = data; break;
        }
    };

    const runOne = async (id: AgentId): Promise<void> => {
        if (results.has(id)) return; // already skipped via cascade

        const entry = opts.deps[id];
        if (!entry) {
            markSkipped(id, 'no dependency entry');
            return;
        }

        const unhealthy = opts.health?.get(id);
        if (unhealthy && !unhealthy.healthy) {
            markSkipped(id, `agent unhealthy: ${unhealthy.message ?? 'unknown'}`);
            transitiveDependents(opts.deps, id).forEach(dep => markSkipped(dep, `upstream ${id} unhealthy`));
            return;
        }

        if (aborted) {
            markSkipped(id, 'aborted: root analysis failed');
            return;
        }

        const agent: IAgent = registry.get(id);
        const started = Date.now();
        let lastError: PipelineError | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const input: AgentInput = {
                    task: `${id} for ${ctx.requestName}`,
                    context: {
                        upstream: ctx.upstream,
                        files: ctx.files,
                        requestName: ctx.requestName,
                        analysisJson: ctx.analysisJson,
                    },
                };
                const timeoutMs = entry.timeoutMs ?? defaultTimeout;
                const output = await withTimeout(Promise.resolve(agent.execute(input)), timeoutMs);

                if (!output.success) {
                    lastError = { agentId: id, code: output.error?.code ?? 'AGENT_FAILED', message: output.error?.message ?? 'agent reported failure', attempts: attempt };
                    continue;
                }

                // Success path — record files (collisions are pipeline bugs -> failure)
                try {
                    for (const file of output.files ?? []) recordFile(ctx, file);
                } catch (err) {
                    if (err instanceof FileCollisionError) {
                        lastError = { agentId: id, code: 'FILE_COLLISION', message: err.message, attempts: attempt };
                        continue;
                    }
                    throw err;
                }

                applyContextAssignments(id, output);
                const produced = output.files?.length ?? 0;
                const degraded = attempt > 1 || (produced === 0 && entry.expectFiles !== false);
                const result: AgentAttemptResult = {
                    agentId: id,
                    status: degraded ? 'degraded' : 'success',
                    attempts: attempt,
                    durationMs: Date.now() - started,
                    filesProduced: produced,
                    ...(degraded && produced === 0 && entry.expectFiles !== false
                        ? (() => { const e: PipelineError = { agentId: id, code: 'NO_FILES', message: 'agent succeeded but produced no files', attempts: attempt }; errors.push(e); return { error: e }; })()
                        : {}),
                };
                results.set(id, result);
                return;
            } catch (err) {
                const isTimeout = err instanceof Error && err.message.startsWith('timeout after');
                lastError = { agentId: id, code: isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR', message: err instanceof Error ? err.message : String(err), attempts: attempt };
            }
        }

        // Terminal failure
        const finalError = lastError ?? { agentId: id, code: 'UNKNOWN', message: 'failed', attempts: maxAttempts };
        results.set(id, { agentId: id, status: 'failed', attempts: maxAttempts, durationMs: Date.now() - started, filesProduced: 0, error: finalError });
        errors.push(finalError);
        transitiveDependents(opts.deps, id).forEach(dep => markSkipped(dep, `upstream ${id} failed`));

        if (id === 'analysis-agent') aborted = true;
    };

    for (const level of levels) {
        await Promise.all(level.map(runOne));
    }

    for (const level of levels) {
        for (const id of level) {
            if (!results.has(id)) markSkipped(id, 'never scheduled');
        }
    }

    const resultList = levels.flat().map(id => results.get(id)!);
    const anyNotGreen = resultList.some(r => r.status !== 'success');
    const exitCode: RunResult['exitCode'] = aborted ? 2 : anyNotGreen ? 1 : 0;

    return { results: resultList, errors, exitCode, totalDurationMs: Date.now() - startedAll };
}
