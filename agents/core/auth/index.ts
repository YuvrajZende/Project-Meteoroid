/**
 * ============================================
 * AUTH AGENT MODULE EXPORTS
 * ============================================
 */

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
} from "./auth-agent";

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
} from "./auth-agent-enhanced";

// Templates
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
} from "./templates";
