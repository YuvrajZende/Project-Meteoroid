/**
 * Webhook Routes
 * External webhook handlers for third-party integrations
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify webhook signature (HMAC-SHA256)
 */
function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    try {
        return timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

/**
 * Verify Stripe webhook signature
 * Stripe uses a different signature format: timestamp + signature
 */
function verifyStripeSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    try {
        // Stripe signature format: t={timestamp},v1={signature}
        const [t, v1] = signature.split(',');
        if (!t || !v1) {
            return false;
        }

        const timestamp = Number(t.replace('t=', ''));
        const now = Math.floor(Date.now() / 1000);

        // Reject timestamps older than 5 minutes
        if (now - timestamp > 300) {
            return false;
        }

        // Recreate signature
        const payloadForSigning = `${t}.${payload}`;
        const expectedSignature = createHmac('sha256', secret)
            .update(payloadForSigning)
            .digest('hex');

        const providedSignature = v1.replace('v1=', '');
        return timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(providedSignature)
        );
    } catch {
        return false;
    }
}

/**
 * Register webhook routes
 */
export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {

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

        if (webhookSecret && signature) {
            const isValid = verifyWebhookSignature(
                JSON.stringify(request.body),
                signature,
                webhookSecret
            );

            if (!isValid) {
                return reply.status(401).send({
                    error: 'Invalid webhook signature',
                });
            }
        }

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

        if (!webhookSecret) {
            return reply.status(500).send({
                error: 'Stripe webhook not configured',
            });
        }

        if (!signature) {
            return reply.status(401).send({
                error: 'Missing Stripe signature',
            });
        }

        // Get raw body for signature verification
        const rawBody = request.rawBody || JSON.stringify(request.body);

        // Verify Stripe signature
        if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
            app.log.warn('Invalid Stripe webhook signature');
            return reply.status(401).send({
                error: 'Invalid signature',
            });
        }

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

        if (webhookSecret && signature) {
            const sig = signature.replace('sha256=', '');
            const isValid = verifyWebhookSignature(
                JSON.stringify(request.body),
                sig,
                webhookSecret
            );

            if (!isValid) {
                return reply.status(401).send({
                    error: 'Invalid GitHub signature',
                });
            }
        }

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
}
