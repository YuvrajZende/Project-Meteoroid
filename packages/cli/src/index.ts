#!/usr/bin/env node
/**
 * METEROID CLI
 * ============
 * Backend Testing & Development Interface
 * 
 * A clean, professional CLI for interacting with the Loveable Backend system.
 * This serves as a temporary frontend for testing all backend capabilities.
 */

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { api, theme } from './utils/index.js';

const { colors, header, subheader, success, error, warning, info, line, divider, formatDuration } = theme;

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MENU
// ═══════════════════════════════════════════════════════════════════════════

async function mainMenu(): Promise<void> {
    console.log();

    const { choice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'choice',
            message: 'Select an option:',
            pageSize: 15,
            choices: [
                new inquirer.Separator(colors.dim('--- AI Code Generation ---')),
                { name: 'Generate Code        (Main AI Pipeline)', value: 'generate' },
                { name: 'Chat with AI         (Direct Conversation)', value: 'chat' },
                { name: 'Analyze Task         (Intent Analysis)', value: 'analyze' },

                new inquirer.Separator(colors.dim('--- Services ---')),
                { name: 'Browse Services      (100+ Integrations)', value: 'services' },
                { name: 'My Connections       (Manage Linked Services)', value: 'connections' },

                new inquirer.Separator(colors.dim('--- System ---')),
                { name: 'System Status        (Health & Info)', value: 'status' },
                { name: 'Orchestrator Status  (AI Pipeline Info)', value: 'orchestrator' },

                new inquirer.Separator(),
                { name: 'Exit', value: 'exit' },
            ],
        },
    ]);

    switch (choice) {
        case 'generate':
            await generateCode();
            break;
        case 'chat':
            await chatWithAI();
            break;
        case 'analyze':
            await analyzeTask();
            break;
        case 'services':
            await browseServices();
            break;
        case 'connections':
            await manageConnections();
            break;
        case 'status':
            await systemStatus();
            break;
        case 'orchestrator':
            await orchestratorStatus();
            break;
        case 'exit':
            console.log();
            console.log(colors.muted('Goodbye!'));
            console.log();
            process.exit(0);
    }

    await mainMenu();
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE CODE - Main AI Pipeline
// ═══════════════════════════════════════════════════════════════════════════

// Generation phases for progress animation
const GENERATION_PHASES = [
    { phase: 'init', message: 'Initializing orchestrator...', icon: '🚀' },
    { phase: 'intent', message: 'Analyzing intent with AI...', icon: '🧠' },
    { phase: 'learning', message: 'Fetching learned patterns...', icon: '📚' },
    { phase: 'thinking', message: 'AI Thinking Engine active...', icon: '💭' },
    { phase: 'context', message: 'Building context window...', icon: '📋' },
    { phase: 'blueprint', message: 'Generating architecture blueprint...', icon: '🏗️' },
    { phase: 'agents', message: 'Selecting and executing agents...', icon: '🤖' },
    { phase: 'codegen', message: 'Generating code with AI...', icon: '⚡' },
    { phase: 'multimodel', message: 'Multi-model pipeline running...', icon: '🔄' },
    { phase: 'quality', message: 'Assessing code quality...', icon: '✅' },
    { phase: 'postprocess', message: 'Post-processing and formatting...', icon: '📝' },
    { phase: 'files', message: 'Writing files to disk...', icon: '💾' },
    { phase: 'database', message: 'Saving to database...', icon: '🗄️' },
    { phase: 'finalize', message: 'Finalizing generation...', icon: '🎯' },
];

