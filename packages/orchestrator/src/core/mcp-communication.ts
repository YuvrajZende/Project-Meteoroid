/**
 * ============================================
 * MCP COMMUNICATION LAYER
 * ============================================
 * 
 * Model Context Protocol (MCP) implementation for
 * standardized agent-to-agent and agent-to-tool communication.
 */

import { EventEmitter } from "events";

// ============================================
// MCP TYPES AND INTERFACES
// ============================================

export interface MCPMessage {
    id: string;
    type: MCPMessageType;
    source: string;
    target: string;
    timestamp: Date;
    payload: any;
    metadata?: MCPMetadata;
}

export interface MCPMetadata {
    priority: "low" | "normal" | "high" | "critical";
    ttl?: number; // Time to live in ms
    correlationId?: string;
    replyTo?: string;
}

export type MCPMessageType =
    | "request"
    | "response"
    | "event"
    | "error"
    | "heartbeat"
    | "task_assignment"
    | "task_update"
    | "correction"
    | "query"
    | "broadcast";

export interface MCPHandler {
    (message: MCPMessage): Promise<MCPMessage | void>;
}

export interface MCPChannel {
    name: string;
    subscribers: Set<string>;
    handler?: MCPHandler;
}

// ============================================
// MCP COMMUNICATION HUB
// ============================================

export class MCPCommunicationHub extends EventEmitter {
    private channels: Map<string, MCPChannel> = new Map();
    private handlers: Map<string, MCPHandler> = new Map();
    private messageQueue: MCPMessage[] = [];
    private pendingResponses: Map<string, {
        resolve: (value: MCPMessage) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();

    constructor() {
        super();
        this.initializeDefaultChannels();
    }

    /**
     * Initialize default communication channels
     */
    private initializeDefaultChannels(): void {
        // Orchestrator broadcast channel
        this.createChannel("orchestrator:broadcast");

        // Agent-specific channels
        const agents = [
            "auth_agent", "db_agent", "api_agent",
            "security_agent", "queue_agent", "cicd_agent",
            "monitoring_agent", "test_agent", "infra_agent",
            "codegen_agent", "microservice_agent", "email_agent"
        ];

        for (const agent of agents) {
            this.createChannel(`agent:${agent}`);
            this.createChannel(`agent:${agent}:tasks`);
            this.createChannel(`agent:${agent}:corrections`);
        }

        // System channels
        this.createChannel("system:health");
        this.createChannel("system:errors");
        this.createChannel("system:metrics");

        console.log(`📡 [MCP] Initialized ${this.channels.size} communication channels`);
    }

    // ============================================
    // CHANNEL MANAGEMENT
    // ============================================

    /**
     * Create a new communication channel
     */
    createChannel(name: string): void {
        if (!this.channels.has(name)) {
            this.channels.set(name, {
                name,
                subscribers: new Set()
            });
        }
    }

    /**
     * Subscribe to a channel
     */
    subscribe(channelName: string, subscriberId: string, handler?: MCPHandler): void {
        const channel = this.channels.get(channelName);
        if (channel) {
            channel.subscribers.add(subscriberId);
            if (handler) {
                this.handlers.set(`${channelName}:${subscriberId}`, handler);
            }
            console.log(`📡 [MCP] ${subscriberId} subscribed to ${channelName}`);
        }
    }

    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channelName: string, subscriberId: string): void {
        const channel = this.channels.get(channelName);
        if (channel) {
            channel.subscribers.delete(subscriberId);
            this.handlers.delete(`${channelName}:${subscriberId}`);
        }
    }

    // ============================================
    // MESSAGE OPERATIONS
    // ============================================

    /**
     * Send a message to a specific target
     */
    async send(message: Omit<MCPMessage, "id" | "timestamp">): Promise<MCPMessage> {
        const fullMessage: MCPMessage = {
            ...message,
            id: this.generateMessageId(),
            timestamp: new Date()
        };

        this.messageQueue.push(fullMessage);
        this.emit("message", fullMessage);

        // Find handlers for this target
        const targetChannel = this.channels.get(message.target);
        if (targetChannel) {
            for (const subscriber of targetChannel.subscribers) {
                const handler = this.handlers.get(`${message.target}:${subscriber}`);
                if (handler) {
                    try {
                        const response = await handler(fullMessage);
                        if (response) {
                            return response;
                        }
                    } catch (error) {
                        console.error(`📡 [MCP] Handler error for ${subscriber}:`, error);
                    }
                }
            }
        }

        return fullMessage;
    }

