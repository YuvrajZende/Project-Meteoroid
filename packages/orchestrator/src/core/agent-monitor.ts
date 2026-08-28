/**
 * ============================================
 * AGENT MONITOR - THE WATCHFUL EYE
 * ============================================
 * 
 * This module provides real-time monitoring of all agents,
 * tracking their status, performance, and outputs.
 */

import { AGENT_REGISTRY, AgentName } from "../state";

// ============================================
// MONITORING TYPES & INTERFACES
// ============================================

export interface AgentStatus {
    agentId: AgentName;
    name: string;
    status: AgentExecutionStatus;
    currentTask: string | null;
    lastActivity: Date | null;
    executionCount: number;
    successCount: number;
    failureCount: number;
    averageResponseTime: number;
    lastOutput: string | null;
    health: AgentHealth;
}

export interface AgentExecutionRecord {
    agentId: AgentName;
    taskId: string;
    startTime: Date;
    endTime?: Date;
    status: AgentExecutionStatus;
    input: string;
    output?: string;
    errorMessage?: string;
    deviationDetected?: boolean;
}

export interface MonitoringEvent {
    timestamp: Date;
    eventType: MonitoringEventType;
    agentId?: AgentName;
    message: string;
    data?: any;
    severity: "info" | "warning" | "error" | "critical";
}

export type AgentExecutionStatus = "idle" | "preparing" | "executing" | "completed" | "failed" | "correcting";
export type AgentHealth = "healthy" | "degraded" | "unhealthy" | "unknown";
export type MonitoringEventType =
    | "agent_started"
    | "agent_completed"
    | "agent_failed"
    | "deviation_detected"
    | "correction_applied"
    | "task_assigned"
    | "system_warning"
    | "health_check";

// ============================================
// AGENT MONITOR CLASS
// ============================================

export class AgentMonitor {
    private agentStatuses: Map<AgentName, AgentStatus> = new Map();
    private executionHistory: AgentExecutionRecord[] = [];
    private events: MonitoringEvent[] = [];
    private activeExecutions: Map<string, AgentExecutionRecord> = new Map();

    constructor() {
        // Initialize status for all registered agents
        for (const [agentId, agentInfo] of Object.entries(AGENT_REGISTRY)) {
            this.agentStatuses.set(agentId as AgentName, {
                agentId: agentId as AgentName,
                name: agentInfo.name,
                status: "idle",
                currentTask: null,
                lastActivity: null,
                executionCount: 0,
                successCount: 0,
                failureCount: 0,
                averageResponseTime: 0,
                lastOutput: null,
                health: "unknown"
            });
        }
    }

    // ============================================
    // EXECUTION LIFECYCLE
    // ============================================

    /**
     * Record that an agent has started execution
     */
    startExecution(agentId: AgentName, taskId: string, input: string): void {
        const execution: AgentExecutionRecord = {
            agentId,
            taskId,
            startTime: new Date(),
            status: "executing",
            input
        };

        this.activeExecutions.set(taskId, execution);

        const status = this.agentStatuses.get(agentId);
        if (status) {
            status.status = "executing";
            status.currentTask = taskId;
            status.lastActivity = new Date();
            status.executionCount++;
        }

        this.logEvent({
            timestamp: new Date(),
            eventType: "agent_started",
            agentId,
            message: `${AGENT_REGISTRY[agentId].name} started task: ${taskId}`,
            severity: "info"
        });

        this.printStatusUpdate(agentId, "STARTED", taskId);
    }

    /**
     * Record that an agent has completed execution
     */
    completeExecution(agentId: AgentName, taskId: string, output: string): void {
        const execution = this.activeExecutions.get(taskId);
        if (execution) {
            execution.endTime = new Date();
            execution.status = "completed";
            execution.output = output;
            this.executionHistory.push(execution);
            this.activeExecutions.delete(taskId);
        }

        const status = this.agentStatuses.get(agentId);
        if (status) {
            status.status = "idle";
            status.currentTask = null;
            status.successCount++;
            status.lastOutput = output.substring(0, 500);
            status.health = "healthy";

            // Update average response time
            if (execution?.endTime && execution.startTime) {
                const responseTime = execution.endTime.getTime() - execution.startTime.getTime();
                status.averageResponseTime =
                    (status.averageResponseTime * (status.successCount - 1) + responseTime) / status.successCount;
            }
        }

        this.logEvent({
            timestamp: new Date(),
            eventType: "agent_completed",
            agentId,
            message: `${AGENT_REGISTRY[agentId].name} completed task: ${taskId}`,
            data: { outputLength: output.length },
            severity: "info"
        });

        this.printStatusUpdate(agentId, "COMPLETED", taskId);
    }

