/**
 * Benchmarking Service
 * Tracks and measures agent performance, orchestrator compliance, and system efficiency
 */

import { getAgentRegistry } from '../services/registry/agent-registry.js';
import { getIntegratedOrchestrator, type OrchestrationResult } from '../application/services/orchestration/integrated-orchestrator.js';

// ============================================
// TYPES
// ============================================

/**
 * Benchmark metrics for a single agent execution
 */
export interface AgentBenchmark {
    agentId: string;
    agentName: string;
    executionTime: number; // milliseconds
    tokenUsage: {
        prompt: number;
        completion: number;
        total: number;
    };
    success: boolean;
    error?: string;
    filesGenerated: number;
    codeQualityScore?: number; // 0-100
    timestamp: string;
    // Context fields for tracking
    taskId?: string;
    projectId?: string;
    userId?: string;
}

/**
 * Aggregated metrics for an agent over time
 */
export interface AgentMetrics {
    agentId: string;
    agentName: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number; // 0-100
    avgExecutionTime: number; // milliseconds
    avgTokenUsage: number;
    totalTokens: number;
    avgCodeQuality: number; // 0-100
    lastExecution?: string;
}

/**
 * Orchestrator compliance metrics
 */
export interface OrchestratorMetrics {
    totalOrchestrations: number;
    avgThinkingTime: number; // Time spent in thinking engine
    avgCoordinationTime: number; // Time spent coordinating agents
    contextUtilization: number; // 0-100, how well context is used
    agentSelectionAccuracy: number; // 0-100, did we pick the right agents?
    interAgentHandoffs: number; // Number of times agents passed work to each other
    avgAgentsPerTask: number;
}

/**
 * Benchmark scenario for testing
 */
export interface BenchmarkScenario {
    id: string;
    name: string;
    description: string;
    prompt: string;
    expectedAgents: string[]; // Which agents should handle this?
    expectedFiles: number; // How many files should be generated?
    maxExecutionTime: number; // Max acceptable time (ms)
    minCodeQuality: number; // Min acceptable quality score (0-100)
}

/**
 * Result of running a benchmark scenario
 */
export interface BenchmarkResult {
    scenario: BenchmarkScenario;
    passed: boolean;
    executionTime: number;
    agentsUsed: string[];
    filesGenerated: number;
    codeQualityScore: number;
    issues: string[]; // List of issues found
    timestamp: string;
}

/**
 * Complete benchmark report
 */
export interface BenchmarkReport {
    timestamp: string;
    scenarios: BenchmarkResult[];
    passRate: number; // 0-100
    totalIssues: number;
    avgExecutionTime: number;
    avgCodeQuality: number;
}

// ============================================
// BENCHMARKING SERVICE
// ============================================

import { getSupabaseAdmin } from './database/database-client.js';
import { v4 as uuidv4 } from 'uuid';

export class BenchmarkingService {
    private agentBenchmarks: Map<string, AgentBenchmark[]> = new Map();
    private orchestratorHistory: OrchestratorMetrics[] = [];
    private supabaseEnabled: boolean = false;
    private pendingAgentBenchmarks: AgentBenchmark[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Check if Supabase is configured
        this.supabaseEnabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

        if (this.supabaseEnabled) {
            // Flush pending records every 30 seconds
            this.flushInterval = setInterval(() => this.flushPendingRecords(), 30000);
        }
    }

    /**
     * Record an agent execution for benchmarking
     */
    recordAgentExecution(benchmark: AgentBenchmark): void {
        const agentId = benchmark.agentId;

        if (!this.agentBenchmarks.has(agentId)) {
            this.agentBenchmarks.set(agentId, []);
        }

        this.agentBenchmarks.get(agentId)!.push(benchmark);

        // Keep only last 1000 executions per agent (memory management)
        const benchmarks = this.agentBenchmarks.get(agentId)!;
        if (benchmarks.length > 1000) {
            benchmarks.shift(); // Remove oldest
        }

        // Queue for Supabase persistence
        if (this.supabaseEnabled) {
            this.pendingAgentBenchmarks.push(benchmark);
        }
    }

