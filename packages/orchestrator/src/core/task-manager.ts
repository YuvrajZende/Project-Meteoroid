/**
 * ============================================
 * TASK MANAGER - THE MISSION CONTROL
 * ============================================
 * 
 * This module manages task distribution, tracking, and completion
 * for all agents in the system.
 */

import { AGENT_REGISTRY, AgentName } from "../state";
import { SubTask, TaskStatus, TaskAnalysis } from "./thinking-engine";
import { agentMonitor } from "./agent-monitor";

// ============================================
// TASK MANAGER TYPES
// ============================================

export interface ManagedTask extends SubTask {
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    output?: string;
    correctionHistory: CorrectionRecord[];
    attempts: number;
    maxAttempts: number;
}

export interface CorrectionRecord {
    timestamp: Date;
    reason: string;
    correction: string;
    correctedBy: string;
}

export interface TaskExecutionPlan {
    planId: string;
    createdAt: Date;
    mainGoal: string;
    status: "planning" | "executing" | "completed" | "failed" | "paused";
    tasks: ManagedTask[];
    currentPhase: number;
    totalPhases: number;
    completedTasks: number;
    failedTasks: number;
}

// ============================================
// TASK MANAGER CLASS
// ============================================

export class TaskManager {
    private currentPlan: TaskExecutionPlan | null = null;
    private taskQueue: ManagedTask[] = [];
    private completedTasks: ManagedTask[] = [];
    private failedTasks: ManagedTask[] = [];

    // ============================================
    // PLAN MANAGEMENT
    // ============================================

    /**
     * Create a new execution plan from task analysis
     */
    createPlan(analysis: TaskAnalysis): TaskExecutionPlan {
        const managedTasks: ManagedTask[] = analysis.subTasks.map(task => ({
            ...task,
            createdAt: new Date(),
            correctionHistory: [],
            attempts: 0,
            maxAttempts: 3
        }));

        this.currentPlan = {
            planId: `PLAN_${Date.now()}`,
            createdAt: new Date(),
            mainGoal: analysis.mainGoal,
            status: "planning",
            tasks: managedTasks,
            currentPhase: 0,
            totalPhases: this.calculatePhases(managedTasks),
            completedTasks: 0,
            failedTasks: 0
        };

        // Initialize task queue with tasks sorted by priority and dependencies
        this.taskQueue = this.sortTasksByExecutionOrder(managedTasks);

        console.log(`\n📋 [TASK MANAGER] Created execution plan: ${this.currentPlan.planId}`);
        this.printPlan();

        return this.currentPlan;
    }

    /**
     * Get the current execution plan
     */
    getCurrentPlan(): TaskExecutionPlan | null {
        return this.currentPlan;
    }

    /**
     * Update plan status
     */
    updatePlanStatus(status: TaskExecutionPlan["status"]): void {
        if (this.currentPlan) {
            this.currentPlan.status = status;
            console.log(`📋 [TASK MANAGER] Plan status updated: ${status}`);
        }
    }

    // ============================================
    // TASK DISTRIBUTION
    // ============================================

    /**
     * Get the next task that should be executed
     */
    getNextTask(): ManagedTask | null {
        // Find tasks that are ready (all dependencies satisfied)
        const readyTasks = this.taskQueue.filter(task =>
            task.status === "pending" &&
            this.areDependenciesSatisfied(task)
        );

        if (readyTasks.length === 0) {
            // Check if we're blocked
            const blockedTasks = this.taskQueue.filter(t =>
                t.status === "pending" && !this.areDependenciesSatisfied(t)
            );

            if (blockedTasks.length > 0) {
                console.log(`⏳ [TASK MANAGER] ${blockedTasks.length} tasks waiting on dependencies`);
            }
            return null;
        }

        // Return highest priority ready task
        return readyTasks.sort((a, b) => a.priority - b.priority)[0];
    }

    /**
     * Get all tasks assigned to a specific agent
     */
    getAgentTasks(agentId: AgentName): ManagedTask[] {
        const agentName = AGENT_REGISTRY[agentId].name;
        return this.taskQueue.filter(t => t.assignedAgent === agentName);
    }

