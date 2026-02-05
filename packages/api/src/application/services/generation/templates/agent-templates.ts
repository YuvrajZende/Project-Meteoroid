/**
 * Agent Template Orchestrator
 * 
 * Wires actual agent templates to the code generation pipeline.
 * Instead of generating generic code, uses the pre-built templates
 * from the agents directory.
 * 
 * Flow:
 * 1. Analyze task → Determine which agent/template is needed
 * 2. Get template code → Fill in placeholders with context
 * 3. Return production-ready code
 */

// Local type definition (GeneratedFile is a common pattern)
export interface GeneratedFile {
    path: string;
    content: string;
    type: 'code' | 'config' | 'test' | 'doc';
}

// ============================================
// TYPES
// ============================================

export interface TemplateVariable {
    name: string;
    description: string;
    defaultValue?: string;
}

export interface AgentTemplate {
    id: string;
    name: string;
    agent: string;
    category: string;
    description: string;
    files: Array<{
        path: string;
        template: string;
    }>;
    variables: TemplateVariable[];
    dependencies: string[];
}

export interface TemplateContext {
    projectName: string;
    framework: 'fastify' | 'express' | 'nextjs';
    database?: 'prisma' | 'drizzle' | 'supabase';
    language: 'typescript' | 'javascript';
    customVariables?: Record<string, string>;
}

export interface TemplateResult {
    agent: string;
    template: string;
    files: GeneratedFile[];
    dependencies: string[];
    setupInstructions: string[];
}

// ============================================
// TEMPLATE REGISTRY
// ============================================

/**
 * Maps keywords to agent templates
 */
const TEMPLATE_KEYWORDS: Record<string, { agent: string; templates: string[] }> = {
    // Auth Agent
    'jwt': { agent: 'auth-agent', templates: ['jwt-middleware', 'jwt-routes'] },
    'authentication': { agent: 'auth-agent', templates: ['jwt-middleware', 'jwt-routes'] },
    'login': { agent: 'auth-agent', templates: ['jwt-routes', 'password-hashing'] },
    'oauth': { agent: 'auth-agent', templates: ['oauth-provider'] },
    'clerk': { agent: 'auth-agent', templates: ['clerk-setup', 'clerk-webhook'] },
    'rbac': { agent: 'auth-agent', templates: ['rbac'] },
    'role': { agent: 'auth-agent', templates: ['rbac'] },
    'password': { agent: 'auth-agent', templates: ['password-hashing', 'password-validation'] },
    'mfa': { agent: 'auth-agent', templates: ['mfa-totp'] },
    'rate limit': { agent: 'auth-agent', templates: ['rate-limiter'] },

    // Security Agent
    'security': { agent: 'security-agent', templates: ['security-headers', 'helmet'] },
    'helmet': { agent: 'security-agent', templates: ['helmet-config'] },
    'cors': { agent: 'security-agent', templates: ['cors-config'] },
    'csrf': { agent: 'security-agent', templates: ['csrf-protection'] },
    'xss': { agent: 'security-agent', templates: ['xss-protection'] },
    'sql injection': { agent: 'security-agent', templates: ['input-validation'] },
    'waf': { agent: 'security-agent', templates: ['waf-rules'] },
    'bot protection': { agent: 'security-agent', templates: ['bot-protection'] },

    // Monitoring Agent
    'monitoring': { agent: 'monitoring-agent', templates: ['health-check', 'metrics'] },
    'logging': { agent: 'monitoring-agent', templates: ['structured-logging', 'pino'] },
    'health check': { agent: 'monitoring-agent', templates: ['health-check'] },
    'metrics': { agent: 'monitoring-agent', templates: ['prometheus-metrics'] },
    'apm': { agent: 'monitoring-agent', templates: ['apm-setup'] },
    'sentry': { agent: 'monitoring-agent', templates: ['sentry-integration'] },
    'tracing': { agent: 'monitoring-agent', templates: ['distributed-tracing'] },
};

// ============================================
// BUILT-IN TEMPLATES
// ============================================

