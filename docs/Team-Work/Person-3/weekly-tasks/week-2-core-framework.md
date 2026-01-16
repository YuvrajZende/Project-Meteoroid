# Week 2: Core Framework

## 🎯 Objectives

Build upon the foundation established in Week 1 by implementing real-time communication, comprehensive API documentation system, and essential middleware for rate limiting and request logging. This week focuses on creating a robust, production-ready framework that can handle real-world usage scenarios.

### **Success Criteria**
- ✅ WebSocket implementation for real-time updates working correctly
- ✅ Comprehensive API documentation system auto-generating from code
- ✅ Rate limiting preventing abuse while allowing legitimate usage
- ✅ Request logging capturing all activities with useful metrics
- ✅ Performance monitoring foundation in place

## 📋 Prerequisites

### **Week 1 Completion**
- NestJS monorepo structure established
- Basic API endpoints responding correctly
- OpenAPI/Swagger documentation functional
- Error handling implemented consistently

### **Required Dependencies**
- Socket.io for WebSocket implementation
- Redis for rate limiting and caching
- Winston for advanced logging
- Additional NestJS modules for monitoring

### **Team Dependencies**
- **Person 1**: Orchestrator should be ready for real-time communication
- **Person 2**: AI model integration should support progress updates
- **Person 4**: Redis infrastructure should be configured

## 🔄 Step-by-Step Implementation

### Step 1: Implement WebSocket for Real-Time Updates

**Purpose**: Enable real-time communication between the API Agent and other components, particularly for progress updates during API generation.

**Implementation**:

1. **Install WebSocket dependencies**
```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @types/socket.io --save-dev
```

2. **Create WebSocket gateway**
```typescript
// apps/api-generator/src/websocket/api-generation.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/api-generation',
})
export class ApiGenerationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ApiGenerationGateway.name);
  private readonly activeConnections = new Map<string, Socket>();

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.activeConnections.set(client.id, client);
    
    // Send welcome message
    client.emit('connected', {
      message: 'Connected to API Generation WebSocket',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.activeConnections.delete(client.id);
  }

  @SubscribeMessage('start-generation')
  async handleStartGeneration(
    @MessageBody() data: { jobId: string; specifications: any },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    this.logger.log(`Starting generation for job: ${data.jobId}`);
    
    // Join job-specific room
    client.join(`job-${data.jobId}`);
    
    // Emit initial status
    this.server.to(`job-${data.jobId}`).emit('generation-started', {
      jobId: data.jobId,
      status: 'started',
      timestamp: new Date().toISOString(),
    });

    // Simulate generation progress (in real implementation, this would trigger actual generation)
    await this.simulateGenerationProgress(data.jobId);
  }

  @SubscribeMessage('subscribe-job')
  handleSubscribeJob(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    client.join(`job-${data.jobId}`);
    client.emit('subscribed', { jobId: data.jobId });
  }

  @SubscribeMessage('unsubscribe-job')
  handleUnsubscribeJob(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(`job-${data.jobId}`);
    client.emit('unsubscribed', { jobId: data.jobId });
  }

  private async simulateGenerationProgress(jobId: string): Promise<void> {
    const steps = [
      { step: 'Parsing specifications', progress: 10 },
      { step: 'Generating controllers', progress: 30 },
      { step: 'Creating services', progress: 50 },
      { step: 'Adding validation', progress: 70 },
      { step: 'Generating tests', progress: 85 },
      { step: 'Creating documentation', progress: 95 },
      { step: 'Finalizing', progress: 100 },
    ];

    for (const { step, progress } of steps) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate work
      
      this.server.to(`job-${jobId}`).emit('generation-progress', {
        jobId,
        step,
        progress,
        timestamp: new Date().toISOString(),
      });
    }

    // Emit completion
    this.server.to(`job-${jobId}`).emit('generation-completed', {
      jobId,
      status: 'completed',
      timestamp: new Date().toISOString(),
      result: {
        files: ['controller.ts', 'service.ts', 'module.ts'],
        documentation: 'api-docs.json',
        tests: ['controller.spec.ts', 'service.spec.ts'],
      },
    });
  }

  // Public method for external services to send updates
  broadcastJobUpdate(jobId: string, update: any): void {
    this.server.to(`job-${jobId}`).emit('job-update', {
      jobId,
      ...update,
      timestamp: new Date().toISOString(),
    });
  }

  // Get connection statistics
  getConnectionStats(): { connected: number; activeJobs: number } {
    return {
      connected: this.activeConnections.size,
      activeJobs: this.server.sockets.adapter.rooms.size - this.activeConnections.size,
    };
  }
}
```

