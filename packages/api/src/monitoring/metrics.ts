/**
 * Prometheus Metrics
 * Application metrics collection and exposure
 */

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric definition
 */
export interface MetricDefinition {
    name: string;
    help: string;
    type: MetricType;
    labelNames?: string[];
    buckets?: number[]; // For histograms
}

/**
 * Metric labels
 */
export type MetricLabels = Record<string, string>;

/**
 * Simple metric storage (replace with prom-client in production)
 */
class MetricValue {
    private value = 0;
    private histogram: Map<number, number> = new Map();

    increment(amount: number = 1): void {
        this.value += amount;
    }

    decrement(amount: number = 1): void {
        this.value -= amount;
    }

    set(value: number): void {
        this.value = value;
    }

    observe(value: number, buckets: number[]): void {
        for (const bucket of buckets) {
            if (value <= bucket) {
                const current = this.histogram.get(bucket) || 0;
                this.histogram.set(bucket, current + 1);
            }
        }
        this.increment();
    }

    getValue(): number {
        return this.value;
    }

    getHistogram(): Map<number, number> {
        return this.histogram;
    }
}

/**
 * Metrics Registry
 */
export class MetricsRegistry {
    private metrics: Map<string, MetricDefinition> = new Map();
    private values: Map<string, Map<string, MetricValue>> = new Map();

    /**
     * Register a new metric
     */
    register(definition: MetricDefinition): void {
        this.metrics.set(definition.name, definition);
        this.values.set(definition.name, new Map());
    }

    /**
     * Get or create metric value with labels
     */
    private getOrCreateValue(name: string, labels: MetricLabels = {}): MetricValue {
        const metricValues = this.values.get(name);
        if (!metricValues) {
            throw new Error(`Metric ${name} not registered`);
        }

        const labelKey = JSON.stringify(labels);
        let value = metricValues.get(labelKey);

        if (!value) {
            value = new MetricValue();
            metricValues.set(labelKey, value);
        }

        return value;
    }

    /**
     * Increment a counter
     */
    inc(name: string, labels: MetricLabels = {}, amount: number = 1): void {
        this.getOrCreateValue(name, labels).increment(amount);
    }

    /**
     * Decrement a gauge
     */
    dec(name: string, labels: MetricLabels = {}, amount: number = 1): void {
        this.getOrCreateValue(name, labels).decrement(amount);
    }

    /**
     * Set a gauge value
     */
    set(name: string, labels: MetricLabels = {}, value: number): void {
        this.getOrCreateValue(name, labels).set(value);
    }

    /**
     * Observe a histogram value
     */
    observe(name: string, labels: MetricLabels = {}, value: number): void {
        const definition = this.metrics.get(name);
        if (!definition) {
            throw new Error(`Metric ${name} not registered`);
        }

        const buckets = definition.buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
        this.getOrCreateValue(name, labels).observe(value, buckets);
    }

    /**
     * Start a timer for histogram
     */
    startTimer(name: string, labels: MetricLabels = {}): () => number {
        const start = process.hrtime.bigint();

        return () => {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1e6;
            this.observe(name, labels, durationMs / 1000); // Convert to seconds
            return durationMs;
        };
    }

    /**
     * Export metrics in Prometheus format
     */
    export(): string {
        const lines: string[] = [];

        for (const [name, definition] of this.metrics) {
            lines.push(`# HELP ${name} ${definition.help}`);
            lines.push(`# TYPE ${name} ${definition.type}`);

            const metricValues = this.values.get(name);
            if (metricValues) {
                for (const [labelKey, value] of metricValues) {
                    const labels = JSON.parse(labelKey) as MetricLabels;
                    const labelStr = Object.entries(labels)
                        .map(([k, v]) => `${k}="${v}"`)
                        .join(',');

                    if (definition.type === 'histogram') {
                        const histogram = value.getHistogram();
                        const buckets = definition.buckets || [];

                        for (const bucket of buckets) {
                            const count = histogram.get(bucket) || 0;
                            const bucketLabel = labelStr ? `${labelStr},le="${bucket}"` : `le="${bucket}"`;
                            lines.push(`${name}_bucket{${bucketLabel}} ${count}`);
                        }

                        const infLabel = labelStr ? `${labelStr},le="+Inf"` : `le="+Inf"`;
                        lines.push(`${name}_bucket{${infLabel}} ${value.getValue()}`);
                        lines.push(`${name}_sum{${labelStr || ''}} ${value.getValue()}`);
                        lines.push(`${name}_count{${labelStr || ''}} ${value.getValue()}`);
                    } else {
                        if (labelStr) {
                            lines.push(`${name}{${labelStr}} ${value.getValue()}`);
                        } else {
                            lines.push(`${name} ${value.getValue()}`);
                        }
                    }
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * Get all metrics as JSON
     */
    toJSON(): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [name, definition] of this.metrics) {
            const metricValues = this.values.get(name);
            if (metricValues) {
                const values: Record<string, number> = {};
                for (const [labelKey, value] of metricValues) {
                    values[labelKey || 'default'] = value.getValue();
                }
                result[name] = {
                    type: definition.type,
                    help: definition.help,
                    values,
                };
            }
        }

        return result;
    }
}

// Default registry
const defaultRegistry = new MetricsRegistry();

// Pre-register common metrics
defaultRegistry.register({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    type: 'counter',
    labelNames: ['method', 'path', 'status'],
});

defaultRegistry.register({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    type: 'histogram',
    labelNames: ['method', 'path'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

defaultRegistry.register({
    name: 'active_tasks',
    help: 'Number of currently active tasks',
    type: 'gauge',
});

defaultRegistry.register({
    name: 'agent_execution_duration_seconds',
    help: 'Agent execution duration in seconds',
    type: 'histogram',
    labelNames: ['agent'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
});

defaultRegistry.register({
    name: 'api_key_usage_total',
    help: 'Total API key usage by provider',
    type: 'counter',
    labelNames: ['provider'],
});

defaultRegistry.register({
    name: 'queue_jobs_total',
    help: 'Total number of queued jobs by status',
    type: 'counter',
    labelNames: ['status'],
});

defaultRegistry.register({
    name: 'error_total',
    help: 'Total number of errors',
    type: 'counter',
    labelNames: ['type'],
});

// Export registry and convenience functions
export const metrics = defaultRegistry;

export function getMetrics(): MetricsRegistry {
    return defaultRegistry;
}

// Convenience functions
export function incHttpRequests(method: string, path: string, status: number): void {
    metrics.inc('http_requests_total', { method, path, status: String(status) });
}

export function observeHttpDuration(method: string, path: string, durationSeconds: number): void {
    metrics.observe('http_request_duration_seconds', { method, path }, durationSeconds);
}

export function setActiveTasks(count: number): void {
    metrics.set('active_tasks', {}, count);
}

export function observeAgentDuration(agent: string, durationSeconds: number): void {
    metrics.observe('agent_execution_duration_seconds', { agent }, durationSeconds);
}

export function incApiKeyUsage(provider: string): void {
    metrics.inc('api_key_usage_total', { provider });
}

export function incQueueJobs(status: string): void {
    metrics.inc('queue_jobs_total', { status });
}

export function incErrors(type: string): void {
    metrics.inc('error_total', { type });
}
