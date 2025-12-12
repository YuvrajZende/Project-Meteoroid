/**
 * Helmet Plugin Configuration
 * Configures security headers for the API
 */

import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import { isProduction } from '../config/index.js';

export async function registerHelmet(app: FastifyInstance): Promise<void> {
    await app.register(helmet, {
        // Content Security Policy
        contentSecurityPolicy: isProduction ? {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        } : false, // Disable CSP in development for Swagger UI

        // HTTP Strict Transport Security
        hsts: isProduction ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
        } : false,

        // Hide X-Powered-By header
        hidePoweredBy: true,

        // Prevent MIME sniffing
        noSniff: true,

        // XSS Protection
        xssFilter: true,

        // Referrer Policy
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },

        // Frame Options
        frameguard: {
            action: 'deny',
        },
    });

    app.log.info('[PLUGINS] Helmet security plugin registered');
}
