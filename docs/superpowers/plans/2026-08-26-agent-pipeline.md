# Deterministic Agent Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic DAG orchestration layer (`packages/orchestrator/src/pipeline/`) where 13 agents coordinate through typed shared state, runnable today via `npm run agents` with zero API keys and zero services.

**Architecture:** New `pipeline/` core (registry → planner → executor → writer → reporter) inside `packages/orchestrator`, statically importing agent wrappers from repo-root `agents/`. Agents declare nothing; one central `dependencies.ts` holds the DAG. Coordination flows through `PipelineContext`: each agent reads upstream structured results from `input.context.upstream` and contributes files plus `metadata.data`.

**Tech Stack:** TypeScript (NodeNext, strict), tsx runtime, Jest + ts-jest tests, existing `IAgent` contract from `@loveable/shared`, existing template-based agent engines.

**Spec:** `docs/superpowers/specs/2026-08-26-agents-orchestration-design.md`

## Global Constraints

- Node >= 18; root `tsconfig.json`: `module: NodeNext`, `strict: true`.
- **No new npm dependencies** — use installed `jest`, `ts-jest`, `tsx`, `@langchain/*`, `dotenv` only.
- **No LLM calls** anywhere in the pipeline critical path. Engines owning `ChatOpenAI`/`ChatGroq` must never be driven into their AI-invoking branches.
- One-way dependency: `pipeline` → `agents` (via `@loveable/agents/*` alias). Never reverse.
- All commands run from repo root (Windows Git Bash); forward slashes in commands.
- Exit codes: `0` all green · `1` degraded/skipped · `2` fatal.
- Retry: exactly 2 attempts, immediate re-run. Degraded = success on attempt ≥ 2, OR success with zero files when the agent is expected to produce files (`expectFiles` flag, false only for `analysis-agent`).
- Failure of any agent ⇒ all transitive dependents become `skipped` (attempts=0) unless already terminal.
- `analysis-agent` failure is fatal: abort run, exit 2.
- Per-agent timeout default 60000 ms (configurable per entry in `dependencies.ts`).
- Canonical agent ids (kebab): `analysis-agent`, `database-agent`, `api-agent`, `auth-agent`, `security-agent`, `codegen-agent`, `test-agent`, `monitoring-agent`, `queue-agent`, `cicd-agent`, `infra-agent`, `microservice-agent`, `email-agent`. If an existing wrapper's `id` differs, change the wrapper to match.

## File Structure

```
jest.config.js                          # NEW root jest config
tsconfig.test.json                      # NEW CJS test tsconfig
packages/orchestrator/tests/
  helpers/mock-agent.ts                 # cue-based mock IAgent factory
  planner.test.ts  executor.test.ts  writer.test.ts  reporter.test.ts
  registry.test.ts  cli.e2e.test.ts     # layer 1–3 tests
packages/orchestrator/src/pipeline/
  types.ts  dependencies.ts  planner.ts  context.ts  registry.ts
  executor.ts  writer.ts  reporter.ts  demo-analysis.ts  index.ts
packages/orchestrator/src/cli.ts        # thin entry
agents/core/analysis/analysis-loader-agent.ts   # NEW analysis wrapper
agents/core/{database,api,auth,security}/*-iagent.ts      # MODIFIED wrappers
agents/support/codegen/index.ts  agents/support/test/test-agent-iagent.ts  # MODIFIED
agents/core/{monitoring,queue}/… agents/specialized/{cicd,infra,microservice}/… agents/support/email/…  # MODIFIED stubs
package.json                            # add "agents" script
```

---

### Task 1: Test infrastructure + import aliases

**Files:**
- Create: `jest.config.js`, `tsconfig.test.json`, `packages/orchestrator/tests/helpers/smoke.alias.test.ts`
- Modify: `tsconfig.json` (paths)

**Interfaces:**
- Produces: working `npx jest <file>` command; resolvable aliases `@loveable/shared`, `@loveable/agents/<subpath>` in both Jest and tsx.

- [ ] **Step 1: Add path alias to tsconfig.json**

In `tsconfig.json` → `compilerOptions.paths`, add:

```json
"@loveable/agents/*": ["agents/*"],
"@loveable/agents": ["agents/index.ts"]
```

- [ ] **Step 2: Create jest.config.js**

```js
/** Root Jest config for orchestrator pipeline tests */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/packages/orchestrator/tests'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^@loveable/shared$': '<rootDir>/packages/shared/src/index.ts',
        '^@loveable/agents$': '<rootDir>/agents/index.ts',
        '^@loveable/agents/(.*)$': '<rootDir>/agents/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            { tsconfig: '<rootDir>/tsconfig.test.json', isolatedModules: true },
        ],
    },
};
```

Note: `'^(\\.{1,2}/.*)\\.js$'` strips NodeNext `.js` suffixes so engine files importing `./x.js` resolve to `x.ts`.

- [ ] **Step 3: Create tsconfig.test.json**

```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "composite": false,
        "declaration": false,
        "declarationMap": false,
        "noEmit": true,
        "module": "commonjs",
        "moduleResolution": "node",
        "types": ["node", "jest"]
    },
    "include": [
        "packages/orchestrator/tests/**/*.ts",
        "packages/orchestrator/src/pipeline/**/*.ts",
        "packages/orchestrator/src/cli.ts",
        "agents/**/*.ts",
        "packages/shared/src/**/*.ts"
    ]
}
```

- [ ] **Step 4: Write alias smoke test**

Create `packages/orchestrator/tests/helpers/smoke.alias.test.ts`:

```typescript
describe('import aliases', () => {
    it('resolves @loveable/shared with isValidAgent', () => {
        const shared = require('@loveable/shared');
        expect(typeof shared.isValidAgent).toBe('function');
    });

    it('resolves @loveable/agents subpath barrel (directory index)', () => {
        const security = require('@loveable/agents/core/security');
        expect(security.securityAgentIAgent).toBeDefined();
        expect(security.securityAgentIAgent.id).toBe('security-agent');
    });
});
```

- [ ] **Step 5: Run smoke test**

Run: `npx jest packages/orchestrator/tests/helpers/smoke.alias.test.ts`
Expected: PASS (2 tests).

If the subpath barrel fails to resolve in Jest, change mapper to explicit index form:
`'^@loveable/agents/(.*)$': '<rootDir>/agents/$1/index.ts'` AND keep non-index imports working by importing barrels only ever as `@loveable/agents/<folder>` (no deeper paths).

- [ ] **Step 6: Verify tsx runtime resolution**

Run: `npx tsx --eval "import('@loveable/agents/core/security').then(m => console.log('tsx-ok', m.securityAgentIAgent.id))"`
Expected stdout: `tsx-ok security-agent`

If it fails, fallback (record in commit message): pipeline files import agents via relative paths `../../../../agents/<folder>` instead of the alias — apply consistently in later tasks.

- [ ] **Step 7: Commit**

```bash
git add jest.config.js tsconfig.test.json tsconfig.json packages/orchestrator/tests
git commit -m "chore(pipeline): jest infra + @loveable/agents alias"
```

---

### Task 2: Pipeline types + Planner

**Files:**
- Create: `packages/orchestrator/src/pipeline/types.ts`, `packages/orchestrator/src/pipeline/dependencies.ts`, `packages/orchestrator/src/pipeline/planner.ts`
- Test: `packages/orchestrator/tests/planner.test.ts`

**Interfaces:**
- Produces (used by all later tasks):

```typescript
// types.ts
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

// planner.ts
export class PipelinePlanError extends Error {}   // cycle / unknown reference
export function planLevels(deps: DependencyMap): AgentId[][]
```

- [ ] **Step 1: Write failing planner tests**

`packages/orchestrator/tests/planner.test.ts`:

```typescript
import { planLevels, PipelinePlanError } from '../src/pipeline/planner';
import type { DependencyMap } from '../src/pipeline/types';
import { TEST_DEPS } from './helpers/test-deps';

describe('planLevels', () => {
    it('orders agents into levels respecting dependencies', () => {
        const levels = planLevels(TEST_DEPS);
        expect(levels[0]).toEqual(['analysis-agent']);
        expect(levels[1]).toEqual(['database-agent']);
        expect([...levels[2]].sort()).toEqual(['api-agent', 'auth-agent']);
        expect(levels[3]).toEqual(['security-agent']);
        expect(levels[4]).toEqual(['codegen-agent']);
        expect([...levels[5]].sort()).toEqual(
            ['test-agent', 'monitoring-agent', 'queue-agent', 'cicd-agent', 'infra-agent', 'microservice-agent', 'email-agent']
        );
    });

    it('throws on unknown dependency reference', () => {
        const bad = { a: { dependsOn: ['ghost' as never] } } as unknown as DependencyMap;
        expect(() => planLevels(bad)).toThrow(PipelinePlanError);
    });

    it('throws on dependency cycle', () => {
        const bad = {
            x: { dependsOn: ['y' as never] },
            y: { dependsOn: ['x' as never] },
        } as unknown as DependencyMap;
        expect(() => planLevels(bad)).toThrow(PipelinePlanError);
    });
});
```

Create `packages/orchestrator/tests/helpers/test-deps.ts`:

```typescript
import type { DependencyMap } from '../../src/pipeline/types';

export const TEST_DEPS: DependencyMap = {
    'analysis-agent': { dependsOn: [], expectFiles: false },
    'database-agent': { dependsOn: ['analysis-agent'] },
    'api-agent': { dependsOn: ['database-agent'] },
    'auth-agent': { dependsOn: ['database-agent'] },
    'security-agent': { dependsOn: ['api-agent', 'auth-agent'] },
    'codegen-agent': { dependsOn: ['api-agent', 'auth-agent', 'security-agent'] },
    'test-agent': { dependsOn: ['codegen-agent'] },
    'monitoring-agent': { dependsOn: ['codegen-agent'], stub: true },
    'queue-agent': { dependsOn: ['codegen-agent'], stub: true },
    'cicd-agent': { dependsOn: ['codegen-agent'], stub: true },
    'infra-agent': { dependsOn: ['codegen-agent'], stub: true },
    'microservice-agent': { dependsOn: ['codegen-agent'], stub: true },
    'email-agent': { dependsOn: ['codegen-agent'], stub: true },
};
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest packages/orchestrator/tests/planner.test.ts`
Expected: FAIL — cannot resolve `../src/pipeline/planner`.