const BUILTIN_TEMPLATES: Record<string, { code: string; path: string; dependencies: string[] }> = {
    'jwt-middleware': {
        path: 'src/auth/jwt-middleware.ts',
        dependencies: ['@fastify/jwt', 'jsonwebtoken'],
        code: `/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
    interface FastifyRequest {
        user: {
            id: string;
            email: string;
            role: string;
        };
    }
}

interface JwtMiddlewareOptions {
    secret: string;
    excludePaths?: string[];
}

const jwtMiddleware: FastifyPluginAsync<JwtMiddlewareOptions> = async (fastify, options) => {
    const { secret, excludePaths = ['/health', '/auth/login', '/auth/register'] } = options;

    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        // Skip authentication for excluded paths
        if (excludePaths.some(path => request.url.startsWith(path))) {
            return;
        }

        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return reply.status(401).send({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.substring(7);

        try {
            const decoded = fastify.jwt.verify(token);
            request.user = decoded as FastifyRequest['user'];
        } catch (error) {
            return reply.status(401).send({ error: 'Invalid or expired token' });
        }
    });
};

export default fp(jwtMiddleware, {
    name: 'jwt-middleware',
    dependencies: ['@fastify/jwt'],
});
`,
    },
    'jwt-routes': {
        path: 'src/auth/routes.ts',
        dependencies: ['@fastify/jwt', 'bcrypt', 'zod'],
        code: `/**
 * Authentication Routes
 * Login, Register, Refresh Token
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().optional(),
});

// In-memory user store (replace with database in production)
const users = new Map<string, { id: string; email: string; password: string; role: string }>();

const authRoutes: FastifyPluginAsync = async (fastify) => {
    // Register
    fastify.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
        const body = RegisterSchema.parse(request.body);
        
        if (users.has(body.email)) {
            return reply.status(400).send({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(body.password, 10);
        const user = {
            id: crypto.randomUUID(),
            email: body.email,
            password: hashedPassword,
            role: 'user',
        };

        users.set(body.email, user);

        const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
        return { token, user: { id: user.id, email: user.email, role: user.role } };
    });

    // Login
    fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
        const body = LoginSchema.parse(request.body);
        
        const user = users.get(body.email);
        if (!user) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(body.password, user.password);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
        return { token, user: { id: user.id, email: user.email, role: user.role } };
    });

    // Get current user
    fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
            return reply.status(401).send({ error: 'Not authenticated' });
        }
        return { user: request.user };
    });
};

export default authRoutes;
`,
    },
    'health-check': {
        path: 'src/health/health.ts',
        dependencies: [],
        code: `/**
 * Health Check Endpoint
 * Returns server health status and basic metrics
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    checks: {
        name: string;
        status: 'pass' | 'fail';
        duration: number;
    }[];
}

const healthRoutes: FastifyPluginAsync = async (fastify) => {
    const startTime = Date.now();

    fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
        const checks: HealthStatus['checks'] = [];
        
        // Memory check
        const memStart = Date.now();
        const memUsage = process.memoryUsage();
        const memoryOk = memUsage.heapUsed < memUsage.heapTotal * 0.9;
        checks.push({
            name: 'memory',
            status: memoryOk ? 'pass' : 'fail',
            duration: Date.now() - memStart,
        });

        const status: HealthStatus = {
            status: checks.every(c => c.status === 'pass') ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: Date.now() - startTime,
            version: process.env.npm_package_version || '1.0.0',
            checks,
        };

        return status;
    });

    // Deep health check
    fastify.get('/health/deep', async (_request: FastifyRequest, _reply: FastifyReply) => {
        // Add database, redis, external service checks here
        return {
            status: 'healthy',
            services: {
                api: 'up',
                // database: 'up',
                // redis: 'up',
            },
        };
    });
};

export default healthRoutes;
`,
    },
    'security-headers': {
        path: 'src/security/headers.ts',
        dependencies: ['@fastify/helmet'],
        code: `/**
 * Security Headers Configuration
 * Sets up helmet and other security headers
 */

import { FastifyPluginAsync } from 'fastify';
import helmet from '@fastify/helmet';

const securityHeaders: FastifyPluginAsync = async (fastify) => {
    await fastify.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                scriptSrc: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    });

    // Additional security headers
    fastify.addHook('onSend', async (_request, reply) => {
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('X-XSS-Protection', '1; mode=block');
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        reply.header('Permissions-Policy', 'geolocation=(), microphone=()');
    });
};

export default securityHeaders;
`,
    },
};

