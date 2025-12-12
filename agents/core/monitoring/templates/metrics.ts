/**
 * ============================================
 * METRICS COLLECTION TEMPLATES
 * ============================================
 * 
 * Production-ready metrics collection with
 * Prometheus, Datadog StatsD, and custom metrics.
 */

// ============================================
// PROMETHEUS METRICS TEMPLATE
// ============================================

export const METRICS_COLLECTION_TEMPLATE = `/**
 * ============================================
 * METRICS COLLECTION (Prometheus)
 * ============================================
 * 
 * Production-ready Prometheus metrics with:
 * - HTTP request metrics
 * - System metrics
 * - Custom business metrics
 * - Histogram for latency distribution
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response, Router } from 'express';

// ============================================
// CONFIGURATION
// ============================================

const METRICS_PREFIX = process.env.METRICS_PREFIX || 'app_';
const ENABLE_DEFAULT_METRICS = process.env.COLLECT_DEFAULT_METRICS !== 'false';

// ============================================
// REGISTRY
// ============================================

export const registry = new Registry();

// Add default labels
registry.setDefaultLabels({
    app: process.env.SERVICE_NAME || 'app',
    env: process.env.NODE_ENV || 'development',
});

// Collect Node.js default metrics
if (ENABLE_DEFAULT_METRICS) {
    collectDefaultMetrics({
        register: registry,
        prefix: METRICS_PREFIX,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });
}

// ============================================
// HTTP METRICS
// ============================================

export const httpRequestsTotal = new Counter({
    name: \`\${METRICS_PREFIX}http_requests_total\`,
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status_code'],
    registers: [registry],
});

export const httpRequestDuration = new Histogram({
    name: \`\${METRICS_PREFIX}http_request_duration_seconds\`,
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
});

export const httpRequestSize = new Histogram({
    name: \`\${METRICS_PREFIX}http_request_size_bytes\`,
    help: 'HTTP request size in bytes',
    labelNames: ['method', 'path'],
    buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
    registers: [registry],
});

export const httpResponseSize = new Histogram({
    name: \`\${METRICS_PREFIX}http_response_size_bytes\`,
    help: 'HTTP response size in bytes',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
    registers: [registry],
});

export const httpActiveRequests = new Gauge({
    name: \`\${METRICS_PREFIX}http_active_requests\`,
    help: 'Number of active HTTP requests',
    registers: [registry],
});

// ============================================
// DATABASE METRICS
// ============================================

export const dbQueryDuration = new Histogram({
    name: \`\${METRICS_PREFIX}db_query_duration_seconds\`,
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table', 'success'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    registers: [registry],
});

export const dbConnectionsActive = new Gauge({
    name: \`\${METRICS_PREFIX}db_connections_active\`,
    help: 'Number of active database connections',
    labelNames: ['database'],
    registers: [registry],
});

// ============================================
// CACHE METRICS
// ============================================

export const cacheHits = new Counter({
    name: \`\${METRICS_PREFIX}cache_hits_total\`,
    help: 'Total cache hits',
    labelNames: ['cache', 'key_prefix'],
    registers: [registry],
});

export const cacheMisses = new Counter({
    name: \`\${METRICS_PREFIX}cache_misses_total\`,
    help: 'Total cache misses',
    labelNames: ['cache', 'key_prefix'],
    registers: [registry],
});

// ============================================
// BUSINESS METRICS
// ============================================

export const businessEvents = new Counter({
    name: \`\${METRICS_PREFIX}business_events_total\`,
    help: 'Business event counter',
    labelNames: ['event_type', 'status'],
    registers: [registry],
});

export const businessGauge = new Gauge({
    name: \`\${METRICS_PREFIX}business_gauge\`,
    help: 'Business metric gauge',
    labelNames: ['metric_name'],
    registers: [registry],
});

// ============================================
// QUEUE METRICS
// ============================================

export const queueJobsProcessed = new Counter({
    name: \`\${METRICS_PREFIX}queue_jobs_processed_total\`,
    help: 'Total jobs processed',
    labelNames: ['queue', 'status'],
    registers: [registry],
});

export const queueJobDuration = new Histogram({
    name: \`\${METRICS_PREFIX}queue_job_duration_seconds\`,
    help: 'Job processing duration',
    labelNames: ['queue', 'job_type'],
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
    registers: [registry],
});

export const queueSize = new Gauge({
    name: \`\${METRICS_PREFIX}queue_size\`,
    help: 'Current queue size',
    labelNames: ['queue', 'status'],
    registers: [registry],
});

// ============================================
// EXTERNAL SERVICE METRICS
// ============================================

export const externalRequestDuration = new Histogram({
    name: \`\${METRICS_PREFIX}external_request_duration_seconds\`,
    help: 'External service request duration',
    labelNames: ['service', 'method', 'status_code'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
});

export const externalRequestErrors = new Counter({
    name: \`\${METRICS_PREFIX}external_request_errors_total\`,
    help: 'External service request errors',
    labelNames: ['service', 'error_type'],
    registers: [registry],
});

// ============================================
// HELPER CLASS
// ============================================

export class Metrics {
    /**
     * Record HTTP request metrics
     */
    static recordHttpRequest(
        method: string,
        path: string,
        statusCode: number,
        duration: number,
        requestSize?: number,
        responseSize?: number
    ) {
        const labels = { method, path, status_code: String(statusCode) };
        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, duration / 1000);
        
        if (requestSize) {
            httpRequestSize.observe({ method, path }, requestSize);
        }
        if (responseSize) {
            httpResponseSize.observe(labels, responseSize);
        }
    }

    /**
     * Record database query metrics
     */
    static recordDbQuery(
        operation: string,
        table: string,
        duration: number,
        success: boolean = true
    ) {
        dbQueryDuration.observe(
            { operation, table, success: String(success) },
            duration / 1000
        );
    }

    /**
     * Record cache operation
     */
    static recordCacheOperation(
        cache: string,
        keyPrefix: string,
        hit: boolean
    ) {
        if (hit) {
            cacheHits.inc({ cache, key_prefix: keyPrefix });
        } else {
            cacheMisses.inc({ cache, key_prefix: keyPrefix });
        }
    }

    /**
     * Record business event
     */
    static recordBusinessEvent(eventType: string, status: string = 'success') {
        businessEvents.inc({ event_type: eventType, status });
    }

    /**
     * Set business gauge value
     */
    static setBusinessGauge(metricName: string, value: number) {
        businessGauge.set({ metric_name: metricName }, value);
    }

    /**
     * Record queue job
     */
    static recordQueueJob(
        queue: string,
        jobType: string,
        status: string,
        duration?: number
    ) {
        queueJobsProcessed.inc({ queue, status });
        if (duration !== undefined) {
            queueJobDuration.observe({ queue, job_type: jobType }, duration / 1000);
        }
    }

    /**
     * Record external request
     */
    static recordExternalRequest(
        service: string,
        method: string,
        statusCode: number,
        duration: number
    ) {
        externalRequestDuration.observe(
            { service, method, status_code: String(statusCode) },
            duration / 1000
        );
    }

    /**
     * Increment counter
     */
    static incrementCounter(name: string, labels: Record<string, string> = {}) {
        // For custom counters
        const counter = registry.getSingleMetric(name) as Counter;
        if (counter) {
            counter.inc(labels);
        }
    }

    /**
     * Record histogram value
     */
    static recordHistogram(name: string, value: number, labels: Record<string, string> = {}) {
        const histogram = registry.getSingleMetric(name) as Histogram;
        if (histogram) {
            histogram.observe(labels, value);
        }
    }
}

// ============================================
// METRICS ENDPOINT
// ============================================

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (req: Request, res: Response) => {
    try {
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
    } catch (error) {
        res.status(500).end();
    }
});

export { registry as metricsRegistry };
export const metrics = Metrics;

console.log(\`📊 Metrics initialized (prefix: \${METRICS_PREFIX})\`);
`;

