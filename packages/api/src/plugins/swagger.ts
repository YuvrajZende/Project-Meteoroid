/**
 * Swagger Plugin Configuration
 * Configures OpenAPI documentation for the API
 */

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/index.js';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
    // Register Swagger (OpenAPI spec generator)
    await app.register(swagger, {
        openapi: {
            info: {
                title: 'Loveable Backend API',
                description: 'Production API for the Loveable AI-powered Backend Orchestrator',
                version: '1.0.0',
                contact: {
                    name: 'API Support',
                    email: 'support@loveable.dev',
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT',
                },
            },
            servers: [
                {
                    url: `http://localhost:${env.PORT}`,
                    description: 'Development server',
                },
                {
                    url: 'https://api.loveable.dev',
                    description: 'Production server',
                },
            ],
            tags: [
                { name: 'Health', description: 'Health check endpoints' },
                { name: 'Auth', description: 'Authentication endpoints' },
                { name: 'Agents', description: 'Agent management endpoints' },
                { name: 'Tasks', description: 'Task submission and management' },
                { name: 'Projects', description: 'Project CRUD operations' },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'Enter your JWT token',
                    },
                    apiKey: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-API-Key',
                        description: 'Enter your API key',
                    },
                },
            },
        },
    });

    // Register Swagger UI
    await app.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
            persistAuthorization: true,
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
    });

    app.log.info('✅ Swagger documentation registered at /docs');
}
