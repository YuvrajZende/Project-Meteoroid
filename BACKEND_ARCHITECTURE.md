# 🏗️ LOVEABLE PRODUCTION BACKEND ARCHITECTURE

**Design Philosophy:** Build a "Plug-and-Play" Orchestrator where agents from other team members can be **drag-and-dropped** into the system without modifying core code.

---

## 🗺️ COMPLETE SYSTEM ARCHITECTURE

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                                  [ INTERNET ]                                         ║
║                                       │                                               ║
║                                       ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                     🌐 CLOUDFLARE / LOAD BALANCER                               │  ║
║  │                        (DDoS Protection, SSL)                                   │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                       │                                               ║
║                                       ▼                                               ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                        🚀 PRODUCTION SERVER (Node.js + Fastify)                       ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  LAYER 1: 🛡️ EDGE SECURITY                                                     │  ║
║  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │  ║
║  │  │ Rate Limit  │ │    WAF      │ │ Bot Shield  │ │ IP Filter   │               │  ║
║  │  │  (Redis)    │ │  (Rules)    │ │ (Detection) │ │ (Whitelist) │               │  ║
║  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                       │                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  LAYER 2: 🔐 AUTHENTICATION (Supabase Auth)                                     │  ║
║  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │  ║
║  │  │ JWT Verify  │ │    RBAC     │ │  API Keys   │ │ OAuth/SSO   │               │  ║
║  │  │ (Supabase)  │ │  (Policies) │ │ Management  │ │ (Google)    │               │  ║
║  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                       │                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  LAYER 3: 🔄 API KEY ROTATION & QUOTA MANAGEMENT                                │  ║
║  │  ┌─────────────────────────────────────────────────────────────────────────┐   │  ║
║  │  │  KeyManager: Pool of AI Provider Keys (OpenAI, Anthropic, Z.AI)         │   │  ║
║  │  │  - Auto-rotate on 429 errors                                            │   │  ║
║  │  │  - Track usage per key                                                   │   │  ║
║  │  │  - Cost optimization (use cheaper models when possible)                  │   │  ║
║  │  └─────────────────────────────────────────────────────────────────────────┘   │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                       │                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  LAYER 4: 📡 API ROUTES                                                         │  ║
║  │  ┌───────────────────────────────────────────────────────────────────────────┐ │  ║
║  │  │  POST /api/v1/task          →  Submit generation request                  │ │  ║
║  │  │  GET  /api/v1/task/:id      →  Get task status (SSE/Polling)              │ │  ║
║  │  │  GET  /api/v1/agents        →  List all connected agents                  │ │  ║
║  │  │  GET  /api/v1/health        →  System health check                        │ │  ║
║  │  │  POST /api/v1/webhook       →  Webhook receiver                           │ │  ║
║  │  └───────────────────────────────────────────────────────────────────────────┘ │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                       │                                               ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                                 🧠 ORCHESTRATOR CORE                                  ║
║                              (packages/orchestrator)  [ ✅ BUILT ]                    ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │  ║
║  │  │   Brain     │ │  Thinking   │ │    Task     │ │   Redis     │               │  ║
║  │  │    Core     │ │   Engine    │ │   Manager   │ │ Checkpoint  │               │  ║
║  │  │  [ ✅ ]     │ │  [ ✅ ]     │ │   [ ✅ ]    │ │   [ ✅ ]    │               │  ║
║  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘               │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                       │                                               ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                   🔌 PLUG-AND-PLAY AGENT LOADER (Dynamic Registry)                    ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                          agents/                                                │  ║
║  │  ┌───────────────────────────────────────────────────────────────────────────┐ │  ║
║  │  │   📁 core/                                                                │ │  ║
║  │  │     ├── 📁 auth/        →  [ ✅ Person 1 ]  AuthAgent                     │ │  ║
║  │  │     ├── 📁 security/    →  [ ✅ Person 1 ]  SecurityAgent                 │ │  ║
║  │  │     ├── 📁 monitoring/  →  [ ✅ Person 1 ]  MonitoringAgent               │ │  ║
║  │  │     ├── 📁 database/    →  [ 🔌 DROP ZONE ] DatabaseAgent (Person 2)      │ │  ║
║  │  │     ├── 📁 api/         →  [ 🔌 DROP ZONE ] ApiAgent (Person 3)           │ │  ║
║  │  │     └── 📁 queue/       →  [ 🔌 DROP ZONE ] QueueAgent (Person 2)         │ │  ║
║  │  │                                                                           │ │  ║
║  │  │   📁 specialized/                                                         │ │  ║
║  │  │     ├── 📁 cicd/        →  [ 🔌 DROP ZONE ] CICDAgent (Person 3)          │ │  ║
║  │  │     ├── 📁 infra/       →  [ 🔌 DROP ZONE ] InfraAgent (Person 3)         │ │  ║
║  │  │     └── 📁 microservice/→  [ 🔌 DROP ZONE ] MicroserviceAgent (Person 4)  │ │  ║
║  │  │                                                                           │ │  ║
║  │  │   📁 support/                                                             │ │  ║
║  │  │     ├── 📁 test/        →  [ 🔌 DROP ZONE ] TestAgent (Person 2)          │ │  ║
║  │  │     ├── 📁 codegen/     →  [ 🔌 DROP ZONE ] CodeGenAgent (Person 4)       │ │  ║
║  │  │     └── 📁 email/       →  [ 🔌 DROP ZONE ] EmailAgent (Person 4)         │ │  ║
║  │  └───────────────────────────────────────────────────────────────────────────┘ │  ║
║  │                                                                                 │  ║
║  │  🔌 HOW DRAG-AND-DROP WORKS:                                                    │  ║
║  │  1. Other team members create their agent in `agents/{tier}/{agent-name}/`     │  ║
║  │  2. They export a class implementing `IAgent` interface from `index.ts`        │  ║
║  │  3. AgentLoader scans directories and auto-registers valid agents              │  ║
║  │  4. No core code changes needed - just drop the folder!                        │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                       │                                               ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                         ⚙️ ASYNC JOB QUEUE (BullMQ + Redis)                           ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐                 │  ║
║  │  │  HTTP POST  │───────▶│  Job Queue  │───────▶│   Worker    │                 │  ║
║  │  │  /api/task  │        │  (BullMQ)   │        │ (Orchestr.) │                 │  ║
║  │  └─────────────┘        └─────────────┘        └─────────────┘                 │  ║
║  │         │                      │                      │                        │  ║
║  │         │ Returns job_id       │ Persisted            │ Runs Brain.execute()   │  ║
║  │         ▼                      ▼                      ▼                        │  ║
║  │  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐                 │  ║
║  │  │  Client     │◀───────│   Redis     │◀───────│  Progress   │                 │  ║
║  │  │  (Polling)  │        │  (State)    │        │  Updates    │                 │  ║
║  │  └─────────────┘        └─────────────┘        └─────────────┘                 │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                       ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                         💾 DATABASE LAYER (Supabase)                                  ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                                 │  ║
║  │   ┌─────────────────────────────┐    ┌─────────────────────────────┐           │  ║
║  │   │  📊 POSTGRES (Relational)   │    │  🧠 VECTOR DB (pgvector)    │           │  ║
║  │   │  - users                    │    │  - knowledge_embeddings    │           │  ║
║  │   │  - projects                 │    │  - code_snippets           │           │  ║
║  │   │  - tasks                    │    │  - documentation           │           │  ║
║  │   │  - audit_logs               │    │                            │           │  ║
║  │   │  - api_keys                 │    │                            │           │  ║
║  │   └─────────────────────────────┘    └─────────────────────────────┘           │  ║
║  │                                                                                 │  ║
║  │   ┌─────────────────────────────┐    ┌─────────────────────────────┐           │  ║
║  │   │  🔐 SUPABASE AUTH           │    │  📂 SUPABASE STORAGE        │           │  ║
║  │   │  - JWT tokens               │    │  - Generated code files    │           │  ║
║  │   │  - OAuth providers          │    │  - Project archives        │           │  ║
║  │   │  - Row Level Security (RLS) │    │  - Template assets         │           │  ║
║  │   └─────────────────────────────┘    └─────────────────────────────┘           │  ║
║  │                                                                                 │  ║
║  └─────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                       ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║                      📊 MONITORING & OBSERVABILITY                                    ║
║                                                                                       ║
║  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          ║
║  │   Datadog     │  │    Sentry     │  │   Winston     │  │  Prometheus   │          ║
║  │   (APM)       │  │   (Errors)    │  │   (Logs)      │  │   (Metrics)   │          ║
║  │   [ ✅ ]      │  │   [ ✅ ]      │  │   [pending]   │  │   [pending]   │          ║
║  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘          ║
║                                                                                       ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🏷️ Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ✅ BUILT ]` | Implemented and functional |
| `[pending]` | Needs to be built by Person 1 |
| `[ 🔌 DROP ZONE ]` | Reserved for other team members to drop their agents |

---

## �️ PRODUCTION TECH STACK

**Framework Decision Made:** December 10, 2024

### Core Server Stack
| Technology | Purpose | Version |
|------------|---------|---------|
| **Fastify** | HTTP Server Framework | v5.x |
| **TypeScript** | Language | v5.x |
| **Pino** | Logging (built into Fastify) | v9.x |
| **Zod** | Schema Validation | v3.x |

### Fastify Plugins
| Plugin | Purpose |
|--------|---------|
| `@fastify/cors` | Cross-Origin Resource Sharing |
| `@fastify/helmet` | Security Headers |
| `@fastify/rate-limit` | Rate Limiting with Redis |
| `@fastify/swagger` | OpenAPI Documentation |
| `@fastify/jwt` | JWT Token Verification |

### Why Fastify Over Express?
1. **2-3x Performance Boost** - Critical for handling concurrent AI orchestration requests
2. **First-Class TypeScript** - Full type inference without additional packages
3. **Plugin Encapsulation** - Matches our plug-and-play agent architecture
4. **Built-in Logging** - Pino integration with JSON logging for production
5. **Schema-Based Validation** - JSON Schema validation complements Zod
6. **Native Async/Await** - No callback hell, clean error handling
7. **SSE Support** - Native support for Server-Sent Events (task streaming)

### Why NOT Vite/Next.js?
These are **frontend/fullstack frameworks**, not backend API servers:
- **Vite** = Build tool for React/Vue frontends
- **Next.js** = React meta-framework with limited API routes
- Our project needs a **dedicated backend** with BullMQ workers, Redis checkpointing, and complex agent orchestration

## �🔌 Agent Interface Contract

All agents MUST implement this interface to be auto-loaded:

```typescript
// packages/shared/src/interfaces/IAgent.ts

