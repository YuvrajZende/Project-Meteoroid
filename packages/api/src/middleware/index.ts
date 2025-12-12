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
