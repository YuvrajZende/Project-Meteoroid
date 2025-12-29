/**
 * ============================================
 * API AGENT - CORE IMPLEMENTATION
 * ============================================
 * 
 * The API Agent is responsible for generating REST/GraphQL/tRPC
 * endpoints, OpenAPI documentation, and API-related code.
 * 
 * Capabilities:
 * - REST API endpoint generation
 * - GraphQL schema and resolver generation
 * - tRPC router generation
 * - OpenAPI/Swagger documentation
 * - API middleware generation
 * - Request/Response validation
 * - Error handling
 * - Rate limiting configuration
 * 
 * @author Person 3 (API Specialist)
 */

// ============================================
// TYPES
// ============================================

export type APIFramework = 'express' | 'fastify' | 'nestjs' | 'hono';
export type APIType = 'rest' | 'graphql' | 'trpc' | 'grpc';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AuthType = 'none' | 'jwt' | 'api-key' | 'oauth2' | 'basic';

export interface APIAgentConfig {
    framework: APIFramework;
    apiType: APIType;
    basePath: string;
    versioning: boolean;
    validation: boolean;
    documentation: boolean;
    rateLimiting: boolean;
    cors: boolean;
}

export interface EndpointDefinition {
    path: string;
    method: HTTPMethod;
    name: string;
    description?: string;
    auth: AuthType;
    requestBody?: SchemaDefinition;
    responseBody?: SchemaDefinition;
    queryParams?: ParameterDefinition[];
    pathParams?: ParameterDefinition[];
    headers?: ParameterDefinition[];
    middleware?: string[];
    rateLimit?: RateLimitConfig;
}

export interface SchemaDefinition {
    type: 'object' | 'array' | 'string' | 'number' | 'boolean';
    properties?: Record<string, PropertyDefinition>;
    items?: PropertyDefinition;
    required?: string[];
}

export interface PropertyDefinition {
    type: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    enum?: string[];
    format?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
}

export interface ParameterDefinition {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    default?: unknown;
}

export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
}

export interface RouterDefinition {
    name: string;
    basePath: string;
    endpoints: EndpointDefinition[];
    middleware?: string[];
}

export interface APIGeneratedFile {
    path: string;
    content: string;
    type: 'router' | 'controller' | 'schema' | 'middleware' | 'types' | 'documentation';
}

export interface APIGenerationResult {
    success: boolean;
    files: APIGeneratedFile[];
    routers: string[];
    endpoints: number;
    documentation?: string;
}

// ============================================
// TEMPLATES
// ============================================

const EXPRESS_ROUTER_TEMPLATE = `import { Router, Request, Response, NextFunction } from 'express';
{{#if validation}}
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
{{/if}}
{{#if auth}}
import { authenticate } from '../middleware/auth.js';
{{/if}}

const router = Router();

{{#each endpoints}}
/**
 * {{method}} {{path}}
 * {{description}}
 */
router.{{lowerMethod}}('{{path}}'{{#if middleware}}, {{middleware}}{{/if}}, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // TODO: Implement {{name}} logic
        {{#if responseBody}}
        const result = {}; // Fetch or compute result
        res.json(result);
        {{else}}
        res.status(204).send();
        {{/if}}
    } catch (error) {
        next(error);
    }
});

{{/each}}
export default router;
`;

const FASTIFY_ROUTER_TEMPLATE = `import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
{{#if validation}}
import { Type, Static } from '@sinclair/typebox';
{{/if}}

export default async function routes(fastify: FastifyInstance) {
{{#each endpoints}}
    fastify.{{lowerMethod}}('{{path}}', {
        {{#if schema}}
        schema: {
            {{#if requestBody}}
            body: {{requestBodySchema}},
            {{/if}}
            {{#if responseBody}}
            response: {
                200: {{responseBodySchema}}
            }
            {{/if}}
        },
        {{/if}}
        {{#if auth}}
        preHandler: [fastify.authenticate],
        {{/if}}
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        // TODO: Implement {{name}} logic
        return { success: true };
    });

{{/each}}
}
`;