    /**
     * Record that an agent has failed
     */
    failExecution(agentId: AgentName, taskId: string, error: string): void {
        const execution = this.activeExecutions.get(taskId);
        if (execution) {
            execution.endTime = new Date();
            execution.status = "failed";
            execution.errorMessage = error;
            this.executionHistory.push(execution);
            this.activeExecutions.delete(taskId);
        }

        const status = this.agentStatuses.get(agentId);
        if (status) {
            status.status = "idle";
            status.currentTask = null;
            status.failureCount++;

            // Update health based on failure rate
            const failureRate = status.failureCount / status.executionCount;
            if (failureRate > 0.5) {
                status.health = "unhealthy";
            } else if (failureRate > 0.2) {
                status.health = "degraded";
            }
        }

        this.logEvent({
            timestamp: new Date(),
            eventType: "agent_failed",
            agentId,
            message: `${AGENT_REGISTRY[agentId].name} failed task: ${taskId}`,
            data: { error },
            severity: "error"
        });

        this.printStatusUpdate(agentId, "FAILED", taskId, error);
    }

    /**
     * Record that a deviation was detected
     */
    recordDeviation(
        agentId: AgentName,
        taskId: string,
        deviationType: string,
        severity: string
    ): void {
        const execution = this.activeExecutions.get(taskId) ||
            this.executionHistory.find(e => e.taskId === taskId);
        if (execution) {
            execution.deviationDetected = true;
        }

        this.logEvent({
            timestamp: new Date(),
            eventType: "deviation_detected",
            agentId,
            message: `Deviation in ${AGENT_REGISTRY[agentId].name}: ${deviationType}`,
            data: { deviationType, severity, taskId },
            severity: severity === "critical" ? "critical" : "warning"
        });

        console.log(`\n⚠️ [MONITOR] DEVIATION DETECTED ⚠️`);
        console.log(`   Agent: ${AGENT_REGISTRY[agentId].name}`);
        console.log(`   Type: ${deviationType}`);
        console.log(`   Severity: ${severity}`);
    }

    /**
     * Record that a correction was applied
     */
    recordCorrection(agentId: AgentName, taskId: string, correction: string): void {
        const status = this.agentStatuses.get(agentId);
        if (status) {
            status.status = "correcting";
        }

        this.logEvent({
            timestamp: new Date(),
            eventType: "correction_applied",
            agentId,
            message: `Correction applied to ${AGENT_REGISTRY[agentId].name}`,
            data: { taskId, correction },
            severity: "warning"
        });

        console.log(`\n🔧 [MONITOR] CORRECTION APPLIED`);
        console.log(`   Agent: ${AGENT_REGISTRY[agentId].name}`);
        console.log(`   Correction: ${correction}`);
    }

    // ============================================
    // STATUS & REPORTING
    // ============================================

    /**
     * Get current status of a specific agent
     */
    getAgentStatus(agentId: AgentName): AgentStatus | undefined {
        return this.agentStatuses.get(agentId);
    }

    /**
     * Get all agent statuses
     */
    getAllAgentStatuses(): Map<AgentName, AgentStatus> {
        return new Map(this.agentStatuses);
    }

    /**
     * Get agents currently executing
     */
    getActiveAgents(): AgentStatus[] {
        return Array.from(this.agentStatuses.values())
            .filter(s => s.status === "executing" || s.status === "correcting");
    }

    /**
     * Get agents that have failed recent tasks
     */
    getUnhealthyAgents(): AgentStatus[] {
        return Array.from(this.agentStatuses.values())
            .filter(s => s.health === "unhealthy" || s.health === "degraded");
    }