    /**
     * Get the instructions/task list for an agent
     */
    getAgentInstructions(agentId: AgentName): string {
        const tasks = this.getAgentTasks(agentId);
        const pendingTasks = tasks.filter(t => t.status === "pending");
        const inProgressTasks = tasks.filter(t => t.status === "in_progress");
        const completedTasks = tasks.filter(t => t.status === "completed");

        let instructions = `\n📋 TASK LIST FOR ${AGENT_REGISTRY[agentId].name}\n`;
        instructions += `${"=".repeat(50)}\n\n`;

        if (inProgressTasks.length > 0) {
            instructions += `🔄 CURRENT TASK:\n`;
            inProgressTasks.forEach(t => {
                instructions += `   [${t.id}] ${t.description}\n`;
                instructions += `   Validation: ${t.validationCriteria.join(", ")}\n`;
            });
            instructions += `\n`;
        }

        if (pendingTasks.length > 0) {
            instructions += `⏳ PENDING TASKS:\n`;
            pendingTasks.forEach(t => {
                const deps = t.dependencies.length > 0
                    ? ` (after: ${t.dependencies.join(", ")})`
                    : "";
                instructions += `   [${t.id}] ${t.description}${deps}\n`;
            });
            instructions += `\n`;
        }

        if (completedTasks.length > 0) {
            instructions += `✅ COMPLETED: ${completedTasks.length} task(s)\n`;
        }

        return instructions;
    }

    // ============================================
    // TASK LIFECYCLE
    // ============================================

    /**
     * Mark a task as started
     */
    startTask(taskId: string): void {
        const task = this.findTask(taskId);
        if (task) {
            task.status = "in_progress";
            task.startedAt = new Date();
            task.attempts++;

            if (this.currentPlan) {
                this.currentPlan.status = "executing";
            }

            console.log(`🚀 [TASK MANAGER] Started: ${taskId} (attempt ${task.attempts}/${task.maxAttempts})`);
        }
    }

    /**
     * Mark a task as completed
     */
    completeTask(taskId: string, output: string): void {
        const task = this.findTask(taskId);
        if (task) {
            task.status = "completed";
            task.completedAt = new Date();
            task.output = output;

            // Move to completed list
            const index = this.taskQueue.indexOf(task);
            if (index > -1) {
                this.taskQueue.splice(index, 1);
                this.completedTasks.push(task);
            }

            if (this.currentPlan) {
                this.currentPlan.completedTasks++;
            }

            console.log(`✅ [TASK MANAGER] Completed: ${taskId}`);
            this.printProgress();
        }
    }

    /**
     * Mark a task as failed
     */
    failTask(taskId: string, reason: string): void {
        const task = this.findTask(taskId);
        if (task) {
            if (task.attempts < task.maxAttempts) {
                // Retry
                task.status = "pending";
                console.log(`🔄 [TASK MANAGER] Task ${taskId} failed, will retry (${task.attempts}/${task.maxAttempts})`);
            } else {
                // Max attempts reached
                task.status = "failed";

                const index = this.taskQueue.indexOf(task);
                if (index > -1) {
                    this.taskQueue.splice(index, 1);
                    this.failedTasks.push(task);
                }

                if (this.currentPlan) {
                    this.currentPlan.failedTasks++;
                }

                console.log(`❌ [TASK MANAGER] Task ${taskId} failed permanently: ${reason}`);

                // Block dependent tasks
                this.blockDependentTasks(taskId);
            }
        }
    }

    /**
     * Apply a correction to a task
     */
    applyCorrection(taskId: string, reason: string, correction: string): void {
        const task = this.findTask(taskId);
        if (task) {
            task.correctionHistory.push({
                timestamp: new Date(),
                reason,
                correction,
                correctedBy: "orchestrator"
            });

            // Reset task for retry
            task.status = "pending";
            task.attempts = Math.max(0, task.attempts - 1); // Give one attempt back

            console.log(`🔧 [TASK MANAGER] Correction applied to ${taskId}`);
        }
    }

    // ============================================
    // PROGRESS & STATUS
    // ============================================

    /**
     * Check if execution is complete
     */
    isExecutionComplete(): boolean {
        return this.taskQueue.filter(t =>
            t.status === "pending" || t.status === "in_progress"
        ).length === 0;
    }

    /**
     * Get execution progress percentage
     */
    getProgress(): number {
        const total = this.completedTasks.length + this.failedTasks.length + this.taskQueue.length;
        if (total === 0) return 100;
        return Math.round((this.completedTasks.length / total) * 100);
    }

