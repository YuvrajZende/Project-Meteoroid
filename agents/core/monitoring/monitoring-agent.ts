/**
 * ============================================
 * MONITORING AGENT
 * ============================================
 * 
 * Specialized agent for generating observability,
 * monitoring, logging, and health check code.
 * 
 * Capabilities:
 * - Application Performance Monitoring (APM)
 * - Error Tracking (Sentry, Datadog)
 * - Health Check Endpoints
 * - Structured Logging
 * - Metrics Collection
 * - Alerting Configuration
 * - Audit Logging
 * - Distributed Tracing
 * 
 * @author LOVEABLE Backend Orchestrator
 * @version 1.0.0
 */

import { ChatOpenAI } from "@langchain/openai";
import {
    DATADOG_APM_TEMPLATE,
    SENTRY_INTEGRATION_TEMPLATE,
    HEALTH_CHECK_TEMPLATE,
    STRUCTURED_LOGGING_TEMPLATE,
    METRICS_COLLECTION_TEMPLATE,
    ALERTING_TEMPLATE,
    AUDIT_LOGGING_TEMPLATE,
    DISTRIBUTED_TRACING_TEMPLATE,
    getMonitoringTemplates,
    getAvailableMonitoringTypes,
} from "./templates/index.js";

// ============================================
// TYPES & INTERFACES
// ============================================

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
    /** APM provider (datadog, newrelic, elastic) */
    apmProvider?: "datadog" | "newrelic" | "elastic" | "none";
    /** Error tracking provider */
    errorTracking?: "sentry" | "datadog" | "rollbar" | "none";
    /** Logging provider */
    logging?: "winston" | "pino" | "bunyan";
    /** Enable distributed tracing */
    tracing?: boolean;
    /** Metrics collection settings */
    metrics?: MetricsConfig;
    /** Health check settings */
    healthChecks?: HealthCheckConfig;
    /** Alerting settings */
    alerting?: AlertingConfig;
    /** Audit logging settings */
    auditLogging?: AuditConfig;
}

export interface MetricsConfig {
    enabled: boolean;
    provider: "prometheus" | "datadog" | "statsd";
    prefix?: string;
    defaultLabels?: Record<string, string>;
    collectDefaultMetrics?: boolean;
}

export interface HealthCheckConfig {
    enabled: boolean;
    endpoints?: {
        health?: string;
        ready?: string;
        live?: string;
    };
    dependencies?: DependencyCheck[];
}

export interface DependencyCheck {
    name: string;
    type: "database" | "redis" | "http" | "custom";
    config: Record<string, unknown>;
    timeout?: number;
    critical?: boolean;
}

export interface AlertingConfig {
    enabled: boolean;
    channels: AlertChannel[];
    thresholds: AlertThreshold[];
}

export interface AlertChannel {
    type: "slack" | "email" | "pagerduty" | "webhook";
    config: Record<string, unknown>;
}

export interface AlertThreshold {
    metric: string;
    condition: "gt" | "lt" | "eq" | "gte" | "lte";
    value: number;
    severity: "info" | "warning" | "error" | "critical";
    duration?: number;
}

export interface AuditConfig {
    enabled: boolean;
    storage: "database" | "file" | "elasticsearch";
    events: string[];
    retention?: number;
}

/**
 * Generated monitoring file
 */
export interface GeneratedMonitoringFile {
    path: string;
    content: string;
    description: string;
    dependencies?: string[];
    envVariables?: string[];
}

/**
 * Monitoring generation result
 */
export interface MonitoringGenerationResult {
    success: boolean;
    files: GeneratedMonitoringFile[];
    summary: {
        apmProvider: string;
        errorTracking: string;
        loggingProvider: string;
        healthChecks: boolean;
        metrics: boolean;
        tracing: boolean;
        alerting: boolean;
        auditLogging: boolean;
    };
    dependencies: string[];
    envVariables: string[];
    setupInstructions: string[];
}

/**
 * Monitoring scan result
 */
