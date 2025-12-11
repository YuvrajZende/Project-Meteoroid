/**
 * Sensible Plugin Configuration
 * Adds useful utilities and error handlers to Fastify
 */

import sensible from '@fastify/sensible';
import type { FastifyInstance } from 'fastify';

export async function registerSensible(app: FastifyInstance): Promise<void> {
    await app.register(sensible, {
        sharedSchemaId: 'HttpError',
    });

    app.log.info('[PLUGINS] Sensible utilities registered');
}