    /**
     * Get aggregated metrics for a specific agent
     */
    getAgentMetrics(agentId: string): AgentMetrics | null {
        const benchmarks = this.agentBenchmarks.get(agentId);

        if (!benchmarks || benchmarks.length === 0) {
            return null;
        }

        const registry = getAgentRegistry();
        const agent = registry.getById(agentId);

        if (!agent) {
            return null;
        }

        const successful = benchmarks.filter(b => b.success);
        const failed = benchmarks.filter(b => !b.success);

        const avgExecutionTime = benchmarks.reduce((sum, b) => sum + b.executionTime, 0) / benchmarks.length;
        const avgTokenUsage = benchmarks.reduce((sum, b) => sum + b.tokenUsage.total, 0) / benchmarks.length;
        const totalTokens = benchmarks.reduce((sum, b) => sum + b.tokenUsage.total, 0);

        const qualityScores = benchmarks.filter(b => b.codeQualityScore !== undefined).map(b => b.codeQualityScore!);
        const avgCodeQuality = qualityScores.length > 0
            ? qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length
            : 0;

        const lastExecution = benchmarks.length > 0 ? benchmarks[benchmarks.length - 1].timestamp : undefined;

        return {
            agentId,
            agentName: agent.name,
            totalExecutions: benchmarks.length,
            successfulExecutions: successful.length,
            failedExecutions: failed.length,
            successRate: (successful.length / benchmarks.length) * 100,
            avgExecutionTime,
            avgTokenUsage,
            totalTokens,
            avgCodeQuality,
            lastExecution,
        };
    }

    /**
     * Get metrics for all agents
     */
    getAllAgentMetrics(): AgentMetrics[] {
        const registry = getAgentRegistry();
        const allAgents = registry.getAll();

        return allAgents
            .map(agent => this.getAgentMetrics(agent.id))
            .filter(metrics => metrics !== null) as AgentMetrics[];
    }

    /**
     * Record orchestrator execution metrics
     */
    recordOrchestratorMetrics(metrics: OrchestratorMetrics): void {
        this.orchestratorHistory.push(metrics);

        // Keep only last 500 orchestrations
        if (this.orchestratorHistory.length > 500) {
            this.orchestratorHistory.shift();
        }
    }

    /**
     * Get aggregated orchestrator metrics
     */
    getOrchestratorMetrics(): OrchestratorMetrics | null {
        if (this.orchestratorHistory.length === 0) {
            return null;
        }

        const count = this.orchestratorHistory.length;

        return {
            totalOrchestrations: count,
            avgThinkingTime: this.orchestratorHistory.reduce((sum, m) => sum + m.avgThinkingTime, 0) / count,
            avgCoordinationTime: this.orchestratorHistory.reduce((sum, m) => sum + m.avgCoordinationTime, 0) / count,
            contextUtilization: this.orchestratorHistory.reduce((sum, m) => sum + m.contextUtilization, 0) / count,
            agentSelectionAccuracy: this.orchestratorHistory.reduce((sum, m) => sum + m.agentSelectionAccuracy, 0) / count,
            interAgentHandoffs: this.orchestratorHistory.reduce((sum, m) => sum + m.interAgentHandoffs, 0),
            avgAgentsPerTask: this.orchestratorHistory.reduce((sum, m) => sum + m.avgAgentsPerTask, 0) / count,
        };
    }

