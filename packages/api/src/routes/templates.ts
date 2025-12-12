/**
 * Template Routes
 * API endpoints for accessing agent templates
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// TEMPLATE METADATA
// ============================================

interface TemplateInfo {
    id: string;
    name: string;
    description: string;
    category: string;
    agent: string;
    dependencies: string[];
    envVariables: string[];
}

// Template registry (would be populated from agents)
const TEMPLATE_REGISTRY: Record<string, TemplateInfo[]> = {
    auth: [
        {
            id: 'clerk-auth',
            name: 'Clerk Authentication',
            description: 'Complete Clerk authentication integration with webhooks',
            category: 'auth',
            agent: 'auth-agent',
            dependencies: ['@clerk/nextjs', '@clerk/backend', 'svix'],
            envVariables: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
        },
        {
            id: 'jwt-auth',
            name: 'JWT Authentication',
            description: 'Custom JWT authentication with refresh tokens',
            category: 'auth',
            agent: 'auth-agent',
            dependencies: ['jsonwebtoken', 'bcryptjs'],
            envVariables: ['JWT_SECRET', 'JWT_EXPIRES_IN'],
        },
        {
            id: 'oauth',
            name: 'OAuth Providers',
            description: 'OAuth 2.0 integration for Google, GitHub, etc.',
            category: 'auth',
            agent: 'auth-agent',
            dependencies: ['passport', 'passport-google-oauth20', 'passport-github2'],
            envVariables: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        },
        {
            id: 'rbac',
            name: 'Role-Based Access Control',
            description: 'RBAC with roles and permissions',
            category: 'auth',
            agent: 'auth-agent',
            dependencies: [],
            envVariables: [],
        },
        {
            id: 'mfa',
            name: 'Multi-Factor Authentication',
            description: 'TOTP, SMS, and backup codes MFA',
            category: 'auth',
            agent: 'auth-agent',
            dependencies: ['otplib', 'qrcode'],
            envVariables: [],
        },
    ],
    security: [
        {
            id: 'helmet',
            name: 'Helmet Security Headers',
            description: 'Comprehensive security headers with CSP',
            category: 'security',
            agent: 'security-agent',
            dependencies: ['helmet'],
            envVariables: [],
        },
        {
            id: 'cors',
            name: 'CORS Configuration',
            description: 'Cross-Origin Resource Sharing setup',
            category: 'security',
            agent: 'security-agent',
            dependencies: ['cors'],
            envVariables: ['CORS_ALLOWED_ORIGINS'],
        },
        {
            id: 'rate-limiter',
            name: 'Rate Limiting',
            description: 'Express rate limiting with Redis support',
            category: 'security',
            agent: 'security-agent',
            dependencies: ['express-rate-limit', 'rate-limit-redis'],
            envVariables: ['REDIS_URL'],
        },
        {
            id: 'input-sanitization',
            name: 'Input Sanitization',
            description: 'XSS and SQL injection prevention',
            category: 'security',
            agent: 'security-agent',
            dependencies: ['xss-clean', 'hpp'],
            envVariables: [],
        },
        {
            id: 'secret-scanner',
            name: 'Secret Scanner',
            description: 'Detect hardcoded secrets in code',
            category: 'security',
            agent: 'security-agent',
            dependencies: [],
            envVariables: [],
        },
    ],
    monitoring: [
        {
            id: 'datadog-apm',
            name: 'Datadog APM',
            description: 'Application performance monitoring with Datadog',
            category: 'monitoring',
            agent: 'monitoring-agent',
            dependencies: ['dd-trace'],
            envVariables: ['DD_API_KEY', 'DD_APP_KEY', 'DD_ENV'],
        },
        {
            id: 'sentry',
            name: 'Sentry Error Tracking',
            description: 'Error tracking and performance monitoring',
            category: 'monitoring',
            agent: 'monitoring-agent',
            dependencies: ['@sentry/node', '@sentry/tracing'],
            envVariables: ['SENTRY_DSN'],
        },
        {
            id: 'prometheus-metrics',
            name: 'Prometheus Metrics',
            description: 'Prometheus-compatible metrics collection',
            category: 'monitoring',
            agent: 'monitoring-agent',
            dependencies: ['prom-client'],
            envVariables: [],
        },
        {
            id: 'structured-logging',
            name: 'Structured Logging',
            description: 'Winston/Pino structured logging with rotation',
            category: 'monitoring',
            agent: 'monitoring-agent',
            dependencies: ['winston', 'winston-daily-rotate-file'],
            envVariables: ['LOG_LEVEL'],
        },
        {
            id: 'health-checks',
            name: 'Health Check Endpoints',
            description: 'Kubernetes-ready health check endpoints',
            category: 'monitoring',
            agent: 'monitoring-agent',
            dependencies: [],
            envVariables: [],
        },
        {
            id: 'opentelemetry',
            name: 'OpenTelemetry Tracing',
            description: 'Distributed tracing with OpenTelemetry',
            category: 'monitoring',
            agent: 'monitoring-agent',
            dependencies: ['@opentelemetry/api', '@opentelemetry/sdk-node'],
            envVariables: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
        },
    ],
};

// ============================================
// ROUTE HANDLERS
// ============================================

/**
 * Register template routes
 */
