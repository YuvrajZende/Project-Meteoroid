/**
 * Benchmark Routes
 * API endpoints for agent and orchestrator benchmarking
 */

import type { FastifyInstance } from 'fastify';
import { getBenchmarkingService } from '../services/benchmarking.js';
import type { BenchmarkScenario } from '../services/benchmarking.js';

/**
 * Register benchmark routes
 */
export async function registerBenchmarkRoutes(app: FastifyInstance): Promise<void> {
    const benchmarking = getBenchmarkingService();

    // ============================================
    // GET /api/v1/benchmarks - Get all benchmarks summary
    // ============================================
    app.get('/api/v1/benchmarks', {
        schema: {
            tags: ['Benchmarks'],
            summary: 'Get benchmarks summary',
            description: 'Returns aggregated metrics for all agents and orchestrator',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        agents: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    agentId: { type: 'string' },
                                    agentName: { type: 'string' },
                                    totalExecutions: { type: 'number' },
                                    successRate: { type: 'number' },
                                    avgExecutionTime: { type: 'number' },
                                    avgTokenUsage: { type: 'number' },
                                    avgCodeQuality: { type: 'number' },
                                },
                            },
                        },
                        orchestrator: {
                            type: 'object',
                            properties: {
                                totalOrchestrations: { type: 'number' },
                                avgThinkingTime: { type: 'number' },
                                avgCoordinationTime: { type: 'number' },
                                contextUtilization: { type: 'number' },
                                agentSelectionAccuracy: { type: 'number' },
                            },
                        },
                    },
                },
            },
        },
    }, async () => {
        const agentMetrics = benchmarking.getAllAgentMetrics();
        const orchestratorMetrics = benchmarking.getOrchestratorMetrics();

        return {
            agents: agentMetrics,
            orchestrator: orchestratorMetrics || {
                totalOrchestrations: 0,
                avgThinkingTime: 0,
                avgCoordinationTime: 0,
                contextUtilization: 0,
                agentSelectionAccuracy: 0,
                interAgentHandoffs: 0,
                avgAgentsPerTask: 0,
            },
        };
    });

    // ============================================
    // GET /api/v1/benchmarks/agents/:agentId - Get agent-specific metrics
    // ============================================
    app.get<{
        Params: { agentId: string };
    }>('/api/v1/benchmarks/agents/:agentId', {
        schema: {
            tags: ['Benchmarks'],
            summary: 'Get agent metrics',
            description: 'Returns detailed metrics for a specific agent',
            params: {
                type: 'object',
                properties: {
                    agentId: { type: 'string', description: 'Agent ID' },
                },
                required: ['agentId'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        agentId: { type: 'string' },
                        agentName: { type: 'string' },
                        totalExecutions: { type: 'number' },
                        successfulExecutions: { type: 'number' },
                        failedExecutions: { type: 'number' },
                        successRate: { type: 'number' },
                        avgExecutionTime: { type: 'number' },
                        avgTokenUsage: { type: 'number' },
                        totalTokens: { type: 'number' },
                        avgCodeQuality: { type: 'number' },
                        lastExecution: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { agentId } = request.params;
        const metrics = benchmarking.getAgentMetrics(agentId);

        if (!metrics) {
            return reply.code(404).send({
                error: 'Not Found',
                message: `No benchmark data found for agent: ${agentId}`,
            });
        }

        return metrics;
    });

    // ============================================
    // GET /api/v1/benchmarks/orchestrator - Get orchestrator metrics
    // ============================================
    app.get('/api/v1/benchmarks/orchestrator', {
        schema: {
            tags: ['Benchmarks'],
            summary: 'Get orchestrator metrics',
            description: 'Returns aggregated metrics for the orchestrator',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        totalOrchestrations: { type: 'number' },
                        avgThinkingTime: { type: 'number' },
                        avgCoordinationTime: { type: 'number' },
                        contextUtilization: { type: 'number' },
                        agentSelectionAccuracy: { type: 'number' },
                        interAgentHandoffs: { type: 'number' },
                        avgAgentsPerTask: { type: 'number' },
                    },
                },
            },
        },
    }, async () => {
        const metrics = benchmarking.getOrchestratorMetrics();

        return metrics || {
            totalOrchestrations: 0,
            avgThinkingTime: 0,
            avgCoordinationTime: 0,
            contextUtilization: 0,
            agentSelectionAccuracy: 0,
            interAgentHandoffs: 0,
            avgAgentsPerTask: 0,
        };
    });

    // ============================================
    // POST /api/v1/benchmarks/run - Run benchmark suite
    // ============================================
    app.post<{
        Body: {
            scenarios?: BenchmarkScenario[];
            useDefaults?: boolean;
        };
    }>('/api/v1/benchmarks/run', {
        schema: {
            tags: ['Benchmarks'],
            summary: 'Run benchmark suite',
            description: 'Runs a suite of benchmark scenarios and returns results',
            body: {
                type: 'object',
                properties: {
                    scenarios: {
                        type: 'array',
                        description: 'Custom benchmark scenarios to run',
                    },
                    useDefaults: {
                        type: 'boolean',
                        description: 'Use default benchmark scenarios',
                        default: true,
                    },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        timestamp: { type: 'string' },
                        passRate: { type: 'number' },
                        totalIssues: { type: 'number' },
                        avgExecutionTime: { type: 'number' },
                        avgCodeQuality: { type: 'number' },
                        scenarios: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    passed: { type: 'boolean' },
                                    executionTime: { type: 'number' },
                                    agentsUsed: { type: 'array', items: { type: 'string' } },
                                    filesGenerated: { type: 'number' },
                                    codeQualityScore: { type: 'number' },
                                    issues: { type: 'array', items: { type: 'string' } },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (request) => {
        const { scenarios, useDefaults = true } = request.body || {};

        let scenariosToRun: BenchmarkScenario[];

        if (scenarios && scenarios.length > 0) {
            scenariosToRun = scenarios;
        } else if (useDefaults) {
            scenariosToRun = benchmarking.getDefaultScenarios();
        } else {
            return {
                timestamp: new Date().toISOString(),
                passRate: 0,
                totalIssues: 0,
                avgExecutionTime: 0,
                avgCodeQuality: 0,
                scenarios: [],
            };
        }

        app.log.info(`[BENCHMARK] Running ${scenariosToRun.length} scenarios...`);
        const report = await benchmarking.runBenchmarkSuite(scenariosToRun);
        app.log.info(`[BENCHMARK] Completed. Pass rate: ${report.passRate.toFixed(1)}%`);

        return report;
    });

    // ============================================
    // GET /api/v1/benchmarks/scenarios - Get available scenarios
    // ============================================
    app.get('/api/v1/benchmarks/scenarios', {
        schema: {
            tags: ['Benchmarks'],
            summary: 'Get benchmark scenarios',
            description: 'Returns available benchmark scenarios',
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            description: { type: 'string' },
                            expectedAgents: { type: 'array', items: { type: 'string' } },
                            expectedFiles: { type: 'number' },
                            maxExecutionTime: { type: 'number' },
                            minCodeQuality: { type: 'number' },
                        },
                    },
                },
            },
        },
    }, async () => {
        return benchmarking.getDefaultScenarios();
    });

    // ============================================
    // POST /api/v1/benchmarks/scenarios/:id/run - Run single scenario
    // ============================================
    app.post<{
        Params: { id: string };
    }>('/api/v1/benchmarks/scenarios/:id/run', {
        schema: {
            tags: ['Benchmarks'],
            summary: 'Run single scenario',
            description: 'Runs a specific benchmark scenario',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Scenario ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        passed: { type: 'boolean' },
                        executionTime: { type: 'number' },
                        agentsUsed: { type: 'array', items: { type: 'string' } },
                        filesGenerated: { type: 'number' },
                        codeQualityScore: { type: 'number' },
                        issues: { type: 'array', items: { type: 'string' } },
                        timestamp: { type: 'string' },
                    },
                },
                404: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const scenarios = benchmarking.getDefaultScenarios();
        const scenario = scenarios.find(s => s.id === id);

        if (!scenario) {
            return reply.code(404).send({
                error: 'Not Found',
                message: `Scenario not found: ${id}`,
            });
        }

        app.log.info(`[BENCHMARK] Running scenario: ${scenario.name}`);
        const result = await benchmarking.runBenchmarkScenario(scenario);
        app.log.info(`[BENCHMARK] Scenario ${result.passed ? 'PASSED' : 'FAILED'} in ${result.executionTime}ms`);

        return result;
    });

    // ============================================
    // DELETE /api/v1/benchmarks - Clear all benchmark data
    // ============================================
    app.delete('/api/v1/benchmarks', {
        schema: {
            tags: ['Benchmarks'],
            summary: 'Clear benchmarks',
            description: 'Clears all stored benchmark data',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, async () => {
        benchmarking.clear();
        return { message: 'All benchmark data cleared' };
    });

    app.log.info('[ROUTES] Benchmark routes registered');
}