const GRAPHQL_SCHEMA_TEMPLATE = `import { gql } from 'graphql-tag';

export const typeDefs = gql\`
    {{#each types}}
    type {{name}} {
        {{#each fields}}
        {{name}}: {{type}}{{#if required}}!{{/if}}
        {{/each}}
    }
    {{/each}}

    type Query {
        {{#each queries}}
        {{name}}{{#if args}}({{args}}){{/if}}: {{returnType}}
        {{/each}}
    }

    type Mutation {
        {{#each mutations}}
        {{name}}{{#if args}}({{args}}){{/if}}: {{returnType}}
        {{/each}}
    }
\`;
`;

const GRAPHQL_RESOLVER_TEMPLATE = `export const resolvers = {
    Query: {
        {{#each queries}}
        {{name}}: async (_parent: unknown, args: {{argsType}}, context: Context) => {
            // TODO: Implement {{name}} query
            return null;
        },
        {{/each}}
    },
    Mutation: {
        {{#each mutations}}
        {{name}}: async (_parent: unknown, args: {{argsType}}, context: Context) => {
            // TODO: Implement {{name}} mutation
            return null;
        },
        {{/each}}
    },
};
`;

const TRPC_ROUTER_TEMPLATE = `import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { z } from 'zod';

export const {{name}}Router = router({
{{#each procedures}}
    {{name}}: {{#if protected}}protectedProcedure{{else}}publicProcedure{{/if}}
        {{#if input}}
        .input(z.object({
            {{#each inputFields}}
            {{name}}: z.{{zodType}}(){{#if optional}}.optional(){{/if}},
            {{/each}}
        }))
        {{/if}}
        .{{procedureType}}(async ({ {{#if input}}input, {{/if}}ctx }) => {
            // TODO: Implement {{name}}
            return { success: true };
        }),

{{/each}}
});
`;

const OPENAPI_TEMPLATE = `openapi: 3.0.3
info:
  title: {{title}}
  description: {{description}}
  version: {{version}}
servers:
  - url: {{serverUrl}}
{{#if security}}
components:
  securitySchemes:
    {{#each securitySchemes}}
    {{name}}:
      type: {{type}}
      {{#if scheme}}scheme: {{scheme}}{{/if}}
      {{#if bearerFormat}}bearerFormat: {{bearerFormat}}{{/if}}
    {{/each}}
{{/if}}
paths:
{{#each paths}}
  {{path}}:
    {{method}}:
      summary: {{summary}}
      description: {{description}}
      {{#if security}}
      security:
        - {{security}}: []
      {{/if}}
      {{#if requestBody}}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/{{requestBodyRef}}'
      {{/if}}
      responses:
        '200':
          description: Successful response
          {{#if responseBody}}
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/{{responseBodyRef}}'
          {{/if}}
        '400':
          description: Bad request
        '401':
          description: Unauthorized
        '500':
          description: Internal server error
{{/each}}
`;

const VALIDATION_MIDDLEWARE_TEMPLATE = `import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validateRequest(schema: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (schema.body) {
                req.body = await schema.body.parseAsync(req.body);
            }
            if (schema.query) {
                req.query = await schema.query.parseAsync(req.query);
            }
            if (schema.params) {
                req.params = await schema.params.parseAsync(req.params);
            }
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation Error',
                    details: error.errors,
                });
            } else {
                next(error);
            }
        }
    };
}
`;

const ERROR_HANDLER_TEMPLATE = `import { Request, Response, NextFunction } from 'express';

export class APIError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code?: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'APIError';
    }
}

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error('API Error:', err);

    if (err instanceof APIError) {
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            details: err.details,
        });
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: (err as any).errors,
        });
    }

    // Default error response
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
}
`;

// ============================================
// API AGENT CLASS
// ============================================

export class APIAgent {
    private config: APIAgentConfig;

    constructor(config?: Partial<APIAgentConfig>) {
        this.config = {
            framework: config?.framework || 'express',
            apiType: config?.apiType || 'rest',
            basePath: config?.basePath || '/api',
            versioning: config?.versioning ?? true,
            validation: config?.validation ?? true,
            documentation: config?.documentation ?? true,
            rateLimiting: config?.rateLimiting ?? true,
            cors: config?.cors ?? true,
        };
    }

