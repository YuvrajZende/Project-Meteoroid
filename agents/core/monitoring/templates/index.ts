/**
 * ============================================
 * MONITORING TEMPLATES - BASE
 * ============================================
 * 
 * Pre-built, production-ready monitoring templates.
 */

// ============================================
// DATADOG APM TEMPLATE
// ============================================

export const DATADOG_APM_TEMPLATE = `/**
 * ============================================
 * DATADOG APM INTEGRATION
 * ============================================
 * 
 * IMPORTANT: This file MUST be imported FIRST
 * before any other modules in your entry point.
 * 
 * Usage in index.ts:
 *   import './monitoring/apm/datadog';  // FIRST!
 *   import express from 'express';       // Then others
 */

import tracer from 'dd-trace';

// ============================================
// CONFIGURATION
// ============================================

const config = {
    // Service identification
    service: process.env.DD_SERVICE || 'my-service',
    env: process.env.DD_ENV || 'development',
    version: process.env.DD_VERSION || '1.0.0',
    
    // Tracing options
    enabled: process.env.DD_TRACE_ENABLED !== 'false',
    logInjection: true,
    runtimeMetrics: true,
    profiling: true,
    
    // Sampling
    sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1'),
    
    // Tags
    tags: {
        team: process.env.DD_TEAM || 'backend',
    },
};

// ============================================
// INITIALIZE TRACER
// ============================================

tracer.init({
    ...config,
    // Plugin configurations
    plugins: true,
});

// Enable runtime metrics
tracer.use('http', {
    validateStatus: (code: number) => code < 500,  // Don't mark 4xx as errors
});

tracer.use('express', {
    hooks: {
        request: (span: any, req: any, res: any) => {
            // Add custom tags
            if (req.user) {
                span.setTag('user.id', req.user.id);
                span.setTag('user.role', req.user.role);
            }
        },
    },
});

// ============================================
// EXPORTS
// ============================================

export { tracer };

/**
 * Create a custom span
 */
export function createSpan(name: string, options?: { resource?: string; type?: string }) {
    return tracer.startSpan(name, {
        childOf: tracer.scope().active() || undefined,
        tags: {
            'resource.name': options?.resource || name,
            'span.type': options?.type || 'custom',
        },
    });
}

/**
 * Wrap a function with tracing
 */
export function trace<T extends (...args: any[]) => any>(
    name: string,
    fn: T
): T {
    return ((...args: Parameters<T>) => {
        const span = createSpan(name);
        try {
            const result = fn(...args);
            if (result instanceof Promise) {
                return result
                    .then((value) => {
                        span?.finish();
                        return value;
                    })
                    .catch((error) => {
                        span?.setTag('error', true);
                        span?.setTag('error.msg', error.message);
                        span?.finish();
                        throw error;
                    });
            }
            span?.finish();
            return result;
        } catch (error: any) {
            span?.setTag('error', true);
            span?.setTag('error.msg', error.message);
            span?.finish();
            throw error;
        }
    }) as T;
}

/**
 * Set user context for current trace
 */
export function setUser(user: { id: string; email?: string; role?: string }) {
    const span = tracer.scope().active();
    if (span) {
        span.setTag('user.id', user.id);
        if (user.email) span.setTag('user.email', user.email);
        if (user.role) span.setTag('user.role', user.role);
    }
}

/**
 * Add custom tags to current span
 */
export function addTags(tags: Record<string, string | number | boolean>) {
    const span = tracer.scope().active();
    if (span) {
        Object.entries(tags).forEach(([key, value]) => {
            span.setTag(key, value);
        });
    }
}

console.log(\`📊 Datadog APM initialized for service: \${config.service} (env: \${config.env})\`);
`;

// ============================================
// SENTRY INTEGRATION TEMPLATE
// ============================================

