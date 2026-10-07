/**
 * Webhook Routes
 * External webhook handlers for third-party integrations
 * 
 * SECURITY FEATURES:
 * - MANDATORY signature verification for all webhooks
 * - Timing-safe comparison (prevents timing attacks)
 * - Timestamp validation for Stripe (prevents replay attacks)
 * - Raw body preservation for signature verification
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';

// ============================================
// SECURITY: Configuration
// ============================================

const WEBHOOK_TIMESTAMP_TOLERANCE = 300; // 5 minutes in seconds

// ============================================
// SECURITY: Logging helper
// ============================================

function logSecurityEvent(
    app: FastifyInstance,
    event: 'signature_valid' | 'signature_invalid' | 'signature_missing' | 'replay_attack',
    webhook: string,
    details?: Record<string, unknown>
): void {
    app.log.warn({
        security: true,
        webhook,
        event,
        ...details,
        timestamp: new Date().toISOString()
    }, `[WEBHOOK SECURITY] ${event} for ${webhook}`);
}

declare module 'fastify' {
    interface FastifyRequest {
        /** Raw request body bytes (set only by the webhook content-type parser) */
        rawBody?: Buffer;
    }
}

/**
 * Constant-time comparison of two hex/ascii strings (length-checked).
 */
function safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify webhook signature (HMAC-SHA256 over the raw body bytes)
 */
function verifyWebhookSignature(
    payload: Buffer,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    return safeEqual(signature.trim().toLowerCase(), expectedSignature);
}

/**
 * Verify Stripe webhook signature
 * Header format: t={timestamp},v1={signature}[,v1=...][,v0=...]
 */
function verifyStripeSignature(
    payload: Buffer,
    signature: string,
    secret: string
): boolean {
    let timestamp: string | undefined;
    const v1Signatures: string[] = [];
    for (const part of signature.split(',')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key === 't') timestamp = value;
        else if (key === 'v1') v1Signatures.push(value);
    }

    if (!timestamp || !/^\d+$/.test(timestamp) || v1Signatures.length === 0) {
        return false;
    }

    // SECURITY: Reject timestamps outside tolerance (prevents replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > WEBHOOK_TIMESTAMP_TOLERANCE) {
        return false;
    }

    const expectedSignature = createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(payload)
        .digest('hex');

    return v1Signatures.some(sig => safeEqual(sig, expectedSignature));
}

/**
 * Parse JSON while preserving the exact raw bytes for HMAC verification.
 */
function addRawJsonParser(scope: FastifyInstance): void {
    scope.addContentTypeParser(
        'application/json',
        { parseAs: 'buffer' },
        (request, body, done) => {
            const raw = body as Buffer;
            request.rawBody = raw;
            if (raw.length === 0) {
                done(null, {});
                return;
            }
            try {
                done(null, JSON.parse(raw.toString('utf8')));
            } catch (err) {
                const error = err as Error & { statusCode?: number };
                error.statusCode = 400;
                done(error, undefined);
            }
        }
    );
}

function getRawBody(request: FastifyRequest): Buffer | null {
    return Buffer.isBuffer(request.rawBody) ? request.rawBody : null;
}

/**
 * Register webhook routes
 */
