/**
 * Monitoring Agent - IAgent Implementation
 * Wrapper that makes MonitoringAgent conform to the IAgent interface
 */

import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus
} from '@loveable/shared';
import { MonitoringAgent, MonitoringConfig } from './monitoring-agent.js';

/**
 * MonitoringAgentWrapper - Implements IAgent interface
 */
export class MonitoringAgentWrapper implements IAgent {
    readonly id = 'monitoring-agent';
    readonly name = 'Monitoring Agent';
    readonly tier = 3 as const;
    readonly capabilities = [
        'datadog-apm',
        'newrelic-apm',
        'elastic-apm',
        'sentry',
        'rollbar',
        'winston-logging',
        'pino-logging',
        'prometheus-metrics',
        'health-checks',
        'distributed-tracing',
        'opentelemetry',
        'alerting',
        'audit-logging',
    ];
    readonly description = 'Generates monitoring, logging, and observability infrastructure';
    readonly version = '1.0.0';

    private agent: MonitoringAgent;
    private isInitialized = false;

    constructor() {
        this.agent = new MonitoringAgent();
    }

    /**
     * Initialize the agent
     */
    async initialize(_config: AgentConfig): Promise<void> {
        console.log(`📊 [${this.name}] Initializing...`);
        this.isInitialized = true;
        console.log(`✅ [${this.name}] Initialized`);
    }

    /**
     * Execute monitoring task
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();

        console.log(`📊 [${this.name}] Executing task: ${input.task.substring(0, 50)}...`);

        try {
            // Default monitoring config using correct interface
            const config: MonitoringConfig = {
                apmProvider: 'datadog',
                errorTracking: 'sentry',
                logging: 'pino',
                tracing: true,
                metrics: {
                    enabled: true,
                    provider: 'prometheus',
                    collectDefaultMetrics: true,
                },
                healthChecks: {
                    enabled: true,
                    endpoints: {
                        health: '/health',
                        ready: '/ready',
                        live: '/live',
                    },
                    dependencies: [],
                },
                alerting: {
                    enabled: true,
                    channels: [],
                    thresholds: [],
                },
                auditLogging: {
                    enabled: true,
                    storage: 'database',
                    retention: 90,
                    events: ['auth', 'data', 'admin'],
                },
            };

            // Generate monitoring system
            const result = await this.agent.generateMonitoringSystem(config);

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                files: result.files.map(f => ({
                    path: f.path,
                    content: f.content,
                    type: 'code' as const,
                    language: 'typescript',
                })),
                message: `Generated ${result.files.length} monitoring files`,
                metadata: {
                    executionTime,
                    dependencies: result.dependencies,
                    envVariables: result.envVariables,
                    setupInstructions: result.setupInstructions,
                },
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'MONITORING_GENERATION_ERROR',
                    message: errorMessage,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                },
            };
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<AgentHealthStatus> {
        return {
            healthy: this.isInitialized,
            message: this.isInitialized ? 'Monitoring agent is ready' : 'Agent not initialized',
        };
    }

    /**
     * Shutdown
     */
    async shutdown(): Promise<void> {
        console.log(`📊 [${this.name}] Shutting down...`);
        this.isInitialized = false;
    }
}

// Export singleton instance conforming to IAgent
export const monitoringAgentIAgent = new MonitoringAgentWrapper();

// Default export for dynamic loading
export default monitoringAgentIAgent;
