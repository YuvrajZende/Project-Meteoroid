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
} from "./core/auth/index.js";

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
} from "./core/auth/index.js";

// Database Agent - Schema, Migrations, Queries (Person 2's Implementation)
export {
    DatabaseAgentWrapper,
    databaseAgentIAgent,
    DatabaseAgent,
    databaseAgent,
} from "./core/database/index.js";

// Database Agent Types
export type {
    DatabaseType,
    ORMType,
    ColumnDataType,
    RelationType,
    DatabaseAgentConfig,
    DatabaseTaskContext,
    ColumnDefinition,
    IndexDefinition,
    RelationshipDefinition,
    TableDefinition,
    SchemaDefinition,
    EnumDefinition,
    MigrationOperation,
    MigrationDefinition,
    QueryCondition,
    QueryJoin,
    QueryOrder,
    QueryDefinition,
    SeedRecord,
    SeedConfig,
    IndexRecommendation,
    QueryAnalysis,
    ConnectionPoolConfig,
    RLSPolicy,
    DatabaseGeneratedFile,
    DatabaseGenerationResult,
} from "./core/database/index.js";

// Database Templates
export {
    PRISMA_SCHEMA_HEADER,
    PRISMA_MODEL_TEMPLATE,
    PRISMA_ENUM_TEMPLATE,
    PRISMA_FIELD_TEMPLATES,
    SUPABASE_MIGRATION_HEADER,
    SUPABASE_CREATE_TABLE,
    SUPABASE_RLS_TEMPLATE,
    SUPABASE_INDEX_TEMPLATE,
    SUPABASE_FOREIGN_KEY_TEMPLATE,
    TYPESCRIPT_SEED_TEMPLATE,
    SQL_SEED_TEMPLATE,
    QUERY_BUILDER_SERVICE_TEMPLATE,
    DATABASE_SERVICE_TEMPLATE,
    CONNECTION_POOL_TEMPLATE,
    getAvailableTemplates as getDatabaseTemplates,
    getTemplate as getDatabaseTemplate,
    DATABASE_TEMPLATE_SETS,
} from "./core/database/index.js";

// Queue Agent - Background Job Processing (Person 2's Implementation)
export {
    QueueAgentWrapper,
    queueAgentIAgent,
    QueueAgent,
    queueAgent,
} from "./core/queue/index.js";

// Queue Agent Types
export type {
    QueueProvider,
    JobState,
    JobPriority,
    BackoffStrategy,
    RedisConfig,
    QueueConfig,
    QueueSettings,
    RateLimiterConfig,
    QueueAgentConfig,
    QueueTaskContext,
    JobOptions,
    BackoffConfig,
    RepeatOptions,
    JobDefinition,
    JobTypeDefinition,
    FieldSchema,
    WorkerConfig,
    WorkerSettings,
    ProcessorDefinition,
    DeadLetterQueueConfig,
    QueueMetrics,
    WorkerMetrics,
    ScheduledJob,
    FlowDefinition,
    FlowChild,
    QueueEventType,
    EventHandlerDefinition,
    QueueGeneratedFile,
    QueueGenerationResult,
} from "./core/queue/index.js";

// Queue Templates
export {
    BULLMQ_QUEUE_CONFIG_TEMPLATE,
    BULLMQ_QUEUE_SETUP_TEMPLATE,
    BULLMQ_WORKER_TEMPLATE,
    WORKER_PROCESSOR_TEMPLATE,
    JOB_TYPES_TEMPLATE,
    RETRY_STRATEGY_TEMPLATE as QUEUE_RETRY_STRATEGY_TEMPLATE,
    DEAD_LETTER_QUEUE_TEMPLATE,
    JOB_SCHEDULER_TEMPLATE,
    QUEUE_MONITORING_TEMPLATE,
    JOB_FLOW_TEMPLATE,
    RATE_LIMITER_TEMPLATE as QUEUE_RATE_LIMITER_TEMPLATE,
    getAvailableTemplates as getQueueAvailableTemplates,
    getTemplate as getQueueTemplate,
    getQueueTemplates as getQueueTemplateSet,
    getAvailableQueueTypes,
    QUEUE_TEMPLATE_SETS,
} from "./core/queue/index.js";