export const SENTRY_INTEGRATION_TEMPLATE = `/**
 * ============================================
 * SENTRY ERROR TRACKING
 * ============================================
 * 
 * Production-ready Sentry integration with:
 * - Error capturing
 * - Performance monitoring
 * - User identification
 * - Context enrichment
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Express, Request, Response, NextFunction } from 'express';

// ============================================
// CONFIGURATION
// ============================================

const SENTRY_CONFIG = {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version || '1.0.0',
    
    // Performance
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    
    // Error filtering
    ignoreErrors: [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        /^Network request failed$/,
    ],
    
    // Deny URLs
    denyUrls: [
        /\\/health$/,
        /\\/ready$/,
        /\\/live$/,
        /\\/metrics$/,
    ],
};

// ============================================
// INITIALIZATION
// ============================================

export function initSentry(app: Express): void {
    if (!SENTRY_CONFIG.dsn) {
        console.warn('⚠️ SENTRY_DSN not set, Sentry disabled');
        return;
    }

    Sentry.init({
        ...SENTRY_CONFIG,
        integrations: [
            // Auto-discover integrations
            ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
            // Profiling
            new ProfilingIntegration(),
        ],
        beforeSend(event, hint) {
            // Filter out specific errors
            const error = hint.originalException as Error;
            if (error?.message?.includes('ECONNREFUSED')) {
                return null;
            }
            return event;
        },
    });

    // Request handler must be first middleware
    app.use(Sentry.Handlers.requestHandler({
        include: {
            ip: true,
            user: true,
            data: ['body', 'query'],
        },
    }));

    // Tracing handler
    app.use(Sentry.Handlers.tracingHandler());

    console.log(\`🔴 Sentry initialized (env: \${SENTRY_CONFIG.environment})\`);
}

// ============================================
// ERROR HANDLER
// ============================================

/**
 * Sentry error handler middleware
 * MUST be used AFTER all routes but BEFORE other error handlers
 */
export function sentryErrorHandler() {
    return Sentry.Handlers.errorHandler({
        shouldHandleError(error: Error | any) {
            // Capture 500+ and specific 4xx errors
            if (error.statusCode) {
                return error.statusCode >= 500 || error.statusCode === 400;
            }
            return true;
        },
    });
}

// ============================================
// USER IDENTIFICATION
// ============================================

/**
 * Set user context for Sentry
 */
export function setUser(user: {
    id: string;
    email?: string;
    username?: string;
    role?: string;
}) {
    Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
    });
}

/**
 * Clear user context
 */
export function clearUser() {
    Sentry.setUser(null);
}

// ============================================
// CONTEXT ENRICHMENT
// ============================================

/**
 * Add extra context to errors
 */
export function setContext(name: string, context: Record<string, any>) {
    Sentry.setContext(name, context);
}

/**
 * Add tags
 */
export function setTags(tags: Record<string, string>) {
    Sentry.setTags(tags);
}

/**
 * Add breadcrumb (event trail)
 */
export function addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level?: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, any>;
}) {
    Sentry.addBreadcrumb({
        ...breadcrumb,
        level: breadcrumb.level || 'info',
        timestamp: Date.now() / 1000,
    });
}

// ============================================
// MANUAL ERROR CAPTURE
// ============================================

/**
 * Capture an exception manually
 */
export function captureException(
    error: Error,
    context?: Record<string, any>
): string {
    if (context) {
        Sentry.setContext('additional', context);
    }
    return Sentry.captureException(error);
}

/**
 * Capture a message
 */
export function captureMessage(
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): string {
    return Sentry.captureMessage(message, level);
}

// ============================================
// PERFORMANCE MONITORING
// ============================================

/**
 * Create a transaction for performance monitoring
 */
export function startTransaction(
    name: string,
    op: string = 'custom'
): Sentry.Transaction {
    return Sentry.startTransaction({
        name,
        op,
    });
}

/**
 * Wrap an async function with performance tracing
 */
export async function traceAsync<T>(
    name: string,
    fn: () => Promise<T>
): Promise<T> {
    const transaction = startTransaction(name);
    try {
        const result = await fn();
        transaction.setStatus('ok');
        return result;
    } catch (error) {
        transaction.setStatus('internal_error');
        throw error;
    } finally {
        transaction.finish();
    }
}

export { Sentry };
`;

// ============================================
// HEALTH CHECK TEMPLATE
// ============================================

