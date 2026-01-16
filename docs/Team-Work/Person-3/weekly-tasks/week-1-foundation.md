# Week 1: Foundation Setup

## 🎯 Objectives

Establish the development environment and create the basic API structure that will serve as the foundation for all subsequent development. This week focuses on setting up the NestJS framework, creating basic API endpoints, and implementing essential documentation and error handling.

### **Success Criteria**
- ✅ Development environment running locally with all dependencies
- ✅ Basic API endpoints responding correctly with proper structure
- ✅ OpenAPI/Swagger documentation accessible and functional
- ✅ Error handling working consistently across all endpoints
- ✅ Project structure following best practices

## 📋 Prerequisites

### **Required Software**
- Node.js (v20+) with npm
- Git with configured SSH keys
- VS Code with recommended extensions
- Docker Desktop (for later weeks)
- PostgreSQL and Redis (for testing)

### **Team Dependencies**
- **Person 1**: Orchestrator base structure should be initialized
- **Person 2**: AI model integration should be available for testing
- **Person 4**: Development environment setup should be complete

### **Knowledge Requirements**
- Basic understanding of TypeScript
- Familiarity with REST API concepts
- Knowledge of Node.js and npm
- Understanding of Git workflows

## 🔄 Step-by-Step Implementation

### Step 1: Initialize NestJS Monorepo Structure

**Purpose**: Create the foundation for our API generation system using NestJS's modular architecture.

**Implementation**:

1. **Create the main project structure**
```bash
# Create the main project directory
mkdir loveable-backend
cd loveable-backend

# Initialize NestJS CLI (if not already installed)
npm install -g @nestjs/cli

# Create a new NestJS project with monorepo support
nest new api-platform --package-manager npm
cd api-platform

# Generate workspace structure
nest generate app api-generator
nest generate app cli-tool
nest generate lib shared
```

2. **Configure TypeScript and workspace settings**
```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@shared/*": ["libs/shared/src/*"],
      "@api-generator/*": ["apps/api-generator/src/*"],
      "@cli-tool/*": ["apps/cli-tool/src/*"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

3. **Update package.json with workspaces**
```json
{
  "name": "loveable-backend",
  "version": "0.0.1",
  "description": "Backend automation platform",
  "private": true,
  "workspaces": [
    "apps/*",
    "libs/*"
  ],
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"apps/**/*.ts\" \"libs/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./apps/api-generator/test/jest-e2e.json"
  }
}
```

### Step 2: Setup Basic API Structure

**Purpose**: Create the fundamental API structure with controllers, services, and modules that will be the foundation for our API generation capabilities.

**Implementation**:

1. **Create core modules**
```bash
# Generate core modules
nest generate module core
nest generate controller core
nest generate service core

# Generate API generation modules
nest generate module api-generation
nest generate controller api-generation
nest generate service api-generation

# Generate documentation modules
nest generate module documentation
nest generate controller documentation
nest generate service documentation
```

2. **Create the main API controller**
```typescript
// apps/api-generator/src/core/core.controller.ts
import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CoreService } from './core.service';
import { GenerateApiRequest } from './dto/generate-api.request';
import { GenerateApiResponse } from './dto/generate-api.response';