export async function registerTemplateRoutes(app: FastifyInstance): Promise<void> {

    /**
     * GET /api/v1/templates - List all available templates
     */
    app.get('/api/v1/templates', {
        schema: {
            tags: ['Templates'],
            summary: 'List all templates',
            description: 'Returns all available code generation templates',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        categories: { type: 'array', items: { type: 'string' } },
                        templates: { type: 'object' },
                        total: { type: 'number' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const categories = Object.keys(TEMPLATE_REGISTRY);
        const total = Object.values(TEMPLATE_REGISTRY).flat().length;

        return reply.send({
            categories,
            templates: TEMPLATE_REGISTRY,
            total,
        });
    });

    /**
     * GET /api/v1/templates/:category - Get templates by category
     */
    app.get('/api/v1/templates/:category', {
        schema: {
            tags: ['Templates'],
            summary: 'Get templates by category',
            description: 'Returns templates for a specific category (auth, security, monitoring)',
            params: {
                type: 'object',
                properties: {
                    category: { type: 'string', enum: ['auth', 'security', 'monitoring'] },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: { category: string } }>, reply: FastifyReply) => {
        const { category } = request.params;

        const templates = TEMPLATE_REGISTRY[category];
        if (!templates) {
            return reply.status(404).send({
                error: 'Category not found',
                message: `No templates for category '${category}'`,
                availableCategories: Object.keys(TEMPLATE_REGISTRY),
            });
        }

        return reply.send({
            category,
            templates,
            count: templates.length,
        });
    });

    /**
     * GET /api/v1/templates/:category/:templateId - Get specific template info
     */
    app.get('/api/v1/templates/:category/:templateId', {
        schema: {
            tags: ['Templates'],
            summary: 'Get template details',
            description: 'Returns detailed information about a specific template',
        },
    }, async (request: FastifyRequest<{
        Params: { category: string; templateId: string }
    }>, reply: FastifyReply) => {
        const { category, templateId } = request.params;

        const templates = TEMPLATE_REGISTRY[category];
        if (!templates) {
            return reply.status(404).send({
                error: 'Category not found',
                message: `No templates for category '${category}'`,
            });
        }

        const template = templates.find(t => t.id === templateId);
        if (!template) {
            return reply.status(404).send({
                error: 'Template not found',
                message: `No template '${templateId}' in category '${category}'`,
                availableTemplates: templates.map(t => t.id),
            });
        }

        return reply.send({
            template,
            usage: {
                install: template.dependencies.length > 0
                    ? `npm install ${template.dependencies.join(' ')}`
                    : 'No additional dependencies required',
                envVars: template.envVariables,
            },
        });
    });

    /**
     * POST /api/v1/templates/generate - Generate code from template
     */
    app.post('/api/v1/templates/generate', {
        schema: {
            tags: ['Templates'],
            summary: 'Generate code from template',
            description: 'Generates code files using a template and configuration',
            body: {
                type: 'object',
                required: ['templateId', 'category'],
                properties: {
                    templateId: { type: 'string' },
                    category: { type: 'string' },
                    config: { type: 'object' },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { templateId: string; category: string; config?: Record<string, unknown> }
    }>, reply: FastifyReply) => {
        const { templateId, category, config } = request.body;

        const templates = TEMPLATE_REGISTRY[category];
        if (!templates) {
            return reply.status(404).send({
                error: 'Category not found',
            });
        }

        const template = templates.find(t => t.id === templateId);
        if (!template) {
            return reply.status(404).send({
                error: 'Template not found',
            });
        }

        // Placeholder - would invoke actual agent to generate
        return reply.send({
            success: true,
            message: `Template '${templateId}' generation queued`,
            template,
            config,
            instructions: [
                `Install dependencies: npm install ${template.dependencies.join(' ')}`,
                `Set environment variables: ${template.envVariables.join(', ')}`,
                `Agent '${template.agent}' will generate the code`,
            ],
        });
    });

    app.log.info('[ROUTES] Template routes registered: /api/v1/templates/*');
}
