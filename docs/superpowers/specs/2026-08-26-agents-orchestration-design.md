# Meteoroid — Deterministic Agent Pipeline & Orchestration Design

**Date:** 2026-08-26
**Status:** Approved design (pending implementation plan)
**Scope:** New deterministic orchestration core + agent consolidation; CLI-driven, no API server or database dependency.

---

## 1. Context & Current State

Meteoroid is an AI-driven multi-agent system that generates backends. The repo is in a
transition phase with three separate orchestration implementations:

1. `packages/orchestrator` — LangGraph supervisor graph where an **LLM routes agents**
   (`nodes/supervisor.ts`). Requires `OPENAI_API_KEY` to route at all; worker nodes
   re-describe capabilities in prompts rather than delegating to the real agent
   implementations; module imports have console-art side effects.
2. `packages/api/src/application/services/orchestration/` — integrated/multi-model
   orchestrators coupled to the Fastify server and database (currently broken /
   migration pending per `report.md`).
3. `agents/support/codegen/orchestrator.ts` — codegen-local pipeline.

Agent inventory (`agents/`, ~26k lines): nearly every folder has a substantial engine file
(`security-agent.ts` 1642 lines, `database-agent.ts` 1233, etc.) plus a small
`*-iagent.ts` wrapper implementing the shared `IAgent` interface
(`packages/shared/src/interfaces/IAgent.ts`). Two `-enhanced` variants exist
(auth, monitoring). Known gap: **wrappers ignore their input** — they generate from
hardcoded defaults and never consume upstream agents' output, so there is no real
coordination today.

## 2. Goals & Non-Goals

### Goals
- A deterministic orchestration layer where coordination is **code, not an LLM**: a
  dependency DAG of agents executed with parallel-within-level semantics.
- All agents coordinate through typed shared state: downstream agents consume upstream
  outputs.
- Retry → degrade → report failure policy; a run never hard-dies except for fatal setup
  errors.
- CLI entry point that works **today** with zero API keys, zero services: `npm run agents`.
- Consolidate each agent folder to one canonical registered implementation.

### Non-Goals (this iteration)
- Fixing the Fastify API server, Convex/Supabase migration, or DI bindings.
- LLM-driven routing / "smart planner" mode (future extension — planner is swappable).
- Dynamic agent file loading (static registration is sufficient).
- Touching the frozen LangGraph supervisor path beyond removing it as an entry point.
- Fully implementing the 6 stub-tier agents.

## 3. Decisions (agreed with product owner)

| Question | Decision |
|---|---|
| Entry point | CLI-driven pipeline; no API/DB dependency |
| Roster | 7 full agents (Analysis, Database, API, Auth, Security, Codegen, Test) + 6 stubs (Monitoring, Queue, CICD, Infra, Microservice, Email) |
| Output generation | Templates do the heavy lifting; LLM optional (Analysis only) |
| Failure policy | Retry → degrade → per-agent report |
| Existing code | Consolidate in place; salvage engines/templates; delete dead variants |

## 4. Architecture & Project Structure

New orchestration core lives inside `packages/orchestrator/src/pipeline/`, alongside —
not entangled with — the old LangGraph code:

```
packages/orchestrator/src/
├── pipeline/
│   ├── types.ts          # PlanLevel, RunResult, AgentStatus, PipelineError, ...
│   ├── registry.ts       # AgentRegistry — instantiates & holds all canonical agents
│   ├── dependencies.ts   # Central DAG declaration: id → { dependsOn, timeoutMs }
│   ├── planner.ts        # Validates DAG, orders into execution levels
│   ├── executor.ts       # Runs levels; parallel within level; retry/degrade
│   ├── context.ts        # PipelineContext — typed shared state
│   ├── reporter.ts       # Console table + run-report.json
│   └── index.ts
├── cli.ts                # Thin entry point (npm run agents)
├── graph.ts, nodes/, core/   # FROZEN LangGraph supervisor — no longer an entry point
```

### Agent consolidation rules
- Each folder keeps its engine file (`*-agent.ts`) — the valuable brains.
- The `*-iagent.ts` wrapper is the **single canonical registered implementation**.
- `-enhanced` variants (`auth-agent-enhanced.ts`, `monitoring-agent-enhanced.ts`):
  merge unique value into base engine, then delete.
- Wrappers are upgraded to read upstream results from `PipelineContext` instead of
  hardcoded defaults.

### Dependency rule
`pipeline` statically imports agents via `agents/index.ts`. Agents never import the
pipeline. One-way edge, no cycles.

## 5. Core Components

1. **`AgentRegistry`** — instantiates all 13 agents, exposes `get(id)` / `all()`;
   static imports only.
2. **`dependencies.ts`** — one central map defining the coordination contract:
   `agentId → { dependsOn: AgentId[], timeoutMs }`.

   ```
   analysis    → []                        (root)
   database    → [analysis]
   api         → [database]
   auth        → [database]
   security    → [api, auth]
   codegen     → [api, auth, security]
   test        → [codegen]
   monitoring  → [codegen]   (stub)
   queue       → [codegen]   (stub)
   cicd        → [codegen]   (stub)
   infra       → [codegen]   (stub)
   microservice→ [codegen]   (stub)
   email       → [codegen]   (stub)
   ```