    /**
     * Get execution history
     */
    getExecutionHistory(limit?: number): AgentExecutionRecord[] {
        const history = [...this.executionHistory].reverse();
        return limit ? history.slice(0, limit) : history;
    }

    /**
     * Get recent events
     */
    getRecentEvents(limit: number = 20): MonitoringEvent[] {
        return [...this.events].reverse().slice(0, limit);
    }

    /**
     * Print comprehensive status dashboard
     */
    printDashboard(): void {
        console.log(`\n`);
        console.log(`╔═══════════════════════════════════════════════════════════════════════════════╗`);
        console.log(`║                    🎛️  AGENT MONITORING DASHBOARD                             ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣`);

        // Tier 1
        console.log(`║                                                                               ║`);
        console.log(`║  📊 TIER 1 (CORE)                                                             ║`);
        this.printAgentRow("auth_agent");
        this.printAgentRow("db_agent");
        this.printAgentRow("api_agent");

        // Tier 2
        console.log(`║                                                                               ║`);
        console.log(`║  🔧 TIER 2 (SPECIALIZED)                                                      ║`);
        this.printAgentRow("security_agent");
        this.printAgentRow("queue_agent");
        this.printAgentRow("cicd_agent");

        // Tier 3
        console.log(`║                                                                               ║`);
        console.log(`║  🛠️  TIER 3 (SUPPORTING)                                                       ║`);
        this.printAgentRow("monitoring_agent");
        this.printAgentRow("test_agent");
        this.printAgentRow("infra_agent");

        // Tier 4
        console.log(`║                                                                               ║`);
        console.log(`║  🌐 TIER 4 (UNIVERSAL)                                                        ║`);
        this.printAgentRow("codegen_agent");
        this.printAgentRow("microservice_agent");
        this.printAgentRow("email_agent");

        console.log(`║                                                                               ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣`);

        // Summary stats
        const total = this.agentStatuses.size;
        const active = this.getActiveAgents().length;
        const unhealthy = this.getUnhealthyAgents().length;
        const totalExecutions = this.executionHistory.length;

        console.log(`║  📈 SUMMARY: ${active} active | ${total - active - unhealthy} idle | ${unhealthy} issues | ${totalExecutions} total executions  ║`);
        console.log(`╚═══════════════════════════════════════════════════════════════════════════════╝`);
        console.log(``);
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private logEvent(event: MonitoringEvent): void {
        this.events.push(event);
        // Keep only last 100 events
        if (this.events.length > 100) {
            this.events = this.events.slice(-100);
        }
    }

    private printStatusUpdate(
        agentId: AgentName,
        action: string,
        taskId: string,
        error?: string
    ): void {
        const emoji = action === "STARTED" ? "🚀" :
            action === "COMPLETED" ? "✅" :
                action === "FAILED" ? "❌" : "📋";

        console.log(`${emoji} [MONITOR] ${AGENT_REGISTRY[agentId].name} ${action}`);
        if (error) {
            console.log(`   Error: ${error}`);
        }
    }

    private printAgentRow(agentId: AgentName): void {
        const status = this.agentStatuses.get(agentId);
        if (!status) return;

        const statusIcon = status.status === "executing" ? "🔄" :
            status.status === "completed" ? "✅" :
                status.status === "failed" ? "❌" :
                    status.status === "correcting" ? "🔧" : "⏸️";

        const healthIcon = status.health === "healthy" ? "💚" :
            status.health === "degraded" ? "💛" :
                status.health === "unhealthy" ? "❤️" : "⚪";

        const name = status.name.padEnd(18);
        const statusText = status.status.padEnd(12);
        const execs = `${status.successCount}/${status.executionCount}`.padEnd(8);
        const avgTime = status.averageResponseTime > 0
            ? `${Math.round(status.averageResponseTime)}ms`.padEnd(10)
            : "N/A".padEnd(10);

        console.log(`║    ${statusIcon} ${name} │ ${statusText} │ ${healthIcon} │ ${execs} │ ${avgTime}  ║`);
    }
}

// Export singleton instance
export const agentMonitor = new AgentMonitor();
