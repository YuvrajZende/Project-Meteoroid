/**
 * Agent Loader
 * Dynamically scans and loads agents from the agents/ directory
 * Implements the plug-and-play architecture
 */

import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { isValidAgent, type IAgent } from '@loveable/shared';
import { AgentRegistry } from './agent-registry.js';

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
    /** Base directory for agents (default: 'agents') */
    agentsDir?: string;

    /** Whether to auto-initialize agents after loading */
    autoInitialize?: boolean;

    /** Model name to use for initialization */
    modelName?: string;

    /** Enable verbose logging */
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

        console.log('[AGENT-LOADER] Scanning for agents...');
        this.log(`Base directory: ${agentsPath}`);

        try {
            // Check if agents directory exists
            await stat(agentsPath);
        } catch {
            console.log('[AGENT-LOADER] Agents directory not found. Creating structure...');
            return result;
        }

        // Scan tier directories (core, specialized, support)
        const tierDirs = ['core', 'specialized', 'support'];

        for (const tierDir of tierDirs) {
            const tierPath = join(agentsPath, tierDir);

            try {
                await stat(tierPath);
            } catch {
                this.log(`Tier directory not found: ${tierDir}`);
                continue;
            }

            // Scan agent directories within each tier
            const agentDirs = await readdir(tierPath);

            for (const agentDir of agentDirs) {
                // Skip template directory
                if (agentDir.startsWith('_')) {
                    result.skipped.push(join(tierDir, agentDir));
                    continue;
                }

                const agentPath = join(tierPath, agentDir);
                const agentStat = await stat(agentPath);

                if (!agentStat.isDirectory()) continue;

                // Look for index.ts or index.js
                const indexFile = await this.findIndexFile(agentPath);

                if (!indexFile) {
                    result.skipped.push(join(tierDir, agentDir));
                    this.log(`No index file found in: ${agentDir}`);
                    continue;
                }

                // Try to load the agent
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
                    console.error(`[AGENT-LOADER] Failed to load agent from ${agentDir}: ${errorMessage}`);
                }
            }
        }

        // Print summary
        console.log('');
        console.log('');
        console.log('[AGENT-LOADER] Agent Loading Summary:');
        console.log(`   Loaded: ${result.loaded.length}`);
        console.log(`   Failed: ${result.failed.length}`);
        console.log(`   Skipped: ${result.skipped.length}`);
        console.log('');

        // Auto-initialize if configured
        if (this.config.autoInitialize && result.loaded.length > 0) {
            console.log('[AGENT-LOADER] Initializing agents...');
            const initResult = await this.registry.initializeAll({
                modelName: this.config.modelName,
            });

            console.log(`   Initialized: ${initResult.success.length}`);
            console.log(`   Failed: ${initResult.failed.length}`);
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
                // File doesn't exist, try next
            }
        }

        return null;
    }

    /**
     * Load an agent from a file
     */
    private async loadAgent(filePath: string): Promise<IAgent | null> {
        this.log(`Loading agent from: ${filePath}`);

        // Convert path to file URL for ESM import
        const fileUrl = pathToFileURL(filePath).href;

        // Dynamic import
        const module = await import(fileUrl);

        // Look for default export or a class that implements IAgent
        let agent: IAgent | null = null;

        // Check default export
        if (module.default) {
            if (isValidAgent(module.default)) {
                agent = module.default;
            } else if (typeof module.default === 'function') {
                // It might be a class, try to instantiate
                try {
                    const instance = new module.default();
                    if (isValidAgent(instance)) {
                        agent = instance;
                    }
                } catch {
                    this.log('Default export is not a valid agent class');
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
                        // Not a valid agent class
                    }
                }
            }
        }

        if (!agent) {
            this.log(`No valid IAgent implementation found in: ${filePath}`);
            return null;
        }

        return agent;
    }

    /**
     * Reload all agents
     */
    public async reloadAll(): Promise<AgentLoadResult> {
        console.log('🔄 Reloading all agents...');

        // Shutdown and clear existing agents
        await this.registry.shutdownAll();
        this.registry.clear();

        // Load again
        return this.loadAllAgents();
    }

    /**
     * Get the agent registry
     */
    public getRegistry(): AgentRegistry {
        return this.registry;
    }

    /**
     * Conditional logging based on verbose setting
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`  [AgentLoader] ${message}`);
        }
    }
}

// Export factory function
export function createAgentLoader(config?: AgentLoaderConfig): AgentLoader {
    return new AgentLoader(config);
}
