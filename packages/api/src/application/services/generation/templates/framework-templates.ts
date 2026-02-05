/**
 * ============================================
 * FRAMEWORK-SPECIFIC TEMPLATES
 * ============================================
 * 
 * Phase 14.3: Framework-Specific Templates
 * 
 * Production-ready templates for each supported framework
 * that ensure consistent patterns across code generation.
 */

import { type StackPresetType, getStackPreset } from '../../../../config/stack-constraints.js';

// ============================================
// TYPES
// ============================================

export interface FrameworkTemplate {
    name: string;
    framework: string;
    files: TemplateFile[];
    dependencies: string[];
    devDependencies: string[];
    scripts: Record<string, string>;
}

export interface TemplateFile {
    path: string;
    content: string;
    description: string;
}

// ============================================
// FASTIFY TEMPLATES
// ============================================

export const FASTIFY_TEMPLATES: Record<string, TemplateFile> = {
    // Entry Point
    'index.ts': {
        path: 'src/index.ts',
        content: `/**
 * Application Entry Point
 */
import { startServer } from './app.js';

async function main(): Promise<void> {
    try {
        await startServer();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

main();
`,
        description: 'Main entry point for the Fastify server'
    },

    // App Configuration
    'app.ts': {
        path: 'src/app.ts',
        content: `/**
 * Fastify Application Configuration
 */
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { registerRoutes } from './routes/index.js';

export async function createApp(): Promise<FastifyInstance> {
    const app = Fastify({
        logger: {
            level: env.LOG_LEVEL || 'info',
            transport: env.NODE_ENV === 'development'
                ? { target: 'pino-pretty' }
                : undefined
        },
        requestIdHeader: 'x-request-id',
        requestIdLogLabel: 'requestId'
    });

    // Security Plugins
    await app.register(cors, {
        origin: env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true
    });

    await app.register(helmet, {
        contentSecurityPolicy: env.NODE_ENV === 'production'
    });

    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute'
    });

    // API Documentation
    await app.register(swagger, {
        swagger: {
            info: {
                title: 'API Documentation',
                version: '1.0.0'
            },
            host: \`localhost:\${env.PORT || 3000}\`,
            schemes: ['http', 'https'],
            consumes: ['application/json'],
            produces: ['application/json']
        }
    });

    await app.register(swaggerUI, {
        routePrefix: '/docs'
    });

    // Register Routes
    await registerRoutes(app);

    // Error Handler
    app.setErrorHandler((error, _request, reply) => {
        app.log.error(error);
        
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal Server Error';
        
        reply.status(statusCode).send({
            success: false,
            error: {
                code: statusCode,
                message: env.NODE_ENV === 'production' && statusCode === 500
                    ? 'Internal Server Error'
                    : message
            }
        });
    });

    return app;
}

export async function startServer(): Promise<void> {
    const app = await createApp();
    
    const port = env.PORT || 3000;
    const host = env.HOST || '0.0.0.0';
    
    try {
        await app.listen({ port, host });
        console.log(\`🚀 Server running at http://\${host}:\${port}\`);
        console.log(\`📚 API Docs at http://\${host}:\${port}/docs\`);
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
    
    // Graceful Shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    
    for (const signal of signals) {
        process.on(signal, async () => {
            console.log(\`\\n\${signal} received. Shutting down gracefully...\`);
            await app.close();
            process.exit(0);
        });
    }
}
`,
        description: 'Fastify app setup with security plugins and error handling'
    },

    // Environment Config
    'env.ts': {
        path: 'src/config/env.ts',
        content: `/**
 * Environment Configuration
 */
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3000'),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(32),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.format());
    process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
`,
        description: 'Type-safe environment configuration with Zod validation'
    },

    // Route Registration
    'routes/index.ts': {
        path: 'src/routes/index.ts',
        content: `/**
 * Route Registration
 */
import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
    // Health Check Routes
    await app.register(healthRoutes, { prefix: '/health' });
    
    // API v1 Routes
    await app.register(async (v1) => {
        // Add your routes here
        // await v1.register(userRoutes, { prefix: '/users' });
    }, { prefix: '/api/v1' });
}
`,
        description: 'Central route registration'
    },

    // Health Routes
    'routes/health.ts': {
        path: 'src/routes/health.ts',
        content: `/**
 * Health Check Routes
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
    app.get('/', {
        schema: {
            description: 'Basic health check',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        timestamp: { type: 'string' }
                    }
                }
            }
        }
    }, async (_request: FastifyRequest, _reply: FastifyReply) => {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString()
        };
    });

    app.get('/deep', {
        schema: {
            description: 'Deep health check with dependencies',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        checks: { type: 'object' },
                        timestamp: { type: 'string' }
                    }
                }
            }
        }
    }, async (_request: FastifyRequest, _reply: FastifyReply) => {
        const checks = {
            database: await checkDatabase(),
            redis: await checkRedis()
        };
        
        const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
        
        return {
            status: allHealthy ? 'healthy' : 'degraded',
            checks,
            timestamp: new Date().toISOString()
        };
    });
}

async function checkDatabase(): Promise<{ status: string; latency?: number }> {
    const start = Date.now();
    try {
        // Simple database health check
        // Returns healthy by default - implement actual check when database is configured
        const isDbConfigured = process.env.DATABASE_URL || process.env.POSTGRES_URL;
        if (!isDbConfigured) {
            return { status: 'degraded', latency: Date.now() - start };
        }
        // Placeholder: When database is available, use:
        // await prisma.$queryRaw\`SELECT 1\`;
        return { status: 'healthy', latency: Date.now() - start };
    } catch {
        return { status: 'unhealthy' };
    }
}

async function checkRedis(): Promise<{ status: string; latency?: number }> {
    const start = Date.now();
    try {
        // Simple Redis health check
        // Returns healthy by default - implement actual check when Redis is configured
        const isRedisConfigured = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
        if (!isRedisConfigured) {
            return { status: 'degraded', latency: Date.now() - start };
        }
        // Placeholder: When Redis is available, use:
        // await redis.ping();
        return { status: 'healthy', latency: Date.now() - start };
    } catch {
        return { status: 'unhealthy' };
    }
}
`,
        description: 'Health check endpoints for monitoring'
    },

    // Types
    'types/index.ts': {
        path: 'src/types/index.ts',
        content: `/**
 * Shared TypeScript Types
 */

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: ResponseMeta;
}

export interface ApiError {
    code: number;
    message: string;
    details?: Record<string, unknown>;
}

export interface ResponseMeta {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
}

// Pagination
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Auth Types
export interface User {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';

// Request Extensions
declare module 'fastify' {
    interface FastifyRequest {
        user?: User;
    }
}
`,
        description: 'Shared TypeScript type definitions'
    }
};

