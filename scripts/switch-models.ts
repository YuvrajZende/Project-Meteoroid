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

// Keep in sync with packages/api/src/services/registry/model-registry.ts (IDs verified Oct 2026; "~" = approx price)
const FAST_MODELS: ModelOption[] = [
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        provider: 'groq',
        tier: 'fast',
        pricing: '~$0.59/$0.79 per 1M tokens',
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
    {
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B',
        provider: 'groq',
        tier: 'fast',
        pricing: '$0.15/$0.60 per 1M tokens',
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
    {
        id: 'openai/gpt-oss-20b',
        name: 'GPT-OSS 20B',
        provider: 'groq',
        tier: 'fast',
        pricing: '$0.075/~$0.30 per 1M tokens',
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
    {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        provider: 'groq',
        tier: 'fast',
        pricing: '~$0.05/$0.08 per 1M tokens',
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
    {
        id: 'deepseek-flash',
        name: 'DeepSeek V4.1 Flash',
        provider: 'deepseek',
        tier: 'fast',
        pricing: '$0.30/$1.20 per 1M tokens (peak)',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    },
    {
        id: 'gpt-6-luna',
        name: 'GPT-6 Luna',
        provider: 'openai',
        tier: 'fast',
        pricing: '$0.10/$0.50 per 1M tokens',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        provider: 'anthropic',
        tier: 'fast',
        pricing: '$1.00/$5.00 per 1M tokens',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    },
    {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek Chat (OpenRouter, legacy)',
        provider: 'openrouter',
        tier: 'fast',
        pricing: '~$0.14/$0.28 per 1M tokens',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
    },
];

const POWER_MODELS: ModelOption[] = [
    {
        id: 'qwen/qwen3.6-plus:free',
        name: 'Qwen3.6 Plus (free)',
        provider: 'openrouter',
        tier: 'powerful',
        pricing: 'free (rate-limited)',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
    },
    {
        id: 'qwen/qwen3.6-plus',
        name: 'Qwen3.6 Plus',
        provider: 'openrouter',
        tier: 'powerful',
        pricing: '~$0.40/$2.40 per 1M tokens',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
    },
    {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        provider: 'deepseek',
        tier: 'powerful',
        pricing: '$1.32/$3.96 per 1M tokens (peak)',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    },
    {
        id: 'claude-sonnet-5-5',
        name: 'Claude Sonnet 5.5',
        provider: 'anthropic',
        tier: 'balanced',
        pricing: '$2.00/$10.00 per 1M tokens',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    },
    {
        id: 'gpt-6.1-sol',
        name: 'GPT-6.1 Sol',
        provider: 'openai',
        tier: 'balanced',
        pricing: '$2.00/$10.00 per 1M tokens',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    {
        id: 'claude-opus-5-5',
        name: 'Claude Opus 5.5',
        provider: 'anthropic',
        tier: 'powerful',
        pricing: '$4.00/$20.00 per 1M tokens',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    },
    {
        id: 'gpt-6-astra',
        name: 'GPT-6 Astra',
        provider: 'openai',
        tier: 'powerful',
        pricing: '$10.00/$50.00 per 1M tokens',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    {
        id: 'glm-4.6',
        name: 'GLM-4.6 (Z.AI)',
        provider: 'zai',
        tier: 'balanced',
        pricing: '~$0.50/$1.50 per 1M tokens',
        apiKeyEnvVar: 'ZAI_API_KEY',
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
            console.log('      FAST:  Llama 3.1 8B (Groq) - ~$0.05/$0.08');
            console.log('      POWER: Qwen3.6 Plus free (OpenRouter) - $0');
            console.log('');
            console.log('  [2] ⚡ Speed (Fastest)');
            console.log('      FAST:  GPT-OSS 120B (Groq) - ~500 tok/s');
            console.log('      POWER: DeepSeek V4 Pro (Direct)');
            console.log('');
            console.log('  [3] 🎯 Quality (Best)');
            console.log('      FAST:  Claude Haiku 4.5');
            console.log('      POWER: Claude Opus 5.5');
            console.log('');

            const preset = await question('  Select preset (or 0 to cancel): ');

            if (preset === '1') {
                updateEnvFile({
                    FAST_MODEL_PROVIDER: 'groq',
                    FAST_MODEL_NAME: 'llama-3.1-8b-instant',
                    POWER_MODEL_PROVIDER: 'openrouter',
                    POWER_MODEL_NAME: 'qwen/qwen3.6-plus:free',
                });
                console.log('\n✅ Budget preset applied!');
            } else if (preset === '2') {
                updateEnvFile({
                    FAST_MODEL_PROVIDER: 'groq',
                    FAST_MODEL_NAME: 'openai/gpt-oss-120b',
                    POWER_MODEL_PROVIDER: 'deepseek',
                    POWER_MODEL_NAME: 'deepseek-v4-pro',
                });
                console.log('\n✅ Speed preset applied!');
            } else if (preset === '3') {
                updateEnvFile({
                    FAST_MODEL_PROVIDER: 'anthropic',
                    FAST_MODEL_NAME: 'claude-haiku-4-5-20251001',
                    POWER_MODEL_PROVIDER: 'anthropic',
                    POWER_MODEL_NAME: 'claude-opus-5-5',
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
