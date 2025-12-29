/**
 * ============================================
 * QUEUE AGENT - CORE IMPLEMENTATION
 * ============================================
 * 
 * The Queue Agent is responsible for generating background job
 * processing systems using BullMQ, including:
 * - Queue configuration and setup
 * - Worker and processor generation
 * - Retry strategies and dead letter queues
 * - Job scheduling (cron-based)
 * - Rate limiting and flow management
 * - Queue monitoring and metrics
 * 
 * Following the 7-Layer Feature Integration Guide.
 * 
 * @author Person 2 - AI/ML Engineer
 * @version 1.0.0
 */

import {
    QueueAgentConfig,
    QueueConfig,
    QueueProvider,
    JobTypeDefinition,
    WorkerConfig,
    ProcessorDefinition,
    ScheduledJob,
    FlowDefinition,
    DeadLetterQueueConfig,
    RateLimiterConfig,
    QueueGeneratedFile,
    QueueGenerationResult,
    QueueTaskContext,
    JobOptions,
    BackoffConfig,
    FieldSchema,
} from './types.js';

import {
    BULLMQ_QUEUE_CONFIG_TEMPLATE,
    BULLMQ_QUEUE_SETUP_TEMPLATE,
    BULLMQ_WORKER_TEMPLATE,
    WORKER_PROCESSOR_TEMPLATE,
    JOB_TYPES_TEMPLATE,
    RETRY_STRATEGY_TEMPLATE,
    DEAD_LETTER_QUEUE_TEMPLATE,
    JOB_SCHEDULER_TEMPLATE,
    QUEUE_MONITORING_TEMPLATE,
    JOB_FLOW_TEMPLATE,
    RATE_LIMITER_TEMPLATE,
    getAvailableTemplates,
    QUEUE_TEMPLATE_SETS,
} from './templates/index.js';

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Convert string to PascalCase
function toPascalCase(str: string): string {
    return str
        .split(/[-_\s]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

// Convert string to camelCase
function toCamelCase(str: string): string {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Convert string to snake_case
function toSnakeCase(str: string): string {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/[-\s]+/g, '_');
}

// Convert string to kebab-case
function toKebabCase(str: string): string {
    return str
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
        .replace(/[_\s]+/g, '-');
}

// ============================================
// QUEUE AGENT CLASS
// ============================================

export class QueueAgent {
    private config: QueueAgentConfig;
    private aiClient: any = null;
    private metricsService: any = null;
    private cacheService: any = null;

    constructor(config?: Partial<QueueAgentConfig>) {
        this.config = {
            provider: config?.provider || 'bullmq',
            redis: config?.redis || {
                host: 'localhost',
                port: 6379,
            },
            enableMetrics: config?.enableMetrics ?? true,
            enableDeadLetterQueue: config?.enableDeadLetterQueue ?? true,
            enableJobEvents: config?.enableJobEvents ?? true,
            enableScheduling: config?.enableScheduling ?? true,
        };
    }

    // ============================================
    // SERVICE INJECTION
    // ============================================

    // Inject AI client from Person 1's services
    setAIClient(client: any): void {
        this.aiClient = client;
        console.log('🔌 [QueueAgent] AI client connected');
    }

    // Inject metrics service for benchmarking
    setMetricsService(service: any): void {
        this.metricsService = service;
        console.log('📊 [QueueAgent] Metrics service connected');
    }

    // Inject cache service for query caching
    setCacheService(service: any): void {
        this.cacheService = service;
        console.log('🗃️ [QueueAgent] Cache service connected');
    }

    // ============================================
    // REQUIREMENT ANALYSIS
    // ============================================

    // Analyze natural language requirements and generate queue config
    async analyzeRequirements(userRequest: string): Promise<{
        queues: QueueConfig[];
        jobTypes: JobTypeDefinition[];
        workers: WorkerConfig[];
        scheduledJobs: ScheduledJob[];
    }> {
        const queues = this.extractQueuesFromRequest(userRequest);
        const jobTypes = this.extractJobTypesFromRequest(userRequest, queues);
        const workers = this.generateWorkersForQueues(queues);
        const scheduledJobs = this.extractScheduledJobsFromRequest(userRequest, queues);

        return { queues, jobTypes, workers, scheduledJobs };
    }

    // Extract queue definitions from natural language
    private extractQueuesFromRequest(request: string): QueueConfig[] {
        const lowerRequest = request.toLowerCase();
        const queues: QueueConfig[] = [];

        // Standard queue patterns
        const queuePatterns = [
            { pattern: /email|notification|alert/i, name: 'notifications', type: 'notification' },
            { pattern: /upload|file|image|video|media/i, name: 'file-processing', type: 'processing' },
            { pattern: /report|pdf|export|generate/i, name: 'document-generation', type: 'processing' },
            { pattern: /payment|billing|invoice|subscription/i, name: 'payments', type: 'payment' },
            { pattern: /sync|import|migration|data/i, name: 'data-sync', type: 'sync' },
            { pattern: /crawl|scrape|fetch/i, name: 'web-scraping', type: 'scraping' },
            { pattern: /analytics|metric|stats/i, name: 'analytics', type: 'analytics' },
            { pattern: /ai|ml|model|inference|predict/i, name: 'ai-tasks', type: 'ai' },
            { pattern: /webhook|callback|hook/i, name: 'webhooks', type: 'webhook' },
            { pattern: /cleanup|maintenance|archive/i, name: 'maintenance', type: 'maintenance' },
        ];

        // Extract queues based on patterns
        for (const { pattern, name, type } of queuePatterns) {
            if (pattern.test(lowerRequest)) {
                queues.push(this.createQueueConfig(name, type));
            }
        }

        // Add default queue if none found
        if (queues.length === 0) {
            queues.push(this.createQueueConfig('default', 'general'));
        }

        return queues;
    }

    // Create queue configuration
    private createQueueConfig(name: string, type: string): QueueConfig {
        const config: QueueConfig = {
            name,
            prefix: 'loveable',
            defaultJobOptions: this.getDefaultJobOptions(type),
            settings: {
                stalledInterval: 30000,
                maxStalledCount: 3,
            },
        };

        // Add rate limiter for specific queue types
        if (type === 'notification' || type === 'webhook') {
            config.limiter = {
                max: 100,
                duration: 1000,
            };
        } else if (type === 'scraping') {
            config.limiter = {
                max: 10,
                duration: 1000,
            };
        }

        return config;
    }

    // Get default job options based on queue type
    private getDefaultJobOptions(type: string): JobOptions {
        switch (type) {
            case 'notification':
                return {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 1000 },
                    removeOnComplete: 100,
                    removeOnFail: 1000,
                };
            case 'payment':
                return {
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 5000, maxDelay: 60000 },
                    removeOnComplete: false,
                    removeOnFail: false,
                };
            case 'processing':
                return {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 2000 },
                    removeOnComplete: 50,
                    removeOnFail: 500,
                    timeout: 300000, // 5 minutes
                };
            case 'ai':
                return {
                    attempts: 2,
                    backoff: { type: 'fixed', delay: 10000 },
                    removeOnComplete: 20,
                    removeOnFail: 100,
                    timeout: 600000, // 10 minutes
                };
            case 'maintenance':
                return {
                    attempts: 1,
                    removeOnComplete: 10,
                    removeOnFail: 50,
                };
            default:
                return {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 1000 },
                    removeOnComplete: 100,
                    removeOnFail: 500,
                };
        }
    }

    // Extract job type definitions from request
    private extractJobTypesFromRequest(request: string, queues: QueueConfig[]): JobTypeDefinition[] {
        const jobTypes: JobTypeDefinition[] = [];

        for (const queue of queues) {
            const baseJobTypes = this.getDefaultJobTypes(queue.name);
            jobTypes.push(...baseJobTypes);
        }

        return jobTypes;
    }

    // Get default job types for a queue
    private getDefaultJobTypes(queueName: string): JobTypeDefinition[] {
        switch (queueName) {
            case 'notifications':
                return [
                    {
                        name: 'send-email',
                        dataSchema: {
                            to: { type: 'string', required: true },
                            subject: { type: 'string', required: true },
                            body: { type: 'string', required: true },
                            templateId: { type: 'string', required: false },
                        },
                        description: 'Send email notification',
                    },
                    {
                        name: 'send-push',
                        dataSchema: {
                            userId: { type: 'string', required: true },
                            title: { type: 'string', required: true },
                            message: { type: 'string', required: true },
                        },
                        description: 'Send push notification',
                    },
                    {
                        name: 'send-sms',
                        dataSchema: {
                            phoneNumber: { type: 'string', required: true },
                            message: { type: 'string', required: true },
                        },
                        description: 'Send SMS notification',
                    },
                ];
            case 'file-processing':
                return [
                    {
                        name: 'process-upload',
                        dataSchema: {
                            fileId: { type: 'string', required: true },
                            filePath: { type: 'string', required: true },
                            mimeType: { type: 'string', required: true },
                            userId: { type: 'string', required: false },
                        },
                        description: 'Process uploaded file',
                    },
                    {
                        name: 'generate-thumbnail',
                        dataSchema: {
                            fileId: { type: 'string', required: true },
                            filePath: { type: 'string', required: true },
                            sizes: { type: 'array', required: false },
                        },
                        description: 'Generate image thumbnails',
                    },
                ];
            case 'payments':
                return [
                    {
                        name: 'process-payment',
                        dataSchema: {
                            orderId: { type: 'string', required: true },
                            amount: { type: 'number', required: true },
                            currency: { type: 'string', required: true },
                            customerId: { type: 'string', required: true },
                        },
                        description: 'Process payment transaction',
                    },
                    {
                        name: 'send-invoice',
                        dataSchema: {
                            orderId: { type: 'string', required: true },
                            customerId: { type: 'string', required: true },
                        },
                        description: 'Generate and send invoice',
                    },
                ];
            case 'data-sync':
                return [
                    {
                        name: 'sync-data',
                        dataSchema: {
                            source: { type: 'string', required: true },
                            target: { type: 'string', required: true },
                            lastSyncAt: { type: 'date', required: false },
                        },
                        description: 'Sync data between systems',
                    },
                ];
            case 'ai-tasks':
                return [
                    {
                        name: 'run-inference',
                        dataSchema: {
                            modelId: { type: 'string', required: true },
                            input: { type: 'object', required: true },
                            options: { type: 'object', required: false },
                        },
                        description: 'Run AI model inference',
                    },
                ];
            default:
                return [
                    {
                        name: 'process-job',
                        dataSchema: {
                            data: { type: 'object', required: true },
                        },
                        description: 'Generic job processing',
                    },
                ];
        }
    }

    // Generate worker configurations for queues
    private generateWorkersForQueues(queues: QueueConfig[]): WorkerConfig[] {
        return queues.map(queue => ({
            name: `${queue.name}-worker`,
            queueName: queue.name,
            concurrency: this.getDefaultConcurrency(queue.name),
            limiter: queue.limiter,
            lockDuration: 30000,
            stalledInterval: 30000,
            autorun: true,
        }));
    }

    // Get default concurrency based on queue type
    private getDefaultConcurrency(queueName: string): number {
        switch (queueName) {
            case 'notifications':
                return 10;
            case 'file-processing':
                return 3;
            case 'payments':
                return 5;
            case 'ai-tasks':
                return 2;
            default:
                return 5;
        }
    }

    // Extract scheduled jobs from request
    private extractScheduledJobsFromRequest(request: string, queues: QueueConfig[]): ScheduledJob[] {
        const scheduledJobs: ScheduledJob[] = [];
        const lowerRequest = request.toLowerCase();

        // Check for scheduling patterns
        if (/daily|every day/i.test(lowerRequest)) {
            scheduledJobs.push({
                name: 'daily-task',
                queueName: queues[0]?.name || 'default',
                pattern: '0 0 * * *',
                description: 'Daily scheduled task',
            });
        }

        if (/hourly|every hour/i.test(lowerRequest)) {
            scheduledJobs.push({
                name: 'hourly-task',
                queueName: queues[0]?.name || 'default',
                pattern: '0 * * * *',
                description: 'Hourly scheduled task',
            });
        }

        if (/cleanup|maintenance/i.test(lowerRequest)) {
            scheduledJobs.push({
                name: 'cleanup-task',
                queueName: 'maintenance',
                pattern: '0 3 * * *', // 3 AM daily
                description: 'Daily cleanup and maintenance',
            });
        }

        return scheduledJobs;
    }

    // ============================================
    // CODE GENERATION - QUEUE CONFIG
    // ============================================

    // Generate queue configuration file
    generateQueueConfig(queue: QueueConfig): string {
        let content = BULLMQ_QUEUE_CONFIG_TEMPLATE;

        // Replace placeholders
        content = content.replace(/{{QUEUE_NAME}}/g, queue.name);
        content = content.replace(/{{QUEUE_NAME_CAMEL}}/g, toCamelCase(queue.name));
        content = content.replace(/{{MAX_ATTEMPTS}}/g, String(queue.defaultJobOptions?.attempts || 3));
        content = content.replace(/{{BACKOFF_TYPE}}/g, queue.defaultJobOptions?.backoff?.type || 'exponential');
        content = content.replace(/{{BACKOFF_DELAY}}/g, String(queue.defaultJobOptions?.backoff?.delay || 1000));
        content = content.replace(/{{REMOVE_ON_COMPLETE}}/g, String(queue.defaultJobOptions?.removeOnComplete ?? 100));
        content = content.replace(/{{REMOVE_ON_FAIL}}/g, String(queue.defaultJobOptions?.removeOnFail ?? 500));

        return content;
    }

    // Generate queue setup file
    generateQueueSetup(): string {
        return BULLMQ_QUEUE_SETUP_TEMPLATE;
    }

    // ============================================
    // CODE GENERATION - WORKERS
    // ============================================

    // Generate worker file
    generateWorker(worker: WorkerConfig, jobTypes: JobTypeDefinition[]): string {
        let content = BULLMQ_WORKER_TEMPLATE;

        const primaryJobType = jobTypes.find(jt => jt.name.includes(worker.queueName)) || jobTypes[0];
        const jobTypeName = primaryJobType ? toPascalCase(primaryJobType.name) : 'Generic';

        // Generate data fields from schema
        const dataFields = primaryJobType?.dataSchema
            ? Object.entries(primaryJobType.dataSchema)
                .map(([key, schema]) => `${key}: ${this.mapSchemaTypeToTS(schema)};`)
                .join('\n    ')
            : 'data: unknown;';

        const dataDestructure = primaryJobType?.dataSchema
            ? Object.keys(primaryJobType.dataSchema).join(', ')
            : 'data';

        // Replace placeholders
        content = content.replace(/{{WORKER_NAME}}/g, toPascalCase(worker.name));
        content = content.replace(/{{WORKER_NAME_CAMEL}}/g, toCamelCase(worker.name));
        content = content.replace(/{{QUEUE_NAME}}/g, worker.queueName);
        content = content.replace(/{{JOB_TYPE_NAME}}/g, jobTypeName);
        content = content.replace(/{{JOB_DATA_FIELDS}}/g, dataFields);
        content = content.replace(/{{JOB_DATA_DESTRUCTURE}}/g, dataDestructure);
        content = content.replace(/{{CONCURRENCY}}/g, String(worker.concurrency || 5));
        content = content.replace(/{{RATE_LIMIT_MAX}}/g, String(worker.limiter?.max || 100));
        content = content.replace(/{{RATE_LIMIT_DURATION}}/g, String(worker.limiter?.duration || 1000));

        return content;
    }

    // Map schema type to TypeScript type
    private mapSchemaTypeToTS(schema: FieldSchema): string {
        const baseType = (() => {
            switch (schema.type) {
                case 'string': return 'string';
                case 'number': return 'number';
                case 'boolean': return 'boolean';
                case 'object': return 'Record<string, unknown>';
                case 'array': return 'unknown[]';
                case 'date': return 'Date | string';
                default: return 'unknown';
            }
        })();

        return schema.required ? baseType : `${baseType} | undefined`;
    }

    // ============================================
    // CODE GENERATION - JOB TYPES
    // ============================================

    // Generate job types file
    generateJobTypes(queues: QueueConfig[], jobTypes: JobTypeDefinition[]): string {
        let content = JOB_TYPES_TEMPLATE;

        // Generate job type definitions
        const jobTypeDefinitions = jobTypes.map(jt => {
            const typeName = toPascalCase(jt.name);
            const fields = Object.entries(jt.dataSchema || {})
                .map(([key, schema]) => `    ${key}${schema.required ? '' : '?'}: ${this.mapSchemaTypeToTS(schema)};`)
                .join('\n');

            return `// ${jt.description || jt.name}
export interface ${typeName}JobData extends BaseJobData {
${fields}
}

export interface ${typeName}JobResult extends BaseJobResult {
    // Add specific result fields here
}`;
        }).join('\n\n');

        // Generate job names
        const jobNames = jobTypes
            .map(jt => `    ${toSnakeCase(jt.name).toUpperCase()}: '${jt.name}',`)
            .join('\n');

        // Generate queue names
        const queueNames = queues
            .map(q => `    ${toSnakeCase(q.name).toUpperCase()}: '${q.name}',`)
            .join('\n');

        content = content.replace(/{{JOB_TYPE_DEFINITIONS}}/g, jobTypeDefinitions);
        content = content.replace(/{{JOB_NAMES}}/g, jobNames);
        content = content.replace(/{{QUEUE_NAMES}}/g, queueNames);

        return content;
    }

    // ============================================
    // CODE GENERATION - RETRY STRATEGY
    // ============================================

    // Generate retry strategy file
    generateRetryStrategy(): string {
        return RETRY_STRATEGY_TEMPLATE;
    }

    // ============================================
    // CODE GENERATION - DEAD LETTER QUEUE
    // ============================================

    // Generate dead letter queue handler
    generateDeadLetterQueue(dlqConfig?: DeadLetterQueueConfig): string {
        let content = DEAD_LETTER_QUEUE_TEMPLATE;

        const dlqName = dlqConfig?.queueName || 'dead-letter-queue';
        content = content.replace(/{{DLQ_NAME}}/g, dlqName);

        return content;
    }

    // ============================================
    // CODE GENERATION - SCHEDULER
    // ============================================

    // Generate job scheduler
    generateScheduler(scheduledJobs: ScheduledJob[]): string {
        let content = JOB_SCHEDULER_TEMPLATE;

        const scheduledJobsCode = scheduledJobs.map(job => `    {
        name: '${job.name}',
        queueName: '${job.queueName}',
        pattern: '${job.pattern}',
        tz: '${job.tz || 'UTC'}',
        description: '${job.description || job.name}',
    },`).join('\n');

        content = content.replace(/{{SCHEDULED_JOBS}}/g, scheduledJobsCode);

        return content;
    }

    // ============================================
    // CODE GENERATION - MONITORING
    // ============================================

    // Generate queue monitoring file
    generateMonitoring(): string {
        return QUEUE_MONITORING_TEMPLATE;
    }

    // ============================================
    // CODE GENERATION - FLOWS
    // ============================================

    // Generate flow definitions
    generateFlows(flows?: FlowDefinition[]): string {
        let content = JOB_FLOW_TEMPLATE;

        const flowDefinitions = flows?.map(flow => {
            const flowName = toPascalCase(flow.name);
            return `/**
 * ${flow.name} Flow
 */
export const ${toCamelCase(flow.name)}Flow: FlowDefinition = {
    name: '${flow.name}',
    queueName: '${flow.queueName}',
    data: ${JSON.stringify(flow.data, null, 4)},
    children: ${flow.children ? JSON.stringify(flow.children, null, 4) : '[]'},
};`;
        }).join('\n\n') || '// No flows defined';

        content = content.replace(/{{FLOW_DEFINITIONS}}/g, flowDefinitions);

        return content;
    }

    // ============================================
    // CODE GENERATION - RATE LIMITER
    // ============================================

    // Generate rate limiter file
    generateRateLimiter(): string {
        return RATE_LIMITER_TEMPLATE;
    }

    // ============================================
    // MAIN GENERATION METHOD
    // ============================================

    // Generate complete queue system
    async generateQueueSystem(options: {
        requirements: string;
        generateWorkers?: boolean;
        generateScheduler?: boolean;
        generateDLQ?: boolean;
        generateMonitoring?: boolean;
        generateFlows?: boolean;
        generateRateLimiter?: boolean;
        templateSet?: keyof typeof QUEUE_TEMPLATE_SETS;
    }): Promise<QueueGenerationResult> {
        const files: QueueGeneratedFile[] = [];
        const dependencies: string[] = ['bullmq', 'ioredis'];
        const envVariables: string[] = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'];
        const instructions: string[] = [];
        const warnings: string[] = [];

        // Analyze requirements
        const { queues, jobTypes, workers, scheduledJobs } = await this.analyzeRequirements(options.requirements);

        // Generate base path
        const basePath = 'src/queue';

        // 1. Generate queue setup
        files.push({
            path: `${basePath}/queue-setup.ts`,
            content: this.generateQueueSetup(),
            description: 'Queue connection and setup utilities',
            type: 'config',
        });
        instructions.push('Set REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD environment variables');

        // 2. Generate queue configs for each queue
        for (const queue of queues) {
            files.push({
                path: `${basePath}/queues/${toKebabCase(queue.name)}.queue.ts`,
                content: this.generateQueueConfig(queue),
                description: `${queue.name} queue configuration`,
                type: 'queue',
            });
        }

        // 3. Generate job types
        files.push({
            path: `${basePath}/types/job-types.ts`,
            content: this.generateJobTypes(queues, jobTypes),
            description: 'Type-safe job definitions',
            type: 'types',
        });

        // 4. Generate workers
        if (options.generateWorkers !== false) {
            for (const worker of workers) {
                const relatedJobTypes = jobTypes.filter(jt =>
                    jt.name.includes(worker.queueName) ||
                    worker.queueName.includes(jt.name.split('-')[0])
                );
                files.push({
                    path: `${basePath}/workers/${toKebabCase(worker.name)}.ts`,
                    content: this.generateWorker(worker, relatedJobTypes.length > 0 ? relatedJobTypes : jobTypes),
                    description: `${worker.name} worker implementation`,
                    type: 'worker',
                });
            }
        }

        // 5. Generate retry strategy
        files.push({
            path: `${basePath}/utils/retry-strategy.ts`,
            content: this.generateRetryStrategy(),
            description: 'Retry strategy utilities',
            type: 'config',
        });

        // 6. Generate dead letter queue handler
        if (options.generateDLQ !== false && this.config.enableDeadLetterQueue) {
            files.push({
                path: `${basePath}/handlers/dead-letter-queue.ts`,
                content: this.generateDeadLetterQueue(),
                description: 'Dead letter queue handler',
                type: 'processor',
            });
        }

        // 7. Generate scheduler
        if (options.generateScheduler !== false && scheduledJobs.length > 0) {
            files.push({
                path: `${basePath}/scheduler/job-scheduler.ts`,
                content: this.generateScheduler(scheduledJobs),
                description: 'Cron-based job scheduler',
                type: 'scheduler',
            });
        }

        // 8. Generate monitoring
        if (options.generateMonitoring !== false && this.config.enableMetrics) {
            files.push({
                path: `${basePath}/monitoring/queue-monitoring.ts`,
                content: this.generateMonitoring(),
                description: 'Queue monitoring and metrics',
                type: 'config',
            });
        }

        // 9. Generate flows
        if (options.generateFlows) {
            files.push({
                path: `${basePath}/flows/job-flows.ts`,
                content: this.generateFlows(),
                description: 'Job flow definitions',
                type: 'flow',
            });
        }

        // 10. Generate rate limiter
        if (options.generateRateLimiter) {
            files.push({
                path: `${basePath}/utils/rate-limiter.ts`,
                content: this.generateRateLimiter(),
                description: 'Rate limiting utilities',
                type: 'config',
            });
        }

        // 11. Generate index file
        const indexContent = this.generateIndexFile(queues, workers, options);
        files.push({
            path: `${basePath}/index.ts`,
            content: indexContent,
            description: 'Queue module exports',
            type: 'config',
        });

        // Add instructions
        instructions.push('Install dependencies: npm install bullmq ioredis');
        instructions.push('Ensure Redis server is running');
        instructions.push('Import queue setup in your application entry point');
        instructions.push('Start workers in a separate process or thread for production');

        return {
            files,
            dependencies,
            envVariables,
            instructions,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }

    // Generate index file
    private generateIndexFile(
        queues: QueueConfig[],
        workers: WorkerConfig[],
        options: any
    ): string {
        const queueExports = queues.map(q =>
            `export { ${toCamelCase(q.name)}Queue } from './queues/${toKebabCase(q.name)}.queue.js';`
        ).join('\n');

        const workerExports = workers.map(w =>
            `export { ${toCamelCase(w.name)}Worker, default as ${toCamelCase(w.name)}WorkerDefault } from './workers/${toKebabCase(w.name)}.js';`
        ).join('\n');

        return `/**
 * Queue Module Exports
 * Generated by Queue Agent
 */

// Setup
export * from './queue-setup.js';

// Types
export * from './types/job-types.js';

// Queues
${queueExports}

// Workers
${workerExports}

// Utilities
export * from './utils/retry-strategy.js';
${options.generateRateLimiter ? "export * from './utils/rate-limiter.js';" : ''}

// Handlers
${options.generateDLQ !== false ? "export * from './handlers/dead-letter-queue.js';" : ''}

// Monitoring
${options.generateMonitoring !== false ? "export * from './monitoring/queue-monitoring.js';" : ''}

// Scheduler
${options.generateScheduler !== false ? "export * from './scheduler/job-scheduler.js';" : ''}

// Flows
${options.generateFlows ? "export * from './flows/job-flows.js';" : ''}
`;
    }

    // ============================================
    // TEMPLATE ACCESS
    // ============================================

    // Get available templates
    getAvailableTemplates(): string[] {
        return getAvailableTemplates();
    }

    // Get all template sets
    getTemplateSets(): typeof QUEUE_TEMPLATE_SETS {
        return QUEUE_TEMPLATE_SETS;
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const queueAgent = new QueueAgent();

// Default export
export default queueAgent;
