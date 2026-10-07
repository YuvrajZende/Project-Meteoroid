/**
 * Monitoring exports
 */

// Sentry
export {
    initSentry,
    captureException,
    captureMessage,
    addBreadcrumb,
    setUser,
    setTag,
    startTransaction,
    flush,
    type SentryConfig,
    type SentryUserContext,
} from './sentry.js';

// Metrics
export {
    MetricsRegistry,
    metrics,
    getMetrics,
    incHttpRequests,
    observeHttpDuration,
    setActiveTasks,
    observeAgentDuration,
    incApiKeyUsage,
    incQueueJobs,
    incErrors,
    type MetricType,
    type MetricDefinition,
    type MetricLabels,
} from './metrics.js';