export const HEALTH_CHECK_TEMPLATE = `/**
 * ============================================
 * HEALTH CHECK ENDPOINTS
 * ============================================
 * 
 * Kubernetes-compatible health check endpoints:
 * - /health - Overall application health
 * - /ready - Readiness probe (dependencies ready)
 * - /live - Liveness probe (app is running)
 */

import { Router, Request, Response } from 'express';

// ============================================
// TYPES
// ============================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
    name: string;
    status: HealthStatus;
    responseTime?: number;
    message?: string;
    error?: string;
}

export interface HealthResponse {
    status: HealthStatus;
    timestamp: string;
    uptime: number;
    version: string;
    checks?: HealthCheckResult[];
}

// ============================================
// HEALTH CHECK REGISTRY
// ============================================

type HealthCheckFn = () => Promise<HealthCheckResult>;

const healthChecks: Map<string, HealthCheckFn> = new Map();

/**
 * Register a health check
 */
export function registerHealthCheck(name: string, check: HealthCheckFn): void {
    healthChecks.set(name, check);
    console.log(\`📋 Health check registered: \${name}\`);
}

/**
 * Run all health checks
 */
async function runHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const [name, check] of healthChecks) {
        const startTime = Date.now();
        try {
            const result = await Promise.race([
                check(),
                new Promise<HealthCheckResult>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                ),
            ]);
            result.responseTime = Date.now() - startTime;
            results.push(result);
        } catch (error: any) {
            results.push({
                name,
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error.message,
            });
        }
    }
    
    return results;
}

/**
 * Determine overall status from check results
 */
function determineOverallStatus(checks: HealthCheckResult[]): HealthStatus {
    if (checks.some(c => c.status === 'unhealthy')) {
        return 'unhealthy';
    }
    if (checks.some(c => c.status === 'degraded')) {
        return 'degraded';
    }
    return 'healthy';
}

// ============================================
// ROUTER
// ============================================

export const healthRouter = Router();
const startTime = Date.now();

/**
 * GET /health - Comprehensive health check
 */
healthRouter.get('/health', async (req: Request, res: Response) => {
    const checks = await runHealthChecks();
    const status = determineOverallStatus(checks);
    
    const response: HealthResponse = {
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: process.env.npm_package_version || '1.0.0',
        checks,
    };

    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    res.status(httpStatus).json(response);
});

/**
 * GET /ready - Readiness probe
 * Returns 200 only if all dependencies are ready
 */
healthRouter.get('/ready', async (req: Request, res: Response) => {
    const checks = await runHealthChecks();
    const status = determineOverallStatus(checks);
    
    if (status === 'unhealthy') {
        return res.status(503).json({
            status: 'not ready',
            checks: checks.filter(c => c.status === 'unhealthy'),
        });
    }

    res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

/**
 * GET /live - Liveness probe
 * Returns 200 if the app is running (no dependency checks)
 */
healthRouter.get('/live', (req: Request, res: Response) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
    });
});

// ============================================
// COMMON HEALTH CHECKS
// ============================================

/**
 * Database health check factory
 */
export function createDatabaseCheck(
    name: string,
    pingFn: () => Promise<void>
): HealthCheckFn {
    return async () => {
        try {
            await pingFn();
            return { name, status: 'healthy' };
        } catch (error: any) {
            return { name, status: 'unhealthy', error: error.message };
        }
    };
}

/**
 * Redis health check factory
 */
export function createRedisCheck(
    name: string,
    pingFn: () => Promise<string>
): HealthCheckFn {
    return async () => {
        try {
            const result = await pingFn();
            return {
                name,
                status: result === 'PONG' ? 'healthy' : 'degraded',
            };
        } catch (error: any) {
            return { name, status: 'unhealthy', error: error.message };
        }
    };
}

/**
 * HTTP health check factory
 */
export function createHttpCheck(
    name: string,
    url: string,
    timeout: number = 3000
): HealthCheckFn {
    return async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            return {
                name,
                status: response.ok ? 'healthy' : 'degraded',
                message: \`HTTP \${response.status}\`,
            };
        } catch (error: any) {
            clearTimeout(timeoutId);
            return {
                name,
                status: 'unhealthy',
                error: error.message,
            };
        }
    };
}

/**
 * Memory health check
 */
export function createMemoryCheck(
    name: string = 'memory',
    thresholdPercent: number = 90
): HealthCheckFn {
    return async () => {
        const used = process.memoryUsage();
        const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
        
        return {
            name,
            status: heapUsedPercent > thresholdPercent ? 'degraded' : 'healthy',
            message: \`Heap: \${Math.round(heapUsedPercent)}% (\${Math.round(used.heapUsed / 1024 / 1024)}MB)\`,
        };
    };
}
`;

// ============================================
// STRUCTURED LOGGING TEMPLATE
// ============================================

