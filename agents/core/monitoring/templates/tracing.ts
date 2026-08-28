/**
 * ============================================
 * DISTRIBUTED TRACING TEMPLATES
 * ============================================
 * 
 * Production-ready tracing with OpenTelemetry
 * and provider-specific integrations.
 */

// ============================================
// DISTRIBUTED TRACING TEMPLATE
// ============================================

export const DISTRIBUTED_TRACING_TEMPLATE = `/**
 * ============================================
 * DISTRIBUTED TRACING
 * ============================================
 * 
 * Comprehensive tracing for microservices with:
 * - Request tracing across services
 * - Database query tracing
 * - HTTP client tracing
 * - Custom span creation
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    sampled: boolean;
}

export interface Span {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    serviceName: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: 'ok' | 'error' | 'unset';
    tags: Record<string, string | number | boolean>;
    logs: SpanLog[];
}

export interface SpanLog {
    timestamp: number;
    fields: Record<string, any>;
}

// ============================================
// TRACE CONTEXT PROPAGATION
// ============================================

const TRACE_HEADER = 'x-trace-id';
const SPAN_HEADER = 'x-span-id';
const SAMPLED_HEADER = 'x-trace-sampled';

/**
 * Extract trace context from headers
 */
export function extractTraceContext(headers: Record<string, string | undefined>): TraceContext | null {
    const traceId = headers[TRACE_HEADER] || headers['traceparent']?.split('-')[1];
    if (!traceId) return null;

    return {
        traceId,
        spanId: uuidv4().replace(/-/g, '').substring(0, 16),
        parentSpanId: headers[SPAN_HEADER],
        sampled: headers[SAMPLED_HEADER] !== '0',
    };
}

/**
 * Inject trace context into headers
 */
export function injectTraceContext(headers: Record<string, string>, context: TraceContext): void {
    headers[TRACE_HEADER] = context.traceId;
    headers[SPAN_HEADER] = context.spanId;
    headers[SAMPLED_HEADER] = context.sampled ? '1' : '0';
    // W3C Trace Context format
    headers['traceparent'] = \`00-\${context.traceId}-\${context.spanId}-\${context.sampled ? '01' : '00'}\`;
}

// ============================================
// TRACER CLASS
// ============================================

class Tracer {
    private serviceName: string;
    private spans: Map<string, Span> = new Map();
    private currentSpan: Span | null = null;
    private exporter: (span: Span) => void;

    constructor(serviceName: string, exporter?: (span: Span) => void) {
        this.serviceName = serviceName;
        this.exporter = exporter || this.defaultExporter;
    }

    /**
     * Start a new span
     */
    startSpan(
        operationName: string,
        options?: {
            parent?: Span | null;
            tags?: Record<string, string | number | boolean>;
        }
    ): Span {
        const parentSpan = options?.parent ?? this.currentSpan;
        const traceId = parentSpan?.traceId || uuidv4().replace(/-/g, '');
        const spanId = uuidv4().replace(/-/g, '').substring(0, 16);

        const span: Span = {
            traceId,
            spanId,
            parentSpanId: parentSpan?.spanId,
            operationName,
            serviceName: this.serviceName,
            startTime: Date.now(),
            status: 'unset',
            tags: options?.tags || {},
            logs: [],
        };

        this.spans.set(spanId, span);
        this.currentSpan = span;

        return span;
    }

    /**
     * Finish a span
     */
    finishSpan(span: Span, status: 'ok' | 'error' = 'ok'): void {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = status;

        this.exporter(span);
        this.spans.delete(span.spanId);

        // Restore parent as current
        if (span.parentSpanId) {
            this.currentSpan = this.spans.get(span.parentSpanId) || null;
        } else {
            this.currentSpan = null;
        }
    }

    /**
     * Add tag to span
     */
    setTag(span: Span, key: string, value: string | number | boolean): void {
        span.tags[key] = value;
    }

    /**
     * Add log to span
     */
    log(span: Span, fields: Record<string, any>): void {
        span.logs.push({
            timestamp: Date.now(),
            fields,
        });
    }

    /**
     * Mark span as error
     */
    setError(span: Span, error: Error): void {
        span.status = 'error';
        span.tags['error'] = true;
        span.tags['error.message'] = error.message;
        span.tags['error.stack'] = error.stack || '';
    }

    /**
     * Get current span
     */
    getCurrentSpan(): Span | null {
        return this.currentSpan;
    }

    /**
     * Wrap an async function with tracing
     */
    async trace<T>(
        operationName: string,
        fn: (span: Span) => Promise<T>,
        tags?: Record<string, string | number | boolean>
    ): Promise<T> {
        const span = this.startSpan(operationName, { tags });
        try {
            const result = await fn(span);
            this.finishSpan(span, 'ok');
            return result;
        } catch (error: any) {
            this.setError(span, error);
            this.finishSpan(span, 'error');
            throw error;
        }
    }

    private defaultExporter(span: Span): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(JSON.stringify({
                type: 'trace',
                traceId: span.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                operation: span.operationName,
                duration: span.duration,
                status: span.status,
                tags: span.tags,
            }));
        }
    }
}

// ============================================
// TRACING MIDDLEWARE
// ============================================

/**
 * Express tracing middleware
 */
export function tracingMiddleware(options?: { serviceName?: string }) {
    const tracer = new Tracer(options?.serviceName || process.env.SERVICE_NAME || 'app');

    return (req: Request, res: Response, next: NextFunction) => {
        // Extract or create trace context
        const existingContext = extractTraceContext(req.headers as Record<string, string>);
        const context: TraceContext = existingContext || {
            traceId: uuidv4().replace(/-/g, ''),
            spanId: uuidv4().replace(/-/g, '').substring(0, 16),
            sampled: Math.random() < (parseFloat(process.env.TRACE_SAMPLE_RATE || '1')),
        };

        // Start span for this request
        const span = tracer.startSpan(\`HTTP \${req.method} \${req.path}\`, {
            tags: {
                'http.method': req.method,
                'http.url': req.url,
                'http.path': req.path,
                'component': 'http',
                'span.kind': 'server',
            },
        });

        // Attach to request for access in handlers
        (req as any).span = span;
        (req as any).tracer = tracer;
        (req as any).traceId = context.traceId;

        // Set response header
        res.setHeader('X-Trace-ID', context.traceId);

        // Capture response
        res.on('finish', () => {
            tracer.setTag(span, 'http.status_code', res.statusCode);
            if (res.statusCode >= 400) {
                tracer.setTag(span, 'error', true);
            }
            tracer.finishSpan(span, res.statusCode >= 500 ? 'error' : 'ok');
        });

        next();
    };
}

// ============================================
// TRACING UTILITIES
// ============================================

/**
 * Create a child span from request
 */
export function createChildSpan(req: Request, operationName: string): Span | null {
    const parent = (req as any).span;
    const tracer = (req as any).tracer;
    
    if (!tracer) return null;
    
    return tracer.startSpan(operationName, { parent });
}

/**
 * Trace a database operation
 */
export async function traceDatabase<T>(
    req: Request,
    operation: string,
    table: string,
    fn: () => Promise<T>
): Promise<T> {
    const span = createChildSpan(req, \`DB \${operation} \${table}\`);
    
    if (!span) {
        return fn();
    }

    const tracer = (req as any).tracer;
    tracer.setTag(span, 'db.type', 'postgresql');
    tracer.setTag(span, 'db.operation', operation);
    tracer.setTag(span, 'db.table', table);

    try {
        const result = await fn();
        tracer.finishSpan(span, 'ok');
        return result;
    } catch (error: any) {
        tracer.setError(span, error);
        tracer.finishSpan(span, 'error');
        throw error;
    }
}

/**
 * Trace an external HTTP call
 */
export async function traceHttp<T>(
    req: Request,
    method: string,
    url: string,
    fn: (headers: Record<string, string>) => Promise<T>
): Promise<T> {
    const span = createChildSpan(req, \`HTTP \${method} \${url}\`);
    
    if (!span) {
        return fn({});
    }

    const tracer = (req as any).tracer;
    tracer.setTag(span, 'http.method', method);
    tracer.setTag(span, 'http.url', url);
    tracer.setTag(span, 'span.kind', 'client');

    // Prepare headers with trace context
    const headers: Record<string, string> = {};
    injectTraceContext(headers, {
        traceId: span.traceId,
        spanId: span.spanId,
        sampled: true,
    });

    try {
        const result = await fn(headers);
        tracer.finishSpan(span, 'ok');
        return result;
    } catch (error: any) {
        tracer.setError(span, error);
        tracer.finishSpan(span, 'error');
        throw error;
    }
}

export { Tracer };
export const defaultTracer = new Tracer(process.env.SERVICE_NAME || 'app');
`;

