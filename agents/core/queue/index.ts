/**
 * ============================================
 * QUEUE AGENT MODULE EXPORTS
 * ============================================
 * 
 * Central export file for the Queue Agent.
 * Following the 7-Layer Feature Integration Guide.
 */

// ========================================
// IAgent Implementation (for agent loader)
// ========================================
export {
    QueueAgentWrapper,
    queueAgentIAgent,
    default,
} from './queue-agent-iagent.js';

// ========================================
// Core Queue Agent
// ========================================
export {
    QueueAgent,
    queueAgent,
} from './queue-agent.js';

// ========================================
// Type Definitions
// ========================================
export type {
    // Queue Configuration
    QueueProvider,
    JobState,
    JobPriority,
    BackoffStrategy,
    RedisConfig,
    QueueConfig,
    QueueSettings,
    RateLimiterConfig,
    QueueAgentConfig,
    QueueTaskContext,

    // Job Types
    JobOptions,
    BackoffConfig,
    RepeatOptions,
    JobDefinition,
    JobTypeDefinition,
    FieldSchema,

    // Worker Types
    WorkerConfig,
    WorkerSettings,
    ProcessorDefinition,

    // DLQ Types
    DeadLetterQueueConfig,

    // Metrics Types
    QueueMetrics,
    WorkerMetrics,

    // Scheduling Types
    ScheduledJob,
    FlowDefinition,
    FlowChild,

    // Event Types
    QueueEventType,
    EventHandlerDefinition,

    // Output Types
    QueueGeneratedFile,
    QueueGenerationResult,
} from './types.js';

// ========================================
// Templates
// ========================================
export {
    // Queue Templates
    BULLMQ_QUEUE_CONFIG_TEMPLATE,
    BULLMQ_QUEUE_SETUP_TEMPLATE,

    // Worker Templates
    BULLMQ_WORKER_TEMPLATE,
    WORKER_PROCESSOR_TEMPLATE,

    // Job Type Templates
    JOB_TYPES_TEMPLATE,

    // Retry Templates
    RETRY_STRATEGY_TEMPLATE,

    // DLQ Templates
    DEAD_LETTER_QUEUE_TEMPLATE,

    // Scheduler Templates
    JOB_SCHEDULER_TEMPLATE,

    // Monitoring Templates
    QUEUE_MONITORING_TEMPLATE,

    // Flow Templates
    JOB_FLOW_TEMPLATE,

    // Rate Limiter Templates
    RATE_LIMITER_TEMPLATE,

    // Template Utilities
    getAvailableTemplates,
    getTemplate,
    getQueueTemplates,
    getAvailableQueueTypes,
    QUEUE_TEMPLATE_SETS,
    type QueueTemplateType,
} from './templates/index.js';
