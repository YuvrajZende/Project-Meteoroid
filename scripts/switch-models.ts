#!/usr/bin/env node
/**
 * ============================================
 * MODEL SWITCHER CLI
 * ============================================
 * 
 * A simple CLI tool to switch between AI models
 * for the multi-model pipeline.
 * 
 * Usage:
 *   npx ts-node scripts/switch-models.ts
 *   npm run switch-models
 *   node dist/scripts/switch-models.js
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ============================================
// AVAILABLE MODELS
// ============================================

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    tier: 'fast' | 'balanced' | 'powerful';
    pricing: string;
    apiKeyEnvVar: string;
}

const FAST_MODELS: ModelOption[] = [
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        provider: 'groq',
        tier: 'fast',
        pricing: '$0.59/$0.79 per 1M tokens',
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
    {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        provider: 'groq',
        tier: 'fast',
        pricing: '$0.05/$0.08 per 1M tokens',
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
    {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: 'groq',
        tier: 'fast',
        pricing: '$0.24/$0.24 per 1M tokens',
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
    {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3',
        provider: 'openrouter',
        tier: 'fast',
        pricing: '$0.14/$0.28 per 1M tokens',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        tier: 'fast',
        pricing: '$0.15/$0.60 per 1M tokens',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        provider: 'zai',
        tier: 'fast',
        pricing: '$0.10/$0.40 per 1M tokens',
        apiKeyEnvVar: 'ZAI_API_KEY',
    },
];

const POWER_MODELS: ModelOption[] = [
    {
        id: 'glm-4.6',
        name: 'GLM-4.6',
        provider: 'zai',
        tier: 'powerful',
        pricing: '$0.50/$1.50 per 1M tokens',
        apiKeyEnvVar: 'ZAI_API_KEY',
    },
    {
        id: 'deepseek-chat',
        name: 'DeepSeek V3 (Direct)',
        provider: 'deepseek',
        tier: 'balanced',
        pricing: '$0.27/$1.10 per 1M tokens',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        tier: 'balanced',
        pricing: '$2.50/$10.00 per 1M tokens',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        tier: 'powerful',
        pricing: '$3.00/$15.00 per 1M tokens',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        tier: 'powerful',
        pricing: '$10.00/$30.00 per 1M tokens',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
];

// ============================================
// CLI UTILITIES
// ============================================

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function printHeader(): void {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    🔄 MODEL SWITCHER CLI                      ║');
    console.log('║                Multi-Model Pipeline Configuration             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
}

function printCurrentConfig(): void {
    const envPath = path.resolve(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
        console.log('⚠️  No .env file found. Current configuration unknown.\n');
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');

    const fastProvider = envContent.match(/FAST_MODEL_PROVIDER=(.+)/)?.[1] || 'not set';
    const fastModel = envContent.match(/FAST_MODEL_NAME=(.+)/)?.[1] || 'not set';
    const powerProvider = envContent.match(/POWER_MODEL_PROVIDER=(.+)/)?.[1] || 'not set';
    const powerModel = envContent.match(/POWER_MODEL_NAME=(.+)/)?.[1] || 'not set';

    console.log('📊 CURRENT CONFIGURATION:');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`   FAST Model:  ${fastModel} (${fastProvider})`);
    console.log(`   POWER Model: ${powerModel} (${powerProvider})`);
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('');
}

function printModelList(models: ModelOption[], title: string): void {
    console.log(`\n${title}:`);
    console.log('─────────────────────────────────────────────────────────────────');

    models.forEach((model, index) => {
        const num = (index + 1).toString().padStart(2, ' ');
        const name = model.name.padEnd(25);
        const provider = model.provider.padEnd(12);
        console.log(`  [${num}] ${name} │ ${provider} │ ${model.pricing}`);
    });

    console.log('');
}

function isApiKeyConfigured(envVarName: string): boolean {
    // Check loaded env
    if (process.env[envVarName]) return true;

    // Check .env file
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(new RegExp(`${envVarName}=(.+)`));
        if (match && match[1] && match[1].trim() !== '' && !match[1].includes('your-')) {
            return true;
        }
    }

    return false;
}

function updateEnvFile(updates: Record<string, string>): void {
    const envPath = path.resolve(process.cwd(), '.env');

    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    }

    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += `\n${key}=${value}`;
        }
    }

    fs.writeFileSync(envPath, content, 'utf-8');
}

// ============================================
// MAIN MENU
// ============================================

async function selectFastModel(): Promise<ModelOption | null> {
    printModelList(FAST_MODELS, '⚡ FAST MODELS (for analysis)');

    // Show which have API keys configured
    console.log('  API Key Status:');
    const configuredCount = FAST_MODELS.filter(m => isApiKeyConfigured(m.apiKeyEnvVar)).length;
    console.log(`  ${configuredCount}/${FAST_MODELS.length} providers configured\n`);

    const answer = await question('  Enter number (or 0 to cancel): ');
    const index = parseInt(answer, 10) - 1;

    if (index < 0 || index >= FAST_MODELS.length) {
        return null;
    }

    const selected = FAST_MODELS[index];

    if (!isApiKeyConfigured(selected.apiKeyEnvVar)) {
        console.log(`\n  ⚠️  Warning: ${selected.apiKeyEnvVar} is not configured in .env`);
        const confirm = await question('  Continue anyway? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            return null;
        }
    }

    return selected;
}

async function selectPowerModel(): Promise<ModelOption | null> {
    printModelList(POWER_MODELS, '💪 POWER MODELS (for code generation)');

    // Show which have API keys configured
    console.log('  API Key Status:');
    const configuredCount = POWER_MODELS.filter(m => isApiKeyConfigured(m.apiKeyEnvVar)).length;
    console.log(`  ${configuredCount}/${POWER_MODELS.length} providers configured\n`);

    const answer = await question('  Enter number (or 0 to cancel): ');
    const index = parseInt(answer, 10) - 1;

    if (index < 0 || index >= POWER_MODELS.length) {
        return null;
    }

    const selected = POWER_MODELS[index];

    if (!isApiKeyConfigured(selected.apiKeyEnvVar)) {
        console.log(`\n  ⚠️  Warning: ${selected.apiKeyEnvVar} is not configured in .env`);
        const confirm = await question('  Continue anyway? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            return null;
        }
    }

    return selected;
}

async function main(): Promise<void> {
    printHeader();
    printCurrentConfig();

    console.log('What would you like to do?');
    console.log('  [1] Change FAST model (for analysis)');
    console.log('  [2] Change POWER model (for code generation)');
    console.log('  [3] Change BOTH models');
    console.log('  [4] Show available models');
    console.log('  [5] Use recommended presets');
    console.log('  [0] Exit');
    console.log('');

    const choice = await question('Enter your choice: ');

    switch (choice) {
        case '1': {
            const model = await selectFastModel();
            if (model) {
                updateEnvFile({
                    FAST_MODEL_PROVIDER: model.provider,
                    FAST_MODEL_NAME: model.id,
                });
                console.log(`\n✅ FAST model updated to: ${model.name} (${model.provider})`);
            }
            break;
        }

        case '2': {
            const model = await selectPowerModel();
            if (model) {
                updateEnvFile({
                    POWER_MODEL_PROVIDER: model.provider,
                    POWER_MODEL_NAME: model.id,
                });
                console.log(`\n✅ POWER model updated to: ${model.name} (${model.provider})`);
            }
            break;
        }

        case '3': {
            const fastModel = await selectFastModel();
            if (fastModel) {
                const powerModel = await selectPowerModel();
                if (powerModel) {
                    updateEnvFile({
                        FAST_MODEL_PROVIDER: fastModel.provider,
                        FAST_MODEL_NAME: fastModel.id,
                        POWER_MODEL_PROVIDER: powerModel.provider,
                        POWER_MODEL_NAME: powerModel.id,
                    });
                    console.log(`\n✅ Models updated:`);
                    console.log(`   FAST:  ${fastModel.name} (${fastModel.provider})`);
                    console.log(`   POWER: ${powerModel.name} (${powerModel.provider})`);
                }
            }
            break;
        }

        case '4': {
            printModelList(FAST_MODELS, '⚡ FAST MODELS');
            printModelList(POWER_MODELS, '💪 POWER MODELS');
            break;
        }

        case '5': {
            console.log('\n📋 Recommended Presets:');
            console.log('─────────────────────────────────────────────────────────────────');
            console.log('  [1] 💰 Budget (Cheapest)');
            console.log('      FAST:  Llama 3.1 8B (Groq) - $0.05/$0.08');
            console.log('      POWER: GLM-4.6 (Z.AI) - $0.50/$1.50');
            console.log('');
            console.log('  [2] ⚡ Speed (Fastest)');
            console.log('      FAST:  Llama 3.3 70B (Groq) - ~200ms latency');
            console.log('      POWER: GLM-4.6 (Z.AI) - ~1200ms latency');
            console.log('');
            console.log('  [3] 🎯 Quality (Best)');
            console.log('      FAST:  DeepSeek V3 (OpenRouter) - 92/100 quality');
            console.log('      POWER: Claude 3.5 Sonnet - 95/100 quality');
            console.log('');

            const preset = await question('  Select preset (or 0 to cancel): ');

            if (preset === '1') {
                updateEnvFile({
                    FAST_MODEL_PROVIDER: 'groq',
                    FAST_MODEL_NAME: 'llama-3.1-8b-instant',
                    POWER_MODEL_PROVIDER: 'zai',
                    POWER_MODEL_NAME: 'glm-4.6',
                });
                console.log('\n✅ Budget preset applied!');
            } else if (preset === '2') {
                updateEnvFile({
                    FAST_MODEL_PROVIDER: 'groq',
                    FAST_MODEL_NAME: 'llama-3.3-70b-versatile',
                    POWER_MODEL_PROVIDER: 'zai',
                    POWER_MODEL_NAME: 'glm-4.6',
                });
                console.log('\n✅ Speed preset applied!');
            } else if (preset === '3') {
                updateEnvFile({
                    FAST_MODEL_PROVIDER: 'openrouter',
                    FAST_MODEL_NAME: 'deepseek/deepseek-chat',
                    POWER_MODEL_PROVIDER: 'anthropic',
                    POWER_MODEL_NAME: 'claude-3-5-sonnet-20241022',
                });
                console.log('\n✅ Quality preset applied!');
            }
            break;
        }

        case '0':
            console.log('\n👋 Goodbye!');
            break;

        default:
            console.log('\n❌ Invalid choice');
    }

    rl.close();
    console.log('');
}

// ============================================
// RUN
// ============================================

main().catch(console.error);
