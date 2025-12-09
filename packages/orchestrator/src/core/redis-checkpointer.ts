/**
 * ============================================
 * REDIS STATE PERSISTENCE & CHECKPOINTING
 * ============================================
 * 
 * Provides state persistence using Redis for:
 * - Orchestration state checkpointing
 * - Session recovery
 * - Agent state caching
 * - Distributed state coordination
 */

import { createClient, RedisClientType } from "redis";
import { TeamState } from "../state";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface CheckpointData {
    id: string;
    timestamp: Date;
    state: Partial<TeamState>;
    metadata: CheckpointMetadata;
}

export interface CheckpointMetadata {
    sessionId: string;
    stepNumber: number;
    executedAgents: string[];
    lastAgentId: string | null;
    progress: number;
    isRecoverable: boolean;
}

export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
}

// ============================================
// REDIS CHECKPOINTER CLASS
// ============================================

export class RedisCheckpointer {
    private client: RedisClientType | null = null;
    private isConnected: boolean = false;
    private keyPrefix: string;
    private sessionId: string;

    constructor(config?: Partial<RedisConfig>) {
        this.keyPrefix = config?.keyPrefix || "loveable:orchestrator";
        this.sessionId = this.generateSessionId();
    }

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    /**
     * Connect to Redis
     */
    async connect(config?: Partial<RedisConfig>): Promise<boolean> {
        if (this.isConnected) {
            return true;
        }

        try {
            const url = this.buildRedisUrl(config);

            this.client = createClient({ url });

            this.client.on("error", (err) => {
                console.error("🔴 [Redis] Connection error:", err.message);
                this.isConnected = false;
            });

            this.client.on("connect", () => {
                console.log("🟢 [Redis] Connected successfully");
            });

            this.client.on("reconnecting", () => {
                console.log("🟡 [Redis] Reconnecting...");
            });

            await this.client.connect();
            this.isConnected = true;

            console.log(`✅ [Redis] Checkpointer initialized`);
            console.log(`   Session: ${this.sessionId}`);
            console.log(`   Prefix: ${this.keyPrefix}`);

            return true;
        } catch (error: any) {
            console.warn(`⚠️ [Redis] Could not connect: ${error.message}`);
            console.warn(`   Checkpointing will use in-memory fallback`);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Disconnect from Redis
     */
    async disconnect(): Promise<void> {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
            this.isConnected = false;
            console.log("🔴 [Redis] Disconnected");
        }
    }

    /**
     * Check if connected
     */
    isActive(): boolean {
        return this.isConnected && this.client !== null;
    }

    // ============================================
    // CHECKPOINTING OPERATIONS
    // ============================================

    /**
     * Save a checkpoint
     */
    async saveCheckpoint(
        state: Partial<TeamState>,
        stepNumber: number
    ): Promise<string> {
        const checkpoint: CheckpointData = {
            id: this.generateCheckpointId(stepNumber),
            timestamp: new Date(),
            state: this.serializeState(state),
            metadata: {
                sessionId: this.sessionId,
                stepNumber,
                executedAgents: state.executedAgents || [],
                lastAgentId: state.next || null,
                progress: this.calculateProgress(state),
                isRecoverable: true
            }
        };

        if (this.isActive() && this.client) {
            try {
                // Save checkpoint
                await this.client.set(
                    this.key(`checkpoint:${checkpoint.id}`),
                    JSON.stringify(checkpoint),
                    { EX: 86400 } // 24 hour TTL
                );

                // Update latest checkpoint pointer
                await this.client.set(
                    this.key(`session:${this.sessionId}:latest`),
                    checkpoint.id
                );

                // Add to checkpoint history
                await this.client.lPush(
                    this.key(`session:${this.sessionId}:history`),
                    checkpoint.id
                );

                // Trim history to last 100 checkpoints
                await this.client.lTrim(
                    this.key(`session:${this.sessionId}:history`),
                    0,
                    99
                );

                console.log(`💾 [Redis] Checkpoint saved: ${checkpoint.id}`);
            } catch (error: any) {
                console.error(`❌ [Redis] Checkpoint save failed:`, error.message);
            }
        } else {
            // In-memory fallback
            this.inMemoryCheckpoints.set(checkpoint.id, checkpoint);
            console.log(`💾 [Memory] Checkpoint saved: ${checkpoint.id}`);
        }

        return checkpoint.id;
    }

    /**
     * Load a checkpoint
     */
    async loadCheckpoint(checkpointId: string): Promise<CheckpointData | null> {
        if (this.isActive() && this.client) {
            try {
                const data = await this.client.get(
                    this.key(`checkpoint:${checkpointId}`)
                );

                if (data) {
                    const checkpoint = JSON.parse(data) as CheckpointData;
                    checkpoint.timestamp = new Date(checkpoint.timestamp);
                    return checkpoint;
                }
            } catch (error: any) {
                console.error(`❌ [Redis] Checkpoint load failed:`, error.message);
            }
        } else {
            // In-memory fallback
            return this.inMemoryCheckpoints.get(checkpointId) || null;
        }

        return null;
    }

    /**
     * Load the latest checkpoint for current session
     */
    async loadLatestCheckpoint(): Promise<CheckpointData | null> {
        if (this.isActive() && this.client) {
            try {
                const latestId = await this.client.get(
                    this.key(`session:${this.sessionId}:latest`)
                );

                if (latestId) {
                    return this.loadCheckpoint(latestId);
                }
            } catch (error: any) {
                console.error(`❌ [Redis] Latest checkpoint load failed:`, error.message);
            }
        } else {
            // Return most recent in-memory checkpoint
            const checkpoints = Array.from(this.inMemoryCheckpoints.values());
            if (checkpoints.length > 0) {
                return checkpoints.sort((a, b) =>
                    b.timestamp.getTime() - a.timestamp.getTime()
                )[0];
            }
        }

        return null;
    }

    /**
     * Get checkpoint history
     */
    async getCheckpointHistory(limit: number = 10): Promise<CheckpointData[]> {
        const checkpoints: CheckpointData[] = [];

        if (this.isActive() && this.client) {
            try {
                const ids = await this.client.lRange(
                    this.key(`session:${this.sessionId}:history`),
                    0,
                    limit - 1
                );

                for (const id of ids) {
                    const checkpoint = await this.loadCheckpoint(id);
                    if (checkpoint) {
                        checkpoints.push(checkpoint);
                    }
                }
            } catch (error: any) {
                console.error(`❌ [Redis] History load failed:`, error.message);
            }
        } else {
            // In-memory fallback
            return Array.from(this.inMemoryCheckpoints.values())
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, limit);
        }

        return checkpoints;
    }

