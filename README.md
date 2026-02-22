# LOVEABLE Backend Orchestrator

**AI-Powered Multi-Agent Code Generation Platform**

---

## Executive Summary

LOVEABLE is an enterprise-grade backend orchestration platform that leverages specialized AI agents to automatically generate production-ready backend code. The system uses a sophisticated multi-model pipeline combining fast analysis models with powerful code generation models to deliver complete, runnable backend solutions from natural language prompts.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Agents & Capabilities](#agents--capabilities)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Security](#security)
- [Performance](#performance)
- [Testing](#testing)
- [Deployment](#deployment)
- [Team](#team)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

### Problem Statement

Building production-ready backend systems requires:
- Deep knowledge of multiple frameworks and patterns
- Consistent implementation of security best practices
- Proper database schema design and migrations
- Comprehensive API documentation
- Monitoring, logging, and error handling
- CI/CD pipeline configuration

This typically takes weeks of development time and requires expertise across multiple domains.

### Solution

LOVEABLE automates backend development through:
- **Multi-Agent Orchestration**: Specialized agents handle different aspects (auth, database, API, security)
- **AI-Powered Generation**: Uses state-of-the-art LLMs for intelligent code generation
- **Blueprint Enforcement**: Ensures generated code follows architectural patterns
- **Quality Assurance**: Automated verification and syntax fixing
- **Learning System**: Vector-based learning from past generations

---

## Key Features

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| Multi-Model Pipeline | Fast analysis + powerful code generation | Complete |
| Multi-Language Support | TypeScript, Python, Go, Rust, Java | Complete |
| Framework Detection | Auto-detects NestJS, Express, FastAPI, Django | Complete |
| Vector Learning | Learns from successful generations | Complete |
| Blueprint Enforcement | Ensures complete, runnable output | Complete |
| Auto-Deploy | Netlify/Vercel integration | Complete |
| Real-time Preview | Live code preview via WebSocket | Complete |
| TUI Interface | Terminal-based user interface | Complete |

### Security Features

| Feature | Description | Status |
|---------|-------------|--------|
| JWT Authentication | Supabase-backed authentication | Complete |
| Rate Limiting | Redis-backed tiered limits | Complete |
| Security Headers | CSP, HSTS, Permissions-Policy | Complete |
| API Key Rotation | Automatic key management | Complete |
| Webhook Verification | Mandatory signature verification | Complete |
| Request Size Limits | Tiered by route type | Complete |

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOVEABLE BACKEND PLATFORM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────┐    │
│  │   Client    │    │              API GATEWAY (Fastify)               │    │
│  │  (Web/TUI)  │───▶│  /api/v1/orchestrator  /api/v1/codegen          │    │
│  └─────────────┘    │  /api/v1/auth          /api/v1/preview          │    │
│                     │  /api/v1/projects      /api/v1/context           │    │
│                     └─────────────────────────────────────────────────┘    │
│                                        │                                     │
│                     ┌──────────────────▼──────────────────┐                │
│                     │       INTEGRATED ORCHESTRATOR        │                │
│                     │  ┌─────────────────────────────────┐ │                │
│                     │  │    Orchestration Services       │ │                │
│                     │  │  • ContextService               │ │                │
│                     │  │  • AnalysisService              │ │                │
│                     │  │  • GenerationService            │ │                │
│                     │  │  • FileService                  │ │                │
│                     │  │  • QualityService               │ │                │
│                     │  │  • PersistenceService           │ │                │
│                     │  └─────────────────────────────────┘ │                │
│                     └──────────────────┬──────────────────┘                │
│                                        │                                     │
│  ┌─────────────────────────────────────┼─────────────────────────────────┐ │
│  │                         AI PIPELINE                                   │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐ │ │
│  │  │  Fast Model   │─▶│ Architecture  │─▶│    Power Model            │ │ │
│  │  │  (Analysis)   │  │   Blueprint   │  │    (Code Generation)      │ │ │
│  │  │   Groq LLM    │  │   Generator   │  │       Z.AI GLM-4          │ │ │
│  │  └───────────────┘  └───────────────┘  └───────────────────────────┘ │ │
│  └─────────────────────────────────────┬─────────────────────────────────┘ │
│                                        │                                     │
│  ┌─────────────────────────────────────┼─────────────────────────────────┐ │
│  │                    GENERATION PIPELINE                                │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │ │
│  │  │ Deduplicate │▶│   Inject    │▶│   Import    │▶│     Final       │ │ │
│  │  │   Files     │ │  Decorators │ │   Resolve   │ │  Verification   │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         DATA LAYER                                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │
│  │  │  Supabase   │  │    Redis    │  │   Vector    │  │  File       │  │ │
│  │  │  (Postgres) │  │   (Cache)   │  │   Store     │  │  Storage    │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TIER 1: Core Agents          TIER 2: Specialized Agents        │
│  ┌──────────────┐             ┌──────────────────────┐          │
│  │  AuthAgent   │             │   SecurityAgent      │          │
│  │  • JWT/OAuth │             │   • SAST/DAST        │          │
│  │  • RBAC/ABAC │             │   • Threat Detection │          │
│  │  • MFA       │             │   • WAF Rules        │          │
│  └──────────────┘             └──────────────────────┘          │
│  ┌──────────────┐             ┌──────────────────────┐          │
│  │ DatabaseAgent│             │    QueueAgent        │          │
│  │  • Schema    │             │   • BullMQ           │          │
│  │  • Migrations│             │   • Job Scheduling   │          │
│  │  • Seeding   │             │   • Event Queue      │          │
│  └──────────────┘             └──────────────────────┘          │
│  ┌──────────────┐             ┌──────────────────────┐          │
│  │   APIAgent   │             │    CICDAgent         │          │
│  │  • REST      │             │   • GitHub Actions   │          │
│  │  • GraphQL   │             │   • Docker/K8s       │          │
│  │  • tRPC      │             │   • Deployments      │          │
│  └──────────────┘             └──────────────────────┘          │
│                                                                  │
│  TIER 3: Support Agents       TIER 4: Special Purpose           │
│  ┌──────────────┐             ┌──────────────────────┐          │
│  │MonitorAgent  │             │   CodegenAgent       │          │
│  │  • APM       │             │   • Scaffolding      │          │
│  │  • Sentry    │             │   • Templates        │          │
│  │  • Metrics   │             │   • Boilerplate      │          │
│  └──────────────┘             └──────────────────────┘          │
│  ┌──────────────┐             ┌──────────────────────┐          │
│  │  TestAgent   │             │ MicroserviceAgent    │          │
│  │  • Vitest    │             │   • Service Mesh     │          │
│  │  • Playwright│             │   • gRPC             │          │
│  │  • Coverage  │             │   • Event-Driven     │          │
│  └──────────────┘             └──────────────────────┘          │
│  ┌──────────────┐             ┌──────────────────────┐          │
│  │ InfraAgent   │             │    EmailAgent        │          │
│  │  • Terraform │             │   • Resend           │          │
│  │  • Docker    │             │   • Nodemailer       │          │
│  │  • Cloud     │             │   • Templates        │          │
│  └──────────────┘             └──────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Node.js | 18+ | Server runtime |
| Framework | Fastify | 5.1.0 | High-performance API server |
| Language | TypeScript | 5.7.2 | Type-safe development |
| Validation | Zod | 3.23.8 | Schema validation |

### AI/ML

| Component | Technology | Purpose |
|-----------|------------|---------|
| Fast Model | Groq (LLaMA 3.3 70B) | Quick analysis, intent detection |
| Power Model | Z.AI (GLM-4.6) | Code generation |
| Vector Store | Supabase pgvector | Embedding storage & retrieval |

### Data Storage

| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary Database | Supabase (PostgreSQL) | User data, projects, iterations |
| Cache Layer | Redis (ioredis) | Rate limiting, caching, sessions |
| Vector Store | pgvector | Semantic search, learning |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Deployment | Docker, Kubernetes | Containerization |
| CI/CD | GitHub Actions | Automated pipelines |
| Monitoring | Sentry | Error tracking |
| Logging | Pino | Structured logging |

---

## Quick Start

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Redis (for caching and rate limiting)
- Supabase account (for database and auth)

### Installation

```bash
# Clone the repository
git clone https://github.com/YuvrajZende/Project-Meteoroid.git
cd "Project backend"

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your API keys in .env
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Server
PORT=3000
NODE_ENV=development

# AI Models
ZAI_API_KEY=your-zai-api-key
GROQ_API_KEY=your-groq-api-key

# Database (Supabase)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret

# Optional: Monitoring
SENTRY_DSN=your-sentry-dsn
```

### Running the Server

```bash
# Development mode with hot reload
cd packages/api
npm run dev

# Production build
npm run build
npm start
```

The server will be available at `http://localhost:3000`

### Using the TUI

```bash
# Run the Terminal User Interface
./run_tui.bat    # Windows
# or
go run ./packages/tui/cmd/main.go    # Direct Go execution
```

---

## API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Core Endpoints

#### Orchestrator

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orchestrator/execute` | Execute code generation task |
| GET | `/orchestrator/status/:taskId` | Get task status |
| GET | `/orchestrator/stream/:taskId` | SSE stream for real-time updates |

#### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create new project |
| GET | `/projects/:id` | Get project details |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |

#### Code Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/codegen/generate` | Generate code from prompt |
| POST | `/codegen/enhanced` | Enhanced generation with features |
| GET | `/codegen/templates` | List available templates |

#### Context Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/context/create` | Create new context |
| GET | `/context/:id` | Get context details |
| PUT | `/context/:id` | Update context |
| DELETE | `/context/:id` | Delete context |

#### Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/benchmarks` | Performance benchmarks |

### Example Request

```bash
# Generate a backend for a bakery system
curl -X POST http://localhost:3000/api/v1/orchestrator/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Create a backend for a bakery management system with multiple outlets, inventory tracking, and order management",
    "userId": "user-123",
    "options": {
      "language": "typescript",
      "framework": "nestjs",
      "features": ["auth", "crud", "validation"]
    }
  }'
```

### API Documentation

Interactive API documentation is available at:
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI Spec: `http://localhost:3000/docs/json`

---

## Agents & Capabilities

### Total: 12 Agents | 62 Capabilities

| Agent | Capabilities Count | Primary Functions |
|-------|-------------------|-------------------|
| AuthAgent | 8 | JWT, OAuth, RBAC, ABAC, MFA, Sessions, Password Security, Rate Limiting |
| DatabaseAgent | 6 | Schema Design, Migrations, Seeding, Prisma, Drizzle, TypeORM |
| APIAgent | 5 | REST, GraphQL, tRPC, OpenAPI, Validation |
| SecurityAgent | 7 | SAST, DAST, Bot Protection, WAF, Threat Detection, API Keys, Security Testing |
| MonitoringAgent | 8 | APM, Sentry, Metrics, Health Checks, Logging, Tracing, Alerting, Audit |
| TestAgent | 4 | Vitest, Jest, Playwright, Coverage Reports |
| CICDAgent | 4 | GitHub Actions, Docker, Kubernetes, Deployments |
| QueueAgent | 3 | BullMQ, Redis Queues, Job Scheduling |
| InfraAgent | 4 | Terraform, Docker, Cloud Providers, Infrastructure as Code |
| CodegenAgent | 4 | File Generation, Scaffolding, Boilerplate, Templates |
| MicroserviceAgent | 4 | Service Mesh, gRPC, Event-Driven, API Gateway |
| EmailAgent | 3 | Resend, Nodemailer, Email Templates |

---

## Project Structure

```
Project backend/
├── packages/
│   ├── api/                          # Main API server
│   │   ├── src/
│   │   │   ├── app.ts                # Fastify application setup
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── routes/               # API route handlers (19 files)
│   │   │   │   ├── orchestrator.ts   # Main orchestration endpoint
│   │   │   │   ├── projects.ts       # Project management
│   │   │   │   ├── tasks.ts          # Task management
│   │   │   │   ├── auth.ts           # Authentication
│   │   │   │   ├── webhooks.ts       # Webhook handling
│   │   │   │   └── ...
│   │   │   ├── application/          # Application layer
│   │   │   │   └── services/
│   │   │   │       ├── orchestration/    # Orchestration services
│   │   │   │       │   ├── integrated-orchestrator.ts
│   │   │   │       │   ├── multi-model-orchestrator.ts
│   │   │   │       │   └── services/     # Extracted services
│   │   │   │       │       ├── orchestration-context.service.ts
│   │   │   │       │       ├── orchestration-analysis.service.ts
│   │   │   │       │       ├── orchestration-generation.service.ts
│   │   │   │       │       ├── orchestration-file.service.ts
│   │   │   │       │       ├── orchestration-quality.service.ts
│   │   │   │       │       └── orchestration-persistence.service.ts
│   │   │   │       ├── generation/      # Code generation
│   │   │   │       └── validation/      # Validation services
│   │   │   │           ├── file-deduplicator.ts
│   │   │   │           ├── import-resolver.ts
│   │   │   │           ├── final-verifier.ts
│   │   │   │           └── unified-generation-pipeline.ts
│   │   │   ├── domain/              # Domain layer
│   │   │   │   └── services/
│   │   │   │       ├── architecture/    # Architecture services
│   │   │   │       ├── context/         # Context management
│   │   │   │       └── learning/        # Learning services
│   │   │   ├── infrastructure/      # Infrastructure layer
│   │   │   │   ├── database/            # Database clients
│   │   │   │   ├── cache/               # Redis cache
│   │   │   │   ├── key-manager.ts       # API key management
│   │   │   │   └── file-writer.ts       # File output
│   │   │   ├── repositories/        # Data access layer
│   │   │   ├── middleware/          # Express middleware
│   │   │   ├── plugins/             # Fastify plugins
│   │   │   └── interfaces/          # TypeScript interfaces
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── database/                    # Database package
│   │   └── migrations/              # SQL migrations
│   ├── shared/                      # Shared utilities
│   └── tui/                         # Terminal UI (Go)
│       ├── cmd/main.go
│       └── internal/
│           ├── api/                 # API client
│           └── tui/                 # TUI components
├── docs/                            # Documentation
│   ├── README.md
│   ├── Issues/                      # Issue reports
│   └── archive/                     # Archived docs
├── output/                          # Generated code output
├── .env.example                     # Environment template
├── package.json                     # Root package.json
├── tsconfig.json                    # TypeScript config
└── README.md                        # This file
```

---

## Configuration

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Fastify Configuration

```typescript
// app.ts
const app = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  },
  bodyLimit: 10 * 1024 * 1024, // 10MB
  trustProxy: true
});
```

### Rate Limiting Configuration

```typescript
// Tiered rate limits
const rateLimits = {
  auth: { max: 10, timeWindow: '1 minute' },
  orchestrator: { max: 20, timeWindow: '1 minute' },
  api: { max: 100, timeWindow: '1 minute' },
  upload: { max: 10, timeWindow: '1 minute' }
};
```

---

## Security

### Security Score: 8/10

| Measure | Implementation | Status |
|---------|---------------|--------|
| Authentication | Supabase JWT + API Keys | Complete |
| Authorization | Role-Based Access Control | Complete |
| Input Validation | Zod schemas on all endpoints | Complete |
| Rate Limiting | Redis-backed, tiered limits | Complete |
| Security Headers | Helmet (CSP, HSTS, etc.) | Complete |
| API Key Management | Rotation, blacklisting, health | Complete |
| Webhook Security | Mandatory signature verification | Complete |
| Request Size Limits | Tiered by route type | Complete |

### Security Headers Applied

```
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), microphone=()
```

---

## Performance

### Performance Score: 8/10

| Optimization | Implementation | Status |
|--------------|---------------|--------|
| Connection Pooling | Supabase pooler support | Complete |
| Caching | Redis cache layer | Complete |
| N+1 Prevention | Batch loading, JOINs | Complete |
| Query Optimization | 30+ database indexes | Complete |
| Memory Management | Context cleanup, TTL | Complete |
| Lazy Loading | Cursor-based pagination | Complete |

### Database Indexes

- **Projects**: 5 indexes (user, status, composite, partial)
- **Tasks**: 10 indexes (project, user, status, type, composite)
- **Embeddings**: 4 indexes (project, language, category)
- **Audit Logs**: 5 indexes (user, project, action, entity)

---

## Testing

### Test Structure

```
packages/api/src/
├── repositories/__tests__/     # Repository unit tests
│   ├── project.repository.test.ts
│   ├── task.repository.test.ts
│   ├── user.repository.test.ts
│   └── ...
└── tests/                      # Integration tests
    ├── orchestrator-workflow.test.ts
    ├── integration.test.ts
    └── ...
```

### Running Tests

```bash
cd packages/api

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

### Current Test Coverage

- Test Files: 9
- Source Files: 196
- Coverage: ~5.5%

---

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Use connection pooling in production
SUPABASE_URL=your-pooler-url
SUPABASE_SERVICE_ROLE_KEY=your-key

# Redis for production
REDIS_URL=redis://production-redis:6379

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

---

## Team

| Member | Role | Responsibilities |
|--------|------|------------------|
| Team Lead | Architecture | System design, code review |
| AI/ML Engineer | AI Integration | Model selection, prompt engineering |
| Backend Developer | Core Development | API development, database |
| DevOps | Infrastructure | Deployment, monitoring |

---

## Roadmap

### Completed (Phases 1-26)

- Multi-Model Pipeline
- Tech Stack Constraints
- Auto-Deploy Integration
- Vector Database & Learning
- Security Hardening
- Service Integration
- Context Management
- Quality Oversight

### In Progress

- Increased test coverage (target: 30%)
- Transaction support for data integrity

### Future

- Event sourcing for audit trail
- Circular dependency resolution
- Enhanced type safety (replace `any`)

---

## Project Statistics

| Metric | Value |
|--------|-------|
| Source Files | 196 |
| API Endpoints | 50+ |
| Agents | 12 |
| Capabilities | 62 |
| Database Tables | 15+ |
| Test Files | 9 |

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Contact

- **Repository**: [GitHub - Project-Meteoroid](https://github.com/YuvrajZende/Project-Meteoroid)
- **Issues**: [GitHub Issues](https://github.com/YuvrajZende/Project-Meteoroid/issues)

---

*Last Updated: February 22, 2026*
*Version: 29.0.0*
