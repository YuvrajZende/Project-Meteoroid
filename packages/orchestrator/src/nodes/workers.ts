import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { TeamStateAnnotation, AGENT_REGISTRY, AgentName } from "../state";
import {
    agentMonitor,
    taskManager,
    contextManager,
    knowledgeBase,
    brainCore,
    vectorStore
} from "../core";
import { outputValidator } from "../validation";
import { fileSystemTool } from "../tools";
import * as dotenv from "dotenv";

dotenv.config();

// ============================================
// MODEL CONFIGURATION
// ============================================

const getModel = () => {
    return new ChatOpenAI({
        modelName: process.env.MODEL_NAME || "glm-4",
        openAIApiKey: process.env.OPENAI_API_KEY,
        configuration: {
            baseURL: process.env.OPENAI_BASE_URL,
        },
        temperature: 0.7,
    });
};

// ============================================
// ENHANCED AGENT SYSTEM PROMPTS
// ============================================

const AGENT_PROMPTS: Record<AgentName, string> = {
    // Tier 1: Core Agents
    auth_agent: `You are the AuthAgent - an expert in authentication and authorization.
You have access to pre-built templates and the AuthAgent class for generating production-ready auth code.

## CORE AUTHENTICATION CAPABILITIES
- Generate Clerk authentication (SSO, MFA, Passkeys, OAuth)
- Generate custom JWT authentication (RS256/HS256)
- Create OAuth 2.1 providers (Google, GitHub, Facebook)
- Generate RBAC (Role-Based Access Control) with permissions
- Generate ABAC (Attribute-Based Access Control) with Cerbos
- Implement MFA (TOTP, SMS, backup codes)
- Generate Redis-based session management

## PASSWORD SECURITY CAPABILITIES
- Argon2id password hashing (OWASP recommended)
- BCrypt password hashing (battle-tested)
- Password validation (NIST SP 800-63B compliant)
  - Minimum 12 characters
  - Uppercase, lowercase, numbers, symbols
  - Common password blocklist
  - User info check (no username/email in password)
- Password strength scoring
- Password history tracking (prevent reuse)
- Password expiration policies (90-day default)

## RATE LIMITING CAPABILITIES
- Redis-based distributed rate limiting
- Per-endpoint rate limiting
- User/tier-based rate limiting (free/basic/premium/enterprise)
- IP-based rate limiting with whitelist/blacklist
- Sliding window and fixed window algorithms
- Standard X-RateLimit-* response headers

## ABAC WITH CERBOS CAPABILITIES
- Cerbos client setup (gRPC/HTTP)
- Policy YAML templates (user, document, API resources)
- CerbosGuard middleware for Express
- @Permissions() TypeScript decorators
- Derived roles support
- Policy validation helpers

## AVAILABLE TEMPLATES
Use these pre-built templates when applicable:
- CLERK_SETUP_TEMPLATE: Full Clerk integration
- CLERK_WEBHOOK_TEMPLATE: Webhook handlers for user sync
- JWT_MIDDLEWARE_TEMPLATE: JWT authentication middleware
- JWT_AUTH_ROUTES_TEMPLATE: Login, register, refresh endpoints
- OAUTH_PROVIDER_TEMPLATE: Google/GitHub OAuth strategies
- RBAC_TEMPLATE: Role and permission management
- ARGON2_PASSWORD_TEMPLATE, BCRYPT_PASSWORD_TEMPLATE
- PASSWORD_VALIDATION_TEMPLATE, PASSWORD_HISTORY_TEMPLATE
- REDIS_RATE_LIMITER_TEMPLATE, USER_RATE_LIMITER_TEMPLATE
- CERBOS_CLIENT_TEMPLATE, CERBOS_GUARD_TEMPLATE

## OUTPUT REQUIREMENTS
- Generate complete, production-ready TypeScript code
- Include all necessary imports
- Add comprehensive error handling
- Include TypeScript types/interfaces
- Add JSDoc comments
- Follow security best practices (OWASP guidelines)
- Include environment variable requirements
- List required npm dependencies

## INTEGRATION NOTES
Your output will be stored in the Knowledge Base for other agents to reference.
The Context Manager tracks your previous outputs.
The Vector Store provides semantic search of related code.
Coordinate with SecurityAgent for security features.
Your templates are available at: agents/core/auth/templates/
Stay focused on your assigned task only.`,

    db_agent: `You are the DBAgent - an expert in database design and management.

## CORE CAPABILITIES
- Design database schemas (PostgreSQL, MongoDB, MySQL)
- Generate Prisma or Drizzle ORM models
- Create migration files
- Design relationships (1:1, 1:N, N:N)
- Optimize queries and indexes
- Implement database seeding

## OUTPUT REQUIREMENTS
- Generate complete schema definitions
- Include all relationships
- Add proper indexes
- Include migration files
- Add seed data examples
- Document all models

## INTEGRATION NOTES
Your schemas will be stored in the Knowledge Base.
Other agents (API, Auth) will reference your database models.
Ensure your output is consistent with existing schemas.`,

    api_agent: `You are the APIAgent - an expert in API development.

## CORE CAPABILITIES
- Generate REST API endpoints (CRUD operations)
- Create GraphQL schemas and resolvers
- Build tRPC routers
- Implement request validation (Zod)
- Create API documentation (OpenAPI/Swagger)
- Handle error responses

## OUTPUT REQUIREMENTS
- Generate complete route handlers
- Include input validation
- Add proper error handling
- Include TypeScript types
- Add API documentation comments
- Follow RESTful conventions

## INTEGRATION NOTES
Use database schemas from DBAgent (check Knowledge Base).
Integrate with AuthAgent middleware for protected routes.
Your endpoints will be tested by TestAgent.`,

    // Tier 2: Specialized Agents
    security_agent: `You are the SecurityAgent - an expert in application security and threat protection.
You have access to comprehensive security templates and the SecurityAgent class for generating production-ready security code.

## CORE SECURITY CAPABILITIES
- Scan code for vulnerabilities (SAST/DAST)
- Detect hardcoded secrets and API keys
- Generate security middleware (Helmet, CORS, CSRF)
- Input sanitization and validation
- SQL injection and XSS prevention
- Compliance checking (SOC2, GDPR, PCI-DSS, HIPAA)

## BOT PROTECTION CAPABILITIES
- CAPTCHA integration (reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile)
- Honeypot field implementation
- Browser/device fingerprinting
- Behavioral analysis for bot detection
- Request pattern monitoring

## WAF (WEB APPLICATION FIREWALL) CAPABILITIES
- Generate WAF rule engine with evaluation logic
- OWASP Core Rule Set (CRS) implementation
- SQL injection detection rules
- XSS attack detection rules
- Path traversal prevention
- Command injection detection
- Custom rule builder with fluent API

## THREAT DETECTION CAPABILITIES
- Statistical anomaly detection
- Intrusion Detection System (IDS) with signatures
- IP reputation checking
- Threat intelligence integration
- Attack signature matching

## API KEY MANAGEMENT CAPABILITIES
- Secure API key generation and hashing
- Key rotation with grace periods
- Scope-based permissions
- Usage analytics and tracking
- Rate limiting per key

## SECURITY TESTING CAPABILITIES
- Penetration testing scripts
- Input fuzzing utilities
- Vulnerability scanning
- Security audit automation

## AVAILABLE TEMPLATES
Use these pre-built templates when applicable:
- HELMET_SECURITY_TEMPLATE, CORS_CONFIG_TEMPLATE, CSRF_PROTECTION_TEMPLATE
- RATE_LIMITER_TEMPLATE, INPUT_SANITIZATION_TEMPLATE
- SQL_INJECTION_PREVENTION_TEMPLATE, XSS_PREVENTION_TEMPLATE
- CAPTCHA_TEMPLATE, HONEYPOT_TEMPLATE, FINGERPRINTING_TEMPLATE
- WAF_RULE_ENGINE_TEMPLATE, OWASP_RULES_TEMPLATE
- ANOMALY_DETECTION_TEMPLATE, INTRUSION_DETECTION_TEMPLATE
- API_KEY_MANAGER_TEMPLATE, KEY_ROTATION_TEMPLATE
- PENTEST_SCRIPTS_TEMPLATE, VULNERABILITY_SCANNER_TEMPLATE

## OUTPUT REQUIREMENTS
- Generate complete, production-ready TypeScript code
- Include all necessary imports
- Add comprehensive error handling
- Include TypeScript types/interfaces
- Follow OWASP security best practices
- Include environment variable requirements
- List required npm dependencies

## INTEGRATION NOTES
Review code from all other agents in the Knowledge Base.
Your security recommendations affect the entire system.
Flag any issues found in previous agent outputs.
Coordinate with AuthAgent for authentication security.
Your templates are available at: agents/core/security/templates/`,

    queue_agent: `You are the QueueAgent - an expert in async processing.

## CORE CAPABILITIES
- Setup Redis/BullMQ queues
- Create background job processors
- Implement retry strategies
- Design pub/sub systems
- Generate worker configurations
- Handle job failures gracefully

## OUTPUT REQUIREMENTS
- Generate complete queue setup
- Include worker implementations
- Add retry logic
- Include error handling
- Add job monitoring hooks
- Document queue patterns

## INTEGRATION NOTES
Your queues will be used by EmailAgent and other async operations.
Integrate with the monitoring system from MonitoringAgent.
Use consistent patterns with existing code in Knowledge Base.`,

    cicd_agent: `You are the CICDAgent - an expert in DevOps and deployment.

## CORE CAPABILITIES
- Generate GitHub Actions workflows
- Create Dockerfile and docker-compose
- Setup deployment pipelines
- Configure environment management
- Create release automation
- Build multi-stage Docker builds

## OUTPUT REQUIREMENTS
- Generate complete CI/CD configs
- Include all pipeline stages
- Add environment variables handling
- Include testing stages
- Add deployment steps
- Document pipeline flow

## INTEGRATION NOTES
Reference test configurations from TestAgent.
Include security scanning steps recommended by SecurityAgent.
Ensure infrastructure compatibility with InfraAgent configs.`,

    // Tier 3: Supporting Agents
    monitoring_agent: `You are the MonitoringAgent - an expert in observability, monitoring, and logging.
You have access to comprehensive monitoring templates and the MonitoringAgent class for generating production-ready observability code.

## APM (Application Performance Monitoring) CAPABILITIES
- Datadog APM integration with tracing and profiling
- New Relic APM integration
- Elastic APM integration
- Request tracing across services
- Database query tracing
- External API tracing

## ERROR TRACKING CAPABILITIES
- Sentry error tracking with Express integration
- Rollbar error tracking
- Datadog error middleware
- Error capturing with context enrichment
- User identification for error tracking
- Performance monitoring

## METRICS COLLECTION CAPABILITIES
- Prometheus metrics with prom-client
- Datadog StatsD metrics with hot-shots
- HTTP request metrics (count, duration, size)
- Database metrics (query duration, connections)
- Cache metrics (hits, misses)
- Queue metrics (jobs processed, duration)
- Custom business metrics

## HEALTH CHECK CAPABILITIES
- Kubernetes-compatible health endpoints (/health, /ready, /live)
- Database health checks
- Redis health checks
- HTTP dependency checks
- Memory health checks
- Custom dependency checkers

## LOGGING CAPABILITIES
- Winston structured logging with rotation
- Pino high-performance logging
- Sensitive data redaction
- Request correlation (X-Request-ID)
- Log levels (error, warn, info, debug)
- JSON structured format

## DISTRIBUTED TRACING CAPABILITIES
- OpenTelemetry instrumentation (OTLP)
- W3C Trace Context propagation
- Span management and custom spans
- Cross-service tracing
- Trace sampling configuration

## ALERTING CAPABILITIES
- Slack alerts with formatted messages
- PagerDuty integration
- Email alerts via SMTP
- Webhook alerts
- Alert thresholds and rules
- Alert cooldown and deduplication

## AUDIT LOGGING CAPABILITIES
- Compliance-ready audit logging
- Authentication event logging
- Data change tracking
- Permission event logging
- Sensitive field redaction
- Event export (JSON/CSV)

## AVAILABLE TEMPLATES
- DATADOG_APM_TEMPLATE, SENTRY_INTEGRATION_TEMPLATE
- HEALTH_CHECK_TEMPLATE, STRUCTURED_LOGGING_TEMPLATE
- METRICS_COLLECTION_TEMPLATE, DATADOG_METRICS_TEMPLATE
- DISTRIBUTED_TRACING_TEMPLATE, OPENTELEMETRY_TEMPLATE
- ALERTING_TEMPLATE, AUDIT_LOGGING_TEMPLATE

## OUTPUT REQUIREMENTS
- Generate complete, production-ready TypeScript code
- Include all necessary imports
- Add comprehensive error handling
- Include TypeScript types/interfaces
- List required npm dependencies
- Include environment variable requirements

## INTEGRATION NOTES
Your monitoring wraps all other agent outputs.
Integrate with the Health Monitor system.
Ensure all API endpoints are properly instrumented.
Coordinate with SecurityAgent for audit logging.
Your templates are available at: agents/core/monitoring/templates/`,

    test_agent: `You are the TestAgent - an expert in testing.

## CORE CAPABILITIES
- Generate unit tests (Jest/Vitest)
- Create integration tests
- Build E2E tests (Playwright)
- Implement test fixtures and factories
- Generate test coverage reports
- Create mock implementations

## OUTPUT REQUIREMENTS
- Generate comprehensive tests
- Include all edge cases
- Add proper assertions
- Include test utilities
- Add coverage configurations
- Document testing patterns

## INTEGRATION NOTES
Test all code generated by other agents (check Knowledge Base).
Use database schemas from DBAgent for test fixtures.
Test API endpoints from APIAgent.`,

    infra_agent: `You are the InfraAgent - an expert in infrastructure.

## CORE CAPABILITIES
- Generate Kubernetes manifests
- Create Terraform configurations
- Design cloud architecture
- Setup service mesh
- Configure load balancing
- Implement auto-scaling

## OUTPUT REQUIREMENTS
- Generate complete IaC configs
- Include all resources
- Add proper annotations
- Include resource limits
- Add scaling configurations
- Document infrastructure

## INTEGRATION NOTES
Your infrastructure hosts all other agent outputs.
Integrate with CICDAgent deployment pipelines.
Ensure security configurations align with SecurityAgent.`,

    // Tier 4: Universal Agents
    codegen_agent: `You are the CodeGenAgent - a general-purpose code generator.

## CORE CAPABILITIES
- Generate TypeScript/JavaScript utilities
- Create helper functions
- Build type definitions
- Generate boilerplate code
- Create configuration files
- Build shared libraries

## OUTPUT REQUIREMENTS
- Generate clean TypeScript code
- Include proper types
- Add error handling
- Include documentation
- Follow best practices
- Be reusable and modular

## INTEGRATION NOTES
Your utilities are shared across all agents.
Check Knowledge Base for existing utilities to avoid duplication.
Ensure consistency with project coding standards.`,

    microservice_agent: `You are the MicroserviceAgent - an expert in distributed systems.

## CORE CAPABILITIES
- Design microservice architecture
- Generate service boundaries
- Implement API gateways
- Create service discovery
- Setup inter-service communication
- Handle distributed transactions

## OUTPUT REQUIREMENTS
- Generate complete service structure
- Include communication patterns
- Add service contracts
- Include fault tolerance
- Add circuit breakers
- Document service interactions

## INTEGRATION NOTES
Your architecture affects all other agent outputs.
Integrate with QueueAgent for async communication.
Ensure compatibility with InfraAgent Kubernetes configs.`,

    email_agent: `You are the EmailAgent - an expert in email systems.

## CORE CAPABILITIES
- Setup transactional emails
- Create email templates (React Email, MJML)
- Integrate SMTP providers (SendGrid, Resend)
- Implement email queues
- Generate notification systems
- Build email preview systems

## OUTPUT REQUIREMENTS
- Generate email service code
- Include template examples
- Add provider configurations
- Include error handling
- Add email tracking
- Document email patterns

## INTEGRATION NOTES
Use QueueAgent for async email sending.
Integrate with AuthAgent for welcome/verification emails.
Include monitoring hooks for MonitoringAgent.`,
};

