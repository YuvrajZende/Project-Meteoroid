import type { AgentId, DependencyMap } from './types';

export class PipelinePlanError extends Error {}

/**
 * Topologically sorts agents into execution levels.
 * Level N agents depend only on agents in levels < N, so each level runs fully parallel.
 * Fails fast on cycles and unknown references before anything executes.
 */
export function planLevels(deps: DependencyMap): AgentId[][] {
    const ids = Object.keys(deps) as AgentId[];
    const known = new Set<string>(ids);

    for (const id of ids) {
        if (!known.has(id)) throw new PipelinePlanError(`Unknown agent id: ${id}`);
        for (const dep of deps[id].dependsOn) {
            if (!known.has(dep)) {
                throw new PipelinePlanError(`${id} depends on unregistered agent: ${dep}`);
            }
        }
    }

    const levelOf = new Map<AgentId, number>();
    const visiting = new Set<AgentId>();

    const resolve = (id: AgentId): number => {
        if (levelOf.has(id)) return levelOf.get(id)!;
        if (visiting.has(id)) throw new PipelinePlanError(`Dependency cycle at: ${id}`);
        visiting.add(id);
        const level = deps[id].dependsOn.length === 0
            ? 0
            : 1 + Math.max(...deps[id].dependsOn.map(resolve));
        visiting.delete(id);
        levelOf.set(id, level);
        return level;
    };

    for (const id of ids) resolve(id);

    const levels: AgentId[][] = [];
    for (const [id, level] of [...levelOf.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        (levels[level] ??= []).push(id);
    }
    return levels;
}
