/**
 * ============================================
 * SECURITY AGENT MODULE EXPORTS
 * ============================================
 */

// IAgent interface implementation (for agent loader)
export { SecurityAgentWrapper, securityAgentIAgent, default } from "./security-agent-iagent.js";

// Security Agent Core
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
} from "./security-agent.js";

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
} from "./templates/index.js";

// Bot Protection Templates
export {
    CAPTCHA_TEMPLATE,
    HONEYPOT_TEMPLATE,
    FINGERPRINTING_TEMPLATE,
    BEHAVIORAL_ANALYSIS_TEMPLATE,
    BOT_PROTECTION_TEMPLATE_SETS,
    getBotProtectionTemplates,
    getAvailableBotProtectionTypes,
} from "./templates/index.js";

// WAF Rules Templates
export {
    WAF_RULE_ENGINE_TEMPLATE,
    OWASP_RULES_TEMPLATE,
    CUSTOM_RULES_TEMPLATE,
    WAF_TEMPLATE_SETS,
    getWAFTemplates,
    getAvailableWAFTypes,
} from "./templates/index.js";

// Threat Detection Templates
export {
    ANOMALY_DETECTION_TEMPLATE,
    INTRUSION_DETECTION_TEMPLATE,
    THREAT_INTELLIGENCE_TEMPLATE,
    THREAT_DETECTION_TEMPLATE_SETS,
    getThreatDetectionTemplates,
    getAvailableThreatDetectionTypes,
} from "./templates/index.js";

// API Key Management Templates
export {
    API_KEY_MANAGER_TEMPLATE,
    KEY_ROTATION_TEMPLATE,
    SCOPE_MANAGEMENT_TEMPLATE,
    API_KEY_ANALYTICS_TEMPLATE,
    API_KEY_TEMPLATE_SETS,
    getAPIKeyTemplates,
    getAvailableAPIKeyTypes,
} from "./templates/index.js";

// Security Testing Templates
export {
    PENTEST_SCRIPTS_TEMPLATE,
    FUZZING_TEMPLATE,
    VULNERABILITY_SCANNER_TEMPLATE,
    SECURITY_TESTING_TEMPLATE_SETS,
    getSecurityTestingTemplates,
    getAvailableSecurityTestingTypes,
} from "./templates/index.js";

