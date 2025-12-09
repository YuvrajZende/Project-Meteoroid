/**
 * ============================================
 * AGENTS MODULE - ALL AGENT EXPORTS
 * ============================================
 * 
 * Central export point for all specialized agents.
 * Each agent is responsible for generating specific
 * types of backend code.
 */

// ============================================
// CORE AGENTS (Tier 1)
// ============================================

// Auth Agent - Authentication & Authorization
export {
    AuthAgent,
    authAgent,
    AuthConfig,
    AuthProvider,
    AuthFeature,
    OAuthConfig,
    OAuthProvider,
    JWTConfig,
    RBACConfig,
    RoleDefinition,
    MFAConfig,
    MFAMethod,
    SessionConfig,
    AuthGenerationResult,
    GeneratedFile
} from "./core/auth";

// Auth Templates
export {
    CLERK_SETUP_TEMPLATE,
    CLERK_WEBHOOK_TEMPLATE,
    JWT_MIDDLEWARE_TEMPLATE,
    JWT_AUTH_ROUTES_TEMPLATE,
    OAUTH_PROVIDER_TEMPLATE,
    RBAC_TEMPLATE,
    AUTH_TEMPLATE_SETS,
    getAuthTemplates,
    getAvailableAuthTypes
} from "./core/auth";

// ============================================
// AGENT REGISTRY
// ============================================

/**
 * Get all available agents
 */
export function getAvailableAgents(): string[] {
    return [
        "auth_agent",
        "db_agent",
        "api_agent",
        "security_agent",
        "queue_agent",
        "cicd_agent",
        "monitoring_agent",
        "test_agent",
        "infra_agent",
        "codegen_agent",
        "microservice_agent",
        "email_agent"
    ];
}

/**
 * Agent capabilities map
 */
export const AGENT_CAPABILITIES = {
    auth_agent: [
        "clerk-auth", "jwt-auth", "oauth", "rbac", "abac",
        "mfa", "session-management", "rate-limiting"
    ],
    db_agent: [
        "prisma", "drizzle", "postgresql", "mongodb",
        "migrations", "seeding", "relationships"
    ],
    api_agent: [
        "rest-api", "graphql", "trpc", "openapi",
        "validation", "error-handling"
    ],
    security_agent: [
        "sast", "dast", "secrets-detection", "dependency-scanning",
        "security-headers", "compliance"
    ],
    queue_agent: [
        "bullmq", "redis-queues", "job-scheduling",
        "background-tasks", "rate-limiting"
    ],
    cicd_agent: [
        "github-actions", "gitlab-ci", "docker",
        "kubernetes", "deployment"
    ],
    monitoring_agent: [
        "datadog", "sentry", "health-checks",
        "logging", "metrics"
    ],
    test_agent: [
        "vitest", "jest", "playwright",
        "unit-tests", "integration-tests", "e2e-tests"
    ],
    infra_agent: [
        "terraform", "docker", "kubernetes",
        "aws", "gcp", "azure"
    ],
    codegen_agent: [
        "file-generator", "scaffold", "boilerplate"
    ],
    microservice_agent: [
        "service-mesh", "grpc", "event-driven",
        "saga-pattern"
    ],
    email_agent: [
        "resend", "nodemailer", "templates",
        "transactional-emails"
    ]
} as const;