async function generateCode(): Promise<void> {
    header('Code Generation');

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'prompt',
            message: 'What do you want to build?',
            validate: (input) => input.length >= 10 || 'Please provide more detail (min 10 characters)',
        },
        {
            type: 'list',
            name: 'mode',
            message: 'Generation mode:',
            choices: [
                { name: 'Full Pipeline (Intent Analysis + Learning + File Writing)', value: 'full' },
                { name: 'Quick Generate (Multi-Model Only, No Files)', value: 'quick' },
            ],
        },
    ]);

    // Optional: Language/Framework selection
    const { customStack } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'customStack',
            message: 'Specify language/framework? (No = let AI decide)',
            default: false,
        },
    ]);

    let context: { language?: string; framework?: string } = {};

    if (customStack) {
        const stackAnswers = await inquirer.prompt([
            {
                type: 'list',
                name: 'language',
                message: 'Language:',
                choices: ['typescript', 'python', 'go', 'javascript'],
            },
            {
                type: 'list',
                name: 'framework',
                message: 'Framework:',
                choices: (ans) => {
                    const frameworks: Record<string, string[]> = {
                        typescript: ['fastify', 'nestjs', 'express', 'none'],
                        python: ['fastapi', 'flask', 'django', 'none'],
                        go: ['gin', 'fiber', 'echo', 'none'],
                        javascript: ['express', 'fastify', 'koa', 'none'],
                    };
                    return frameworks[ans.language] || ['none'];
                },
            },
        ]);
        context = stackAnswers;
    }

    console.log();

    // Full Pipeline: Uses Integrated Orchestrator (/execute) with file writing, AI intent, learning
    // Quick Generate: Uses Multi-Model Pipeline (/generate) - faster but no file writing
    const endpoint = answers.mode === 'full' ? '/orchestrator/execute' : '/orchestrator/generate';
    const isFullPipeline = answers.mode === 'full';

    // Create animated progress spinner
    const startTime = Date.now();
    let phaseIndex = 0;
    const spin = ora({
        text: `${GENERATION_PHASES[0].icon} ${GENERATION_PHASES[0].message} [0:00]`,
        spinner: 'dots12',
    }).start();

    // Update progress every 2 seconds with new phase and elapsed time
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Cycle through phases (loop back if we've gone through all)
        phaseIndex = (phaseIndex + 1) % GENERATION_PHASES.length;

        // Skip file/database phases for quick generate
        if (!isFullPipeline && (GENERATION_PHASES[phaseIndex].phase === 'files' ||
            GENERATION_PHASES[phaseIndex].phase === 'database' ||
            GENERATION_PHASES[phaseIndex].phase === 'learning')) {
            phaseIndex = (phaseIndex + 1) % GENERATION_PHASES.length;
        }

        const currentPhase = GENERATION_PHASES[phaseIndex];
        spin.text = `${currentPhase.icon} ${currentPhase.message} [${timeStr}]`;
    }, 2000);

    // Make the API request with extended timeout (15 minutes for complex generation)
    // This ensures the CLI doesn't timeout before the server completes
    const GENERATION_TIMEOUT = 900000; // 15 minutes
    const response = await api.postWithTimeout<{
        success: boolean;
        // Common fields
        files?: Array<{ path: string; content: string }>;
        explanation?: string;
        errors?: string[];

        // /execute endpoint fields (Integrated Orchestrator)
        generatedCode?: Array<{ subtask: string; code: string; explanation: string; agent: string }>;
        fileWriteResult?: { success: boolean; projectPath: string; filesWritten: string[]; errors: string[] };
        intentAnalysis?: { intent: string; confidence: number; language: string; framework: string; reasoning?: string };
        answer?: string;
        isQuestion?: boolean;
        totalDuration?: number;
        agentsExecuted?: string[];
        steps?: Array<{ phase: string; message: string; timestamp: Date }>;

        // /generate endpoint fields (Multi-Model)
        code?: string;
        costs?: { total: number };
        timing?: { total: number };
    }>(endpoint, {
        prompt: answers.prompt,
        context,
    }, GENERATION_TIMEOUT);

    // Stop progress animation
    clearInterval(progressInterval);
    spin.stop();

    const totalElapsed = Date.now() - startTime;
    const elapsedMinutes = Math.floor(totalElapsed / 60000);
    const elapsedSeconds = Math.floor((totalElapsed % 60000) / 1000);

    if (!response.success) {
        error(`Generation failed after ${elapsedMinutes}m ${elapsedSeconds}s: ${response.error}`);
        return;
    }

    const result = response.data!;

    // Handle question detection (from /execute endpoint)
    if (result.isQuestion && result.answer) {
        console.log();
        subheader('AI Answer');
        console.log();
        console.log(result.answer);
        console.log();
        info('This was detected as a question. Rephrase as "Build..." or "Create..." to generate code.');
        return;
    }

    console.log();
    success(`✨ Generation complete in ${elapsedMinutes}m ${elapsedSeconds}s`);
    console.log();

    // Show intent analysis (from /execute endpoint)
    if (result.intentAnalysis) {
        subheader('🧠 Intent Analysis');
        line('Type', result.intentAnalysis.intent);
        line('Language', result.intentAnalysis.language || 'auto');
        line('Framework', result.intentAnalysis.framework || 'none');
        line('Confidence', `${(result.intentAnalysis.confidence * 100).toFixed(0)}%`);
        if (result.intentAnalysis.reasoning) {
            console.log(colors.muted(`  Reasoning: ${result.intentAnalysis.reasoning}`));
        }
        console.log();
    }

    // Show agents used (from /execute endpoint)
    if (result.agentsExecuted && result.agentsExecuted.length > 0) {
        subheader('🤖 Agents Used');
        result.agentsExecuted.forEach(a => console.log(`  • ${a}`));
        console.log();
    }

    // Show file write result (from /execute endpoint - files written to disk)
    if (result.fileWriteResult) {
        if (result.fileWriteResult.success) {
            subheader(`💾 Files Written (${result.fileWriteResult.filesWritten.length})`);
            result.fileWriteResult.filesWritten.slice(0, 15).forEach(f => {
                console.log(`  ${colors.success('✓')} ${f}`);
            });
            if (result.fileWriteResult.filesWritten.length > 15) {
                console.log(colors.muted(`  ... and ${result.fileWriteResult.filesWritten.length - 15} more`));
            }
            console.log();
            success(`Files saved to: ${result.fileWriteResult.projectPath}`);
        } else {
            warning('Some files failed to write:');
            result.fileWriteResult.errors.forEach(e => console.log(`  - ${e}`));
        }
    }
    // Fallback: Show files from response (from /generate endpoint - not written to disk)
    else if (result.files && result.files.length > 0) {
        subheader(`📄 Generated Files (${result.files.length})`);
        result.files.slice(0, 15).forEach(f => {
            console.log(`  ${f.path}`);
        });
        if (result.files.length > 15) {
            console.log(colors.muted(`  ... and ${result.files.length - 15} more`));
        }
        console.log();
        warning('Files returned in response but NOT written to disk (use Full Pipeline to save files)');
    }

    // Show generated code count (from /execute endpoint)
    if (result.generatedCode && result.generatedCode.length > 0) {
        line('Code Components', `${result.generatedCode.length} generated`);
    }

    // Show cost/time
    const totalCost = result.costs?.total;
    if (totalCost !== undefined) {
        line('Cost', `$${totalCost.toFixed(4)}`);
    }

    // Show errors
    if (result.errors && result.errors.length > 0) {
        console.log();
        warning('⚠️ Warnings/Errors:');
        result.errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT WITH AI - Direct Conversation
// ═══════════════════════════════════════════════════════════════════════════

async function chatWithAI(): Promise<void> {
    header('AI Chat');
    info('Type your message to chat with the AI. Type "exit" to return to menu.');
    console.log();

    while (true) {
        const { message } = await inquirer.prompt([
            {
                type: 'input',
                name: 'message',
                message: 'You:',
            },
        ]);

        if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
            break;
        }

        if (!message.trim()) continue;

        const spin = ora('Thinking...').start();

        const response = await api.post<{ response: string; model: string; duration: number }>(
            '/orchestrator/chat',
            { message }
        );

        spin.stop();

        if (!response.success) {
            error(response.error || 'Failed to get response');
            continue;
        }

        console.log();
        console.log(colors.primary('AI:'), response.data?.response);
        console.log(colors.dim(`  (${response.data?.model}, ${formatDuration(response.data?.duration || 0)})`));
        console.log();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYZE TASK - Intent Analysis
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeTask(): Promise<void> {
    header('Task Analysis');

    const { task } = await inquirer.prompt([
        {
            type: 'input',
            name: 'task',
            message: 'Enter task to analyze:',
            validate: (input) => input.length >= 5 || 'Please provide more detail',
        },
    ]);

    const spin = ora('Analyzing...').start();

    const response = await api.post<{
        localAnalysis: {
            complexity: string;
            requirements: string[];
            suggestedAgents: string[];
            subTasks: string[];
        };
        aiAnalysis?: {
            complexity: string;
            subtasks: string[];
        };
        duration: number;
    }>('/orchestrator/think', { task, useAI: true });

    spin.stop();

    if (!response.success) {
        error(response.error || 'Analysis failed');
        return;
    }

    const result = response.data!;
    success(`Analysis complete (${formatDuration(result.duration)})`);
    console.log();

    subheader('Local Analysis');
    line('Complexity', result.localAnalysis.complexity);

    if (result.localAnalysis.requirements?.length > 0) {
        console.log(colors.muted('  Requirements:'));
        result.localAnalysis.requirements.forEach(r => console.log(`    - ${r}`));
    }

    if (result.localAnalysis.suggestedAgents?.length > 0) {
        console.log(colors.muted('  Suggested Agents:'));
        result.localAnalysis.suggestedAgents.forEach(a => console.log(`    - ${a}`));
    }

    if (result.localAnalysis.subTasks?.length > 0) {
        console.log(colors.muted('  Sub-tasks:'));
        result.localAnalysis.subTasks.forEach(t => console.log(`    - ${t}`));
    }

    if (result.aiAnalysis) {
        console.log();
        subheader('AI Analysis');
        line('Complexity', result.aiAnalysis.complexity);
        if (result.aiAnalysis.subtasks?.length > 0) {
            console.log(colors.muted('  Subtasks:'));
            result.aiAnalysis.subtasks.forEach(t => console.log(`    - ${t}`));
        }
    }

    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// BROWSE SERVICES - Service Registry
// ═══════════════════════════════════════════════════════════════════════════

async function browseServices(): Promise<void> {
    header('Service Registry');

    const spin = ora('Loading services...').start();

    // API returns { success, data: { services, total } }
    const response = await api.get<{
        success: boolean;
        data: {
            services: Array<{ id: string; name: string; category: string; description: string }>;
            total: number;
        }
    }>('/services');

    spin.stop();

    if (!response.success) {
        error(response.error || 'Failed to load services');
        return;
    }

    const services = response.data?.data?.services || [];

    if (services.length === 0) {
        info('No services registered in the system');
        info('Services will appear here once the Service Registry is populated');
        console.log();
        return;
    }

    success(`Loaded ${services.length} services`);
    console.log();

    // Group by category
    const categories = [...new Set(services.map(s => s.category))];

    for (const category of categories) {
        const catServices = services.filter(s => s.category === category);
        console.log(colors.primary(`${category} (${catServices.length})`));
        catServices.forEach(s => {
            console.log(`  ${s.id.padEnd(20)} ${colors.muted(s.name)}`);
        });
        console.log();
    }

    // Allow viewing details
    const { viewDetails } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'viewDetails',
            message: 'View service details?',
            default: false,
        },
    ]);

    if (viewDetails) {
        const { serviceId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'serviceId',
                message: 'Select service:',
                choices: services.map(s => ({ name: `${s.name} (${s.id})`, value: s.id })),
            },
        ]);

        const detailSpin = ora('Loading...').start();
        const detailResponse = await api.get<{
            success: boolean;
            data: {
                id: string;
                name: string;
                description: string;
                capabilities: string[];
                requiredCredentials: Array<{ key: string; label: string; type: string }>;
            };
        }>(`/services/${serviceId}`);
        detailSpin.stop();

        if (detailResponse.success && detailResponse.data?.data) {
            const svc = detailResponse.data.data;
            console.log();
            subheader(svc.name);
            console.log(svc.description);
            console.log();

            if (svc.capabilities?.length > 0) {
                console.log(colors.muted('Capabilities:'));
                svc.capabilities.forEach(c => console.log(`  - ${c}`));
            }

            if (svc.requiredCredentials?.length > 0) {
                console.log();
                console.log(colors.muted('Required Credentials:'));
                svc.requiredCredentials.forEach(c => console.log(`  - ${c.label} (${c.key})`));
            }
        }
    }

    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// MANAGE CONNECTIONS - User Service Connections
