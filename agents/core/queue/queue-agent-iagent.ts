/**
 * ============================================
 * QUEUE AGENT - IAgent Implementation
 * ============================================
 * 
 * Wrapper that makes QueueAgent conform to the IAgent interface
 * for seamless integration with Person 1's orchestrator system.
 * 
 * Following the 7-Layer Feature Integration Guide:
 * Layer 1: SERVICE ✓ (queue-agent.ts)
 * Layer 3: INTEGRATION (this file - IAgent wrapper)
 */

import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus,
    AgentTier,
} from '@loveable/shared';

import { QueueAgent, queueAgent } from './queue-agent.js';
import type { QueueGenerationResult, QueueTaskContext } from './types.js';

/**
 * QueueAgentWrapper - Implements IAgent interface
 * This wrapper enables the QueueAgent to be discovered and used
 * by Person 1's agent loader and orchestrator.
 */
export class QueueAgentWrapper implements IAgent {
    // ========================================
    // REQUIRED: Agent Identity
    // ========================================

    readonly id = 'queue-agent';
    readonly name = 'Queue Agent';
    readonly tier: AgentTier = 1; // Core agent

    readonly capabilities = [
        // BullMQ Operations
        'bullmq',
        'bullmq-queues',
        'bullmq-workers',
        'bullmq-processors',

        // Redis Operations
        'redis-queues',
        'redis-connection',

        // Job Management
        'job-scheduling',
        'job-priority',
        'job-types',
        'job-flows',

        // Background Processing
        'background-tasks',
        'async-processing',
        'worker-generation',

        // Retry & Error Handling
        'retry-logic',
        'retry-strategies',
        'dead-letter-queue',
        'error-handling',

        // Rate Limiting
        'rate-limiting',
        'queue-rate-limiting',
        'job-rate-limiting',

        // Scheduling
        'cron-jobs',
        'scheduled-jobs',
        'repeatable-jobs',

        // Monitoring
        'queue-monitoring',
        'queue-metrics',
        'queue-health',
    ];

    readonly description = 'Generates background job processing systems using BullMQ with Redis, including queues, workers, retry logic, scheduling, and monitoring';
    readonly version = '1.0.0';

    // ========================================
    // PRIVATE: Internal state
    // ========================================

    private agent: QueueAgent;
    private isInitialized = false;
    private initializationTime?: Date;
    private lastExecutionTime?: Date;
    private successCount = 0;
    private failureCount = 0;

    constructor() {
        this.agent = queueAgent;
    }

    // ========================================
    // REQUIRED: IAgent Methods
    // ========================================

    /**
     * Initialize the agent
     * Called once when the orchestrator loads the agent
     */
    async initialize(config: AgentConfig): Promise<void> {
        // Inject AI client if provided
        if (config.customSettings?.aiClient) {
            this.agent.setAIClient(config.customSettings.aiClient);
        }

        // Inject metrics service if provided
        if (config.customSettings?.metricsService) {
            this.agent.setMetricsService(config.customSettings.metricsService);
        }

        // Inject cache service if provided
        if (config.customSettings?.cacheService) {
            this.agent.setCacheService(config.customSettings.cacheService);
        }

        this.isInitialized = true;
        this.initializationTime = new Date();
        console.log(`⚙️ [${this.name}] Initialized successfully`);
    }

    /**
     * Execute a queue task
     * This is the main entry point for agent functionality
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();

        if (!this.isInitialized) {
            return {
                success: false,
                error: {
                    code: 'NOT_INITIALIZED',
                    message: 'Queue Agent has not been initialized',
                },
            };
        }

        console.log(`⚙️ [${this.name}] Executing task: ${input.task.substring(0, 100)}...`);

        try {
            // Extract context from input
            const context = input.context as QueueTaskContext | undefined;

            // Determine what to generate based on task
            const generateOptions = this.parseTaskOptions(input.task);

            // Execute queue generation
            const result = await this.agent.generateQueueSystem({
                requirements: input.task,
                ...generateOptions,
            });

            const executionTime = Date.now() - startTime;
            this.successCount++;
            this.lastExecutionTime = new Date();

            // Map to AgentOutput format
            return {
                success: true,
                files: result.files.map(f => ({
                    path: f.path,
                    content: f.content,
                    type: f.type === 'queue' || f.type === 'worker' || f.type === 'processor'
                        ? 'code' as const
                        : f.type === 'config' || f.type === 'types'
                            ? 'config' as const
                            : 'code' as const,
                    language: 'typescript',
                })),
                message: this.generateSuccessMessage(result),
                metadata: {
                    executionTime,
                    dependencies: result.dependencies,
                    envVariables: result.envVariables,
                    instructions: result.instructions,
                    warnings: result.warnings,
                    filesGenerated: result.files.length,
                    agentVersion: this.version,
                },
                suggestedNextAgents: this.suggestNextAgents(input.task),
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.failureCount++;

            console.error(`❌ [${this.name}] Execution failed:`, errorMessage);

            return {
                success: false,
                error: {
                    code: 'QUEUE_GENERATION_ERROR',
                    message: errorMessage,
                    details: error,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                    agentVersion: this.version,
                },
            };
        }
    }

    /**
     * Health check
     * Returns the current health status of the agent
     */
    async healthCheck(): Promise<AgentHealthStatus> {
        const totalExecutions = this.successCount + this.failureCount;
        const successRate = totalExecutions > 0
            ? (this.successCount / totalExecutions * 100).toFixed(1)
            : 'N/A';

        return {
            healthy: this.isInitialized,
            message: this.isInitialized
                ? `Queue Agent is ready (${successRate}% success rate)`
                : 'Queue Agent not initialized',
            lastSuccessfulExecution: this.lastExecutionTime,
            details: {
                version: this.version,
                tier: this.tier,
                capabilities: this.capabilities.length,
                initializedAt: this.initializationTime?.toISOString(),
                successCount: this.successCount,
                failureCount: this.failureCount,
                successRate: `${successRate}%`,
                supportedProviders: ['bullmq', 'redis'],
                features: [
                    'queue-generation',
                    'worker-generation',
                    'job-scheduling',
                    'retry-strategies',
                    'dead-letter-queue',
                    'rate-limiting',
                    'monitoring',
                ],
            },
        };
    }

