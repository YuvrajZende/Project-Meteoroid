/**
 * ============================================
 * PARALLEL EXECUTOR - CONCURRENT AGENT EXECUTION
 * ============================================
 * 
 * Enables parallel execution of independent agents.
 * Significantly reduces total execution time for complex requests.
 * 
 * Features:
 * - Dependency-aware parallel execution
 * - Concurrent agent invocation
 * - Result aggregation
 * - Error handling for parallel tasks
 * - Progress tracking
 */

import { AgentName, AGENT_REGISTRY } from "./state";
import { taskManager, ManagedTask } from "./core/task-manager";
import { agentMonitor } from "./core/agent-monitor";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface ParallelTask {
    taskId: string;
    agentId: AgentName;
    description: string;
    dependencies: string[];
    status: ParallelTaskStatus;
    result?: AgentResult;
    error?: string;
    startTime?: Date;
    endTime?: Date;
}

export interface AgentResult {
    agentId: AgentName;
    taskId: string;
    output: string;
    artifacts: Record<string, string>;
    success: boolean;
}

export interface ExecutionPlan {
    phases: ExecutionPhase[];
    totalTasks: number;
    estimatedTime: number;
}

export interface ExecutionPhase {
    phaseNumber: number;
    tasks: ParallelTask[];
    canRunInParallel: boolean;
}

export interface ExecutionProgress {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    percentage: number;
    currentPhase: number;
    totalPhases: number;
}

export type ParallelTaskStatus = "pending" | "running" | "completed" | "failed" | "blocked";

// ============================================
// PARALLEL EXECUTOR CLASS
// ============================================

export class ParallelExecutor {
    private tasks: Map<string, ParallelTask> = new Map();
    private phases: ExecutionPhase[] = [];
    private currentPhase: number = 0;
    private maxConcurrency: number = 3;
    private isExecuting: boolean = false;

    constructor(maxConcurrency: number = 3) {
        this.maxConcurrency = maxConcurrency;
    }

    // ============================================
    // PLAN GENERATION
    // ============================================

    /**
     * Analyze tasks and create parallel execution plan
     */
    createExecutionPlan(managedTasks: ManagedTask[]): ExecutionPlan {
        this.tasks.clear();
        this.phases = [];

        // Convert managed tasks to parallel tasks
        for (const task of managedTasks) {
            const agentId = this.getAgentIdFromName(task.assignedAgent);
            if (!agentId) continue;

            const parallelTask: ParallelTask = {
                taskId: task.id,
                agentId,
                description: task.description,
                dependencies: task.dependencies,
                status: "pending",
            };

            this.tasks.set(task.id, parallelTask);
        }

        // Build execution phases
        this.buildPhases();

        // Calculate estimated time
        const estimatedTime = this.estimateExecutionTime();

        console.log(`\n📊 [Parallel] Created execution plan:`);
        console.log(`   Total tasks: ${this.tasks.size}`);
        console.log(`   Phases: ${this.phases.length}`);
        console.log(`   Max concurrency: ${this.maxConcurrency}`);
        console.log(`   Estimated time: ${estimatedTime}s`);

        return {
            phases: this.phases,
            totalTasks: this.tasks.size,
            estimatedTime,
        };
    }

    /**
     * Build execution phases based on dependencies
     */
    private buildPhases(): void {
        const completed = new Set<string>();
        const remaining = new Set(this.tasks.keys());

        let phaseNumber = 0;

        while (remaining.size > 0) {
            const readyTasks: ParallelTask[] = [];

            // Find tasks that can run (all dependencies completed)
            for (const taskId of remaining) {
                const task = this.tasks.get(taskId)!;
                const canRun = task.dependencies.every(dep => completed.has(dep));

                if (canRun) {
                    readyTasks.push(task);
                }
            }

            if (readyTasks.length === 0) {
                // Circular dependency detected or blocked tasks
                console.warn(`⚠️ [Parallel] Blocked tasks detected: ${Array.from(remaining).join(", ")}`);
                break;
            }

            // Create phase
            const phase: ExecutionPhase = {
                phaseNumber,
                tasks: readyTasks,
                canRunInParallel: readyTasks.length > 1,
            };

            this.phases.push(phase);

            // Mark as "completed" for dependency resolution
            for (const task of readyTasks) {
                completed.add(task.taskId);
                remaining.delete(task.taskId);
            }

            phaseNumber++;
        }
    }

