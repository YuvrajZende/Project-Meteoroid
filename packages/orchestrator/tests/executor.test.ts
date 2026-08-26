import { executePlan } from '../src/pipeline/executor';
import { AgentRegistry } from '../src/pipeline/registry';
import { createContext } from '../src/pipeline/context';
import type { AgentId, DependencyMap } from '../src/pipeline/types';
import type { AgentHealthStatus } from '@loveable/shared';
import { makeMockAgent, ok, fail } from './helpers/mock-agent';

/** Mock ids ('a', 'b', ...) are not real AgentIds; tests only need string labels at runtime. */
const asLevels = (levels: string[][]): AgentId[][] => levels as unknown as AgentId[][];

function chainDeps(): DependencyMap {
    return {
        a: { dependsOn: [], expectFiles: false },
        b: { dependsOn: ['a' as never], timeoutMs: 50 },
        c: { dependsOn: ['b' as never] },
        d: { dependsOn: ['b' as never] },
    };
}

async function run(agents: ReturnType<typeof makeMockAgent>[], deps = chainDeps()) {
    const registry = new AgentRegistry();
    for (const agent of agents) registry.register(agent);
    const levels = [
        ['a' as const],
        ['b' as const],
        ['c' as const, 'd' as const],
    ];
    return executePlan(asLevels(levels), registry, createContext('t'), { deps });
}

