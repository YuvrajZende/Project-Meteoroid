# 🚀 Person 1 Implementation Guide - Team Lead / Backend Specialist

## 📋 Table of Contents
1. [Role Overview](#role-overview)
2. [Development Environment Setup](#development-environment-setup)
3. [Core Orchestrator Implementation](#core-orchestrator-implementation)
4. [Auth Agent Development](#auth-agent-development)
5. [Security Agent Development](#security-agent-development)
6. [Monitoring Agent Development](#monitoring-agent-development)
7. [Integration & Testing](#integration--testing)
8. [Code Architecture Patterns](#code-architecture-patterns)
9. [Best Practices & Standards](#best-practices--standards)

---

## 🎯 Role Overview

### Your Mission
As Person 1 (Team Lead/Backend Specialist), you are responsible for building the **brain and nervous system** of the LOVEABLE backend platform. This includes:

1. **Main Orchestrator** - Coordinates all 15 agents
2. **Auth Agent** - Generates authentication & authorization systems
3. **Security Agent** - Implements security scanning & vulnerability detection
4. **Monitoring Agent** - Provides system health & performance monitoring

### Technology Stack
```typescript
Core Stack:
- Language: TypeScript
- Runtime: Node.js
- AI Integration: AutoGen framework
- Communication: MCP (Model Context Protocol)
- Cache/Coordination: Redis
- Authentication: Clerk, JWT, OAuth
- Security: Trivy, GitGuardian, Escape.tech
- Monitoring: Datadog, Sentry
- Testing: Vitest, Playwright
```

---

## 🛠 Development Environment Setup

### 1. Initial Setup
```bash
# Clone repository and setup
git clone <repository-url>
cd loveable-backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Install Person 1 specific dependencies
npm install -D @types/node typescript ts-node nodemon
npm install autogen redis @clerk/backend jsonwebtoken bcryptjs
npm install @datadog/datadog-api-client @sentry/node trivy gitguardian-api
```

### 2. Directory Structure Creation
```bash
# Create Person 1 directories
mkdir -p agents/orchestrator
mkdir -p agents/core/auth
mkdir -p agents/supporting/security
mkdir -p agents/supporting/monitoring
mkdir -p packages/orchestrator
mkdir -p packages/agents
mkdir -p tests/orchestrator
mkdir -p tests/agents
```

### 3. Environment Configuration
```bash
# Add to your .env file
# ===========================================
# PERSON 1 CONFIGURATION
# ===========================================
ORCHESTRATOR_PORT=3001
REDIS_URL=redis://localhost:6379
MCP_SERVER_URL=http://localhost:8080

# AI Models
CLAUDE_API_KEY=your_claude_api_key
ANTHROPIC_MODEL=claude-sonnet-4.5

# Authentication
CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
JWT_SECRET=your_super_secret_jwt_key

# Security
GITGUARDIAN_API_KEY=your_gitguardian_key
TRIVY_API_ENDPOINT=your_trivy_endpoint
ESCAPE_API_KEY=your_escape_key

# Monitoring
DATADOG_API_KEY=your_datadog_key
DATADOG_APP_KEY=your_datadog_app_key
SENTRY_DSN=your_sentry_dsn
```

---

## 🧠 Core Orchestrator Implementation

### Architecture Overview
```typescript
┌─────────────────────────────────────────────────────────────┐
│                    MAIN ORCHESTRATOR                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   AI Engine     │  │  MCP Protocol   │  │ Agent       │ │
│  │  (Claude 4.5)   │  │   Handler       │  │ Registry    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
        ┌─────────────────────────────────────────────────┐
        │              AGENT ECOSYSTEM                   │
        │  Auth │ DB │ API │ Security │ Queue │ Test...  │
        └─────────────────────────────────────────────────┘
```

### 1. Orchestrator Base Structure

```typescript
// packages/orchestrator/src/orchestrator.ts
import { AutoGen } from 'autogen';
import { MCPClient } from './mcp-client';
import { AgentRegistry } from './agent-registry';
import { IntentParser } from './intent-parser';
import { ContextManager } from './context-manager';

export class MainOrchestrator {
  private autogen: AutoGen;
  private mcpClient: MCPClient;
  private agentRegistry: AgentRegistry;
  private intentParser: IntentParser;
  private contextManager: ContextManager;

  constructor(config: OrchestratorConfig) {
    this.autogen = new AutoGen({
      model: 'claude-sonnet-4.5',
      apiKey: config.claudeApiKey
    });

    this.mcpClient = new MCPClient(config.mcpServerUrl);
    this.agentRegistry = new AgentRegistry();
    this.intentParser = new IntentParser();
    this.contextManager = new ContextManager();
  }

  async processUserRequest(request: UserRequest): Promise<GeneratedCode> {
    // 1. Parse user intent
    const intent = await this.intentParser.parse(request.text);

    // 2. Select required agents
    const agents = this.agentRegistry.selectAgents(intent);

    // 3. Coordinate agents through MCP
    const results = await this.coordinateAgents(agents, intent);

    // 4. Integrate results
    return this.integrateResults(results, intent);
  }

  private async coordinateAgents(
    agents: Agent[],
    intent: ParsedIntent
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const agent of agents) {
      // Agent coordination through MCP
      const agentRequest = this.createAgentRequest(agent, intent);
      const result = await this.mcpClient.sendRequest(agent.id, agentRequest);
      results.push(result);

      // Store in context for other agents
      await this.contextManager.storeContext(agent.id, result);
    }

    return results;
  }
}
```

### 2. MCP Protocol Implementation

```typescript
// packages/orchestrator/src/mcp-client.ts
export class MCPClient {
  private connections: Map<string, WebSocket> = new Map();

  constructor(private serverUrl: string) {}

  async sendRequest(agentId: string, request: MCPRequest): Promise<MCPResponse> {
    const connection = await this.getConnection(agentId);

    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();

      connection.send(JSON.stringify({
        id: messageId,
        type: 'request',
        agentId,
        payload: request
      }));

      // Handle response
      connection.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.id === messageId) {
          resolve(message.payload);
        }
      });

      // Timeout handling
      setTimeout(() => {
        reject(new Error(`Request timeout for agent ${agentId}`));
      }, 30000);
    });
  }

  private async getConnection(agentId: string): Promise<WebSocket> {
    if (!this.connections.has(agentId)) {
      const ws = new WebSocket(`${this.serverUrl}/agents/${agentId}`);
      await new Promise(resolve => ws.on('open', resolve));
      this.connections.set(agentId, ws);
    }
    return this.connections.get(agentId)!;
  }
}
```

### 3. Agent Registry

```typescript
// packages/orchestrator/src/agent-registry.ts
export interface AgentDefinition {
  id: string;
  name: string;
  type: 'core' | 'specialized' | 'supporting';
  capabilities: string[];
  dependencies: string[];
  priority: number;
}

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();

  constructor() {
    this.registerCoreAgents();
    this.registerSpecializedAgents();
    this.registerSupportingAgents();
  }

  selectAgents(intent: ParsedIntent): AgentDefinition[] {
    const relevantAgents = Array.from(this.agents.values())
      .filter(agent => this.isAgentRelevant(agent, intent))
      .sort((a, b) => b.priority - a.priority);

    return this.resolveDependencies(relevantAgents);
  }

  private registerCoreAgents(): void {
    // Your agents (Person 1)
    this.registerAgent({
      id: 'auth-agent',
      name: 'Authentication Agent',
      type: 'core',
      capabilities: ['authentication', 'authorization', 'rbac', 'jwt'],
      dependencies: [],
      priority: 100
    });

    this.registerAgent({
      id: 'security-agent',
      name: 'Security Agent',
      type: 'supporting',
      capabilities: ['security-scan', 'vulnerability-detection', 'compliance'],
      dependencies: ['code-gen-agent'],
      priority: 90
    });

    this.registerAgent({
      id: 'monitoring-agent',
      name: 'Monitoring Agent',
      type: 'supporting',
      capabilities: ['monitoring', 'health-checks', 'performance-metrics'],
      dependencies: ['api-agent'],
      priority: 80
    });

    // Other team members' agents
    this.registerAgent({
      id: 'database-agent',
      name: 'Database Agent',
      type: 'core',
      capabilities: ['database-schema', 'migrations', 'relationships'],
      dependencies: [],
      priority: 95
    });

    // ... register other agents
  }
}
```

### 4. Intent Parser

```typescript
// packages/orchestrator/src/intent-parser.ts
export interface ParsedIntent {
  type: 'api' | 'auth' | 'database' | 'security' | 'monitoring' | 'fullstack';
  complexity: 'simple' | 'medium' | 'complex';
  features: string[];
  technologies: string[];
  securityRequirements: string[];
}

export class IntentParser {
  async parse(userInput: string): Promise<ParsedIntent> {
    // Use Claude to analyze user intent
    const prompt = `
    Analyze this user request and extract:
    1. Primary intent type (api, auth, database, security, monitoring, fullstack)
    2. Complexity level
    3. Required features
    4. Preferred technologies
    5. Security requirements

    User request: "${userInput}"

    Respond with JSON format.
    `;

    const response = await this.analyzeWithAI(prompt);
    return JSON.parse(response);
  }

  private async analyzeWithAI(prompt: string): Promise<string> {
    // Integration with Claude API
    // Implementation details...
  }
}
```

---

## 🔐 Auth Agent Development

### Agent Structure
```typescript
// agents/core/auth/auth-agent.ts
export class AuthAgent extends BaseAgent {
  private clerkService: ClerkService;
  private jwtService: JWTService;
  private rbacService: RBACService;

  constructor(config: AuthAgentConfig) {
    super('auth-agent', config);
    this.clerkService = new ClerkService(config.clerkKeys);
    this.jwtService = new JWTService(config.jwtSecret);
    this.rbacService = new RBACService();
  }

  async generateAuthSystem(request: AuthRequest): Promise<AuthSystem> {
    const authConfig = await this.analyzeAuthRequirements(request);

    return {
      authentication: await this.generateAuthentication(authConfig),
      authorization: await this.generateAuthorization(authConfig),
      middleware: await this.generateMiddleware(authConfig),
      database: await this.generateDatabaseSchema(authConfig),
      frontend: await this.generateFrontendComponents(authConfig)
    };
  }

  private async generateAuthentication(config: AuthConfig): Promise<AuthCode> {
    switch (config.provider) {
      case 'clerk':
        return this.clerkService.generateIntegration(config);
      case 'custom':
        return this.generateCustomAuth(config);
      case 'oauth':
        return this.generateOAuthProviders(config);
      default:
        throw new Error(`Unsupported auth provider: ${config.provider}`);
    }
  }
}
```

### Clerk Integration Generator
```typescript
// agents/core/auth/providers/clerk.ts
export class ClerkService {
  generateIntegration(config: AuthConfig): AuthCode {
    return {
      backend: this.generateBackendCode(config),
      frontend: this.generateFrontendCode(config),
      configuration: this.generateConfigCode(config)
    };
  }

  private generateBackendCode(config: AuthConfig): string {
    return `
// src/auth/clerk.config.ts
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import express from 'express';

export const clerkMiddleware = ClerkExpressWithAuth({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// src/auth/auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthObject } from '@clerk/backend';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth: AuthObject = request.auth;

    return !!auth.userId;
  }
}

// src/auth/roles.guard.ts
import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
    `;
  }
}
```

### JWT Middleware Generator
```typescript
// agents/core/auth/providers/jwt.ts
export class JWTService {
  generateJWTMiddleware(config: AuthConfig): string {
    return `
// src/auth/jwt.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

@Injectable()
export class JWTMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = decoded;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}

// src/auth/jwt.strategy.ts
import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JWTStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles
    };
  }
}
    `;
  }
}
```

### RBAC System Generator
```typescript
// agents/core/auth/rbac.ts
export class RBACService {
  generateRBACSystem(roles: RoleDefinition[]): string {
    return `
// src/auth/rbac.decorator.ts
export enum Permission {
  CREATE_USER = 'create:user',
  READ_USERS = 'read:users',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',
  // ... more permissions
}

export const ROLES = {
  ADMIN: ['*'], // All permissions
  MANAGER: [
    Permission.READ_USERS,
    Permission.UPDATE_USER,
    Permission.CREATE_USER
  ],
  USER: [
    Permission.READ_USERS
  ]
} as const;

// src/auth/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const userPermissions = ROLES[user.role] || [];

    return this.hasPermissions(userPermissions, requiredPermissions);
  }

  private hasPermissions(userPermissions: string[], required: string[]): boolean {
    if (userPermissions.includes('*')) return true;
    return required.every(permission =>
      userPermissions.includes(permission) ||
      userPermissions.some(up => up.endsWith('*') && permission.startsWith(up.slice(0, -1)))
    );
  }
}

// Usage example:
// @Controller('users')
// @UseGuards(JWTAuthGuard, PermissionsGuard)
// export class UsersController {
//
//   @Post()
//   @Permissions(Permission.CREATE_USER)
//   async createUser() {
//     // implementation
//   }
// }
    `;
  }
}
```

---

## 🛡 Security Agent Development

### Agent Structure
```typescript
// agents/supporting/security/security-agent.ts
export class SecurityAgent extends BaseAgent {
  private sastScanner: SASTScanner;
  private dastScanner: DASTScanner;
  private secretScanner: SecretScanner;
  private complianceChecker: ComplianceChecker;

  constructor(config: SecurityAgentConfig) {
    super('security-agent', config);
    this.sastScanner = new TrivyScanner();
    this.dastScanner = new BeagleScanner();
    this.secretScanner = new GitGuardianScanner();
    this.complianceChecker = new OWASPComplianceChecker();
  }

  async secureApplication(request: SecurityRequest): Promise<SecurityReport> {
    const securityScan = await this.performSecurityScan(request.codebase);
    const vulnerabilities = await this.identifyVulnerabilities(securityScan);
    const fixes = await this.generateSecurityFixes(vulnerabilities);

    return {
      scanResults: securityScan,
      vulnerabilities,
      fixes,
      complianceStatus: await this.complianceChecker.check(request.codebase),
      securityScore: this.calculateSecurityScore(vulnerabilities)
    };
  }
}
```

### SAST Scanner Integration
```typescript
// agents/supporting/security/scanners/sast.ts
export class TrivyScanner {
  async scanCodebase(codebasePath: string): Promise<SASTResult> {
    const command = `trivy fs --format json --quiet ${codebasePath}`;

    try {
      const result = await this.executeCommand(command);
      const scanResults = JSON.parse(result.stdout);

      return {
        vulnerabilities: scanResults.Results,
        summary: this.generateSummary(scanResults),
        recommendations: this.generateRecommendations(scanResults)
      };
    } catch (error) {
      throw new Error(`SAST scan failed: ${error.message}`);
    }
  }

  generateSecurityFixes(vulnerabilities: Vulnerability[]): SecurityFix[] {
    return vulnerabilities.map(vuln => ({
      type: 'code_fix',
      severity: vuln.Severity,
      description: `Fix ${vuln.VulnerabilityID}`,
      code: this.generateFixCode(vuln),
      test: this.generateSecurityTest(vuln)
    }));
  }

  private generateFixCode(vulnerability: Vulnerability): string {
    switch (vulnerability.VulnerabilityID) {
      case 'CVE-2021-23336': // Prototype pollution
        return `
// Fix for prototype pollution
function sanitize(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key) && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
      sanitized[key] = sanitize(obj[key]);
    }
  }

  return sanitized;
}