// ============================================
// EXPRESS TEMPLATES
// ============================================

export const EXPRESS_TEMPLATES: Record<string, TemplateFile> = {
    // Entry Point
    'index.ts': {
        path: 'src/index.ts',
        content: `/**
 * Express Application Entry Point
 */
import { createApp } from './app.js';
import { env } from './config/env.js';

async function main(): Promise<void> {
    const app = await createApp();
    
    const port = env.PORT || 3000;
    
    app.listen(port, () => {
        console.log(\`🚀 Server running at http://localhost:\${port}\`);
    });
}

main().catch(console.error);
`,
        description: 'Main entry point for the Express server'
    },

    // App Configuration
    'app.ts': {
        path: 'src/app.ts',
        content: `/**
 * Express Application Configuration
 */
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';

export async function createApp(): Promise<Application> {
    const app = express();

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Security
    app.use(cors({
        origin: env.CORS_ORIGINS?.split(',') || 'http://localhost:3000',
        credentials: true
    }));
    
    app.use(helmet());
    
    app.use(rateLimit({
        windowMs: 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false
    }));

    // Routes
    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Error Handler
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        console.error(err);
        res.status(500).json({
            success: false,
            error: { code: 500, message: 'Internal Server Error' }
        });
    });

    return app;
}
`,
        description: 'Express app setup with security middleware'
    }
};

// ============================================
// NESTJS TEMPLATES
// ============================================

export const NESTJS_TEMPLATES: Record<string, TemplateFile> = {
    // Main Bootstrap
    'main.ts': {
        path: 'src/main.ts',
        content: `/**
 * NestJS Application Bootstrap
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    // Security
    app.use(helmet());
    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:3000',
        credentials: true
    });

    // Validation
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
    }));

    // API Prefix
    app.setGlobalPrefix('api/v1');

    // Swagger Documentation
    const config = new DocumentBuilder()
        .setTitle('API Documentation')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    console.log(\`🚀 Server running at http://localhost:\${port}\`);
    console.log(\`📚 API Docs at http://localhost:\${port}/docs\`);
}

bootstrap();
`,
        description: 'NestJS bootstrap with Swagger and validation'
    },

    // App Module
    'app.module.ts': {
        path: 'src/app.module.ts',
        content: `/**
 * Application Root Module
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true
        }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100
        }]),
        HealthModule
    ],
    controllers: [],
    providers: []
})
export class AppModule {}
`,
        description: 'NestJS root module configuration'
    }
};

// ============================================
// HONO TEMPLATES (Serverless)
// ============================================

