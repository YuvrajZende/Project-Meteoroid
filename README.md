# 🚀 Meteoroid - AI-Powered Backend Generator

An AI-driven multi-agent system that analyzes frontend codebases and generates complete, production-ready backends.

---

## ⚡ Quick Start (5 Minutes)

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/YuvrajZende/Project-Meteoroid.git
cd Project-Meteoroid

# Install dependencies
npm install
```

### 2. Set Up Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys (at minimum, one LLM key):
# - GROQ_API_KEY (recommended - free tier available)
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
```

### 3. Start Using

```bash
# Navigate to CLI package
cd packages/cli

# Start interactive chat mode
npm run dev

# Or run specific commands (from Project-Meteoroid root):
cd ..  # back to root
npx tsx packages/cli/src/index.ts --help
```

---

## 🎯 Main Workflows

### Workflow 1: Analyze Frontend → Generate Backend

```bash
# From Project-Meteoroid root directory:

# Step 1: Analyze a frontend repository
npx tsx packages/cli/src/index.ts transform https://github.com/user/frontend-repo

# Step 2: Generate backend based on analysis
npx tsx packages/cli/src/index.ts or
```

The `or` command will:
1. Read the analysis from `meteoroid-output/`
2. Ask questions about authentication (Clerk, Supabase, etc.)
3. Ask about database setup (PostgreSQL, Prisma, etc.)
4. Generate a complete backend in `generated-backend/`

### Workflow 2: Interactive Chat Mode

```bash
cd packages/cli
npm run dev
```

Inside chat mode:
- Type `/help` to see all commands
- Type `/code` to switch to code generation mode
- Type `/analyze` to switch to analysis mode
- Type `exit` to quit

---

## 📝 CLI Commands Reference

### Quick Commands (from project root)

| Command | Description |
|---------|-------------|
| `npm run cli` | Start interactive chat mode |
| `npm run transform <url>` | Analyze a frontend repo |
| `npm run or` | Generate backend from analysis |

### Full Commands (if npm scripts don't work)

| Command | Description |
|---------|-------------|
| `npx tsx packages/cli/src/index.ts` | Start interactive chat mode |
| `npx tsx packages/cli/src/index.ts transform <url>` | Analyze a frontend repo |
| `npx tsx packages/cli/src/index.ts or` | Generate backend from analysis |
| `npx tsx packages/cli/src/index.ts --help` | Show all CLI options |

### Chat Mode Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/chat` | Switch to chat mode |
| `/code` | Switch to code generation mode |
| `/analyze` | Switch to analysis mode |
| `/status` | Show system status |
| `/config` | Show CLI configuration |
| `exit` | Exit chat mode |

---

## 🏗 Project Structure

```
Project-Meteoroid/
├── packages/
│   ├── cli/                    # Command-line interface
│   │   ├── src/
│   │   │   ├── index.ts       # Main CLI entry point
│   │   │   ├── commands/      # Slash commands
│   │   │   ├── modes/         # Chat modes
│   │   │   └── utils/         # Utilities
│   │   └── package.json
│   │
│   ├── api/                    # Backend API (Fastify + Convex)
│   │   ├── src/
│   │   │   ├── routes/        # API routes
│   │   │   ├── services/      # Business logic
│   │   │   └── agents/        # AI agents
│   │   └── convex/            # Convex functions
│   │
│   └── orchestrator/           # AI orchestration engine
│       └── src/
│           ├── core/          # Brain, thinking, task manager
│           └── nodes/         # Graph nodes
│
├── agents/                     # Specialized AI agents
│   └── core/
│       ├── auth/              # Authentication agent
│       ├── security/          # Security agent
│       └── monitoring/        # Monitoring agent
│
├── meteoroid-output/           # Generated analysis output
│   └── analysis/
│       ├── analysis-report.json
│       └── details.md
│
└── generated-backend/          # Generated backend code
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# =====================================
# LLM Configuration (choose at least one)
# =====================================
GROQ_API_KEY=your-groq-api-key          # Recommended: Free tier
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# =====================================
# Convex (for API package)
# =====================================
CONVEX_DEPLOYMENT=your-deployment-url

# =====================================
# Optional: Redis (for caching)
# =====================================
REDIS_URL=redis://localhost:6379
```

---

## 🤖 Agent System

Meteoroid uses specialized AI agents organized in tiers:

### Tier 1: Core Agents
| Agent | Capabilities |
|-------|-------------|
| **AuthAgent** | Clerk, JWT, OAuth, RBAC, MFA, Sessions |
| **DBAgent** | Prisma, Drizzle, TypeORM, Migrations |
| **APIAgent** | REST, GraphQL, tRPC, Validation |

### Tier 2: Specialized Agents
| Agent | Capabilities |
|-------|-------------|
| **SecurityAgent** | SAST, Bot Protection, WAF, API Keys |
| **QueueAgent** | BullMQ, Redis Queues, Job Scheduling |
| **CICDAgent** | GitHub Actions, Docker, Kubernetes |

### Tier 3: Supporting Agents
| Agent | Capabilities |
|-------|-------------|
| **MonitoringAgent** | APM, Error Tracking, Metrics, Logging |
| **TestAgent** | Vitest, Jest, Playwright |
| **InfraAgent** | Terraform, Docker, Kubernetes |

---

## 🧪 Development

### Running the API Server

```bash
cd packages/api
npm run dev
```

### Running Convex

```bash
cd packages/api
npx convex dev
```

### Type Checking

```bash
npm run typecheck
```

### Running Tests

```bash
npm test
```

---

## 👥 Team

- **Person 1**: Auth Agent, Security Agent, Monitoring Agent
- **Person 2**: DB Agent, Queue Agent, Test Agent  
- **Person 3**: API Agent, CICD Agent, Infra Agent

---

## 📄 License

MIT License

---

*Last Updated: February 2026*
