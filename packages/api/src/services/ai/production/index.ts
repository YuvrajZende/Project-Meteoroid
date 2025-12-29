/**
 * Production Readiness Module Exports
 */

export {
    // Types
    type AIQualityMetrics,
    type AgentQualityMetrics,
    type TimeWindowMetrics,
    type ErrorEvent,
    type FeedbackEntry,
    type FeedbackIssue,
    type UsageEvent,
    type UsageAnalytics,

    // Classes
    AIQualityAssurance,
    ErrorHandlingManager,
    FeedbackLoop,
    UsageAnalyticsService,

    // Singletons
    getAIQualityAssurance,
    getErrorHandlingManager,
    getFeedbackLoop,
    getUsageAnalyticsService,
} from './production-readiness.js';
