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

// Frontend Analyzer Agent - Analysis Layer
export {
    FrontendAnalyzerAgent,
    frontendAnalyzerAgent,
    FrameworkDetector,
    APICallExtractor,
    AuthDetector,
    DataModelInferrer,
    RouteAnalyzer,
    FRONTEND_ANALYZER_CAPABILITIES,
} from "./core/analysis/index.js";

// Frontend Analyzer Types
export type {
    FrameworkType,
    FrameworkInfo,
    HttpMethod,
    ApiLibraryType,
    ExtractedAPICall,
    InferredFieldType,
    InferredField,
    InferredType,
    InferredModel,
    AuthProviderType,
    DetectedAuthStrategy,
    RouteInfo,
    DependencyInfo,
    FrontendAnalysisResult,
    FrontendAnalyzerConfig,
} from "./core/analysis/index.js";

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
// AGENT REGISTRY
// ============================================

/**
 * Get all available agents
 */
export function getAvailableAgents(): string[] {
    return [
        "frontend_analyzer_agent",  // Analysis Layer - Entry Point
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
    // Analysis Layer (Entry Point)
    frontend_analyzer_agent: [
        // Framework Detection
        "framework-detection", "react-detection", "vue-detection",
        "next-detection", "nuxt-detection", "svelte-detection", "angular-detection",
        // API Extraction
        "api-extraction", "endpoint-detection", "fetch-analysis",
        "axios-analysis", "swr-analysis", "react-query-analysis",
        // Data Modeling
        "model-inference", "typescript-analysis", "zod-schema-analysis", "form-state-analysis",
        // Auth Detection
        "auth-detection", "clerk-detection", "auth0-detection",
        "firebase-detection", "supabase-detection", "nextauth-detection",
        // Routing
        "route-analysis", "protected-route-detection",
        // Dependencies
        "dependency-analysis", "package-analysis"
    ],
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
        "bullmq", "redis-queues", "job-scheduling",
        "background-tasks", "rate-limiting"
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
        "vitest", "jest", "playwright",
        "unit-tests", "integration-tests", "e2e-tests"
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
