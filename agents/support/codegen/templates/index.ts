/**
 * CodeGen Agent Templates
 * Code generation templates for various project components
 */

// ============================================
// TYPESCRIPT PROJECT TEMPLATE
// ============================================

export const TYPESCRIPT_PROJECT_TEMPLATE = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`;

// ============================================
// EXPRESS API TEMPLATE
// ============================================

export const EXPRESS_API_TEMPLATE = `/**
 * Express Application Configuration
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    });
});

export default app;
`;

// ============================================
// CONTROLLER TEMPLATE
// ============================================

export const CONTROLLER_TEMPLATE = `/**
 * Example Controller
 * Handles HTTP requests for resources
 */

import { Request, Response, NextFunction } from 'express';

export class ExampleController {
    async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            res.json({ success: true, data: [] });
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            res.json({ success: true, data: { id } });
        } catch (error) {
            next(error);
        }
    }

    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const data = req.body;
            res.status(201).json({ success: true, data });
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const data = req.body;
            res.json({ success: true, data: { id, ...data } });
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}
`;

// ============================================
// SERVICE TEMPLATE
// ============================================

export const SERVICE_TEMPLATE = `/**
 * Example Service
 * Business logic layer
 */

export interface ExampleEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export class ExampleService {
    async findAll(): Promise<ExampleEntity[]> {
        return [];
    }

    async findById(id: string): Promise<ExampleEntity | null> {
        return null;
    }

    async create(data: Partial<ExampleEntity>): Promise<ExampleEntity> {
        const now = new Date();
        return {
            id: this.generateId(),
            ...data,
            createdAt: now,
            updatedAt: now,
        } as ExampleEntity;
    }

    async update(id: string, data: Partial<ExampleEntity>): Promise<ExampleEntity | null> {
        return null;
    }

    async delete(id: string): Promise<void> {
        // Delete implementation
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
`;

// ============================================
// REPOSITORY TEMPLATE
// ============================================

export const REPOSITORY_TEMPLATE = `/**
 * Example Repository
 * Data access layer
 */

export interface ExampleEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export class ExampleRepository {
    private items: Map<string, ExampleEntity> = new Map();

    async findAll(): Promise<ExampleEntity[]> {
        return Array.from(this.items.values());
    }

    async findById(id: string): Promise<ExampleEntity | null> {
        return this.items.get(id) || null;
    }

    async create(data: Partial<ExampleEntity>): Promise<ExampleEntity> {
        const id = this.generateId();
        const now = new Date();
        
        const item: ExampleEntity = {
            id,
            ...data,
            createdAt: now,
            updatedAt: now,
        } as ExampleEntity;
        
        this.items.set(id, item);
        return item;
    }

    async update(id: string, data: Partial<ExampleEntity>): Promise<ExampleEntity | null> {
        const existing = this.items.get(id);
        if (!existing) return null;
        
        const updated = { ...existing, ...data, updatedAt: new Date() };
        this.items.set(id, updated);
        return updated;
    }

    async delete(id: string): Promise<void> {
        this.items.delete(id);
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
`;

// ============================================
// DTO TEMPLATE
// ============================================

export const DTO_TEMPLATE = `/**
 * Example DTOs
 * Data transfer objects with validation
 */

import { z } from 'zod';

export const CreateExampleSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
});

export type CreateExampleDto = z.infer<typeof CreateExampleSchema>;

export const UpdateExampleSchema = CreateExampleSchema.partial();

export type UpdateExampleDto = z.infer<typeof UpdateExampleSchema>;
`;

// ============================================
// MIDDLEWARE TEMPLATE
// ============================================

export const MIDDLEWARE_TEMPLATE = `/**
 * Example Middleware
 * Custom middleware for request processing
 */

import { Request, Response, NextFunction } from 'express';

export const exampleMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    // Add custom logic here
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.path}\`);
    next();
};

export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const validateBody = <T>(schema: { parse: (data: unknown) => T }) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            next(error);
        }
    };
};
`;

// ============================================
// CONFIG TEMPLATE
// ============================================

export const CONFIG_TEMPLATE = `/**
 * Application Configuration
 */

import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    
    database: {
        url: process.env.DATABASE_URL || '',
    },
    
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    
    jwt: {
        secret: process.env.JWT_SECRET || 'change-me-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
};
`;

// ============================================
// DOCKERFILE TEMPLATE
// ============================================

export const DOCKERFILE_TEMPLATE = `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --only=production

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
`;

// ============================================
// HELPER FUNCTIONS
// ============================================

export interface CodegenTemplate {
    name: string;
    description: string;
    template: string;
}

export function getCodegenTemplates(): Record<string, CodegenTemplate> {
    return {
        'tsconfig': {
            name: 'TypeScript Configuration',
            description: 'Standard TypeScript project configuration',
            template: TYPESCRIPT_PROJECT_TEMPLATE,
        },
        'express-app': {
            name: 'Express Application',
            description: 'Express.js application setup with middleware',
            template: EXPRESS_API_TEMPLATE,
        },
        'controller': {
            name: 'Controller',
            description: 'REST API controller with CRUD operations',
            template: CONTROLLER_TEMPLATE,
        },
        'service': {
            name: 'Service',
            description: 'Business logic service layer',
            template: SERVICE_TEMPLATE,
        },
        'repository': {
            name: 'Repository',
            description: 'Data access layer with in-memory storage',
            template: REPOSITORY_TEMPLATE,
        },
        'dto': {
            name: 'DTOs',
            description: 'Data transfer objects with Zod validation',
            template: DTO_TEMPLATE,
        },
        'middleware': {
            name: 'Middleware',
            description: 'Express middleware utilities',
            template: MIDDLEWARE_TEMPLATE,
        },
        'config': {
            name: 'Configuration',
            description: 'Application configuration from environment',
            template: CONFIG_TEMPLATE,
        },
        'dockerfile': {
            name: 'Dockerfile',
            description: 'Multi-stage Docker build configuration',
            template: DOCKERFILE_TEMPLATE,
        },
    };
}

export function getAvailableTemplateTypes(): string[] {
    return Object.keys(getCodegenTemplates());
}
