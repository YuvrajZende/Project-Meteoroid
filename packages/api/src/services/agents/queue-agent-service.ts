/**
 * Queue Agent Service
 * 
 * Local wrapper for the Queue Agent that generates background job systems.
 * This service can be used by the orchestrator to detect queue-related tasks
 * and generate appropriate BullMQ-based queue infrastructure.
 * 
 * Following the 7-Layer Feature Integration Guide (Person 2's Implementation)
 */

// ============================================
// TYPES
// ============================================

export interface QueueGenerationRequest {
    requirements: string;
    generateWorkers?: boolean;
    generateScheduler?: boolean;
    generateDLQ?: boolean;
    generateMonitoring?: boolean;
    generateFlows?: boolean;
    generateRateLimiter?: boolean;
}

export interface QueueGeneratedFile {
    path: string;
    content: string;
    description?: string;
    type: 'queue' | 'worker' | 'processor' | 'types' | 'config' | 'scheduler' | 'flow';
}

export interface QueueGenerationResult {
    files: QueueGeneratedFile[];
    dependencies: string[];
    envVariables: string[];
    instructions: string[];
    warnings?: string[];
}

// ============================================
// QUEUE DETECTION UTILITIES
// ============================================

/**
 * Check if a prompt requires queue/background job generation
 */