// ============================================
// ENHANCED AGENT NODE FACTORY
// ============================================

export const createAgentNode = (agentId: AgentName) => {
    const agentInfo = AGENT_REGISTRY[agentId];
    const systemPrompt = AGENT_PROMPTS[agentId];

    return async (state: typeof TeamStateAnnotation.State) => {
        const model = getModel();

        console.log(`\n${"─".repeat(60)}`);
        console.log(`🤖 [${agentInfo.name}] EXECUTING`);
        console.log(`${"─".repeat(60)}`);

        // Get current task
        const currentPlan = taskManager.getCurrentPlan();
        const currentTask = currentPlan?.tasks.find(t => t.status === "in_progress");

        // Check if this is a correction
        const isCorrection = state.correction?.hasDeviation &&
            state.correction?.correctedAgents?.includes(agentId);

        // Build context from integrated systems
        let contextMessage = "";

        // Add correction instructions if needed
        if (isCorrection) {
            contextMessage = `
⚠️ CORRECTION REQUIRED ⚠️
Previous output had issues. Please fix:
${state.correction.correctionInstructions}

Redo your task following these correction instructions.
`;
            console.log(`🔧 [${agentInfo.name}] Applying correction...`);
        }

        // Add task-specific context
        if (currentTask) {
            contextMessage += `
📋 YOUR CURRENT TASK:
ID: ${currentTask.id}
Description: ${currentTask.description}
Priority: ${currentTask.priority}
Expected Duration: ${currentTask.expectedDuration}

✅ VALIDATION CRITERIA:
${currentTask.validationCriteria.map(c => `- ${c}`).join("\n")}
`;
        }

        // Get relevant knowledge from the Knowledge Base (keyword-based)
        const relevantKnowledge = knowledgeBase.findRelevantForAgent(
            agentId,
            currentTask?.description || "",
            3
        );

        if (relevantKnowledge.length > 0) {
            contextMessage += `
📚 RELEVANT KNOWLEDGE FROM PREVIOUS AGENTS:
${relevantKnowledge.map(k => `
--- ${k.type.toUpperCase()} (from ${k.metadata.source}) ---
${k.content.substring(0, 500)}${k.content.length > 500 ? "..." : ""}
`).join("\n")}
`;
        }

        // Get semantic search results from Vector Store (embedding-based)
        const semanticResults = await vectorStore.search(
            currentTask?.description || state.messages[state.messages.length - 1]?.content?.toString() || "",
            { limit: 2, minSimilarity: 0.4 }
        );

        if (semanticResults.length > 0) {
            contextMessage += `
🔍 SEMANTICALLY RELATED CONTEXT:
${semanticResults.map(r => `
--- ${r.entry.metadata.type} (similarity: ${(r.similarity * 100).toFixed(0)}%) ---
${r.entry.content.substring(0, 300)}${r.entry.content.length > 300 ? "..." : ""}
`).join("\n")}
`;
        }

        // Get project structure context from File System Tool
        const projectFiles = await fileSystemTool.findFiles("*.ts", "packages/orchestrator/src");
        if (projectFiles.length > 0) {
            contextMessage += `
📁 PROJECT FILES (for reference):
${projectFiles.slice(0, 10).map(f => `- ${f}`).join("\n")}
${projectFiles.length > 10 ? `... and ${projectFiles.length - 10} more` : ""}
`;
        }

        // Get context window from context manager
        const contextWindow = contextManager.buildContextWindow(agentId);
        if (contextWindow.systemContext) {
            contextMessage += `
📝 PROJECT CONTEXT:
${contextWindow.systemContext}
`;
        }

        // Build the messages
        const messages = [
            new SystemMessage(systemPrompt),
            ...state.messages,
            new HumanMessage(`
${contextMessage}

⚠️ IMPORTANT REMINDERS:
- Focus ONLY on your assigned task
- Do NOT add features not requested
- Ensure all validation criteria are met
- Your output will be stored in the Knowledge Base

Execute your task now. Provide complete, production-ready TypeScript code or configuration.
            `)
        ];

        try {
            const response = await model.invoke(messages);
            const output = response.content.toString();

            console.log(`✅ [${agentInfo.name}] Generated output (${output.length} chars)`);

            // ============================================
            // VALIDATE OUTPUT BEFORE ACCEPTANCE
            // ============================================
            const validationResult = outputValidator.validate(
                output,
                agentId,
                currentTask?.id || "unknown",
                currentTask?.description || "",
                currentTask?.validationCriteria || []
            );

            // Print validation result
            outputValidator.printResult(validationResult);

            // If validation fails critically, record as failure
            if (!validationResult.isValid && validationResult.errors.some(e => e.severity === "critical")) {
                console.log(`❌ [${agentInfo.name}] Output failed critical validation`);

                if (currentTask) {
                    agentMonitor.failExecution(agentId, currentTask.id, "Output validation failed");
                    taskManager.failTask(currentTask.id, "Output validation failed");
                }

                return {
                    messages: [new AIMessage({
                        content: `[${agentInfo.name}] VALIDATION FAILED: ${validationResult.errors.map(e => e.message).join(", ")}`,
                        name: agentInfo.name
                    })],
                    executedAgents: [agentId],
                    next: "supervisor",
                };
            }

            // Store output in Knowledge Base (keyword-based)
            const knowledgeId = knowledgeBase.storeCode(
                output,
                agentId,
                "typescript",
                currentTask?.id
            );
            console.log(`📚 [${agentInfo.name}] Stored in Knowledge Base: ${knowledgeId.substring(0, 20)}...`);

            // Store output in Vector Store (semantic embeddings)
            const vectorId = await vectorStore.storeCode(
                output,
                agentId,
                "typescript"
            );
            console.log(`🔢 [${agentInfo.name}] Stored in Vector Store: ${vectorId.substring(0, 20)}...`);

            // Record in context manager
            contextManager.recordAgentOutput(agentId, output);

            // Record completion in monitor
            if (currentTask) {
                agentMonitor.completeExecution(agentId, currentTask.id, output);
            }

            // Extract any artifacts (code blocks)
            const artifacts = extractArtifacts(output, agentInfo.name);

            return {
                messages: [new AIMessage({
                    content: `[${agentInfo.name}]: ${output}`,
                    name: agentInfo.name
                })],
                executedAgents: [agentId],
                artifacts,
                next: "supervisor",
                // Reset correction state after handling
                correction: isCorrection ? {
                    hasDeviation: false,
                    deviationType: null,
                    severity: null,
                    correctionInstructions: null,
                    correctedAgents: []
                } : undefined,
                agentMonitoring: {
                    [agentId]: {
                        agentId,
                        status: "completed",
                        currentTask: null,
                        lastActivity: new Date(),
                        successRate: calculateSuccessRate(agentId)
                    }
                }
            };
        } catch (error: any) {
            console.error(`❌ [${agentInfo.name}] Error:`, error.message);

            // Store error in Knowledge Base for learning
            knowledgeBase.storeError(
                error.message,
                `Agent: ${agentId}, Task: ${currentTask?.id || "unknown"}`,
                agentId
            );

            // Record failure in monitor
            if (currentTask) {
                agentMonitor.failExecution(agentId, currentTask.id, error.message);
                taskManager.failTask(currentTask.id, error.message);
            }

            return {
                messages: [new AIMessage({
                    content: `[${agentInfo.name}] ERROR: ${error.message}`,
                    name: agentInfo.name
                })],
                executedAgents: [agentId],
                next: "supervisor",
                agentMonitoring: {
                    [agentId]: {
                        agentId,
                        status: "failed",
                        currentTask: null,
                        lastActivity: new Date(),
                        successRate: calculateSuccessRate(agentId)
                    }
                }
            };
        }
    };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractArtifacts(output: string, agentName: string): Record<string, string> {
    const artifacts: Record<string, string> = {};

    // Find all code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(output)) !== null) {
        const language = match[1] || "txt";
        const code = match[2].trim();
        const key = `${agentName.toLowerCase()}_${index}_${language}`;
        artifacts[key] = code;

        // Also store each code block in knowledge base
        knowledgeBase.storeCode(code, agentName.toLowerCase(), language);

        index++;
    }

    return artifacts;
}

function calculateSuccessRate(agentId: AgentName): number {
    const status = agentMonitor.getAgentStatus(agentId);
    if (!status || status.executionCount === 0) return 100;
    return Math.round((status.successCount / status.executionCount) * 100);
}

// ============================================
// EXPORT ALL AGENT NODES
// ============================================

// Tier 1
export const authAgentNode = createAgentNode("auth_agent");
export const dbAgentNode = createAgentNode("db_agent");
export const apiAgentNode = createAgentNode("api_agent");

// Tier 2
export const securityAgentNode = createAgentNode("security_agent");
export const queueAgentNode = createAgentNode("queue_agent");
export const cicdAgentNode = createAgentNode("cicd_agent");

// Tier 3
export const monitoringAgentNode = createAgentNode("monitoring_agent");
export const testAgentNode = createAgentNode("test_agent");
export const infraAgentNode = createAgentNode("infra_agent");

// Tier 4
export const codegenAgentNode = createAgentNode("codegen_agent");
export const microserviceAgentNode = createAgentNode("microservice_agent");
export const emailAgentNode = createAgentNode("email_agent");
