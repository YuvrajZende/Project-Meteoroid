/**
 * Middleware exports
 */

export {
    detectBot,
    sanitizeInput,
    sanitizeObject,
    registerSecurityMiddleware,
    getRateLimit,
    SecurityMetrics,
    securityMetrics,
    SECURITY_HEADERS,
    ENDPOINT_RATE_LIMITS,
    type BotDetectionResult,
    type TierRateLimits,
    type EndpointRateLimits,
    type SecurityReport,
} from './security.js';

export {
    AuditLogger,
    getAuditLogger,
    createAuditLogger,
    type AuditEventType,
    type AuditEntry,
    type AuditLoggerConfig,
} from './audit-logger.js';

// Phase 14: Constraint Injection
export {
    injectConstraints,
    getAgentPromptAddition,
    createCodeGenPrompt,
    validateGeneratedCode,
    getConstraintConfig,
    BASE_SYSTEM_PROMPT,
    AGENT_SPECIFIC_PROMPTS,
    DO_NOT_SUGGEST_BLOCK,
    type PromptContext,
    type EnhancedPrompt,
} from './constraint-injection.js';
