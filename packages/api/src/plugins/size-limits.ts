/**
 * Request Size Limits Plugin
 * Enforces payload size limits for different route types
 * 
 * SECURITY FEATURES:
 * - Tiered limits based on route sensitivity
 * - Prevents DoS via large payloads
 * - Protects memory from oversized requests
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

// ============================================
// SECURITY: Size Limit Tiers
// ============================================

export const SIZE_LIMITS = {
    // Authentication routes - strictest
    auth: {
        maxBody: 4 * 1024, // 4KB - just credentials
        description: 'Auth routes - minimal payload'
    },
    // AI/Orchestration routes - moderate
    orchestrator: {
        maxBody: 50 * 1024, // 50KB - prompts can be long
        description: 'AI orchestration - prompts and context'
    },
    // Standard API routes
    api: {
        maxBody: 1 * 1024 * 1024, // 1MB
        description: 'Standard API operations'
    },
    // File upload routes
    upload: {
        maxBody: 10 * 1024 * 1024, // 10MB
        description: 'File uploads'
    },
    // Webhooks (usually small)
    webhook: {
        maxBody: 64 * 1024, // 64KB
        description: 'Webhook payloads'
    }
} as const;

export type SizeLimitTier = keyof typeof SIZE_LIMITS;

// ============================================
// SECURITY: Size Validation Middleware
// ============================================

export function createSizeLimitMiddleware(tier: SizeLimitTier) {
    const limit = SIZE_LIMITS[tier].maxBody;
    
    return function sizeLimitHook(
        request: FastifyRequest,
        _reply: FastifyReply,
        done: HookHandlerDoneFunction
    ): void {
        const contentLength = request.headers['content-length'];
        
        if (contentLength) {
            const length = parseInt(contentLength, 10);
            
            if (length > limit) {
                request.log.warn({
                    security: true,
                    event: 'payload_too_large',
                    tier,
                    contentLength: length,
                    limit,
                    path: request.url
                }, `[SECURITY] Payload too large for ${tier} tier`);
                
                return done(new Error(`Payload too large. Maximum size for ${tier} routes is ${Math.round(limit / 1024)}KB`));
            }
        }
        
        done();
    };
}

// ============================================
// SECURITY: Get tier based on route path
// ============================================

export function getTierFromPath(path: string): SizeLimitTier {
    if (path.includes('/auth/') || path.includes('/login') || path.includes('/signup')) {
        return 'auth';
    }
    if (path.includes('/orchestrator/')) {
        return 'orchestrator';
    }
    if (path.includes('/webhooks/')) {
        return 'webhook';
    }
    if (path.includes('/upload') || path.includes('/files')) {
        return 'upload';
    }
    return 'api';
}

// ============================================
// SECURITY: Register global size limit hook
// ============================================

export async function registerSizeLimits(app: FastifyInstance): Promise<void> {
    // Add a preHandler hook that applies tiered limits
    app.addHook('preHandler', (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction) => {
        const tier = getTierFromPath(request.url);
        const limit = SIZE_LIMITS[tier].maxBody;
        
        const contentLength = request.headers['content-length'];
        
        if (contentLength) {
            const length = parseInt(contentLength, 10);
            
            if (length > limit) {
                request.log.warn({
                    security: true,
                    event: 'payload_too_large',
                    tier,
                    contentLength: length,
                    limit,
                    path: request.url,
                    ip: request.ip
                }, `[SECURITY] Payload size violation: ${length} bytes exceeds ${tier} limit of ${limit} bytes`);
                
                const error = new Error(`Payload too large. Maximum size: ${Math.round(limit / 1024)}KB`) as any;
                error.statusCode = 413;
                error.code = 'PAYLOAD_TOO_LARGE';
                return done(error);
            }
        }
        
        done();
    });

    app.log.info(`[PLUGINS] Request size limits registered (auth: 4KB, orchestrator: 50KB, api: 1MB, upload: 10MB)`);
}
