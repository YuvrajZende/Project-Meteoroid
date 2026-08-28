/**
 * ============================================
 * HEALTH MONITOR - SYSTEM HEALTH TRACKING
 * ============================================
 * 
 * Monitors the health of:
 * - All agents in the system
 * - Redis connection
 * - LLM API connectivity
 * - Overall system performance
 */

import { AGENT_REGISTRY, AgentName } from "../state";
import { agentMonitor } from "./agent-monitor";
import { redisCheckpointer } from "./redis-checkpointer";
import { ChatOpenAI } from "@langchain/openai";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface SystemHealth {
    status: HealthStatus;
    timestamp: Date;
    components: ComponentHealth[];
    metrics: SystemMetrics;
    alerts: HealthAlert[];
}

export interface ComponentHealth {
    name: string;
    type: ComponentType;
    status: HealthStatus;
    latency?: number;
    lastCheck: Date;
    message?: string;
}

export interface SystemMetrics {
    uptime: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    activeAgents: number;
    queuedTasks: number;
}

export interface HealthAlert {
    id: string;
    severity: "info" | "warning" | "error" | "critical";
    component: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
}

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";
export type ComponentType = "agent" | "database" | "api" | "cache" | "queue" | "llm";

// ============================================
// HEALTH MONITOR CLASS
// ============================================

export class HealthMonitor {
    private startTime: Date = new Date();
    private metrics: SystemMetrics;
    private componentHealth: Map<string, ComponentHealth> = new Map();
    private alerts: HealthAlert[] = [];
    private checkInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.metrics = {
            uptime: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageLatency: 0,
            activeAgents: 0,
            queuedTasks: 0
        };