// ============================================
// SECURITY AGENT (Tier 2)
// ============================================

// Security Agent - Vulnerability Detection & Protection
export {
    SecurityAgent,
    securityAgent,
    SecurityConfig,
    SecurityScanType,
    ComplianceFramework,
    EnforcementLevel,
    MiddlewareConfig,
    CORSConfig,
    RateLimitConfig,
    SecretsConfig,
    SecretPattern,
    VulnerabilitySeverity,
    Vulnerability,
    VulnerabilityType,
    VulnerabilityLocation,
    SecurityScanResult,
    ScanSummary,
    ComplianceReport,
    ComplianceControl,
    ComplianceFinding,
    RemediationItem,
    SecurityGenerationResult,
    GeneratedSecurityFile,
} from "./core/security/index.js";

// Security Templates (Base)
export {
    HELMET_SECURITY_TEMPLATE,
    CORS_CONFIG_TEMPLATE,
    CSRF_PROTECTION_TEMPLATE,
    RATE_LIMITER_TEMPLATE,
    INPUT_SANITIZATION_TEMPLATE,
    SQL_INJECTION_PREVENTION_TEMPLATE,
    XSS_PREVENTION_TEMPLATE,
    SECURITY_HEADERS_TEMPLATE,
    SECRET_SCANNER_TEMPLATE,
    DEPENDENCY_SCANNER_TEMPLATE,
    SECURITY_TEMPLATE_SETS,
    getSecurityTemplates,
    getAvailableSecurityTypes,
} from "./core/security/index.js";

// Bot Protection Templates
export {
    CAPTCHA_TEMPLATE,
    HONEYPOT_TEMPLATE,
    FINGERPRINTING_TEMPLATE,
    BEHAVIORAL_ANALYSIS_TEMPLATE,
    BOT_PROTECTION_TEMPLATE_SETS,
    getBotProtectionTemplates,
    getAvailableBotProtectionTypes,
} from "./core/security/index.js";

// WAF Rules Templates
export {
    WAF_RULE_ENGINE_TEMPLATE,
    OWASP_RULES_TEMPLATE,
    CUSTOM_RULES_TEMPLATE,
    WAF_TEMPLATE_SETS,
    getWAFTemplates,
    getAvailableWAFTypes,
} from "./core/security/index.js";

// Threat Detection Templates
export {
    ANOMALY_DETECTION_TEMPLATE,
    INTRUSION_DETECTION_TEMPLATE,
    THREAT_INTELLIGENCE_TEMPLATE,
    THREAT_DETECTION_TEMPLATE_SETS,
    getThreatDetectionTemplates,
    getAvailableThreatDetectionTypes,
} from "./core/security/index.js";

// API Key Management Templates
export {
    API_KEY_MANAGER_TEMPLATE,
    KEY_ROTATION_TEMPLATE,
    SCOPE_MANAGEMENT_TEMPLATE,
    API_KEY_ANALYTICS_TEMPLATE,
    API_KEY_TEMPLATE_SETS,
    getAPIKeyTemplates,
    getAvailableAPIKeyTypes,
} from "./core/security/index.js";

// Security Testing Templates
export {
    PENTEST_SCRIPTS_TEMPLATE,
    FUZZING_TEMPLATE,
    VULNERABILITY_SCANNER_TEMPLATE,
    SECURITY_TESTING_TEMPLATE_SETS,
    getSecurityTestingTemplates,
    getAvailableSecurityTestingTypes,
} from "./core/security/index.js";

// ============================================
// MONITORING AGENT (Tier 3)
// ============================================

// Monitoring Agent - Observability & Health Checks
export {
    MonitoringAgent,
    monitoringAgent,
    MonitoringConfig,
    MetricsConfig,
    HealthCheckConfig,
    DependencyCheck,
    AlertingConfig,
    AlertChannel,
    AlertThreshold,
    AuditConfig,
    GeneratedMonitoringFile,
    MonitoringGenerationResult,
    MonitoringScanResult,
    MonitoringIssue,
} from "./core/monitoring/index.js";