// Usage
const userInput = req.body;
const sanitizedInput = sanitize(userInput);
        `;

      case 'CVE-2019-10758': // MongoDB NoSQL injection
        return `
// Fix for NoSQL injection
import { Filter } from 'mongodb';

function sanitizeFilter(filter: any): Filter<any> {
  if (typeof filter !== 'object' || filter === null) {
    return filter;
  }

  const sanitized: Filter<any> = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) {
      throw new Error('Invalid operator in filter');
    }
    sanitized[key] = typeof value === 'object' ? sanitizeFilter(value) : value;
  }

  return sanitized;
}

// Usage
const userFilter = sanitizeFilter(req.query);
const users = await db.collection('users').find(userFilter).toArray();
        `;

      default:
        return `// Review and fix: ${vulnerability.Title}`;
    }
  }
}
```

### Secret Detection
```typescript
// agents/supporting/security/scanners/secrets.ts
export class GitGuardianScanner {
  async scanForSecrets(codebase: string): Promise<SecretResult[]> {
    const secrets: SecretResult[] = [];

    // Scan for common secret patterns
    const secretPatterns = [
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
      { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
      { name: 'JWT Secret', pattern: /JWT_SECRET\s*=\s*['"']([^'"']+)['"']/g },
      { name: 'Database URL', pattern: /DATABASE_URL\s*=\s*['"']([^'"']+)['"']/g }
    ];

    for (const file of this.getAllFiles(codebase)) {
      const content = await fs.readFile(file, 'utf8');

      for (const pattern of secretPatterns) {
        const matches = content.match(pattern.pattern);
        if (matches) {
          secrets.push({
            file: file.replace(codebase, ''),
            type: pattern.name,
            matches: matches.map(match => match.slice(0, 10) + '...'),
            severity: 'high',
            recommendation: 'Move to environment variables'
          });
        }
      }
    }

    return secrets;
  }

  generateSecretMaskingMiddleware(): string {
    return `
// src/security/secret-masking.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecretMaskingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecretMaskingMiddleware.name);
  private readonly sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'auth',
    'authorization', 'apikey', 'access_key', 'secret_key'
  ];

  use(req: Request, res: Response, next: NextFunction) {
    // Log sanitized request
    this.logRequest(req);

    // Override res.json to mask sensitive data
    const originalJson = res.json;
    res.json = function(data: any) {
      const sanitizedData = this.maskSensitiveData(data);
      return originalJson.call(this, sanitizedData);
    }.bind(this);

    next();
  }

  private maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const masked = Array.isArray(data) ? [...data] : { ...data };

    for (const key in masked) {
      if (this.sensitiveKeys.some(sensitive =>
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        masked[key] = '***MASKED***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }

    return masked;
  }

  private logRequest(req: Request): void {
    const sanitizedHeaders = this.maskSensitiveData(req.headers);
    const sanitizedBody = this.maskSensitiveData(req.body);

    this.logger.log({
      method: req.method,
      url: req.url,
      headers: sanitizedHeaders,
      body: sanitizedBody
    });
  }
}
    `;
  }
}
```

---

## 📊 Monitoring Agent Development

### Agent Structure
```typescript
// agents/supporting/monitoring/monitoring-agent.ts
export class MonitoringAgent extends BaseAgent {
  private datadogService: DatadogService;
  private sentryService: SentryService;
  private healthChecker: HealthChecker;