    /**
     * Get summary of current execution state
     */
    getSummary(): string {
        const completed = this.completedTasks.length;
        const failed = this.failedTasks.length;
        const pending = this.taskQueue.filter(t => t.status === "pending").length;
        const inProgress = this.taskQueue.filter(t => t.status === "in_progress").length;
        const blocked = this.taskQueue.filter(t => t.status === "blocked").length;

        return `Progress: ${this.getProgress()}% | ✅${completed} | ❌${failed} | ⏳${pending} | 🔄${inProgress} | 🚫${blocked}`;
    }

    /**
     * Print the current plan
     */
    printPlan(): void {
        if (!this.currentPlan) {
            console.log("No active plan");
            return;
        }

        console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
        console.log(`║                📋 EXECUTION PLAN                              ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════╣`);
        console.log(`║  ID: ${this.currentPlan.planId.padEnd(53)} ║`);
        console.log(`║  Goal: ${this.currentPlan.mainGoal.substring(0, 50).padEnd(50)}... ║`);
        console.log(`║  Status: ${this.currentPlan.status.toUpperCase().padEnd(49)} ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════╣`);
        console.log(`║  TASKS:                                                       ║`);

        for (const task of this.currentPlan.tasks.slice(0, 10)) {
            const statusIcon = this.getStatusIcon(task.status);
            const line = `  ${statusIcon} [${task.id}] ${task.description}`;
            console.log(`║${line.substring(0, 63).padEnd(63)}║`);
            console.log(`║      → ${task.assignedAgent} (Priority: ${task.priority})`.padEnd(64) + `║`);
        }

        if (this.currentPlan.tasks.length > 10) {
            console.log(`║  ... and ${this.currentPlan.tasks.length - 10} more tasks`.padEnd(64) + `║`);
        }

        console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);
    }

    /**
     * Print current progress
     */
    printProgress(): void {
        const total = this.completedTasks.length + this.failedTasks.length + this.taskQueue.length;
        const completed = this.completedTasks.length;
        const progress = this.getProgress();

        const barLength = 30;
        const filledLength = Math.round((progress / 100) * barLength);
        const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

        console.log(`\n📊 Progress: [${bar}] ${progress}% (${completed}/${total} tasks)`);
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private findTask(taskId: string): ManagedTask | undefined {
        return this.taskQueue.find(t => t.id === taskId) ||
            this.completedTasks.find(t => t.id === taskId) ||
            this.failedTasks.find(t => t.id === taskId);
    }

    private areDependenciesSatisfied(task: ManagedTask): boolean {
        if (task.dependencies.length === 0) return true;

        return task.dependencies.every(depId =>
            this.completedTasks.some(t => t.id === depId)
        );
    }

    private blockDependentTasks(failedTaskId: string): void {
        for (const task of this.taskQueue) {
            if (task.dependencies.includes(failedTaskId)) {
                task.status = "blocked";
                console.log(`🚫 [TASK MANAGER] Blocked ${task.id} due to failed dependency`);
            }
        }
    }

    private calculatePhases(tasks: ManagedTask[]): number {
        // Group by agent tier
        const tiers = new Set(tasks.map(t => this.getAgentTier(t.assignedAgent)));
        return tiers.size;
    }

    private getAgentTier(agentName: string): number {
        for (const [id, info] of Object.entries(AGENT_REGISTRY)) {
            if (info.name === agentName) return info.tier;
        }
        return 4;
    }

    private sortTasksByExecutionOrder(tasks: ManagedTask[]): ManagedTask[] {
        // Topological sort based on dependencies and priority
        const sorted: ManagedTask[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (task: ManagedTask) => {
            if (visited.has(task.id)) return;
            if (visiting.has(task.id)) {
                console.warn(`⚠️ Circular dependency detected involving ${task.id}`);
                return;
            }

            visiting.add(task.id);

            for (const depId of task.dependencies) {
                const depTask = tasks.find(t => t.id === depId);
                if (depTask) visit(depTask);
            }

            visiting.delete(task.id);
            visited.add(task.id);
            sorted.push(task);
        };

        // Sort by priority first, then do topological sort
        const prioritySorted = [...tasks].sort((a, b) => a.priority - b.priority);
        for (const task of prioritySorted) {
            visit(task);
        }

        return sorted;
    }

    private getStatusIcon(status: TaskStatus): string {
        switch (status) {
            case "pending": return "⏳";
            case "in_progress": return "🔄";
            case "completed": return "✅";
            case "failed": return "❌";
            case "blocked": return "🚫";
            case "correcting": return "🔧";
            default: return "❓";
        }
    }
}

// Export singleton instance
export const taskManager = new TaskManager();