// Monitoring Agent Enhanced (with Brain Integration)
export {
    MonitoringAgentEnhanced,
    monitoringAgentEnhanced,
    MonitoringAnalysisResult,
    MonitoringRecommendation,
    CorrectionRecord,
    MonitoringToolCall,
} from "./core/monitoring/index.js";

// Monitoring Templates (Base)
export {
    DATADOG_APM_TEMPLATE,
    SENTRY_INTEGRATION_TEMPLATE,
    HEALTH_CHECK_TEMPLATE,
    STRUCTURED_LOGGING_TEMPLATE,
    MONITORING_TEMPLATE_SETS,
    getMonitoringTemplates,
    getAvailableMonitoringTypes,
} from "./core/monitoring/index.js";

// Metrics Templates
export {
    METRICS_COLLECTION_TEMPLATE,
    DATADOG_METRICS_TEMPLATE,
    METRICS_TEMPLATE_SETS,
    getMetricsTemplates,
} from "./core/monitoring/index.js";

// Alerting & Audit Templates
export {
    ALERTING_TEMPLATE,
    AUDIT_LOGGING_TEMPLATE,
    ALERTING_TEMPLATE_SETS,
    getAlertingTemplates,
} from "./core/monitoring/index.js";

// Tracing Templates
export {
    DISTRIBUTED_TRACING_TEMPLATE,
    OPENTELEMETRY_TEMPLATE,
    TRACING_TEMPLATE_SETS,
    getTracingTemplates,
} from "./core/monitoring/index.js";

// ============================================
// CODEGEN AGENT (Tier 3 - Support)
// ============================================

// CodeGen Agent - Code Generation & Scaffolding
export {
    CodegenAgent,
    codegenAgent,
    CodegenConfig,
    CodegenType,
    CodegenFeature,
    CodegenGenerationResult,
    GeneratedCodeFile,
} from "./support/codegen/index.js";

// CodeGen Templates
export {
    TYPESCRIPT_PROJECT_TEMPLATE,
    EXPRESS_API_TEMPLATE,
    CONTROLLER_TEMPLATE,
    SERVICE_TEMPLATE,
    REPOSITORY_TEMPLATE,
    DTO_TEMPLATE,
    MIDDLEWARE_TEMPLATE,
    CONFIG_TEMPLATE,
    DOCKERFILE_TEMPLATE,
    getCodegenTemplates,
    getAvailableTemplateTypes,
} from "./support/codegen/templates/index.js";

// Architecture Agent - File System Structure Creation
export {
    ArchitectureAgent,
    architectureAgent,
    ProjectStructure,
    DirectoryNode,
    FileNode,
    ArchitectureResult,
} from "./support/codegen/architecture-agent.js";

// Code Writer Agent - File Writing Operations
export {
    CodeWriterAgent,
    codeWriterAgent,
    WriteOperation,
    WriteResult,
    WrittenFile,
} from "./support/codegen/codewriter-agent.js";

// Dependency Agent - npm Package Management
export {
    DependencyAgent,
    dependencyAgent,
    DependencyConfig,
    InstallResult,
    PackageInfo,
} from "./support/codegen/dependency-agent.js";

// CodeGen Orchestrator - Unified Code Generation Pipeline
export {
    AutoOrchestrator,
    autoOrchestrator,
    getOrchestrator,
    AutoProjectOptions,
    AutoProjectResult,
} from "./support/codegen/orchestrator.js";

// Multi-Language Configs
export {
    SupportedLanguage,
    SupportedFramework,
    LanguageConfig,
    FrameworkConfig,
    getLanguageConfig,
    getFrameworkConfig,
    getSupportedLanguages,
    getSupportedFrameworks,
} from "./support/codegen/language-configs.js";

// ============================================
// TEST AGENT (Tier 3 - Support) - Person 2's Implementation
// ============================================

// Test Agent - Automated Test Generation
export {
    TestAgent,
    testAgent,
    getTestAgent,
    TestAgentWrapper,
    testAgentIAgent,
    getTestAgentWrapper,
    TEST_AGENT_CAPABILITIES,
} from "./support/test/index.js";