export interface IAgent {
  /** Unique identifier for the agent */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Agent tier: 1 (Core), 2 (Specialized), 3 (Support) */
  readonly tier: 1 | 2 | 3;
  
  /** List of capabilities this agent provides */
  readonly capabilities: string[];
  
  /** Initialize the agent with config */
  initialize(config: AgentConfig): Promise<void>;
  
  /** Execute a task and return the result */
  execute(input: AgentInput): Promise<AgentOutput>;
  
  /** Health check for the agent */
  healthCheck(): Promise<boolean>;
}

export interface AgentConfig {
  modelName?: string;
  temperature?: number;
  customSettings?: Record<string, unknown>;
}

export interface AgentInput {
  task: string;
  context?: Record<string, unknown>;
  previousOutputs?: AgentOutput[];
}

export interface AgentOutput {
  success: boolean;
  files?: GeneratedFile[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'code' | 'config' | 'doc';
}
```

---

## 📁 Target Folder Structure

```
packages/
├── api/                          # [NEW] Production Server
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── app.ts                # Fastify app setup
│   │   ├── config/               # Environment, constants
│   │   ├── middleware/           # Security, Auth, Rate Limit
│   │   ├── routes/               # API route handlers
│   │   ├── services/             # Business logic
│   │   │   ├── key-manager.ts    # API Key rotation
│   │   │   └── job-queue.ts      # BullMQ integration
│   │   └── utils/                # Helpers
│   ├── package.json
│   └── tsconfig.json
│
├── orchestrator/                 # [EXISTS] Brain Core
│   └── src/
│       ├── index.ts
│       ├── agent-loader.ts       # [NEW] Dynamic agent scanner
│       └── ...
│
├── shared/                       # [NEW] Shared types & interfaces
│   └── src/
│       └── interfaces/
│           ├── IAgent.ts         # Agent contract
│           └── index.ts
│
└── database/                     # [NEW] Supabase integration
    └── src/
        ├── client.ts             # Supabase client
        ├── migrations/           # SQL migrations
        └── services/
            ├── users.ts
            ├── projects.ts
            ├── tasks.ts
            └── vector-store.ts   # pgvector operations
```