    /**
     * Analyze requirements and generate API structure
     */
    async analyzeRequirements(userRequest: string): Promise<RouterDefinition[]> {
        const routers: RouterDefinition[] = [];
        const request = userRequest.toLowerCase();

        // Extract resources from request
        const resourcePatterns = [
            { pattern: /user|users|account|accounts/i, name: 'users', endpoints: this.generateCRUDEndpoints('users') },
            { pattern: /product|products|item|items/i, name: 'products', endpoints: this.generateCRUDEndpoints('products') },
            { pattern: /order|orders|purchase|purchases/i, name: 'orders', endpoints: this.generateCRUDEndpoints('orders') },
            { pattern: /post|posts|article|articles|blog/i, name: 'posts', endpoints: this.generateCRUDEndpoints('posts') },
            { pattern: /comment|comments/i, name: 'comments', endpoints: this.generateCRUDEndpoints('comments') },
            { pattern: /category|categories/i, name: 'categories', endpoints: this.generateCRUDEndpoints('categories') },
            { pattern: /tag|tags/i, name: 'tags', endpoints: this.generateCRUDEndpoints('tags') },
            { pattern: /auth|login|register|signup/i, name: 'auth', endpoints: this.generateAuthEndpoints() },
            { pattern: /payment|payments|checkout/i, name: 'payments', endpoints: this.generatePaymentEndpoints() },
            { pattern: /upload|file|files|media/i, name: 'uploads', endpoints: this.generateUploadEndpoints() },
            { pattern: /notification|notifications/i, name: 'notifications', endpoints: this.generateNotificationEndpoints() },
            { pattern: /search/i, name: 'search', endpoints: this.generateSearchEndpoints() },
        ];

        for (const { pattern, name, endpoints } of resourcePatterns) {
            if (pattern.test(request)) {
                routers.push({
                    name,
                    basePath: `/${name}`,
                    endpoints,
                });
            }
        }

        // If no specific resources found, create a generic CRUD API
        if (routers.length === 0) {
            routers.push({
                name: 'resources',
                basePath: '/resources',
                endpoints: this.generateCRUDEndpoints('resources'),
            });
        }

        return routers;
    }