export const STRUCTURED_LOGGING_TEMPLATE = `/**
 * ============================================
 * STRUCTURED LOGGING
 * ============================================
 * 
 * Production-ready logging with:
 * - JSON structured format
 * - Log levels (error, warn, info, debug)
 * - Request correlation
 * - Sensitive data redaction
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// ============================================
// CONFIGURATION
// ============================================

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json';
const LOG_DIR = process.env.LOG_DIR || 'logs';

// ============================================
// SENSITIVE DATA REDACTION
// ============================================

const SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'authorization',
    'cookie',
    'apiKey',
    'api_key',
    'creditCard',
    'credit_card',
    'ssn',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
];

function redactSensitiveData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(redactSensitiveData);
    }

    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()))) {
            redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
            redacted[key] = redactSensitiveData(value);
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}

// ============================================
// FORMAT
// ============================================

const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
        // Redact sensitive data
        if (info.meta) {
            info.meta = redactSensitiveData(info.meta);
        }
        return info;
    })(),
    winston.format.json()
);

const prettyFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 
            ? \` \${JSON.stringify(redactSensitiveData(meta))}\`
            : '';
        return \`[\${timestamp}] \${level}: \${message}\${metaStr}\`;
    })
);

// ============================================
// TRANSPORTS
// ============================================

const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
        format: LOG_FORMAT === 'pretty' ? prettyFormat : jsonFormat,
    }),
];

// File transports (production)
if (process.env.NODE_ENV === 'production') {
    // Rotating error log
    transports.push(
        new DailyRotateFile({
            filename: \`\${LOG_DIR}/error-%DATE%.log\`,
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d',
            format: jsonFormat,
        })
    );

    // Rotating combined log
    transports.push(
        new DailyRotateFile({
            filename: \`\${LOG_DIR}/combined-%DATE%.log\`,
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: jsonFormat,
        })
    );
}

// ============================================
// LOGGER INSTANCE
// ============================================

export const logger = winston.createLogger({
    level: LOG_LEVEL,
    defaultMeta: {
        service: process.env.SERVICE_NAME || 'app',
        env: process.env.NODE_ENV || 'development',
    },
    transports,
});

// ============================================
// CHILD LOGGER
// ============================================

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
    return logger.child(context);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, userId?: string) {
    return logger.child({
        requestId,
        userId,
    });
}

// ============================================
// CONVENIENCE METHODS
// ============================================

export function logError(message: string, error: Error, meta?: Record<string, any>) {
    logger.error(message, {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
        ...meta,
    });
}

export function logRequest(method: string, path: string, meta?: Record<string, any>) {
    logger.info(\`\${method} \${path}\`, meta);
}

export function logDatabase(operation: string, table: string, duration: number, meta?: Record<string, any>) {
    logger.debug(\`DB: \${operation} \${table} (\${duration}ms)\`, {
        database: { operation, table, duration },
        ...meta,
    });
}

export function logExternal(service: string, method: string, duration: number, status: number, meta?: Record<string, any>) {
    logger.info(\`External: \${service} \${method} -> \${status} (\${duration}ms)\`, {
        external: { service, method, duration, status },
        ...meta,
    });
}

console.log(\`📝 Logging initialized (level: \${LOG_LEVEL}, format: \${LOG_FORMAT})\`);
`;

// ============================================
// EXPORTS
// ============================================

export const MONITORING_TEMPLATE_SETS = {
    apm: {
        name: "Datadog APM",
        template: DATADOG_APM_TEMPLATE,
        description: "Datadog APM with tracing",
    },
    sentry: {
        name: "Sentry Integration",
        template: SENTRY_INTEGRATION_TEMPLATE,
        description: "Sentry error tracking",
    },
    health: {
        name: "Health Checks",
        template: HEALTH_CHECK_TEMPLATE,
        description: "Kubernetes-compatible health endpoints",
    },
    logging: {
        name: "Structured Logging",
        template: STRUCTURED_LOGGING_TEMPLATE,
        description: "Winston structured logging",
    },
};

export function getMonitoringTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        apm: DATADOG_APM_TEMPLATE,
        sentry: SENTRY_INTEGRATION_TEMPLATE,
        health: HEALTH_CHECK_TEMPLATE,
        logging: STRUCTURED_LOGGING_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableMonitoringTypes(): string[] {
    return ["apm", "sentry", "health", "logging", "metrics", "tracing", "alerting", "audit"];
}

// ============================================
// RE-EXPORT TEMPLATE MODULES
// ============================================

// Metrics Templates
export {
    METRICS_COLLECTION_TEMPLATE,
    DATADOG_METRICS_TEMPLATE,
    METRICS_TEMPLATE_SETS,
    getMetricsTemplates,
} from "./metrics.js";

// Alerting & Audit Templates
export {
    ALERTING_TEMPLATE,
    AUDIT_LOGGING_TEMPLATE,
    ALERTING_TEMPLATE_SETS,
    getAlertingTemplates,
} from "./alerting.js";

// Tracing Templates
export {
    DISTRIBUTED_TRACING_TEMPLATE,
    OPENTELEMETRY_TEMPLATE,
    TRACING_TEMPLATE_SETS,
    getTracingTemplates,
} from "./tracing.js";

