# 🚀 LOVEABLE Backend Orchestrator

A powerful AI-driven multi-agent backend orchestrator that generates production-ready TypeScript code using LangChain/LangGraph and specialized agents.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Agents](#agents)
- [Quick Start](#quick-start)
- [Commands Reference](#commands-reference)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Testing](#testing)

---

## 🎯 Overview

The LOVEABLE Backend Orchestrator is a sophisticated multi-agent AI system that coordinates 12 specialized agents to generate complete backend solutions. It features:

- **🧠 Brain Core**: Central nervous system that coordinates all subsystems
- **💭 Thinking Engine**: Decision-making with reasoning and confidence scoring
- **📋 Task Manager**: Breaks down complex requests into executable tasks
- **💾 Redis Checkpointing**: State persistence for long-running workflows
- **🔍 Context Window**: Maintains relevant context for agents
- **📚 Knowledge Base**: Stores and retrieves generated code for reference

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BRAIN CORE                              │
│  (Central Nervous System - Coordinates Everything)          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Thinking   │  │    Task     │  │   Redis     │         │
│  │   Engine    │  │   Manager   │  │ Checkpoint  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    AGENT ECOSYSTEM                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TIER 1 (Core)      TIER 2 (Specialized)   TIER 3 (Support) │
│  ┌──────────┐       ┌──────────┐           ┌──────────┐     │
│  │ AuthAgent│       │SecurityAgt│           │MonitorAgt│     │
│  │ DBAgent  │       │QueueAgent │           │TestAgent │     │
│  │ APIAgent │       │CICDAgent  │           │InfraAgent│     │
│  └──────────┘       └──────────┘           └──────────┘     │
│                                                              │
│  TIER 4 (Special)                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │CodegenAgt│  │MicroSvcAgt│  │EmailAgent│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 Agents

### Tier 1: Core Agents

| Agent | Owner | Capabilities |
|-------|-------|--------------|
| **AuthAgent** | Person1 | Clerk, JWT, OAuth, RBAC, ABAC/Cerbos, MFA, Sessions, Password Security, Rate Limiting |
| **DBAgent** | Person2 | Prisma, Drizzle, TypeORM, Migrations, Seeding |
| **APIAgent** | Person3 | REST, GraphQL, tRPC, OpenAPI, Validation |

### Tier 2: Specialized Agents

| Agent | Owner | Capabilities |
|-------|-------|--------------|
| **SecurityAgent** | Person1 | SAST, DAST, Bot Protection, WAF, Threat Detection, API Key Management, Security Testing |
| **QueueAgent** | Person2 | BullMQ, Redis Queues, Job Scheduling |
| **CICDAgent** | Person3 | GitHub Actions, Docker, Kubernetes |

### Tier 3: Supporting Agents

| Agent | Owner | Capabilities |
|-------|-------|--------------|
| **MonitoringAgent** | Person1 | APM (Datadog/New Relic/Elastic), Error Tracking (Sentry), Metrics, Health Checks, Logging, Tracing, Alerting, Audit Logging |
| **TestAgent** | Person2 | Vitest, Jest, Playwright, Unit/Integration/E2E Tests |
| **InfraAgent** | Person3 | Terraform, Docker, Kubernetes, Cloud Providers |

### Tier 4: Special Purpose Agents

| Agent | Owner | Capabilities |
|-------|-------|--------------|
| **CodegenAgent** | Shared | File Generation, Scaffolding, Boilerplate |
| **MicroserviceAgent** | Shared | Service Mesh, gRPC, Event-Driven Architecture |
| **EmailAgent** | Shared | Resend, Nodemailer, Email Templates |

---

## ⚡ Quick Start

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Redis (for checkpointing and rate limiting)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/YuvrajZende/Project-Meteoroid.git
cd "Project backend"

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
```

### Run the Orchestrator

```bash
# Start the orchestrator
npm run orchestrator

# Or with a specific task
npm run orchestrator "Generate authentication with JWT and Clerk"
```

---

## 📝 Commands Reference

### Core Commands

```bash
# =====================================
# INSTALLATION & SETUP
# =====================================

npm install                    # Install all dependencies
npm run build                  # Build TypeScript to JavaScript
npm run clean                  # Clean build artifacts

# =====================================
# RUNNING THE ORCHESTRATOR
# =====================================

npm run orchestrator           # Start interactive orchestrator
npm run orchestrator "<task>"  # Run with specific task

# Alternative execution methods
npx ts-node packages/orchestrator/src/index.ts
npx ts-node packages/orchestrator/src/index.ts "Your task here"

# =====================================
# TYPE CHECKING & LINTING
# =====================================

npx tsc --noEmit               # Type check without emitting
npx tsc --noEmit --project tsconfig.json  # Full type check
npm run lint                   # Run ESLint
npm run lint:fix               # Fix linting issues

# =====================================
# TESTING
# =====================================

npm test                       # Run all tests
npm run test:unit              # Run unit tests
npm run test:integration       # Run integration tests
npm run test:e2e               # Run end-to-end tests
npm run test:coverage          # Run with coverage report

# =====================================
# DEVELOPMENT
# =====================================

npm run dev                    # Start development mode
npm run watch                  # Watch mode with auto-reload
```

### Agent-Specific Commands

```bash
# =====================================
# AUTH AGENT
# =====================================

# Generate JWT authentication
npx ts-node -e "
const { authAgent } = require('./agents/core/auth');
authAgent.generateAuth({
    provider: 'jwt',
    features: ['jwt-auth', 'refresh-tokens', 'password-hashing']
}).then(console.log);
"

# Generate Clerk authentication
npx ts-node -e "
const { authAgent } = require('./agents/core/auth');
authAgent.generateAuth({
    provider: 'clerk',
    features: ['clerk-auth', 'webhooks', 'session-management']
}).then(console.log);
"

# =====================================
# SECURITY AGENT
# =====================================

# Generate security middleware
npx ts-node -e "
const { securityAgent } = require('./agents/core/security');
securityAgent.generateSecurityMiddleware({
    helmet: true,
    cors: true,
    rateLimit: true,
    csrf: true
}).then(console.log);
"

# Scan code for vulnerabilities
npx ts-node -e "
const { securityAgent } = require('./agents/core/security');
securityAgent.analyzeCode('./src', ['sast', 'secrets']).then(console.log);
"

# Generate WAF rules
npx ts-node -e "
const { securityAgent } = require('./agents/core/security');
securityAgent.generateWAFRules({ mode: 'blocking', owaspRules: true }).then(console.log);
"

# =====================================
# MONITORING AGENT
# =====================================

# Generate full monitoring setup
npx ts-node -e "
const { monitoringAgent } = require('./agents/core/monitoring');
monitoringAgent.generateMonitoringSystem({
    apmProvider: 'datadog',
    errorTracking: 'sentry',
    logging: 'winston',
    metrics: { enabled: true, provider: 'prometheus' },
    healthChecks: { enabled: true },
    tracing: true,
    alerting: { enabled: true, channels: [{ type: 'slack' }] },
    auditLogging: { enabled: true, storage: 'database', events: ['auth.login'] }
}).then(r => console.log(JSON.stringify(r, null, 2)));
"

# Analyze existing monitoring
npx ts-node -e "
const { monitoringAgent } = require('./agents/core/monitoring');
monitoringAgent.analyzeMonitoring('./src').then(console.log);
"

# Generate monitoring report
npx ts-node -e "
const { monitoringAgentEnhanced } = require('./agents/core/monitoring');
monitoringAgentEnhanced.generateReport('./src').then(console.log);
"
```

### Redis Commands

```bash
# =====================================
# REDIS MANAGEMENT
# =====================================

# Start Redis (Docker)
docker run -d --name redis-stack -p 6379:6379 redis/redis-stack:latest

# Check Redis connection
redis-cli ping

# View orchestrator checkpoints
redis-cli keys "checkpoint:*"

# Clear all checkpoints
redis-cli del $(redis-cli keys "checkpoint:*")
```

### Git Commands

```bash
# =====================================
# GIT WORKFLOW
# =====================================

# Check status
git status

# Stage all changes
git add .

# Commit with message
git commit -m "feat: description of changes"

# Push to development branch
git push origin Nevil-Development-Branch

# Pull latest changes
git pull origin main
```

---

## ⚙️ Configuration

### Project Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  }
}
```

### Agent Configuration

Located in `packages/orchestrator/src/state.ts`:

```typescript
export const AGENT_REGISTRY = {
    auth_agent: { name: "AuthAgent", owner: "Person1", tier: 1 },
    security_agent: { name: "SecurityAgent", owner: "Person1", tier: 2 },
    monitoring_agent: { name: "MonitoringAgent", owner: "Person1", tier: 3 },
    // ... more agents
};
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# =====================================
# AI MODEL CONFIGURATION
# =====================================
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.z.ai/api/coding/paas/v4
MODEL_NAME=glm-4

# =====================================
# REDIS CONFIGURATION
# =====================================
REDIS_URL=redis://localhost:6379

# =====================================
# APM CONFIGURATION (Datadog)
# =====================================
DD_API_KEY=your-datadog-api-key
DD_APP_KEY=your-datadog-app-key
DD_ENV=development
DD_SERVICE=loveable-backend
DD_VERSION=1.0.0

# =====================================
# ERROR TRACKING (Sentry)
# =====================================
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=1.0.0
SENTRY_TRACES_SAMPLE_RATE=0.1

# =====================================
# LOGGING
# =====================================
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=logs

# =====================================
# METRICS
# =====================================
DD_AGENT_HOST=localhost
DD_DOGSTATSD_PORT=8125

# =====================================
# OPENTELEMETRY
# =====================================
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=loveable-backend

# =====================================
# ALERTING
# =====================================
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
PAGERDUTY_API_KEY=your-pagerduty-key
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email
SMTP_PASS=your-password
ALERT_EMAIL_TO=alerts@yourcompany.com
```

---

## 📂 Project Structure

```
Project backend/
├── agents/
│   ├── index.ts                    # All agent exports
│   └── core/
│       ├── auth/
│       │   ├── auth-agent.ts       # AuthAgent class
│       │   ├── index.ts
│       │   └── templates/
│       │       ├── index.ts
│       │       ├── password.ts     # Password security
│       │       ├── cerbos.ts       # ABAC policies
│       │       └── rate-limit.ts   # Rate limiting
│       ├── security/
│       │   ├── security-agent.ts   # SecurityAgent class
│       │   ├── index.ts
│       │   └── templates/
│       │       ├── index.ts
│       │       ├── bot-protection.ts
│       │       ├── waf-rules.ts
│       │       ├── threat-detection.ts
│       │       ├── api-key-management.ts
│       │       └── security-testing.ts
│       └── monitoring/
│           ├── monitoring-agent.ts
│           ├── monitoring-agent-enhanced.ts
│           ├── index.ts
│           └── templates/
│               ├── index.ts        # APM, Sentry, Health, Logging
│               ├── metrics.ts      # Prometheus, StatsD
│               ├── alerting.ts     # Alerts, Audit
│               └── tracing.ts      # Distributed tracing
├── packages/
│   └── orchestrator/
│       └── src/
│           ├── index.ts            # Entry point
│           ├── state.ts            # Graph state & registries
│           ├── graph.ts            # LangGraph definition
│           ├── core/
│           │   ├── brain-core.ts
│           │   ├── thinking-engine.ts
│           │   ├── task-manager.ts
│           │   ├── context-window.ts
│           │   ├── redis-checkpointer.ts
│           │   └── knowledge-base.ts
│           └── nodes/
│               ├── supervisor.ts
│               ├── workers.ts
│               └── output-validator.ts
├── docs/
│   └── Team-Work/
├── PERSON1_TASK_LIST.md            # Task tracking
├── README.md                       # This file
├── package.json
├── tsconfig.json
└── .env
```

---

## 🧪 Testing

### Testing Agents Directly

```bash
# Test AuthAgent
npx ts-node -e "
const { authAgent } = require('./agents');
authAgent.generateAuth({ provider: 'jwt' }).then(console.log);
"

# Test SecurityAgent
npx ts-node -e "
const { securityAgent } = require('./agents');
securityAgent.generateSecurityMiddleware({ helmet: true }).then(console.log);
"

# Test MonitoringAgent
npx ts-node -e "
const { monitoringAgent } = require('./agents');
monitoringAgent.generateMonitoringSystem({
    apmProvider: 'datadog',
    healthChecks: { enabled: true }
}).then(console.log);
"
```

### Testing the Orchestrator

```bash
# Basic task
npm run orchestrator "Create a health check endpoint"

# Complex task
npm run orchestrator "Generate complete authentication with JWT, 
RBAC, rate limiting, and security headers"

# Multi-agent task
npm run orchestrator "Build a secure API with authentication, 
monitoring, and security scanning"
```

---

## 📊 Current Status

| Component | Status |
|-----------|--------|
| Brain Core | ✅ Complete |
| Thinking Engine | ✅ Complete |
| Task Manager | ✅ Complete |
| Auth Agent | ✅ Complete |
| Security Agent | ✅ Complete |
| Monitoring Agent | ✅ Complete |
| Phase 1 | ✅ 100% Complete |

---

## 👥 Team

- **Person 1**: Auth Agent, Security Agent, Monitoring Agent
- **Person 2**: DB Agent, Queue Agent, Test Agent  
- **Person 3**: API Agent, CICD Agent, Infra Agent

---

## 📄 License

MIT License - See LICENSE file for details.

---

*Last Updated: December 9, 2024*