3. **Create WebSocket service**
```typescript
// apps/api-generator/src/websocket/websocket.service.ts
import { Injectable } from '@nestjs/common';
import { ApiGenerationGateway } from './api-generation.gateway';

@Injectable()
export class WebsocketService {
  constructor(private readonly gateway: ApiGenerationGateway) {}

  // Send progress update for a specific job
  sendProgressUpdate(jobId: string, step: string, progress: number): void {
    this.gateway.broadcastJobUpdate(jobId, {
      type: 'progress',
      step,
      progress,
    });
  }

  // Send error notification
  sendErrorNotification(jobId: string, error: string): void {
    this.gateway.broadcastJobUpdate(jobId, {
      type: 'error',
      error,
    });
  }

  // Send completion notification
  sendCompletionNotification(jobId: string, result: any): void {
    this.gateway.broadcastJobUpdate(jobId, {
      type: 'completed',
      result,
    });
  }

  // Get connection statistics
  getStats(): { connected: number; activeJobs: number } {
    return this.gateway.getConnectionStats();
  }
}
```

4. **Create WebSocket module**
```typescript
// apps/api-generator/src/websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { ApiGenerationGateway } from './api-generation.gateway';
import { WebsocketService } from './websocket.service';

@Module({
  providers: [ApiGenerationGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
```

### Step 2: Create Advanced API Documentation System

**Purpose**: Enhance the basic documentation system with advanced features like versioning, interactive examples, and automated documentation updates.

**Implementation**:

1. **Install additional documentation dependencies**
```bash
npm install @nestjs/swagger swagger-ui-express
npm install redoc express-static
```