export interface MonitoringScanResult {
    hasLogging: boolean;
    hasErrorTracking: boolean;
    hasMetrics: boolean;
    hasHealthChecks: boolean;
    hasTracing: boolean;
    issues: MonitoringIssue[];
    recommendations: string[];
    score: number;
}

export interface MonitoringIssue {
    type: "missing" | "misconfigured" | "deprecated" | "security";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    file?: string;
    line?: number;
    recommendation: string;
}

// ============================================
// MONITORING AGENT CLASS
// ============================================

export class MonitoringAgent {
    private model: ChatOpenAI;

    constructor() {
        this.model = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
            temperature: 0.3,
        });
    }

    // ============================================
    // MAIN GENERATION METHODS
    // ============================================

    /**
     * Generate complete monitoring system
     */
    async generateMonitoringSystem(
        config: MonitoringConfig
    ): Promise<MonitoringGenerationResult> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];
        const envVariables: string[] = [];
        const setupInstructions: string[] = [];

        console.log("🔍 MonitoringAgent: Generating monitoring system...");

        // 1. Generate APM setup
        if (config.apmProvider && config.apmProvider !== "none") {
            const apmResult = await this.generateAPM(config.apmProvider);
            files.push(...apmResult.files);
            dependencies.push(...apmResult.dependencies);
            envVariables.push(...apmResult.envVariables);
            setupInstructions.push(...apmResult.setupInstructions);
        }

        // 2. Generate error tracking
        if (config.errorTracking && config.errorTracking !== "none") {
            const errorResult = await this.generateErrorTracking(config.errorTracking);
            files.push(...errorResult.files);
            dependencies.push(...errorResult.dependencies);
            envVariables.push(...errorResult.envVariables);
            setupInstructions.push(...errorResult.setupInstructions);
        }

        // 3. Generate logging
        if (config.logging) {
            const loggingResult = await this.generateLogging(config.logging);
            files.push(...loggingResult.files);
            dependencies.push(...loggingResult.dependencies);
            envVariables.push(...loggingResult.envVariables);
        }

        // 4. Generate health checks
        if (config.healthChecks?.enabled) {
            const healthResult = await this.generateHealthChecks(config.healthChecks);
            files.push(...healthResult.files);
            dependencies.push(...healthResult.dependencies);
        }

        // 5. Generate metrics collection
        if (config.metrics?.enabled) {
            const metricsResult = await this.generateMetrics(config.metrics);
            files.push(...metricsResult.files);
            dependencies.push(...metricsResult.dependencies);
            envVariables.push(...metricsResult.envVariables);
        }

        // 6. Generate distributed tracing
        if (config.tracing) {
            // Default to datadog if apmProvider is none or undefined
            const tracingProvider = (config.apmProvider && config.apmProvider !== "none")
                ? config.apmProvider
                : "datadog";
            const tracingResult = await this.generateTracing(tracingProvider as "datadog" | "newrelic" | "elastic" | "jaeger");
            files.push(...tracingResult.files);
            dependencies.push(...tracingResult.dependencies);
            envVariables.push(...tracingResult.envVariables);
        }

        // 7. Generate alerting
        if (config.alerting?.enabled) {
            const alertingResult = await this.generateAlerting(config.alerting);
            files.push(...alertingResult.files);
            dependencies.push(...alertingResult.dependencies);
            envVariables.push(...alertingResult.envVariables);
        }

        // 8. Generate audit logging
        if (config.auditLogging?.enabled) {
            const auditResult = await this.generateAuditLogging(config.auditLogging);
            files.push(...auditResult.files);
            dependencies.push(...auditResult.dependencies);
        }

        // 9. Generate index file
        files.push(this.generateMonitoringIndex(config));

        // Deduplicate dependencies and env variables
        const uniqueDeps = [...new Set(dependencies)];
        const uniqueEnv = [...new Set(envVariables)];

        return {
            success: true,
            files,
            summary: {
                apmProvider: config.apmProvider || "none",
                errorTracking: config.errorTracking || "none",
                loggingProvider: config.logging || "winston",
                healthChecks: config.healthChecks?.enabled || false,
                metrics: config.metrics?.enabled || false,
                tracing: config.tracing || false,
                alerting: config.alerting?.enabled || false,
                auditLogging: config.auditLogging?.enabled || false,
            },
            dependencies: uniqueDeps,
            envVariables: uniqueEnv,
            setupInstructions,
        };
    }

    // ============================================
    // APM GENERATION
    // ============================================

    /**
     * Generate APM setup
     */
    async generateAPM(
        provider: "datadog" | "newrelic" | "elastic"
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[]; envVariables: string[]; setupInstructions: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];
        const envVariables: string[] = [];
        const setupInstructions: string[] = [];

        switch (provider) {
            case "datadog":
                files.push({
                    path: "src/monitoring/apm/datadog.ts",
                    content: DATADOG_APM_TEMPLATE,
                    description: "Datadog APM integration with tracing and profiling",
                    dependencies: ["dd-trace"],
                    envVariables: ["DD_API_KEY", "DD_APP_KEY", "DD_ENV", "DD_SERVICE", "DD_VERSION"],
                });
                dependencies.push("dd-trace");
                envVariables.push("DD_API_KEY", "DD_APP_KEY", "DD_ENV", "DD_SERVICE", "DD_VERSION");
                setupInstructions.push(
                    "1. Get API key from Datadog dashboard",
                    "2. Import dd-trace FIRST before other imports in entry point",
                    "3. Set DD_ENV to your environment (production/staging/development)"
                );
                break;

            case "newrelic":
                files.push({
                    path: "src/monitoring/apm/newrelic.ts",
                    content: this.generateNewRelicTemplate(),
                    description: "New Relic APM integration",
                    dependencies: ["newrelic"],
                    envVariables: ["NEW_RELIC_LICENSE_KEY", "NEW_RELIC_APP_NAME"],
                });
                dependencies.push("newrelic");
                envVariables.push("NEW_RELIC_LICENSE_KEY", "NEW_RELIC_APP_NAME");
                break;

            case "elastic":
                files.push({
                    path: "src/monitoring/apm/elastic.ts",
                    content: this.generateElasticAPMTemplate(),
                    description: "Elastic APM integration",
                    dependencies: ["elastic-apm-node"],
                    envVariables: ["ELASTIC_APM_SERVER_URL", "ELASTIC_APM_SERVICE_NAME", "ELASTIC_APM_SECRET_TOKEN"],
                });
                dependencies.push("elastic-apm-node");
                envVariables.push("ELASTIC_APM_SERVER_URL", "ELASTIC_APM_SERVICE_NAME", "ELASTIC_APM_SECRET_TOKEN");
                break;
        }

        return { files, dependencies, envVariables, setupInstructions };
    }

    // ============================================
    // ERROR TRACKING GENERATION
    // ============================================

    /**
     * Generate error tracking setup
     */
    async generateErrorTracking(
        provider: "sentry" | "datadog" | "rollbar"
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[]; envVariables: string[]; setupInstructions: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];
        const envVariables: string[] = [];
        const setupInstructions: string[] = [];

        switch (provider) {
            case "sentry":
                files.push({
                    path: "src/monitoring/errors/sentry.ts",
                    content: SENTRY_INTEGRATION_TEMPLATE,
                    description: "Sentry error tracking with Express integration",
                    dependencies: ["@sentry/node", "@sentry/tracing"],
                    envVariables: ["SENTRY_DSN", "SENTRY_ENVIRONMENT", "SENTRY_RELEASE"],
                });
                dependencies.push("@sentry/node", "@sentry/tracing");
                envVariables.push("SENTRY_DSN", "SENTRY_ENVIRONMENT", "SENTRY_RELEASE");
                setupInstructions.push(
                    "1. Create Sentry project at sentry.io",
                    "2. Copy DSN from project settings",
                    "3. Initialize Sentry BEFORE other middleware"
                );
                break;

            case "datadog":
                // Datadog handles errors via dd-trace
                files.push({
                    path: "src/monitoring/errors/datadog-errors.ts",
                    content: this.generateDatadogErrorsTemplate(),
                    description: "Datadog error tracking middleware",
                });
                break;

            case "rollbar":
                files.push({
                    path: "src/monitoring/errors/rollbar.ts",
                    content: this.generateRollbarTemplate(),
                    description: "Rollbar error tracking",
                    dependencies: ["rollbar"],
                    envVariables: ["ROLLBAR_ACCESS_TOKEN"],
                });
                dependencies.push("rollbar");
                envVariables.push("ROLLBAR_ACCESS_TOKEN");
                break;
        }

        return { files, dependencies, envVariables, setupInstructions };
    }

    // ============================================
    // LOGGING GENERATION
    // ============================================

    /**
     * Generate logging setup
     */
    async generateLogging(
        provider: "winston" | "pino" | "bunyan"
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[]; envVariables: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];
        const envVariables: string[] = [];

        files.push({
            path: "src/monitoring/logging/logger.ts",
            content: STRUCTURED_LOGGING_TEMPLATE,
            description: `Structured logging with ${provider}`,
            dependencies: provider === "winston"
                ? ["winston", "winston-daily-rotate-file"]
                : provider === "pino"
                    ? ["pino", "pino-pretty"]
                    : ["bunyan"],
            envVariables: ["LOG_LEVEL", "LOG_FORMAT"],
        });

        if (provider === "winston") {
            dependencies.push("winston", "winston-daily-rotate-file");
        } else if (provider === "pino") {
            dependencies.push("pino", "pino-pretty");
        } else {
            dependencies.push("bunyan");
        }

        envVariables.push("LOG_LEVEL", "LOG_FORMAT");

        // Add request logging middleware
        files.push({
            path: "src/monitoring/logging/request-logger.ts",
            content: this.generateRequestLoggerTemplate(provider),
            description: "HTTP request logging middleware",
        });

        return { files, dependencies, envVariables };
    }

    // ============================================
    // HEALTH CHECKS GENERATION
    // ============================================

    /**
     * Generate health check endpoints
     */
    async generateHealthChecks(
        config: HealthCheckConfig
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];

        files.push({
            path: "src/monitoring/health/health-checks.ts",
            content: HEALTH_CHECK_TEMPLATE,
            description: "Health check endpoints (/health, /ready, /live)",
            dependencies: ["express"],
        });

        // Generate dependency checkers if specified
        if (config.dependencies && config.dependencies.length > 0) {
            files.push({
                path: "src/monitoring/health/dependency-checks.ts",
                content: this.generateDependencyChecksTemplate(config.dependencies),
                description: "Dependency health checkers",
            });
        }

        return { files, dependencies };
    }

    // ============================================
    // METRICS GENERATION
    // ============================================

    /**
     * Generate metrics collection
     */
    async generateMetrics(
        config: MetricsConfig
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[]; envVariables: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];
        const envVariables: string[] = [];

        files.push({
            path: "src/monitoring/metrics/metrics.ts",
            content: METRICS_COLLECTION_TEMPLATE,
            description: `Metrics collection with ${config.provider}`,
            dependencies: config.provider === "prometheus"
                ? ["prom-client"]
                : config.provider === "datadog"
                    ? ["hot-shots"]
                    : ["statsd-client"],
        });

        if (config.provider === "prometheus") {
            dependencies.push("prom-client");
        } else if (config.provider === "datadog") {
            dependencies.push("hot-shots");
            envVariables.push("DD_AGENT_HOST", "DD_DOGSTATSD_PORT");
        } else {
            dependencies.push("statsd-client");
            envVariables.push("STATSD_HOST", "STATSD_PORT");
        }

        // Add metrics middleware
        files.push({
            path: "src/monitoring/metrics/metrics-middleware.ts",
            content: this.generateMetricsMiddlewareTemplate(config.provider),
            description: "HTTP metrics collection middleware",
        });

        return { files, dependencies, envVariables };
    }

    // ============================================
    // TRACING GENERATION
    // ============================================

    /**
     * Generate distributed tracing
     */
    async generateTracing(
        provider: "datadog" | "newrelic" | "elastic" | "jaeger"
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[]; envVariables: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];
        const envVariables: string[] = [];

        files.push({
            path: "src/monitoring/tracing/tracing.ts",
            content: DISTRIBUTED_TRACING_TEMPLATE,
            description: "Distributed tracing setup",
        });

        // Add OpenTelemetry for cross-platform tracing
        files.push({
            path: "src/monitoring/tracing/opentelemetry.ts",
            content: this.generateOpenTelemetryTemplate(),
            description: "OpenTelemetry instrumentation",
            dependencies: [
                "@opentelemetry/api",
                "@opentelemetry/sdk-node",
                "@opentelemetry/auto-instrumentations-node",
            ],
        });

        dependencies.push(
            "@opentelemetry/api",
            "@opentelemetry/sdk-node",
            "@opentelemetry/auto-instrumentations-node"
        );
        envVariables.push("OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_SERVICE_NAME");

        return { files, dependencies, envVariables };
    }

    // ============================================
    // ALERTING GENERATION
    // ============================================

    /**
     * Generate alerting configuration
     */
    async generateAlerting(
        config: AlertingConfig
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[]; envVariables: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];
        const envVariables: string[] = [];

        files.push({
            path: "src/monitoring/alerting/alerting.ts",
            content: ALERTING_TEMPLATE,
            description: "Alert manager with multiple channels",
        });

        // Add channel-specific integrations
        for (const channel of config.channels) {
            switch (channel.type) {
                case "slack":
                    dependencies.push("@slack/web-api");
                    envVariables.push("SLACK_WEBHOOK_URL", "SLACK_BOT_TOKEN");
                    break;
                case "pagerduty":
                    dependencies.push("@pagerduty/pdjs");
                    envVariables.push("PAGERDUTY_API_KEY", "PAGERDUTY_SERVICE_ID");
                    break;
                case "email":
                    dependencies.push("nodemailer");
                    envVariables.push("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "ALERT_EMAIL_TO");
                    break;
            }
        }

        return { files, dependencies, envVariables };
    }

    // ============================================
    // AUDIT LOGGING GENERATION
    // ============================================

    /**
     * Generate audit logging
     */
    async generateAuditLogging(
        config: AuditConfig
    ): Promise<{ files: GeneratedMonitoringFile[]; dependencies: string[] }> {
        const files: GeneratedMonitoringFile[] = [];
        const dependencies: string[] = [];

        files.push({
            path: "src/monitoring/audit/audit-logger.ts",
            content: AUDIT_LOGGING_TEMPLATE,
            description: "Audit logging for compliance",
        });

        // Add middleware for automatic auditing
        files.push({
            path: "src/monitoring/audit/audit-middleware.ts",
            content: this.generateAuditMiddlewareTemplate(config.events),
            description: "Automatic audit logging middleware",
        });

        return { files, dependencies };
    }

    // ============================================
    // INDEX GENERATION
    // ============================================

    /**
     * Generate monitoring module index
     */
    private generateMonitoringIndex(config: MonitoringConfig): GeneratedMonitoringFile {
        const exports: string[] = [];

        if (config.apmProvider && config.apmProvider !== "none") {
            exports.push(`export * from "./apm/${config.apmProvider}";`);
        }
        if (config.errorTracking && config.errorTracking !== "none") {
            exports.push(`export * from "./errors/${config.errorTracking}";`);
        }
        if (config.logging) {
            exports.push(`export * from "./logging/logger";`);
            exports.push(`export * from "./logging/request-logger";`);
        }
        if (config.healthChecks?.enabled) {
            exports.push(`export * from "./health/health-checks";`);
        }
        if (config.metrics?.enabled) {
            exports.push(`export * from "./metrics/metrics";`);
            exports.push(`export * from "./metrics/metrics-middleware";`);
        }
        if (config.tracing) {
            exports.push(`export * from "./tracing/tracing";`);
            exports.push(`export * from "./tracing/opentelemetry";`);
        }
        if (config.alerting?.enabled) {
            exports.push(`export * from "./alerting/alerting";`);
        }
        if (config.auditLogging?.enabled) {
            exports.push(`export * from "./audit/audit-logger";`);
            exports.push(`export * from "./audit/audit-middleware";`);
        }

        return {
            path: "src/monitoring/index.ts",
            content: `/**
 * ============================================
 * MONITORING MODULE
 * ============================================
 * 
 * Centralized monitoring, logging, and observability.
 * Generated by LOVEABLE Monitoring Agent.
 */

${exports.join("\n")}
`,
            description: "Monitoring module exports",
        };
    }

    // ============================================
    // ANALYSIS METHODS
    // ============================================

    /**
     * Analyze existing monitoring setup
     */
    async analyzeMonitoring(projectPath: string): Promise<MonitoringScanResult> {
        const issues: MonitoringIssue[] = [];
        const recommendations: string[] = [];
        let score = 100;

        // Placeholder for actual analysis
        // In production, this would scan files for monitoring patterns

        const result: MonitoringScanResult = {
            hasLogging: false,
            hasErrorTracking: false,
            hasMetrics: false,
            hasHealthChecks: false,
            hasTracing: false,
            issues,
            recommendations,
            score,
        };

        // Generate recommendations based on missing features
        if (!result.hasLogging) {
            recommendations.push("Add structured logging (Winston or Pino recommended)");
            score -= 20;
        }
        if (!result.hasErrorTracking) {
            recommendations.push("Add error tracking (Sentry recommended)");
            score -= 25;
        }
        if (!result.hasHealthChecks) {
            recommendations.push("Add health check endpoints for Kubernetes/load balancer probes");
            score -= 15;
        }
        if (!result.hasMetrics) {
            recommendations.push("Add metrics collection for performance monitoring");
            score -= 20;
        }
        if (!result.hasTracing) {
            recommendations.push("Add distributed tracing for debugging microservices");
            score -= 10;
        }

        result.score = Math.max(0, score);
        return result;
    }

    // ============================================
    // HELPER TEMPLATE METHODS
    // ============================================

    private generateNewRelicTemplate(): string {
        return `/**
 * New Relic APM Integration
 */

// IMPORTANT: This must be required FIRST before any other modules
require('newrelic');

export const newRelicConfig = {
    app_name: [process.env.NEW_RELIC_APP_NAME || 'MyApp'],
    license_key: process.env.NEW_RELIC_LICENSE_KEY,
    logging: {
        level: 'info',
        filepath: 'stdout',
    },
    allow_all_headers: true,
    attributes: {
        exclude: [
            'request.headers.cookie',
            'request.headers.authorization',
            'request.headers.proxyAuthorization',
            'request.headers.setCookie*',
            'request.headers.x*',
            'response.headers.cookie',
            'response.headers.authorization',
            'response.headers.proxyAuthorization',
            'response.headers.setCookie*',
            'response.headers.x*',
        ],
    },
};
`;
    }

    private generateElasticAPMTemplate(): string {
        return `/**
 * Elastic APM Integration
 */

import apm from 'elastic-apm-node';

export const elasticAPM = apm.start({
    serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'my-service',
    serverUrl: process.env.ELASTIC_APM_SERVER_URL || 'http://localhost:8200',
    secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
    environment: process.env.NODE_ENV || 'development',
    captureBody: 'errors',
    captureHeaders: true,
    errorOnAbortedRequests: true,
    captureErrorLogStackTraces: 'always',
});

export function startTransaction(name: string, type: string = 'request') {
    return apm.startTransaction(name, type);
}

export function startSpan(name: string, type?: string) {
    return apm.startSpan(name, type);
}

export function captureError(error: Error) {
    apm.captureError(error);
}

export function setUserContext(user: { id: string; email?: string; username?: string }) {
    apm.setUserContext(user);
}
`;
    }

    private generateDatadogErrorsTemplate(): string {
        return `/**
 * Datadog Error Tracking Middleware
 */

import tracer from 'dd-trace';
import { Request, Response, NextFunction } from 'express';

/**
 * Error tracking middleware for Datadog
 */
export function datadogErrorMiddleware() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
        const span = tracer.scope().active();
        
        if (span) {
            span.setTag('error', true);
            span.setTag('error.msg', err.message);
            span.setTag('error.stack', err.stack);
            span.setTag('error.type', err.name);
        }

        // Log to Datadog
        console.error(JSON.stringify({
            level: 'error',
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            userId: (req as any).user?.id,
        }));

        next(err);
    };
}
`;
    }

    private generateRollbarTemplate(): string {
        return `/**
 * Rollbar Error Tracking
 */

import Rollbar from 'rollbar';
import { Request, Response, NextFunction } from 'express';

export const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
    environment: process.env.NODE_ENV || 'development',
    captureUncaught: true,
    captureUnhandledRejections: true,
});

export function rollbarErrorHandler() {
    return rollbar.errorHandler();
}

export function rollbarRequestHandler() {
    return (req: Request, res: Response, next: NextFunction) => {
        rollbar.configure({
            payload: {
                person: {
                    id: (req as any).user?.id,
                    email: (req as any).user?.email,
                },
            },
        });
        next();
    };
}
`;
    }

    private generateRequestLoggerTemplate(provider: string): string {
        return `/**
 * HTTP Request Logging Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export interface RequestLogContext {
    requestId: string;
    method: string;
    path: string;
    statusCode?: number;
    duration?: number;
    userAgent?: string;
    ip?: string;
    userId?: string;
}

/**
 * Request logging middleware
 */
export function requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
        const requestId = req.headers['x-request-id'] as string || uuidv4();
        const startTime = Date.now();

        // Attach request ID to request and response
        (req as any).requestId = requestId;
        res.setHeader('X-Request-ID', requestId);

        // Log request
        logger.info('Incoming request', {
            requestId,
            method: req.method,
            path: req.path,
            query: req.query,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        });

        // Log response when finished
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

            logger[logLevel]('Request completed', {
                requestId,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                contentLength: res.get('Content-Length'),
            });
        });

        next();
    };
}

/**
 * Skip logging for certain paths
 */
export function skipLogging(paths: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (paths.includes(req.path)) {
            return next();
        }
        return requestLogger()(req, res, next);
    };
}
`;
    }

    private generateDependencyChecksTemplate(dependencies: DependencyCheck[]): string {
        const checks = dependencies.map(dep => {
            switch (dep.type) {
                case "database":
                    return `
    async check${dep.name.replace(/[^a-zA-Z]/g, "")}(): Promise<HealthCheckResult> {
        try {
            // Add your database ping logic here
            // await prisma.$queryRaw\`SELECT 1\`;
            return { name: "${dep.name}", status: "healthy", responseTime: 0 };
        } catch (error) {
            return { name: "${dep.name}", status: "unhealthy", error: error.message };
        }
    }`;
                case "redis":
                    return `
    async check${dep.name.replace(/[^a-zA-Z]/g, "")}(): Promise<HealthCheckResult> {
        try {
            // await redis.ping();
            return { name: "${dep.name}", status: "healthy", responseTime: 0 };
        } catch (error) {
            return { name: "${dep.name}", status: "unhealthy", error: error.message };
        }
    }`;
                case "http":
                    return `
    async check${dep.name.replace(/[^a-zA-Z]/g, "")}(): Promise<HealthCheckResult> {
        try {
            const start = Date.now();
            const response = await fetch("${(dep.config as any).url || "http://localhost"}");
            return { 
                name: "${dep.name}", 
                status: response.ok ? "healthy" : "degraded", 
                responseTime: Date.now() - start 
            };
        } catch (error) {
            return { name: "${dep.name}", status: "unhealthy", error: error.message };
        }
    }`;
                default:
                    return "";
            }
        }).filter(Boolean);

        return `/**
 * Dependency Health Checks
 */

export interface HealthCheckResult {
    name: string;
    status: "healthy" | "degraded" | "unhealthy";
    responseTime?: number;
    error?: string;
}

export class DependencyChecker {
    ${checks.join("\n")}

    async checkAll(): Promise<HealthCheckResult[]> {
        return Promise.all([
            ${dependencies.map(d => `this.check${d.name.replace(/[^a-zA-Z]/g, "")}()`).join(",\n            ")}
        ]);
    }
}

export const dependencyChecker = new DependencyChecker();
`;
    }

    private generateMetricsMiddlewareTemplate(provider: string): string {
        return `/**
 * HTTP Metrics Collection Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { metrics } from './metrics';

/**
 * Collect HTTP metrics
 */
export function metricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const labels = {
                method: req.method,
                path: normalizePath(req.route?.path || req.path),
                statusCode: String(res.statusCode),
            };

            // Record request count
            metrics.incrementCounter('http_requests_total', labels);

            // Record request duration
            metrics.recordHistogram('http_request_duration_ms', duration, labels);

            // Record response size
            const contentLength = parseInt(res.get('Content-Length') || '0');
            if (contentLength > 0) {
                metrics.recordHistogram('http_response_size_bytes', contentLength, labels);
            }
        });

        next();
    };
}

/**
 * Normalize path to prevent high cardinality
 */
function normalizePath(path: string): string {
    return path
        .replace(/\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
        .replace(/\\/\\d+/g, '/:id');
}
`;
    }

    private generateOpenTelemetryTemplate(): string {
        return `/**
 * OpenTelemetry Instrumentation
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'my-service',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

export function startTracing(): void {
    sdk.start();
    console.log('🔍 OpenTelemetry tracing started');

    process.on('SIGTERM', () => {
        sdk.shutdown()
            .then(() => console.log('OpenTelemetry shut down'))
            .catch((err) => console.error('Error shutting down OpenTelemetry', err))
            .finally(() => process.exit(0));
    });
}

export { sdk as openTelemetry };
`;
    }

    private generateAuditMiddlewareTemplate(events: string[]): string {
        return `/**
 * Automatic Audit Logging Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { auditLogger } from './audit-logger';

const AUDITED_EVENTS = ${JSON.stringify(events, null, 4)};

/**
 * Audit logging middleware
 */
export function auditMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
        const originalSend = res.send;
        const startTime = Date.now();

        // Determine event type
        const eventType = getEventType(req);
        
        if (!AUDITED_EVENTS.includes(eventType)) {
            return next();
        }

        res.send = function(body: any) {
            res.send = originalSend;
            
            // Log audit event
            auditLogger.log({
                eventType,
                userId: (req as any).user?.id || 'anonymous',
                action: req.method,
                resource: req.path,
                resourceId: req.params.id,
                changes: req.method !== 'GET' ? req.body : undefined,
                result: res.statusCode < 400 ? 'success' : 'failure',
                duration: Date.now() - startTime,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            });

            return originalSend.call(this, body);
        };

        next();
    };
}

function getEventType(req: Request): string {
    const resource = req.path.split('/')[2]; // /api/users -> users
    const method = req.method.toLowerCase();
    
    const methodMap: Record<string, string> = {
        get: 'read',
        post: 'create',
        put: 'update',
        patch: 'update',
        delete: 'delete',
    };

    return \`\${resource}.\${methodMap[method] || method}\`;
}
`;
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const monitoringAgent = new MonitoringAgent();