@ApiTags('Core API')
@Controller('api/v1')
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth(): { status: string; timestamp: string } {
    return this.coreService.getHealth();
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate API from specifications' })
  @ApiResponse({ status: 200, description: 'API generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async generateApi(@Body() request: GenerateApiRequest): Promise<GenerateApiResponse> {
    return this.coreService.generateApi(request);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get available API templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  getTemplates(): { templates: string[] } {
    return this.coreService.getAvailableTemplates();
  }
}
```

3. **Create the core service**
```typescript
// apps/api-generator/src/core/core.service.ts
import { Injectable } from '@nestjs/common';
import { GenerateApiRequest } from './dto/generate-api.request';
import { GenerateApiResponse } from './dto/generate-api.response';

@Injectable()
export class CoreService {
  constructor() {}

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  async generateApi(request: GenerateApiRequest): Promise<GenerateApiResponse> {
    // Placeholder for API generation logic
    return {
      success: true,
      message: 'API generation initiated',
      jobId: `job_${Date.now()}`,
      estimatedTime: '30 seconds',
    };
  }

  getAvailableTemplates(): { templates: string[] } {
    return {
      templates: [
        'rest-crud',
        'graphql-api',
        'trpc-endpoints',
        'microservice',
        'serverless',
      ],
    };
  }
}
```

4. **Create DTOs for type safety**
```typescript
// apps/api-generator/src/core/dto/generate-api.request.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsEnum } from 'class-validator';

export enum ApiType {
  REST = 'rest',
  GRAPHQL = 'graphql',
  TRPC = 'trpc',
}

export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  MONGODB = 'mongodb',
  MYSQL = 'mysql',
}

export class GenerateApiRequest {
  @ApiProperty({ description: 'Name of the API to generate' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the API', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ApiType, description: 'Type of API to generate' })
  @IsEnum(ApiType)
  type: ApiType;

  @ApiProperty({ enum: DatabaseType, description: 'Database type', required: false })
  @IsOptional()
  @IsEnum(DatabaseType)
  database?: DatabaseType;

  @ApiProperty({ 
    description: 'Array of entities/models to generate',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  entities: string[];

  @ApiProperty({ 
    description: 'Authentication methods to include',
    enum: ['jwt', 'oauth', 'basic'],
    isArray: true,
    required: false
  })
  @IsOptional()
  @IsArray()
  authentication?: string[];

  @ApiProperty({ 
    description: 'Additional features to include',
    enum: ['validation', 'pagination', 'sorting', 'filtering'],
    isArray: true,
    required: false
  })
  @IsOptional()
  @IsArray()
  features?: string[];
}
```

```typescript
// apps/api-generator/src/core/dto/generate-api.response.ts
import { ApiProperty } from '@nestjs/swagger';

export class GenerateApiResponse {
  @ApiProperty({ description: 'Whether the generation was successful' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Job ID for tracking progress' })
  jobId: string;

  @ApiProperty({ description: 'Estimated completion time' })
  estimatedTime: string;

  @ApiProperty({ description: 'Generated files (if available)', required: false })
  files?: string[];
}
```

### Step 3: Setup OpenAPI/Swagger Documentation

**Purpose**: Implement comprehensive API documentation that will automatically update as we add new endpoints and features.

**Implementation**:

1. **Install Swagger dependencies**
```bash
npm install @nestjs/swagger swagger-ui-express
```

2. **Configure Swagger in main.ts**
```typescript
// apps/api-generator/src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Loveable Backend API')
    .setDescription('Automated backend API generation platform')
    .setVersion('1.0')
    .addTag('api-generation')
    .addTag('core')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Loveable Backend API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    customfavIcon: '/favicon.ico',
  });

  // Enable CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 API Generator running on port ${port}`);
  console.log(`📚 Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
```

3. **Create documentation service**
```typescript
// apps/api-generator/src/documentation/documentation.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class DocumentationService {
  constructor() {}

  generateOpenAPISpec(apiConfig: any): any {
    return {
      openapi: '3.0.0',
      info: {
        title: apiConfig.name,
        version: '1.0.0',
        description: apiConfig.description,
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      paths: this.generatePaths(apiConfig),
      components: {
        schemas: this.generateSchemas(apiConfig),
      },
    };
  }

  private generatePaths(apiConfig: any): any {
    // Generate OpenAPI paths based on entities
    const paths: any = {};
    
    apiConfig.entities.forEach((entity: string) => {
      const entityName = entity.toLowerCase();
      paths[`/${entityName}`] = {
        get: {
          summary: `Get all ${entityName}`,
          tags: [entityName],
          responses: {
            200: {
              description: `List of ${entityName}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: `#/components/schemas/${entity}` },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `Create ${entityName}`,
          tags: [entityName],
          requestBody: {
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
          },
        },
      };
      
      paths[`/${entityName}/{id}`] = {
        get: {
          summary: `Get ${entityName} by ID`,
          tags: [entityName],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
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
          },
        },
        put: {
          summary: `Update ${entityName}`,
          tags: [entityName],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
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
          },
        },
        delete: {
          summary: `Delete ${entityName}`,
          tags: [entityName],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: `${entityName} deleted successfully`,
            },
          },
        },
      };
    });

    return paths;
  }

  private generateSchemas(apiConfig: any): any {
    const schemas: any = {};
    
    apiConfig.entities.forEach((entity: string) => {
      schemas[entity] = {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      };
      
      schemas[`Create${entity}Dto`] = {
        type: 'object',
        properties: {
          // Add entity-specific properties
        },
      };
      
      schemas[`Update${entity}Dto`] = {
        type: 'object',
        properties: {
          // Add entity-specific properties
        },
      };
    });

    return schemas;
  }
}
```

### Step 4: Implement Error Handling and Middleware

**Purpose**: Create robust error handling and middleware that will provide consistent responses and proper error tracking.

**Implementation**:

1. **Create custom exception filter**
```typescript
// apps/api-generator/src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;
    let details: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        details = (exceptionResponse as any).details;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      details = null;
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      details,
      ...(process.env.NODE_ENV === 'development' && { stack: exception instanceof Error ? exception.stack : null }),
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json(errorResponse);
  }
}
```

2. **Create response interceptor**
```typescript
// apps/api-generator/src/common/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
```

3. **Create logging middleware**
```typescript
// apps/api-generator/src/common/middleware/logging.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(
      `Incoming Request: ${method} ${originalUrl} - ${ip} - ${userAgent}`,
    );

    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
      res.body = body;
      return originalSend.call(this, body);
    };

    // Log response
    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 0;
      const responseTime = Date.now() - startTime;

      this.logger.log(
        `Outgoing Response: ${method} ${originalUrl} - ${statusCode} - ${contentLength} bytes - ${responseTime}ms`,
      );
    });

    next();
  }
}
```

4. **Apply middleware and filters in app module**
```typescript
// apps/api-generator/src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { CoreModule } from './core/core.module';
import { DocumentationModule } from './documentation/documentation.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingMiddleware } from './common/middleware/logging.middleware';