    /**
     * Generate CRUD endpoints for a resource
     */
    private generateCRUDEndpoints(resource: string): EndpointDefinition[] {
        const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;

        return [
            {
                path: '/',
                method: 'GET',
                name: `list${this.toPascalCase(resource)}`,
                description: `Get all ${resource}`,
                auth: 'jwt',
                queryParams: [
                    { name: 'page', type: 'number', required: false, default: 1 },
                    { name: 'limit', type: 'number', required: false, default: 10 },
                    { name: 'sort', type: 'string', required: false },
                    { name: 'order', type: 'string', required: false, default: 'asc' },
                ],
                responseBody: {
                    type: 'object',
                    properties: {
                        data: { type: 'array', description: `List of ${resource}` },
                        pagination: { type: 'object', description: 'Pagination info' },
                    },
                },
            },
            {
                path: '/:id',
                method: 'GET',
                name: `get${this.toPascalCase(singular)}`,
                description: `Get a ${singular} by ID`,
                auth: 'jwt',
                pathParams: [{ name: 'id', type: 'string', required: true }],
                responseBody: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
            {
                path: '/',
                method: 'POST',
                name: `create${this.toPascalCase(singular)}`,
                description: `Create a new ${singular}`,
                auth: 'jwt',
                requestBody: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: { type: 'string', required: true },
                    },
                },
                responseBody: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
            {
                path: '/:id',
                method: 'PUT',
                name: `update${this.toPascalCase(singular)}`,
                description: `Update a ${singular}`,
                auth: 'jwt',
                pathParams: [{ name: 'id', type: 'string', required: true }],
                requestBody: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                    },
                },
                responseBody: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
            {
                path: '/:id',
                method: 'DELETE',
                name: `delete${this.toPascalCase(singular)}`,
                description: `Delete a ${singular}`,
                auth: 'jwt',
                pathParams: [{ name: 'id', type: 'string', required: true }],
            },
        ];
    }

    /**
     * Generate authentication endpoints
     */
    private generateAuthEndpoints(): EndpointDefinition[] {
        return [
            {
                path: '/register',
                method: 'POST',
                name: 'register',
                description: 'Register a new user',
                auth: 'none',
                requestBody: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 },
                        name: { type: 'string' },
                    },
                },
            },
            {
                path: '/login',
                method: 'POST',
                name: 'login',
                description: 'Login user',
                auth: 'none',
                requestBody: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' },
                    },
                },
            },
            {
                path: '/logout',
                method: 'POST',
                name: 'logout',
                description: 'Logout user',
                auth: 'jwt',
            },
            {
                path: '/refresh',
                method: 'POST',
                name: 'refreshToken',
                description: 'Refresh access token',
                auth: 'none',
                requestBody: {
                    type: 'object',
                    required: ['refreshToken'],
                    properties: {
                        refreshToken: { type: 'string' },
                    },
                },
            },
            {
                path: '/forgot-password',
                method: 'POST',
                name: 'forgotPassword',
                description: 'Request password reset',
                auth: 'none',
                requestBody: {
                    type: 'object',
                    required: ['email'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                    },
                },
            },
            {
                path: '/reset-password',
                method: 'POST',
                name: 'resetPassword',
                description: 'Reset password with token',
                auth: 'none',
                requestBody: {
                    type: 'object',
                    required: ['token', 'password'],
                    properties: {
                        token: { type: 'string' },
                        password: { type: 'string', minLength: 8 },
                    },
                },
            },
            {
                path: '/me',
                method: 'GET',
                name: 'getCurrentUser',
                description: 'Get current user profile',
                auth: 'jwt',
            },
        ];
    }

    /**
     * Generate payment endpoints
     */
    private generatePaymentEndpoints(): EndpointDefinition[] {
        return [
            {
                path: '/create-intent',
                method: 'POST',
                name: 'createPaymentIntent',
                description: 'Create a payment intent',
                auth: 'jwt',
                requestBody: {
                    type: 'object',
                    required: ['amount', 'currency'],
                    properties: {
                        amount: { type: 'number', minimum: 0 },
                        currency: { type: 'string', default: 'usd' },
                    },
                },
            },
            {
                path: '/confirm',
                method: 'POST',
                name: 'confirmPayment',
                description: 'Confirm a payment',
                auth: 'jwt',
            },
            {
                path: '/webhook',
                method: 'POST',
                name: 'handleWebhook',
                description: 'Handle payment provider webhook',
                auth: 'none',
            },
            {
                path: '/history',
                method: 'GET',
                name: 'getPaymentHistory',
                description: 'Get payment history',
                auth: 'jwt',
            },
        ];
    }

    /**
     * Generate upload endpoints
     */
    private generateUploadEndpoints(): EndpointDefinition[] {
        return [
            {
                path: '/',
                method: 'POST',
                name: 'uploadFile',
                description: 'Upload a file',
                auth: 'jwt',
                headers: [{ name: 'Content-Type', type: 'string', required: true }],
            },
            {
                path: '/:id',
                method: 'GET',
                name: 'getFile',
                description: 'Get file metadata',
                auth: 'jwt',
            },
            {
                path: '/:id',
                method: 'DELETE',
                name: 'deleteFile',
                description: 'Delete a file',
                auth: 'jwt',
            },
            {
                path: '/presigned',
                method: 'POST',
                name: 'getPresignedUrl',
                description: 'Get presigned upload URL',
                auth: 'jwt',
            },
        ];
    }

    /**
     * Generate notification endpoints
     */
    private generateNotificationEndpoints(): EndpointDefinition[] {
        return [
            {
                path: '/',
                method: 'GET',
                name: 'listNotifications',
                description: 'Get all notifications',
                auth: 'jwt',
            },
            {
                path: '/:id/read',
                method: 'PUT',
                name: 'markAsRead',
                description: 'Mark notification as read',
                auth: 'jwt',
            },
            {
                path: '/read-all',
                method: 'PUT',
                name: 'markAllAsRead',
                description: 'Mark all notifications as read',
                auth: 'jwt',
            },
            {
                path: '/preferences',
                method: 'GET',
                name: 'getPreferences',
                description: 'Get notification preferences',
                auth: 'jwt',
            },
            {
                path: '/preferences',
                method: 'PUT',
                name: 'updatePreferences',
                description: 'Update notification preferences',
                auth: 'jwt',
            },
        ];
    }

    /**
     * Generate search endpoints
     */
    private generateSearchEndpoints(): EndpointDefinition[] {
        return [
            {
                path: '/',
                method: 'GET',
                name: 'search',
                description: 'Global search',
                auth: 'jwt',
                queryParams: [
                    { name: 'q', type: 'string', required: true },
                    { name: 'type', type: 'string', required: false },
                    { name: 'limit', type: 'number', required: false, default: 20 },
                ],
            },
            {
                path: '/suggest',
                method: 'GET',
                name: 'getSuggestions',
                description: 'Get search suggestions',
                auth: 'jwt',
                queryParams: [
                    { name: 'q', type: 'string', required: true },
                ],
            },
        ];
    }

    /**
     * Generate Express router
     */
    generateExpressRouter(router: RouterDefinition): string {
        const imports = [
            "import { Router, Request, Response, NextFunction } from 'express';",
        ];

        if (this.config.validation) {
            imports.push("import { z } from 'zod';");
            imports.push("import { validateRequest } from '../middleware/validate.js';");
        }

        const hasAuth = router.endpoints.some(e => e.auth !== 'none');
        if (hasAuth) {
            imports.push("import { authenticate } from '../middleware/auth.js';");
        }

        let code = imports.join('\n') + '\n\n';
        code += 'const router = Router();\n\n';

        for (const endpoint of router.endpoints) {
            const method = endpoint.method.toLowerCase();
            const middleware: string[] = [];

            if (endpoint.auth === 'jwt') {
                middleware.push('authenticate');
            }

            if (this.config.validation && endpoint.requestBody) {
                middleware.push(`validateRequest({ body: ${this.generateZodSchema(endpoint.requestBody)} })`);
            }

            const middlewareStr = middleware.length > 0 ? middleware.join(', ') + ', ' : '';

            code += `/**\n * ${endpoint.method} ${endpoint.path}\n * ${endpoint.description || ''}\n */\n`;
            code += `router.${method}('${endpoint.path}', ${middlewareStr}async (req: Request, res: Response, next: NextFunction) => {\n`;
            code += `    try {\n`;
            code += `        // TODO: Implement ${endpoint.name} logic\n`;

            if (endpoint.responseBody) {
                code += `        const result = {}; // Fetch or compute result\n`;
                code += `        res.json(result);\n`;
            } else if (endpoint.method === 'DELETE') {
                code += `        res.status(204).send();\n`;
            } else {
                code += `        res.json({ success: true });\n`;
            }

            code += `    } catch (error) {\n`;
            code += `        next(error);\n`;
            code += `    }\n`;
            code += `});\n\n`;
        }

        code += 'export default router;\n';
        return code;
    }

    /**
     * Generate Zod schema from schema definition
     */
    private generateZodSchema(schema: SchemaDefinition): string {
        if (schema.type === 'object' && schema.properties) {
            const fields = Object.entries(schema.properties).map(([name, prop]) => {
                let zodType = this.mapToZodType(prop.type);
                if (!prop.required && !schema.required?.includes(name)) {
                    zodType += '.optional()';
                }
                return `${name}: ${zodType}`;
            });
            return `z.object({ ${fields.join(', ')} })`;
        }
        return 'z.any()';
    }

    /**
     * Map type to Zod type
     */
    private mapToZodType(type: string): string {
        const mapping: Record<string, string> = {
            'string': 'z.string()',
            'number': 'z.number()',
            'boolean': 'z.boolean()',
            'array': 'z.array(z.any())',
            'object': 'z.object({})',
        };
        return mapping[type] || 'z.any()';
    }

    /**
     * Generate OpenAPI documentation
     */
    generateOpenAPIDoc(routers: RouterDefinition[]): string {
        const doc: any = {
            openapi: '3.0.3',
            info: {
                title: 'API Documentation',
                description: 'Auto-generated API documentation',
                version: '1.0.0',
            },
            servers: [{ url: this.config.basePath }],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
            paths: {},
        };

        for (const router of routers) {
            for (const endpoint of router.endpoints) {
                const path = router.basePath + endpoint.path;
                const method = endpoint.method.toLowerCase();

                if (!doc.paths[path]) {
                    doc.paths[path] = {};
                }

                doc.paths[path][method] = {
                    summary: endpoint.name,
                    description: endpoint.description,
                    tags: [router.name],
                    ...(endpoint.auth === 'jwt' && { security: [{ bearerAuth: [] }] }),
                    responses: {
                        '200': { description: 'Successful response' },
                        '400': { description: 'Bad request' },
                        '401': { description: 'Unauthorized' },
                        '500': { description: 'Internal server error' },
                    },
                };

                if (endpoint.requestBody) {
                    doc.paths[path][method].requestBody = {
                        required: true,
                        content: {
                            'application/json': {
                                schema: this.schemaToOpenAPI(endpoint.requestBody),
                            },
                        },
                    };
                }
            }
        }

        return JSON.stringify(doc, null, 2);
    }

    /**
     * Convert schema definition to OpenAPI schema
     */
    private schemaToOpenAPI(schema: SchemaDefinition): any {
        if (schema.type === 'object' && schema.properties) {
            return {
                type: 'object',
                properties: Object.fromEntries(
                    Object.entries(schema.properties).map(([name, prop]) => [
                        name,
                        { type: prop.type, description: prop.description },
                    ])
                ),
                required: schema.required,
            };
        }
        return { type: schema.type };
    }

    /**
     * Generate all API files
     */
    async generate(userRequest: string): Promise<APIGenerationResult> {
        const routers = await this.analyzeRequirements(userRequest);
        const files: APIGeneratedFile[] = [];
        let totalEndpoints = 0;

        // Generate routers
        for (const router of routers) {
            totalEndpoints += router.endpoints.length;

            const routerCode = this.generateExpressRouter(router);
            files.push({
                path: `src/routes/${router.name}.ts`,
                content: routerCode,
                type: 'router',
            });
        }

        // Generate middleware
        if (this.config.validation) {
            files.push({
                path: 'src/middleware/validate.ts',
                content: VALIDATION_MIDDLEWARE_TEMPLATE,
                type: 'middleware',
            });
        }

        files.push({
            path: 'src/middleware/error-handler.ts',
            content: ERROR_HANDLER_TEMPLATE,
            type: 'middleware',
        });

        // Generate documentation
        let documentation: string | undefined;
        if (this.config.documentation) {
            documentation = this.generateOpenAPIDoc(routers);
            files.push({
                path: 'docs/openapi.json',
                content: documentation,
                type: 'documentation',
            });
        }

        // Generate index file
        const indexContent = this.generateRouterIndex(routers);
        files.push({
            path: 'src/routes/index.ts',
            content: indexContent,
            type: 'router',
        });

        return {
            success: true,
            files,
            routers: routers.map(r => r.name),
            endpoints: totalEndpoints,
            documentation,
        };
    }

    /**
     * Generate router index file
     */
    private generateRouterIndex(routers: RouterDefinition[]): string {
        let code = "import { Router } from 'express';\n";

        for (const router of routers) {
            code += `import ${router.name}Router from './${router.name}.js';\n`;
        }

        code += '\nconst router = Router();\n\n';

        for (const router of routers) {
            code += `router.use('${router.basePath}', ${router.name}Router);\n`;
        }

        code += '\nexport default router;\n';
        return code;
    }

    private toPascalCase(str: string): string {
        return str
            .split(/[-_\s]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }
}

// ============================================
// SINGLETON
// ============================================

let apiAgent: APIAgent | null = null;

export function getAPIAgent(): APIAgent {
    if (!apiAgent) {
        apiAgent = new APIAgent();
    }
    return apiAgent;
}

export const apiAgentInstance = getAPIAgent();
export default apiAgentInstance;
