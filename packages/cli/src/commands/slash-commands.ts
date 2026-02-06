/**
 * Meteoroid CLI - Slash Commands
 * Provides slash commands similar to Claude Code's CLI
 */

import { api } from '../utils/index.js';
import { showBox, showTasks, createSpinner, showList } from '../utils/ui.js';
import { colors } from '../utils/theme.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export interface SlashCommand {
    name: string;
    description: string;
    usage: string;
    handler: (args?: string[]) => Promise<void>;
}

export const slashCommands: Record<string, SlashCommand> = {};

// ═══════════════════════════════════════════════════════════════════════════
// BUILT-IN COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

// /help - Show available commands
slashCommands['help'] = {
    name: 'help',
    description: 'Show available commands',
    usage: '/help [command]',
    handler: async (args?: string[]) => {
        console.log();
        console.log(colors.header('Available Commands'));
        console.log();

        if (args && args.length > 0) {
            // Show detailed help for a specific command
            const cmdName = args[0].replace('/', '');
            const cmd = slashCommands[cmdName];
            if (cmd) {
                console.log(colors.primary(`Command: /${cmd.name}`));
                console.log(colors.muted(`Description: ${cmd.description}`));
                console.log(colors.muted(`Usage: ${cmd.usage}`));
            } else {
                console.log(colors.error(`Unknown command: /${cmdName}`));
            }
        } else {
            // Show all commands
            const categories = {
                'General': ['help', 'status', 'clear', 'exit', 'version'],
                'AI & Code': ['generate', 'chat', 'analyze', 'optimize'],
                'Project': ['read', 'list', 'search', 'context'],
                'System': ['config', 'health', 'agents', 'services'],
            };

            for (const [category, commands] of Object.entries(categories)) {
                console.log(colors.secondary(`${category}:`));
                for (const cmd of commands) {
                    const slashCmd = slashCommands[cmd];
                    if (slashCmd) {
                        console.log(`  ${colors.primary('/' + cmd.padEnd(12))} ${colors.muted(slashCmd.description)}`);
                    }
                }
                console.log();
            }
        }
        console.log();
    },
};

// /status - Show system status
slashCommands['status'] = {
    name: 'status',
    description: 'Show system status and connection info',
    usage: '/status',
    handler: async () => {
        const spin = createSpinner('Checking system status...');

        try {
            const healthResponse = await api.checkHealth();
            spin.stop();

            if (healthResponse.online) {
                showBox(
                    'System Status',
                    `Status: ${colors.success('Online')}\n` +
                    `Server: ${api.getConfig().baseUrl}\n` +
                    `Latency: ${healthResponse.latency}ms`,
                    'success'
                );
            } else {
                showBox(
                    'System Status',
                    `Status: ${colors.error('Offline')}\n` +
                    `Server: ${api.getConfig().baseUrl}\n\n` +
                    `Please check if the server is running.`,
                    'error'
                );
            }
        } catch (err) {
            spin.stop();
            showBox(
                'System Status',
                `${colors.error('Failed to check status')}\n${String(err)}`,
                'error'
            );
        }
    },
};

// /health - Show detailed health check
slashCommands['health'] = {
    name: 'health',
    description: 'Show detailed health check',
    usage: '/health',
    handler: async () => {
        const spin = createSpinner('Running health check...');

        try {
            const deepResponse = await api.get<{
                checks: {
                    database: { status: string };
                    redis: { status: string };
                    vectorStore: { status: string; embeddingsCount?: number };
                };
            }>('/health/deep');
            spin.stop();

            if (deepResponse.success && deepResponse.data) {
                const checks = deepResponse.data.checks;
                showBox(
                    'Health Check',
                    `Database: ${checks.database.status === 'healthy' ? colors.success('OK') : colors.error('FAIL')}\n` +
                    `Redis: ${checks.redis.status === 'healthy' ? colors.success('OK') : colors.error('FAIL')}\n` +
                    `Vector Store: ${checks.vectorStore.status === 'healthy' ? colors.success('OK') : colors.error('FAIL')}\n` +
                    (checks.vectorStore.embeddingsCount ? `Embeddings: ${checks.vectorStore.embeddingsCount}\n` : ''),
                    checks.database.status === 'healthy' ? 'success' : 'error'
                );
            } else {
                showBox('Health Check', 'Health check failed', 'error');
            }
        } catch (err) {
            spin.stop();
            showBox('Health Check', `Failed: ${String(err)}`, 'error');
        }
    },
};

