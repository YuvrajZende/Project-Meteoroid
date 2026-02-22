# Software Requirements Specification (SRS)

## LOVEABLE Backend Orchestrator

**AI-Powered Multi-Agent Code Generation Platform**

---

**Document Information**

| Field | Value |
|-------|-------|
| Document Title | Software Requirements Specification |
| Project Name | LOVEABLE Backend Orchestrator |
| Version | 1.0 |
| Date | February 22, 2026 |
| Authors | Development Team |
| Status | Final |

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Purpose](#11-purpose)
   - 1.2 [Scope](#12-scope)
   - 1.3 [Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations)
   - 1.4 [References](#14-references)
   - 1.5 [Overview](#15-overview)
2. [Overall Description](#2-overall-description)
   - 2.1 [Product Perspective](#21-product-perspective)
   - 2.2 [Product Functions](#22-product-functions)
   - 2.3 [User Characteristics](#23-user-characteristics)
   - 2.4 [Constraints](#24-constraints)
   - 2.5 [Assumptions and Dependencies](#25-assumptions-and-dependencies)
3. [Specific Requirements](#3-specific-requirements)
   - 3.1 [External Interface Requirements](#31-external-interface-requirements)
   - 3.2 [Functional Requirements](#32-functional-requirements)
   - 3.3 [Performance Requirements](#33-performance-requirements)
   - 3.4 [Design Constraints](#34-design-constraints)
   - 3.5 [System Attributes](#35-system-attributes)
   - 3.6 [Other Requirements](#36-other-requirements)
4. [Appendices](#4-appendices)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document describes the functional and non-functional requirements for the LOVEABLE Backend Orchestrator, an AI-powered multi-agent platform for automated backend code generation. The document is intended for:

- Software developers implementing the system
- Project managers overseeing development
- Quality assurance teams testing the system
- Stakeholders evaluating the system capabilities
- Future maintainers of the system

### 1.2 Scope

The LOVEABLE Backend Orchestrator is a web-based platform that automatically generates production-ready backend code from natural language descriptions. The system uses a sophisticated multi-agent architecture powered by Large Language Models (LLMs) to analyze requirements, design architectures, and generate complete backend solutions.

**Included in scope:**

- Multi-agent orchestration system with 12 specialized agents
- Multi-model AI pipeline (Fast analysis + Power generation)
- Support for multiple programming languages (TypeScript, Python, Go, Rust, Java)
- Support for multiple frameworks (NestJS, Express, FastAPI, Django, Fastify)
- Real-time code preview and collaboration features
- User authentication and authorization
- Project management and version control
- Automated deployment integration
- Learning system with vector-based knowledge storage

**Excluded from scope:**

- Frontend code generation
- Mobile application development
- Machine learning model training
- Infrastructure provisioning (beyond code generation)

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| API | Application Programming Interface |
| JWT | JSON Web Token |
| LLM | Large Language Model |
| RBAC | Role-Based Access Control |
| ABAC | Attribute-Based Access Control |
| SSE | Server-Sent Events |
| ORM | Object-Relational Mapping |
| CRUD | Create, Read, Update, Delete |
| MFA | Multi-Factor Authentication |
| WAF | Web Application Firewall |
| SAST | Static Application Security Testing |
| DAST | Dynamic Application Security Testing |
| APM | Application Performance Monitoring |
| CI/CD | Continuous Integration/Continuous Deployment |
| RPC | Remote Procedure Call |
| TTL | Time To Live |
| ORM | Object-Relational Mapping |
| pgvector | PostgreSQL extension for vector similarity search |
| TUI | Terminal User Interface |

### 1.4 References

| Reference | Description |
|-----------|-------------|
| IEEE 830-1998 | IEEE Standard for Software Requirements Specifications |
| OpenAPI 3.0 | OpenAPI Specification for REST APIs |
| OAuth 2.0 | OAuth 2.0 Authorization Framework |
| JWT RFC 7519 | JSON Web Token specification |
| Supabase Documentation | Database and authentication service documentation |
| Fastify Documentation | Web framework documentation |

### 1.5 Overview

This document is organized as follows:

- **Section 2**: Provides an overall description of the product, including its perspective, functions, user characteristics, constraints, and dependencies.
- **Section 3**: Details the specific requirements including functional, non-functional, and interface requirements.
- **Section 4**: Contains appendices with additional information, diagrams, and use cases.

---

## 2. Overall Description

### 2.1 Product Perspective

The LOVEABLE Backend Orchestrator is a standalone web application that operates as a middleware service between users and AI-powered code generation capabilities. The system integrates with external services for:

- **AI Models**: Groq (fast analysis) and Z.AI (code generation)
- **Database**: Supabase (PostgreSQL with pgvector)
- **Caching**: Redis for rate limiting and session management
- **Deployment**: Netlify and Vercel for automated deployments

#### 2.1.1 System Interfaces

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTERFACES                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   Web Client │     │  TUI Client  │     │  API Client  │        │
│  │   (Browser)  │     │   (Terminal) │     │   (External) │        │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘        │
│         │                    │                    │                 │
│         └────────────────────┼────────────────────┘                 │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    LOVEABLE BACKEND API                        │ │
│  │                      (Fastify Server)                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         │                    │                    │                 │
│         ▼                    ▼                    ▼                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │    Supabase  │     │    Redis     │     │   AI Models  │        │
│  │  (PostgreSQL)│     │   (Cache)    │     │ (Groq, Z.AI) │        │
│  └──────────────┘     └──────────────┘     └──────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.1.2 User Interfaces

| Interface | Description |
|-----------|-------------|
| Web Dashboard | Browser-based interface for project management and code generation |
| TUI (Terminal UI) | Go-based terminal interface for CLI interactions |
| REST API | Programmatic access via HTTP endpoints |
| WebSocket | Real-time updates for code preview and collaboration |

#### 2.1.3 Hardware Interfaces

| Component | Requirement |
|-----------|-------------|
| Server | x86_64 architecture, 4+ CPU cores, 8GB+ RAM |
| Storage | SSD recommended for database operations |
| Network | Stable internet connection for AI API calls |

#### 2.1.4 Software Interfaces

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Server runtime |
| PostgreSQL | 15+ | Primary database (via Supabase) |
| Redis | 7+ | Caching and rate limiting |
| Docker | 20+ | Containerization (optional) |

#### 2.1.5 Communications Interfaces

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTPS | 443 | Primary API access |
| WebSocket | 443 | Real-time communication |
| Redis Protocol | 6379 | Cache communication |

### 2.2 Product Functions

#### 2.2.1 Core Functions

| ID | Function | Description |
|----|----------|-------------|
| F-001 | Code Generation | Generate complete backend code from natural language prompts |
| F-002 | Multi-Language Support | Support TypeScript, Python, Go, Rust, Java |
| F-003 | Framework Detection | Automatically detect and configure appropriate frameworks |
| F-004 | Blueprint Enforcement | Ensure generated code follows architectural patterns |
| F-005 | Import Resolution | Automatically resolve and fix import statements |
| F-006 | Syntax Validation | Validate and fix syntax errors in generated code |
| F-007 | Project Management | Create, update, delete, and organize projects |
| F-008 | User Authentication | Secure user authentication with JWT and OAuth |
| F-009 | Role-Based Access | Fine-grained access control based on user roles |
| F-010 | Real-time Preview | Live preview of generated code via WebSocket |

#### 2.2.2 AI Functions

| ID | Function | Description |
|----|----------|-------------|
| AI-001 | Intent Analysis | Analyze user prompts to determine project requirements |
| AI-002 | Architecture Blueprint | Generate architecture blueprints for projects |
| AI-003 | Multi-Model Pipeline | Coordinate fast and power models for generation |
| AI-004 | Vector Learning | Learn from successful generations for improvement |
| AI-005 | Context Management | Maintain context across multi-step generation |

#### 2.2.3 Agent Functions

| Agent | Functions |
|-------|-----------|
| AuthAgent | JWT/OAuth implementation, RBAC/ABAC, MFA, session management |
| DatabaseAgent | Schema design, migrations, ORM configuration |
| APIAgent | REST/GraphQL/tRPC endpoint generation |
| SecurityAgent | SAST/DAST, threat detection, WAF rules |
| MonitoringAgent | APM integration, logging, alerting setup |
| TestAgent | Unit/integration/E2E test generation |
| CICDAgent | Pipeline configuration, deployment scripts |
| QueueAgent | Message queue setup, job scheduling |
| InfraAgent | Infrastructure as code, Docker/Kubernetes configs |

### 2.3 User Characteristics

#### 2.3.1 User Classes

| Class | Description | Technical Expertise |
|-------|-------------|---------------------|
| Developer | Primary users who generate backend code | High |
| Team Lead | Manages projects and team access | Medium |
| DevOps Engineer | Configures deployments and infrastructure | High |
| Project Manager | Monitors project status and metrics | Low |

#### 2.3.2 User Assumptions

- Users have basic understanding of backend development concepts
- Users can write natural language requirements
- Users have necessary API keys for AI services
- Users understand basic security concepts (API keys, tokens)

### 2.4 Constraints

#### 2.4.1 Technical Constraints

| ID | Constraint |
|----|------------|
| C-001 | System requires Node.js 18+ runtime |
| C-002 | AI generation depends on external API availability |
| C-003 | Maximum request size limited to 10MB |
| C-004 | Rate limits apply per user tier |
| C-005 | Generated code requires runtime environment to execute |

#### 2.4.2 Regulatory Constraints

| ID | Constraint |
|----|------------|
| R-001 | User data must comply with GDPR regulations |
| R-002 | API keys must be stored securely |
| R-003 | Audit logs required for compliance |

#### 2.4.3 Business Constraints

| ID | Constraint |
|----|------------|
| B-001 | AI API costs must be tracked and limited |
| B-002 | Response time should be under 5 minutes for generation |
| B-003 | System must support horizontal scaling |

### 2.5 Assumptions and Dependencies

#### 2.5.1 Assumptions

| ID | Assumption |
|----|------------|
| A-001 | Users have valid Supabase account for authentication |
| A-002 | AI model APIs remain available and stable |
| A-003 | Network connectivity is reliable |
| A-004 | Users have necessary permissions for deployment targets |

#### 2.5.2 Dependencies

| ID | Dependency | Type |
|----|------------|------|
| D-001 | Groq API for fast model inference | External |
| D-002 | Z.AI API for power model inference | External |
| D-003 | Supabase for database and auth | External |
| D-004 | Redis for caching | External |
| D-005 | Node.js runtime | Platform |

---

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interfaces

**Web Dashboard UI Requirements**

| ID | Requirement |
|----|-------------|
| UI-001 | Dashboard shall display list of user projects |
| UI-002 | Dashboard shall provide code editor for prompt input |
| UI-003 | Dashboard shall show real-time generation progress |
| UI-004 | Dashboard shall display generated code with syntax highlighting |
| UI-005 | Dashboard shall support project download as ZIP |
| UI-006 | Dashboard shall be responsive for tablet and desktop |
| UI-007 | Dashboard shall support dark/light theme |

**TUI Interface Requirements**

| ID | Requirement |
|----|-------------|
| TUI-001 | TUI shall display server connection status |
| TUI-002 | TUI shall show available agents and capabilities |
| TUI-003 | TUI shall support prompt input via text field |
| TUI-004 | TUI shall display generation progress in real-time |
| TUI-005 | TUI shall support keyboard navigation |

#### 3.1.2 API Interfaces

**REST API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/orchestrator/execute` | Execute code generation |
| GET | `/api/v1/orchestrator/status/:id` | Get task status |
| GET | `/api/v1/orchestrator/stream/:id` | SSE stream for progress |
| GET | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects/:id` | Get project details |
| PUT | `/api/v1/projects/:id` | Update project |
| DELETE | `/api/v1/projects/:id` | Delete project |
| GET | `/api/v1/projects/:id/download` | Download as ZIP |
| GET | `/api/v1/tasks` | List tasks |
| GET | `/api/v1/tasks/:id` | Get task details |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/register` | User registration |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/metrics` | Prometheus metrics |

**Request/Response Formats**

```json
// POST /api/v1/orchestrator/execute Request
{
  "prompt": "string (required)",
  "userId": "string (required)",
  "options": {
    "language": "typescript | python | go | rust | java",
    "framework": "nestjs | express | fastapi | django | fastify",
    "features": ["auth", "crud", "validation", "logging", "caching"]
  }
}

// Response
{
  "taskId": "string",
  "status": "queued | processing | completed | failed",
  "createdAt": "ISO 8601 timestamp"
}
```

#### 3.1.3 Hardware Interfaces

| ID | Requirement |
|----|------------|
| HI-001 | System shall run on x86_64 architecture |
| HI-002 | System shall support minimum 4 CPU cores |
| HI-003 | System shall support minimum 8GB RAM |
| HI-004 | System shall support SSD storage for database |

#### 3.1.4 Software Interfaces

| ID | Interface | Requirement |
|----|-----------|-------------|
| SI-001 | Supabase | System shall connect to Supabase PostgreSQL database |
| SI-002 | Redis | System shall use Redis for caching and rate limiting |
| SI-003 | Groq API | System shall call Groq API for fast model inference |
| SI-004 | Z.AI API | System shall call Z.AI API for code generation |

#### 3.1.5 Communications Interfaces

| ID | Requirement |
|----|------------|
| CI-001 | System shall support HTTPS for all API communications |
| CI-002 | System shall support WebSocket for real-time updates |
| CI-003 | System shall implement SSE for streaming progress |
| CI-004 | System shall support CORS for cross-origin requests |

### 3.2 Functional Requirements

#### 3.2.1 Authentication & Authorization

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-001 | System shall authenticate users via Supabase JWT | High |
| AUTH-002 | System shall support API key authentication | High |
| AUTH-003 | System shall implement role-based access control | High |
| AUTH-004 | System shall validate JWT tokens on protected routes | High |
| AUTH-005 | System shall refresh expired tokens | Medium |
| AUTH-006 | System shall log all authentication events | Medium |

#### 3.2.2 Code Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| GEN-001 | System shall accept natural language prompts | High |
| GEN-002 | System shall analyze prompt to determine intent | High |
| GEN-003 | System shall generate architecture blueprint | High |
| GEN-004 | System shall generate code using AI models | High |
| GEN-005 | System shall validate generated code syntax | High |
| GEN-006 | System shall resolve import dependencies | High |
| GEN-007 | System shall deduplicate generated files | High |
| GEN-008 | System shall inject missing decorator imports | Medium |
| GEN-009 | System shall filter npm packages from file creation | Medium |
| GEN-010 | System shall normalize file paths | Medium |
| GEN-011 | System shall generate complete, runnable projects | High |

#### 3.2.3 Multi-Language Support

| ID | Requirement | Priority |
|----|-------------|----------|
| LANG-001 | System shall support TypeScript generation | High |
| LANG-002 | System shall support Python generation | High |
| LANG-003 | System shall support Go generation | Medium |
| LANG-004 | System shall support Rust generation | Medium |
| LANG-005 | System shall support Java generation | Low |
| LANG-006 | System shall auto-detect language from prompt | High |

#### 3.2.4 Framework Support

| ID | Requirement | Priority |
|----|-------------|----------|
| FRM-001 | System shall support NestJS framework | High |
| FRM-002 | System shall support Express framework | High |
| FRM-003 | System shall support FastAPI framework | High |
| FRM-004 | System shall support Django framework | Medium |
| FRM-005 | System shall support Fastify framework | High |
| FRM-006 | System shall auto-detect framework requirements | High |

#### 3.2.5 Project Management

| ID | Requirement | Priority |
|----|-------------|----------|
| PM-001 | System shall allow users to create projects | High |
| PM-002 | System shall allow users to update projects | High |
| PM-003 | System shall allow users to delete projects | High |
| PM-004 | System shall list user projects with pagination | High |
| PM-005 | System shall allow project download as ZIP | Medium |
| PM-006 | System shall track project generation history | Medium |

#### 3.2.6 Agent Orchestration

| ID | Requirement | Priority |
|----|-------------|----------|
| AGT-001 | System shall select appropriate agents based on task | High |
| AGT-002 | System shall coordinate multiple agents per task | High |
| AGT-003 | System shall track agent execution progress | High |
| AGT-004 | System shall handle agent failures gracefully | High |
| AGT-005 | System shall aggregate results from multiple agents | High |

#### 3.2.7 Learning System

| ID | Requirement | Priority |
|----|-------------|----------|
| LRN-001 | System shall store successful generation patterns | Medium |
| LRN-002 | System shall retrieve similar past generations | Medium |
| LRN-003 | System shall use vector embeddings for similarity | Medium |
| LRN-004 | System shall improve generation quality over time | Low |

### 3.3 Performance Requirements

| ID | Requirement | Metric |
|----|-------------|--------|
| PERF-001 | API response time shall be under 200ms for non-generation endpoints | 95th percentile |
| PERF-002 | Code generation shall complete within 5 minutes | 90th percentile |
| PERF-003 | System shall support 100 concurrent requests | Capacity |
| PERF-004 | Database queries shall execute under 100ms | 95th percentile |
| PERF-005 | Cache hit rate shall be above 80% | Target |
| PERF-006 | Memory usage shall not exceed 2GB per instance | Limit |
| PERF-007 | WebSocket connections shall support 1000 concurrent | Capacity |

### 3.4 Design Constraints

#### 3.4.1 Architectural Constraints

| ID | Constraint |
|----|------------|
| DC-001 | System shall follow layered architecture (API, Application, Domain, Infrastructure) |
| DC-002 | System shall use dependency injection for services |
| DC-003 | System shall implement repository pattern for data access |
| DC-004 | System shall use Fastify as web framework |
| DC-005 | System shall use TypeScript for type safety |

#### 3.4.2 Security Constraints

| ID | Constraint |
|----|------------|
| SEC-001 | All API endpoints shall require authentication (except public endpoints) |
| SEC-002 | System shall implement rate limiting |
| SEC-003 | System shall validate all input with Zod schemas |
| SEC-004 | System shall use parameterized queries for database access |
| SEC-005 | System shall log security events for audit |

### 3.5 System Attributes

#### 3.5.1 Reliability

| ID | Requirement |
|----|-------------|
| REL-001 | System shall have 99.5% uptime availability |
| REL-002 | System shall gracefully handle external API failures |
| REL-003 | System shall persist generation state for recovery |
| REL-004 | System shall implement retry logic for transient failures |

#### 3.5.2 Availability

| ID | Requirement |
|----|-------------|
| AVAIL-001 | System shall support horizontal scaling |
| AVAIL-002 | System shall use Redis for session persistence |
| AVAIL-003 | System shall implement health check endpoints |
| AVAIL-004 | System shall support graceful shutdown |

#### 3.5.3 Security

| ID | Requirement |
|----|-------------|
| SEC-001 | System shall implement JWT-based authentication |
| SEC-002 | System shall use HTTPS for all communications |
| SEC-003 | System shall implement CSRF protection |
| SEC-004 | System shall set security headers (CSP, HSTS, X-Frame-Options) |
| SEC-005 | System shall encrypt sensitive configuration |
| SEC-006 | System shall implement API key rotation |
| SEC-007 | System shall verify webhook signatures |

#### 3.5.4 Maintainability

| ID | Requirement |
|----|-------------|
| MAIN-001 | System shall have modular architecture |
| MAIN-002 | System shall use TypeScript strict mode |
| MAIN-003 | System shall have comprehensive logging |
| MAIN-004 | System shall document API with OpenAPI specification |
| MAIN-005 | System shall have unit tests for core functionality |

#### 3.5.5 Portability

| ID | Requirement |
|----|-------------|
| PORT-001 | System shall run on Linux, macOS, and Windows |
| PORT-002 | System shall be containerizable with Docker |
| PORT-003 | System shall use environment variables for configuration |
| PORT-004 | System shall support multiple Node.js versions (18+) |

#### 3.5.6 Scalability

| ID | Requirement |
|----|-------------|
| SCALE-001 | System shall support horizontal scaling via load balancer |
| SCALE-002 | System shall use connection pooling for database |
| SCALE-003 | System shall use Redis for distributed caching |
| SCALE-004 | System shall implement lazy loading for large datasets |

### 3.6 Other Requirements

#### 3.6.1 Data Requirements

| ID | Requirement |
|----|-------------|
| DATA-001 | System shall store user data in PostgreSQL |
| DATA-002 | System shall store vector embeddings in pgvector |
| DATA-003 | System shall cache frequently accessed data in Redis |
| DATA-004 | System shall implement database indexes for performance |
| DATA-005 | System shall backup data regularly |

#### 3.6.2 Logging Requirements

| ID | Requirement |
|----|-------------|
| LOG-001 | System shall log all API requests with correlation ID |
| LOG-002 | System shall log authentication events |
| LOG-003 | System shall log generation progress |
| LOG-004 | System shall log errors with stack traces |
| LOG-005 | System shall use structured JSON logging |

#### 3.6.3 Monitoring Requirements

| ID | Requirement |
|----|-------------|
| MON-001 | System shall expose Prometheus metrics endpoint |
| MON-002 | System shall track request latency |
| MON-003 | System shall track error rates |
| MON-004 | System shall track AI API usage and costs |
| MON-005 | System shall integrate with Sentry for error tracking |

---

## 4. Appendices

### Appendix A: Use Cases

#### Use Case 1: Generate Backend Code

| Field | Description |
|-------|-------------|
| **Use Case ID** | UC-001 |
| **Name** | Generate Backend Code |
| **Actor** | Developer |
| **Description** | Developer submits a natural language prompt to generate backend code |
| **Preconditions** | User is authenticated |
| **Main Flow** | 1. Developer enters prompt<br>2. System analyzes intent<br>3. System generates blueprint<br>4. System generates code<br>5. System validates output<br>6. System presents generated code |
| **Alternative Flow** | 3a. Generation fails → System shows error and suggests retry |
| **Postconditions** | Project created with generated code |

#### Use Case 2: Manage Projects

| Field | Description |
|-------|-------------|
| **Use Case ID** | UC-002 |
| **Name** | Manage Projects |
| **Actor** | Developer |
| **Description** | Developer creates, views, updates, or deletes projects |
| **Preconditions** | User is authenticated |
| **Main Flow** | 1. Developer views project list<br>2. Developer selects action (create/update/delete)<br>3. System performs action<br>4. System confirms result |
| **Postconditions** | Project state updated |

#### Use Case 3: Real-time Preview

| Field | Description |
|-------|-------------|
| **Use Case ID** | UC-003 |
| **Name** | Real-time Code Preview |
| **Actor** | Developer |
| **Description** | Developer views generated code in real-time |
| **Preconditions** | Generation task in progress |
| **Main Flow** | 1. Developer opens preview panel<br>2. System establishes WebSocket connection<br>3. System streams code updates<br>4. Developer views changes in real-time |
| **Postconditions** | Developer sees generated code |

### Appendix B: Data Models

#### User Model

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}
```

#### Project Model

```typescript
interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  language: string;
  framework: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Task Model

```typescript
interface Task {
  id: string;
  projectId: string;
  userId: string;
  prompt: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: GeneratedCode;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

### Appendix C: API Rate Limits

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Authentication | 10 requests | 1 minute |
| Orchestrator | 20 requests | 1 minute |
| General API | 100 requests | 1 minute |
| File Upload | 10 requests | 1 minute |

### Appendix D: Technology Stack Summary

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5.7+ |
| Framework | Fastify 5.1+ |
| Database | PostgreSQL (Supabase) |
| Cache | Redis |
| Validation | Zod |
| AI Models | Groq (LLaMA 3.3), Z.AI (GLM-4.6) |
| Authentication | Supabase Auth |
| Logging | Pino |
| Monitoring | Sentry, Prometheus |

### Appendix E: Glossary

| Term | Definition |
|------|------------|
| Agent | Specialized AI component responsible for specific code generation tasks |
| Blueprint | Architecture specification for a generated project |
| Context | Session state maintained during multi-step generation |
| Embedding | Vector representation of code or text for similarity search |
| Intent | User's goal derived from natural language prompt |
| Pipeline | Sequence of processing steps for code generation |
| Token | Unit of text processed by AI models |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 22, 2026 | Development Team | Initial release |

---

**End of Document**