- [ ] **Step 3: Implement types.ts**

Write the exact contents from the Interfaces block above into `packages/orchestrator/src/pipeline/types.ts`.

- [ ] **Step 4: Implement dependencies.ts (real DAG)**

```typescript
import type { DependencyMap } from './types';

/** The coordination contract. One file to see the whole DAG. */
export const DEPENDENCIES: DependencyMap = {
    'analysis-agent': { dependsOn: [], timeoutMs: 120000, expectFiles: false },
    'database-agent': { dependsOn: ['analysis-agent'], timeoutMs: 60000 },
    'api-agent': { dependsOn: ['database-agent'], timeoutMs: 60000 },
    'auth-agent': { dependsOn: ['database-agent'], timeoutMs: 60000 },
    'security-agent': { dependsOn: ['api-agent', 'auth-agent'], timeoutMs: 60000 },
    'codegen-agent': { dependsOn: ['api-agent', 'auth-agent', 'security-agent'], timeoutMs: 90000 },
    'test-agent': { dependsOn: ['codegen-agent'], timeoutMs: 90000 },
    'monitoring-agent': { dependsOn: ['codegen-agent'], stub: true },
    'queue-agent': { dependsOn: ['codegen-agent'], stub: true },
    'cicd-agent': { dependsOn: ['codegen-agent'], stub: true },
    'infra-agent': { dependsOn: ['codegen-agent'], stub: true },
    'microservice-agent': { dependsOn: ['codegen-agent'], stub: true },
    'email-agent': { dependsOn: ['codegen-agent'], stub: true },
};
```

- [ ] **Step 5: Implement planner.ts**

```typescript
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
```

- [ ] **Step 6: Run planner tests until green**

Run: `npx jest packages/orchestrator/tests/planner.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/orchestrator/src/pipeline/types.ts packages/orchestrator/src/pipeline/dependencies.ts packages/orchestrator/src/pipeline/planner.ts packages/orchestrator/tests/planner.test.ts packages/orchestrator/tests/helpers/test-deps.ts
git commit -m "feat(pipeline): types, DAG declaration, topological planner"
```

---

### Task 3: PipelineContext

**Files:**
- Create: `packages/orchestrator/src/pipeline/context.ts`
- Test: `packages/orchestrator/tests/context.test.ts`

**Interfaces:**
- Consumes: `PipelineError` from `./types`.
- Produces:

```typescript
// context.ts
import type { GeneratedFile } from '@loveable/shared';
import type { FrontendAnalysisResult } from '@loveable/agents/core/analysis/types';
import type { SchemaDefinition as DbSchemaDefinition } from '@loveable/agents/core/database/types';
import type { APIGenerationResult } from '@loveable/agents/core/api/api-agent';
import type { PipelineError } from './types';

export interface UpstreamResults {
    [agentId: string]: unknown;   // structured metadata.data contributed by each agent
}

export interface AuthSetupInfo {
    provider: string;
    filesCount: number;
}

export interface PipelineContextData {
    requestName: string;
    analysis?: FrontendAnalysisResult;
    dataModels?: DbSchemaDefinition;
    apiResult?: APIGenerationResult;
    authSetup?: AuthSetupInfo;
    securityConfig?: unknown;
    files: Map<string, GeneratedFile>;
    errors: PipelineError[];
    upstream: UpstreamResults;
}

export function createContext(requestName: string): PipelineContextData;

export function recordFile(ctx: PipelineContextData, file: GeneratedFile): void;
// throws FileCollisionError when ctx.files already has file.path

export class FileCollisionError extends Error {}
```

- [ ] **Step 1: Write failing context tests**

`packages/orchestrator/tests/context.test.ts`:

```typescript
import { createContext, recordFile, FileCollisionError } from '../src/pipeline/context';

const f = (path: string) => ({ path, content: 'x', type: 'code' as const });

describe('PipelineContextData', () => {
    it('creates empty context', () => {
        const ctx = createContext('demo');
        expect(ctx.requestName).toBe('demo');
        expect(ctx.files.size).toBe(0);
        expect(ctx.errors).toEqual([]);
        expect(ctx.upstream).toEqual({});
    });

    it('records files', () => {
        const ctx = createContext('demo');
        recordFile(ctx, f('a.ts'));
        expect(ctx.files.get('a.ts')).toBeDefined();
    });

    it('detects collisions loudly', () => {
        const ctx = createContext('demo');
        recordFile(ctx, f('a.ts'));
        expect(() => recordFile(ctx, f('a.ts'))).toThrow(FileCollisionError);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/context.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement context.ts per Interfaces block**

```typescript
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
```

If agent type modules do not resolve under Jest via alias, import them with relative paths (`../../../../agents/core/...`) — these are type-only imports; runtime imports stay aliased.

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/context.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/pipeline/context.ts packages/orchestrator/tests/context.test.ts
git commit -m "feat(pipeline): shared PipelineContext with collision detection"
```

---

### Task 4: AgentRegistry

**Files:**
- Create: `packages/orchestrator/src/pipeline/registry.ts`, placeholder `agents/core/analysis/analysis-loader-agent.ts`
- Test: `packages/orchestrator/tests/registry.test.ts`

**Interfaces:**
- Consumes: wrapper singletons from agent barrels; `isValidAgent` from `@loveable/shared`.
- Produces:

```typescript
export class AgentRegistry {
    register(agent: IAgent): void;
    get(id: AgentId): IAgent;                  // throws if missing
    all(): IAgent[];
    async initializeAll(): Promise<Map<AgentId, AgentHealthStatus>>;
}
export function buildDefaultRegistry(): AgentRegistry;  // registers all 13 canonical wrappers
```

- [ ] **Step 1: Write failing registry test**

`packages/orchestrator/tests/registry.test.ts`:

```typescript
import { buildDefaultRegistry } from '../src/pipeline/registry';
import { isValidAgent } from '@loveable/shared';

const ALL_IDS = [
    'analysis-agent', 'database-agent', 'api-agent', 'auth-agent',
    'security-agent', 'codegen-agent', 'test-agent', 'monitoring-agent',
    'queue-agent', 'cicd-agent', 'infra-agent', 'microservice-agent', 'email-agent',
];

describe('buildDefaultRegistry', () => {
    it('registers exactly the 13 canonical agents with canonical ids', () => {
        const reg = buildDefaultRegistry();
        const ids = reg.all().map(a => a.id).sort();
        expect(ids).toEqual([...ALL_IDS].sort());
    });

    it('every registration satisfies isValidAgent', () => {
        const reg = buildDefaultRegistry();
        for (const agent of reg.all()) {
            expect(isValidAgent(agent)).toBe(true);
        }
    });

    it('initializeAll returns a health entry per agent', async () => {
        const reg = buildDefaultRegistry();
        const health = await reg.initializeAll();
        expect(health.size).toBe(13);
        for (const id of ALL_IDS) {
            expect(health.get(id as never)).toBeDefined();
        }
    });
});
```

This test instantiates REAL wrappers. Engines are template-based; constructors must not call any LLM API. If a constructor throws due to missing env, fix by making client construction lazy in that engine (minimal change).

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/registry.test.ts`
Expected: FAIL — registry module not found.

- [ ] **Step 3: Create analysis-loader placeholder**

New file `agents/core/analysis/analysis-loader-agent.ts` (full implementation comes in Task 8):

```typescript
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
```

- [ ] **Step 4: Implement registry.ts**

```typescript
import type { IAgent, AgentHealthStatus } from '@loveable/shared';
import type { AgentId } from './types';

import { analysisLoaderAgent } from '@loveable/agents/core/analysis/analysis-loader-agent';
import { databaseAgentIAgent } from '@loveable/agents/core/database';
import { apiAgentIAgent } from '@loveable/agents/core/api';
import { authAgentIAgent } from '@loveable/agents/core/auth';
import { securityAgentIAgent } from '@loveable/agents/core/security';
import { codegenAgent } from '@loveable/agents/support/codegen';
import { testAgentIAgent } from '@loveable/agents/support/test';
import { monitoringAgentIAgent } from '@loveable/agents/core/monitoring';
import { queueAgentIAgent } from '@loveable/agents/core/queue';
import { cicdAgentIAgent } from '@loveable/agents/specialized/cicd';
import { infraAgentIAgent } from '@loveable/agents/specialized/infra';
import { microserviceAgentIAgent } from '@loveable/agents/specialized/microservice';
import { emailAgentIAgent } from '@loveable/agents/support/email';

export class AgentRegistry {
    private agents = new Map<string, IAgent>();

    register(agent: IAgent): void {
        this.agents.set(agent.id, agent);
    }

    get(id: AgentId): IAgent {
        const agent = this.agents.get(id);
        if (!agent) throw new Error(`Agent not registered: ${id}`);
        return agent;
    }

    all(): IAgent[] {
        return [...this.agents.values()];
    }