    // ============================================
    // AGENT STATE CACHING
    // ============================================

    /**
     * Cache agent output for quick retrieval
     */
    async cacheAgentOutput(
        agentId: string,
        taskId: string,
        output: string
    ): Promise<void> {
        if (this.isActive() && this.client) {
            try {
                await this.client.set(
                    this.key(`agent:${agentId}:output:${taskId}`),
                    output,
                    { EX: 3600 } // 1 hour TTL
                );
            } catch (error: any) {
                console.error(`❌ [Redis] Agent cache failed:`, error.message);
            }
        }
    }

    /**
     * Get cached agent output
     */
    async getAgentOutput(agentId: string, taskId: string): Promise<string | null> {
        if (this.isActive() && this.client) {
            try {
                return await this.client.get(
                    this.key(`agent:${agentId}:output:${taskId}`)
                );
            } catch (error: any) {
                console.error(`❌ [Redis] Agent cache get failed:`, error.message);
            }
        }
        return null;
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Get current session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }

    /**
     * Set session ID (for recovery)
     */
    setSessionId(sessionId: string): void {
        this.sessionId = sessionId;
    }

    /**
     * Create new session
     */
    newSession(): string {
        this.sessionId = this.generateSessionId();
        return this.sessionId;
    }

    /**
     * List active sessions
     */
    async listSessions(): Promise<string[]> {
        if (this.isActive() && this.client) {
            try {
                const keys = await this.client.keys(this.key("session:*:latest"));
                return keys.map(k => k.split(":")[2]);
            } catch (error: any) {
                console.error(`❌ [Redis] Session list failed:`, error.message);
            }
        }
        return [this.sessionId];
    }

    // ============================================
    // IN-MEMORY FALLBACK
    // ============================================

    private inMemoryCheckpoints: Map<string, CheckpointData> = new Map();

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private buildRedisUrl(config?: Partial<RedisConfig>): string {
        const host = config?.host || process.env.REDIS_HOST || "localhost";
        const port = config?.port || parseInt(process.env.REDIS_PORT || "6379");
        const password = config?.password || process.env.REDIS_PASSWORD;
        const db = config?.db || parseInt(process.env.REDIS_DB || "0");

        if (password) {
            return `redis://:${password}@${host}:${port}/${db}`;
        }
        return `redis://${host}:${port}/${db}`;
    }

    private key(suffix: string): string {
        return `${this.keyPrefix}:${suffix}`;
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    private generateCheckpointId(stepNumber: number): string {
        return `cp_${this.sessionId}_${stepNumber}_${Date.now()}`;
    }

    private serializeState(state: Partial<TeamState>): Partial<TeamState> {
        // Remove non-serializable parts
        const serializable: any = { ...state };

        // Convert messages to simple format
        if (serializable.messages) {
            serializable.messages = serializable.messages.map((m: any) => ({
                type: m._getType?.() || "unknown",
                content: m.content?.toString() || "",
                name: m.name
            }));
        }

        // Convert dates
        if (serializable.thinking?.lastThoughtAt) {
            serializable.thinking.lastThoughtAt = serializable.thinking.lastThoughtAt.toISOString();
        }

        return serializable;
    }

    private calculateProgress(state: Partial<TeamState>): number {
        if (!state.taskList) return 0;
        return state.taskList.progress || 0;
    }
}

// Export singleton instance
export const redisCheckpointer = new RedisCheckpointer();
