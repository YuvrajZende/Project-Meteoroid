# 🚀 Meteoroid - Execution & Generation Guide

This guide explains how to run Meteoroid, build backends from frontend repositories, create custom architectures, and run the generated backends.

---

## 📋 Table of Contents
1. [Quick Start: Demo Mode](#1-quick-start-demo-mode)
2. [Workflow 1: Build Backend from a Real Frontend Repo](#2-workflow-1-build-backend-from-a-real-frontend-repo)
3. [Workflow 2: Build Backend from a Custom JSON Spec](#3-workflow-2-build-backend-from-a-custom-json-spec)
4. [Workflow 3: Interactive Chat Mode](#4-workflow-3-interactive-chat-mode)
5. [Running Your Generated Backend](#5-running-your-generated-backend)
6. [How the 13-Agent DAG Pipeline Works](#6-how-the-13-agent-dag-pipeline-works)
7. [CLI Commands Reference](#7-cli-commands-reference)

---

## 1. Quick Start: Demo Mode

To test the multi-agent pipeline immediately with zero configuration and zero API keys:

```bash
npm run agents -- --demo --out generated-backend/demo --name demo-backend
```

- **Output Location:** `generated-backend/demo/`
- **Report Location:** `generated-backend/demo/run-report.json`
- **Result:** Generates 38+ production-ready files (Prisma schema, Express routes, Clerk auth, security middleware, package configs, test suite, and infrastructure stubs).

> **Note:** The writer refuses to overwrite a non-empty `--out` directory (exit 2). Pick a fresh directory or delete the old one before re-running.

---

## 2. Workflow 1: Build Backend from a Real Frontend Repo

This is Meteoroid's primary workflow. It scans an existing frontend repository, discovers all API calls, data structures, and auth requirements, and generates the matching backend.

### Step 1: Analyze the Frontend Codebase

Run the analyzer against any public GitHub repository or local directory:

```bash
# Public GitHub repository
npm run transform https://github.com/your-username/your-frontend-repo

# OR a local directory
npm run transform ../path-to-my-frontend
```

This analyzes the frontend components and writes:
- Analysis JSON: `meteoroid-output/analysis/analysis-report.json`
- Human-Readable Markdown: `meteoroid-output/analysis/details.md`

### Step 2: Run the Multi-Agent Pipeline

Pass the generated analysis report to the agent pipeline:

```bash
npm run agents -- --analysis meteoroid-output/analysis/analysis-report.json --out generated-backend/my-app --name my-app
```

---

## 3. Workflow 2: Build Backend from a Custom JSON Spec

If you don't have a frontend repository and want to define models, endpoints, and authentication manually:

### Step 1: Create a Specification File
Create `my-spec.json` in your project root:

```json
{
  "repositoryPath": "my-project",
  "framework": {
    "type": "react-vite",
    "version": "5.4.0",
    "isMetaFramework": false,
    "usesTypeScript": true,
    "buildTool": "vite",
    "uiLibrary": "tailwind",
    "stateManagement": null,
    "confidence": 0.95
  },
  "apiCalls": [
    { "endpoint": "/api/users", "method": "GET", "library": "axios", "sourceFile": "users.ts", "lineNumber": 1, "requiresAuth": false },
    { "endpoint": "/api/posts", "method": "POST", "library": "fetch", "sourceFile": "posts.ts", "lineNumber": 2, "requiresAuth": true }
  ],
  "dataModels": [
    {
      "name": "User",
      "confidence": 1.0,
      "primaryKey": "id",
      "sources": [],
      "relationships": [
        { "targetModel": "Post", "type": "one-to-many", "fieldName": "posts" }
      ],
      "fields": [
        { "name": "id", "type": "uuid", "optional": false },
        { "name": "email", "type": "string", "optional": false },
        { "name": "name", "type": "string", "optional": true }
      ]
    },
    {
      "name": "Post",
      "confidence": 1.0,
      "primaryKey": "id",
      "sources": [],
      "relationships": [],
      "fields": [
        { "name": "id", "type": "uuid", "optional": false },
        { "name": "title", "type": "string", "optional": false },
        { "name": "content", "type": "string", "optional": false },
        { "name": "userId", "type": "uuid", "optional": false }
      ]
    }
  ],
  "authStrategy": {
    "provider": "clerk",
    "features": { "socialLogin": true, "emailPassword": true, "magicLink": false, "phoneAuth": false, "mfa": false, "sso": false },
    "protectedRoutes": ["/api/posts"],
    "authFiles": [],
    "authHooks": [],
    "tokenStorage": "cookie",
    "confidence": 0.95
  },
  "suggestions": {
    "recommendedDatabase": "postgresql",
    "recommendedOrm": "prisma",
    "recommendedAuth": "clerk",
    "apiStyle": "rest"
  }
}
```

### Step 2: Execute the Pipeline

```bash
npm run agents -- --analysis my-spec.json --out generated-backend/my-custom-app --name my-custom-app
```

---

## 4. Workflow 3: Interactive Chat Mode

To interactively chat with the AI assistant, switch generation modes, and inspect configuration:

```bash
npm run cli
```

Inside the CLI session:
- `/help` — List available commands
- `/code` — Switch to code generation mode
- `/analyze` — Switch to repository analysis mode
- `/status` — Check system and connection status
- `exit` — Quit

---

## 5. Running Your Generated Backend

Once your backend is generated in `generated-backend/<project-name>`:

```bash
# 1. Navigate to the generated backend directory
cd generated-backend/my-app

# 2. Install dependencies
npm install

# 3. Configure your database connection in .env
# DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# 4. Generate Prisma client & apply migrations
npx prisma generate
npx prisma migrate dev --name init

# 5. Start the backend development server
npm run dev

# 6. Run automated smoke tests
npm test
```

---

## 6. How the 13-Agent DAG Pipeline Works

The pipeline executes deterministically across 6 topological levels:

```
Level 0: analysis-agent
   │
   ▼
Level 1: database-agent
   │
   ├───────────────────────────────┐
   ▼                               ▼
Level 2: api-agent               Level 2: auth-agent
   │                               │
   └───────────────┬───────────────┘
                   ▼
Level 3:       security-agent
                   │
                   ▼
Level 4:       codegen-agent
                   │
   ┌───────────────┼───────────────┬───────────────┬───────────────┐
   ▼               ▼               ▼               ▼               ▼
Level 5: test   Level 5: cicd   Level 5: infra   Level 5: queue  Level 5: monitoring/email/microservice
```

### What Each Agent Contributes:
| Agent | Output & Responsibilities |
|---|---|
| **`analysis-agent`** | Validates & normalizes frontend models, routes, and auth strategy into `PipelineContext`. |
| **`database-agent`** | Generates `prisma/schema.prisma`, CRUD query builders, and connection pool configs. |
| **`api-agent`** | Generates Express REST routers (`src/routes/*`) and error handling middleware. |
| **`auth-agent`** | Generates authentication handlers (`Clerk`, `Auth0`, `Supabase`, or custom JWT sessions). |
| **`security-agent`** | Generates rate limiters, Helmet configs, CORS policies, and input sanitizers. |
| **`codegen-agent`** | Scaffolds root `package.json`, `tsconfig.json`, and project `README.md`. |
| **`test-agent`** | Generates `vitest.config.ts`, test setups, and route smoke test suites (`tests/smoke.test.ts`). |
| **Supporting Stubs** | Generates `.github/workflows/ci.yml`, `Dockerfile`, health routes, mailer, and queue setup. |

---

## 7. CLI Commands Reference

| Command | Purpose |
|---|---|
| `npm run agents -- --demo` | Run the full 13-agent pipeline with built-in demo data |
| `npm run agents -- --analysis <file> --out <dir>` | Generate a backend from a specific analysis JSON file |
| `npm run transform <url>` | Analyze a frontend repository and produce `analysis-report.json` |
| `npm run cli` | Launch interactive terminal chat mode |
| `npm run type-check` | Type-check the entire TypeScript codebase |
| `npm test` | Run pipeline test suites |