  constructor(config: MonitoringAgentConfig) {
    super('monitoring-agent', config);
    this.datadogService = new DatadogService(config.datadogKeys);
    this.sentryService = new SentryService(config.sentryDSN);
    this.healthChecker = new HealthChecker();
  }

  async setupMonitoring(request: MonitoringRequest): Promise<MonitoringSystem> {
    return {
      metrics: await this.setupMetrics(request),
      logging: await this.setupLogging(request),
      errorTracking: await this.setupErrorTracking(request),
      healthChecks: await this.setupHealthChecks(request),
      dashboards: await this.generateDashboards(request)
    };
  }
}
```

### Datadog Integration
```typescript
// agents/supporting/monitoring/datadog.ts
export class DatadogService {
  generateDatadogIntegration(config: MonitoringConfig): string {
    return `
// src/monitoring/datadog.module.ts
import { Module } from '@nestjs/common';
import { DatadogModule } from '@nestjs-datadog';

@Module({
  imports: [
    DatadogModule.forRoot({
      apiKey: process.env.DATADOG_API_KEY,
      appKey: process.env.DATADOG_APP_KEY,
      env: process.env.NODE_ENV,
      serviceName: 'loveable-backend',
      serviceVersion: process.env.APP_VERSION,
      hostname: process.env.HOSTNAME,
      ddsource: 'nodejs',
      ddtags: \`env:\${process.env.NODE_ENV},service:\${process.env.SERVICE_NAME}\`,
    }),
  ],
  exports: [DatadogModule],
})
export class CustomDatadogModule {}

// src/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  private readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  });

  private readonly activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
  });

  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal
      .labels(method, route, statusCode.toString())
      .inc();
  }

  observeHttpRequestDuration(method: string, route: string, duration: number): void {
    this.httpRequestDuration
      .labels(method, route)
      .observe(duration);
  }

  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }
}
    `;
  }
}
```

### Health Check System
```typescript
// agents/supporting/monitoring/health.ts
export class HealthChecker {
  generateHealthCheckSystem(services: ServiceDefinition[]): string {
    return `
// src/health/health.controller.ts
import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  HealthCheckResult,
  HealthIndicatorFunction,
  DiskHealthIndicator,
  MemoryHealthIndicator,
  DatabaseHealthIndicator
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health';
import { ExternalAPIHealthIndicator } from './indicators/external-api.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private db: DatabaseHealthIndicator,
    private redis: RedisHealthIndicator,
    private externalAPI: ExternalAPIHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check overall system health' })
  @ApiResponse({
    status: 200,
    description: 'System is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' }
      }
    }
  })
  async check(): Promise<HealthCheckResult> {
    const healthIndicators: HealthIndicatorFunction[] = [
      // Database health
      () => this.db.pingCheck('database', { timeout: 3000 }),

      // Redis health
      () => this.redis.isHealthy('redis', { timeout: 3000 }),

      // Memory health
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),   // 150MB

      // Disk health
      () => this.disk.checkStorage('storage', { thresholdPercent: 0.9, path: '/' }),

      // External API health
      () => this.externalAPI.pingCheck('claude_api', { url: 'https://api.anthropic.com/v1/models' }),
      () => this.externalAPI.pingCheck('clerk_api', { url: 'https://api.clerk.dev/v1/users' }),
    ];

    return this.health.check(healthIndicators);
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Check application readiness' })
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('liveness')
  @HealthCheck()
  @ApiOperation({ summary: 'Check application liveness' })
  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }
}

// src/health/indicators/custom.health.ts
import { HealthIndicator, HealthCheckResult, HealthIndicatorResult } from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';

export interface HealthIndicatorConfig {
  name: string;
  check: () => Promise<boolean>;
  timeout?: number;
}

@Injectable()
export class CustomHealthIndicator extends HealthIndicator {
  async checkCustomIndicator(config: HealthIndicatorConfig): Promise<HealthIndicatorResult> {
    const isHealthy = await Promise.race([
      config.check(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), config.timeout || 5000)
      )
    ]).catch(() => false);

    const result = this.getStatus(config.name, isHealthy);

    if (!isHealthy) {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
    `;
  }
}
```

### Sentry Error Tracking
```typescript
// agents/supporting/monitoring/sentry.ts
export class SentryService {
  generateSentryIntegration(config: MonitoringConfig): string {
    return `
// src/sentry/sentry.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { SentryInterceptor } from './sentry.interceptor';

@Module({
  providers: [
    {
      provide: 'SENTRY_INITIALIZED',
      useFactory: () => {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          release: process.env.APP_VERSION,

          // Set tracesSampleRate to 1.0 to capture 100%
          // of transactions for performance monitoring.
          tracesSampleRate: 1.0,

          // Set sampling rate for profiling
          profilesSampleRate: 1.0,

          integrations: [
            new ProfilingIntegration(),
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({ app }),
            new Sentry.Integrations.Modules(),
            new Sentry.Integrations.FunctionToString(),
            new Sentry.Integrations.LinkedErrors(),
            new Sentry.Integrations.Console(),
            new Sentry.Integrations.OnUncaughtException(),
            new Sentry.Integrations.OnUnhandledRejection(),
          ],

          beforeSend(event) {
            // Filter out sensitive information
            if (event.request) {
              delete event.request.headers;
              delete event.request.cookies;
            }
            return event;
          },
        });

        return true;
      },
    },
  ],
  exports: ['SENTRY_INITIALIZED'],
})
export class SentryModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(Sentry.Handlers.requestHandler())
      .forRoutes('*');

    consumer
      .apply(Sentry.Handlers.errorHandler())
      .forRoutes('*');
  }
}

// src/sentry/sentry.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const transaction = Sentry.startTransaction({
      name: \`\${context.getClass().name}.\${context.getHandler().name}\`,
      op: 'http.server',
    });

    Sentry.configureScope(scope => {
      scope.setSpan(transaction);
      scope.setUser({ id: '123', email: 'user@example.com' });
      scope.setTag('route', context.getHandler().name);
      scope.setContext('request', {
        method: context.switchToHttp().getRequest().method,
        url: context.switchToHttp().getRequest().url,
      });
    });

    return next.handle().pipe(
      catchError(error => {
        Sentry.captureException(error);
        transaction.finish();
        throw error;
      }),
      finalize(() => {
        transaction.finish();
      })
    );
  }
}
    `;
  }
}
```

---

## 🔗 Integration & Testing

### Agent Integration Tests
```typescript
// tests/integration/person1-agents.test.ts
describe('Person 1 Agents Integration', () => {
  let orchestrator: MainOrchestrator;
  let authAgent: AuthAgent;
  let securityAgent: SecurityAgent;
  let monitoringAgent: MonitoringAgent;

  beforeAll(async () => {
    orchestrator = new MainOrchestrator(testConfig);
    authAgent = new AuthAgent(authConfig);
    securityAgent = new SecurityAgent(securityConfig);
    monitoringAgent = new MonitoringAgent(monitoringConfig);
  });

  describe('Auth Agent Integration', () => {
    it('should generate complete auth system with Clerk', async () => {
      const request = {
        type: 'api',
        features: ['authentication', 'authorization'],
        authProvider: 'clerk'
      };

      const result = await authAgent.generateAuthSystem(request);

      expect(result.authentication).toBeDefined();
      expect(result.authorization).toBeDefined();
      expect(result.middleware).toBeDefined();
      expect(result.database).toBeDefined();
      expect(result.frontend).toBeDefined();
    });

    it('should generate JWT middleware correctly', async () => {
      const jwtCode = await authAgent.generateJWTMiddleware({});

      expect(jwtCode).toContain('JWTMiddleware');
      expect(jwtCode).toContain('extractToken');
      expect(jwtCode).toContain('jwt.verify');
    });
  });

  describe('Security Agent Integration', () => {
    it('should scan codebase for vulnerabilities', async () => {
      const mockCodebase = {
        files: ['src/main.ts', 'src/auth/auth.service.ts'],
        content: 'mock code content'
      };

      const result = await securityAgent.secureApplication(mockCodebase);

      expect(result.vulnerabilities).toBeDefined();
      expect(result.fixes).toBeDefined();
      expect(result.complianceStatus).toBeDefined();
      expect(result.securityScore).toBeGreaterThan(0);
    });

    it('should detect secrets in code', async () => {
      const codeWithSecrets = `
        const apiKey = 'AKIA1234567890123456';
        const dbUrl = 'postgresql://user:pass@localhost/db';
      `;

      const secrets = await securityAgent.secretScanner.scanForSecrets(codeWithSecrets);

      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets[0].type).toBe('AWS Access Key');
    });
  });

  describe('Monitoring Agent Integration', () => {
    it('should setup complete monitoring system', async () => {
      const request = {
        services: ['api', 'database', 'redis'],
        metrics: ['performance', 'errors', 'custom']
      };

      const result = await monitoringAgent.setupMonitoring(request);

      expect(result.metrics).toBeDefined();
      expect(result.logging).toBeDefined();
      expect(result.errorTracking).toBeDefined();
      expect(result.healthChecks).toBeDefined();
      expect(result.dashboards).toBeDefined();
    });
  });
});
```

### End-to-End Testing
```typescript
// tests/e2e/orchestrator.e2e.test.ts
describe('Orchestrator E2E Tests', () => {
  let orchestrator: MainOrchestrator;

  beforeAll(async () => {
    orchestrator = new MainOrchestrator(e2eConfig);
  });

  it('should handle complete full-stack application generation', async () => {
    const userRequest = {
      text: 'Create a task management API with user authentication, real-time updates, and security monitoring',
      preferences: {
        techStack: ['nestjs', 'postgresql', 'redis'],
        features: ['auth', 'real-time', 'monitoring']
      }
    };

    const result = await orchestrator.processUserRequest(userRequest);

    // Verify all agents participated
    expect(result.agentsUsed).toContain('auth-agent');
    expect(result.agentsUsed).toContain('security-agent');
    expect(result.agentsUsed).toContain('monitoring-agent');

    // Verify complete project structure
    expect(result.codeStructure).toHaveProperty('backend');
    expect(result.codeStructure).toHaveProperty('frontend');
    expect(result.codeStructure).toHaveProperty('infrastructure');

    // Verify security measures are in place
    expect(result.security).toHaveProperty('authentication');
    expect(result.security).toHaveProperty('authorization');
    expect(result.security).toHaveProperty('monitoring');
  });
});
```

---

## 🏗 Code Architecture Patterns

### Base Agent Class
```typescript
// packages/agents/src/base-agent.ts
export abstract class BaseAgent {
  protected id: string;
  protected config: AgentConfig;
  protected capabilities: string[];