    /**
     * Estimate total execution time (in seconds)
     */
    private estimateExecutionTime(): number {
        const avgTaskTime = 15; // Assume 15 seconds per task
        let totalTime = 0;

        for (const phase of this.phases) {
            // In a phase, parallel tasks run concurrently
            const tasksInPhase = phase.tasks.length;
            const batchCount = Math.ceil(tasksInPhase / this.maxConcurrency);
            totalTime += batchCount * avgTaskTime;
        }

        return totalTime;
    }

    // ============================================
    // EXECUTION
    // ============================================

    /**
     * Execute all tasks with parallelization
     */
    async execute(
        agentExecutor: (agentId: AgentName, taskId: string) => Promise<AgentResult>
    ): Promise<AgentResult[]> {
        if (this.isExecuting) {
            throw new Error("Execution already in progress");
        }

        this.isExecuting = true;
        const allResults: AgentResult[] = [];

        console.log(`\n🚀 [Parallel] Starting execution...`);

        try {
            for (let i = 0; i < this.phases.length; i++) {
                this.currentPhase = i;
                const phase = this.phases[i];

                console.log(`\n📍 [Parallel] Phase ${i + 1}/${this.phases.length} - ${phase.tasks.length} tasks`);

                if (phase.canRunInParallel && phase.tasks.length > 1) {
                    // Execute in parallel with concurrency limit
                    const results = await this.executeParallel(phase.tasks, agentExecutor);
                    allResults.push(...results);
                } else {
                    // Execute sequentially
                    for (const task of phase.tasks) {
                        const result = await this.executeTask(task, agentExecutor);
                        allResults.push(result);
                    }
                }

                // Check for failures that might block next phase
                const failures = phase.tasks.filter(t => t.status === "failed");
                if (failures.length > 0) {
                    console.warn(`⚠️ [Parallel] ${failures.length} task(s) failed in phase ${i + 1}`);
                    // Continue anyway - supervisor will handle corrections
                }
            }

            console.log(`\n✅ [Parallel] Execution complete!`);
            this.printSummary();

        } finally {
            this.isExecuting = false;
        }

        return allResults;
    }

