# API Routes Documentation

> **Last Updated:** 2024-12-19
> **Version:** 2.0.0 - CLI + Learning System Updates
> **Purpose:** Comprehensive documentation of all API endpoints across all services.
> Use this file when adding new features to know where and what to connect.

---

## Table of Contents

1. [CLI Testing Interface (NEW)](#cli-testing-interface)
2. [Health & Monitoring](#health--monitoring)
3. [Authentication](#authentication)
4. [Agents](#agents)
5. [Orchestrator](#orchestrator)
6. [Projects](#projects)
7. [Tasks](#tasks)
8. [Code Generation](#code-generation)
9. [Preview](#preview)
10. [Deployment](#deployment)
11. [Vector Store & Learning](#vector-store--learning)
12. [Services Registry](#services-registry)
13. [Connections](#connections)
14. [Templates](#templates)
15. [Webhooks](#webhooks)
16. [Real-Time Events (SSE)](#real-time-events-sse)
17. [Benchmarks](#benchmarks)
18. [Metrics](#metrics)
19. [GitHub Integration](#github-integration)

---

## CLI Testing Interface

**Package:** `packages/cli/`

The CLI provides an interactive interface for testing the backend API.

### Installation

```bash
# From project root
cd packages/cli
npm install
npm link   # Makes 'loveable' command available globally
```

### Usage

| Command | Description |
|---------|-------------|
| `loveable` | Interactive mode - shows menu |
| `loveable --generate "prompt"` | Quick generate - bypasses menu |
| `loveable --help` | Show help information |

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `baseUrl` | `http://localhost:3000` | API server URL |
| `timeout` | `660000` (11 min) | Request timeout in ms |

### Progress Animation

During code generation, the CLI shows animated progress:

```
🚀 Initializing orchestrator... [0:02]
🔍 Analyzing intent... [0:15]
📐 Building architecture blueprint... [0:32]
🧠 Processing with AI models... [1:05]
💡 Preparing response... [1:45]
⚡ Generating code files... [2:30]
📁 Writing files to disk... [3:15]
✅ Finalizing... [4:00]
```

### API Endpoints Called

| Action | Endpoint | Timeout |
|--------|----------|---------|
| Full Generate + Write | `POST /api/v1/orchestrator/execute` | 11 min |
| Quick Generate (no write) | `POST /api/v1/orchestrator/generate` | 11 min |

---

## Health & Monitoring

**File:** `packages/api/src/routes/health.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Basic health check - returns server status | No |
| `GET` | `/health/deep` | Deep health check - checks database, Vector Store, Redis, agents | No |
| `GET` | `/status` | System status - memory usage, uptime, loaded agents | No |

**Response Examples:**
```json
// GET /health
{
  "status": "healthy",
  "timestamp": "2024-12-19T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}

// GET /health/deep
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "latency": 15 },
    "vectorStore": { "status": "healthy", "tableExists": true, "functionExists": true },
    "redis": { "status": "healthy", "latency": 2 },
    "agents": { "status": "healthy", "loaded": 7, "total": 7 }
  }
}
```

---

## Authentication

**File:** `packages/api/src/routes/auth.ts`

### Core Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/auth/signup` | Register new user | No |
| `POST` | `/api/v1/auth/login` | Login user (email/password) | No |
| `POST` | `/api/v1/auth/logout` | Logout user | No |
| `POST` | `/api/v1/auth/refresh` | Refresh access token | No |
| `GET` | `/api/v1/auth/me` | Get current user profile | Yes (Bearer) |
| `GET` | `/api/v1/auth/session` | Get current Supabase session | No |

### API Key Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/auth/api-key` | Generate new API key | Yes (Bearer) |
| `GET` | `/api/v1/auth/api-keys` | List user's API keys | Yes (Bearer) |
| `DELETE` | `/api/v1/auth/api-key/:id` | Revoke API key | Yes (Bearer) |

### OAuth Social Login

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/auth/providers` | List available OAuth providers | No |
| `GET` | `/api/v1/auth/oauth/:provider` | Initiate OAuth flow (github, google, gitlab) | No |
| `GET` | `/api/v1/auth/callback` | OAuth callback handler | No |
| `POST` | `/api/v1/auth/oauth/link/:provider` | Link OAuth provider to existing account | Yes (Bearer) |

---

## Agents

**File:** `packages/api/src/routes/agents.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/agents` | List all registered agents | No |
| `GET` | `/api/v1/agents/:id` | Get agent details by ID | No |
| `GET` | `/api/v1/agents/:id/health` | Check agent health | No |
| `GET` | `/api/v1/agents/capabilities` | List all capabilities across agents | No |
| `GET` | `/api/v1/agents/summary` | Get agent summary grouped by tier/status | No |

**Query Parameters for `/api/v1/agents`:**
- `tier` (1-3): Filter by agent tier
- `capability` (string): Filter by specific capability

---

## Orchestrator

**File:** `packages/api/src/routes/orchestrator.ts`

### Core Execution

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/orchestrator/execute` | Execute AI task with orchestration | No |
| `POST` | `/api/v1/orchestrator/chat` | Chat with AI (conversational) | No |
| `GET` | `/api/v1/orchestrator/status` | Get orchestrator status | No |
| `GET` | `/api/v1/orchestrator/agents` | List agents available to orchestrator | No |

### Analysis & Thinking

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/orchestrator/think` | Perform AI thinking/analysis on task | No |

### Context & Generation

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/orchestrator/context/:projectId` | Get project context | No |
| `POST` | `/api/v1/orchestrator/agents/:agentId/execute` | Execute specific agent | No |
| `POST` | `/api/v1/orchestrator/blueprint` | Generate architecture blueprint | No |
| `POST` | `/api/v1/orchestrator/generate` | Full code generation pipeline | No |

### Interactive Generation

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/orchestrator/generate-interactive` | Start interactive generation | No |
| `POST` | `/api/v1/orchestrator/generate-interactive/submit` | Submit interactive choice | No |

### Learning System

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/orchestrator/learning/stats` | Get learning statistics | No |
| `GET` | `/api/v1/orchestrator/learning/patterns` | Get learned patterns | No |

---

## Projects

**File:** `packages/api/src/routes/projects.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/projects` | Create new project | No |
| `GET` | `/api/v1/projects` | List projects | No |
| `GET` | `/api/v1/projects/:id` | Get project by ID | No |
| `PUT` | `/api/v1/projects/:id` | Update project | No |
| `DELETE` | `/api/v1/projects/:id` | Delete project | No |
| `GET` | `/api/v1/projects/:id/download` | Download project files | No |

**Query Parameters for `/api/v1/projects`:**
- `status` (pending|generating|completed|failed): Filter by status
- `limit` (1-100): Number of results (default: 20)
- `offset` (number): Pagination offset (default: 0)

---

## Tasks

**File:** `packages/api/src/routes/tasks.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/tasks` | Create/submit new task | No |
| `GET` | `/api/v1/tasks` | List tasks | No |
| `GET` | `/api/v1/tasks/:id` | Get task by ID | No |
| `GET` | `/api/v1/tasks/:id/stream` | Stream task progress (SSE) | No |
| `DELETE` | `/api/v1/tasks/:id` | Delete/cancel task | No |

**Query Parameters for `/api/v1/tasks`:**
- `status` (queued|processing|completed|failed): Filter by status
- `limit` (1-100): Number of results (default: 20)
- `offset` (number): Pagination offset (default: 0)

---

## Code Generation

### Base CodeGen

**File:** `packages/api/src/routes/codegen.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/codegen/project` | Generate complete project (multi-language) | No |
| `POST` | `/codegen/module` | Generate single module for existing project | No |
| `GET` | `/codegen/languages` | Get supported languages/frameworks | No |
| `GET` | `/codegen/health` | Check CodeGen service health | No |

**Supported Languages:**
- TypeScript: express, fastify, nestjs, nextjs
- Python: fastapi, django, flask
- Go: gin, echo, fiber
- Rust: actix, rocket, axum
- Java: spring, quarkus, micronaut

### Enhanced CodeGen (Phase 17)

**File:** `packages/api/src/routes/enhanced-codegen.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/codegen/generate` | Generate project with advanced features | No |
| `GET` | `/api/v1/codegen/languages` | Get supported configs | No |
| `POST` | `/api/v1/codegen/scaffold` | Generate project scaffolding only | No |

---

## Preview

**File:** `packages/api/src/routes/preview.ts`

### Session Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/preview/status` | Get preview service status | No |
| `POST` | `/api/v1/preview` | Create/update preview session | No |
| `GET` | `/api/v1/preview/:sessionId` | Get preview HTML (for iframe) | No |
| `GET` | `/api/v1/preview/:sessionId/html` | Get raw preview HTML as JSON | No |
| `DELETE` | `/api/v1/preview/:sessionId` | Delete preview session | No |

### Hot Module Replacement (HMR)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/preview/:sessionId/refresh` | Trigger HMR refresh | No |
| `POST` | `/api/v1/preview/:sessionId/files` | Update files (triggers HMR) | No |
| `GET` | `/api/v1/preview/:sessionId/stream` | SSE stream for HMR updates | No |

### Collaboration

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/preview/:sessionId/collaborate/join` | Join collaboration session | No |
| `POST` | `/api/v1/preview/:sessionId/collaborate/cursor` | Update cursor position | No |
| `GET` | `/api/v1/preview/:sessionId/collaborate` | Get collaboration state | No |
| `POST` | `/api/v1/preview/:sessionId/collaborate/leave` | Leave collaboration | No |

---

## Deployment

**File:** `packages/api/src/routes/deployment.ts`

### Deployment Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/deployments/status` | Get deployment service status | No |
| `GET` | `/api/v1/deployments/stream/:id` | SSE stream for deployment progress | No |
| `POST` | `/api/v1/projects/:id/deploy` | Deploy project | No |
| `GET` | `/api/v1/projects/:id/deployments` | List project deployments | No |
| `GET` | `/api/v1/projects/:id/preview` | Get current preview URL | No |
| `POST` | `/api/v1/projects/:id/deployments/:deployId/rollback` | Rollback deployment | No |
| `DELETE` | `/api/v1/projects/:id/site` | Delete deployment site | No |

### Auto-Deployment

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/projects/:id/auto-deploy` | Trigger auto-deployment | No |
| `GET` | `/api/v1/projects/:id/deployment-history` | Get deployment history | No |
| `DELETE` | `/api/v1/projects/:id/pending-deploy` | Cancel pending auto-deploy | No |

---

## Vector Store & Learning

**File:** `packages/api/src/routes/vector-learning.ts`

### Vector Store (Embeddings)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/vector/index/file` | Index single file | No |
| `POST` | `/api/v1/vector/index/project` | Index entire project | No |
| `POST` | `/api/v1/vector/search` | Semantic similarity search | No |
| `POST` | `/api/v1/vector/context` | Build context from query | No |
| `DELETE` | `/api/v1/vector/project/:projectId` | Delete project embeddings | No |

### Learning System

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/learning/iteration` | Store generation iteration | No |
| `POST` | `/api/v1/learning/test-iteration` | Store test iteration | No |
| `POST` | `/api/v1/learning/feedback` | Submit feedback on iteration | No |
| `POST` | `/api/v1/learning/pre-context` | Build pre-context for prompt | No |
| `GET` | `/api/v1/learning/statistics` | Get learning statistics | No |
| `GET` | `/api/v1/learning/patterns` | Get learned patterns | No |

### Learning System Database Functions (Phase 23)

> **Note:** These are PostgreSQL functions called via Supabase RPC. They require migration `014_fix_vector_search_functions.sql`.

| Function | Parameters | Description |
|----------|------------|-------------|
| `match_code_embeddings` | `query_embedding`, `match_threshold`, `match_count`, `filter_project_id`, `filter_language` | Vector similarity search for code |
| `match_knowledge_embeddings` | `query_embedding`, `match_threshold`, `match_count`, `p_project_id` | Vector similarity search for knowledge |
| `search_generation_iterations` | `search_query`, `max_results`, `only_successful` | Text similarity search for past generations |
| `get_successful_iterations` | `p_language`, `p_framework`, `p_limit` | Fetch successful past generations |
| `get_learned_patterns` | `p_pattern_type`, `p_min_confidence`, `p_limit` | Fetch learned patterns by type |
| `get_learning_stats` | (none) | Get overall learning system statistics |

### Learning Search Strategy

The learning service uses a 4-tier search strategy to find relevant past experiences:

1. **RPC Search** - Uses `search_generation_iterations` for text similarity
2. **Keyword Matching** - Direct DB query extracting keywords from prompt
3. **Vector Search** - Semantic similarity using embeddings
4. **Memory Fallback** - In-memory Jaccard text similarity

---

## Services Registry

**File:** `packages/api/src/routes/services/index.ts`

**Prefix:** `/api/v1/services`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/services` | List all available services | No |
| `GET` | `/api/v1/services/stats` | Get service registry statistics | No |
| `GET` | `/api/v1/services/categories` | List all categories with counts | No |
| `GET` | `/api/v1/services/search?q=query` | Search services | No |
| `GET` | `/api/v1/services/category/:category` | Get services by category | No |
| `GET` | `/api/v1/services/:id` | Get full service details | No |
| `GET` | `/api/v1/services/:id/templates` | Get code templates for service | No |

---

## Connections

**File:** `packages/api/src/routes/connections/index.ts`

**Prefix:** `/api/v1/connections`

> **Note:** All connection routes require authentication.

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/connections` | List user connections | Yes |
| `POST` | `/api/v1/connections` | Create new connection | Yes |
| `GET` | `/api/v1/connections/:id` | Get connection details | Yes |
| `PUT` | `/api/v1/connections/:id` | Update connection | Yes |
| `DELETE` | `/api/v1/connections/:id` | Delete connection | Yes |
| `POST` | `/api/v1/connections/:id/test` | Test connection | Yes |
| `GET` | `/api/v1/connections/stats` | Get usage statistics | Yes |

---

## Templates

**File:** `packages/api/src/routes/templates.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/templates` | List all templates | No |
| `GET` | `/api/v1/templates/:category` | Get templates by category | No |
| `GET` | `/api/v1/templates/:category/:templateId` | Get specific template | No |
| `POST` | `/api/v1/templates/generate` | Generate code from template | No |

**Template Categories:**
- `auth`: Clerk, JWT, OAuth, RBAC, MFA
- `security`: Helmet, Rate Limiting, Input Sanitization
- `monitoring`: Datadog APM, Sentry, Health Checks

---

## Webhooks

**File:** `packages/api/src/routes/webhooks.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/webhooks/supabase` | Supabase Auth webhook handler | Signature |
| `POST` | `/api/v1/webhooks/stripe` | Stripe payment webhook handler | Signature |
| `POST` | `/api/v1/webhooks/github` | GitHub events webhook handler | Signature |

---

## Real-Time Events (SSE)

**File:** `packages/api/src/routes/websocket.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/events` | Global events stream | No |
| `GET` | `/api/v1/events/tasks/:taskId` | Task-specific events stream | No |
| `GET` | `/api/v1/events/agents` | Agent events stream | No |
| `GET` | `/api/v1/events/orchestrator` | Orchestrator events stream | No |

---

## Benchmarks

**File:** `packages/api/src/routes/benchmarks.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/benchmarks` | Get all benchmarks summary | No |
| `GET` | `/api/v1/benchmarks/agents/:agentId` | Get agent-specific metrics | No |
| `GET` | `/api/v1/benchmarks/orchestrator` | Get orchestrator metrics | No |
| `POST` | `/api/v1/benchmarks/run` | Run benchmark suite | No |
| `GET` | `/api/v1/benchmarks/scenarios` | Get available scenarios | No |
| `POST` | `/api/v1/benchmarks/scenarios/:id/run` | Run single scenario | No |
| `DELETE` | `/api/v1/benchmarks` | Clear all benchmark data | No |

---

## Metrics

**File:** `packages/api/src/routes/metrics.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/metrics` | Prometheus-format metrics | No |
| `GET` | `/metrics/json` | JSON-format metrics | No |

---

## GitHub Integration

**File:** `packages/api/src/routes/deployment.ts` (githubRoutes)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/v1/github/auth` | Start GitHub OAuth flow | No |
| `GET` | `/api/v1/github/callback` | GitHub OAuth callback | No |
| `POST` | `/api/v1/github/repos` | Create new GitHub repository | Token |
| `POST` | `/api/v1/github/repos/:owner/:repo/commit` | Commit files to repository | Token |

---

## Project Structure Reference

```
packages/
├── api/
│   └── src/
│       ├── routes/           # All API route definitions
│       │   ├── index.ts      # Route registration
│       │   ├── agents.ts
│       │   ├── auth.ts
│       │   ├── benchmarks.ts
│       │   ├── codegen.ts
│       │   ├── deployment.ts
│       │   ├── enhanced-codegen.ts
│       │   ├── health.ts
│       │   ├── metrics.ts
│       │   ├── orchestrator.ts
│       │   ├── preview.ts
│       │   ├── projects.ts
│       │   ├── tasks.ts
│       │   ├── templates.ts
│       │   ├── vector-learning.ts
│       │   ├── webhooks.ts
│       │   ├── websocket.ts
│       │   ├── services/
│       │   │   └── index.ts
│       │   └── connections/
│       │       └── index.ts
│       └── services/         # Business logic services
├── database/
│   └── src/
│       └── services/         # Database service layer
├── orchestrator/
│   └── src/                  # Graph-based orchestrator
└── cli/
    └── src/                  # CLI application

agents/
├── core/                     # Core agents (Auth, Database, Security, etc.)
├── specialized/              # Specialized agents (CI/CD, Infra)
└── support/                  # Support agents (CodeGen, Test)
```

---

## Adding New Routes

When adding new endpoints:

1. **Create route file** in `packages/api/src/routes/`
2. **Register in index.ts** - Add import and call registration function
3. **Add services** if needed in `packages/api/src/services/`
4. **Update this documentation**

### Example Route Template

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerMyRoutes(app: FastifyInstance): Promise<void> {
    app.get('/api/v1/my-endpoint', {
        schema: {
            tags: ['MyCategory'],
            summary: 'Short description',
            description: 'Detailed description',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        return { success: true };
    });

    app.log.info('[ROUTES] My routes registered');
}
```

---

## Related Files

- **Route Registration:** `packages/api/src/routes/index.ts`
- **Server Entry:** `packages/api/src/index.ts`
- **App Setup:** `packages/api/src/app.ts`
- **Project Context:** `docs/project/PROJECT_CONTEXT.md`
- **System Architecture:** `docs/Whole system.md`