// ============================================
// AGENT TEMPLATE ORCHESTRATOR
// ============================================

export class AgentTemplateOrchestrator {
    /**
     * Analyze task and suggest templates
     */
    analyzeForTemplates(task: string): { agent: string; templates: string[] }[] {
        const taskLower = task.toLowerCase();
        const suggestions: { agent: string; templates: string[] }[] = [];
        const seenTemplates = new Set<string>();

        for (const [keyword, info] of Object.entries(TEMPLATE_KEYWORDS)) {
            if (taskLower.includes(keyword)) {
                // Avoid duplicate templates
                const newTemplates = info.templates.filter(t => !seenTemplates.has(t));
                if (newTemplates.length > 0) {
                    suggestions.push({
                        agent: info.agent,
                        templates: newTemplates,
                    });
                    newTemplates.forEach(t => seenTemplates.add(t));
                }
            }
        }

        // Default to basic templates if nothing matched
        if (suggestions.length === 0) {
            suggestions.push({ agent: 'auth-agent', templates: ['jwt-middleware', 'jwt-routes'] });
        }

        return suggestions;
    }

    /**
     * Get template code for a specific template
     */
    getTemplate(templateId: string): { code: string; path: string; dependencies: string[] } | null {
        return BUILTIN_TEMPLATES[templateId] || null;
    }

    /**
     * Generate files from templates
     */
    generateFromTemplates(
        templateIds: string[],
        _context: TemplateContext
    ): TemplateResult {
        const files: GeneratedFile[] = [];
        const allDependencies: string[] = [];
        const setupInstructions: string[] = [];
        const agents = new Set<string>();

        for (const templateId of templateIds) {
            const template = this.getTemplate(templateId);
            if (!template) {
                console.warn(`[TEMPLATE] Template not found: ${templateId}`);
                continue;
            }

            // Add file
            files.push({
                path: template.path,
                content: template.code,
                type: 'code',
            });

            // Collect dependencies
            allDependencies.push(...template.dependencies);

            // Find which agent this template belongs to
            for (const [, info] of Object.entries(TEMPLATE_KEYWORDS)) {
                if (info.templates.includes(templateId)) {
                    agents.add(info.agent);
                }
            }
        }

        // Deduplicate dependencies
        const uniqueDeps = [...new Set(allDependencies)];

        if (uniqueDeps.length > 0) {
            setupInstructions.push(`Install dependencies: npm install ${uniqueDeps.join(' ')}`);
        }

        return {
            agent: [...agents].join(', ') || 'unknown',
            template: templateIds.join(', '),
            files,
            dependencies: uniqueDeps,
            setupInstructions,
        };
    }

    /**
     * Full pipeline: analyze task → get templates → generate files
     */
    orchestrate(task: string, context: TemplateContext): TemplateResult {
        console.log(`[TEMPLATE-ORCHESTRATOR] Analyzing task: "${task.substring(0, 50)}..."`);

        // Analyze
        const suggestions = this.analyzeForTemplates(task);
        console.log(`[TEMPLATE-ORCHESTRATOR] Found ${suggestions.length} agent suggestions`);

        // Collect all template IDs
        const allTemplates = suggestions.flatMap(s => s.templates);
        console.log(`[TEMPLATE-ORCHESTRATOR] Templates to use: ${allTemplates.join(', ')}`);

        // Generate
        const result = this.generateFromTemplates(allTemplates, context);
        console.log(`[TEMPLATE-ORCHESTRATOR] Generated ${result.files.length} files`);

        return result;
    }

    /**
     * List all available templates
     */
    listTemplates(): { id: string; path: string; dependencies: string[] }[] {
        return Object.entries(BUILTIN_TEMPLATES).map(([id, template]) => ({
            id,
            path: template.path,
            dependencies: template.dependencies,
        }));
    }
}

// ============================================
// SINGLETON
// ============================================

let templateOrchestratorInstance: AgentTemplateOrchestrator | null = null;

export function getAgentTemplateOrchestrator(): AgentTemplateOrchestrator {
    if (!templateOrchestratorInstance) {
        templateOrchestratorInstance = new AgentTemplateOrchestrator();
    }
    return templateOrchestratorInstance;
}
