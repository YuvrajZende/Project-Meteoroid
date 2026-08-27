# 🚀 Meteoroid — AI-Powered Backend Generator

Meteoroid scans a frontend codebase (or a JSON spec), then generates a complete, production-ready Express + Prisma backend through a deterministic 13-agent pipeline.

> 📖 Detailed guide with all workflows and the agent DAG: [`run.md`](run.md)

---

## Quick Start

**Prerequisites:** Node.js ≥ 18, npm ≥ 9, Git

```bash
git clone https://github.com/YuvrajZende/Project-Meteoroid.git
cd Project-Meteoroid
npm install
cp .env.example .env          # optional — the demo runs without API keys
```

**Generate a backend in 1 command (demo mode, zero config):**

```bash
npm run agents -- --demo --out generated-backend/demo --name demo-backend
```

→ writes a full backend (Prisma schema, routes, auth, security middleware, tests, CI) to `generated-backend/demo/` plus a `run-report.json`.

---

## How to Run

### 1. Generate a backend from a real frontend

```bash
# Step 1: analyze any frontend repo (GitHub URL or local path)
npm run transform https://github.com/user/frontend-repo
#    → meteoroid-output/analysis/analysis-report.json

# Step 2: generate the matching backend
npm run agents -- --analysis meteoroid-output/analysis/analysis-report.json \
                   --out generated-backend/my-app --name my-app
```

> Use a fresh `--out` directory each run — existing outputs are never overwritten.

### 2. Generate from a custom JSON spec

Hand-write models, endpoints, and auth (template in [`run.md`](run.md)), then:

```bash
npm run agents -- --analysis my-spec.json --out generated-backend/custom --name custom
```

### 3. Run the generated backend

```bash
cd generated-backend/my-app
npm install
npx prisma generate && npx prisma migrate dev --name init   # needs DATABASE_URL in .env
npm run dev                                                  # start the API
npm test                                                     # route smoke tests
```

### 4. Interactive chat mode

```bash
npm run cli        # /help, /code, /analyze, /status — 'exit' to quit
```

---

## CLI Commands

| Command | Purpose |
|---|---|
| `npm run agents -- --demo` | Run the full 13-agent pipeline on demo data |
| `npm run agents -- --analysis <file> --out <dir> --name <name>` | Generate a backend from an analysis JSON |
| `npm run transform <url-or-path>` | Analyze a frontend repo |
| `npm run cli` | Interactive chat mode |
| `npm test` | Run pipeline test suites |
| `npm run type-check` | Type-check the codebase |

---

## How It Works

13 agents execute across 6 topological levels — each consumes upstream outputs, and every run ends with a per-agent `run-report.json`:

```
analysis → database → api ⬄ auth → security → codegen
                                               → test · cicd · infra · queue · monitoring · email · microservice
```

Failures skip their downstream agents (visible in the report), so partial runs stay debuggable.

---

## License

MIT