    /**
     * Run a benchmark scenario
     */
    async runBenchmarkScenario(scenario: BenchmarkScenario): Promise<BenchmarkResult> {
        const orchestrator = getIntegratedOrchestrator();
        const startTime = Date.now();
        const issues: string[] = [];

        try {
            const result: OrchestrationResult = await orchestrator.orchestrate({
                taskId: `benchmark-${scenario.id}`,
                userId: 'benchmark-system',
                projectId: `benchmark-${scenario.id}`,
                prompt: scenario.prompt,
            });

            const executionTime = Date.now() - startTime;
            const agentsUsed = result.agentsExecuted || [];
            const filesGenerated = result.fileWriteResult?.filesWritten?.length || 0;

            // Check if expected agents were used
            const missingAgents = scenario.expectedAgents.filter(a => !agentsUsed.includes(a));
            if (missingAgents.length > 0) {
                issues.push(`Missing expected agents: ${missingAgents.join(', ')}`);
            }

            // Check file count
            if (filesGenerated < scenario.expectedFiles) {
                issues.push(`Expected ${scenario.expectedFiles} files, got ${filesGenerated}`);
            }

            // Check execution time
            if (executionTime > scenario.maxExecutionTime) {
                issues.push(`Execution time ${executionTime}ms exceeded max ${scenario.maxExecutionTime}ms`);
            }

            // Simple code quality score (can be enhanced)
            const files = result.fileWriteResult?.filesWritten?.map(f => ({ path: f, content: '' })) || [];
            const codeQualityScore = this.calculateCodeQuality(files);

            if (codeQualityScore < scenario.minCodeQuality) {
                issues.push(`Code quality ${codeQualityScore.toFixed(1)} below min ${scenario.minCodeQuality}`);
            }

            return {
                scenario,
                passed: issues.length === 0,
                executionTime,
                agentsUsed,
                filesGenerated,
                codeQualityScore,
                issues,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';

            return {
                scenario,
                passed: false,
                executionTime,
                agentsUsed: [],
                filesGenerated: 0,
                codeQualityScore: 0,
                issues: [`Execution failed: ${errorMsg}`],
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Run the complete benchmark suite
     */
    async runBenchmarkSuite(scenarios: BenchmarkScenario[]): Promise<BenchmarkReport> {
        const results: BenchmarkResult[] = [];

        for (const scenario of scenarios) {
            const result = await this.runBenchmarkScenario(scenario);
            results.push(result);
        }

        const passed = results.filter(r => r.passed);
        const passRate = (passed.length / results.length) * 100;
        const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
        const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
        const avgCodeQuality = results.reduce((sum, r) => sum + r.codeQualityScore, 0) / results.length;

        return {
            timestamp: new Date().toISOString(),
            scenarios: results,
            passRate,
            totalIssues,
            avgExecutionTime,
            avgCodeQuality,
        };
    }

    /**
     * Calculate code quality score (0-100)
     * This is a simple heuristic that can be enhanced
     */
    private calculateCodeQuality(files: { path: string; content: string }[]): number {
        let score = 100;

        for (const file of files) {
            // Penalty for empty files
            if (file.content.trim().length === 0) {
                score -= 20;
            }

            // Penalty for very short files (likely incomplete)
            if (file.content.length < 100) {
                score -= 10;
            }

            // Bonus for TypeScript files with proper structure
            if (file.path.endsWith('.ts')) {
                if (file.content.includes('export')) score += 5;
                if (file.content.includes('import')) score += 5;
                if (file.content.includes('interface') || file.content.includes('type')) score += 5;
            }

            // Penalty for obvious errors
            if (file.content.includes('TODO') || file.content.includes('FIXME')) {
                score -= 5;
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get default benchmark scenarios
     */
    getDefaultScenarios(): BenchmarkScenario[] {
        return [
            {
                id: 'auth-jwt',
                name: 'Generate JWT Authentication System',
                description: 'Tests the auth agent\'s ability to generate a complete JWT auth system',
                prompt: 'Create a JWT-based authentication system with login, register, and token refresh',
                expectedAgents: ['auth'],
                expectedFiles: 3, // At least 3 files for a complete auth system
                maxExecutionTime: 30000, // 30 seconds
                minCodeQuality: 70,
            },
            {
                id: 'security-headers',
                name: 'Add Security Headers & Rate Limiting',
                description: 'Tests the security agent\'s ability to add security features',
                prompt: 'Add security headers and rate limiting to the API',
                expectedAgents: ['security'],
                expectedFiles: 2,
                maxExecutionTime: 20000, // 20 seconds
                minCodeQuality: 70,
            },
            {
                id: 'monitoring-health',
                name: 'Setup Logging & Health Checks',
                description: 'Tests the monitoring agent\'s ability to add observability',
                prompt: 'Add logging, health checks, and metrics to the application',
                expectedAgents: ['monitoring'],
                expectedFiles: 2,
                maxExecutionTime: 20000, // 20 seconds
                minCodeQuality: 70,
            },
            {
                id: 'multi-agent-api',
                name: 'Multi-Agent Collaboration: Secure API',
                description: 'Tests orchestrator\'s ability to coordinate multiple agents',
                prompt: 'Create a secure REST API with authentication, rate limiting, and monitoring',
                expectedAgents: ['auth', 'security', 'monitoring'],
                expectedFiles: 5, // Multiple agents should produce more files
                maxExecutionTime: 60000, // 60 seconds for multi-agent
                minCodeQuality: 75,
            },
        ];
    }

    /**
     * Flush pending benchmark records to Supabase
     */
    private async flushPendingRecords(): Promise<void> {
        if (!this.supabaseEnabled || this.pendingAgentBenchmarks.length === 0) {
            return;
        }

        const recordsToFlush = [...this.pendingAgentBenchmarks];
        this.pendingAgentBenchmarks = [];

        try {
            const supabase = getSupabaseAdmin();

            // UUID validation helper
            const isValidUUID = (str: string | undefined): boolean => {
                if (!str) return false;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return uuidRegex.test(str);
            };

            // Transform records to DB format
            const dbRecords = recordsToFlush.map(record => ({
                id: uuidv4(),
                agent_id: record.agentId,
                agent_name: record.agentName,
                execution_time: record.executionTime,
                success: record.success,
                error: record.error || null,
                prompt_tokens: record.tokenUsage.prompt,
                completion_tokens: record.tokenUsage.completion,
                total_tokens: record.tokenUsage.total,
                files_generated: record.filesGenerated,
                code_quality_score: record.codeQualityScore || null,
                task_id: record.taskId || null,
                project_id: isValidUUID(record.projectId) ? record.projectId : null,
                user_id: isValidUUID(record.userId) ? record.userId : null,
                created_at: record.timestamp,
            }));

            const { error } = await supabase
                .from('agent_benchmarks')
                .insert(dbRecords);

            if (error) {
                console.error('[BENCHMARKING] Failed to persist records:', error);
                // Put records back for retry
                this.pendingAgentBenchmarks.unshift(...recordsToFlush);
            } else {
                console.log(`[BENCHMARKING] Persisted ${recordsToFlush.length} agent benchmarks to Supabase`);
            }
        } catch (error) {
            console.error('[BENCHMARKING] Persistence error:', error);
            // Put records back for retry
            this.pendingAgentBenchmarks.unshift(...recordsToFlush);
        }
    }

    /**
     * Record orchestration metrics to database
     */
    async recordOrchestrationToDb(result: {
        taskId: string;
        projectId?: string;
        userId?: string;
        totalDuration: number;
        thinkingTime?: number;
        agentsUsed: string[];
        subtasksCount: number;
        filesGenerated: number;
        success: boolean;
        error?: string;
        totalTokens: number;
        totalCost: number;
        analysisModel?: string;
        generationModel?: string;
    }): Promise<void> {
        if (!this.supabaseEnabled) return;

        try {
            const supabase = getSupabaseAdmin();

            const isValidUUID = (str: string | undefined): boolean => {
                if (!str) return false;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return uuidRegex.test(str);
            };

            const { error } = await supabase
                .from('orchestrator_metrics')
                .insert({
                    id: uuidv4(),
                    task_id: result.taskId,
                    project_id: isValidUUID(result.projectId) ? result.projectId : null,
                    user_id: isValidUUID(result.userId) ? result.userId : null,
                    total_duration: result.totalDuration,
                    thinking_time: result.thinkingTime || 0,
                    coordination_time: 0,
                    agents_used: result.agentsUsed,
                    subtasks_count: result.subtasksCount,
                    files_generated: result.filesGenerated,
                    success: result.success,
                    error: result.error || null,
                    total_tokens: result.totalTokens,
                    total_cost: result.totalCost,
                    analysis_model: result.analysisModel || null,
                    generation_model: result.generationModel || null,
                });

            if (error) {
                console.error('[BENCHMARKING] Failed to record orchestration metrics:', error);
            } else {
                console.log(`[BENCHMARKING] Recorded orchestration metrics for task ${result.taskId}`);
            }
        } catch (error) {
            console.error('[BENCHMARKING] Error recording orchestration:', error);
        }
    }

    /**
     * Shutdown the service - flush pending records
     */
    async shutdown(): Promise<void> {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        // Flush any remaining records
        await this.flushPendingRecords();
        console.log('[BENCHMARKING] Service shutdown complete');
    }

    /**
     * Clear all benchmark data
     */
    clear(): void {
        this.agentBenchmarks.clear();
        this.orchestratorHistory = [];
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let benchmarkingService: BenchmarkingService | null = null;

export function getBenchmarkingService(): BenchmarkingService {
    if (!benchmarkingService) {
        benchmarkingService = new BenchmarkingService();
    }
    return benchmarkingService;
}

export function createBenchmarkingService(): BenchmarkingService {
    benchmarkingService = new BenchmarkingService();
    return benchmarkingService;
}