export function isQueueRelatedPrompt(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();

    const queueKeywords = [
        'queue', 'job', 'worker', 'background',
        'bullmq', 'redis queue', 'message queue',
        'async task', 'scheduled', 'cron job',
        'retry', 'dead letter', 'dlq',
        'rate limit', 'job processing',
        'email queue', 'notification queue',
        'task queue', 'work queue',
    ];

    return queueKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Get queue-related capabilities from prompt
 */
export function extractQueueCapabilities(prompt: string): string[] {
    const lowerPrompt = prompt.toLowerCase();
    const capabilities: string[] = [];

    if (lowerPrompt.includes('bullmq') || lowerPrompt.includes('queue')) {
        capabilities.push('bullmq', 'redis-queues');
    }
    if (lowerPrompt.includes('worker') || lowerPrompt.includes('processor')) {
        capabilities.push('worker-generation', 'async-processing');
    }
    if (lowerPrompt.includes('schedule') || lowerPrompt.includes('cron')) {
        capabilities.push('job-scheduling', 'cron-jobs', 'scheduled-jobs');
    }
    if (lowerPrompt.includes('retry') || lowerPrompt.includes('backoff')) {
        capabilities.push('retry-logic', 'retry-strategies');
    }
    if (lowerPrompt.includes('dead letter') || lowerPrompt.includes('dlq')) {
        capabilities.push('dead-letter-queue');
    }
    if (lowerPrompt.includes('rate limit') || lowerPrompt.includes('throttle')) {
        capabilities.push('rate-limiting');
    }
    if (lowerPrompt.includes('monitor') || lowerPrompt.includes('metric')) {
        capabilities.push('queue-monitoring', 'queue-metrics');
    }
    if (lowerPrompt.includes('flow') || lowerPrompt.includes('pipeline')) {
        capabilities.push('job-flows');
    }

    return [...new Set(capabilities)];
}

// ============================================
// QUEUE SERVICE CLASS
// ============================================

export class QueueAgentService {
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('[QUEUE-SERVICE] Queue Agent Service initialized');
        this.isInitialized = true;
    }

    /**
     * Check if this prompt should use the Queue Agent
     */
    shouldHandle(prompt: string): boolean {
        return isQueueRelatedPrompt(prompt);
    }

    /**
     * Get detected capabilities for a prompt
     */
    getCapabilities(prompt: string): string[] {
        return extractQueueCapabilities(prompt);
    }

    /**
     * Generate queue system files
     * This creates BullMQ-based queue infrastructure
     */
    async generate(request: QueueGenerationRequest): Promise<QueueGenerationResult> {
        const files: QueueGeneratedFile[] = [];
        const dependencies = ['bullmq', 'ioredis'];
        const envVariables = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'];
        const instructions: string[] = [];

        // Determine what to generate based on requirements
        const analysis = this.analyzeRequirements(request.requirements);

        // Generate queue setup
        files.push({
            path: 'src/queue/queue-setup.ts',
            content: this.generateQueueSetup(),
            type: 'config',
            description: 'Redis connection and queue utilities',
        });

        // Generate queue configs
        for (const queueName of analysis.queues) {
            files.push({
                path: `src/queue/queues/${this.toKebabCase(queueName)}.queue.ts`,
                content: this.generateQueueConfig(queueName),
                type: 'queue',
                description: `${queueName} queue configuration`,
            });
        }

        // Generate workers
        if (request.generateWorkers !== false) {
            for (const queueName of analysis.queues) {
                files.push({
                    path: `src/queue/workers/${this.toKebabCase(queueName)}-worker.ts`,
                    content: this.generateWorker(queueName),
                    type: 'worker',
                    description: `Worker for ${queueName} queue`,
                });
            }
        }

        // Generate job types
        files.push({
            path: 'src/queue/types/job-types.ts',
            content: this.generateJobTypes(analysis.queues),
            type: 'types',
            description: 'Type-safe job definitions',
        });

        // Generate DLQ handler
        if (request.generateDLQ !== false) {
            files.push({
                path: 'src/queue/handlers/dead-letter-queue.ts',
                content: this.generateDLQHandler(),
                type: 'processor',
                description: 'Dead letter queue handler',
            });
        }

        // Generate scheduler
        if (request.generateScheduler) {
            files.push({
                path: 'src/queue/scheduler/job-scheduler.ts',
                content: this.generateScheduler(),
                type: 'scheduler',
                description: 'Cron-based job scheduler',
            });
        }

        // Generate monitoring
        if (request.generateMonitoring !== false) {
            files.push({
                path: 'src/queue/monitoring/queue-monitoring.ts',
                content: this.generateMonitoring(),
                type: 'config',
                description: 'Queue health and metrics',
            });
        }

        // Generate index
        files.push({
            path: 'src/queue/index.ts',
            content: this.generateIndex(analysis.queues, request),
            type: 'config',
            description: 'Queue module exports',
        });

        instructions.push('Install dependencies: npm install bullmq ioredis');
        instructions.push('Set Redis environment variables');
        instructions.push('Start workers in production as separate processes');

        return { files, dependencies, envVariables, instructions };
    }

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    private analyzeRequirements(req: string): { queues: string[] } {
        const lowerReq = req.toLowerCase();
        const queues: string[] = [];

        if (/email|notification|alert/.test(lowerReq)) queues.push('notifications');
        if (/file|upload|image|video/.test(lowerReq)) queues.push('file-processing');
        if (/payment|billing|invoice/.test(lowerReq)) queues.push('payments');
        if (/report|pdf|export/.test(lowerReq)) queues.push('documents');
        if (/sync|import|migration/.test(lowerReq)) queues.push('data-sync');
        if (/ai|ml|inference/.test(lowerReq)) queues.push('ai-tasks');

        if (queues.length === 0) queues.push('default');

        return { queues };
    }

    private toKebabCase(str: string): string {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '').replace(/[_\s]+/g, '-');
    }

    private toPascalCase(str: string): string {
        return str.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    }

    private generateQueueSetup(): string {
        return `/**
 * Queue Setup - BullMQ Configuration
 * Generated by Queue Agent Service
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
});

export { connection };

// Queue factory
export function createQueue(name: string, prefix = 'app') {
    return new Queue(name, { connection, prefix });
}

// Worker factory
export function createWorker<T>(
    name: string,
    processor: (job: { data: T }) => Promise<unknown>,
    concurrency = 5
) {
    return new Worker(name, processor, { connection, concurrency });
}

// Queue events factory
export function createQueueEvents(name: string) {
    return new QueueEvents(name, { connection });
}

console.log('[QUEUE] Queue setup ready');
`;
    }

    private generateQueueConfig(name: string): string {
        const pascalName = this.toPascalCase(name);
        return `/**
 * ${pascalName} Queue Configuration
 * Generated by Queue Agent Service
 */

import { createQueue, createQueueEvents } from '../queue-setup.js';

export const ${name.replace(/-/g, '')}Queue = createQueue('${name}');
export const ${name.replace(/-/g, '')}QueueEvents = createQueueEvents('${name}');

// Default job options
export const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
};
`;
    }

    private generateWorker(queueName: string): string {
        const pascalName = this.toPascalCase(queueName);
        return `/**
 * ${pascalName} Worker
 * Generated by Queue Agent Service
 */

import { createWorker } from '../queue-setup.js';
import type { ${pascalName}JobData, ${pascalName}JobResult } from '../types/job-types.js';

export const ${queueName.replace(/-/g, '')}Worker = createWorker<${pascalName}JobData>(
    '${queueName}',
    async (job) => {
        console.log(\`[${queueName.toUpperCase()}] Processing job \${job.data}\`);
        
        // TODO: Implement job processing logic
        const result: ${pascalName}JobResult = {
            success: true,
            processedAt: new Date().toISOString(),
        };
        
        return result;
    },
    5 // concurrency
);

// Error handling
${queueName.replace(/-/g, '')}Worker.on('failed', (job, err) => {
    console.error(\`[${queueName.toUpperCase()}] Job \${job?.id} failed:\`, err.message);
});

${queueName.replace(/-/g, '')}Worker.on('completed', (job) => {
    console.log(\`[${queueName.toUpperCase()}] Job \${job.id} completed\`);
});

console.log('[WORKER] ${pascalName} worker started');
`;
    }

    private generateJobTypes(queues: string[]): string {
        const typeDefinitions = queues.map(q => {
            const pascal = this.toPascalCase(q);
            return `
// ${pascal} Job Types
export interface ${pascal}JobData {
    id: string;
    // Add your job data fields here
    [key: string]: unknown;
}

export interface ${pascal}JobResult {
    success: boolean;
    processedAt: string;
    // Add your result fields here
    [key: string]: unknown;
}`;
        }).join('\n');

        const queueNames = queues.map(q =>
            `    ${q.replace(/-/g, '_').toUpperCase()}: '${q}',`
        ).join('\n');

        return `/**
 * Job Type Definitions
 * Generated by Queue Agent Service
 */
${typeDefinitions}

// Queue Names
export const QUEUE_NAMES = {
${queueNames}
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
`;
    }

    private generateDLQHandler(): string {
        return `/**
 * Dead Letter Queue Handler
 * Generated by Queue Agent Service
 */

import { createQueue, createWorker } from '../queue-setup.js';

export const deadLetterQueue = createQueue('dead-letter-queue');

export const dlqWorker = createWorker(
    'dead-letter-queue',
    async (job) => {
        console.log('[DLQ] Processing failed job:', job.data);
        
        // Log failure details
        const { originalQueue, originalJobId, error, failedAt } = job.data as {
            originalQueue: string;
            originalJobId: string;
            error: string;
            failedAt: string;
        };
        
        console.error(\`[DLQ] Job \${originalJobId} from \${originalQueue} failed at \${failedAt}: \${error}\`);
        
        // TODO: Implement alerting, analytics, or retry logic
        
        return { processed: true };
    },
    1
);

// Helper to send jobs to DLQ
export async function sendToDeadLetterQueue(
    originalQueue: string,
    originalJobId: string,
    error: Error
) {
    await deadLetterQueue.add('failed-job', {
        originalQueue,
        originalJobId,
        error: error.message,
        failedAt: new Date().toISOString(),
    });
}

console.log('[DLQ] Dead letter queue handler ready');
`;
    }

    private generateScheduler(): string {
        return `/**
 * Job Scheduler
 * Generated by Queue Agent Service
 */

import { createQueue } from '../queue-setup.js';

interface ScheduledJob {
    name: string;
    queueName: string;
    pattern: string;
    data?: Record<string, unknown>;
}

const scheduledJobs: ScheduledJob[] = [
    // Add your scheduled jobs here
    // { name: 'daily-cleanup', queueName: 'maintenance', pattern: '0 3 * * *', data: {} },
];

export async function initializeScheduler() {
    console.log('[SCHEDULER] Initializing scheduled jobs...');
    
    for (const job of scheduledJobs) {
        const queue = createQueue(job.queueName);
        
        await queue.upsertJobScheduler(
            job.name,
            { pattern: job.pattern },
            { data: job.data || {} }
        );
        
        console.log(\`[SCHEDULER] Scheduled: \${job.name} with pattern \${job.pattern}\`);
    }
    
    console.log(\`[SCHEDULER] \${scheduledJobs.length} jobs scheduled\`);
}
`;
    }

    private generateMonitoring(): string {
        return `/**
 * Queue Monitoring
 * Generated by Queue Agent Service
 */

import { Queue } from 'bullmq';

export interface QueueMetrics {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

export async function getQueueMetrics(queue: Queue): Promise<QueueMetrics> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
    ]);
    
    return {
        name: queue.name,
        waiting,
        active,
        completed,
        failed,
        delayed,
    };
}

export async function getQueueHealth(queue: Queue): Promise<{
    healthy: boolean;
    message: string;
}> {
    try {
        const metrics = await getQueueMetrics(queue);
        const healthy = metrics.failed < 100; // Adjust threshold as needed
        
        return {
            healthy,
            message: healthy 
                ? \`Queue healthy: \${metrics.active} active, \${metrics.waiting} waiting\`
                : \`Queue unhealthy: \${metrics.failed} failed jobs\`,
        };
    } catch (error) {
        return {
            healthy: false,
            message: \`Health check failed: \${error}\`,
        };
    }
}

console.log('[MONITORING] Queue monitoring ready');
`;
    }

    private generateIndex(queues: string[], options: QueueGenerationRequest): string {
        const queueExports = queues.map(q =>
            `export * from './queues/${this.toKebabCase(q)}.queue.js';`
        ).join('\n');

        const workerExports = options.generateWorkers !== false
            ? queues.map(q => `export * from './workers/${this.toKebabCase(q)}-worker.js';`).join('\n')
            : '';

        return `/**
 * Queue Module Exports
 * Generated by Queue Agent Service
 */

// Setup
export * from './queue-setup.js';

// Types
export * from './types/job-types.js';

// Queues
${queueExports}

// Workers
${workerExports}

// Dead Letter Queue
${options.generateDLQ !== false ? "export * from './handlers/dead-letter-queue.js';" : ''}

// Scheduler
${options.generateScheduler ? "export * from './scheduler/job-scheduler.js';" : ''}

// Monitoring
${options.generateMonitoring !== false ? "export * from './monitoring/queue-monitoring.js';" : ''}
`;
    }

    /**
     * Get service status
     */
    getStatus(): { initialized: boolean; capabilities: number } {
        return {
            initialized: this.isInitialized,
            capabilities: 24,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let instance: QueueAgentService | null = null;

export function getQueueAgentService(): QueueAgentService {
    if (!instance) {
        instance = new QueueAgentService();
    }
    return instance;
}

export default getQueueAgentService;