2. **Create enhanced documentation service**
```typescript
// apps/api-generator/src/documentation/enhanced-documentation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APIDocumentation } from './interfaces/api-documentation.interface';
import { redoc } from 'redoc-express';

@Injectable()
export class EnhancedDocumentationService {
  private readonly logger = new Logger(EnhancedDocumentationService.name);
  private readonly documentationVersions = new Map<string, any>();

  constructor() {}

  // Generate comprehensive API documentation
  generateDocumentation(app: any, config: APIDocumentation.Config): void {
    // Swagger configuration
    const swaggerConfig = new DocumentBuilder()
      .setTitle(config.title)
      .setDescription(config.description)
      .setVersion(config.version)
      .setContact(config.contact.name, config.contact.url, config.contact.email)
      .setLicense(config.license.name, config.license.url)
      .addServer(config.server.url, config.server.description)
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'ApiKey')
      .addTag('api-generation', 'API generation endpoints')
      .addTag('documentation', 'Documentation endpoints')
      .addTag('health', 'Health check endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    
    // Store version
    this.documentationVersions.set(config.version, document);
    
    // Setup Swagger UI
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: `${config.title} - API Documentation`,
      customCss: this.getCustomCSS(),
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        docExpansion: 'none',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
      },
    });

    // Setup ReDoc for alternative documentation
    app.use('/api/redoc', redoc({
      title: config.title,
      spec: document,
      redocOptions: {
        theme: {
          colors: {
            primary: {
              main: '#3f51b5',
            },
          },
        },
      },
    }));

    this.logger.log(`Documentation generated for version ${config.version}`);
  }

  // Generate API documentation for generated APIs
  generateAPIDocumentation(apiSpec: any): any {
    return {
      openapi: '3.0.3',
      info: {
        title: apiSpec.name,
        version: apiSpec.version,
        description: apiSpec.description,
        contact: {
          name: 'API Support',
          email: 'support@example.com',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
        {
          url: 'https://api.example.com',
          description: 'Production server',
        },
      ],
      paths: this.generatePaths(apiSpec),
      components: {
        schemas: this.generateSchemas(apiSpec),
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: this.generateTags(apiSpec),
    };
  }

  // Generate code examples for different languages
  generateCodeExamples(endpoint: string, method: string, schema: any): any {
    const examples = {
      curl: this.generateCurlExample(endpoint, method, schema),
      javascript: this.generateJavaScriptExample(endpoint, method, schema),
      python: this.generatePythonExample(endpoint, method, schema),
      typescript: this.generateTypeScriptExample(endpoint, method, schema),
    };

    return examples;
  }

  // Generate interactive examples
  generateInteractiveExamples(apiSpec: any): any {
    const examples: any = {};

    apiSpec.entities.forEach((entity: string) => {
      examples[entity.toLowerCase()] = {
        create: {
          description: `Create a new ${entity}`,
          example: this.generateExampleData(entity),
          request: {
            method: 'POST',
            url: `/${entity.toLowerCase()}`,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer YOUR_TOKEN',
            },
            body: this.generateExampleData(entity),
          },
          response: {
            status: 201,
            body: this.generateExampleResponse(entity),
          },
        },
        read: {
          description: `Get ${entity} by ID`,
          request: {
            method: 'GET',
            url: `/${entity.toLowerCase()}/123`,
            headers: {
              'Authorization': 'Bearer YOUR_TOKEN',
            },
          },
          response: {
            status: 200,
            body: this.generateExampleResponse(entity),
          },
        },
        update: {
          description: `Update ${entity}`,
          request: {
            method: 'PUT',
            url: `/${entity.toLowerCase()}/123`,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer YOUR_TOKEN',
            },
            body: this.generateExampleData(entity),
          },
          response: {
            status: 200,
            body: this.generateExampleResponse(entity),
          },
        },
        delete: {
          description: `Delete ${entity}`,
          request: {
            method: 'DELETE',
            url: `/${entity.toLowerCase()}/123`,
            headers: {
              'Authorization': 'Bearer YOUR_TOKEN',
            },
          },
          response: {
            status: 200,
            body: { message: `${entity} deleted successfully` },
          },
        },
      };
    });

    return examples;
  }

  private generatePaths(apiSpec: any): any {
    const paths: any = {};

    apiSpec.entities.forEach((entity: string) => {
      const entityName = entity.toLowerCase();
      paths[`/${entityName}`] = {
        get: {
          summary: `Get all ${entityName}`,
          description: `Retrieve a list of all ${entityName} with optional filtering and pagination`,
          tags: [entityName],
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              required: false,
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Number of items per page',
              required: false,
              schema: { type: 'integer', default: 10 },
            },
            {
              name: 'sort',
              in: 'query',
              description: 'Sort field',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'order',
              in: 'query',
              description: 'Sort order',
              required: false,
              schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
            },
          ],
          responses: {
            200: {
              description: `List of ${entityName}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: `#/components/schemas/${entity}` },
                      },
                      pagination: {
                        $ref: '#/components/schemas/Pagination',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `Create ${entityName}`,
          description: `Create a new ${entityName}`,
          tags: [entityName],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/Create${entity}Dto` },
              },
            },
          },
          responses: {
            201: {
              description: `${entityName} created successfully`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${entity}` },
                },
              },
            },
            400: {
              description: 'Bad request',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      };

      paths[`/${entityName}/{id}`] = {
        get: {
          summary: `Get ${entityName} by ID`,
          description: `Retrieve a specific ${entityName} by its ID`,
          tags: [entityName],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: `${entityName} ID`,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: `${entityName} details`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${entity}` },
                },
              },
            },
            404: {
              description: `${entityName} not found`,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        put: {
          summary: `Update ${entityName}`,
          description: `Update a specific ${entityName}`,
          tags: [entityName],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: `${entityName} ID`,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/Update${entity}Dto` },
              },
            },
          },
          responses: {
            200: {
              description: `${entityName} updated successfully`,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${entity}` },
                },
              },
            },
            404: {
              description: `${entityName} not found`,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        delete: {
          summary: `Delete ${entityName}`,
          description: `Delete a specific ${entityName}`,
          tags: [entityName],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: `${entityName} ID`,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: {
              description: `${entityName} deleted successfully`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            404: {
              description: `${entityName} not found`,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      };
    });

    return paths;
  }

  private generateSchemas(apiSpec: any): any {
    const schemas: any = {
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 10 },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Error message' },
          statusCode: { type: 'integer', example: 400 },
          timestamp: { type: 'string', format: 'date-time' },
          path: { type: 'string', example: '/api/v1/users' },
        },
      },
    };

    apiSpec.entities.forEach((entity: string) => {
      schemas[entity] = {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      };

      schemas[`Create${entity}Dto`] = {
        type: 'object',
        properties: {
          // Add entity-specific properties based on schema
        },
      };

      schemas[`Update${entity}Dto`] = {
        type: 'object',
        properties: {
          // Add entity-specific properties based on schema
        },
      };
    });

    return schemas;
  }

  private generateTags(apiSpec: any): any {
    return apiSpec.entities.map((entity: string) => ({
      name: entity.toLowerCase(),
      description: `Operations related to ${entity} management`,
    }));
  }

  private generateCurlExample(endpoint: string, method: string, schema: any): string {
    return `curl -X ${method} \\
  http://localhost:3000${endpoint} \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '${JSON.stringify(schema.example || {}, null, 2)}'`;
  }

  private generateJavaScriptExample(endpoint: string, method: string, schema: any): string {
    return `const response = await fetch('${endpoint}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN',
  },
  body: JSON.stringify(${JSON.stringify(schema.example || {}, null, 2)}),
});

const data = await response.json();
console.log(data);`;
  }

  private generatePythonExample(endpoint: string, method: string, schema: any): string {
    return `import requests

response = requests.${method.toLowerCase()}(
    'http://localhost:3000${endpoint}',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN',
    },
    json=${JSON.stringify(schema.example || {}, null, 2)}
)

data = response.json()
print(data)`;
  }

  private generateTypeScriptExample(endpoint: string, method: string, schema: any): string {
    return `interface Response {
  // Define response interface
}

const response = await fetch('${endpoint}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN',
  },
  body: JSON.stringify(${JSON.stringify(schema.example || {}, null, 2)}),
});

const data: Response = await response.json();
console.log(data);`;
  }

  private generateExampleData(entity: string): any {
    // Generate example data based on entity type
    return {
      name: `Example ${entity}`,
      description: `This is an example ${entity}`,
    };
  }

  private generateExampleResponse(entity: string): any {
    return {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ...this.generateExampleData(entity),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private getCustomCSS(): string {
    return `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .scheme-container { margin: 20px 0 }
      .swagger-ui .opblock.opblock-post { border-color: #49cc90; }
      .swagger-ui .opblock.opblock-get { border-color: #61affe; }
      .swagger-ui .opblock.opblock-put { border-color: #fca130; }
      .swagger-ui .opblock.opblock-delete { border-color: #f93e3e; }
    `;
  }
}
```

### Step 3: Setup Rate Limiting and Request Logging

**Purpose**: Protect the API from abuse and capture comprehensive request metrics for monitoring and debugging.

**Implementation**:

1. **Install rate limiting and logging dependencies**
```bash
npm install @nestjs/throttler @nestjs/config
npm install redis ioredis
npm install winston winston-daily-rotate-file
npm install @types/winston --save-dev
```

2. **Create Redis service for rate limiting**
```typescript
// apps/api-generator/src/redis/redis.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.ping();
      console.log('✅ Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  // Rate limiting methods
  async isRateLimited(key: string, limit: number, window: number): Promise<boolean> {
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    return current > limit;
  }

  async getRateLimitInfo(key: string): Promise<{ count: number; ttl: number }> {
    const count = await this.redis.get(key);
    const ttl = await this.redis.ttl(key);
    
    return {
      count: parseInt(count || '0', 10),
      ttl: ttl > 0 ? ttl : 0,
    };
  }

  // Generic Redis methods
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', latency: Date.now() - start };
    }
  }
}
```

3. **Create enhanced rate limiting guard**
```typescript
// apps/api-generator/src/common/guards/rate-limit.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimit = this.reflector.get(RATE_LIMIT_KEY, context.getHandler()) || {
      limit: 100,
      window: 60,
    };

    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(request, rateLimit);

    const isLimited = await this.redisService.isRateLimited(
      key,
      rateLimit.limit,
      rateLimit.window,
    );

    if (isLimited) {
      const info = await this.redisService.getRateLimitInfo(key);
      throw new HttpException({
        success: false,
        message: 'Rate limit exceeded',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        retryAfter: info.ttl,
        limit: rateLimit.limit,
        window: rateLimit.window,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Add rate limit headers
    const info = await this.redisService.getRateLimitInfo(key);
    request.res.set({
      'X-RateLimit-Limit': rateLimit.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, rateLimit.limit - info.count).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + info.ttl * 1000).toISOString(),
    });

    return true;
  }

  private generateKey(request: any, rateLimit: any): string {
    const ip = request.ip || request.connection.remoteAddress;
    const endpoint = request.route?.path || request.path;
    const method = request.method;
    
    // Use different key strategies based on configuration
    if (rateLimit.keyBy === 'ip') {
      return `rate_limit:${ip}:${method}:${endpoint}`;
    } else if (rateLimit.keyBy === 'user') {
      const userId = request.user?.id || 'anonymous';
      return `rate_limit:${userId}:${method}:${endpoint}`;
    } else {
      return `rate_limit:${ip}:${method}:${endpoint}`;
    }
  }
}
```

4. **Create rate limiting decorator**
```typescript
// apps/api-generator/src/common/decorators/rate-limit.decorator.ts
import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  window: number; // in seconds
  keyBy?: 'ip' | 'user';
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const RATE_LIMIT_KEY = 'rate_limit';