// ============================================
// OPENTELEMETRY TEMPLATE
// ============================================

export const OPENTELEMETRY_TEMPLATE = `/**
 * ============================================
 * OPENTELEMETRY INSTRUMENTATION
 * ============================================
 * 
 * Vendor-neutral distributed tracing with:
 * - Auto-instrumentation for HTTP, databases, etc.
 * - OTLP exporter for any backend
 * - Span processors and samplers
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';

// ============================================
// CONFIGURATION
// ============================================

const config = {
    serviceName: process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'my-service',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '1.0.0',
    exporterUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    sampleRate: parseFloat(process.env.OTEL_TRACE_SAMPLE_RATE || '1.0'),
};

// ============================================
// RESOURCE
// ============================================

const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.version,
    [SemanticResourceAttributes.HOST_NAME]: process.env.HOSTNAME || 'unknown',
});

// ============================================
// EXPORTERS
// ============================================

const traceExporter = new OTLPTraceExporter({
    url: \`\${config.exporterUrl}/v1/traces\`,
});

const metricExporter = new OTLPMetricExporter({
    url: \`\${config.exporterUrl}/v1/metrics\`,
});

// ============================================
// SAMPLER
// ============================================

const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(config.sampleRate),
});

// ============================================
// SDK SETUP
// ============================================

const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000,
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            // Customize instrumentations
            '@opentelemetry/instrumentation-http': {
                ignoreIncomingPaths: ['/health', '/ready', '/live', '/metrics'],
            },
            '@opentelemetry/instrumentation-express': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-pg': {
                enabled: true,
            },
            '@opentelemetry/instrumentation-redis': {
                enabled: true,
            },
        }),
    ],
    spanProcessor: new BatchSpanProcessor(traceExporter),
    sampler,
});

// ============================================
// START/STOP
// ============================================

let isStarted = false;

/**
 * Start OpenTelemetry tracing
 */
export function startTracing(): void {
    if (isStarted) return;
    
    sdk.start();
    isStarted = true;
    
    console.log(\`🔍 OpenTelemetry started for \${config.serviceName} (sample rate: \${config.sampleRate})\`);

    // Graceful shutdown
    process.on('SIGTERM', () => {
        sdk.shutdown()
            .then(() => console.log('OpenTelemetry shut down'))
            .catch((err) => console.error('Error shutting down OpenTelemetry', err))
            .finally(() => process.exit(0));
    });
}

/**
 * Stop OpenTelemetry tracing
 */
export async function stopTracing(): Promise<void> {
    if (!isStarted) return;
    
    await sdk.shutdown();
    isStarted = false;
    console.log('🔍 OpenTelemetry stopped');
}

// ============================================
// TRACING API
// ============================================

const tracer = trace.getTracer(config.serviceName);

/**
 * Create a new span
 */
export function createSpan(
    name: string,
    options?: {
        kind?: SpanKind;
        attributes?: Record<string, string | number | boolean>;
    }
) {
    return tracer.startSpan(name, {
        kind: options?.kind || SpanKind.INTERNAL,
        attributes: options?.attributes,
    });
}

/**
 * Wrap an async function with a span
 */
export async function withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
): Promise<T> {
    const span = createSpan(name, { attributes });
    
    return context.with(trace.setSpan(context.active(), span), async () => {
        try {
            const result = await fn();
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error: any) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });
            span.recordException(error);
            throw error;
        } finally {
            span.end();
        }
    });
}

/**
 * Get current span
 */
export function getCurrentSpan() {
    return trace.getSpan(context.active());
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>) {
    const span = getCurrentSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}

/**
 * Add attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>) {
    const span = getCurrentSpan();
    if (span) {
        span.setAttributes(attributes);
    }
}

export { sdk as openTelemetrySdk, tracer };
`;

// ============================================
// EXPORTS
// ============================================

export const TRACING_TEMPLATE_SETS = {
    basic: {
        name: "Basic Tracing",
        template: DISTRIBUTED_TRACING_TEMPLATE,
        description: "Lightweight distributed tracing",
    },
    opentelemetry: {
        name: "OpenTelemetry",
        template: OPENTELEMETRY_TEMPLATE,
        description: "Full OpenTelemetry instrumentation",
    },
};

export function getTracingTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        basic: DISTRIBUTED_TRACING_TEMPLATE,
        opentelemetry: OPENTELEMETRY_TEMPLATE,
    };
    return templates[type];
}