  constructor(id: string, config: AgentConfig) {
    this.id = id;
    this.config = config;
    this.capabilities = this.defineCapabilities();
  }

  abstract defineCapabilities(): string[];

  async execute(request: AgentRequest): Promise<AgentResult> {
    // Validate request
    this.validateRequest(request);

    // Process request
    const result = await this.process(request);

    // Log execution
    await this.logExecution(request, result);

    return result;
  }

  protected abstract process(request: AgentRequest): Promise<AgentResult>;

  protected validateRequest(request: AgentRequest): void {
    if (!request.type) {
      throw new Error('Request type is required');
    }

    if (!this.canHandle(request)) {
      throw new Error(`Agent ${this.id} cannot handle request type: ${request.type}`);
    }
  }

  protected canHandle(request: AgentRequest): boolean {
    return this.capabilities.includes(request.type);
  }

  protected async logExecution(request: AgentRequest, result: AgentResult): Promise<void> {
    console.log(`[${this.id}] Executed ${request.type} request`);
    console.log(`[${this.id}] Result: ${result.success ? 'Success' : 'Failed'}`);
  }
}
```

### Agent Communication Protocol
```typescript
// packages/agents/src/communication.ts
export interface MCPMessage {
  id: string;
  type: 'request' | 'response' | 'broadcast';
  senderId: string;
  receiverId?: string;
  timestamp: Date;
  payload: any;
}

