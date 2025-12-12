/**
 * Plugin Registration Module
 * Registers all Fastify plugins in the correct order
 */

import type { FastifyInstance } from 'fastify';
import { registerCors } from './cors.js';
import { registerHelmet } from './helmet.js';
import { registerRateLimit } from './rate-limit.js';
import { registerSwagger } from './swagger.js';
import { registerSensible } from './sensible.js';

/**
 * Register all plugins to the Fastify instance
 */
export async function registerPlugins(app: FastifyInstance): Promise<void> {
    app.log.info('[PLUGINS] Registering plugins...');

    // Order matters! Register plugins in dependency order

    // 1. Sensible - Error utilities (no dependencies)
    await registerSensible(app);

    // 2. Security plugins
    await registerHelmet(app);
    await registerCors(app);
    await registerRateLimit(app);

    // 3. Documentation (after security so routes are available)
    await registerSwagger(app);

    app.log.info('[PLUGINS] All plugins registered successfully');
}

export {
    registerCors,
    registerHelmet,
    registerRateLimit,
    registerSwagger,
    registerSensible,
};