// ============================================
// DATADOG STATSD METRICS TEMPLATE
// ============================================

export const DATADOG_METRICS_TEMPLATE = `/**
 * ============================================
 * DATADOG STATSD METRICS
 * ============================================
 * 
 * StatsD metrics for Datadog using hot-shots.
 */

import StatsD from 'hot-shots';

// ============================================
// CONFIGURATION
// ============================================

const config = {
    host: process.env.DD_AGENT_HOST || 'localhost',
    port: parseInt(process.env.DD_DOGSTATSD_PORT || '8125'),
    prefix: process.env.METRICS_PREFIX || 'app.',
    globalTags: {
        env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
        service: process.env.DD_SERVICE || 'my-service',
        version: process.env.DD_VERSION || '1.0.0',
    },
};

// ============================================
// CLIENT
// ============================================

export const statsd = new StatsD({
    host: config.host,
    port: config.port,
    prefix: config.prefix,
    globalTags: config.globalTags,
    errorHandler: (error) => {
        console.error('StatsD error:', error);
    },
});

// ============================================
// METRICS CLASS
// ============================================

export class DatadogMetrics {
    /**
     * Increment a counter
     */
    static increment(metric: string, value: number = 1, tags?: Record<string, string>) {
        statsd.increment(metric, value, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Decrement a counter
     */
    static decrement(metric: string, value: number = 1, tags?: Record<string, string>) {
        statsd.decrement(metric, value, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Set a gauge value
     */
    static gauge(metric: string, value: number, tags?: Record<string, string>) {
        statsd.gauge(metric, value, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Record a histogram value
     */
    static histogram(metric: string, value: number, tags?: Record<string, string>) {
        statsd.histogram(metric, value, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Record timing
     */
    static timing(metric: string, value: number, tags?: Record<string, string>) {
        statsd.timing(metric, value, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Record a distribution
     */
    static distribution(metric: string, value: number, tags?: Record<string, string>) {
        statsd.distribution(metric, value, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Add to a set
     */
    static set(metric: string, value: string | number, tags?: Record<string, string>) {
        statsd.set(metric, value, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Time an async operation
     */
    static async timeAsync<T>(
        metric: string,
        fn: () => Promise<T>,
        tags?: Record<string, string>
    ): Promise<T> {
        const start = Date.now();
        try {
            const result = await fn();
            DatadogMetrics.timing(metric, Date.now() - start, { ...tags, success: 'true' });
            return result;
        } catch (error) {
            DatadogMetrics.timing(metric, Date.now() - start, { ...tags, success: 'false' });
            throw error;
        }
    }

    /**
     * Send an event
     */
    static event(
        title: string,
        text: string,
        options?: {
            alertType?: 'error' | 'warning' | 'info' | 'success';
            priority?: 'normal' | 'low';
            tags?: Record<string, string>;
        }
    ) {
        statsd.event(title, text, {
            alert_type: options?.alertType,
            priority: options?.priority,
        }, options?.tags ? Object.entries(options.tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }

    /**
     * Send a service check
     */
    static serviceCheck(
        name: string,
        status: 0 | 1 | 2 | 3, // OK, WARNING, CRITICAL, UNKNOWN
        message?: string,
        tags?: Record<string, string>
    ) {
        statsd.check(name, status, {
            message,
        }, tags ? Object.entries(tags).map(([k, v]) => \`\${k}:\${v}\`) : undefined);
    }
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export const metrics = DatadogMetrics;

// Cleanup on exit
process.on('exit', () => {
    statsd.close();
});

console.log(\`📊 Datadog StatsD initialized (\${config.host}:\${config.port})\`);
`;

// ============================================
// EXPORTS
// ============================================

export const METRICS_TEMPLATE_SETS = {
    prometheus: {
        name: "Prometheus Metrics",
        template: METRICS_COLLECTION_TEMPLATE,
        description: "Prometheus metrics with prom-client",
    },
    datadog: {
        name: "Datadog StatsD",
        template: DATADOG_METRICS_TEMPLATE,
        description: "Datadog metrics with hot-shots",
    },
};

export function getMetricsTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        prometheus: METRICS_COLLECTION_TEMPLATE,
        datadog: DATADOG_METRICS_TEMPLATE,
    };
    return templates[type];
}