    async initializeAll(): Promise<Map<AgentId, AgentHealthStatus>> {
        const health = new Map<AgentId, AgentHealthStatus>();
        for (const agent of this.agents.values()) {
            try {
                await agent.initialize({});
                health.set(agent.id as AgentId, await agent.healthCheck());
            } catch (err) {
                health.set(agent.id as AgentId, {
                    healthy: false,
                    message: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return health;
    }
}

export function buildDefaultRegistry(): AgentRegistry {
    const registry = new AgentRegistry();
    registry.register(analysisLoaderAgent);
    registry.register(databaseAgentIAgent);
    registry.register(apiAgentIAgent);
    registry.register(authAgentIAgent);
    registry.register(securityAgentIAgent);
    registry.register(codegenAgent);
    registry.register(testAgentIAgent);
    registry.register(monitoringAgentIAgent);
    registry.register(queueAgentIAgent);
    registry.register(cicdAgentIAgent);
    registry.register(infraAgentIAgent);
    registry.register(microserviceAgentIAgent);
    registry.register(emailAgentIAgent);
    return registry;
}
```

Before running: open each imported barrel (`agents/core/*/index.ts`, `agents/specialized/*/index.ts`, `agents/support/{test,email}/index.ts`) and confirm the singleton export name matches (`databaseAgentIAgent`, `apiAgentIAgent`, `authAgentIAgent`, `testAgentIAgent`, etc.). Adjust import names to actual exports. If an existing wrapper's `readonly id` differs from the canonical id, edit that one line in the wrapper.

- [ ] **Step 5: Run registry tests until green**

Run: `npx jest packages/orchestrator/tests/registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/pipeline/registry.ts packages/orchestrator/tests/registry.test.ts agents/core/analysis/analysis-loader-agent.ts
git commit -m "feat(pipeline): AgentRegistry wiring all 13 canonical wrappers"
```

---

### Task 5: Executor

**Files:**
- Create: `packages/orchestrator/src/pipeline/executor.ts`
- Test: `packages/orchestrator/tests/executor.test.ts`, helper `packages/orchestrator/tests/helpers/mock-agent.ts`

**Interfaces:**
- Consumes: `planLevels` output (`AgentId[][]`), `AgentRegistry`, `PipelineContextData`, `DependencyMap`.
- Produces:

```typescript
export interface ExecuteOptions {
    deps: DependencyMap;
    health?: Map<AgentId, AgentHealthStatus>;   // unhealthy agents are skipped up front
    maxAttempts?: number;                        // default 2
    defaultTimeoutMs?: number;                   // default 60000
}

export class FatalPipelineError extends Error {}   // root failure signal

export async function executePlan(
    levels: AgentId[][],
    registry: AgentRegistry,
    ctx: PipelineContextData,
    opts: ExecuteOptions,
): Promise<RunResult>
```

Behavior contract (what the tests pin down):
- Runs levels sequentially; agents within a level concurrently.
- Each agent gets `input.context.upstream === ctx.upstream` (same object reference).
- Success ⇒ `output.metadata.data` stored as `ctx.upstream[agentId]`; `output.files` recorded via `recordFile`; well-known fields assigned: `analysis-agent → ctx.analysis`, `database-agent → ctx.dataModels`, `api-agent → ctx.apiRoutes + ctx.apiResult`, `auth-agent → ctx.authSetup {provider, filesCount}`, `security-agent → ctx.securityConfig`.
- Attempt fails when the promise rejects OR `output.success === false`. Retry until `maxAttempts`. Terminal failure ⇒ status `failed`, error `{code, message, attempts}`, all transitive dependents become `skipped` with reason `upstream <id> failed`.
- Success on attempt ≥ 2 ⇒ `degraded`. Success with zero files while `deps[id].expectFiles !== false` ⇒ `degraded` (error code `NO_FILES`).
- Timeout ⇒ treated as failed attempt (code `TIMEOUT`).
- `analysis-agent` terminal failure ⇒ remaining levels not executed; `exitCode: 2`; a `FatalPipelineError` is NOT thrown — it is encoded in `RunResult.exitCode` and every unexecuted agent is `skipped` with reason `aborted: root analysis failed`.

- [ ] **Step 1: Write mock-agent helper**

`packages/orchestrator/tests/helpers/mock-agent.ts`:

```typescript
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
```

- [ ] **Step 2: Write failing executor tests**

`packages/orchestrator/tests/executor.test.ts`:

```typescript
import { executePlan } from '../src/pipeline/executor';
import { AgentRegistry } from '../src/pipeline/registry';
import { createContext } from '../src/pipeline/context';
import type { DependencyMap } from '../src/pipeline/types';
import { makeMockAgent, ok, fail } from './helpers/mock-agent';

function chainDeps(): DependencyMap {
    return {
        a: { dependsOn: [], expectFiles: false },
        b: { dependsOn: ['a'], timeoutMs: 50 },
        c: { dependsOn: ['b'] },
        d: { dependsOn: ['b'] },
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
    return executePlan(levels, registry, createContext('t'), { deps });
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
            a: { dependsOn: [], expectFiles: false },
            bad: { dependsOn: [] },
            good: { dependsOn: [] },
        };
        const registry = new AgentRegistry();
        registry.register(makeMockAgent('a', () => ok([])));
        registry.register(makeMockAgent('bad', () => fail()));
        const good = makeMockAgent('good', () => ok(['g.txt']));
        registry.register(good);
        const levels = [['a' as const], ['bad' as const, 'good' as const]];
        const result = await executePlan(levels, registry, createContext('t'), { deps });
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
        const result = await run([makeMockAgent('a', () => fail()), makeMockAgent('b', () => ok(['b.txt'])), makeMockAgent('c', () => ok(['c.txt'])), makeMockAgent('d', () => ok(['d.txt']))]);
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
        const health = new Map([['b' as const, { healthy: false, message: 'init blew up' }]]);
        const result = await executePlan(levels, registry, createContext('t'), { deps: chainDeps(), health });
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
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/executor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement executor.ts**

```typescript
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

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;

function transitiveDependents(deps: DependencyMap, root: AgentId): Set<string> {
    const affected = new Set<string>();
    const stack = [root];
    while (stack.length > 0) {
        const current = stack.pop()!;
        for (const [id, entry] of Object.entries(deps) as [string, DependencyEntry][]) {
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
                const input: AgentInput = { task: `${id} for ${ctx.requestName}`, context: { upstream: ctx.upstream } };
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
```

- [ ] **Step 5: Run executor tests until green**

Run: `npx jest packages/orchestrator/tests/executor.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/pipeline/executor.ts packages/orchestrator/tests/executor.test.ts packages/orchestrator/tests/helpers/mock-agent.ts
git commit -m "feat(pipeline): DAG executor with retry, degrade cascade, timeouts"
```

---

### Task 6: FileWriter

**Files:**
- Create: `packages/orchestrator/src/pipeline/writer.ts`
- Test: `packages/orchestrator/tests/writer.test.ts`

**Interfaces:**
- Produces:

```typescript
export interface WriteSummary {
    written: number;
    rootDir: string;
}
export async function writeFiles(
    files: Map<string, GeneratedFile>,
    outRoot: string,
): Promise<WriteSummary>
```

Note: collisions are already prevented at collection time by `recordFile` (Task 3); the writer's guarantee is: create directories recursively, write every file under `outRoot/<path>`, never overwrite an existing non-empty file at the target root (it throws `Error('refusing to overwrite existing output')` if `outRoot` exists and is non-empty).

- [ ] **Step 1: Write failing writer tests**

`packages/orchestrator/tests/writer.test.ts`:

```typescript
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeFiles } from '../src/pipeline/writer';
import type { GeneratedFile } from '@loveable/shared';

function tmpRoot(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), 'meteoroid-writer-'));
}

const fileOf = (p: string): GeneratedFile => ({ path: p, content: `content-of-${p}`, type: 'code' });

describe('writeFiles', () => {
    it('writes nested trees and creates directories', async () => {
        const root = await tmpRoot();
        const files = new Map([
            ['package.json', fileOf('package.json')],
            ['prisma/schema.prisma', fileOf('prisma/schema.prisma')],
            ['src/routes/users.ts', fileOf('src/routes/users.ts')],
        ]);
        const summary = await writeFiles(files, path.join(root, 'backend'));
        expect(summary.written).toBe(3);
        expect(await fs.readFile(path.join(root, 'backend/prisma/schema.prisma'), 'utf8')).toBe('content-of-prisma/schema.prisma');
        expect(await fs.readFile(path.join(root, 'backend/src/routes/users.ts'), 'utf8')).toBe('content-of-src/routes/users.ts');
    });

    it('refuses to overwrite a non-empty output directory', async () => {
        const root = await tmpRoot();
        await fs.writeFile(path.join(root, 'existing.txt'), 'keep me');
        await expect(writeFiles(new Map([['a.txt', fileOf('a.txt')]]), root))
            .rejects.toThrow(/refusing to overwrite/i);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/writer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement writer.ts**

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GeneratedFile } from '@loveable/shared';

export interface WriteSummary {
    written: number;
    rootDir: string;
}

export async function writeFiles(files: Map<string, GeneratedFile>, outRoot: string): Promise<WriteSummary> {
    const existing = await fs.readdir(outRoot).catch(err => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    });
    if (existing !== null && existing.length > 0) {
        throw new Error(`refusing to overwrite existing output directory: ${outRoot}`);
    }

    for (const file of files.values()) {
        const target = path.join(outRoot, file.path);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, file.content, 'utf8');
    }
    return { written: files.size, rootDir: outRoot };
}
```

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/writer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/pipeline/writer.ts packages/orchestrator/tests/writer.test.ts
git commit -m "feat(pipeline): materialize GeneratedFiles to disk safely"
```

---

### Task 7: Reporter

**Files:**
- Create: `packages/orchestrator/src/pipeline/reporter.ts`
- Test: `packages/orchestrator/tests/reporter.test.ts`

**Interfaces:**
- Produces:

```typescript
export function renderReport(run: RunResult, deps: DependencyMap): string;
// One line per agent: id, status glyph (✅ ⚠️ ❌ ⏭️), attempts, files, duration,
// note column: 'stub' when deps[id].stub, else error code/message when present.
// Header block includes totalDurationMs and exitCode.

export async function writeReportJson(run: RunResult, outDir: string): Promise<string>;
// Writes <outDir>/run-report.json = { exitCode, totalDurationMs, errors, results }
// Returns the file path.
```

- [ ] **Step 1: Write failing reporter tests**

`packages/orchestrator/tests/reporter.test.ts`:

```typescript
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { renderReport, writeReportJson } from '../src/pipeline/reporter';
import { TEST_DEPS } from './helpers/test-deps';
import type { RunResult } from '../src/pipeline/types';

const fakeRun = (): RunResult => ({
    results: [
        { agentId: 'analysis-agent', status: 'success', attempts: 1, durationMs: 5, filesProduced: 0 },
        { agentId: 'database-agent', status: 'degraded', attempts: 2, durationMs: 10, filesProduced: 3 },
        { agentId: 'api-agent', status: 'failed', attempts: 2, durationMs: 8, filesProduced: 0, error: { agentId: 'api-agent', code: 'AGENT_FAILED', message: 'boom', attempts: 2 } },
        { agentId: 'auth-agent', status: 'skipped', attempts: 0, durationMs: 0, filesProduced: 0, error: { agentId: 'auth-agent', code: 'SKIPPED', message: 'upstream api-agent failed', attempts: 0 } },
    ],
    errors: [],
    exitCode: 1,
    totalDurationMs: 23,
});

describe('reporter', () => {
    it('renders all four states with glyphs and stub labels', () => {
        const text = renderReport(fakeRun(), TEST_DEPS);
        expect(text).toContain('✅');
        expect(text).toContain('⚠️');
        expect(text).toContain('❌');
        expect(text).toContain('⏭️');
        expect(text).toContain('stub');          // TEST_DEPS marks monitoring etc.
        expect(text).toContain('AGENT_FAILED');
    });

    it('writes parseable run-report.json', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'meteoroid-report-'));
        const p = await writeReportJson(fakeRun(), dir);
        const parsed = JSON.parse(await fs.readFile(p, 'utf8'));
        expect(parsed.exitCode).toBe(1);
        expect(parsed.results).toHaveLength(4);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/reporter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reporter.ts**

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentAttemptResult, DependencyMap, RunResult } from './types';

const GLYPH: Record<AgentAttemptResult['status'], string> = {
    success: '✅',
    degraded: '⚠️',
    failed: '❌',
    skipped: '⏭️',
};

export function renderReport(run: RunResult, deps: DependencyMap): string {
    const lines: string[] = [];
    lines.push('═'.repeat(72));
    lines.push(`📊 METEOROID RUN REPORT — exit ${run.exitCode} — ${run.totalDurationMs}ms`);
    lines.push('═'.repeat(72));
    lines.push('AGENT'.padEnd(22) + 'STATUS'.padEnd(10) + 'ATT'.padEnd(5) + 'FILES'.padEnd(7) + 'MS'.padEnd(7) + 'NOTE');
    lines.push('-'.repeat(72));

    for (const r of run.results) {
        const noteParts: string[] = [];
        if (deps[r.agentId]?.stub) noteParts.push('stub');
        if (r.error) noteParts.push(`${r.error.code}: ${r.error.message}`.substring(0, 40));
        lines.push(
            r.agentId.padEnd(22)
            + GLYPH[r.status].padEnd(10)
            + String(r.attempts).padEnd(5)
            + String(r.filesProduced).padEnd(7)
            + String(r.durationMs).padEnd(7)
            + noteParts.join(' | ')
        );
    }
    lines.push('═'.repeat(72));
    return lines.join('\n');
}

export async function writeReportJson(run: RunResult, outDir: string): Promise<string> {
    const filePath = path.join(outDir, 'run-report.json');
    const payload = {
        exitCode: run.exitCode,
        totalDurationMs: run.totalDurationMs,
        errors: run.errors,
        results: run.results,
    };
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
}
```

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/reporter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/pipeline/reporter.ts packages/orchestrator/tests/reporter.test.ts
git commit -m "feat(pipeline): console table + run-report.json"
```

---

### Task 8: Analysis Loader Agent (full implementation)

**Files:**
- Modify: `agents/core/analysis/analysis-loader-agent.ts` (replace Task 4 placeholder `execute`)
- Test: `packages/orchestrator/tests/agents/analysis-loader.test.ts`

**Interfaces:**
- Consumes: `input.context.analysisJson` (unknown — a parsed JSON object from CLI).
- Produces: `AgentOutput` with `metadata.data = FrontendAnalysisResult`; no files (`expectFiles: false`). Invalid/missing input ⇒ `success:false, error.code 'INVALID_ANALYSIS'`.

- [ ] **Step 1: Write failing test**

`packages/orchestrator/tests/agents/analysis-loader.test.ts`:

```typescript
import { analysisLoaderAgent } from '@loveable/agents/core/analysis/analysis-loader-agent';
import { DEMO_ANALYSIS } from '../../src/pipeline/demo-analysis';

describe('AnalysisLoaderAgent', () => {
    it('validates and passes through a well-formed analysis', async () => {
        const out = await analysisLoaderAgent.execute({
            task: 'load analysis',
            context: { analysisJson: JSON.parse(JSON.stringify(DEMO_ANALYSIS)) },
        });
        expect(out.success).toBe(true);
        const data = out.metadata?.data as { framework: { type: string }; dataModels: unknown[] };
        expect(data.framework.type).toBe('react-vite');
        expect(data.dataModels.length).toBeGreaterThan(0);
    });

    it('normalizes analyzedAt string into Date', async () => {
        const json = JSON.parse(JSON.stringify(DEMO_ANALYSIS));
        json.analyzedAt = '2026-01-01T00:00:00.000Z';
        const out = await analysisLoaderAgent.execute({ task: 'x', context: { analysisJson: json } });
        expect((out.metadata?.data as { analyzedAt: Date }).analyzedAt instanceof Date).toBe(true);
    });

    it('rejects missing input', async () => {
        const out = await analysisLoaderAgent.execute({ task: 'x', context: {} });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('INVALID_ANALYSIS');
    });

    it('rejects structurally broken analysis', async () => {
        const out = await analysisLoaderAgent.execute({ task: 'x', context: { analysisJson: { framework: {} } } });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('INVALID_ANALYSIS');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/agents/analysis-loader.test.ts`
Expected: FAIL — `DEMO_ANALYSIS` module missing / execute returns placeholder.

- [ ] **Step 3: Create demo-analysis.ts**

`packages/orchestrator/src/pipeline/demo-analysis.ts`:

```typescript
import type { FrontendAnalysisResult } from '@loveable/agents/core/analysis/types';

const fields = (defs: Array<[string, string, boolean?]>) =>
    defs.map(([name, type, optional]) => ({
        name,
        type: type as never,
        optional: optional ?? false,
    }));

/** Built-in sample so `npm run agents -- --demo` runs with zero prerequisites. */
export function makeDemoAnalysis(): FrontendAnalysisResult {
    return {
        analyzedAt: new Date(),
        repositoryPath: 'demo://mini-commerce',
        framework: {
            type: 'react-vite', version: '5.4.0', isMetaFramework: false,
            usesTypeScript: true, buildTool: 'vite', uiLibrary: 'tailwind',
            stateManagement: null, confidence: 0.95,
        },
        apiCalls: [
            { endpoint: '/api/products', method: 'GET', library: 'axios', sourceFile: 'demo', lineNumber: 1, requiresAuth: false },
            { endpoint: '/api/orders', method: 'POST', library: 'fetch', sourceFile: 'demo', lineNumber: 2, requiresAuth: true },
        ],
        dataModels: [
            {
                name: 'Product',
                confidence: 0.9,
                primaryKey: 'id',
                sources: [{ file: 'demo/types.ts', type: 'interface' }],
                relationships: [
                    { targetModel: 'Order', type: 'one-to-many', fieldName: 'orders' },
                ],
                fields: fields([
                    ['id', 'uuid'], ['name', 'string'], ['description', 'string'],
                    ['priceCents', 'number'], ['inStock', 'boolean'], ['createdAt', 'date'],
                ]),
            },
            {
                name: 'Order',
                confidence: 0.85,
                primaryKey: 'id',
                sources: [{ file: 'demo/types.ts', type: 'interface' }],
                relationships: [],
                fields: fields([
                    ['id', 'uuid'], ['userId', 'uuid'], ['productId', 'uuid'],
                    ['quantity', 'number'], ['totalCents', 'number'], ['status', 'string'],
                ]),
            },
        ],
        authStrategy: {
            provider: 'clerk',
            features: { socialLogin: true, emailPassword: true, magicLink: false, phoneAuth: false, mfa: false, sso: false },
            protectedRoutes: ['/account'],
            authFiles: [], authHooks: [], tokenStorage: 'cookie', confidence: 0.9,
        },
        routes: [],
        dependencies: [],
        filesAnalyzed: 2,
        stats: { totalFiles: 2, jsxFiles: 1, tsFiles: 1, apiCallsFound: 2, modelsInferred: 2, routesDetected: 0 },
        warnings: [],
        suggestions: { recommendedDatabase: 'postgresql', recommendedOrm: 'prisma', recommendedAuth: 'clerk', apiStyle: 'rest' },
    };
}
```

- [ ] **Step 4: Implement the loader's real execute()**

Replace the placeholder body in `agents/core/analysis/analysis-loader-agent.ts`:

```typescript
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
    } as import('@loveable/shared').AgentOutput extends never ? never : import('../types').FrontendAnalysisResult;

    return {
        success: true,
        files: [],
        message: `loaded analysis for ${result.repositoryPath}`,
        metadata: { data: result },
    };
}
```

(If that conditional-type line reads awkwardly in your editor, write it plainly:
`const result = { ...j, analyzedAt: ... } as FrontendAnalysisResult;` with `import type { FrontendAnalysisResult } from './types';` at the top.)

- [ ] **Step 5: Run until green**

Run: `npx jest packages/orchestrator/tests/agents/analysis-loader.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add agents/core/analysis/analysis-loader-agent.ts packages/orchestrator/src/pipeline/demo-analysis.ts packages/orchestrator/tests/agents/analysis-loader.test.ts
git commit -m "feat(agents): analysis loader validates JSON into pipeline context"
```

---

### Task 9: Database Agent wrapper upgrade

**Files:**
- Modify: `agents/core/database/database-agent-iagent.ts` (rewrite `execute`)
- Test: `packages/orchestrator/tests/agents/database-wrapper.test.ts`

**Interfaces:**
- Consumes: `ctx.upstream['analysis-agent']` = `FrontendAnalysisResult`.
- Produces: files (`prisma/schema.prisma`, per-table query-builder/service files, pool config); `metadata.data = { schema: SchemaDefinition }` (executor assigns `ctx.dataModels`). Uses ONLY deterministic engine methods: `generatePrismaSchema`, `generateQueryBuilder`, `generateDatabaseService`, `generateConnectionPoolConfig`. Never calls `analyzeRequirements` (AI path).

- [ ] **Step 1: Write failing test**

`packages/orchestrator/tests/agents/database-wrapper.test.ts`:

`packages/orchestrator/tests/agents/database-wrapper.test.ts`:

```typescript
import { databaseAgentIAgent } from '@loveable/agents/core/database';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

describe('database wrapper consumes analysis', () => {
    it('builds schema FROM analysis models and emits prisma + services', async () => {
        const out = await databaseAgentIAgent.execute({
            task: 'generate database layer',
            context: { upstream: { 'analysis-agent': makeDemoAnalysis() } },
        });
        expect(out.success).toBe(true);
        const paths = (out.files ?? []).map(f => f.path);
        expect(paths).toContain('prisma/schema.prisma');

        const prisma = (out.files ?? []).find(f => f.path === 'prisma/schema.prisma')!.content;
        expect(prisma).toContain('model Product');
        expect(prisma).toContain('model Order');

        const data = out.metadata?.data as { schema: { tables: Array<{ name: string }> } };
        expect(data.schema.tables.map(t => t.name).sort()).toEqual(['order', 'product']);
    });

    it('fails cleanly without upstream analysis', async () => {
        const out = await databaseAgentIAgent.execute({ task: 'x', context: {} });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('MISSING_UPSTREAM');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/agents/database-wrapper.test.ts`
Expected: FAIL (current wrapper ignores context and uses hardcoded defaults).

- [ ] **Step 3: Rewrite execute()**

Replace the body of `execute` in `agents/core/database/database-agent-iagent.ts`:

```typescript
async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
        const analysis = ((input.context as Record<string, unknown> | undefined)?.upstream
            as Record<string, unknown> | undefined)?.['analysis-agent'] as
            import('../analysis/types').FrontendAnalysisResult | undefined;
        if (!analysis) {
            return { success: false, error: { code: 'MISSING_UPSTREAM', message: 'database agent requires upstream analysis-agent output' } };
        }

        // --- deterministic mapping: InferredModel[] -> SchemaDefinition ---
        const TYPE_MAP: Record<string, ColumnDataType> = {
            string: 'string', number: 'float', boolean: 'boolean', date: 'datetime',
            array: 'json', object: 'json', enum: 'enum', uuid: 'uuid',
            email: 'string', url: 'string', unknown: 'text',
        };
        const tableName = (m: string) => m.toLowerCase();

        const tables: TableDefinition[] = analysis.dataModels.map(model => ({
            name: tableName(model.name),
            timestamps: true,
            columns: model.fields.map(field => {
                const pk = field.name === (model.primaryKey ?? 'id');
                return {
                    name: field.name,
                    type: TYPE_MAP[field.type] ?? 'text',
                    nullable: field.optional === true && !pk,
                    primaryKey: pk,
                    ...(field.type === 'enum' && field.enumValues ? { enumValues: field.enumValues } : {}),
                };
            }),
        }));

        const relationships: RelationshipDefinition[] = [];
        for (const model of analysis.dataModels) {
            for (const rel of model.relationships) {
                relationships.push({
                    name: rel.fieldName,
                    type: rel.type,
                    fromTable: tableName(model.name),
                    fromColumn: `${tableName(rel.targetModel)}Id`,
                    toTable: tableName(rel.targetModel),
                    toColumn: 'id',
                });
            }
        }

        const schema: SchemaDefinition = { tables, relationships };

        // --- deterministic template generation ---
        const files = [this.agent.generatePrismaSchema(schema)];
        for (const table of tables) {
            files.push(this.agent.generateQueryBuilder(table));
            files.push(this.agent.generateDatabaseService(table));
        }
        files.push(this.agent.generateConnectionPoolConfig());

        return {
            success: true,
            files: files.map(f => ({ path: f.path, content: f.content, type: 'code' as const, language: 'typescript' })),
            message: `generated ${files.length} database files from ${tables.length} tables`,
            metadata: {
                executionTime: Date.now() - startTime,
                data: { schema },
                dependencies: ['prisma', '@prisma/client'],
                instructions: ['run: npx prisma generate', 'run: npx prisma migrate dev'],
            },
        };
    } catch (error) {
        return {
            success: false,
            error: { code: 'DATABASE_GENERATION_ERROR', message: error instanceof Error ? error.message : String(error) },
            metadata: { executionTime: Date.now() - startTime },
        };
    }
}
```

Add/extend imports at top of the file:

```typescript
import type { ColumnDataType, RelationshipDefinition, TableDefinition, SchemaDefinition } from './types.js';
```

Keep the class shell, id, healthCheck, initialize, shutdown as-is.

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/agents/database-wrapper.test.ts packages/orchestrator/tests/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/core/database/database-agent-iagent.ts packages/orchestrator/tests/agents/database-wrapper.test.ts
git commit -m "feat(agents): database wrapper derives schema from analysis"
```

---

### Task 10: Auth Agent wrapper upgrade

**Files:**
- Modify: `agents/core/auth/auth-agent-iagent.ts` (rewrite `execute`)
- Test: `packages/orchestrator/tests/agents/auth-wrapper.test.ts`

**Interfaces:**
- Consumes: `ctx.upstream['analysis-agent'].authStrategy`.
- Produces: auth files via `AuthAgent.generateAuthSystem(config)` (deterministic templates); `metadata.data = { provider }`.

Provider mapping (deterministic):

| detected provider | AuthConfig.provider |
|---|---|
| clerk | clerk |
| auth0 | auth0 |
| supabase | supabase |
| custom-jwt, session-based, passport, nextauth, firebase, none, unknown | custom |

Features base list: `['login','register','logout','forgot-password','reset-password','session','refresh-token']`; append `'oauth'` when `authStrategy.features.socialLogin`; append `'mfa'` when `features.mfa`.

- [ ] **Step 1: Write failing test**

`packages/orchestrator/tests/agents/auth-wrapper.test.ts`:

```typescript
import { authAgentIAgent } from '@loveable/agents/core/auth';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

describe('auth wrapper consumes analysis', () => {
    it('maps clerk detection to clerk provider generation', async () => {
        const out = await authAgentIAgent.execute({
            task: 'generate auth',
            context: { upstream: { 'analysis-agent': makeDemoAnalysis() } },
        });
        expect(out.success).toBe(true);
        expect((out.files ?? []).length).toBeGreaterThan(0);
        expect((out.metadata?.data as { provider: string }).provider).toBe('clerk');
    });

    it('falls back to custom when strategy says none', async () => {
        const analysis = makeDemoAnalysis();
        analysis.authStrategy.provider = 'none';
        const out = await authAgentIAgent.execute({
            task: 'generate auth',
            context: { upstream: { 'analysis-agent': analysis } },
        });
        expect(out.success).toBe(true);
        expect((out.metadata?.data as { provider: string }).provider).toBe('custom');
    });

    it('fails cleanly without upstream', async () => {
        const out = await authAgentIAgent.execute({ task: 'x', context: {} });
        expect(out.success).toBe(false);
        expect(out.error?.code).toBe('MISSING_UPSTREAM');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/agents/auth-wrapper.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite execute()**

```typescript
async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
        const analysis = ((input.context as Record<string, unknown> | undefined)?.upstream
            as Record<string, unknown> | undefined)?.['analysis-agent'] as
            import('../analysis/types').FrontendAnalysisResult | undefined;
        if (!analysis) {
            return { success: false, error: { code: 'MISSING_UPSTREAM', message: 'auth agent requires upstream analysis-agent output' } };
        }

        const PROVIDER_MAP: Record<string, 'clerk' | 'custom' | 'auth0' | 'supabase'> = {
            clerk: 'clerk', auth0: 'auth0', supabase: 'supabase',
            'custom-jwt': 'custom', 'session-based': 'custom', passport: 'custom',
            nextauth: 'custom', firebase: 'custom', none: 'custom', unknown: 'custom',
        };
        const f = analysis.authStrategy.features;
        const features: AuthFeature[] = [
            'login', 'register', 'logout', 'forgot-password', 'reset-password', 'session', 'refresh-token',
            ...(f.socialLogin ? ['oauth' as const] : []),
            ...(f.mfa ? ['mfa' as const] : []),
        ];

        const config: AuthConfig = { provider: PROVIDER_MAP[analysis.authStrategy.provider] ?? 'custom', features };
        const result = await this.agent.generateAuthSystem(config);

        return {
            success: true,
            files: result.files.map(file => ({
                path: file.path, content: file.content, type: 'code' as const, language: 'typescript',
            })),
            message: `generated ${result.files.length} auth files (${config.provider})`,
            metadata: {
                executionTime: Date.now() - startTime,
                data: { provider: config.provider },
                envVariables: result.envVariables,
                instructions: result.instructions,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: { code: 'AUTH_GENERATION_ERROR', message: error instanceof Error ? error.message : String(error) },
            metadata: { executionTime: Date.now() - startTime },
        };
    }
}
```

Extend imports: `import type { AuthFeature } from './auth-agent.js';` alongside the existing `AuthConfig` import. Keep class shell/id/healthCheck intact.

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/agents/auth-wrapper.test.ts packages/orchestrator/tests/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/core/auth/auth-agent-iagent.ts packages/orchestrator/tests/agents/auth-wrapper.test.ts
git commit -m "feat(agents): auth wrapper maps detected strategy to provider"
```

---

### Task 11: API Agent wrapper upgrade

**Files:**
- Modify: `agents/core/api/api-agent-iagent.ts` (rewrite `execute`)
- Test: `packages/orchestrator/tests/agents/api-wrapper.test.ts`

**Interfaces:**
- Consumes: `ctx.upstream['analysis-agent']` (model names drive resource extraction).
- Produces: router/middleware/openapi files via `APIAgent.generate(userRequest)` — its internal `analyzeRequirements` is regex-based and deterministic (verified: `api-agent.ts:405-420`). `metadata.data = APIGenerationResult`.

Request string construction (feeds the engine's resource regexes):

```typescript
const modelNames = analysis.dataModels.map(m => m.name).join(' ');
const userRequest = `${ctx.requestName} backend with ${modelNames}`.toLowerCase();
```

- [ ] **Step 1: Write failing test**

`packages/orchestrator/tests/agents/api-wrapper.test.ts`:

```typescript
import { apiAgentIAgent } from '@loveable/agents/core/api';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

describe('api wrapper consumes analysis', () => {
    it('generates routers for detected resources plus middleware', async () => {
        const out = await apiAgentIAgent.execute({
            task: 'generate api',
            context: { upstream: { 'analysis-agent': makeDemoAnalysis() }, requestName: 'mini commerce' },
        });
        expect(out.success).toBe(true);
        const paths = (out.files ?? []).map(f => f.path);
        expect(paths.some(p => p.startsWith('src/routes/'))).toBe(true);
        expect(paths).toContain('src/middleware/error-handler.ts');

        const data = out.metadata?.data as { endpoints: number };
        expect(data.endpoints).toBeGreaterThan(0);
    });

    it('still succeeds (middleware-only) when no known resources match', async () => {
        const analysis = makeDemoAnalysis();
        analysis.dataModels = [];   // no product/order words -> no CRUD routers
        const out = await apiAgentIAgent.execute({
            task: 'generate api',
            context: { upstream: { 'analysis-agent': analysis }, requestName: 'weird project' },
        });
        expect(out.success).toBe(true);
        expect((out.files ?? []).length).toBeGreaterThan(0);   // middleware + docs still emitted
    });
});
```

Note: executor injects `context.requestName` too — extend the executor's input construction (Task 5 file, one-line change):
`{ task: ..., requestName: ctx.requestName, context: { upstream: ctx.upstream } }`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/agents/api-wrapper.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite execute()**

```typescript
async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
        const ctx = (input.context as Record<string, unknown> | undefined) ?? {};
        const upstream = ctx.upstream as Record<string, unknown> | undefined;
        const analysis = upstream?.['analysis-agent'] as
            import('../../core/analysis/types').FrontendAnalysisResult | undefined;
        const requestName = (ctx.requestName as string | undefined) ?? 'project';

        const modelNames = analysis?.dataModels.map(m => m.name).join(' ') ?? '';
        const userRequest = `${requestName} backend with ${modelNames}`.toLowerCase();

        const result = await this.agent.generate(userRequest);

        return {
            success: true,
            files: result.files.map(file => ({
                path: file.path,
                content: file.content,
                type: (file.type === 'documentation' ? 'doc' : 'code') as 'doc' | 'code',
                language: 'typescript',
            })),
            message: `generated ${result.files.length} API files (${result.endpoints} endpoints)`,
            metadata: { executionTime: Date.now() - startTime, data: result },
        };
    } catch (error) {
        return {
            success: false,
            error: { code: 'API_GENERATION_ERROR', message: error instanceof Error ? error.message : String(error) },
            metadata: { executionTime: Date.now() - startTime },
        };
    }
}
```

Adjust the relative import path to the actual location (`../../core/analysis/types` vs `../analysis/types`) depending on this wrapper's folder depth.

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/agents/api-wrapper.test.ts packages/orchestrator/tests/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/core/api/api-agent-iagent.ts packages/orchestrator/tests/agents/api-wrapper.test.ts
git commit -m "feat(pipeline): api wrapper feeds analysis resources to deterministic generator"
```

Also apply the one-line executor change from the note above and rerun `npx jest packages/orchestrator/tests/executor.test.ts` (must stay PASS), then amend the same commit:

```bash
git add packages/orchestrator/src/pipeline/executor.ts
git commit --amend --no-edit
```

---

### Task 12: Security Agent wrapper upgrade

**Files:**
- Modify: `agents/core/security/security-agent-iagent.ts` (small `execute` extension)
- Test: `packages/orchestrator/tests/agents/security-wrapper.test.ts`

**Interfaces:**
- Consumes: `ctx.upstream['api-agent']` (endpoint count) and `ctx.upstream['auth-agent']` (provider) — both guaranteed present by DAG order.
- Produces: existing security middleware files (unchanged behavior); enriched `metadata.data = { securedEndpoints, authProvider }`.

- [ ] **Step 1: Write failing test**

`packages/orchestrator/tests/agents/security-wrapper.test.ts`:

```typescript
import { securityAgentIAgent } from '@loveable/agents/core/security';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

const upstream = () => ({
    'analysis-agent': makeDemoAnalysis(),
    'api-agent': { success: true, files: [], routers: ['productsRouter'], endpoints: 5 },
    'auth-agent': { provider: 'clerk' },
});

describe('security wrapper consumes upstream', () => {
    it('reports secured endpoints and auth provider in metadata', async () => {
        const out = await securityAgentIAgent.execute({ task: 'secure it', context: { upstream: upstream() } });
        expect(out.success).toBe(true);
        expect((out.files ?? []).length).toBeGreaterThan(0);
        const data = out.metadata?.data as { securedEndpoints: number; authProvider: string };
        expect(data.securedEndpoints).toBe(5);
        expect(data.authProvider).toBe('clerk');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/agents/security-wrapper.test.ts`
Expected: FAIL — current wrapper has no upstream awareness.

- [ ] **Step 3: Extend execute() minimally**

Inside the existing `try` block of `SecurityAgentWrapper.execute`, before building `return`:

```typescript
const upstream = ((input.context as Record<string, unknown> | undefined)?.upstream
    ?? {}) as Record<string, any>;
const securedEndpoints = Number(upstream['api-agent']?.endpoints ?? 0);
const authProvider = String(upstream['auth-agent']?.provider ?? 'custom');
```

And change the success `metadata` to include:

```typescript
metadata: {
    executionTime,
    data: { securedEndpoints, authProvider },
    dependencies: result.dependencies,
    envVariables: result.envVariables,
    instructions: result.instructions,
},
```

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/agents/security-wrapper.test.ts packages/orchestrator/tests/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/core/security/security-agent-iagent.ts packages/orchestrator/tests/agents/security-wrapper.test.ts
git commit -m "feat(agents): security wrapper reports secured surface area"
```

---

### Task 13: Codegen + Test wrapper upgrades

**Files:**
- Modify: `agents/support/codegen/index.ts` (only the `execute` method of `CodegenAgent` — do NOT touch templates/exports)
- Modify: `agents/support/test/test-agent-iagent.ts` (rewrite `execute`)
- Test: `packages/orchestrator/tests/agents/codegen-wrapper.test.ts`, `packages/orchestrator/tests/agents/test-wrapper.test.ts`

**Interfaces:**
- Codegen consumes: `ctx.upstream['analysis-agent'].dataModels` + `ctx.upstream['database-agent']` (dependency lists) + `ctx.requestName`. Produces deterministic scaffold files (`package.json`, `tsconfig.json`, `README.md`) built by the WRAPPER itself — deliberately NOT via engine AI paths (`analyzeRequirements`/`generateCode` may invoke ChatGroq).
- Test consumes: `ctx.files` (route/service files produced upstream). Produces: `vitest.config.ts`, `tests/setup.ts`, one smoke spec — via engine's own `generateVitestConfig`/`generateTestSetup` plus a locally-built spec. Never calls `generateUnitTests` (AI path).

- [ ] **Step 1: Write failing codegen test**

`packages/orchestrator/tests/agents/codegen-wrapper.test.ts`:

```typescript
import { codegenAgent } from '@loveable/agents/support/codegen';
import { makeDemoAnalysis } from '../../src/pipeline/demo-analysis';

describe('codegen wrapper scaffolds from context', () => {
    it('emits package.json/tsconfig with project name and prisma dep', async () => {
        await codegenAgent.initialize({});
        const out = await codegenAgent.execute({
            task: 'scaffold project',
            requestName: 'mini-commerce',
            context: {
                upstream: {
                    'analysis-agent': makeDemoAnalysis(),
                    'database-agent': { schema: {}, dependencies: ['prisma', '@prisma/client'] },
                },
            },
        });
        expect(out.success).toBe(true);
        const byPath = new Map((out.files ?? []).map(f => [f.path, f.content]));
        expect(byPath.get('package.json')).toContain('"name": "mini-commerce"');
        expect(byPath.get('package.json')).toContain('prisma');
        expect(byPath.get('tsconfig.json')).toContain('"strict": true');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/agents/codegen-wrapper.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace CodegenAgent.execute body**

Replace ONLY the body of `execute` in `agents/support/codegen/index.ts`:

```typescript
async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
        const ctx = (input.context as Record<string, unknown> | undefined) ?? {};
        const upstream = (ctx.upstream ?? {}) as Record<string, any>;
        const requestName = (input.requestName as string | undefined)
            ?? (ctx.requestName as string | undefined) ?? 'generated-backend';

        const dbDeps: string[] = upstream['database-agent']?.dependencies ?? [];
        const deps = ['express', 'cors', 'dotenv', ...dbDeps];

        const pkg = {
            name: requestName.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
            version: '0.1.0',
            private: true,
            scripts: { dev: 'tsx src/index.ts', build: 'tsc' },
            dependencies: Object.fromEntries(deps.map(d => [d, 'latest'])),
        };
        const tsconfig = { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, outDir: 'dist' }, include: ['src'] };
        const readme = [
            `# ${requestName}`,
            '',
            'Generated by Meteoroid deterministic agent pipeline.',
            '',
            '## Setup',
            '```bash',
            'npm install',
            'npx prisma generate   # if prisma is present',
            'npm run dev',
            '```',
        ].join('\n');

        const mk = (path: string, content: string, type: GeneratedFile['type']): GeneratedFile =>
            ({ path, content, type });

        return {
            success: true,
            files: [
                mk('package.json', JSON.stringify(pkg, null, 2), 'config'),
                mk('tsconfig.json', JSON.stringify(tsconfig, null, 2), 'config'),
                mk('README.md', readme, 'doc'),
            ],
            message: `scaffolded ${requestName}`,
            metadata: { executionTime: Date.now() - startTime },
        };
    } catch (error) {
        return {
            success: false,
            error: { code: 'CODEGEN_ERROR', message: error instanceof Error ? error.message : String(error) },
            metadata: { executionTime: Date.now() - startTime },
        };
    }
}
```

If `GeneratedFile`/`AgentInput`/`AgentOutput` type names differ in this file's existing imports (it already imports them), reuse those; do not add duplicates.

- [ ] **Step 4: Write failing test-agent test**

`packages/orchestrator/tests/agents/test-wrapper.test.ts`:

```typescript
import { testAgentIAgent } from '@loveable/agents/support/test';

const ctxWithFiles = () => new Map([
    ['src/routes/products.ts', { path: 'src/routes/products.ts', content: 'export const productsRouter = 1;', type: 'code' as const }],
    ['src/routes/orders.ts', { path: 'src/routes/orders.ts', content: 'export const ordersRouter = 1;', type: 'code' as const }],
]);

describe('test wrapper consumes pipeline files', () => {
    it('emits vitest config, setup and a smoke spec naming real routes', async () => {
        await testAgentIAgent.initialize({});
        const out = await testAgentIAgent.execute({
            task: 'test it',
            context: { files: ctxWithFiles(), upstream: {} },
        });
        expect(out.success).toBe(true);
        const paths = (out.files ?? []).map(f => f.path);
        expect(paths).toContain('vitest.config.ts');
        expect(paths).toContain('tests/setup.ts');
        const spec = (out.files ?? []).find(f => f.path === 'tests/smoke.test.ts')!.content;
        expect(spec).toContain('products');
        expect(spec).toContain('orders');
    });
});
```

Note: executor currently passes only `{ upstream }` as input.context. Extend executor input construction to also pass the live file map:
`context: { upstream: ctx.upstream, files: ctx.files }` (one-line change, same commit).

- [ ] **Step 5: Run to verify failure**

Run: `npx jest packages/orchestrator/tests/agents/test-wrapper.test.ts`
Expected: FAIL.

- [ ] **Step 6: Rewrite TestAgentWrapper.execute**

In `agents/support/test/test-agent-iagent.ts` replace the execute body (keep class shell/id/health):

```typescript
async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
        const ctx = (input.context as Record<string, unknown> | undefined) ?? {};
        const files = (ctx.files as Map<string, { path: string }> | undefined) ?? new Map();
        const routeFiles = [...files.keys()].filter(p => p.startsWith('src/routes/'));

        await this.agent.initialize();
        const config = { framework: 'vitest' as never, testType: 'unit' as never, coverage: false };
        const vitestConfig = this.agent.generateVitestConfig(config);
        const setup = this.agent.generateTestSetup();

        const imports = routeFiles.map(p => {
            const name = p.split('/').pop()!.replace('.ts', '');
            return `import * as ${name} from '../../${p.replace(/\.ts$/, '')}';`;
        }).join('\n');
        const assertions = routeFiles.map(p => {
            const name = p.split('/').pop()!.replace('.ts', '');
            return `describe('${name}', () => { it('module loads', () => expect(${name}).toBeDefined()); });`;
        }).join('\n');
        const spec = `${imports}\n\n${assertions || "it('pipeline produced no routes', () => expect(true).toBe(true));"}\n`;

        const mk = (path: string, content: string): GeneratedFile => ({ path, content, type: 'code' as const });
        return {
            success: true,
            files: [
                mk('vitest.config.ts', vitestConfig),
                mk('tests/setup.ts', setup),
                mk('tests/smoke.test.ts', spec),
            ],
            message: `generated test scaffolding for ${routeFiles.length} route modules`,
            metadata: { executionTime: Date.now() - startTime, data: { totalTests: Math.max(routeFiles.length, 1) } },
        };
    } catch (error) {
        return {
            success: false,
            error: { code: 'TEST_GENERATION_ERROR', message: error instanceof Error ? error.message : String(error) },
            metadata: { executionTime: Date.now() - startTime },
        };
    }
}
```

Adjust the existing import of `GeneratedFile` (from `./types.js`) to match what that file already imports; if its local `types.ts` lacks `GeneratedFile`, use `import type { GeneratedFile } from '@loveable/shared';`.

- [ ] **Step 7: Apply executor change + run all agent tests green**

Executor input construction becomes:
```typescript
const input: AgentInput = {
    task: `${id} for ${ctx.requestName}`,
    requestName: ctx.requestName,
    context: { upstream: ctx.upstream, files: ctx.files },
};
```

Run: `npx jest packages/orchestrator/tests`
Expected: ALL PASS (executor suite included — its mocks tolerate extra context keys unchanged).

- [ ] **Step 8: Commit**

```bash
git add agents/support/codegen/index.ts agents/support/test/test-agent-iagent.ts packages/orchestrator/src/pipeline/executor.ts packages/orchestrator/tests/agents
git commit -m "feat(agents): codegen scaffold + test scaffolding consume pipeline state"
```

---

### Task 14: Six stub wrappers

**Files (modify each `execute` only):**
- `agents/core/monitoring/monitoring-agent-iagent.ts` → file `src/monitoring/health-route.ts`
- `agents/core/queue/queue-agent-iagent.ts` → file `src/queue/queue-setup.ts`
- `agents/specialized/cicd/cicd-agent-iagent.ts` → file `.github/workflows/ci.yml`
- `agents/specialized/infra/infra-agent-iagent.ts` → file `Dockerfile`
- `agents/specialized/microservice/microservice-agent-iagent.ts` → file `src/microservices/service-map.json`
- `agents/support/email/email-agent-iagent.ts` → file `src/email/mailer.ts`
- Test: `packages/orchestrator/tests/agents/stubs.test.ts`

**Interfaces:**
- Every stub: `execute` returns success, exactly its 1–2 fixed files, `metadata.data = { stub: true }`. No engine calls. Content per file is a small hardcoded template (below).

- [ ] **Step 1: Write failing stub tests**

`packages/orchestrator/tests/agents/stubs.test.ts`:

```typescript
import { monitoringAgentIAgent } from '@loveable/agents/core/monitoring';
import { queueAgentIAgent } from '@loveable/agents/core/queue';
import { cicdAgentIAgent } from '@loveable/agents/specialized/cicd';
import { infraAgentIAgent } from '@loveable/agents/specialized/infra';
import { microserviceAgentIAgent } from '@loveable/agents/specialized/microservice';
import { emailAgentIAgent } from '@loveable/agents/support/email';

const CASES: Array<[string, { execute(i: unknown): Promise<{ success: boolean; files?: Array<{ path: string }> ; metadata?: { data?: { stub?: boolean } } }> }, string]> = [
    ['monitoring', monitoringAgentIAgent, 'src/monitoring/health-route.ts'],
    ['queue', queueAgentIAgent, 'src/queue/queue-setup.ts'],
    ['cicd', cicdAgentIAgent, '.github/workflows/ci.yml'],
    ['infra', infraAgentIAgent, 'Dockerfile'],
    ['microservice', microserviceAgentIAgent, 'src/microservices/service-map.json'],
    ['email', emailAgentIAgent, 'src/email/mailer.ts'],
];

describe('stub agents', () => {
    for (const [label, agent, expectedPath] of CASES) {
        it(`${label} produces its fixed stub file flagged stub:true`, async () => {
            await agent.initialize({} as never);
            const out = await agent.execute({ task: label, context: { upstream: {} } } as never);
            expect(out.success).toBe(true);
            expect((out.files ?? []).map(f => f.path)).toContain(expectedPath);
            expect((out.metadata?.data as { stub?: boolean }).stub).toBe(true);
        });
    }
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npx jest packages/orchestrator/tests/agents/stubs.test.ts`
Expected: FAIL (stubs don't emit these paths yet).

- [ ] **Step 3: Rewrite each stub's execute()**

Identical pattern per stub — replace each wrapper's `execute` body with (swap STUB_PATH/CONTENT constants per table above):

```typescript
async execute(_input: AgentInput): Promise<AgentOutput> {
    const STUB_PATH = 'src/monitoring/health-route.ts';
    const CONTENT = [
        "// STUB — full implementation pending",
        "import express from 'express';",
        '',
        'export function registerHealthRoute(app: express.Express): void {',
        "  app.get('/health', (_req, res) => res.json({ status: 'ok' }));",
        '}',
        '',
    ].join('\n');
    return {
        success: true,
        files: [{ path: STUB_PATH, content: CONTENT, type: 'code' as const }],
        message: 'stub output (full implementation pending)',
        metadata: { data: { stub: true } },
    };
}
```

Contents for the other five (keep each ≤ ~15 lines, clearly marked `// STUB` / `# STUB`):

- queue `src/queue/queue-setup.ts`: exports `createQueue(name)` returning `{ name, jobs: [] as unknown[] , add(job: unknown){ this.jobs.push(job); } }` typed loosely.
- cicd `.github/workflows/ci.yml`: YAML with `name: CI`, `on: [push]`, one `npm install && npm test` step.
- infra `Dockerfile`: `FROM node:20-alpine`, `WORKDIR /app`, `COPY . .`, `RUN npm install`, `CMD ["npm","run","dev"]`.
- microservice `src/microservices/service-map.json`: `{ "services": [{ "name": "api", "type": "monolith-module" }] }`.
- email `src/email/mailer.ts`: exports async `sendEmail(to: string, subject: string)` logging and resolving `{ delivered: true }`.

Keep each class shell, id, tier, healthCheck untouched. Remove now-unused heavy imports only if the file stops compiling otherwise.

- [ ] **Step 4: Run until green**

Run: `npx jest packages/orchestrator/tests/agents/stubs.test.ts packages/orchestrator/tests/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/core/monitoring agents/core/queue agents/specialized agents/support/email packages/orchestrator/tests/agents/stubs.test.ts
git commit -m "feat(agents): six stub wrappers emit minimal flagged outputs"
```

---

### Task 15: CLI + demo end-to-end

**Files:**
- Create: `packages/orchestrator/src/pipeline/index.ts`, `packages/orchestrator/src/cli.ts`
- Modify: root `package.json` (add script)
- Test: `packages/orchestrator/tests/cli.e2e.test.ts`

**Interfaces:**
- Produces:

```typescript
// pipeline/index.ts — barrel
export * from './types';
export * from './planner';
export * from './context';
export * from './registry';
export * from './executor';
export * from './writer';
export * from './reporter';
export * from './demo-analysis';

// cli.ts
export interface RunOptions {
    mode: 'demo' | 'analysis';
    analysisPath?: string;     // required when mode=analysis
    outDir: string;            // e.g. generated-backend/mini-commerce
    requestName: string;
}
export interface RunOutcome extends RunResult {
    written: number;
    reportPath: string;
}
export async function runPipeline(opts: RunOptions): Promise<RunOutcome>;
// CLI main(): parses argv (--demo | --analysis <path> | --out <dir> | --name <str>),
// calls runPipeline, prints reporter.renderReport, sets process.exitCode.
```

- [ ] **Step 1: Implement pipeline barrel** (`index.ts` contents exactly as above).

- [ ] **Step 2: Implement runPipeline + CLI**

`packages/orchestrator/src/cli.ts`:

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { buildDefaultRegistry } from './pipeline/registry';
import { planLevels } from './pipeline/planner';
import { DEPENDENCIES } from './pipeline/dependencies';
import { createContext } from './pipeline/context';
import { executePlan } from './pipeline/executor';
import { writeFiles } from './pipeline/writer';
import { renderReport, writeReportJson } from './pipeline/reporter';
import { makeDemoAnalysis } from './pipeline/demo-analysis';
import type { RunResult } from './pipeline/types';

export interface RunOptions {
    mode: 'demo' | 'analysis';
    analysisPath?: string;
    outDir: string;
    requestName: string;
}

export interface RunOutcome extends RunResult {
    written: number;
    reportPath: string;
}

export async function runPipeline(opts: RunOptions): Promise<RunOutcome> {
    let analysisJson: unknown;
    if (opts.mode === 'demo') {
        analysisJson = makeDemoAnalysis();
    } else {
        if (!opts.analysisPath) throw new Error('--analysis requires a file path');
        analysisJson = JSON.parse(await fs.readFile(opts.analysisPath, 'utf8'));
    }

    const registry = buildDefaultRegistry();
    const health = await registry.initializeAll();
    const levels = planLevels(DEPENDENCIES);
    const ctx = createContext(opts.requestName);
    ctx.analysisJson = analysisJson;

    const run = await executePlan(levels, registry, ctx, { deps: DEPENDENCIES, health });
    await fs.mkdir(path.join(opts.outDir), { recursive: true });
    const summary = await writeFiles(ctx.files, opts.outDir);
    const reportPath = await writeReportJson(run, path.join(opts.outDir));
    return { ...run, written: summary.written, reportPath };
}
```

Two supporting changes referenced by this function — apply them as part of this task:

1. Add optional field to `PipelineContextData` (`pipeline/context.ts`, Task 3 file):
   `analysisJson?: unknown;`

2. In `AnalysisLoaderAgent.execute` (Task 8), read the JSON from that field:
   ```typescript
   const c = input.context as Record<string, unknown> | undefined;
   ```
   stays as-is for wrapper tests (they pass `{ context: { analysisJson: json } }`),
   but `runPipeline` sets it on the shared ctx object, so executor must forward it.
   Extend the executor's input construction (Task 5 file):
   ```typescript
   const input: AgentInput = {
       task: `${id} for ${ctx.requestName}`,
       requestName: ctx.requestName,
       context: { upstream: ctx.upstream, files: ctx.files, analysisJson: ctx.analysisJson },
   };
   ```

Continue in the same file:

```typescript
function parseArgv(argv: string[]): RunOptions & { help?: boolean } {
    const opts = { mode: 'demo' as 'demo' | 'analysis', outDir: 'generated-backend/demo', requestName: 'demo-backend', help: false, analysisPath: undefined as string | undefined };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--demo') opts.mode = 'demo';
        else if (arg === '--analysis') { opts.mode = 'analysis'; opts.analysisPath = argv[++i]; }
        else if (arg === '--out') opts.outDir = argv[++i];
        else if (arg === '--name') opts.requestName = argv[++i];
        else if (arg === '--help' || arg === '-h') opts.help = true;
    }
    return opts;
}

export async function main(): Promise<void> {
    const argv = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['--demo'];
    const opts = parseArgv(['node', 'cli', ...argv]);
    if (opts.help) {
        console.log('Usage: npm run agents -- [--demo | --analysis <file>] [--out <dir>] [--name <str>]');
        return;
    }
    try {
        const outcome = await runPipeline(opts);
        console.log(renderReport(outcome, DEPENDENCIES));
        console.log(`\n📁 Output: ${opts.outDir} (${outcome.written} files)`);
        console.log(`📄 Report: ${outcome.reportPath}`);
        process.exitCode = outcome.exitCode;
    } catch (err) {
        console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 2;
    }
}

if (require.main === module) {
    void main();
}
```

Root `package.json` scripts addition:

```json
"agents": "tsx packages/orchestrator/src/cli.ts"
```

- [ ] **Step 3: Write failing e2e test**

`packages/orchestrator/tests/cli.e2e.test.ts`:

```typescript
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runPipeline } from '../src/cli';

function tmpOut(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), 'meteoroid-e2e-'));
}

describe('runPipeline end-to-end (demo mode)', () => {
    it('runs all 13 agents green and materializes the backend', async () => {
        const out = await tmpOut();
        const outcome = await runPipeline({
            mode: 'demo', outDir: path.join(out, 'backend'), requestName: 'mini-commerce',
        });
        expect(outcome.exitCode).toBe(0);
        expect(outcome.results.filter(r => r.status === 'success')).toHaveLength(13);

        const prisma = await fs.readFile(path.join(out, 'backend/prisma/schema.prisma'), 'utf8');
        expect(prisma).toContain('model Product');
        expect(prisma).toContain('model Order');
        expect(await fs.stat(path.join(out, 'backend/package.json'))).toBeTruthy();
        expect(await fs.stat(path.join(out, 'backend/.github/workflows/ci.yml'))).toBeTruthy();

        const report = JSON.parse(await fs.readFile(outcome.reportPath, 'utf8'));
        expect(report.results).toHaveLength(13);
    }, 120_000);

    it('fails fatally (exit 2 semantics via throw) on missing analysis file', async () => {
        const out = await tmpOut();
        await expect(runPipeline({
            mode: 'analysis', analysisPath: path.join(out, 'nope.json'), outDir: path.join(out, 'b'), requestName: 'x',
        })).rejects.toThrow(/ENOENT/);
    }, 30_000);
});
```

- [ ] **Step 4: Run e2e until green**

Run: `npx jest packages/orchestrator/tests/cli.e2e.test.ts`
Expected: PASS (2 tests). If an individual agent fails here, its row in the thrown/final report names the cause — fix THAT agent's wrapper, not the pipeline.

- [ ] **Step 5: Full suite + manual smoke**

```bash
npx jest packages/orchestrator/tests
```
Expected: all suites PASS.
Manual:
```bash
npx tsx packages/orchestrator/src/cli.ts --demo --out generated-backend/demo-run --name demo-backend; echo "exit=$?"
```
Expected: printed table shows 13 ✅ rows, `exit=0`, files under `generated-backend/demo-run/`.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/pipeline/index.ts packages/orchestrator/src/cli.ts package.json packages/orchestrator/tests/cli.e2e.test.ts
git commit -m "feat(pipeline): npm run agents CLI with demo mode, e2e verified"
```

---

### Task 16: Consolidation cleanup + final verification

**Files:**
- Delete: `agents/core/auth/auth-agent-enhanced.ts`, `agents/core/monitoring/monitoring-agent-enhanced.ts`
- Modify: `agents/core/auth/index.ts`, `agents/core/monitoring/index.ts`, `agents/index.ts` (remove Enhanced export blocks)

- [ ] **Step 1: Find every reference to Enhanced variants**

Run: `grep -rn "Enhanced" agents --include="*.ts" | grep -v node_modules | grep -v "\.map"`
Expected: only the two variant files themselves + their export lines in `agents/core/auth/index.ts`, `agents/core/monitoring/index.ts`, `agents/index.ts`.

- [ ] **Step 2: Merge-or-delete decision per file**

For each Enhanced file, scan for unique template constants or methods NOT present in the base engine (`grep -E "^export const|    async |    [a-zA-Z]+\(" <enhanced-file>`). Anything unique and valuable: copy into the base engine file next to its counterpart. If nothing unique: delete outright. Record the outcome in the commit message ("merged X, deleted Y").

- [ ] **Step 3: Delete variants + strip barrels**

Remove the two files and delete their export blocks from the three barrels listed above. Do not touch other exports.

- [ ] **Step 4: Verify nothing broke**

```bash
grep -rn "Enhanced" agents --include="*.ts" | grep -v node_modules
```
Expected: no output.
```bash
npx jest packages/orchestrator/tests
```
Expected: all suites PASS (registry proves barrels still load).

- [ ] **Step 5: Final manual acceptance run**

```bash
rm -rf generated-backend/acceptance && npx tsx packages/orchestrator/src/cli.ts --demo --out generated-backend/acceptance --name acceptance && echo EXIT=$?
find generated-backend/acceptance -type f | head -40
```
Expected: `EXIT=0`; ≥ 20 files including `prisma/schema.prisma`, `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`, `Dockerfile`, `run-report.json`.

- [ ] **Step 6: Commit**

```bash
git add -A agents
git commit -m "chore(agents): consolidate enhanced variants into canonical wrappers"
```

---

## Plan Self-Review Notes (for the executor)

- Spec §4 dependency rule holds: pipeline imports agents only; Tasks 9–14 modify wrappers but they never import `pipeline`.
- Spec §5 DAG matches `DEPENDENCIES` exactly (incl. stub tier depending on codegen).
- Spec §7 exit codes implemented in `executePlan` + `main`.
- Known deliberate deviations from earlier prose (both YAGNI, recorded here so reviewers don't flag them):
  1. `apiRoutes` field dropped from PipelineContext — APIGenerationResult already carries routers/endpoints via `ctx.apiResult` + `ctx.upstream`.
  2. Codegen wrapper bypasses its engine's AI-capable methods entirely and emits deterministic scaffold files itself (Global Constraint: no LLM calls).
- Type-name cross-check performed: `ColumnDataType`, `TableDefinition`, `RelationshipDefinition`, `SchemaDefinition`, `AuthFeature`, `AuthConfig`, `APIGenerationResult`, `RouterDefinition` (unused now), `TestConfig` members verified against source files during planning.
