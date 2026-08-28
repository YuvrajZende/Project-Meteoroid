/**
 * AI Response Mocks
 * Realistic mock responses for testing without actual AI calls
 */

// ============================================
// TYPES
// ============================================

export interface MockAIResponse {
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    finishReason: 'stop' | 'length' | 'content_filter';
}

export interface MockCodeGeneration {
    files: Array<{
        path: string;
        content: string;
        language: string;
    }>;
    explanation: string;
    dependencies?: string[];
}

// ============================================
// AUTH AGENT MOCK RESPONSES
// ============================================

export const AUTH_AGENT_MOCKS = {
    jwtAuth: {
        files: [
            {
                path: 'src/auth/jwt.ts',
                content: `import jwt from 'jsonwebtoken';

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export function generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function decodeToken(token: string): JWTPayload | null {
    try {
        return jwt.decode(token) as JWTPayload;
    } catch {
        return null;
    }
}`,
                language: 'typescript',
            },
            {
                path: 'src/auth/middleware.ts',
                content: `import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from './jwt';

export async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    try {
        const payload = verifyToken(token);
        (request as any).user = payload;
    } catch (error) {
        return reply.status(401).send({ error: 'Invalid or expired token' });
    }
}`,
                language: 'typescript',
            },
        ],
        explanation: 'Created JWT authentication with access and refresh token support. Includes middleware for protecting routes.',
        dependencies: ['jsonwebtoken', '@types/jsonwebtoken'],
    },

    passwordHashing: {
        files: [
            {
                path: 'src/auth/password.ts',
                content: `import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    return { valid: errors.length === 0, errors };
}`,
                language: 'typescript',
            },
        ],
        explanation: 'Created secure password hashing with bcrypt (12 rounds) and password strength validation.',
        dependencies: ['bcrypt', '@types/bcrypt'],
    },
};

// ============================================
// SECURITY AGENT MOCK RESPONSES
// ============================================

export const SECURITY_AGENT_MOCKS = {
    rateLimiting: {
        files: [
            {
                path: 'src/security/rate-limiter.ts',
                content: `import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function createRateLimiter(config: RateLimitConfig) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const key = request.ip;
        const now = Date.now();
        
        let record = requestCounts.get(key);
        
        if (!record || now > record.resetTime) {
            record = { count: 1, resetTime: now + config.windowMs };
            requestCounts.set(key, record);
        } else {
            record.count++;
        }
        
        reply.header('X-RateLimit-Limit', config.max);
        reply.header('X-RateLimit-Remaining', Math.max(0, config.max - record.count));
        reply.header('X-RateLimit-Reset', record.resetTime);
        
        if (record.count > config.max) {
            return reply.status(429).send({
                error: config.message || 'Too many requests',
                retryAfter: Math.ceil((record.resetTime - now) / 1000),
            });
        }
    };
}

export const defaultRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Rate limit exceeded. Please try again later.',
});`,
                language: 'typescript',
            },
        ],
        explanation: 'Created in-memory rate limiter with configurable windows and limits. Adds standard rate limit headers to responses.',
        dependencies: [],
    },

    securityHeaders: {
        files: [
            {
                path: 'src/security/headers.ts',
                content: `import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export function securityHeaders(
    _request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
): void {
    // Prevent MIME type sniffing
    reply.header('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    reply.header('X-Frame-Options', 'DENY');
    
    // XSS protection
    reply.header('X-XSS-Protection', '1; mode=block');
    
    // HSTS - force HTTPS
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // CSP
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    
    // Referrer policy
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    done();
}`,
                language: 'typescript',
            },
        ],
        explanation: 'Added comprehensive security headers including HSTS, CSP, XSS protection, and more.',
        dependencies: [],
    },
};

// ============================================
// MONITORING AGENT MOCK RESPONSES
// ============================================