    /**
     * Execute tasks in parallel with concurrency limit
     */
    private async executeParallel(
        tasks: ParallelTask[],
        executor: (agentId: AgentName, taskId: string) => Promise<AgentResult>
    ): Promise<AgentResult[]> {
        const results: AgentResult[] = [];
        const batches: ParallelTask[][] = [];

        // Split into batches based on max concurrency
        for (let i = 0; i < tasks.length; i += this.maxConcurrency) {
            batches.push(tasks.slice(i, i + this.maxConcurrency));
        }

        for (const batch of batches) {
            console.log(`   🔄 Running batch of ${batch.length} tasks in parallel...`);

            // Execute batch in parallel
            const batchPromises = batch.map(task => this.executeTask(task, executor));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }

    /**
     * Execute a single task
     */
    private async executeTask(
        task: ParallelTask,
        executor: (agentId: AgentName, taskId: string) => Promise<AgentResult>
    ): Promise<AgentResult> {
        task.status = "running";
        task.startTime = new Date();

        const agentName = AGENT_REGISTRY[task.agentId].name;
        console.log(`   ▶️ [${agentName}] Starting: ${task.description.substring(0, 40)}...`);

        try {
            // Record in monitor
            agentMonitor.startExecution(task.agentId, task.taskId, task.description);

            // Execute
            const result = await executor(task.agentId, task.taskId);

            task.status = result.success ? "completed" : "failed";
            task.result = result;
            task.endTime = new Date();

            const duration = task.endTime.getTime() - task.startTime.getTime();
            console.log(`   ${result.success ? "✅" : "❌"} [${agentName}] ${result.success ? "Complete" : "Failed"} (${duration}ms)`);

            return result;

        } catch (error: any) {
            task.status = "failed";
            task.error = error.message;
            task.endTime = new Date();

            console.log(`   ❌ [${agentName}] Error: ${error.message}`);

            return {
                agentId: task.agentId,
                taskId: task.taskId,
                output: "",
                artifacts: {},
                success: false,
            };
        }
    }

    // ============================================
    // PROGRESS TRACKING
    // ============================================

    /**
     * Get current execution progress
     */
    getProgress(): ExecutionProgress {
        let completed = 0;
        let failed = 0;
        let running = 0;
        let pending = 0;

        for (const task of this.tasks.values()) {
            switch (task.status) {
                case "completed": completed++; break;
                case "failed": failed++; break;
                case "running": running++; break;
                case "pending": pending++; break;
            }
        }

        const total = this.tasks.size;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            totalTasks: total,
            completedTasks: completed,
            failedTasks: failed,
            inProgressTasks: running,
            pendingTasks: pending,
            percentage,
            currentPhase: this.currentPhase + 1,
            totalPhases: this.phases.length,
        };
    }

    /**
     * Print execution summary
     */
    printSummary(): void {
        const progress = this.getProgress();

        console.log(`\n${"═".repeat(50)}`);
        console.log(`📊 PARALLEL EXECUTION SUMMARY`);
        console.log(`${"═".repeat(50)}`);
        console.log(`   Total Tasks: ${progress.totalTasks}`);
        console.log(`   Completed: ${progress.completedTasks}`);
        console.log(`   Failed: ${progress.failedTasks}`);
        console.log(`   Phases: ${progress.totalPhases}`);
        console.log(`   Success Rate: ${Math.round((progress.completedTasks / progress.totalTasks) * 100)}%`);
        console.log(`${"═".repeat(50)}`);
    }

    /**
     * Print execution timeline
     */
    printTimeline(): void {
        console.log(`\n📅 EXECUTION TIMELINE:`);

        for (const phase of this.phases) {
            console.log(`\n  Phase ${phase.phaseNumber + 1} ${phase.canRunInParallel ? "(parallel)" : "(sequential)"}:`);

            for (const task of phase.tasks) {
                const agentName = AGENT_REGISTRY[task.agentId].name;
                const status = task.status === "completed" ? "✅" :
                    task.status === "failed" ? "❌" :
                        task.status === "running" ? "🔄" : "⏳";

                let duration = "";
                if (task.startTime && task.endTime) {
                    const ms = task.endTime.getTime() - task.startTime.getTime();
                    duration = ` (${ms}ms)`;
                }

                console.log(`    ${status} [${agentName}] ${task.description.substring(0, 40)}...${duration}`);
            }
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Get agent ID from agent name
     */
    private getAgentIdFromName(agentName: string): AgentName | null {
        for (const [id, info] of Object.entries(AGENT_REGISTRY)) {
            if (info.name === agentName) {
                return id as AgentName;
            }
        }
        return null;
    }

    /**
     * Check if execution is in progress
     */
    isRunning(): boolean {
        return this.isExecuting;
    }

    /**
     * Get all tasks
     */
    getTasks(): ParallelTask[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): ParallelTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Reset executor
     */
    reset(): void {
        this.tasks.clear();
        this.phases = [];
        this.currentPhase = 0;
        this.isExecuting = false;
    }

    /**
     * Set max concurrency
     */
    setMaxConcurrency(max: number): void {
        this.maxConcurrency = max;
    }
}

// Export singleton instance
export const parallelExecutor = new ParallelExecutor();