// /agents - Show available agents
slashCommands['agents'] = {
    name: 'agents',
    description: 'List all available AI agents',
    usage: '/agents',
    handler: async () => {
        const spin = createSpinner('Loading agents...');

        try {
            const response = await api.get<{
                count: number;
                agents: Array<{ name: string; tier: number; capabilities: string[] }>;
            }>('/agents');
            spin.stop();

            if (response.success && response.data) {
                const { count, agents } = response.data;
                console.log();
                console.log(colors.primary(`Loaded ${count} agents:\n`));

                agents.forEach(agent => {
                    console.log(`  ${colors.secondary(agent.name)} [Tier ${agent.tier}]`);
                    if (agent.capabilities.length > 0) {
                        agent.capabilities.slice(0, 3).forEach(cap => {
                            console.log(`    ${colors.muted('•')} ${cap}`);
                        });
                        if (agent.capabilities.length > 3) {
                            console.log(`    ${colors.muted(`... and ${agent.capabilities.length - 3} more`)}`);
                        }
                    }
                    console.log();
                });
            }
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Failed to load agents: ${err}`));
        }
        console.log();
    },
};

// /services - Browse service registry
slashCommands['services'] = {
    name: 'services',
    description: 'Browse available service integrations',
    usage: '/services [category]',
    handler: async (args?: string[]) => {
        const spin = createSpinner('Loading services...');

        try {
            const response = await api.get<{
                data: {
                    services: Array<{ id: string; name: string; category: string }>;
                };
            }>('/services');
            spin.stop();

            if (response.success && response.data?.data?.services) {
                const services = response.data.data.services;

                if (args && args.length > 0) {
                    const category = args[0];
                    const filtered = services.filter(s => s.category.toLowerCase() === category.toLowerCase());

                    if (filtered.length > 0) {
                        console.log();
                        console.log(colors.primary(`${category} Services:\n`));
                        filtered.forEach(s => {
                            console.log(`  ${colors.muted('•')} ${s.name} ${colors.dim(`(${s.id})`)}`);
                        });
                        console.log();
                    } else {
                        console.log(colors.warning(`No services found in category: ${category}`));
                    }
                } else {
                    // Group by category
                    const categories = [...new Set(services.map(s => s.category))];
                    console.log();
                    console.log(colors.primary(`Service Registry (${services.length} services)\n`));

                    categories.forEach(cat => {
                        const count = services.filter(s => s.category === cat).length;
                        console.log(`  ${colors.secondary(cat)}: ${count} services`);
                    });
                    console.log();
                    console.log(colors.muted('Use /services <category> to view services in a category'));
                    console.log();
                }
            }
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Failed to load services: ${err}`));
        }
        console.log();
    },
};

// /read - Read a file
slashCommands['read'] = {
    name: 'read',
    description: 'Read and display a file',
    usage: '/read <file-path>',
    handler: async (args?: string[]) => {
        if (!args || args.length === 0) {
            console.log(colors.error('Usage: /read <file-path>'));
            return;
        }

        const filePath = resolve(args[0]);

        if (!existsSync(filePath)) {
            console.log(colors.error(`File not found: ${filePath}`));
            return;
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            console.log();
            console.log(colors.primary(`File: ${filePath}\n`));
            console.log(colors.dim('─'.repeat(80)));
            console.log(content);
            console.log(colors.dim('─'.repeat(80)));
            console.log();
        } catch (err) {
            console.log(colors.error(`Failed to read file: ${err}`));
        }
        console.log();
    },
};

// /clear - Clear screen
slashCommands['clear'] = {
    name: 'clear',
    description: 'Clear the screen',
    usage: '/clear',
    handler: async () => {
        console.clear();
    },
};

// /version - Show version
slashCommands['version'] = {
    name: 'version',
    description: 'Show version information',
    usage: '/version',
    handler: async () => {
        console.log();
        console.log(colors.primary('Meteoroid CLI'));
        console.log(colors.muted('Version: 1.0.0'));
        console.log(colors.muted('A CLI for the Meteoroid AI-powered backend platform'));
        console.log();
    },
};

