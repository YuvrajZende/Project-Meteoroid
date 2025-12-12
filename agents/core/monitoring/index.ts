/**
 * ============================================
 * MONITORING AGENT MODULE EXPORTS
 * ============================================
 */

// IAgent interface implementation (for agent loader)
export { MonitoringAgentWrapper, monitoringAgentIAgent, default } from "./monitoring-agent-iagent.js";

// Monitoring Agent Core
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
} from "./monitoring-agent.js";

// Monitoring Agent Enhanced (with Brain Integration)
export {
    MonitoringAgentEnhanced,
    monitoringAgentEnhanced,
    MonitoringAnalysisResult,
    MonitoringRecommendation,
    CorrectionRecord,
    MonitoringToolCall,
} from "./monitoring-agent-enhanced.js";

// Base Monitoring Templates
export {
    DATADOG_APM_TEMPLATE,
    SENTRY_INTEGRATION_TEMPLATE,
    HEALTH_CHECK_TEMPLATE,
    STRUCTURED_LOGGING_TEMPLATE,
    MONITORING_TEMPLATE_SETS,
    getMonitoringTemplates,
    getAvailableMonitoringTypes,
} from "./templates/index.js";

// Metrics Templates
export {
    METRICS_COLLECTION_TEMPLATE,
    DATADOG_METRICS_TEMPLATE,
    METRICS_TEMPLATE_SETS,
    getMetricsTemplates,
} from "./templates/index.js";

// Alerting & Audit Templates
export {
    ALERTING_TEMPLATE,
    AUDIT_LOGGING_TEMPLATE,
    ALERTING_TEMPLATE_SETS,
    getAlertingTemplates,
} from "./templates/index.js";

// Tracing Templates
export {
    DISTRIBUTED_TRACING_TEMPLATE,
    OPENTELEMETRY_TEMPLATE,
    TRACING_TEMPLATE_SETS,
    getTracingTemplates,
} from "./templates/index.js";
