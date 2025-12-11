/**
 * Loveable Backend API - Entry Point
 * Production-ready Fastify server for the AI Orchestrator
 */

import { createApp, env, printStartupBanner } from './app.js';
import { getAgentRegistry, getMultiModelOrchestrator, getCostTracker, getAvailableModels, isProviderConfigured, getBenchmarkingService, getCodeGenService } from './services/index.js';
import { flush } from './monitoring/index.js';

/**
 * Bootstrap and start the server
 */
async function bootstrap(): Promise<void> {
    try {
        // Print startup banner
        printStartupBanner();

        // Create the Fastify application
        const app = await createApp();

        // Graceful shutdown handlers
        const shutdown = async (signal: string) => {
            app.log.info(`Received ${signal}, initiating graceful shutdown...`);

            try {
                // Flush cost tracker records
                const costTracker = getCostTracker();
                await costTracker.shutdown();

                // Flush benchmarking records
                const benchmarking = getBenchmarkingService();
                await benchmarking.shutdown();

                // Flush Sentry events
                await flush(5000);

                await app.close();
                app.log.info('Server closed successfully');
                process.exit(0);
            } catch (error) {
                app.log.error(error, 'Error during shutdown');
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            app.log.fatal(error, 'Uncaught Exception');
            process.exit(1);
        });

        process.on('unhandledRejection', (reason) => {
            app.log.fatal({ reason }, 'Unhandled Rejection');
            process.exit(1);
        });

        // Start the server
        const address = await app.listen({
            host: env.HOST,
            port: env.PORT,
        });

        // Get registry stats
        const registry = getAgentRegistry();
        const summary = registry.getSummary();

        // Get Multi-Model configuration
        const multiModel = getMultiModelOrchestrator();
        const modelStatus = multiModel.getStatus();
        const availableModels = getAvailableModels();
        const costTracker = getCostTracker();
        const budgetStatus = costTracker.getBudgetStatus();

        // Clean startup summary
        console.log('');
        console.log('================================================================');
        console.log('  LOVEABLE BACKEND API SERVER - STARTED');
        console.log('================================================================');
        console.log('');
        console.log(`  Server:       ${address}`);
        console.log(`  Documentation: ${address}/docs`);
        console.log(`  Health Check:  ${address}/health`);
        console.log(`  Metrics:       ${address}/metrics`);
        console.log('');
        console.log('  ----------------------------------------------------------------');
        console.log(`  Environment:   ${env.NODE_ENV}`);
        console.log(`  Agents Loaded: ${summary.total}`);
        console.log(`  Orchestrator:  READY`);
        console.log('  ----------------------------------------------------------------');
        console.log('');
        console.log('  🧠 MULTI-MODEL PIPELINE (Phase 13)');
        console.log('  ----------------------------------------------------------------');
        console.log(`  FAST Model (Analysis):    ${modelStatus.fastModel.id}`);
        console.log(`    └─ Provider:            ${modelStatus.fastModel.provider.toUpperCase()}`);
        console.log(`    └─ API Key:             ${modelStatus.fastModel.configured ? '✅ Configured' : '❌ Missing'}`);
        console.log('');
        console.log(`  POWER Model (Generation): ${modelStatus.powerModel.id}`);
        console.log(`    └─ Provider:            ${modelStatus.powerModel.provider.toUpperCase()}`);
        console.log(`    └─ API Key:             ${modelStatus.powerModel.configured ? '✅ Configured' : '❌ Missing'}`);
        console.log('  ----------------------------------------------------------------');
        console.log('');
        console.log('  💰 COST TRACKING');
        console.log('  ----------------------------------------------------------------');
        console.log(`  Daily Budget:   $${budgetStatus.daily.limit.toFixed(2)} (${budgetStatus.daily.percentage.toFixed(1)}% used)`);
        console.log(`  Monthly Budget: $${budgetStatus.monthly.limit.toFixed(2)} (${budgetStatus.monthly.percentage.toFixed(1)}% used)`);
        console.log('  ----------------------------------------------------------------');
        console.log('');
        console.log('  📦 AVAILABLE MODELS');
        console.log('  ----------------------------------------------------------------');
        if (availableModels.length > 0) {
            availableModels.slice(0, 6).forEach(model => {
                const tierBadge = model.tier === 'fast' ? '⚡' : model.tier === 'powerful' ? '💪' : '⚖️';
                console.log(`  ${tierBadge} ${model.name} (${model.provider})`);
            });
            if (availableModels.length > 6) {
                console.log(`    ... and ${availableModels.length - 6} more`);
            }
        } else {
            console.log('  ⚠️  No models available (check API keys)');
        }
        console.log('  ----------------------------------------------------------------');
        console.log('');
        console.log('  🔌 PROVIDER STATUS');
        console.log('  ----------------------------------------------------------------');
        console.log(`  OpenRouter:   ${isProviderConfigured('openrouter') ? '✅ Ready' : '❌ No API Key'}`);
        console.log(`  Z.AI (GLM):   ${isProviderConfigured('zai') ? '✅ Ready' : '❌ No API Key'}`);
        console.log(`  OpenAI:       ${isProviderConfigured('openai') ? '✅ Ready' : '❌ No API Key'}`);
        console.log(`  DeepSeek:     ${isProviderConfigured('deepseek') ? '✅ Ready' : '❌ No API Key'}`);
        console.log(`  Anthropic:    ${isProviderConfigured('anthropic') ? '✅ Ready' : '❌ No API Key'}`);
        console.log(`  Groq:         ${process.env.GROQ_API_KEY ? '✅ Ready' : '❌ No API Key'}`);
        console.log('  ----------------------------------------------------------------');
        console.log('');
        console.log('  🛠️ CODEGEN PIPELINE (Person 4)');
        console.log('  ----------------------------------------------------------------');
        const codeGenService = getCodeGenService();
        const codeGenHealth = await codeGenService.healthCheck();
        const supportedLangs = codeGenService.getSupportedConfigs();
        console.log(`  Status:       ${codeGenHealth.healthy ? '✅ Ready' : '⚠️ Degraded'}`);
        console.log(`  Languages:    ${supportedLangs.languages.join(', ')}`);
        console.log(`  Endpoints:    /codegen/project, /codegen/module, /codegen/languages`);
        console.log('');
        console.log('  Server is ready to accept connections.');
        console.log('================================================================');
        console.log('');

    } catch (error) {
        console.error('[FATAL] Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
bootstrap();