// ═══════════════════════════════════════════════════════════════════════════

async function manageConnections(): Promise<void> {
    header('My Connections');

    const spin = ora('Loading connections...').start();

    // Backend returns: { success: true, data: { connections: [...], total: N } }
    const response = await api.get<{
        success: boolean;
        data: {
            connections: Array<{
                id: string;
                serviceId: string;
                serviceName?: string;
                connectionName: string;
                isActive: boolean;
                healthStatus: string;
            }>;
            total: number;
        };
    }>('/connections');

    spin.stop();

    if (!response.success) {
        if (response.status === 401) {
            warning('Authentication required to manage connections');
            info('This feature requires login. Use the API with a valid token.');
        } else {
            error(response.error || 'Failed to load connections');
        }
        return;
    }

    // Correctly extract connections from nested data structure
    const connections = response.data?.data?.connections || [];

    if (connections.length === 0) {
        info('No connections configured');
        info('Connect services via the API to enable AI code generation with real integrations');
    } else {
        subheader(`${connections.length} Connection(s)`);
        connections.forEach(c => {
            const status = c.isActive ? colors.success('[active]') : colors.warning('[inactive]');
            const health = c.healthStatus === 'healthy' ? colors.success('●') : colors.warning('●');
            console.log(`  ${health} ${c.connectionName.padEnd(25)} ${c.serviceId.padEnd(15)} ${status}`);
        });
    }

    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM STATUS - Health & Info
// ═══════════════════════════════════════════════════════════════════════════

async function systemStatus(): Promise<void> {
    header('System Status');

    const spin = ora('Checking system...').start();

    // Check basic health
    const healthResponse = await api.get<{ status: string; uptime: number; version: string }>('/health');

    // Check deep health
    const deepResponse = await api.get<{
        status: string;
        checks: {
            database: { status: string; latency?: number };
            vectorStore: { status: string; embeddingsCount?: number };
            redis: { status: string };
            agents: { status: string; loaded: number };
        };
    }>('/health/deep');

    spin.stop();

    if (!healthResponse.success) {
        error('Server unreachable');
        info(`Make sure server is running at ${api.getConfig().baseUrl}`);
        return;
    }

    success(`Server is ${healthResponse.data?.status || 'online'}`);
    console.log();

    subheader('Basic Info');
    line('Version', healthResponse.data?.version || 'unknown');
    line('Uptime', formatDuration((healthResponse.data?.uptime || 0) * 1000));
    line('Latency', `${healthResponse.duration}ms`);

    if (deepResponse.success && deepResponse.data?.checks) {
        const checks = deepResponse.data.checks;
        console.log();
        subheader('Infrastructure');
        line('Database', checks.database.status, checks.database.status === 'healthy');
        if (checks.database.latency) {
            console.log(colors.dim(`    Latency: ${checks.database.latency}ms`));
        }
        line('Vector Store', checks.vectorStore.status, checks.vectorStore.status === 'healthy');
        if (checks.vectorStore.embeddingsCount) {
            console.log(colors.dim(`    Embeddings: ${checks.vectorStore.embeddingsCount}`));
        }
        line('Redis', checks.redis.status, checks.redis.status === 'healthy');
        line('Agents', `${checks.agents.loaded} loaded`, checks.agents.status === 'healthy');
    }

    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR STATUS
// ═══════════════════════════════════════════════════════════════════════════

async function orchestratorStatus(): Promise<void> {
    header('Orchestrator Status');

    const spin = ora('Loading...').start();

    // Get orchestrator status
    const response = await api.get<{
        initialized: boolean;
        mode: string;
        services: {
            aiClient: { status: string; model: string; baseUrl?: string };
            thinkingEngine?: string;
            contextManager?: string;
        };
    }>('/orchestrator/status');

    // Also get agents from the dedicated endpoint
    const agentsResponse = await api.get<{
        count: number;
        agents: Array<{ id: string; name: string; tier: number; capabilities: string[]; status: string }>;
    }>('/agents');

    spin.stop();

    if (!response.success) {
        error(response.error || 'Failed to get status');
        return;
    }

    const data = response.data!;

    success('Orchestrator is running');
    console.log();

    subheader('Configuration');
    line('Initialized', data.initialized ? 'Yes' : 'No', data.initialized);
    line('Mode', data.mode || 'unknown');

    if (data.services) {
        console.log();
        subheader('AI Services');
        const aiClient = data.services.aiClient || {};
        line('AI Client', aiClient.status || 'connected', aiClient.status === 'connected');
        if (aiClient.model) {
            line('Model', aiClient.model);
        }
        if (data.services.thinkingEngine) {
            line('Thinking Engine', data.services.thinkingEngine, true);
        }
        if (data.services.contextManager) {
            line('Context Manager', data.services.contextManager, true);
        }
    }

    // Show agents from dedicated endpoint
    if (agentsResponse.success && agentsResponse.data) {
        const agents = agentsResponse.data;
        console.log();
        subheader('Agents');
        line('Total Loaded', String(agents.count || 0), (agents.count || 0) > 0);

        if (agents.agents && agents.agents.length > 0) {
            console.log(colors.muted('  Registered:'));
            agents.agents.forEach(a => {
                const statusColor = a.status === 'loaded' ? colors.success : colors.warning;
                console.log(`    ${statusColor('[' + a.status + ']')} ${a.name} (${a.capabilities.length} capabilities)`);
            });
        }
    }

    console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════

async function startup(): Promise<void> {
    console.clear();
    console.log();
    console.log(colors.header('╔══════════════════════════════════════════════════════════════════╗'));
    console.log(colors.header('║                         LOVEABLE CLI                             ║'));
    console.log(colors.header('║              Backend Testing & Development Interface             ║'));
    console.log(colors.header('╚══════════════════════════════════════════════════════════════════╝'));
    console.log();

    // Quick health check
    const spin = ora('Connecting to server...').start();
    const health = await api.checkHealth();

    if (health.online) {
        spin.succeed(`Connected to ${api.getConfig().baseUrl} (${health.latency}ms)`);
    } else {
        spin.warn('Server not reachable');
        warning(`Cannot connect to ${api.getConfig().baseUrl}`);
        info('Some features may not work. Make sure the server is running.');
    }

    await mainMenu();
}

// Run
startup().catch(console.error);