3. **`Planner`** — topological sort into execution levels (level 0: analysis;
   level 1: database; level 2: api+auth parallel; level 3: security; level 4: codegen;
   level 5: test + stubs). Fails fast on cycles or unknown references before anything runs.
4. **`PipelineContext`** — typed shared state; the fix that makes coordination real:

   ```ts
   interface PipelineContext {
       requestName: string;
       analysis?: AnalysisResult;
       dataModels?: SchemaDefinition;
       apiRoutes?: RouteSpec[];
       authSetup?: AuthPlan;
       securityConfig?: SecurityPlan;
       files: Map<string, GeneratedFile>;
       errors: PipelineError[];
   }
   ```

5. **`Executor`** — runs level by level; within a level `Promise.allSettled` (all reads
   come from completed upstream levels, so intra-level parallelism is safe). Owns retry,
   timeouts, degrade cascade, context merging.
6. **`Reporter`** — prints per-agent table (status ✅/⚠️/⏭️, duration, files produced,
   error summary) and writes `run-report.json`.

## 6. Data Flow

### Input modes
```
npm run agents -- --analysis meteoroid-output/analysis/analysis-report.json
npm run agents -- --demo
```
- `--analysis`: reuses the existing `transform` command's output; missing/invalid file →
  clear error before any agent runs (exit 2).
- `--demo`: built-in sample analysis (small e-commerce example: products/orders/users
  models, CRUD routes, Clerk auth) so the pipeline runs out of the box with no
  prerequisites.

Both seed the same typed `AnalysisResult` into `PipelineContext`.

### Sequence
1. CLI parses args, validates input, constructs empty `PipelineContext`.
2. Registry instantiates all agents and calls `initialize()`; unhealthy ones are
   reported and excluded up front (their downstream marked ⏭️ skipped).
3. Planner computes levels from `dependencies.ts`.
4. Executor runs levels; each agent receives `(input, context)`, returns `AgentOutput`;
   executor merges structured results into context fields and collects
   `output.files` into `context.files`.
5. After the last level, **one atomic write phase** materializes all files into
   `generated-backend/<project-name>/`.
6. Reporter prints the table and writes `run-report.json` next to the output.

### Rules
- **File collision:** two agents producing the same path is a pipeline bug — writer
  reports loudly, never silently overwrites.
- **Stubs:** registered, run at their DAG position, produce 1–2 real-but-minimal files
  (e.g., MonitoringAgent → health-check route + winston logger config), and are labeled
  `stub` in the report.

## 7. Error Handling

Per-agent terminal states:

| State | Meaning |
|---|---|
| ✅ success | `output.success === true` |
| ⚠️ degraded | succeeded after retry, or completed but returned empty/partial files |
| ❌ failed | both attempts exhausted (`success: false` return or thrown exception) |
| ⏭️ skipped | upstream dependency failed |

- **Retry:** 2 attempts total, immediate re-run (template generation is deterministic;
  retries only cover transient async issues). Attempt count recorded.
- **Degrade cascade:** permanent failure marks all transitive dependents `skipped`
  with reason `"upstream <id> failed"`; independent branches continue.
- **Single fail-fast case:** AnalysisAgent is the root — its failure aborts the run
  immediately (exit 2) since there is nothing to generate from.
- **Timeouts:** hard per-agent timeout, default 60s, configurable in `dependencies.ts`
  (protects against the optional LLM call hanging).
- **Exit codes:** `0` all green · `1` finished with degraded/skipped · `2` fatal
  (bad input, planner cycle, registry/analysis failure).
- **Error surfacing:** every failure lands in `context.errors` as
  `{agentId, code, message, attempts}` and appears in the final report.

## 8. Testing Strategy

Framework: Jest via existing root `ts-jest` setup. Tests in `packages/orchestrator/tests/`.
TDD throughout — failing test before each component's implementation.

**Layer 1 — Pipeline unit tests** using cue-based mock agents (succeed / fail-twice /
throw / hang):
- Planner: correct level ordering; cycle detection; unknown dependency reference.
- Executor: success merging; retry-then-succeed → degraded; double failure → failed +
  transitive skip while independent branch still runs; timeout fires; thrown exceptions
  normalize to failures.
- Writer: collision detection; expected tree written atomically.

**Layer 2 — Agent wrapper tests** (one per fully-built agent): given known upstream
context data, assert correct output files — e.g., DatabaseAgent receiving an analysis
with `Product` + `Order` models produces a Prisma schema containing both. These enforce
"agents actually consume their inputs."

**Layer 3 — End-to-end:** CLI `--demo` against a temp directory; assert exit 0, every
✅ agent's files exist, `run-report.json` parses and matches the printed table.

**Explicitly out of scope:** the frozen LangGraph path gets no tests.

## 9. Future Extensions (not built now)

- Swap-in LLM "smart planner" mode when an API key is present (Option C upgrade path —
  planner is already an isolated component).
- Wire the same pipeline core into the API server once the Convex migration lands.
- Promote the 6 stubs to full implementations.