export const HONO_TEMPLATES: Record<string, TemplateFile> = {
    // Entry Point
    'index.ts': {
        path: 'src/index.ts',
        content: `/**
 * Hono Application Entry Point
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());
app.use('*', secureHeaders());

// Health Check
app.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// API Routes
const api = new Hono();

api.get('/', (c) => {
    return c.json({ message: 'API v1' });
});

app.route('/api/v1', api);

// Error Handler
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal Server Error' }, 500);
});

// Not Found Handler
app.notFound((c) => {
    return c.json({ error: 'Not Found' }, 404);
});

export default app;
`,
        description: 'Hono app for serverless deployments'
    }
};

// ============================================
// TEMPLATE SELECTOR
// ============================================

export function getFrameworkTemplates(
    framework: 'fastify' | 'express' | 'nestjs' | 'hono'
): Record<string, TemplateFile> {
    switch (framework) {
        case 'fastify':
            return FASTIFY_TEMPLATES;
        case 'express':
            return EXPRESS_TEMPLATES;
        case 'nestjs':
            return NESTJS_TEMPLATES;
        case 'hono':
            return HONO_TEMPLATES;
        default:
            return FASTIFY_TEMPLATES;
    }
}

export function getTemplateForStack(stackType: StackPresetType): Record<string, TemplateFile> {
    const preset = getStackPreset(stackType);
    return getFrameworkTemplates(preset.backend.framework as 'fastify' | 'express' | 'nestjs' | 'hono');
}

/**
 * Detect framework from user prompt
 */
export function detectFrameworkFromPrompt(prompt: string): 'fastify' | 'express' | 'nestjs' | 'hono' {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('express')) return 'express';
    if (lowerPrompt.includes('nestjs') || lowerPrompt.includes('nest.js')) return 'nestjs';
    if (lowerPrompt.includes('hono') || lowerPrompt.includes('serverless') || lowerPrompt.includes('edge')) return 'hono';

    // Default to Fastify (best choice for most cases)
    return 'fastify';
}

/**
 * Get complete project template with all files
 */
export function getCompleteProjectTemplate(
    framework: 'fastify' | 'express' | 'nestjs' | 'hono'
): FrameworkTemplate {
    const templates = getFrameworkTemplates(framework);
    const files = Object.values(templates);

    const dependencyMap: Record<string, string[]> = {
        fastify: [
            'fastify',
            '@fastify/cors',
            '@fastify/helmet',
            '@fastify/rate-limit',
            '@fastify/swagger',
            '@fastify/swagger-ui',
            'pino',
            'pino-pretty',
            'zod',
            'dotenv'
        ],
        express: [
            'express',
            'cors',
            'helmet',
            'express-rate-limit',
            'zod',
            'dotenv'
        ],
        nestjs: [
            '@nestjs/common',
            '@nestjs/core',
            '@nestjs/platform-express',
            '@nestjs/config',
            '@nestjs/swagger',
            '@nestjs/throttler',
            'class-validator',
            'class-transformer',
            'helmet',
            'dotenv'
        ],
        hono: [
            'hono',
            '@hono/zod-validator',
            'zod'
        ]
    };

    const devDependencyMap: Record<string, string[]> = {
        fastify: ['typescript', '@types/node', 'tsx', 'vitest'],
        express: ['typescript', '@types/node', '@types/express', '@types/cors', 'tsx', 'vitest'],
        nestjs: ['typescript', '@types/node', '@nestjs/cli', '@nestjs/testing', 'vitest'],
        hono: ['typescript', '@types/node', 'wrangler', 'vitest']
    };

    const scriptMap: Record<string, Record<string, string>> = {
        fastify: {
            'dev': 'tsx watch src/index.ts',
            'build': 'tsc',
            'start': 'node dist/index.js',
            'test': 'vitest'
        },
        express: {
            'dev': 'tsx watch src/index.ts',
            'build': 'tsc',
            'start': 'node dist/index.js',
            'test': 'vitest'
        },
        nestjs: {
            'dev': 'nest start --watch',
            'build': 'nest build',
            'start': 'node dist/main.js',
            'test': 'vitest'
        },
        hono: {
            'dev': 'wrangler dev src/index.ts',
            'deploy': 'wrangler deploy src/index.ts',
            'test': 'vitest'
        }
    };

    return {
        name: `${framework}-template`,
        framework,
        files,
        dependencies: dependencyMap[framework] || [],
        devDependencies: devDependencyMap[framework] || [],
        scripts: scriptMap[framework] || {}
    };
}

// ============================================
// EXPORTS
// ============================================

export default {
    FASTIFY_TEMPLATES,
    EXPRESS_TEMPLATES,
    NESTJS_TEMPLATES,
    HONO_TEMPLATES,
    getFrameworkTemplates,
    getTemplateForStack,
    detectFrameworkFromPrompt,
    getCompleteProjectTemplate
};
