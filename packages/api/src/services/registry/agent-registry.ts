/**
 * Agent Registry
 * Central registry for all loaded agents
 * Provides methods to query agents by ID or capability
 */

import type { IAgent, AgentMetadata, AgentHealthStatus } from '@loveable/shared';

/**
 * AgentRegistry - Singleton registry for managing loaded agents
 */
export class AgentRegistry {
    private static instance: AgentRegistry;
    private agents: Map<string, IAgent> = new Map();
    private metadata: Map<string, AgentMetadata> = new Map();

    private constructor() {
        // Private constructor for singleton
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): AgentRegistry {
        if (!AgentRegistry.instance) {
            AgentRegistry.instance = new AgentRegistry();
        }
        return AgentRegistry.instance;
    }

    /**
     * Register an agent with the registry (silent)
     */
    public register(agent: IAgent, path: string): void {
        if (this.agents.has(agent.id)) {
            return;
        }

        this.agents.set(agent.id, agent);
        this.metadata.set(agent.id, {
            id: agent.id,
            name: agent.name,
            tier: agent.tier,
            capabilities: agent.capabilities,
            description: agent.description,
            version: agent.version,
            path,
            loadedAt: new Date(),
            status: 'uninitialized',
        });
    }

    /**
     * Unregister an agent by ID
     */
    public unregister(id: string): boolean {
        const deleted = this.agents.delete(id);
        this.metadata.delete(id);
        return deleted;
    }

    /**
     * Get an agent by ID
     */
    public getById(id: string): IAgent | undefined {
        return this.agents.get(id);
    }

    /**
     * Get agents by capability
     */
    public getByCapability(capability: string): IAgent[] {
        const result: IAgent[] = [];
        for (const agent of this.agents.values()) {
            if (agent.capabilities.includes(capability)) {
                result.push(agent);
            }
        }
        return result;
    }

    /**
     * Get agents by tier
     */
    public getByTier(tier: 1 | 2 | 3): IAgent[] {
        const result: IAgent[] = [];
        for (const agent of this.agents.values()) {
            if (agent.tier === tier) {
                result.push(agent);
            }
        }
        return result;
    }

    /**
     * Get all registered agents
     */
    public getAll(): IAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get all agent metadata
     */
    public getAllMetadata(): AgentMetadata[] {
        return Array.from(this.metadata.values());
    }

    /**
     * Get agent metadata by ID
     */
    public getMetadata(id: string): AgentMetadata | undefined {
        return this.metadata.get(id);
    }

    /**
     * Update agent status
     */
    public updateStatus(id: string, status: AgentMetadata['status']): void {
        const meta = this.metadata.get(id);
        if (meta) {
            meta.status = status;
            this.metadata.set(id, meta);
        }
    }

    /**
     * Get total count of registered agents
     */
    public get count(): number {
        return this.agents.size;
    }

    /**
     * Check if an agent is registered
     */
    public has(id: string): boolean {
        return this.agents.has(id);
    }

    /**
     * Get all unique capabilities across all agents
     */
    public getAllCapabilities(): string[] {
        const capabilities = new Set<string>();
        for (const agent of this.agents.values()) {
            for (const cap of agent.capabilities) {
                capabilities.add(cap);
            }
        }
        return Array.from(capabilities);
    }

    /**
     * Initialize all registered agents (silent)
     */
    public async initializeAll(config: { modelName?: string } = {}): Promise<{
        success: string[];
        failed: string[];
    }> {
        const success: string[] = [];
        const failed: string[] = [];

        for (const [id, agent] of this.agents) {
            try {
                await agent.initialize(config);
                this.updateStatus(id, 'healthy');
                success.push(id);
            } catch {
                this.updateStatus(id, 'unhealthy');
                failed.push(id);
            }
        }

        return { success, failed };
    }

    /**
     * Run health checks on all agents
     */
    public async healthCheckAll(): Promise<Map<string, AgentHealthStatus>> {
        const results = new Map<string, AgentHealthStatus>();

        for (const [id, agent] of this.agents) {
            try {
                const status = await agent.healthCheck();
                results.set(id, status);
                this.updateStatus(id, status.healthy ? 'healthy' : 'unhealthy');
            } catch (error) {
                results.set(id, {
                    healthy: false,
                    message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
                this.updateStatus(id, 'unhealthy');
            }
        }

        return results;
    }

    /**
     * Shutdown all agents (silent)
     */
    public async shutdownAll(): Promise<void> {
        for (const agent of this.agents.values()) {
            try {
                if (agent.shutdown) {
                    await agent.shutdown();
                }
            } catch {
                // Silent shutdown
            }
        }
    }

    /**
     * Clear all registered agents
     */
    public clear(): void {
        this.agents.clear();
        this.metadata.clear();
    }

    /**
     * Get summary of all agents
     */
    public getSummary(): {
        total: number;
        byTier: { tier1: number; tier2: number; tier3: number };
        byStatus: Record<string, number>;
        capabilities: string[];
    } {
        const byTier = { tier1: 0, tier2: 0, tier3: 0 };
        const byStatus: Record<string, number> = {};

        for (const meta of this.metadata.values()) {
            if (meta.tier === 1) byTier.tier1++;
            else if (meta.tier === 2) byTier.tier2++;
            else byTier.tier3++;

            byStatus[meta.status] = (byStatus[meta.status] || 0) + 1;
        }

        return {
            total: this.count,
            byTier,
            byStatus,
            capabilities: this.getAllCapabilities(),
        };
    }
}

// Export singleton getter
export const getAgentRegistry = (): AgentRegistry => AgentRegistry.getInstance();
