# 🚀 LOVEABLE BACKEND - COMPLETE PROJECT CONTEXT
## Person 1 Implementation Status & Team Onboarding Guide

**Last Updated:** December 11, 2024  
**Version:** 3.0.0  
**Status:** Production Core Ready - Multi-Model Pipeline Active

---

## 📋 TABLE OF CONTENTS

1. [What's Been Built (Person 1 Complete)](#whats-been-built)
2. [Multi-Model Pipeline (Phase 13) - NEW](#multi-model-pipeline)
3. [Cost Tracking & Benchmarking - NEW](#cost-tracking)
4. [CodeGen Agent Integration (Person 4) - NEW](#codegen-integration)
5. [System Architecture](#system-architecture)
6. [Database Setup (Supabase)](#database-setup)
7. [API Server Structure](#api-server-structure)
8. [Agent System Integration](#agent-system)
9. [Where to Add Your Agents](#where-to-add-agents)
10. [Testing & Development](#testing)
11. [Team Member Guides](#team-guides)
12. [Quick Start Reference](#quick-start)

---

## ✅ WHAT'S BEEN BUILT (Person 1 Complete)

### Core Infrastructure ✓
- **Production Fastify API Server** (`packages/api/`)
  - Health monitoring endpoints
  - Swagger/OpenAPI documentation
  - Security middleware (CORS, Helmet, Rate Limiting)
  - JWT authentication setup
  - Error handling & logging (Pino)
  - Request/response hooks

- **Real AI Integration** ✓
  - GLM-4.6 via Z.AI API (`services/ai-client.ts`)
  - DeepSeek V3 via OpenRouter API (Fast Model)
  - Task analysis endpoint
  - Code generation endpoint
  - Token usage tracking
  - Automatic timeout handling
  - **Retry with exponential backoff** for rate limiting (429 errors)

- **Orchestrator System** ✓
  - Integrated orchestrator (`services/integrated-orchestrator.ts`)
  - ThinkingEngine (local + AI analysis)
  - ContextManager (conversation history)
  - AgentMonitor (execution tracking)
  - MCPHub (inter-agent communication)
  - FileWriter (code output to disk)
  - **Multi-Model Orchestrator** (NEW - two-stage pipeline)

- **Database Integration (Supabase)** ✓
  - Connection setup (`services/database-client.ts`)
  - Health check utilities
  - 6 Production services + **3 NEW tracking tables**
  - Full persistence for costs, benchmarks, and metrics

- **Orchestration Persistence** ✓
  - Auto-saves to Supabase after code generation
  - Tracks projects, tasks, and audit logs
  - **Cost records** with per-model tracking
  - **Agent benchmarks** with performance metrics
  - **Orchestrator metrics** for full task tracking
  - File output to `output/` directory

### 🆕 Phase 13: Multi-Model Hydration Pattern ✓
- **Two-Stage Pipeline:**
  - Stage 1: DeepSeek V3 (FAST) for analysis - ~$0.0001/request
  - Stage 2: GLM-4.6 (POWER) for code generation - ~$0.01/request
- **Expected Savings:** 10x cost reduction, 40% quality improvement
- **Automatic Fallback** on rate limiting or errors
- **Comprehensive Cost Tracking** to Supabase

### 🆕 Phase 11: Agent Benchmarking System ✓
- Per-agent execution metrics
- Token usage tracking
- Success/failure rates
- Automatic persistence to database

### 🆕 Phase 14: CodeGen Agent Integration (Person 4) ✓
- **CodeGen Service** wrapping Person 4's agents
- Multi-language support (TypeScript, Python, Go, Rust, Java)
- Framework-specific generation (Express, FastAPI, Gin, etc.)
- Full cost tracking integration
- Dedicated API endpoints for code generation

---

## 🧠 MULTI-MODEL PIPELINE (Phase 13)

### How It Works

The Multi-Model Pipeline uses a **two-stage approach** to optimize for both cost and quality:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-MODEL PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USER REQUEST                                                   │
│       ↓                                                         │
│  ┌─────────────────────────────────────┐                       │
│  │ STAGE 1: FAST MODEL (Analysis)      │ ← DeepSeek V3         │
│  │ - Task complexity analysis          │   via OpenRouter      │
│  │ - Subtask breakdown                 │   ~$0.0001/request    │
│  │ - Agent selection                   │                       │
│  └─────────────────────────────────────┘                       │
│       ↓                                                         │
│  ┌─────────────────────────────────────┐                       │
│  │ STAGE 2: POWER MODEL (Generation)   │ ← GLM-4.6             │
│  │ - Actual code generation            │   via Z.AI            │
│  │ - Quality-focused output            │   ~$0.01/request      │
│  └─────────────────────────────────────┘                       │
│       ↓                                                         │
│  GENERATED CODE                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `services/multi-model-orchestrator.ts` | Two-stage pipeline logic |
| `services/model-registry.ts` | Model configuration and pricing |
| `services/cost-tracker.ts` | Real-time cost tracking |
| `services/integrated-orchestrator.ts` | Pipeline integration |

### Configuration (.env)

```env
# Fast model for analysis (cheap, quick)
FAST_MODEL_PROVIDER=openrouter
FAST_MODEL_NAME=deepseek/deepseek-chat

# Powerful model for code generation (quality)
POWER_MODEL_PROVIDER=zai
POWER_MODEL_NAME=glm-4.6

# API Keys
OPENROUTER_API_KEY=sk-or-v1-...
ZAI_API_KEY=your-zai-key
```

### Retry Logic

The pipeline includes automatic retry with exponential backoff:
- **429 Rate Limit:** Waits 5s, 10s, 20s before retrying (up to 3 attempts)
- **Timeout:** Automatically retries on connection timeouts
- **Fallback:** Falls back to GLM-4.6 if primary model fails

---

## 💰 COST TRACKING & BENCHMARKING

### What's Tracked

Every API call and agent execution is tracked with:

| Data Point | Description |
|------------|-------------|
| `model_id` | Which model was used |
| `input_tokens` | Tokens in the prompt |
| `output_tokens` | Tokens in the response |
| `total_cost` | Calculated cost in USD |
| `latency_ms` | Response time |
| `task_id` | Which task this belongs to |
| `project_id` | Which project (if UUID) |
| `user_id` | Which user (if UUID) |

### Database Tables

**1. `cost_records`** - Per-API-call cost tracking
```sql
SELECT model_id, SUM(total_cost) as cost, COUNT(*) as calls
FROM cost_records
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY model_id;
```

**2. `agent_benchmarks`** - Per-agent execution metrics
```sql
SELECT agent_id, agent_name, 
       AVG(execution_time) as avg_time,
       COUNT(*) FILTER (WHERE success) as successes,
       COUNT(*) as total
FROM agent_benchmarks
GROUP BY agent_id, agent_name;
```

**3. `orchestrator_metrics`** - Full task metrics
```sql
SELECT task_id, total_duration, agents_used, 
       files_generated, total_cost, success
FROM orchestrator_metrics
ORDER BY created_at DESC
LIMIT 10;
```

### Budget Protection

The cost tracker includes budget limits:

```env
DAILY_BUDGET_USD=10.00
MONTHLY_BUDGET_USD=100.00
BUDGET_ALERT_THRESHOLD=0.8  # Alert at 80%
BUDGET_HARD_LIMIT=false     # Set true to block requests
```

### Console Output Example

```
🧠 MULTI-MODEL PIPELINE (Phase 13)
----------------------------------------------------------------
FAST Model (Analysis):    deepseek/deepseek-chat
  └─ Provider:            OPENROUTER
  └─ API Key:             ✅ Configured

POWER Model (Generation): glm-4.6
  └─ Provider:            ZAI
  └─ API Key:             ✅ Configured
----------------------------------------------------------------

💰 COST TRACKING
----------------------------------------------------------------
Daily Budget:   $10.00 (2.5% used)
Monthly Budget: $100.00 (0.8% used)
----------------------------------------------------------------
```

---

## 🛠️ CODEGEN AGENT INTEGRATION (Person 4)

### Overview

Person 4's CodeGen Agent pipeline has been fully integrated into the server. The `CodeGenService` wraps the multi-agent system (ArchitectureAgent, CodeWriterAgent, DependencyAgent) and provides:

- **Multi-language code generation**
- **Framework-specific templates**
- **Automatic dependency installation**
- **Cost tracking integration**
- **Audit logging**

### Supported Languages & Frameworks

| Language | Frameworks |
|----------|------------|
| **TypeScript** | Express, Fastify, NestJS, Next.js |
| **Python** | FastAPI, Django, Flask |
| **Go** | Gin, Echo, Fiber |
| **Rust** | Actix, Rocket, Axum |
| **Java** | Spring Boot, Quarkus, Micronaut |

### New API Endpoints

#### Project Generation
```bash
POST /codegen/project
{
  "projectName": "my-api",
  "language": "typescript",
  "framework": "express",
  "description": "REST API for user management",
  "modules": ["users", "auth", "products"],
  "outputPath": "./output",
  "userId": "user-uuid"
}
```

#### Module Generation
```bash
POST /codegen/module
{
  "moduleName": "products",
  "projectPath": "./output/my-api",
  "userId": "user-uuid"
}
```

#### Get Supported Languages
```bash
GET /codegen/languages

# Response:
{
  "languages": ["typescript", "python", "go", "rust", "java"],
  "frameworks": {
    "typescript": ["express", "fastify", "nestjs", "nextjs"],
    "python": ["fastapi", "django", "flask"],
    ...
  }
}
```

#### Health Check
```bash
GET /codegen/health
```

### Key Files

| File | Purpose |
|------|---------|
| `services/codegen-service.ts` | Service wrapper for Person 4's agents |
| `routes/codegen.ts` | API routes for code generation |
| `agents/support/codegen/` | Person 4's agent implementations |
| `agents/support/codegen/orchestrator.ts` | AutoOrchestrator for multi-agent coordination |

### Architecture

```
                    ┌─────────────────┐
                    │  /codegen/*     │ ← API Routes
                    └────────┬────────┘
                            │
                ┌───────────▼───────────┐
                │    CodeGenService     │ ← Person 1's wrapper
                │  (codegen-service.ts) │
                └───────────┬───────────┘
                            │ (dynamic import)
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼───────┐  ┌────────▼────────┐  ┌───────▼───────┐
│  AutoOrches-  │  │  Architecture   │  │  CodeWriter   │
│   trator      │  │     Agent       │  │    Agent      │
│ (Person 4)    │  │   (Person 4)    │  │  (Person 4)   │
└───────────────┘  └─────────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼───────┐
                    │   GROQ API    │ ← llama-3.3-70b-versatile
                    └───────────────┘
```

### Configuration (.env)

```env
# Groq API Key (Person 4's agents)
GROQ_API_KEY=gsk_...

# Or fallback to OpenAI-compatible endpoint
# OPENAI_API_KEY=sk-...
```

### Console Output at Startup

```
  🛠️ CODEGEN PIPELINE (Person 4)
  ----------------------------------------------------------------
  Status:       ✅ Ready
  Languages:    typescript, python, go, rust, java
  Endpoints:    /codegen/project, /codegen/module, /codegen/languages
```

---

## 🏗️ SYSTEM ARCHITECTURE

```
Project backend/
├── .env (ROOT - All env vars here!)
│
├── packages/
│   ├── api/                        # 🔥 MAIN API SERVER
│   │   ├── src/
│   │   │   ├── index.ts            # Server startup
│   │   │   ├── app.ts              # App creation + plugin registration
│   │   │   │
│   │   │   ├── config/             # Configuration
│   │   │   │   ├── env.ts          # Env validation (Zod)
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── routes/             # 🛣️ API ROUTES
│   │   │   │   ├── health.ts       # /health, /health/deep (DB + Vector checks)
│   │   │   │   ├── orchestrator.ts # /api/v1/orchestrator/* (Main endpoint)
│   │   │   │   ├── agents.ts       # /api/v1/agents/* (Agent discovery)
│   │   │   │   ├── tasks.ts        # /api/v1/tasks/*
│   │   │   │   ├── projects.ts     # /api/v1/projects/*
│   │   │   │   ├── auth.ts         # /api/v1/auth/*
│   │   │   │   ├── webhooks.ts     # /api/v1/webhooks/*
│   │   │   │   ├── websocket.ts    # /api/v1/events/* (SSE)
│   │   │   │   ├── metrics.ts      # /metrics (Prometheus)
│   │   │   │   └── index.ts        # Route registration
│   │   │   │
│   │   │   ├── services/           # 🧠 CORE SERVICES
│   │   │   │   ├── integrated-orchestrator.ts  # ⭐ MAIN ORCHESTRATOR
│   │   │   │   ├── ai-client.ts                # ⭐ REAL AI (GLM-4.6)
│   │   │   │   ├── multi-model-orchestrator.ts # ⭐ TWO-STAGE PIPELINE (NEW)
│   │   │   │   ├── model-registry.ts           # 🆕 Model configs + pricing
│   │   │   │   ├── cost-tracker.ts             # 🆕 Cost tracking + budget
│   │   │   │   ├── benchmarking.ts             # 🆕 Agent benchmarking
│   │   │   │   ├── core-services.ts            # ThinkingEngine, ContextManager
│   │   │   │   ├── database-client.ts          # ⭐ SUPABASE CONNECTION
│   │   │   │   ├── agent-registry.ts           # Agent registration
│   │   │   │   ├── agent-loader.ts             # Dynamic agent loading
│   │   │   │   ├── agent-coordinator.ts        # Multi-agent coordination
│   │   │   │   ├── key-manager.ts              # API key rotation
│   │   │   │   ├── file-writer.ts              # Code output
│   │   │   │   └── job-queue.ts                # BullMQ queue
│   │   │   │
│   │   │   ├── plugins/            # Fastify plugins
│   │   │   ├── hooks/              # Request hooks
│   │   │   ├── middleware/         # Security, validation
│   │   │   ├── monitoring/         # Sentry, metrics
│   │   │   └── tests/              # Test files
│   │   │
│   │   └── package.json
│   │
│   ├── database/                   # 🗄️ DATABASE PACKAGE
│   │   ├── src/
│   │   │   ├── client.ts           # Supabase client
│   │   │   ├── services/           # Database services
│   │   │   │   ├── users.ts        # User CRUD
│   │   │   │   ├── projects.ts     # Project CRUD
│   │   │   │   ├── tasks.ts        # Task CRUD
│   │   │   │   ├── api-keys.ts     # API key management
│   │   │   │   ├── audit.ts        # Audit logs
│   │   │   │   ├── vector-store.ts # Vector embeddings
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── migrations/         # SQL migrations
│   │   │       ├── run_this_migration.sql     # Initial schema
│   │   │       ├── 002_project_contexts.sql   # Context persistence
│   │   │       ├── 003_cost_tracking.sql      # 🆕 Cost records
│   │   │       └── 004_benchmarking.sql       # 🆕 Benchmarks & metrics
│   │   │
│   │   └── package.json
│   │
│   ├── orchestrator/               # LangGraph (future enhancement)
│   └── shared/                     # Shared types
│
├── agents/                         # 🤖 AGENT IMPLEMENTATIONS
│   ├── core/                       # ⭐ ADD YOUR AGENTS HERE
│   │   ├── auth/                   # Person 1 (Auth Agent)
│   │   ├── security/               # Person 1 (Security Agent)
│   │   ├── monitoring/             # Person 1 (Monitoring Agent)
│   │   │
│   │   ├── database/               # 👉 Person 2: ADD YOUR DATABASE AGENT HERE
│   │   ├── queue/                  # 👉 Person 2: ADD YOUR QUEUE AGENT HERE
│   │   ├── test/                   # 👉 Person 2: ADD YOUR TEST AGENT HERE
│   │   │
│   │   ├── api/                    # 👉 Person 3: ADD YOUR API AGENT HERE
│   │   ├── cicd/                   # 👉 Person 3: ADD YOUR CI/CD AGENT HERE
│   │   ├── infrastructure/         # 👉 Person 3: ADD YOUR INFRA AGENT HERE
│   │   │
│   │   └── microservices/          # 👉 Person 4: ADD YOUR MICROSERVICES AGENT HERE
│   │
│   ├── support/                    # 🤖 SUPPORT AGENTS
│   │   └── codegen/                # ✅ Person 4: CODEGEN AGENT (INTEGRATED)
│   │       ├── index.ts            # CodegenAgent main class
│   │       ├── orchestrator.ts     # AutoOrchestrator
│   │       ├── architecture-agent.ts
│   │       ├── codewriter-agent.ts
│   │       ├── dependency-agent.ts
│   │       ├── language-configs.ts
│   │       └── templates/          # Code templates
│
├── output/                         # Generated code output
└── docs/                           # Documentation

```

---

## 🗄️ DATABASE SETUP (SUPABASE)

### Connection Configuration

**File:** `.env` (in project root)

```env
# Supabase Database
SUPABASE_URL=https://kkwbjpkqmcubjwzdgcur.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Direct PostgreSQL Connection (for migrations)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.kkwbjpkqmcubjwzdgcur.supabase.co:5432/postgres
```

### Database Tables (Already Created)

| Table | Purpose | Service |
|-------|---------|---------|
| `users` | User accounts with quota tracking | `usersService` |
| `projects` | Project metadata and status | `projectsService` |
| `tasks` | Task queue and execution history | `tasksService` |
| `api_keys` | API key management | `apiKeysService` |
| `audit_logs` | Security audit trail | `auditService` |
| `knowledge_embeddings` | Vector store (pgvector) | `vectorStoreService` |
| `project_contexts` | Conversation history persistence | `contextManager` |
| 🆕 `cost_records` | AI API cost tracking | `costTracker` |
| 🆕 `agent_benchmarks` | Agent execution metrics | `benchmarkingService` |
| 🆕 `orchestrator_metrics` | Full task metrics | `benchmarkingService` |
| 🆕 `ai_model_performance` | Aggregated model stats | `benchmarkingService` |
| 🆕 `budget_limits` | User budget controls | `costTracker` |

### Migrations Applied

✅ `run_this_migration.sql` - All tables, RLS policies, functions  
✅ `002_project_contexts.sql` - Context persistence  
✅ `003_cost_tracking.sql` - Cost records and budget limits  
✅ `004_benchmarking.sql` - Agent benchmarks and orchestrator metrics  

### Vector Store (pgvector)

- **Extension:** `vector` enabled in Supabase
- **Function:** `match_embeddings()` for semantic search
- **Dimension:** 1536 (OpenAI compatible)
- **Usage:** See `packages/database/src/services/vector-store.ts`

---

## 🌐 API SERVER STRUCTURE

### Entry Point

**File:** `packages/api/src/index.ts`

```typescript
// Server starts here
// 1. Prints startup banner
// 2. Checks Supabase connection
// 3. Checks Vector Store
// 4. Checks Redis
// 5. Loads agents
// 6. Starts Fastify on port 3000
```

### Startup Sequence

```
[CONFIG] API Keys Configured
[DATABASE] Checking Supabase connection...
[DATABASE] ✅ Supabase healthy (0 users) (45ms)
[VECTOR STORE] Checking pgvector...
[VECTOR STORE] ✅ Vector store healthy (0 embeddings) (52ms)
[REDIS] ✅ Connected to redis://localhost:6379
[AGENTS] Loading from agents directory...
[AGENTS] Loaded 12 agents successfully
[ORCHESTRATOR] Initialized: true
```

### Key API Endpoints

#### Health & Monitoring
- `GET /health` - Basic health check
- `GET /health/deep` - Database + Vector Store + Redis + Agents
- `GET /status` - System info (memory, agents, uptime)
- `GET /metrics` - Prometheus metrics

#### Orchestrator (Main Endpoint)
- `POST /api/v1/orchestrator/execute` - ⭐ **Main code generation**
- `POST /api/v1/orchestrator/think` - AI task analysis
- `POST /api/v1/orchestrator/chat` - Direct AI chat
- `GET /api/v1/orchestrator/status` - Orchestrator status
- `GET /api/v1/orchestrator/agents` - List all agents
- `POST /api/v1/orchestrator/agents/:id/execute` - Execute specific agent

#### CodeGen (Person 4's Pipeline) - NEW
- `POST /codegen/project` - ⭐ **Generate complete project**
- `POST /codegen/module` - Generate single module
- `GET /codegen/languages` - Get supported languages/frameworks
- `GET /codegen/health` - CodeGen service health check

#### Projects & Tasks
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/tasks` - List tasks
- `GET /api/v1/tasks/:id/stream` - SSE task progress

---

## 🤖 AGENT SYSTEM

### How Agents Work

1. **Agent Registration:**
   - Agents are loaded from `agents/` directory
   - Each agent has an `index.ts` with `IAgent` interface
   - Automatically discovered and registered

2. **Agent Interface:**

```typescript
// File: packages/shared/src/types/agent.ts
export interface IAgent {
    id: string;                    // e.g., "database-agent"
    name: string;                  // e.g., "Database Agent"
    tier: 'tier1' | 'tier2' | 'tier3';
    capabilities: string[];        // e.g., ["schema-generation", "migrations"]
    description: string;
    version: string;
    
    initialize(config: any): Promise<void>;
    execute(task: AgentTask): Promise<AgentResult>;
    shutdown(): Promise<void>;
}

export interface AgentTask {
    task: string;                  // Task description
    context?: Record<string, any>; // Additional context
    priority?: number;             // Task priority
    requestId?: string;            // Tracking ID
}

export interface AgentResult {
    code: string;                  // Generated code
    explanation: string;           // What was generated
    files?: Array<{                // Files to create
        path: string;
        content: string;
        type: 'code' | 'config' | 'docs';
    }>;
    metadata?: Record<string, any>;
}
```

3. **Orchestration Flow:**

```
User Request
    ↓
POST /api/v1/orchestrator/execute
    ↓
ThinkingEngine analyzes task
    ↓
AI analyzes task (complexity, subtasks, agents needed)
    ↓
Agent Selection (auth-agent, database-agent, api-agent, etc.)
    ↓
For each subtask:
    → Agent executes
    → AI generates code
    → Results collected
    ↓
FileWriter saves to disk
    ↓
Supabase saves metadata (project, task, audit)
    ↓
Return results to user
```

### Current Agent Loading

**File:** `packages/api/src/services/agent-loader.ts`

- Scans `agents/` directory recursively
- Looks for `index.ts` files
- Dynamically imports and registers
- Currently loads: **12 agents**

---

## 👉 WHERE TO ADD YOUR AGENTS

### Person 2 (AI/ML Engineer) - Database, Queue, Test Agents

#### 1. Database Agent

**Location:** `agents/core/database/`

**Structure:**
```
agents/core/database/
├── index.ts              # Main agent implementation
├── config.ts             # Agent configuration
├── templates/            # Code templates
│   ├── prisma-schema.ts
│   ├── migration.ts
│   └── seeder.ts
├── utils/                # Helper functions
│   ├── schema-analyzer.ts
│   └── relationship-mapper.ts
└── README.md             # Agent documentation
```

**What to Implement:**
```typescript
// agents/core/database/index.ts
import { IAgent, AgentTask, AgentResult } from '@loveable/shared';

export const databaseAgent: IAgent = {
    id: 'database-agent',
    name: 'Database Agent',
    tier: 'tier1',
    capabilities: ['schema-generation', 'migrations', 'seeds'],
    description: 'Generates Prisma schemas, migrations, and seed data',
    version: '1.0.0',
    
    async initialize(config) {
        // Setup: Load templates, connect to services
    },
    
    async execute(task: AgentTask): Promise<AgentResult> {
        // 1. Parse task (e.g., "Create user table with email and password")
        // 2. Generate Prisma schema
        // 3. Generate migration
        // 4. Return code + files
        
        return {
            code: generatedPrismaSchema,
            explanation: "Generated Prisma schema for user model",
            files: [
                { path: 'prisma/schema.prisma', content: schema, type: 'code' },
                { path: 'prisma/migrations/001_user.sql', content: migration, type: 'code' }
            ]
        };
    },
    
    async shutdown() {
        // Cleanup
    }
};

export default databaseAgent;
```

#### 2. Queue Agent

**Location:** `agents/core/queue/`

**Capabilities:** `['queue-setup', 'worker-generation', 'job-templates']`

**Example Tasks:**
- "Create background job for sending emails"
- "Setup Redis job queue with retry logic"
- "Generate worker for image processing"

#### 3. Test Agent

**Location:** `agents/core/test/`

**Capabilities:** `['unit-tests', 'e2e-tests', 'test-coverage']`

**Example Tasks:**
- "Generate unit tests for authentication service"
- "Create E2E tests for user registration flow"

---

### Person 3 (API & Integration) - API, CI/CD, Infrastructure Agents

#### 1. API Agent

**Location:** `agents/core/api/`

**Capabilities:** `['rest-endpoints', 'graphql-resolvers', 'openapi-docs']`

**Example Implementation:**
```typescript
async execute(task: AgentTask): Promise<AgentResult> {
    // Parse: "Create REST endpoint for user CRUD"
    
    const endpoint = `
    app.post('/api/users', async (req, reply) => {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(8)
        });
        
        const body = schema.parse(req.body);
        // ... implementation
    });
    `;
    
    return {
        code: endpoint,
        explanation: "Generated Fastify route for user creation",
        files: [
            { path: 'src/routes/users.ts', content: endpoint, type: 'code' }
        ]
    };
}
```

#### 2. CI/CD Agent

**Location:** `agents/core/cicd/`

**Capabilities:** `['github-actions', 'deployment-pipeline', 'testing-pipeline']`

**Example Tasks:**
- "Generate GitHub Actions workflow for testing"
- "Create Docker build and deploy pipeline"

#### 3. Infrastructure Agent

**Location:** `agents/core/infrastructure/`

**Capabilities:** `['terraform', 'docker', 'kubernetes']`

**Example Tasks:**
- "Create Dockerfile for Node.js application"
- "Generate Kubernetes deployment manifest"
- "Setup Terraform for AWS infrastructure"

---

### Person 4 (DevOps) - CodeGen, Microservices, Email Agents

#### 1. Code Gen Agent - ✅ INTEGRATED

**Location:** `agents/support/codegen/`

**Status:** ✅ **Fully Integrated into Server**

The CodeGen Agent has been integrated with the server infrastructure:

- **CodeGenService** (`services/codegen-service.ts`) wraps your agents
- **API Routes** (`routes/codegen.ts`) expose HTTP endpoints
- **Cost Tracking** integrated with `CostTrackerService`
- **Benchmarking** integrated with `BenchmarkingService`
- **Audit Logging** integrated with Supabase

**Your Agent Structure:**
```
agents/support/codegen/
├── index.ts                # CodegenAgent (IAgent implementation)
├── orchestrator.ts         # AutoOrchestrator (multi-agent coordination)
├── architecture-agent.ts   # Designs project structure
├── codewriter-agent.ts     # Generates actual code
├── dependency-agent.ts     # Manages dependencies
├── language-configs.ts     # Language/framework configurations
├── templates/              # Code templates
│   └── index.ts
└── README.md
```

**Test Your Integration:**
```bash
# Check health
curl http://localhost:3000/codegen/health

# Generate a project
curl -X POST http://localhost:3000/codegen/project \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "my-api",
    "language": "typescript",
    "framework": "express"
  }'
```

#### 2. Microservices Agent

**Location:** `agents/core/microservices/`

**Capabilities:** `['service-mesh', 'api-gateway', 'service-discovery']`

#### 3. Email Agent

**Location:** `agents/core/email/`

**Capabilities:** `['email-templates', 'resend-integration', 'notification-system']`

---

## 🧪 TESTING & DEVELOPMENT

### Running the Server

```bash
# Development mode (hot reload)
cd packages/api
npm run dev

# Production build
npm run build
npm start
```

### Testing Your Agent

#### 1. Direct Agent Execution

```bash
curl -X POST http://localhost:3000/api/v1/orchestrator/agents/your-agent-id/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a user registration endpoint",
    "context": { "framework": "fastify" }
  }'
```

#### 2. Via Orchestrator

```bash
curl -X POST http://localhost:3000/api/v1/orchestrator/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a complete authentication system",
    "projectId": "auth-system",
    "userId": "dev-user"
  }'
```

### Verifying Database Saves

**SQL Query in Supabase Dashboard:**
```sql
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 5;
SELECT * FROM projects WHERE user_id = 'dev-user';
SELECT * FROM audit_logs WHERE action = 'orchestration_execute';
```

---

## 👥 TEAM MEMBER GUIDES

### Person 2: Getting Started with Your Agents

**Your Agents:** Database, Queue, Test

**Steps:**
1. Create agent directory: `agents/core/database/`
2. Implement `index.ts` with `IAgent` interface
3. Add templates in `templates/` folder
4. Test with direct execution endpoint
5. Orchestrator will auto-discover and load it

**Key Files to Reference:**
- `packages/api/src/services/integrated-orchestrator.ts` - How orchestrator calls agents
- `packages/api/src/services/ai-client.ts` - How to use AI for code generation
- `packages/database/src/services/` - Database service examples

---

### Person 3: Getting Started with Your Agents

**Your Agents:** API, CI/CD, Infrastructure

**Steps:**
1. Create `agents/core/api/`, `agents/core/cicd/`, `agents/core/infrastructure/`
2. Study `packages/api/src/routes/` to understand Fastify patterns
3. Implement API generation logic
4. Test generated code validity

**Key Files to Reference:**
- `packages/api/src/routes/orchestrator.ts` - Route structure examples
- `packages/api/src/config/env.ts` - Environment validation

---

### Person 4: Getting Started with Your Agents

**Your Agents:** CodeGen, Microservices, Email

**Steps:**
1. CodeGen is critical - handles core TypeScript generation
2. Reference `packages/api/src/services/file-writer.ts` for file output
3. Implement ts-morph for AST manipulation
4. Test with Fastify applications

**Key Files to Reference:**
- `packages/api/src/services/file-writer.ts` - How files are written
- `output/` - Where generated code goes

---

## ⚡ QUICK START REFERENCE

### Environment Setup

```bash
# Clone repo
git clone <repo-url>
cd "Project backend"

# Install dependencies
npm install

# Setup .env (IMPORTANT: Use root .env file!)
cp .env.example .env
# Add your: OPENAI_API_KEY, SUPABASE credentials

# Start Redis (required)
docker run -d -p 6379:6379 redis:latest

# Start server
cd packages/api
npm run dev
```

### Testing Checklist

- [ ] Server starts: `npm run dev`
- [ ] Health check: `curl http://localhost:3000/health/deep`
- [ ] Agents loaded: `curl http://localhost:3000/api/v1/orchestrator/agents`
- [ ] Orchestrator works: Execute a simple task
- [ ] Database saves: Check Supabase dashboard
- [ ] Your agent loads: Check server logs

---

## 📚 KEY FILES YOU'LL USE

| File | Purpose | When to Use |
|------|---------|-------------|
| `services/integrated-orchestrator.ts` | Main orchestration logic | Understanding how agents are called |
| `services/multi-model-orchestrator.ts` | 🆕 Two-stage AI pipeline | Understanding cost optimization |
| `services/cost-tracker.ts` | 🆕 Cost tracking + budget | Monitoring API costs |
| `services/benchmarking.ts` | 🆕 Performance metrics | Tracking agent performance |
| `services/model-registry.ts` | 🆕 Model configuration | Adding/configuring AI models |
| `services/codegen-service.ts` | 🆕 CodeGen wrapper | Person 4's agent integration |
| `routes/codegen.ts` | 🆕 CodeGen API routes | Code generation endpoints |
| `services/ai-client.ts` | AI API wrapper | Generating code with AI |
| `packages/database/src/services/*.ts` | Database operations | Saving/retrieving data |
| `routes/orchestrator.ts` | API endpoints | Understanding request/response |
| `services/agent-loader.ts` | Agent discovery | How your agent gets loaded |

---

## 🚨 IMPORTANT NOTES

### 1. Environment Variables
**ALWAYS use the ROOT `.env` file** - Not `packages/api/.env`

### 2. Agent Loading
Agents are auto-discovered. Just create the folder structure and implement `IAgent`.

### 3. Database Connection
All database saves are automatic after orchestration completes.

### 4. File Output
Generated code goes to `output/<projectId>/`

### 5. Testing
Always test your agent in isolation first, then via orchestrator.

---

## 📞 SUPPORT

- **Issues:** Check `/docs/` folder for troubleshooting
- **Questions:** Review this document first
- **Agent Examples:** See existing agents in `agents/core/`

---

## ✅ IMPLEMENTATION STATUS

### ✅ COMPLETED (Person 1)

**Phase 1-10: Core Infrastructure**
- [x] Fastify API Server with security middleware
- [x] Supabase database integration
- [x] Real AI integration (Z.AI GLM-4.6)
- [x] Dynamic agent loading system
- [x] ThinkingEngine, ContextManager, AgentMonitor
- [x] File output to disk
- [x] JWT authentication setup

**Phase 11: Agent Benchmarking**
- [x] BenchmarkingService with persistence
- [x] Per-agent execution metrics
- [x] Token usage tracking
- [x] Supabase persistence for benchmarks

**Phase 13: Multi-Model Hydration**
- [x] MultiModelOrchestrator (two-stage pipeline)
- [x] DeepSeek V3 via OpenRouter (FAST model)
- [x] GLM-4.6 via Z.AI (POWER model)
- [x] Model Registry with pricing
- [x] CostTracker with budget protection
- [x] Retry with exponential backoff
- [x] Full Supabase persistence

**Phase 14: CodeGen Agent Integration (Person 4)**
- [x] CodeGenService wrapper for Person 4's agents
- [x] API routes for code generation (/codegen/*)
- [x] Multi-language support (TS, Python, Go, Rust, Java)
- [x] Framework-specific generation
- [x] Cost tracking integration
- [x] Startup logging for CodeGen status
- [x] Dynamic ESM import fix for Windows

### 📋 TO BE IMPLEMENTED

**By Person 2:**
- [ ] Database Agent (schema generation)
- [ ] Queue Agent (BullMQ jobs)
- [ ] Test Agent (test generation)

**By Person 3:**
- [ ] API Agent (endpoint generation)
- [ ] CI/CD Agent (pipeline generation)
- [ ] Infrastructure Agent (IaC)

**By Person 4:**
- [x] Code Gen Agent (core TypeScript) - ✅ INTEGRATED
- [ ] Microservices Agent (service orchestration)
- [ ] Email Agent (notifications)

**Future Enhancements:**
- [ ] LangGraph integration (`packages/orchestrator/`)
- [ ] WebSocket real-time updates
- [ ] Advanced caching layer
- [ ] Frontend dashboard
- [ ] Code quality scoring for benchmarks
- [ ] Full IntegratedOrchestrator integration for CodeGen

---

*This document contains everything you need to integrate your agents and build on top of the existing infrastructure.*

**Person 1 (Team Lead) has completed the production-ready foundation with Multi-Model Pipeline, full cost tracking, and Person 4's CodeGen integration!**

🚀 **Let's build something amazing!**