    /**
     * Send a message and wait for a response
     */
    async sendAndWait(
        message: Omit<MCPMessage, "id" | "timestamp">,
        timeoutMs: number = 30000
    ): Promise<MCPMessage> {
        const fullMessage: MCPMessage = {
            ...message,
            id: this.generateMessageId(),
            timestamp: new Date(),
            metadata: {
                ...message.metadata,
                priority: message.metadata?.priority || "normal"
            }
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingResponses.delete(fullMessage.id);
                reject(new Error(`MCP message timeout: ${fullMessage.id}`));
            }, timeoutMs);

            this.pendingResponses.set(fullMessage.id, { resolve, reject, timeout });

            this.send(fullMessage).catch(reject);
        });
    }

    /**
     * Broadcast a message to all subscribers of a channel
     */
    async broadcast(channelName: string, payload: any, source: string = "orchestrator"): Promise<void> {
        const channel = this.channels.get(channelName);
        if (!channel) {
            console.warn(`📡 [MCP] Channel not found: ${channelName}`);
            return;
        }

        const message: MCPMessage = {
            id: this.generateMessageId(),
            type: "broadcast",
            source,
            target: channelName,
            timestamp: new Date(),
            payload,
            metadata: { priority: "normal" }
        };

        this.emit("broadcast", message);

        for (const subscriber of channel.subscribers) {
            const handler = this.handlers.get(`${channelName}:${subscriber}`);
            if (handler) {
                try {
                    await handler(message);
                } catch (error) {
                    console.error(`📡 [MCP] Broadcast handler error:`, error);
                }
            }
        }
    }

    /**
     * Resolve a pending response
     */
    resolveResponse(correlationId: string, response: MCPMessage): void {
        const pending = this.pendingResponses.get(correlationId);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(response);
            this.pendingResponses.delete(correlationId);
        }
    }

    // ============================================
    // TASK OPERATIONS
    // ============================================

    /**
     * Send a task assignment to an agent
     */
    async assignTask(agentId: string, task: {
        taskId: string;
        description: string;
        priority: number;
        dependencies: string[];
        validationCriteria: string[];
    }): Promise<MCPMessage> {
        return this.send({
            type: "task_assignment",
            source: "orchestrator",
            target: `agent:${agentId}:tasks`,
            payload: task,
            metadata: { priority: "high" }
        });
    }

    /**
     * Send a correction to an agent
     */
    async sendCorrection(agentId: string, correction: {
        taskId: string;
        deviationType: string;
        instructions: string;
    }): Promise<MCPMessage> {
        return this.send({
            type: "correction",
            source: "orchestrator",
            target: `agent:${agentId}:corrections`,
            payload: correction,
            metadata: { priority: "critical" }
        });
    }

    /**
     * Request a task update from an agent
     */
    async requestTaskUpdate(agentId: string, taskId: string): Promise<MCPMessage> {
        return this.sendAndWait({
            type: "query",
            source: "orchestrator",
            target: `agent:${agentId}`,
            payload: { query: "task_status", taskId }
        });
    }

    // ============================================
    // HEALTH & DIAGNOSTICS
    // ============================================

    /**
     * Send heartbeat to an agent
     */
    async sendHeartbeat(agentId: string): Promise<boolean> {
        try {
            const response = await this.sendAndWait({
                type: "heartbeat",
                source: "orchestrator",
                target: `agent:${agentId}`,
                payload: { time: Date.now() }
            }, 5000);

            return response.type === "response";
        } catch {
            return false;
        }
    }

    /**
     * Get channel statistics
     */
    getChannelStats(): Record<string, { subscribers: number; messageCount: number }> {
        const stats: Record<string, { subscribers: number; messageCount: number }> = {};

        for (const [name, channel] of this.channels) {
            stats[name] = {
                subscribers: channel.subscribers.size,
                messageCount: this.messageQueue.filter(m =>
                    m.target === name || m.source === name
                ).length
            };
        }

        return stats;
    }

    /**
     * Get message queue length
     */
    getQueueLength(): number {
        return this.messageQueue.length;
    }

    /**
     * Clear old messages from queue
     */
    cleanupQueue(maxAgeMs: number = 3600000): void {
        const cutoff = Date.now() - maxAgeMs;
        this.messageQueue = this.messageQueue.filter(m =>
            m.timestamp.getTime() > cutoff
        );
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private generateMessageId(): string {
        return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export singleton instance
export const mcpHub = new MCPCommunicationHub();