// /config - Show or set configuration
slashCommands['config'] = {
    name: 'config',
    description: 'Show or set CLI configuration',
    usage: '/config [key] [value]',
    handler: async (args?: string[]) => {
        const config = api.getConfig();

        if (!args || args.length === 0) {
            // Show current config
            console.log();
            console.log(colors.primary('Current Configuration:\n'));
            console.log(`  Server URL: ${colors.secondary(config.baseUrl)}`);
            console.log(`  Timeout: ${colors.secondary((config.timeout / 1000) + 's')}`);
            console.log(`  Auth Token: ${config.token ? colors.success('Set') : colors.warning('Not set')}`);
            console.log();
        } else if (args.length === 1) {
            // Show specific config value
            const key = args[0];
            if (key in config) {
                console.log();
                console.log(`${key}: ${colors.secondary(String((config as any)[key]))}`);
                console.log();
            } else {
                console.log(colors.error(`Unknown config key: ${key}`));
            }
        } else {
            // Set config value
            const key = args[0];
            const value = args[1];
            console.log(colors.warning(`Config setting not implemented yet. Would set ${key} = ${value}`));
        }
    },
};

// /exit - Exit the CLI
slashCommands['exit'] = {
    name: 'exit',
    description: 'Exit the CLI',
    usage: '/exit',
    handler: async () => {
        console.log();
        console.log(colors.muted('Goodbye!'));
        console.log();
        process.exit(0);
    },
};

// /quit - Alias for exit
slashCommands['quit'] = {
    name: 'quit',
    description: 'Exit the CLI (alias for /exit)',
    usage: '/quit',
    handler: async () => {
        await slashCommands['exit'].handler();
    },
};

// /generate - Generate code
slashCommands['generate'] = {
    name: 'generate',
    description: 'Generate code using AI',
    usage: '/generate <prompt>',
    handler: async (args?: string[]) => {
        if (!args || args.length === 0) {
            console.log(colors.error('Usage: /generate <prompt>'));
            console.log(colors.muted('Example: /generate Create a REST API for user management'));
            return;
        }

        const prompt = args.join(' ');
        const spin = createSpinner('Generating code...');

        try {
            const response = await api.postWithTimeout<{
                success: boolean;
                generatedCode?: Array<{ subtask: string; code: string; explanation: string }>;
                fileWriteResult?: { success: boolean; filesWritten: string[] };
                errors?: string[];
            }>('/orchestrator/execute', { prompt }, 300000);

            spin.stop();

            if (response.success && response.data) {
                console.log();
                console.log(colors.success('Code generation complete!'));

                if (response.data.fileWriteResult?.filesWritten) {
                    console.log(colors.primary(`Files written: ${response.data.fileWriteResult.filesWritten.length}`));
                    response.data.fileWriteResult.filesWritten.slice(0, 10).forEach(f => {
                        console.log(colors.muted(`  • ${f}`));
                    });
                }

                if (response.data.generatedCode) {
                    console.log(colors.primary(`Code components: ${response.data.generatedCode.length}`));
                }

                if (response.data.errors?.length) {
                    console.log();
                    console.log(colors.warning('Warnings:'));
                    response.data.errors.forEach(e => console.log(colors.muted(`  • ${e}`)));
                }
                console.log();
            } else {
                console.log(colors.error(`Generation failed: ${response.error}`));
            }
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Generation failed: ${err}`));
        }
        console.log();
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function isSlashCommand(input: string): boolean {
    return input.trim().startsWith('/');
}

export function parseCommand(input: string): { command: string; args: string[] } | null {
    if (!isSlashCommand(input)) return null;

    const parts = input.trim().slice(1).split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    return { command, args };
}

export async function executeCommand(input: string): Promise<boolean> {
    const parsed = parseCommand(input);

    if (!parsed) return false;

    const { command, args } = parsed;

    if (slashCommands[command]) {
        await slashCommands[command].handler(args);
        return true;
    } else {
        console.log(colors.error(`Unknown command: /${command}`));
        console.log(colors.muted('Type /help for available commands'));
        console.log();
        return true;
    }
}

export default {
    slashCommands,
    isSlashCommand,
    parseCommand,
    executeCommand,
};