@Module({
  imports: [
    CoreModule,
    DocumentationModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes('*');
  }
}
```

## 🔗 Integration Points

### **With Person 1 (Team Lead)**
- **Orchestrator Communication**: API endpoints will be consumed by the main orchestrator
- **Security Integration**: Error handling patterns should align with security requirements
- **Monitoring Integration**: Logging should be compatible with monitoring systems

### **With Person 2 (AI/ML Engineer)**
- **AI Model Integration**: API structure should be ready for AI-generated code consumption
- **Database Integration**: Error handling should account for database connection issues
- **Test Integration**: API structure should support automated testing

### **With Person 4 (DevOps)**
- **Deployment Configuration**: Project structure should be containerizable
- **Environment Setup**: Configuration should support multiple environments
- **Monitoring Integration**: Logging should be compatible with DevOps monitoring tools

## ✅ Verification Checklist

### **Development Environment**
- [ ] Node.js v20+ installed
- [ ] NestJS CLI installed globally
- [ ] Project created successfully
- [ ] Dependencies installed without errors
- [ ] TypeScript compilation working

### **API Functionality**
- [ ] Health endpoint responding correctly
- [ ] Generate endpoint accepting requests
- [ ] Templates endpoint returning data
- [ ] Error responses properly formatted
- [ ] Validation working for DTOs

### **Documentation**
- [ ] Swagger UI accessible at `/api/docs`
- [ ] All endpoints documented
- [ ] Request/response schemas defined
- [ ] Authentication methods documented
- [ ] Example requests working

### **Error Handling**
- [ ] Validation errors caught and formatted
- [ ] 404 errors handled gracefully
- [ ] 500 errors logged properly
- [ ] Response format consistent
- [ ] Development stack traces available

## 📊 Deliverables

### **Files Created**
```
apps/api-generator/src/
├── main.ts                           # Application bootstrap
├── app.module.ts                     # Root module configuration
├── core/
│   ├── core.module.ts
│   ├── core.controller.ts
│   ├── core.service.ts
│   └── dto/
│       ├── generate-api.request.ts
│       └── generate-api.response.ts
├── documentation/
│   ├── documentation.module.ts
│   ├── documentation.controller.ts
│   └── documentation.service.ts
└── common/
    ├── filters/
    │   └── http-exception.filter.ts
    ├── interceptors/
    │   └── response.interceptor.ts
    └── middleware/
        └── logging.middleware.ts
```

### **Configuration Files**
- `package.json` - Updated with workspaces and scripts
- `tsconfig.json` - TypeScript configuration with paths
- `.env.example` - Environment variables template
- `nest-cli.json` - NestJS CLI configuration

### **Documentation**
- Complete API documentation in Swagger
- Code comments and JSDoc annotations
- README with setup instructions
- Architecture overview

---

**🎯 This foundation provides the solid base needed for building sophisticated API generation capabilities in the following weeks.**