/**
 * CSRF Protection Plugin
 * Cross-Site Request Forgery protection for Fastify
 * 
 * Implements the Synchronizer Token Pattern:
 * - Server generates a random token
 * - Token is sent to client via response body
 * - Client must include token in subsequent state-changing requests via header
 * - Server validates token matches
 * 
 * @module plugins/csrf
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

/**
 * CSRF configuration
 */
export interface CSRFConfig {
    /** Header name for CSRF token */
    headerName: string;
    /** Token expiry in seconds (default: 1 hour) */
    tokenExpiry: number;
    /** Routes to exclude from CSRF (regex patterns) */
    excludeRoutes: RegExp[];
    /** Methods that require CSRF validation */
    protectedMethods: string[];
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: CSRFConfig = {
    headerName: 'X-CSRF-Token',
    tokenExpiry: 3600, // 1 hour
    excludeRoutes: [
        /^\/health$/,
        /^\/status$/,
        /^\/docs/,
        /^\/api\/v1\/webhooks/,
        /^\/api\/v1\/auth\/login$/,      // Login doesn't need CSRF (no session yet)
        /^\/api\/v1\/auth\/signup$/,     // Signup doesn't need CSRF
        /^\/api\/v1\/auth\/refresh$/,    // Refresh uses refresh token
        /^\/api\/v1\/csrf-token$/,       // CSRF token endpoint itself
    ],
    protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
};

// ============================================
// CSRF SERVICE CLASS
// ============================================

/**
 * CSRF Protection Service
 */
export class CSRFService {
    private config: CSRFConfig;
    private secret: string;

    constructor(config?: Partial<CSRFConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.secret = process.env.CSRF_SECRET || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate a CSRF token
     */
    generateToken(): string {
        const timestamp = Date.now();
        const random = crypto.randomBytes(32).toString('hex');
        const data = `${timestamp}:${random}`;

        // Sign the token
        const signature = crypto
            .createHmac('sha256', this.secret)
            .update(data)
            .digest('hex');

        return `${data}:${signature}`;
    }

    /**
     * Validate a CSRF token
     */
    validateToken(token: string): boolean {
        if (!token) return false;

        const parts = token.split(':');
        if (parts.length !== 3) return false;

        const [timestamp, random, signature] = parts;

        // Check expiry
        const tokenAge = Date.now() - parseInt(timestamp, 10);
        if (tokenAge > this.config.tokenExpiry * 1000) {
            return false;
        }

        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', this.secret)
            .update(`${timestamp}:${random}`)
            .digest('hex');

        // Constant-time comparison
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    }

    /**
     * Check if route is excluded from CSRF
     */
    isExcluded(path: string): boolean {
        return this.config.excludeRoutes.some(pattern => pattern.test(path));
    }

    /**
     * Check if method requires CSRF
     */
    requiresCSRF(method: string): boolean {
        return this.config.protectedMethods.includes(method.toUpperCase());
    }

    /**
     * Get configuration
     */
    getConfig(): CSRFConfig {
        return { ...this.config };
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let csrfService: CSRFService | null = null;

export function getCSRFService(): CSRFService {
    if (!csrfService) {
        csrfService = new CSRFService();
    }
    return csrfService;
}

// ============================================
// FASTIFY PLUGIN
// ============================================

/**
 * Register CSRF protection plugin
 */
export async function registerCSRF(app: FastifyInstance, config?: Partial<CSRFConfig>): Promise<void> {
    const csrf = new CSRFService(config);
    const csrfConfig = csrf.getConfig();

    // Decorate request with CSRF token (set during validation)
    app.decorateRequest('csrfToken', null);

    // Decorate reply with generateCsrfToken method
    app.decorateReply('generateCsrfToken', function (): string {
        return csrf.generateToken();
    });

    // CSRF token endpoint - clients call this to get a token
    app.get('/api/v1/csrf-token', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const token = csrf.generateToken();

        return {
            success: true,
            csrfToken: token,
            expiresIn: csrfConfig.tokenExpiry,
            headerName: csrfConfig.headerName,
        };
    });

    // CSRF validation hook
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        // Skip if method doesn't require CSRF
        if (!csrf.requiresCSRF(request.method)) {
            return;
        }

        // Skip excluded routes
        const path = request.url.split('?')[0]; // Remove query string
        if (csrf.isExcluded(path)) {
            return;
        }

        // Skip if request has API key (machine-to-machine)
        const apiKey = request.headers['x-api-key'];
        if (apiKey) {
            return;
        }

        // Skip if request has Bearer token (already authenticated)
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return;
        }

        // Get CSRF token from header
        const headerToken = request.headers[csrfConfig.headerName.toLowerCase()] as string | undefined;

        // Token must be present
        if (!headerToken) {
            return reply.status(403).send({
                success: false,
                error: 'CSRF validation failed',
                message: `Missing ${csrfConfig.headerName} header`,
            });
        }

        // Validate the header token
        if (!csrf.validateToken(headerToken)) {
            return reply.status(403).send({
                success: false,
                error: 'CSRF validation failed',
                message: 'Invalid or expired CSRF token',
            });
        }

        // Store token on request for later use
        (request as FastifyRequest & { csrfToken: string }).csrfToken = headerToken;
    });

    app.log.info('[CSRF] CSRF protection plugin registered');
}

// ============================================
// TYPE EXTENSIONS
// ============================================

declare module 'fastify' {
    interface FastifyRequest {
        csrfToken: string | null;
    }
    interface FastifyReply {
        generateCsrfToken: () => string;
    }
}
