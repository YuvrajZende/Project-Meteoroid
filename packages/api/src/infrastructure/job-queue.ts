/**
 * Job Queue
 * BullMQ-based async job queue for code generation tasks
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Job data for generation tasks
 */
export interface GenerationJobData {
    taskId: string;
    userId: string;
    projectId?: string;
    prompt: string;
    priority: number;
    config?: Record<string, unknown>;
}

/**
 * Job progress data
 */
export interface JobProgress {
    taskId: string;
    stage: string;
    progress: number;
    message?: string;
    agentId?: string;
}

/**
 * Job result data
 */
export interface JobResult {
    taskId: string;
    success: boolean;
    files?: Array<{
        path: string;
        content: string;
        type: string;
    }>;
    agentsUsed: string[];
    error?: string;
    executionTime: number;
}

/**
 * Queue configuration
 */
export interface JobQueueConfig {
    redisUrl?: string;
    queueName?: string;
    maxConcurrency?: number;
    maxRetries?: number;
    retryDelay?: number;
    jobTimeout?: number;
}

/**
 * JobQueue - Manages async code generation jobs
 */
export class JobQueue extends EventEmitter {
    private queue: Queue<GenerationJobData>;
    private worker: Worker<GenerationJobData, JobResult> | null = null;
    private events: QueueEvents;
    private redis: Redis;
    private config: Required<JobQueueConfig>;

    constructor(config: JobQueueConfig = {}) {
        super();

        this.config = {
            redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
            queueName: config.queueName || 'generation-queue',
            maxConcurrency: config.maxConcurrency || 5,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 5000,
            jobTimeout: config.jobTimeout || 300000, // 5 minutes
        };

        // Initialize Redis connection
        this.redis = new Redis(this.config.redisUrl, {
            maxRetriesPerRequest: null,
        });

        // Initialize queue
        this.queue = new Queue<GenerationJobData>(this.config.queueName, {
            connection: this.redis,
            defaultJobOptions: {
                attempts: this.config.maxRetries,
                backoff: {
                    type: 'exponential',
                    delay: this.config.retryDelay,
                },
                removeOnComplete: {
                    age: 86400, // 24 hours
                    count: 1000,
                },
                removeOnFail: {
                    age: 604800, // 7 days
                },
            },
        });

        // Initialize queue events
        this.events = new QueueEvents(this.config.queueName, {
            connection: this.redis,
        });

        this.setupEventListeners();

        console.log(`📦 Job Queue initialized: ${this.config.queueName}`);
    }

    /**
     * Setup queue event listeners
     */
    private setupEventListeners(): void {
        this.events.on('completed', ({ jobId, returnvalue }) => {
            this.emit('completed', { jobId, result: returnvalue });
        });

        this.events.on('failed', ({ jobId, failedReason }) => {
            this.emit('failed', { jobId, reason: failedReason });
        });

        this.events.on('progress', ({ jobId, data }) => {
            this.emit('progress', { jobId, progress: data });
        });

        this.events.on('stalled', ({ jobId }) => {
            console.warn(`⚠️ Job ${jobId} stalled`);
            this.emit('stalled', { jobId });
        });
    }

    /**
     * Add a generation job to the queue
     */
    async addJob(data: GenerationJobData): Promise<Job<GenerationJobData>> {
        // Calculate priority (1-10, higher = more important)
        // BullMQ uses higher number = lower priority, so we invert
        const priority = Math.max(1, 11 - (data.priority || 5));

        const job = await this.queue.add('generate', data, {
            priority,
            jobId: data.taskId, // Use taskId as jobId for easy lookup
        });

        console.log(`📥 Job added: ${job.id} (priority: ${data.priority})`);

        return job;
    }

    /**
     * Get a job by ID
     */
    async getJob(jobId: string): Promise<Job<GenerationJobData> | undefined> {
        return this.queue.getJob(jobId);
    }