export const MONITORING_AGENT_MOCKS = {
    logger: {
        files: [
            {
                path: 'src/monitoring/logger.ts',
                content: `import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: isDevelopment ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
        },
    } : undefined,
    redact: ['password', 'token', 'authorization', 'cookie'],
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            headers: req.headers,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
        err: pino.stdSerializers.err,
    },
});

export function createChildLogger(context: Record<string, unknown>) {
    return logger.child(context);
}`,
                language: 'typescript',
            },
        ],
        explanation: 'Created structured Pino logger with redaction for sensitive fields and pretty printing for development.',
        dependencies: ['pino', 'pino-pretty'],
    },

    healthCheck: {
        files: [
            {
                path: 'src/monitoring/health.ts',
                content: `import { FastifyInstance } from 'fastify';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    timestamp: string;
    services: Record<string, { status: string; latency?: number }>;
}

const startTime = Date.now();

export async function getHealthStatus(): Promise<HealthStatus> {
    const services: Record<string, { status: string; latency?: number }> = {};
    
    // Check Redis
    try {
        const start = Date.now();
        // await redis.ping();
        services.redis = { status: 'healthy', latency: Date.now() - start };
    } catch {
        services.redis = { status: 'unhealthy' };
    }
    
    // Check Database
    try {
        const start = Date.now();
        // await db.query('SELECT 1');
        services.database = { status: 'healthy', latency: Date.now() - start };
    } catch {
        services.database = { status: 'unhealthy' };
    }
    
    const unhealthyCount = Object.values(services).filter(s => s.status === 'unhealthy').length;
    
    return {
        status: unhealthyCount === 0 ? 'healthy' : unhealthyCount < 2 ? 'degraded' : 'unhealthy',
        uptime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        services,
    };
}

export function registerHealthRoutes(app: FastifyInstance): void {
    app.get('/health', async () => {
        const health = await getHealthStatus();
        return health;
    });
    
    app.get('/health/ready', async (_, reply) => {
        const health = await getHealthStatus();
        if (health.status === 'unhealthy') {
            return reply.status(503).send({ ready: false });
        }
        return { ready: true };
    });
    
    app.get('/health/live', async () => {
        return { alive: true };
    });
}`,
                language: 'typescript',
            },
        ],
        explanation: 'Created comprehensive health check system with service status, readiness, and liveness probes.',
        dependencies: [],
    },
};

// ============================================
// MOCK RESPONSE GENERATOR
// ============================================

export function createMockAIResponse(content: string): MockAIResponse {
    return {
        content,
        usage: {
            promptTokens: Math.floor(content.length / 4),
            completionTokens: Math.floor(content.length / 3),
            totalTokens: Math.floor(content.length / 4) + Math.floor(content.length / 3),
        },
        model: 'gpt-4-mock',
        finishReason: 'stop',
    };
}

export function getMockResponse(agentId: string, task: string): MockCodeGeneration | null {
    const taskLower = task.toLowerCase();

    if (agentId.includes('auth')) {
        if (taskLower.includes('jwt') || taskLower.includes('token')) {
            return AUTH_AGENT_MOCKS.jwtAuth;
        }
        if (taskLower.includes('password') || taskLower.includes('hash')) {
            return AUTH_AGENT_MOCKS.passwordHashing;
        }
        // Default auth response
        return AUTH_AGENT_MOCKS.jwtAuth;
    }

    if (agentId.includes('security')) {
        if (taskLower.includes('rate') || taskLower.includes('limit')) {
            return SECURITY_AGENT_MOCKS.rateLimiting;
        }
        if (taskLower.includes('header') || taskLower.includes('helmet')) {
            return SECURITY_AGENT_MOCKS.securityHeaders;
        }
        return SECURITY_AGENT_MOCKS.securityHeaders;
    }

    if (agentId.includes('monitoring')) {
        if (taskLower.includes('log')) {
            return MONITORING_AGENT_MOCKS.logger;
        }
        if (taskLower.includes('health')) {
            return MONITORING_AGENT_MOCKS.healthCheck;
        }
        return MONITORING_AGENT_MOCKS.logger;
    }

    return null;
}

// ============================================
// EXPORTS
// ============================================

export const MOCKS = {
    auth: AUTH_AGENT_MOCKS,
    security: SECURITY_AGENT_MOCKS,
    monitoring: MONITORING_AGENT_MOCKS,
};
