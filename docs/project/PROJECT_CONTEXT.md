# 🚀 LOVEABLE BACKEND - COMPLETE PROJECT CONTEXT
## Person 1 Implementation Status & Team Onboarding Guide

**Last Updated:** December 11, 2024  
**Version:** 2.0.0  
**Status:** Production Core Ready - Agent Integration Needed

---

## 📋 TABLE OF CONTENTS

1. [What's Been Built (Person 1 Complete)](#whats-been-built)
2. [System Architecture](#system-architecture)
3. [Database Setup (Supabase)](#database-setup)
4. [API Server Structure](#api-server-structure)
5. [Agent System Integration](#agent-system)
6. [Where to Add Your Agents](#where-to-add-agents)
7. [Testing & Development](#testing)
8. [Team Member Guides](#team-guides)
9. [Quick Start Reference](#quick-start)

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
  - GLM-4 via Z.AI API (`services/ai-client.ts`)
  - Task analysis endpoint
  - Code generation endpoint
  - Token usage tracking
  - Automatic timeout handling

- **Orchestrator System** ✓
  - Integrated orchestrator (`services/integrated-orchestrator.ts`)
  - ThinkingEngine (local + AI analysis)
  - ContextManager (conversation history)
  - AgentMonitor (execution tracking)
  - MCPHub (inter-agent communication)
  - FileWriter (code output to disk)

- **Database Integration (Supabase)** ✓
  - Connection setup (`services/database-client.ts`)
  - Health check utilities
  - 6 Production services:
    - `usersService` - User management
    - `projectsService` - Project tracking
    - `tasksService` - Task queue
    - `apiKeysService` - API key management
    - `auditService` - Security audit logs
    - `vectorStoreService` - Vector embeddings (pgvector)

- **Orchestration Persistence** ✓
  - Auto-saves to Supabase after code generation
  - Tracks projects, tasks, and audit logs
  - File output to `output/` directory

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
│   │   │   │   ├── ai-client.ts                # ⭐ REAL AI (GLM-4)
│   │   │   │   ├── core-services.ts            # ThinkingEngine, ContextManager, etc.
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
│   │   │       ├── 001_initial_schema.sql
│   │   │       └── 002_project_contexts.sql
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
│   │   ├── codegen/                # 👉 Person 4: ADD YOUR CODEGEN AGENT HERE
│   │   ├── microservices/          # 👉 Person 4: ADD YOUR MICROSERVICES AGENT HERE
│   │   └── email/                  # 👉 Person 4: ADD YOUR EMAIL AGENT HERE
│   │
│   └── [each-agent]/
│       ├── index.ts                # Agent entry point
│       ├── config.ts               # Agent configuration
│       ├── templates/              # Code templates
│       └── README.md               # Agent documentation
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

### Migrations Applied

✅ `001_initial_schema.sql` - All tables, RLS policies, functions  
✅ `002_project_contexts.sql` - Context persistence  

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

#### 1. Code Gen Agent

**Location:** `agents/core/codegen/`

**Capabilities:** `['typescript-generation', 'ast-manipulation', 'code-formatting']`

**This is your CORE agent** - generates the actual TypeScript code structure.

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
| `packages/api/src/services/integrated-orchestrator.ts` | Main orchestration logic | Understanding how agents are called |
| `packages/api/src/services/ai-client.ts` | AI API wrapper | Generating code with AI |
| `packages/database/src/services/*.ts` | Database operations | Saving/retrieving data |
| `packages/api/src/routes/orchestrator.ts` | API endpoints | Understanding request/response |
| `packages/api/src/services/agent-loader.ts` | Agent discovery | How your agent gets loaded |

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

## ✅ WHAT'S LEFT TO IMPLEMENT

**By Person 2:**
- [ ] Database Agent (schema generation)
- [ ] Queue Agent (BullMQ jobs)
- [ ] Test Agent (test generation)

**By Person 3:**
- [ ] API Agent (endpoint generation)
- [ ] CI/CD Agent (pipeline generation)
- [ ] Infrastructure Agent (IaC)

**By Person 4:**
- [ ] Code Gen Agent (core TypeScript)
- [ ] Microservices Agent (service orchestration)
- [ ] Email Agent (notifications)

**Future Enhancements:**
- [ ] LangGraph integration (`packages/orchestrator/`)
- [ ] WebSocket real-time updates
- [ ] Advanced caching layer
- [ ] Frontend dashboard

---

*This document contains everything you need to integrate your agents and build on top of the existing infrastructure.*

**Person 1 (Team Lead) has completed the foundation. Now it's time to add your specialized agents!**

🚀 **Let's build something amazing!**
