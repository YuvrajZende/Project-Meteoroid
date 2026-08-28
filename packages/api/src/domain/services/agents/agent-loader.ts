/**
 * Agent Loader
 * Dynamically scans and loads agents from the agents/ directory
 * Implements the plug-and-play architecture
 */

import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { isValidAgent, type IAgent } from '@loveable/shared';
import { AgentRegistry } from '../../../services/registry/agent-registry.js';

/**
 * Agent loading result
 */
interface AgentLoadResult {
    loaded: string[];
    failed: Array<{ path: string; error: string }>;
    skipped: string[];
}

/**
 * Agent loader configuration
 */
interface AgentLoaderConfig {
    agentsDir?: string;
    autoInitialize?: boolean;
    modelName?: string;
    verbose?: boolean;
}

/**
 * AgentLoader - Scans directories and loads valid agents
 */
export class AgentLoader {
    private config: Required<AgentLoaderConfig>;
    private registry: AgentRegistry;

    constructor(config: AgentLoaderConfig = {}) {
        this.config = {
            agentsDir: config.agentsDir || 'agents',
            autoInitialize: config.autoInitialize ?? true,
            modelName: config.modelName || 'gpt-4',
            verbose: config.verbose ?? false,
        };
        this.registry = AgentRegistry.getInstance();
    }

    /**
     * Scan and load all agents from the agents directory
     */
    public async loadAllAgents(): Promise<AgentLoadResult> {
        const result: AgentLoadResult = {
            loaded: [],
            failed: [],
            skipped: [],
        };

        const agentsPath = resolve(process.cwd(), this.config.agentsDir);

        try {
            await stat(agentsPath);
        } catch {
            return result;
        }

        // Scan tier directories
        const tierDirs = ['core', 'specialized', 'support'];

        for (const tierDir of tierDirs) {
            const tierPath = join(agentsPath, tierDir);

            try {
                await stat(tierPath);
            } catch {
                continue;
            }

            const agentDirs = await readdir(tierPath);

            for (const agentDir of agentDirs) {
                if (agentDir.startsWith('_')) {
                    result.skipped.push(join(tierDir, agentDir));
                    continue;
                }

                const agentPath = join(tierPath, agentDir);
                const agentStat = await stat(agentPath);

                if (!agentStat.isDirectory()) continue;

                const indexFile = await this.findIndexFile(agentPath);

                if (!indexFile) {
                    result.skipped.push(join(tierDir, agentDir));
                    continue;
                }

                try {
                    const agent = await this.loadAgent(indexFile);

                    if (agent) {
                        this.registry.register(agent, agentPath);
                        result.loaded.push(agent.id);
                    } else {
                        result.skipped.push(join(tierDir, agentDir));
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    result.failed.push({
                        path: join(tierDir, agentDir),
                        error: errorMessage,
                    });
                }
            }
        }

        // Auto-initialize if configured (silently)
        if (this.config.autoInitialize && result.loaded.length > 0) {
            await this.registry.initializeAll({
                modelName: this.config.modelName,
            });
        }

        return result;
    }

    /**
     * Find the index file in an agent directory
     */
    private async findIndexFile(agentPath: string): Promise<string | null> {
        const possibleFiles = ['index.ts', 'index.js', 'index.mjs'];

        for (const file of possibleFiles) {
            const filePath = join(agentPath, file);
            try {
                await stat(filePath);
                return filePath;
            } catch {
                // File doesn't exist
            }
        }

        return null;
    }

    /**
     * Load an agent from a file
     */
    private async loadAgent(filePath: string): Promise<IAgent | null> {
        const fileUrl = pathToFileURL(filePath).href;
        const module = await import(fileUrl);

        let agent: IAgent | null = null;

        // Check default export
        if (module.default) {
            if (isValidAgent(module.default)) {
                agent = module.default;
            } else if (typeof module.default === 'function') {
                try {
                    const instance = new module.default();
                    if (isValidAgent(instance)) {
                        agent = instance;
                    }
                } catch {
                    // Not a valid class
                }
            }
        }

        // Check named exports
        if (!agent) {
            for (const key of Object.keys(module)) {
                const value = module[key];

                if (isValidAgent(value)) {
                    agent = value;
                    break;
                }

                if (typeof value === 'function' && key !== 'default') {
                    try {
                        const instance = new value();
                        if (isValidAgent(instance)) {
                            agent = instance;
                            break;
                        }
                    } catch {
                        // Not a valid class
                    }
                }
            }
        }

        return agent;
    }

    /**
     * Reload all agents
     */
    public async reloadAll(): Promise<AgentLoadResult> {
        await this.registry.shutdownAll();
        this.registry.clear();
        return this.loadAllAgents();
    }

    /**
     * Get the agent registry
     */
    public getRegistry(): AgentRegistry {
        return this.registry;
    }
}

// Export factory function
export function createAgentLoader(config?: AgentLoaderConfig): AgentLoader {
    return new AgentLoader(config);
}
