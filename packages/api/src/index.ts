/**
 * Loveable Backend API - Entry Point
 * Production-ready Fastify server for the AI Orchestrator
 */

import { createApp, env, printStartupBanner } from './app.js';
import { getAgentRegistry } from './services/index.js';
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