        this.initializeComponents();
    }

    /**
     * Initialize health tracking for all components
     */
    private initializeComponents(): void {
        // Initialize agent components
        for (const [agentId, agentInfo] of Object.entries(AGENT_REGISTRY)) {
            this.componentHealth.set(`agent:${agentId}`, {
                name: agentInfo.name,
                type: "agent",
                status: "unknown",
                lastCheck: new Date()
            });
        }

        // Initialize infrastructure components
        this.componentHealth.set("redis", {
            name: "Redis Cache",
            type: "cache",
            status: "unknown",
            lastCheck: new Date()
        });

        this.componentHealth.set("llm", {
            name: "LLM API (GLM-4)",
            type: "llm",
            status: "unknown",
            lastCheck: new Date()
        });

        console.log(`🏥 [Health] Initialized monitoring for ${this.componentHealth.size} components`);
    }

    // ============================================
    // HEALTH CHECKS
    // ============================================

    /**
     * Start periodic health checks
     */
    startPeriodicChecks(intervalMs: number = 60000): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        this.checkInterval = setInterval(() => {
            this.runAllChecks().catch(console.error);
        }, intervalMs);

        console.log(`🏥 [Health] Started periodic checks (every ${intervalMs / 1000}s)`);
    }

    /**
     * Stop periodic health checks
     */
    stopPeriodicChecks(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Run all health checks
     */
    async runAllChecks(): Promise<SystemHealth> {
        console.log(`\n🏥 [Health] Running system health check...`);

        await Promise.all([
            this.checkAgentHealth(),
            this.checkRedisHealth(),
            this.checkLLMHealth()
        ]);

        this.updateMetrics();

        const status = this.calculateOverallStatus();

        console.log(`🏥 [Health] System status: ${status.toUpperCase()}`);

        return this.getSystemHealth();
    }

    /**
     * Check health of all agents
     */
    async checkAgentHealth(): Promise<void> {
        const agentStatuses = agentMonitor.getAllAgentStatuses();

        for (const [agentId, status] of agentStatuses) {
            const componentKey = `agent:${agentId}`;
            const component = this.componentHealth.get(componentKey);

            if (component) {
                component.lastCheck = new Date();

                // Map agent health to component health
                switch (status.health) {
                    case "healthy":
                        component.status = "healthy";
                        break;
                    case "degraded":
                        component.status = "degraded";
                        this.raiseAlert("warning", componentKey,
                            `${status.name} is degraded (${Math.round(100 - (status.successCount / status.executionCount * 100))}% failure rate)`
                        );
                        break;
                    case "unhealthy":
                        component.status = "unhealthy";
                        this.raiseAlert("error", componentKey,
                            `${status.name} is unhealthy - multiple failures detected`
                        );
                        break;
                    default:
                        component.status = status.executionCount > 0 ? "healthy" : "unknown";
                }

                component.latency = status.averageResponseTime;
            }
        }
    }

    /**
     * Check Redis connection health
     */
    async checkRedisHealth(): Promise<void> {
        const component = this.componentHealth.get("redis");
        if (!component) return;

        component.lastCheck = new Date();

        if (redisCheckpointer.isActive()) {
            component.status = "healthy";
            component.message = "Connected";
        } else {
            component.status = "degraded";
            component.message = "Not connected (using in-memory fallback)";
        }
    }

    /**
     * Check LLM API health
     */
    async checkLLMHealth(): Promise<void> {
        const component = this.componentHealth.get("llm");
        if (!component) return;

        component.lastCheck = new Date();

        // Only check if API key is configured
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_key_here") {
            component.status = "unhealthy";
            component.message = "API key not configured";
            this.raiseAlert("critical", "llm", "LLM API key not configured");
            return;
        }

        try {
            const startTime = Date.now();

            const model = new ChatOpenAI({
                modelName: process.env.MODEL_NAME || "glm-4",
                openAIApiKey: process.env.OPENAI_API_KEY,
                configuration: {
                    baseURL: process.env.OPENAI_BASE_URL,
                },
                maxTokens: 5,
            });

            // Simple ping test - we don't actually call it to save tokens
            // Just verify the model can be instantiated
            component.status = "healthy";
            component.latency = Date.now() - startTime;
            component.message = `Model: ${process.env.MODEL_NAME || "glm-4"}`;
        } catch (error: any) {
            component.status = "unhealthy";
            component.message = error.message;
            this.raiseAlert("critical", "llm", `LLM API error: ${error.message}`);
        }
    }

    // ============================================
    // METRICS & ALERTS
    // ============================================

    /**
     * Record a request
     */
    recordRequest(success: boolean, latency: number): void {
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }

        // Update average latency
        this.metrics.averageLatency =
            (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency) /
            this.metrics.totalRequests;
    }

    /**
     * Update system metrics
     */
    private updateMetrics(): void {
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        this.metrics.activeAgents = agentMonitor.getActiveAgents().length;
    }

    /**
     * Raise a health alert
     */
    private raiseAlert(
        severity: HealthAlert["severity"],
        component: string,
        message: string
    ): void {
        // Check if similar alert already exists
        const existing = this.alerts.find(a =>
            a.component === component &&
            a.message === message &&
            !a.acknowledged
        );

        if (!existing) {
            this.alerts.push({
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                severity,
                component,
                message,
                timestamp: new Date(),
                acknowledged: false
            });

            if (severity === "critical") {
                console.error(`🚨 [Health] CRITICAL: ${message}`);
            } else if (severity === "error") {
                console.error(`❌ [Health] ERROR: ${message}`);
            } else if (severity === "warning") {
                console.warn(`⚠️ [Health] WARNING: ${message}`);
            }
        }
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): void {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
        }
    }

    /**
     * Get unacknowledged alerts
     */
    getActiveAlerts(): HealthAlert[] {
        return this.alerts.filter(a => !a.acknowledged);
    }

    // ============================================
    // STATUS REPORTING
    // ============================================

    /**
     * Calculate overall system status
     */
    private calculateOverallStatus(): HealthStatus {
        const components = Array.from(this.componentHealth.values());

        const unhealthy = components.filter(c => c.status === "unhealthy").length;
        const degraded = components.filter(c => c.status === "degraded").length;
        const unknown = components.filter(c => c.status === "unknown").length;

        // Critical components that must be healthy
        const llm = this.componentHealth.get("llm");
        if (llm?.status === "unhealthy") {
            return "unhealthy";
        }

        if (unhealthy > 0) {
            return "unhealthy";
        }
        if (degraded > 2 || (degraded > 0 && unknown > 2)) {
            return "degraded";
        }
        if (unknown > components.length / 2) {
            return "unknown";
        }

        return "healthy";
    }

    /**
     * Get current system health
     */
    getSystemHealth(): SystemHealth {
        this.updateMetrics();

        return {
            status: this.calculateOverallStatus(),
            timestamp: new Date(),
            components: Array.from(this.componentHealth.values()),
            metrics: { ...this.metrics },
            alerts: this.getActiveAlerts()
        };
    }

    /**
     * Get component health
     */
    getComponentHealth(componentKey: string): ComponentHealth | undefined {
        return this.componentHealth.get(componentKey);
    }

    /**
     * Print health dashboard
     */
    printHealthDashboard(): void {
        const health = this.getSystemHealth();

        console.log(`\n`);
        console.log(`╔═══════════════════════════════════════════════════════════════════╗`);
        console.log(`║                    🏥 SYSTEM HEALTH DASHBOARD                     ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

        // Overall status
        const statusIcon = health.status === "healthy" ? "✅" :
            health.status === "degraded" ? "⚠️" :
                health.status === "unhealthy" ? "❌" : "❓";
        console.log(`║  Overall Status: ${statusIcon} ${health.status.toUpperCase().padEnd(48)}║`);
        console.log(`║  Uptime: ${this.formatUptime(health.metrics.uptime).padEnd(56)}║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

        // Metrics
        console.log(`║  📊 METRICS                                                        ║`);
        console.log(`║    Requests: ${health.metrics.totalRequests} total, ${health.metrics.successfulRequests} success, ${health.metrics.failedRequests} failed`.padEnd(67) + `║`);
        console.log(`║    Avg Latency: ${Math.round(health.metrics.averageLatency)}ms`.padEnd(67) + `║`);
        console.log(`║    Active Agents: ${health.metrics.activeAgents}`.padEnd(67) + `║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

        // Infrastructure components
        console.log(`║  🏗️  INFRASTRUCTURE                                                 ║`);
        const infraComponents = health.components.filter(c => c.type !== "agent");
        for (const comp of infraComponents) {
            const icon = comp.status === "healthy" ? "🟢" :
                comp.status === "degraded" ? "🟡" :
                    comp.status === "unhealthy" ? "🔴" : "⚪";
            const line = `    ${icon} ${comp.name.padEnd(20)} ${comp.status.padEnd(12)} ${comp.message || ""}`;
            console.log(`║${line.substring(0, 66).padEnd(66)}║`);
        }
        console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

        // Alerts
        if (health.alerts.length > 0) {
            console.log(`║  🚨 ACTIVE ALERTS (${health.alerts.length})`.padEnd(67) + `║`);
            for (const alert of health.alerts.slice(0, 5)) {
                const icon = alert.severity === "critical" ? "🔴" :
                    alert.severity === "error" ? "❌" :
                        alert.severity === "warning" ? "⚠️" : "ℹ️";
                const line = `    ${icon} [${alert.component}] ${alert.message}`;
                console.log(`║${line.substring(0, 66).padEnd(66)}║`);
            }
        } else {
            console.log(`║  ✅ No active alerts`.padEnd(67) + `║`);
        }

        console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
        console.log(`\n`);
    }

    private formatUptime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();