export const RateLimit = (options: RateLimitOptions) => 
  SetMetadata(RATE_LIMIT_KEY, options);
```

5. **Create advanced logging service**
```typescript
// apps/api-generator/src/logging/advanced-logging.service.ts
import { Injectable, NestMiddleware, LoggerService } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class AdvancedLoggingService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'api-generator' },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),

        // File transport for all logs
        new winston.transports.DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),

        // Error file transport
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
        }),

        // Request file transport
        new winston.transports.DailyRotateFile({
          filename: 'logs/requests-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'http',
          zippedArchive: true,
          maxSize: '50m',
          maxFiles: '7d',
        }),
      ],
    });
  }

  // Standard logger methods
  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }

  // Request logging middleware
  requestLogger() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      const { method, originalUrl, ip, headers } = req;
      const userAgent = headers['user-agent'] || '';
      const contentLength = headers['content-length'] || '0';

      // Log incoming request
      this.logger.http('Incoming Request', {
        method,
        url: originalUrl,
        ip,
        userAgent,
        contentLength,
        timestamp: new Date().toISOString(),
      });

      // Capture response
      const originalSend = res.send;
      res.send = function (body) {
        res.body = body;
        return originalSend.call(this, body);
      };

      // Log response
      res.on('finish', () => {
        const { statusCode } = res;
        const responseTime = Date.now() - startTime;
        const responseSize = res.get('content-length') || '0';

        this.logger.http('Outgoing Response', {
          method,
          url: originalUrl,
          statusCode,
          responseTime,
          responseSize,
          ip,
          userAgent,
          timestamp: new Date().toISOString(),
        });

        // Log slow requests
        if (responseTime > 1000) {
          this.logger.warn('Slow Request Detected', {
            method,
            url: originalUrl,
            responseTime,
            statusCode,
          });
        }

        // Log errors
        if (statusCode >= 400) {
          this.logger.error('Request Error', res.body, 'RequestLogger', {
            method,
            url: originalUrl,
            statusCode,
            responseTime,
          });
        }
      }.bind(this);

      next();
    };
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: any): void {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    
    this.logger[level]('Performance Metric', {
      operation,
      duration,
      ...metadata,
    });
  }

  // Business metrics logging
  logBusinessMetric(event: string, data: any): void {
    this.logger.info('Business Metric', {
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Security logging
  logSecurityEvent(event: string, details: any): void {
    this.logger.warn('Security Event', {
      event,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // API generation specific logging
  logAPIGeneration(jobId: string, step: string, progress: number): void {
    this.logger.info('API Generation Progress', {
      jobId,
      step,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  logAPIGenerationError(jobId: string, error: Error, context?: any): void {
    this.logger.error('API Generation Error', error.stack, 'APIGeneration', {
      jobId,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  logAPIGenerationSuccess(jobId: string, result: any): void {
    this.logger.info('API Generation Success', {
      jobId,
      result,
      timestamp: new Date().toISOString(),
    });
  }
}
```

6. **Apply rate limiting and logging to controllers**
```typescript
// apps/api-generator/src/core/core.controller.ts
import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CoreService } from './core.service';
import { GenerateApiRequest } from './dto/generate-api.request';
import { GenerateApiResponse } from './dto/generate-api.response';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@ApiTags('Core API')
@Controller('api/v1')
@UseGuards(RateLimitGuard)
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @RateLimit({ limit: 1000, window: 60 }) // High limit for health checks
  getHealth(): { status: string; timestamp: string } {
    return this.coreService.getHealth();
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate API from specifications' })
  @ApiResponse({ status: 200, description: 'API generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @RateLimit({ limit: 10, window: 60 }) // Strict limit for generation
  async generateApi(@Body() request: GenerateApiRequest): Promise<GenerateApiResponse> {
    return this.coreService.generateApi(request);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get available API templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  @RateLimit({ limit: 100, window: 60 })
  getTemplates(): { templates: string[] } {
    return this.coreService.getAvailableTemplates();
  }
}
```

## 🔗 Integration Points

### **With Person 1 (Team Lead)**
- **Real-time Updates**: WebSocket progress reporting to orchestrator
- **Security Integration**: Rate limiting patterns align with security requirements
- **Monitoring Integration**: Logging format compatible with monitoring systems

### **With Person 2 (AI/ML Engineer)**
- **Progress Tracking**: Real-time updates for AI model processing
- **Performance Metrics**: Logging for AI model performance
- **Resource Management**: Rate limiting for AI API calls

### **With Person 4 (DevOps)**
- **Infrastructure Monitoring**: Redis health checks and metrics
- **Log Aggregation**: Structured logging for centralized systems
- **Performance Monitoring**: Request metrics and performance data

## ✅ Verification Checklist

### **WebSocket Implementation**
- [ ] WebSocket gateway accepting connections
- [ ] Real-time progress updates working
- [ ] Room-based communication functional
- [ ] Connection management working
- [ ] Error handling for disconnections

### **Documentation System**
- [ ] Enhanced Swagger UI with custom styling
- [ ] ReDoc alternative documentation
- [ ] Code examples in multiple languages
- [ ] Interactive examples working
- [ ] Version management functional

### **Rate Limiting**
- [ ] Redis connection established
- [ ] Rate limiting guard working
- [ ] Custom rate limits per endpoint
- [ ] Rate limit headers in responses
- [ ] Proper error responses for exceeded limits

### **Request Logging**
- [ ] Winston logger configured
- [ ] Request/response logging working
- [ ] Log rotation configured
- [ ] Performance metrics captured
- [ ] Error logging functional

## 📊 Deliverables

### **Files Created**
```
apps/api-generator/src/
├── websocket/
│   ├── api-generation.gateway.ts
│   ├── websocket.service.ts
│   └── websocket.module.ts
├── documentation/
│   ├── enhanced-documentation.service.ts
│   └── interfaces/
│       └── api-documentation.interface.ts
├── redis/
│   └── redis.service.ts
├── common/
│   ├── guards/
│   │   └── rate-limit.guard.ts
│   └── decorators/
│       └── rate-limit.decorator.ts
└── logging/
    └── advanced-logging.service.ts
```

### **Configuration Updates**
- Redis connection configuration
- Winston logging configuration
- Rate limiting settings
- WebSocket CORS configuration

### **Documentation**
- WebSocket API documentation
- Rate limiting configuration guide
- Logging configuration guide
- Performance monitoring setup

---

**🎯 This enhanced framework provides the robust foundation needed for production-ready API generation with real-time communication, comprehensive documentation, and essential security features.**