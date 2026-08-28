/**
 * Security Middleware
 * Comprehensive security hardening for the API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Suspicious patterns for bot detection
 */
const BLOCKED_USER_AGENTS = [
    /curl/i,
    /wget/i,
    /python-requests/i,
    /go-http-client/i,
    /java/i,
    /libwww-perl/i,
    /php\//i,
    /scrapy/i,
    /headlesschrome/i,
    // Allow browsers and common tools
];

/**
 * Rate limit configuration per endpoint
 */
export interface TierRateLimits {
    free: number;
    pro: number;
    enterprise: number;
}

export interface EndpointRateLimits {
    [endpoint: string]: TierRateLimits;
}

export const ENDPOINT_RATE_LIMITS: EndpointRateLimits = {
    '/api/v1/tasks': { free: 10, pro: 100, enterprise: 1000 },
    '/api/v1/agents': { free: 60, pro: 120, enterprise: 300 },
    '/api/v1/auth': { free: 5, pro: 10, enterprise: 20 },
    '/api/v1/projects': { free: 30, pro: 60, enterprise: 200 },
    'default': { free: 100, pro: 200, enterprise: 500 },
};

/**
 * Bot detection result
 */
export interface BotDetectionResult {
    isBot: boolean;
    reason?: string;
    score: number;
}

/**
 * Detect if request is from a bot
 */
export function detectBot(request: FastifyRequest): BotDetectionResult {
    const userAgent = request.headers['user-agent'] || '';
    let score = 0;
    const reasons: string[] = [];

    // Check for blocked user agents
    for (const pattern of BLOCKED_USER_AGENTS) {
        if (pattern.test(userAgent)) {
            score += 30;
            reasons.push('Blocked user agent pattern');
            break;
        }
    }

    // Check for missing user agent
    if (!userAgent || userAgent.length < 10) {
        score += 40;
        reasons.push('Missing or short user agent');
    }

    // Check for missing Accept header
    if (!request.headers.accept) {
        score += 10;
        reasons.push('Missing Accept header');
    }

    // Check for missing Accept-Language
    if (!request.headers['accept-language']) {
        score += 5;
        reasons.push('Missing Accept-Language');
    }

    // Check for suspicious timing (usually bots send requests too fast)
    // This would need request history tracking

    return {
        isBot: score >= 50,
        reason: reasons.join(', '),
        score,
    };
}

/**
 * Input sanitization
 */
export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') return input;

    return input
        // Remove null bytes
        .replace(/\0/g, '')
        // Trim whitespace
        .trim()
        // Remove potential script tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Escape HTML entities
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Deep sanitize an object
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            result[key] = sanitizeInput(value);
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
    // Content Security Policy
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
    ].join('; '),

    // HTTP Strict Transport Security
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Disable content sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // XSS Protection (legacy, but still useful)
    'X-XSS-Protection': '1; mode=block',

    // Permissions Policy
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
};

/**
 * Register security middleware
 */
export async function registerSecurityMiddleware(app: FastifyInstance): Promise<void> {
    // Bot detection hook
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        const botResult = detectBot(request);

        // Attach to request for logging
        (request as FastifyRequest & { botScore: number }).botScore = botResult.score;

        // Block obvious bots (but allow health checks and Swagger)
        const path = request.url;
        const isExemptPath = path === '/health' ||
            path === '/status' ||
            path.startsWith('/docs') ||
            path.startsWith('/api/v1/webhooks');

        if (botResult.isBot && !isExemptPath) {
            app.log.warn({
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                score: botResult.score,
                reason: botResult.reason,
            }, 'Bot request blocked');

            return reply.status(403).send({
                error: 'Forbidden',
                message: 'Automated requests are not allowed',
            });
        }
    });

    // Add security headers
    app.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
        // Only add security headers in production
        if (process.env.NODE_ENV === 'production') {
            for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
                reply.header(header, value);
            }
        }

        // Always hide server info
        reply.removeHeader('X-Powered-By');
        reply.header('Server', 'Loveable');
    });

    // Input sanitization hook (for non-JSON bodies)
    app.addHook('preValidation', async (request: FastifyRequest) => {
        if (request.body && typeof request.body === 'object') {
            // Note: Be careful with this - it modifies the request body
            // Only sanitize if needed for your use case
            // request.body = sanitizeObject(request.body as Record<string, unknown>);
        }
    });

    app.log.info('[SECURITY] Security middleware registered');
}

/**
 * Get rate limit for an endpoint and user tier
 */
export function getRateLimit(
    endpoint: string,
    tier: 'free' | 'pro' | 'enterprise' = 'free'
): number {
    // Find matching endpoint
    for (const [pattern, limits] of Object.entries(ENDPOINT_RATE_LIMITS)) {
        if (pattern !== 'default' && endpoint.startsWith(pattern)) {
            return limits[tier];
        }
    }

    return ENDPOINT_RATE_LIMITS['default'][tier];
}

/**
 * Security report for monitoring
 */
export interface SecurityReport {
    blockedBots: number;
    suspiciousRequests: number;
    rateLimitHits: number;
    failedAuthentications: number;
}

/**
 * Security metrics tracker
 */
export class SecurityMetrics {
    private blockedBots = 0;
    private suspiciousRequests = 0;
    private rateLimitHits = 0;
    private failedAuths = 0;

    incrementBlockedBots(): void {
        this.blockedBots++;
    }

    incrementSuspiciousRequests(): void {
        this.suspiciousRequests++;
    }

    incrementRateLimitHits(): void {
        this.rateLimitHits++;
    }

    incrementFailedAuths(): void {
        this.failedAuths++;
    }

    getReport(): SecurityReport {
        return {
            blockedBots: this.blockedBots,
            suspiciousRequests: this.suspiciousRequests,
            rateLimitHits: this.rateLimitHits,
            failedAuthentications: this.failedAuths,
        };
    }

    reset(): void {
        this.blockedBots = 0;
        this.suspiciousRequests = 0;
        this.rateLimitHits = 0;
        this.failedAuths = 0;
    }
}

// Export singleton
export const securityMetrics = new SecurityMetrics();