// Test Agent Types
export type {
    TestFramework,
    TestType,
    CoverageFormat,
    TestConfig,
    CoverageThreshold,
    UnitTestRequest,
    UnitTestResult,
    IntegrationTestRequest,
    IntegrationTestResult,
    E2ETestRequest,
    E2ETestResult,
    APITestRequest,
    APITestResult,
    ComponentTestRequest,
    ComponentTestResult,
    TestGenerationResult,
    GeneratedTestFile,
    CodeAnalysis,
    FunctionInfo,
    TestAgentStatus,
} from "./support/test/index.js";

// Test Templates
export {
    VITEST_CONFIG_TEMPLATE,
    JEST_CONFIG_TEMPLATE,
    PLAYWRIGHT_CONFIG_TEMPLATE,
    UNIT_TEST_TEMPLATE,
    INTEGRATION_TEST_TEMPLATE,
    API_TEST_TEMPLATE,
    E2E_TEST_TEMPLATE,
    REACT_COMPONENT_TEST_TEMPLATE,
    MOCK_FILE_TEMPLATE,
    FIXTURE_FILE_TEMPLATE,
    PAGE_OBJECT_TEMPLATE,
    TEST_SETUP_TEMPLATE,
    ALL_TEMPLATES as TEST_TEMPLATES,
} from "./support/test/index.js";

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
        "database_agent",  // Person 2's Database Agent (IAgent ID: database-agent)
        "api_agent",
        "security_agent",
        "queue_agent",
        "cicd_agent",
        "monitoring_agent",
        "test_agent",
        "infra_agent",
        "codegen_agent",
        "architecture_agent",
        "codewriter_agent",
        "dependency_agent",
        "microservice_agent",
        "email_agent"
    ];
}

/**
 * Agent capabilities map
 */