export async function registerWebhookRoutes(parent: FastifyInstance): Promise<void> {
    // Encapsulated scope so the raw-body JSON parser only applies to webhook routes
    await parent.register(async (app) => {
    addRawJsonParser(app);

    /**
     * POST /api/v1/webhooks/supabase - Supabase Auth webhook
     */
    app.post('/api/v1/webhooks/supabase', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Supabase Auth webhook',
            description: 'Handles Supabase Auth events (user.created, user.deleted, etc.)',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const signature = request.headers['x-supabase-signature'] as string;
        const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;

        // SECURITY: Webhook secret is MANDATORY in production
        if (!webhookSecret) {
            logSecurityEvent(app, 'signature_missing', 'supabase', { reason: 'SUPABASE_WEBHOOK_SECRET not configured' });
            return reply.status(500).send({
                error: 'Webhook not configured',
                code: 'WEBHOOK_NOT_CONFIGURED'
            });
        }

        // SECURITY: Signature is MANDATORY
        if (!signature) {
            logSecurityEvent(app, 'signature_missing', 'supabase', { ip: request.ip });
            return reply.status(401).send({
                error: 'Missing webhook signature',
                code: 'MISSING_SIGNATURE'
            });
        }

        const rawBody = getRawBody(request);
        const isValid = rawBody !== null && verifyWebhookSignature(rawBody, signature, webhookSecret);

        if (!isValid) {
            logSecurityEvent(app, 'signature_invalid', 'supabase', { ip: request.ip });
            return reply.status(401).send({
                error: 'Invalid webhook signature',
                code: 'INVALID_SIGNATURE'
            });
        }

        logSecurityEvent(app, 'signature_valid', 'supabase');

        const payload = request.body as {
            type: string;
            table: string;
            record: Record<string, unknown>;
            old_record?: Record<string, unknown>;
        };

        app.log.info({ type: payload.type, table: payload.table }, 'Received Supabase webhook');

        // Handle different event types
        switch (payload.type) {
            case 'INSERT':
                if (payload.table === 'users') {
                    // New user created - sync to our users table
                    app.log.info({ userId: payload.record.id }, 'New user registered');
                    // TODO: await usersService.create(...)
                }
                break;

            case 'DELETE':
                if (payload.table === 'users') {
                    // User deleted - clean up
                    app.log.info({ userId: payload.old_record?.id }, 'User deleted');
                    // TODO: await usersService.delete(...)
                }
                break;

            case 'UPDATE':
                if (payload.table === 'users') {
                    // User updated
                    app.log.info({ userId: payload.record.id }, 'User updated');
                    // TODO: await usersService.update(...)
                }
                break;
        }

        return reply.send({ received: true });
    });

    /**
     * POST /api/v1/webhooks/stripe - Stripe payment webhook
     */
    app.post('/api/v1/webhooks/stripe', {
        schema: {
            tags: ['Webhooks'],
            summary: 'Stripe payment webhook',
            description: 'Handles Stripe payment events for subscription management',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const signature = request.headers['stripe-signature'] as string;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        // SECURITY: Webhook secret is MANDATORY
        if (!webhookSecret) {
            logSecurityEvent(app, 'signature_missing', 'stripe', { reason: 'STRIPE_WEBHOOK_SECRET not configured' });
            return reply.status(500).send({
                error: 'Webhook not configured',
                code: 'WEBHOOK_NOT_CONFIGURED'
            });
        }

        // SECURITY: Signature is MANDATORY
        if (!signature) {
            logSecurityEvent(app, 'signature_missing', 'stripe', { ip: request.ip });
            return reply.status(401).send({
                error: 'Missing Stripe signature',
                code: 'MISSING_SIGNATURE'
            });
        }

        const rawBody = getRawBody(request);

        // SECURITY: Verify Stripe signature with timestamp check
        const verifyResult = rawBody !== null && verifyStripeSignature(rawBody, signature, webhookSecret);
        if (!verifyResult) {
            logSecurityEvent(app, 'signature_invalid', 'stripe', { ip: request.ip });
            return reply.status(401).send({
                error: 'Invalid signature',
                code: 'INVALID_SIGNATURE'
            });
        }

        logSecurityEvent(app, 'signature_valid', 'stripe');

        const payload = request.body as {
            type: string;
            data: { object: Record<string, unknown> };
        };

        app.log.info({ type: payload.type }, 'Received Stripe webhook');

        // Handle different event types
        switch (payload.type) {
            case 'checkout.session.completed':
                // User completed checkout - upgrade tier
                app.log.info('Checkout completed');
                // TODO: await usersService.update(userId, { tier: 'pro' });
                break;

            case 'customer.subscription.deleted':
                // Subscription cancelled - downgrade to free
                app.log.info('Subscription cancelled');
                // TODO: await usersService.update(userId, { tier: 'free' });
                break;

            case 'invoice.payment_failed':
                // Payment failed - notify user
                app.log.warn('Payment failed');
                // TODO: Send notification
                break;
        }

        return reply.send({ received: true });
    });

    /**
     * POST /api/v1/webhooks/github - GitHub webhook
     */
    app.post('/api/v1/webhooks/github', {
        schema: {
            tags: ['Webhooks'],
            summary: 'GitHub webhook',
            description: 'Handles GitHub events for CI/CD integration',
        },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const signature = request.headers['x-hub-signature-256'] as string;
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        const event = request.headers['x-github-event'] as string;

        // SECURITY: Webhook secret is MANDATORY
        if (!webhookSecret) {
            logSecurityEvent(app, 'signature_missing', 'github', { reason: 'GITHUB_WEBHOOK_SECRET not configured' });
            return reply.status(500).send({
                error: 'Webhook not configured',
                code: 'WEBHOOK_NOT_CONFIGURED'
            });
        }

        // SECURITY: Signature is MANDATORY
        if (!signature) {
            logSecurityEvent(app, 'signature_missing', 'github', { ip: request.ip, event });
            return reply.status(401).send({
                error: 'Missing GitHub signature',
                code: 'MISSING_SIGNATURE'
            });
        }

        const sig = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : '';
        const rawBody = getRawBody(request);
        const isValid = rawBody !== null && sig.length > 0 && verifyWebhookSignature(rawBody, sig, webhookSecret);

        if (!isValid) {
            logSecurityEvent(app, 'signature_invalid', 'github', { ip: request.ip, event });
            return reply.status(401).send({
                error: 'Invalid GitHub signature',
                code: 'INVALID_SIGNATURE'
            });
        }

        logSecurityEvent(app, 'signature_valid', 'github', { event });

        app.log.info({ event }, 'Received GitHub webhook');

        const payload = request.body as Record<string, unknown>;

        // Handle different event types
        switch (event) {
            case 'push':
                app.log.info('Code pushed to repository');
                // TODO: Trigger deployment or other actions
                break;

            case 'pull_request':
                app.log.info('Pull request event');
                // TODO: Run tests, add comments, etc.
                break;

            case 'workflow_run':
                app.log.info({ status: payload.action }, 'Workflow run');
                break;
        }

        return reply.send({ received: true });
    });

    app.log.info('[ROUTES] Webhook routes registered: /api/v1/webhooks/*');
    });
}
