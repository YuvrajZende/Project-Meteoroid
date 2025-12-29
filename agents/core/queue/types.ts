/**
 * ============================================
 * QUEUE AGENT - TYPE DEFINITIONS
 * ============================================
 * Type definitions for the Queue Agent
 * Handles background job processing with BullMQ
 */

// ============================================
// QUEUE CONFIGURATION TYPES
// ============================================

/**
 * Supported queue providers
 */
export type QueueProvider = 'bullmq' | 'redis' | 'sqs' | 'rabbitmq';

/**
 * Supported job states
 */
export type JobState =
    | 'waiting'
    | 'active'
    | 'completed'
    | 'failed'
    | 'delayed'
    | 'paused'
    | 'prioritized';

/**
 * Job priority levels
 */
export type JobPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Backoff strategies
 */
export type BackoffStrategy = 'fixed' | 'exponential' | 'custom';

/**
 * Redis connection configuration
 */
export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    tls?: boolean;
    maxRetriesPerRequest?: number;
    connectTimeout?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
    name: string;
    prefix?: string;
    connection?: RedisConfig;
    defaultJobOptions?: JobOptions;
    limiter?: RateLimiterConfig;
    settings?: QueueSettings;
}

/**
 * Queue settings
 */
export interface QueueSettings {
    stalledInterval?: number;
    maxStalledCount?: number;
    guardInterval?: number;
    retryProcessDelay?: number;
    drainDelay?: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
    max: number;
    duration: number;
    bounceBack?: boolean;
    groupKey?: string;
}

// ============================================
// JOB TYPES
// ============================================

/**
 * Job options
 */
export interface JobOptions {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: BackoffConfig;
    timeout?: number;
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    stackTraceLimit?: number;
    repeat?: RepeatOptions;
    jobId?: string;
}

/**
 * Backoff configuration
 */
export interface BackoffConfig {
    type: BackoffStrategy;
    delay: number;
    maxDelay?: number;
}

/**
 * Repeat options for scheduled jobs
 */
export interface RepeatOptions {
    pattern?: string;  // Cron pattern
    every?: number;    // Repeat every X milliseconds
    limit?: number;    // Max number of times to repeat
    startDate?: Date | string;
    endDate?: Date | string;
    tz?: string;       // Timezone
}

/**
 * Job definition
 */
export interface JobDefinition {
    name: string;
    data: Record<string, unknown>;
    options?: JobOptions;
    description?: string;
}

/**
 * Job type definition for typed queues
 */
export interface JobTypeDefinition {
    name: string;
    dataSchema: Record<string, FieldSchema>;
    resultSchema?: Record<string, FieldSchema>;
    options?: JobOptions;
    handler?: string;  // Handler function name
    description?: string;
}

/**
 * Field schema for job data
 */
export interface FieldSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
    required?: boolean;
    default?: unknown;
    description?: string;
}

// ============================================
// WORKER TYPES
// ============================================

/**
 * Worker configuration
 */
export interface WorkerConfig {
    name: string;
    queueName: string;
    concurrency?: number;
    limiter?: RateLimiterConfig;
    lockDuration?: number;
    lockRenewTime?: number;
    stalledInterval?: number;
    autorun?: boolean;
    settings?: WorkerSettings;
}

/**
 * Worker settings
 */
export interface WorkerSettings {
    runRetryDelay?: number;
    lockDuration?: number;
    stalledInterval?: number;
    maxStalledCount?: number;
}

/**
 * Worker processor definition
 */
export interface ProcessorDefinition {
    name: string;
    queueName: string;
    concurrency?: number;
    processor: string;  // Processor function code or reference
    errorHandler?: string;
    completedHandler?: string;
    description?: string;
}

// ============================================
// DEAD LETTER QUEUE TYPES
// ============================================

/**
 * Dead letter queue configuration
 */
export interface DeadLetterQueueConfig {
    enabled: boolean;
    queueName: string;
    maxRetries?: number;
    retentionPeriod?: number;  // In milliseconds
    onFailure?: 'move' | 'copy';
}

// ============================================
// QUEUE AGENT CONFIGURATION
// ============================================

/**
 * Queue agent config
 */
export interface QueueAgentConfig {
    provider: QueueProvider;
    redis?: RedisConfig;
    defaultQueue?: QueueConfig;
    enableMetrics?: boolean;
    enableDeadLetterQueue?: boolean;
    enableJobEvents?: boolean;
    enableScheduling?: boolean;
}

// ============================================
// QUEUE CONTEXT TYPES
// ============================================

/**
 * Queue task context for enhanced analysis
 */
export interface QueueTaskContext {
    existingQueues?: QueueConfig[];
    targetProvider?: QueueProvider;
    projectType?: 'api' | 'fullstack' | 'microservice' | 'serverless';
    features?: string[];
    scalingRequirements?: 'low' | 'medium' | 'high';
}

// ============================================
// QUEUE METRICS TYPES
// ============================================

/**
 * Queue metrics
 */
export interface QueueMetrics {
    queueName: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
    processingRate: number;  // Jobs per second
    averageWaitTime: number;  // In milliseconds
    averageProcessTime: number;  // In milliseconds
}

/**
 * Worker metrics
 */
export interface WorkerMetrics {
    workerId: string;
    queueName: string;
    isRunning: boolean;
    jobsProcessed: number;
    jobsFailed: number;
    currentConcurrency: number;
    uptime: number;
}

// ============================================
// SCHEDULING TYPES
// ============================================

/**
 * Scheduled job definition
 */
export interface ScheduledJob {
    name: string;
    queueName: string;
    pattern: string;  // Cron pattern
    data?: Record<string, unknown>;
    options?: JobOptions;
    tz?: string;
    description?: string;
}

/**
 * Flow definition for job dependencies
 */
export interface FlowDefinition {
    name: string;
    queueName: string;
    data: Record<string, unknown>;
    children?: FlowChild[];
    options?: JobOptions;
}

/**
 * Flow child job
 */
export interface FlowChild {
    name: string;
    queueName: string;
    data: Record<string, unknown>;
    children?: FlowChild[];
    options?: JobOptions;
}

// ============================================
// GENERATION RESULT TYPES
// ============================================

/**
 * Generated file
 */
export interface QueueGeneratedFile {
    path: string;
    content: string;
    description: string;
    type: 'queue' | 'worker' | 'processor' | 'types' | 'config' | 'scheduler' | 'flow';
}

/**
 * Queue generation result
 */
export interface QueueGenerationResult {
    files: QueueGeneratedFile[];
    dependencies: string[];
    envVariables: string[];
    instructions: string[];
    warnings?: string[];
}

// ============================================
// EVENT TYPES
// ============================================

/**
 * Queue event types
 */
export type QueueEventType =
    | 'completed'
    | 'failed'
    | 'progress'
    | 'removed'
    | 'waiting'
    | 'active'
    | 'delayed'
    | 'stalled'
    | 'drained';

/**
 * Event handler definition
 */
export interface EventHandlerDefinition {
    event: QueueEventType;
    queueName: string;
    handler: string;  // Handler function code or reference
    description?: string;
}