export const AGENT_CAPABILITIES = {
    auth_agent: [
        // Core Auth
        "clerk-auth", "jwt-auth", "oauth", "rbac", "abac",
        "mfa", "session-management",
        // Password Security
        "argon2-hashing", "bcrypt-hashing", "password-validation",
        "password-history", "password-expiration",
        // Rate Limiting
        "redis-rate-limiting", "per-endpoint-limits", "user-based-limits",
        "ip-based-limits", "rate-limit-headers",
        // ABAC with Cerbos
        "cerbos-integration", "policy-based-access", "permissions-decorator"
    ],
    db_agent: [
        // Schema Operations
        "schema-generation", "schema-analysis", "schema-migration",
        // ORM Support
        "prisma", "prisma-schema", "prisma-models", "prisma-relations",
        "drizzle", "typeorm",
        // Database Types
        "postgresql", "mysql", "sqlite", "mongodb", "supabase",
        // Supabase Operations
        "supabase-migration", "supabase-rls", "supabase-policies",
        // Query Operations
        "query-builder", "query-optimization", "query-parameterization",
        // Data Operations
        "migrations", "seeding", "seed-generation", "seed-typescript", "seed-sql",
        // Performance
        "index-advisor", "connection-pool", "performance-optimization",
        // Services
        "database-service", "crud-operations", "pagination", "relationships"
    ],
    // Alias for db_agent (Person 2's IAgent implementation uses 'database-agent')
    database_agent: [
        "schema-generation", "schema-analysis", "schema-migration",
        "prisma", "prisma-schema", "prisma-models", "prisma-relations",
        "supabase", "supabase-migration", "supabase-rls", "supabase-policies",
        "query-builder", "query-optimization", "connection-pool",
        "migrations", "seeding", "database-service", "crud-operations"
    ],
    api_agent: [
        "rest-api", "graphql", "trpc", "openapi",
        "validation", "error-handling"
    ],
    security_agent: [
        // Core Security
        "sast", "dast", "secrets-detection", "dependency-scanning",
        "security-headers", "compliance", "helmet", "cors", "csrf",
        "input-sanitization", "sql-injection-prevention", "xss-prevention",
        // Bot Protection
        "captcha", "recaptcha", "hcaptcha", "turnstile",
        "honeypot", "fingerprinting", "behavioral-analysis",
        // WAF Rules
        "waf-engine", "owasp-rules", "custom-waf-rules",
        "sqli-detection", "xss-detection", "path-traversal-detection",
        "command-injection-detection",
        // Threat Detection
        "anomaly-detection", "intrusion-detection", "ids",
        "threat-intelligence", "ip-reputation",
        // API Key Management
        "api-key-generation", "key-rotation", "key-scoping",
        "key-analytics", "key-rate-limiting",
        // Security Testing
        "penetration-testing", "fuzzing", "vulnerability-scanning",
        "security-audit"
    ],
    queue_agent: [
        // BullMQ Operations
        "bullmq", "bullmq-queues", "bullmq-workers", "bullmq-processors",
        // Redis Operations
        "redis-queues", "redis-connection",
        // Job Management
        "job-scheduling", "job-priority", "job-types", "job-flows",
        // Background Processing
        "background-tasks", "async-processing", "worker-generation",
        // Retry & Error Handling
        "retry-logic", "retry-strategies", "dead-letter-queue", "error-handling",
        // Rate Limiting
        "rate-limiting", "queue-rate-limiting", "job-rate-limiting",
        // Scheduling
        "cron-jobs", "scheduled-jobs", "repeatable-jobs",
        // Monitoring
        "queue-monitoring", "queue-metrics", "queue-health"
    ],
    cicd_agent: [
        "github-actions", "gitlab-ci", "docker",
        "kubernetes", "deployment"
    ],
    monitoring_agent: [
        // APM
        "datadog-apm", "newrelic-apm", "elastic-apm",
        "request-tracing", "database-tracing", "external-api-tracing",
        // Error Tracking
        "sentry", "rollbar", "datadog-errors",
        "error-capturing", "context-enrichment", "user-identification",
        // Metrics
        "prometheus-metrics", "datadog-statsd", "custom-metrics",
        "http-metrics", "database-metrics", "cache-metrics", "queue-metrics",
        // Health Checks
        "health-endpoints", "readiness-probes", "liveness-probes",
        "database-health", "redis-health", "http-health", "memory-health",
        // Logging
        "winston-logging", "pino-logging", "structured-logs",
        "log-rotation", "sensitive-data-redaction", "request-logging",
        // Distributed Tracing
        "opentelemetry", "trace-context", "span-management",
        "cross-service-tracing", "trace-sampling",
        // Alerting
        "slack-alerts", "pagerduty-alerts", "email-alerts", "webhook-alerts",
        "alert-thresholds", "alert-rules", "alert-cooldown",
        // Audit Logging
        "audit-logging", "compliance-logging", "event-tracking",
        "data-change-logging", "permission-logging"
    ],
    test_agent: [
        // Testing Frameworks
        "vitest", "jest", "mocha", "playwright", "cypress",
        // Test Types
        "unit-tests", "integration-tests", "e2e-tests", "api-tests",
        "component-tests", "snapshot-testing",
        // Test Features
        "mock-generation", "fixture-generation", "test-fixtures",
        "coverage-analysis", "coverage-reports",
        // UI Testing
        "visual-regression", "accessibility-testing", "user-event-testing",
        "page-object-model",
        // Code Analysis
        "code-analysis", "test-discovery", "test-scaffolding"
    ],
    infra_agent: [
        "terraform", "docker", "kubernetes",
        "aws", "gcp", "azure"
    ],
    codegen_agent: [
        "code-generation", "boilerplate-creation", "refactoring",
        "code-optimization", "project-scaffolding", "module-generation",
        "template-generation", "controller", "service", "repository",
        "dto", "middleware", "docker"
    ],
    architecture_agent: [
        "project-structure", "directory-creation", "file-creation",
        "scaffold-project", "mkdir", "touch"
    ],
    codewriter_agent: [
        "file-writing", "code-writing", "file-update",
        "file-append", "backup-files", "overwrite-files"
    ],
    dependency_agent: [
        "npm-install", "package-management", "dependency-install",
        "npm-scripts", "package-update", "npm-init"
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
