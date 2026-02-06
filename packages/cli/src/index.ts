#!/usr/bin/env node
/**
 * METEOROID CLI
 * =============
 * AI-Powered Backend Development Platform
 *
 * A comprehensive CLI for the Meteoroid platform, similar to Claude Code.
 */

import { Command } from 'commander';
import { api } from './utils/index.js';
import { showWelcome, showBox, createSpinner } from './utils/ui.js';
import { colors } from './utils/theme.js';
import { startChatMode } from './modes/chat-mode.js';
import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { asType, isHealthResponse, isDeepHealthResponse, isOrchestratorStatusResponse, isAgentsResponse, isServicesResponse, isCodeGenerationResponse, isTaskAnalysisResponse, isChatResponse } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// VERSION & CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const VERSION = '1.0.0';

// ═══════════════════════════════════════════════════════════════════════════
// CLI PROGRAM
// ═══════════════════════════════════════════════════════════════════════════

const program = new Command();

program
    .name('meteoroid')
    .description('AI-Powered Backend Development Platform')
    .version(VERSION);

// Global options
program
    .option('-s, --server <url>', 'Server URL', 'http://localhost:3000')
    .option('-t, --token <token>', 'Authentication token')
    .option('-v, --verbose', 'Verbose output')
    .hook('preAction', (thisCommand) => {
        const options = thisCommand.opts();
        if (options.server) {
            api.configure({ baseUrl: options.server });
        }
        if (options.token) {
            api.setToken(options.token);
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT COMMAND (CHAT MODE)
// ═══════════════════════════════════════════════════════════════════════════

program
    .argument('[prompt...]', 'Optional prompt to send directly')
    .action(async (prompt: string[] = [], options) => {
        showWelcome(VERSION);

        // Quick health check
        const spin = createSpinner('Connecting to server...');
        const health = await api.checkHealth();
        spin.stop();

        if (health.online) {
            console.log(colors.success(`Connected to ${api.getConfig().baseUrl} (${health.latency}ms)`));
            console.log();
        } else {
            console.log(colors.warning('Server not reachable'));
            console.log(colors.muted(`Some features may not work. Server: ${api.getConfig().baseUrl}`));
            console.log();
        }

        // If prompt provided, send it directly
        if (prompt.length > 0) {
            const input = prompt.join(' ');
            console.log(colors.cyan('Sending prompt...'));
            console.log();

            const responseSpin = createSpinner('Processing...');
            const response = await api.post('/orchestrator/chat', { message: input });
            responseSpin.stop();

            if (response.success && response.data && isChatResponse(response.data)) {
                console.log(colors.primary.bold('Response:'));
                console.log(colors.white(response.data.response || 'No response'));
            } else {
                console.log(colors.error(`Error: ${response.error}`));
            }
            console.log();
        } else {
            // Start interactive chat mode
            await startChatMode({ mode: 'chat' });
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// CHAT COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('chat')
    .description('Start interactive chat mode')
    .argument('[message...]', 'Optional message to send')
    .option('-c, --code', 'Code generation mode')
    .option('-a, --analyze', 'Analysis mode')
    .action(async (message: string[] = [], options) => {
        showWelcome(VERSION);

        const mode = options.code ? 'code' : options.analyze ? 'analyze' : 'chat';

        if (message.length > 0) {
            const input = message.join(' ');
            console.log(colors.cyan(`Sending in ${mode} mode...`));
            console.log();

            let endpoint = '/orchestrator/chat';
            let body: any = { message: input };

            if (mode === 'code') {
                endpoint = '/orchestrator/execute';
                body = { prompt: input };
            } else if (mode === 'analyze') {
                endpoint = '/orchestrator/think';
                body = { task: input, useAI: true };
            }

            const spin = createSpinner('Processing...');
            const response = await api.post(endpoint, body);
            spin.stop();

            if (response.success) {
                console.log(colors.primary.bold('Response:'));
                console.log(colors.white(JSON.stringify(response.data, null, 2)));
            } else {
                console.log(colors.error(`Error: ${response.error}`));
            }
            console.log();
        } else {
            await startChatMode({ mode });
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('generate')
    .alias('gen')
    .description('Generate code using AI')
    .argument('<prompt>', 'What to generate')
    .option('-l, --language <lang>', 'Programming language')
    .option('-f, --framework <fw>', 'Framework')
    .option('-o, --output <path>', 'Output directory')
    .option('-q, --quick', 'Quick mode (no file writing)')
    .action(async (prompt: string, options) => {
        const spin = createSpinner('Generating code...');

        try {
            const endpoint = options.quick ? '/orchestrator/generate' : '/orchestrator/execute';
            const body: any = { prompt };

            if (options.language || options.framework) {
                body.context = {
                    ...(options.language && { language: options.language }),
                    ...(options.framework && { framework: options.framework }),
                };
            }

            const response = await api.postWithTimeout(endpoint, body, 300000);
            spin.stop();

            if (response.success && response.data && isCodeGenerationResponse(response.data)) {
                console.log();
                console.log(colors.success('Code generation complete!'));

                const data = response.data;

                // Handle question detection
                if (data.isQuestion && data.answer) {
                    console.log();
                    console.log(colors.primary('AI Answer:'));
                    console.log(colors.white(data.answer));
                    console.log();
                    console.log(colors.muted('This was detected as a question. Try using "Create..." or "Build..." prompts.'));
                } else {
                    // Show intent analysis
                    if (data.intentAnalysis) {
                        console.log();
                        console.log(colors.primary('Intent Analysis:'));
                        console.log(`  Type: ${colors.secondary(data.intentAnalysis.intent)}`);
                        console.log(`  Language: ${colors.secondary(data.intentAnalysis.language || 'auto')}`);
                        console.log(`  Framework: ${colors.secondary(data.intentAnalysis.framework || 'none')}`);
                    }

                    // Show files written
                    if (data.fileWriteResult?.filesWritten) {
                        console.log();
                        console.log(colors.primary(`Files written (${data.fileWriteResult.filesWritten.length}):`));
                        data.fileWriteResult.filesWritten.slice(0, 10).forEach(f => {
                            console.log(`  ${colors.success('✓')} ${f}`);
                        });
                        if (data.fileWriteResult.filesWritten.length > 10) {
                            console.log(colors.muted(`  ... and ${data.fileWriteResult.filesWritten.length - 10} more`));
                        }
                    }

                    // Show code components
                    if (data.generatedCode) {
                        console.log();
                        console.log(colors.primary(`Generated ${data.generatedCode.length} components:`));
                        data.generatedCode.slice(0, 5).forEach((c) => {
                            console.log(`  ${colors.muted('•')} ${c.subtask}`);
                        });
                    }
                }

                console.log();
            } else {
                console.log(colors.error(`Generation failed: ${response.error}`));
            }
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Generation failed: ${err}`));
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// ANALYZE COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('analyze')
    .alias('analyse')
    .description('Analyze a task or requirement')
    .argument('<task>', 'Task to analyze')
    .action(async (task: string) => {
        const spin = createSpinner('Analyzing task...');

        try {
            const response = await api.post('/orchestrator/think', { task, useAI: true });
            spin.stop();

            if (response.success && response.data && isTaskAnalysisResponse(response.data)) {
                console.log();
                console.log(colors.success('Analysis complete!'));

                const data = response.data;

                // Local analysis
                if (data.localAnalysis) {
                    console.log();
                    console.log(colors.primary('Local Analysis:'));
                    console.log(`  Complexity: ${colors.secondary(data.localAnalysis.complexity)}`);

                    if (data.localAnalysis.requirements?.length) {
                        console.log(colors.muted('\n  Requirements:'));
                        data.localAnalysis.requirements.forEach((r: string) => {
                            console.log(`    • ${r}`);
                        });
                    }

                    if (data.localAnalysis.suggestedAgents?.length) {
                        console.log(colors.muted('\n  Suggested Agents:'));
                        data.localAnalysis.suggestedAgents.forEach((a: string) => {
                            console.log(`    • ${a}`);
                        });
                    }

                    if (data.localAnalysis.subTasks?.length) {
                        console.log(colors.muted('\n  Sub-tasks:'));
                        data.localAnalysis.subTasks.forEach((t: string) => {
                            console.log(`    • ${t}`);
                        });
                    }
                }

                // AI analysis
                if (data.aiAnalysis) {
                    console.log();
                    console.log(colors.primary('AI Analysis:'));
                    console.log(`  Complexity: ${colors.secondary(data.aiAnalysis.complexity)}`);

                    if (data.aiAnalysis.subtasks?.length) {
                        console.log(colors.muted('\n  Subtasks:'));
                        data.aiAnalysis.subtasks.forEach((t: string) => {
                            console.log(`    • ${t}`);
                        });
                    }
                }

                console.log();
            } else {
                console.log(colors.error(`Analysis failed: ${response.error}`));
            }
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Analysis failed: ${err}`));
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// STATUS COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('status')
    .description('Show system status')
    .action(async () => {
        const spin = createSpinner('Checking status...');

        try {
            const [health, deepHealth, orchestrator] = await Promise.all([
                api.get('/health'),
                api.get('/health/deep'),
                api.get('/orchestrator/status'),
            ]);

            spin.stop();

            console.log();
            console.log(colors.primary.bold('System Status'));
            console.log(colors.muted('─'.repeat(50)));

            if (health.success && health.data && isHealthResponse(health.data)) {
                console.log(`\n  ${colors.success('●')} Server: ${colors.secondary('Online')}`);
                console.log(`  ${colors.muted('   URL:')} ${api.getConfig().baseUrl}`);
                console.log(`  ${colors.muted('   Uptime:')} ${health.data.uptime?.toFixed(0) || 'N/A'}s`);
            } else {
                console.log(`\n  ${colors.error('×')} Server: ${colors.error('Offline')}`);
            }

            if (deepHealth.success && deepHealth.data && isDeepHealthResponse(deepHealth.data)) {
                const checks = deepHealth.data.checks;
                console.log();
                console.log(colors.primary('  Infrastructure:'));

                const dbStatus = checks.database.status === 'healthy' ? colors.success('OK') : colors.error('FAIL');
                console.log(`    Database: ${dbStatus}`);

                const redisStatus = checks.redis.status === 'healthy' ? colors.success('OK') : colors.error('FAIL');
                console.log(`    Redis: ${redisStatus}`);

                const vectorStatus = checks.vectorStore.status === 'healthy' ? colors.success('OK') : colors.error('FAIL');
                console.log(`    Vector Store: ${vectorStatus}`);
            }

            if (orchestrator.success && orchestrator.data && isOrchestratorStatusResponse(orchestrator.data)) {
                console.log();
                console.log(colors.primary('  Orchestrator:'));
                console.log(`    Initialized: ${orchestrator.data.initialized ? colors.success('Yes') : colors.warning('No')}`);
                console.log(`    Mode: ${colors.secondary(orchestrator.data.mode || 'unknown')}`);
            }

            console.log();
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Failed to get status: ${err}`));
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('agents')
    .description('List available AI agents')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
        const spin = createSpinner('Loading agents...');

        try {
            const response = await api.get('/agents');
            spin.stop();

            if (response.success && response.data && isAgentsResponse(response.data)) {
                const { count, agents } = response.data;

                console.log();
                console.log(colors.primary.bold(`Available Agents (${count})`));
                console.log(colors.muted('─'.repeat(50)));

                agents.forEach((agent) => {
                    console.log();
                    console.log(colors.secondary(`  ${agent.name}`) + colors.muted(` [Tier ${agent.tier}]`));

                    if (options.verbose && agent.capabilities?.length) {
                        console.log(colors.muted('  Capabilities:'));
                        agent.capabilities.forEach((cap: string) => {
                            console.log(`    • ${cap}`);
                        });
                    }
                });

                console.log();
            } else {
                console.log(colors.error(`Failed to load agents: ${response.error}`));
            }
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Failed to load agents: ${err}`));
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('services')
    .description('Browse service registry')
    .argument('[category]', 'Filter by category')
    .action(async (category?: string) => {
        const spin = createSpinner('Loading services...');

        try {
            const response = await api.get('/services');
            spin.stop();

            if (response.success && response.data && isServicesResponse(response.data)) {
                const services = response.data.data.services;

                if (category) {
                    const filtered = services.filter((s: { category: string }) =>
                        s.category.toLowerCase() === category.toLowerCase()
                    );

                    console.log();
                    console.log(colors.primary.bold(`${category} Services (${filtered.length})`));
                    console.log(colors.muted('─'.repeat(50)));

                    filtered.forEach((s) => {
                        console.log(`  ${colors.muted('•')} ${s.name} ${colors.dim(`(${s.id})`)}`);
                    });
                } else {
                    const categories = [...new Set(services.map((s) => s.category))];

                    console.log();
                    console.log(colors.primary.bold(`Service Registry (${services.length} services)`));
                    console.log(colors.muted('─'.repeat(50)));

                    categories.forEach(cat => {
                        const count = services.filter((s: { category: string }) => s.category === cat).length;
                        console.log(`  ${colors.secondary(cat.padEnd(20))} ${colors.muted(count.toString())}`);
                    });
                }

                console.log();
            } else {
                console.log(colors.error(`Failed to load services: ${response.error}`));
            }
        } catch (err) {
            spin.stop();
            console.log(colors.error(`Failed to load services: ${err}`));
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// READ COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('read')
    .description('Read and display a file')
    .argument('<file>', 'File path to read')
    .option('-l, --lines <n>', 'Number of lines to show')
    .action(async (file: string, options) => {
        const filePath = resolve(process.cwd(), file);

        if (!existsSync(filePath)) {
            console.log(colors.error(`File not found: ${filePath}`));
            return;
        }

        try {
            let content = readFileSync(filePath, 'utf-8');

            if (options.lines) {
                const lines = content.split('\n').slice(0, parseInt(options.lines));
                content = lines.join('\n');
            }

            console.log();
            console.log(colors.primary.bold(`File: ${file}`));
            console.log(colors.muted('─'.repeat(50)));
            console.log(content);
            console.log(colors.muted('─'.repeat(50)));
            console.log();
        } catch (err) {
            console.log(colors.error(`Failed to read file: ${err}`));
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG COMMAND
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('config')
    .description('Manage CLI configuration')
    .option('--show', 'Show current configuration')
    .option('--set <key>=<value>', 'Set configuration value')
    .action(async (options) => {
        const config = api.getConfig();

        if (options.set) {
            const [key, ...valueParts] = options.set.split('=');
            const value = valueParts.join('=');
            console.log(colors.warning(`Config setting not implemented: ${key} = ${value}`));
            return;
        }

        // Show config
        console.log();
        console.log(colors.primary.bold('Configuration'));
        console.log(colors.muted('─'.repeat(50)));
        console.log(`  Server URL:  ${colors.secondary(config.baseUrl)}`);
        console.log(`  Timeout:     ${colors.secondary((config.timeout / 1000) + 's')}`);
        console.log(`  Auth Token:  ${config.token ? colors.success('Set') : colors.warning('Not set')}`);
        console.log();
    });

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORM COMMAND (LOCAL - No Server Required)
// ═══════════════════════════════════════════════════════════════════════════

program
    .command('transform')
    .description('Analyze a frontend repo and generate backend specifications')
    .argument('<source>', 'GitHub URL or local path to frontend repository')
    .option('-o, --output <path>', 'Output directory', './loveable-output')
    .option('--json', 'Include JSON analysis report')
    .option('--no-tasks', 'Skip generating agent task files')
    .option('--shallow', 'Use shallow clone for GitHub repos')
    .action(async (source: string, options) => {
        console.log();
        console.log(colors.primary.bold('🔄 Loveable Transform'));
        console.log(colors.muted('─'.repeat(50)));
        console.log();
        console.log(colors.muted('Source:'), colors.secondary(source));
        console.log(colors.muted('Output:'), colors.secondary(options.output));
        console.log();

        const spin = createSpinner('Initializing pipeline...');

        try {
            const { spawn } = await import('child_process');
            const { writeFileSync, unlinkSync, mkdirSync } = await import('fs');
            const outputDir = resolve(process.cwd(), options.output);

            // Create a simple inline script that runs the pipeline
            const scriptContent = `
import { AnalysisPipeline } from './agents/core/analysis/analysis-pipeline.js';

const pipeline = new AnalysisPipeline({
    source: ${JSON.stringify(source)},
    outputDir: ${JSON.stringify(outputDir)},
    includeJsonReport: ${options.json ?? false},
    skipTaskDistribution: ${options.noTasks ?? false},
    shallow: ${options.shallow ?? true},
});

pipeline.run()
    .then(result => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
    });
`;

            // Write temp script
            const tempDir = join(process.cwd(), '.loveable-temp');
            try { mkdirSync(tempDir, { recursive: true }); } catch { }

            const tempScript = join(tempDir, 'run-pipeline.ts');
            writeFileSync(tempScript, scriptContent);

            spin.text = 'Running analysis pipeline...';

            // Run with tsx (faster than ts-node)
            const child = spawn('npx', ['tsx', tempScript], {
                cwd: process.cwd(),
                shell: true,
                stdio: ['inherit', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
            child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

            await new Promise<void>((resolve, reject) => {
                child.on('close', (code: number) => {
                    try { unlinkSync(tempScript); } catch { }
                    if (code === 0) resolve();
                    else reject(new Error(stderr || 'Pipeline execution failed'));
                });
                child.on('error', reject);
            });

            spin.stop();

            // Parse result
            let result: any;
            try { result = JSON.parse(stdout); } catch {
                console.log(colors.success('✅ Transform complete!'));
                console.log(colors.muted(stdout));
                return;
            }

            if (result.error) throw new Error(result.error);

            console.log();
            console.log(colors.success('✅ Transform complete!'));
            console.log();

            // Show summary
            if (result.analysis) {
                console.log(colors.primary('Analysis Summary:'));
                console.log(`  Framework: ${colors.secondary(result.analysis.framework?.type || 'unknown')}`);
                console.log(`  API Endpoints: ${colors.secondary((result.analysis.apiCalls?.length || 0).toString())}`);
                console.log(`  Data Models: ${colors.secondary((result.analysis.dataModels?.length || 0).toString())}`);
                console.log(`  Auth Provider: ${colors.secondary(result.analysis.authStrategy?.provider || 'none')}`);
                console.log(`  Routes: ${colors.secondary((result.analysis.routes?.length || 0).toString())}`);
                console.log();
            }

            // Show generated files
            console.log(colors.primary('Generated Files:'));
            if (result.detailsPath) console.log(`  ${colors.success('✓')} ${result.detailsPath}`);
            if (result.jsonReportPath) console.log(`  ${colors.success('✓')} ${result.jsonReportPath}`);
            if (result.tasksGenerated?.length) {
                console.log(`  ${colors.success('✓')} Agent task files (${result.tasksGenerated.length}):`);
                result.tasksGenerated.forEach((f: string) => console.log(`      • ${f}`));
            }

            console.log();
            console.log(colors.muted('Next: Run the orchestrator to execute agent tasks'));
            console.log();

        } catch (err: any) {
            spin.stop();
            console.log();
            console.log(colors.error(`Transform failed: ${err.message || err}`));
            if (err.message?.includes('git')) {
                console.log(colors.muted('Hint: Make sure git is installed and the repository URL is valid.'));
            }
            console.log();
            process.exit(1);
        }
    });

// ═══════════════════════════════════════════════════════════════════════════
// PARSE & RUN
// ═══════════════════════════════════════════════════════════════════════════

program.parse();