    /**
     * Shutdown
     * Clean up resources when the server is stopping
     */
    async shutdown(): Promise<void> {
        console.log(`⚙️ [${this.name}] Shutting down...`);

        // Log final statistics
        const totalExecutions = this.successCount + this.failureCount;
        console.log(`   Total executions: ${totalExecutions}`);
        console.log(`   Successes: ${this.successCount}`);
        console.log(`   Failures: ${this.failureCount}`);

        this.isInitialized = false;
        console.log(`✅ [${this.name}] Shutdown complete`);
    }

    // ========================================
    // PRIVATE: Helper Methods
    // ========================================

    /**
     * Parse task string to determine what to generate
     */
    private parseTaskOptions(task: string): {
        generateWorkers: boolean;
        generateScheduler: boolean;
        generateDLQ: boolean;
        generateMonitoring: boolean;
        generateFlows: boolean;
        generateRateLimiter: boolean;
    } {
        const lowerTask = task.toLowerCase();

        return {
            generateWorkers: !lowerTask.includes('no worker') &&
                !lowerTask.includes('skip worker'),
            generateScheduler: lowerTask.includes('schedule') ||
                lowerTask.includes('cron') ||
                lowerTask.includes('recurring') ||
                lowerTask.includes('daily') ||
                lowerTask.includes('hourly'),
            generateDLQ: lowerTask.includes('dead letter') ||
                lowerTask.includes('dlq') ||
                lowerTask.includes('failed job') ||
                !lowerTask.includes('no dlq'),
            generateMonitoring: lowerTask.includes('monitor') ||
                lowerTask.includes('metrics') ||
                lowerTask.includes('health') ||
                !lowerTask.includes('no monitoring'),
            generateFlows: lowerTask.includes('flow') ||
                lowerTask.includes('pipeline') ||
                lowerTask.includes('workflow') ||
                lowerTask.includes('chain'),
            generateRateLimiter: lowerTask.includes('rate limit') ||
                lowerTask.includes('throttle') ||
                lowerTask.includes('limit'),
        };
    }

    /**
     * Generate success message
     */
    private generateSuccessMessage(result: QueueGenerationResult): string {
        const fileCounts: Record<string, number> = {};

        for (const file of result.files) {
            fileCounts[file.type] = (fileCounts[file.type] || 0) + 1;
        }

        const parts = Object.entries(fileCounts).map(
            ([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`
        );

        return `Generated ${result.files.length} files: ${parts.join(', ')}`;
    }

    /**
     * Suggest next agents based on task
     */
    private suggestNextAgents(task: string): string[] {
        const suggestions: string[] = [];
        const lowerTask = task.toLowerCase();

        // If processing emails, suggest email agent
        if (lowerTask.includes('email') || lowerTask.includes('notification')) {
            suggestions.push('email-agent');
        }

        // If processing data, suggest database agent
        if (lowerTask.includes('data') || lowerTask.includes('sync') || lowerTask.includes('import')) {
            suggestions.push('database-agent');
        }

        // If webhook processing, suggest API agent
        if (lowerTask.includes('webhook') || lowerTask.includes('api')) {
            suggestions.push('api-agent');
        }

        // Always suggest test agent and monitoring agent
        suggestions.push('test-agent');
        suggestions.push('monitoring-agent');

        return suggestions;
    }

    // ========================================
    // PUBLIC: Additional Methods
    // ========================================

    /**
     * Get available templates
     */
    getAvailableTemplates(): string[] {
        return this.agent.getAvailableTemplates();
    }

    /**
     * Get the underlying QueueAgent instance
     */
    getAgent(): QueueAgent {
        return this.agent;
    }

    /**
     * Get execution statistics
     */
    getStatistics(): {
        successCount: number;
        failureCount: number;
        successRate: string;
        lastExecution?: Date;
    } {
        const totalExecutions = this.successCount + this.failureCount;
        const successRate = totalExecutions > 0
            ? (this.successCount / totalExecutions * 100).toFixed(1) + '%'
            : 'N/A';

        return {
            successCount: this.successCount,
            failureCount: this.failureCount,
            successRate,
            lastExecution: this.lastExecutionTime,
        };
    }
}

// ========================================
// EXPORTS
// ========================================

// Export singleton instance conforming to IAgent
export const queueAgentIAgent = new QueueAgentWrapper();

// Default export for dynamic loading by agent-loader
export default queueAgentIAgent;
