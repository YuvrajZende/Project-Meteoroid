/**
 * Helmet Plugin Configuration
 * Configures security headers for the API
 * 
 * SECURITY FEATURES:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 * - Cross-Origin policies
 */

import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import { isProduction } from '../config/index.js';

export async function registerHelmet(app: FastifyInstance): Promise<void> {
    await app.register(helmet, {
        // Content Security Policy - strict in production
        contentSecurityPolicy: isProduction ? {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'https://api.openai.com', 'https://api.anthropic.com'],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
                formAction: ["'self'"],
                baseUri: ["'self'"],
                upgradeInsecureRequests: [],
            },
        } : false,

        // HTTP Strict Transport Security - 1 year in production
        hsts: isProduction ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        } : false,

        // Hide X-Powered-By header
        hidePoweredBy: true,

        // Prevent MIME type sniffing
        noSniff: true,

        // XSS Protection (legacy but still useful for older browsers)
        xssFilter: true,

        // Referrer Policy - limit referrer information
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },

        // Frame Options - prevent clickjacking
        frameguard: {
            action: 'deny',
        },

        // Permissions Policy - restrict browser features
        permittedCrossDomainPolicies: {
            permittedPolicies: 'none',
        },

        // Cross-Origin Embedder Policy
        crossOriginEmbedderPolicy: isProduction,

        // Cross-Origin Opener Policy
        crossOriginOpenerPolicy: isProduction ? { policy: 'same-origin' } : false,

        // Cross-Origin Resource Policy
        crossOriginResourcePolicy: isProduction ? { policy: 'same-origin' } : false,

        // Origin Agent Cluster
        originAgentCluster: true,

        // Disable DNS prefetching
        dnsPrefetchControl: {
            allow: false,
        },

        // IE No Open
        ieNoOpen: true,
    });

    // Add additional security headers not covered by Helmet
    app.addHook('onSend', async (_request, reply) => {
        // Permissions Policy (Feature Policy replacement)
        reply.header('Permissions-Policy', [
            'accelerometer=()',
            'camera=()',
            'geolocation=()',
            'gyroscope=()',
            'magnetometer=()',
            'microphone=()',
            'payment=()',
            'usb=()',
        ].join(', '));

        // Cache Control for API responses
        if (!reply.hasHeader('Cache-Control')) {
            reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }

        // X-Content-Type-Options (redundant but explicit)
        reply.header('X-Content-Type-Options', 'nosniff');

        // X-Request-ID for tracing
        reply.header('X-Request-ID', _request.id);
    });

    app.log.info('[PLUGINS] Helmet security plugin registered with enhanced headers');
}