describe('executePlan', () => {
    it('all-success run: merges upstream data and assigns context fields', async () => {
        const b = makeMockAgent('b', () => ok(['b.txt'], { schema: { tables: [] } }));
        const result = await run([
            makeMockAgent('a', () => ok([], { framework: { type: 'react' } })),
            b,
            makeMockAgent('c', (_i) => ok(['c.txt'])),
            makeMockAgent('d', () => ok(['d.txt'])),
        ]);
        expect(result.exitCode).toBe(0);
        expect(result.results.map(r => r.status)).toEqual(['success', 'success', 'success', 'success']);
        // upstream flows through
        expect((b.lastInput?.context?.upstream as Record<string, unknown>).a).toEqual({ framework: { type: 'react' } });
    });

    it('retries once then degrades', async () => {
        let n = 0;
        const flaky = makeMockAgent('b', () => (++n === 1 ? fail() : ok(['b.txt'])));
        const result = await run([makeMockAgent('a', () => ok([])), flaky, makeMockAgent('c', () => ok(['c.txt'])), makeMockAgent('d', () => ok(['d.txt']))]);
        expect(flaky.calls).toBe(2);
        expect(result.results.find(r => r.agentId === 'b')?.status).toBe('degraded');
        expect(result.exitCode).toBe(1);
    });

    it('double failure fails agent, skips transitive dependents only', async () => {
        const dead = makeMockAgent('b', () => fail());
        const c = makeMockAgent('c', () => ok(['c.txt']));
        const result = await run([makeMockAgent('a', () => ok([])), dead, c, makeMockAgent('d', () => ok(['d.txt']))]);
        const byId = Object.fromEntries(result.results.map(r => [r.agentId, r]));
        expect(byId.b.status).toBe('failed');
        expect(byId.b.attempts).toBe(2);
        expect(byId.c.status).toBe('skipped');
        expect(c.calls).toBe(0);
        expect(byId.d.status).toBe('skipped');
        expect(result.errors.some(e => e.agentId === 'b')).toBe(true);
    });

    it('independent branch still runs after sibling branch fails', async () => {
        // d does NOT depend on b here
        const deps: DependencyMap = {
            a: { dependsOn: [] },
            bad: { dependsOn: [] },
            good: { dependsOn: [] },
        };
        const registry = new AgentRegistry();
        registry.register(makeMockAgent('a', () => ok([])));
        registry.register(makeMockAgent('bad', () => fail()));
        const good = makeMockAgent('good', () => ok(['g.txt']));
        registry.register(good);
        const levels = [['a' as const], ['bad' as const, 'good' as const]];
        const result = await executePlan(asLevels(levels), registry, createContext('t'), { deps });
        const byId = Object.fromEntries(result.results.map(r => [r.agentId, r.status]));
        expect(byId.bad).toBe('failed');
        expect(byId.good).toBe('success');
    });

    it('times out a hanging agent', async () => {
        const hanging = makeMockAgent('b', () => new Promise(() => { /* never resolves */ }));
        const result = await run([makeMockAgent('a', () => ok([])), hanging, makeMockAgent('c', () => ok(['c.txt'])), makeMockAgent('d', () => ok(['d.txt']))]);
        const b = result.results.find(r => r.agentId === 'b');
        expect(b?.status).toBe('failed');
        expect(b?.error?.code).toBe('TIMEOUT');
    });

    it('thrown exceptions normalize to failures', async () => {
        const boom = makeMockAgent('b', () => { throw new Error('kaboom'); });
        const result = await run([makeMockAgent('a', () => ok([])), boom, makeMockAgent('c', () => ok(['c.txt'])), makeMockAgent('d', () => ok(['d.txt']))]);
        const b = result.results.find(r => r.agentId === 'b');
        expect(b?.status).toBe('failed');
        expect(b?.error?.message).toContain('kaboom');
    });

    it('zero files with expectFiles=true degrades with NO_FILES', async () => {
        const empty = makeMockAgent('b', () => ok([]));
        const result = await run([makeMockAgent('a', () => ok([])), empty, makeMockAgent('c', () => ok(['c.txt'])), makeMockAgent('d', () => ok(['d.txt']))]);
        const b = result.results.find(r => r.agentId === 'b');
        expect(b?.status).toBe('degraded');
        expect(b?.error?.code).toBe('NO_FILES');
    });

    it('root failure aborts with exit code 2', async () => {
        // Amended per controller ruling: the failing root must be NAMED 'analysis-agent'
        // because the brief-verbatim executor only sets fatal abort for that id.
        const deps: DependencyMap = {
            'analysis-agent': { dependsOn: [], expectFiles: false },
            b: { dependsOn: ['analysis-agent'], timeoutMs: 50 },
            c: { dependsOn: ['b' as never] },
            d: { dependsOn: ['b' as never] },
        };
        const registry = new AgentRegistry();
        registry.register(makeMockAgent('analysis-agent', () => fail()));
        registry.register(makeMockAgent('b', () => ok(['b.txt'])));
        registry.register(makeMockAgent('c', () => ok(['c.txt'])));
        registry.register(makeMockAgent('d', () => ok(['d.txt'])));
        const levels = [['analysis-agent' as const], ['b' as const], ['c' as const, 'd' as const]];
        const result = await executePlan(asLevels(levels), registry, createContext('t'), { deps });
        expect(result.exitCode).toBe(2);
        expect(result.results.filter(r => r.status === 'skipped').map(r => r.agentId).sort()).toEqual(['b', 'c', 'd']);
    });

    it('unhealthy agents (from health map) skip with their downstream', async () => {
        const registry = new AgentRegistry();
        registry.register(makeMockAgent('a', () => ok([])));
        const b = makeMockAgent('b', () => ok(['b.txt']));
        registry.register(b);
        registry.register(makeMockAgent('c', () => ok(['c.txt'])));
        registry.register(makeMockAgent('d', () => ok(['d.txt'])));
        const levels = [['a' as const], ['b' as const], ['c' as const, 'd' as const]];
        const health = new Map([['b' as const, { healthy: false, message: 'init blew up' }]]) as unknown as Map<AgentId, AgentHealthStatus>;
        const result = await executePlan(asLevels(levels), registry, createContext('t'), { deps: chainDeps(), health });
        const byId = Object.fromEntries(result.results.map(r => [r.agentId, r]));
        expect(byId.b.status).toBe('skipped');
        expect(b.calls).toBe(0);
        expect(byId.c.status).toBe('skipped');
    });

    it('file collision marks the offending agent failed', async () => {
        const first = makeMockAgent('c', () => ok(['dup.txt']));
        const second = makeMockAgent('d', () => ok(['dup.txt']));
        const result = await run([makeMockAgent('a', () => ok([])), makeMockAgent('b', () => ok(['b.txt'])), first, second]);
        const byId = Object.fromEntries(result.results.map(r => [r.agentId, r.status]));
        // one of them wrote dup.txt first; the other must be failed with FILE_COLLISION
        const statuses = Object.values(byId);
        expect(statuses.filter(s => s === 'failed').length).toBe(1);
    });
});
