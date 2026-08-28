/**
 * ============================================
 * AUTH AGENT MODULE EXPORTS
 * ============================================
 */

// IAgent interface implementation (for agent loader)
export { AuthAgentWrapper, authAgentIAgent, default } from "./auth-agent-iagent.js";

// Auth Agent (Basic)
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
} from "./auth-agent.js";

// Auth Agent Enhanced (Advanced Agentic)
export {
    AuthAgentEnhanced,
    authAgentEnhanced,
    ValidationReport,
    SecurityIssue,
    CodeIssue,
    ClarificationRequest,
    CorrectionRecord,
    PipelineStage,
    PipelineState,
    ProjectContext,
    CodeStyle,
    DatabaseSchema
} from "./auth-agent-enhanced.js";

// Templates (Base)
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
} from "./templates/index.js";

// Password Security Templates
export {
    ARGON2_PASSWORD_TEMPLATE,
    BCRYPT_PASSWORD_TEMPLATE,
    PASSWORD_VALIDATION_TEMPLATE,
    PASSWORD_HISTORY_TEMPLATE,
    PASSWORD_EXPIRATION_TEMPLATE,
    PASSWORD_TEMPLATE_SETS,
    getPasswordTemplates,
    getAvailablePasswordTypes,
} from "./templates/index.js";

// ABAC with Cerbos Templates
export {
    CERBOS_CLIENT_TEMPLATE,
    CERBOS_POLICY_TEMPLATE,
    CERBOS_GUARD_TEMPLATE,
    PERMISSIONS_DECORATOR_TEMPLATE,
    POLICY_VALIDATION_TEMPLATE,
    CERBOS_TEMPLATE_SETS,
    getCerbosTemplates,
    getAvailableCerbosTypes,
} from "./templates/index.js";

// Rate Limiting Templates
export {
    REDIS_RATE_LIMITER_TEMPLATE,
    ENDPOINT_RATE_LIMITER_TEMPLATE,
    USER_RATE_LIMITER_TEMPLATE,
    IP_RATE_LIMITER_TEMPLATE,
    RATE_LIMIT_HEADERS_TEMPLATE,
    RATE_LIMIT_TEMPLATE_SETS,
    getRateLimitTemplates,
    getAvailableRateLimitTypes,
} from "./templates/index.js";