    /**
     * Get job state
     */
    async getJobState(jobId: string): Promise<string | null> {
        const job = await this.queue.getJob(jobId);
        if (!job) return null;
        return job.getState();
    }

    /**
     * Cancel a job
     */
    async cancelJob(jobId: string): Promise<boolean> {
        const job = await this.queue.getJob(jobId);
        if (!job) return false;

        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed') {
            await job.remove();
            return true;
        }

        return false;
    }

    /**
     * Start the worker
     */
    startWorker(
        processor: (job: Job<GenerationJobData>) => Promise<JobResult>
    ): void {
        if (this.worker) {
            console.warn('Worker already running');
            return;
        }

        this.worker = new Worker<GenerationJobData, JobResult>(
            this.config.queueName,
            processor,
            {
                connection: this.redis,
                concurrency: this.config.maxConcurrency,
            }
        );

        this.worker.on('completed', (job, result) => {
            console.log(`✅ Job ${job.id} completed in ${result.executionTime}ms`);
        });

        this.worker.on('failed', (job, error) => {
            console.error(`❌ Job ${job?.id} failed:`, error.message);
        });

        this.worker.on('progress', (job, progress) => {
            console.log(`📊 Job ${job.id} progress:`, progress);
        });

        console.log(`👷 Worker started (concurrency: ${this.config.maxConcurrency})`);
    }

    /**
     * Stop the worker
     */
    async stopWorker(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
            console.log('👷 Worker stopped');
        }
    }

    /**
     * Get queue statistics
     */
    async getStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: boolean;
    }> {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount(),
        ]);

        const isPaused = await this.queue.isPaused();

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused: isPaused,
        };
    }

    /**
     * Pause the queue
     */
    async pause(): Promise<void> {
        await this.queue.pause();
        console.log('⏸️ Queue paused');
    }

    /**
     * Resume the queue
     */
    async resume(): Promise<void> {
        await this.queue.resume();
        console.log('▶️ Queue resumed');
    }

    /**
     * Drain the queue (remove all waiting jobs)
     */
    async drain(): Promise<void> {
        await this.queue.drain();
        console.log('🚿 Queue drained');
    }

    /**
     * Clean old jobs
     */
    async clean(gracePeriodMs: number, status: 'completed' | 'failed'): Promise<void> {
        await this.queue.clean(gracePeriodMs, 100, status);
        console.log(`🧹 Cleaned ${status} jobs older than ${gracePeriodMs}ms`);
    }

    /**
     * Publish progress update to Redis for SSE streaming
     */
    async publishProgress(taskId: string, progress: JobProgress): Promise<void> {
        await this.redis.publish(
            `task:${taskId}:progress`,
            JSON.stringify(progress)
        );
    }

    /**
     * Subscribe to progress updates for a task
     */
    subscribeToProgress(
        taskId: string,
        callback: (progress: JobProgress) => void
    ): () => void {
        const subscriber = this.redis.duplicate();
        const channel = `task:${taskId}:progress`;

        subscriber.subscribe(channel);
        subscriber.on('message', (_channel, message) => {
            try {
                const progress = JSON.parse(message) as JobProgress;
                callback(progress);
            } catch (error) {
                console.error('Failed to parse progress message:', error);
            }
        });

        // Return unsubscribe function
        return () => {
            subscriber.unsubscribe(channel);
            subscriber.quit();
        };
    }

    /**
     * Close all connections
     */
    async close(): Promise<void> {
        await this.stopWorker();
        await this.events.close();
        await this.queue.close();
        await this.redis.quit();
        console.log('📦 Job Queue closed');
    }
}

// Singleton instance
let jobQueueInstance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
    if (!jobQueueInstance) {
        jobQueueInstance = new JobQueue();
    }
    return jobQueueInstance;
}

export function createJobQueue(config?: JobQueueConfig): JobQueue {
    jobQueueInstance = new JobQueue(config);
    return jobQueueInstance;
}