export class AgentCommunication {
  private messageQueue: Map<string, MCPMessage[]> = new Map();
  private handlers: Map<string, (message: MCPMessage) => Promise<void>> = new Map();

  async sendMessage(message: MCPMessage): Promise<void> {
    if (message.receiverId) {
      // Direct message
      await this.sendDirectMessage(message);
    } else {
      // Broadcast message
      await this.broadcastMessage(message);
    }
  }

  private async sendDirectMessage(message: MCPMessage): Promise<void> {
    const queue = this.messageQueue.get(message.receiverId!) || [];
    queue.push(message);
    this.messageQueue.set(message.receiverId!, queue);

    // Notify receiver
    const handler = this.handlers.get(message.receiverId!);
    if (handler) {
      await handler(message);
    }
  }

  private async broadcastMessage(message: MCPMessage): Promise<void> {
    for (const [agentId] of this.handlers) {
      if (agentId !== message.senderId) {
        const broadcastMessage = { ...message, receiverId: agentId };
        await this.sendDirectMessage(broadcastMessage);
      }
    }
  }

  registerHandler(agentId: string, handler: (message: MCPMessage) => Promise<void>): void {
    this.handlers.set(agentId, handler);
  }
}
```

---

## ✅ Best Practices & Standards

### Code Quality Standards
1. **TypeScript First**: All code must be strongly typed
2. **100% Test Coverage**: All agent logic must have unit tests
3. **Documentation**: All public methods must have JSDoc
4. **Error Handling**: Comprehensive error handling with proper logging
5. **Security**: Never log or expose sensitive information

### Development Workflow
1. **Feature Branches**: Create feature branches for each agent
2. **Code Reviews**: All code must be reviewed before merging
3. **Automated Testing**: CI/CD pipeline must pass all tests
4. **Performance**: Monitor agent response times and optimization

### Security Guidelines
1. **Input Validation**: Validate all user inputs
2. **Secret Management**: Use environment variables for secrets
3. **Principle of Least Privilege**: Minimal permissions for agents
4. **Audit Logging**: Log all security-relevant actions

### Performance Guidelines
1. **Async/Await**: Use async patterns for all I/O operations
2. **Connection Pooling**: Reuse database and Redis connections
3. **Caching**: Cache frequently accessed data
4. **Monitoring**: Monitor agent performance and resource usage

This comprehensive guide provides you with everything needed to successfully implement the orchestrator and your three agents as Person 1. The guide includes detailed code examples, architecture patterns, testing strategies, and best practices to ensure production-quality implementation.