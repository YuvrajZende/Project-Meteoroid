/**
 * ============================================
 * CODEGEN AGENT - CODE GENERATION & SCAFFOLDING
 * ============================================
 * 
 * The CodegenAgent is responsible for:
 * - Generating boilerplate code and project scaffolding
 * - Code refactoring and optimization
 * - Template-based code generation
 * - File structure generation
 * - Code formatting and style enforcement
 * 
 * Owner: Person 4
 * Tier: 3 (Support Agent)
 * 
 * Supports: Groq, OpenAI, Z.AI (any OpenAI-compatible API)
 */

import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import * as dotenv from "dotenv";
import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus,
    AgentTier,
} from '@loveable/shared';
import {
    TYPESCRIPT_PROJECT_TEMPLATE,
    EXPRESS_API_TEMPLATE,
    CONFIG_TEMPLATE,
    DOCKERFILE_TEMPLATE,
    MIDDLEWARE_TEMPLATE,
} from './templates/index';

dotenv.config();

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface CodegenConfig {
    type: CodegenType;
    name: string;
    language: 'typescript' | 'javascript';
    framework?: 'express' | 'fastify' | 'hono' | 'nestjs';
    features?: CodegenFeature[];
    structure?: 'layered' | 'modular' | 'monolith';
    includeDocker?: boolean;
    includeTests?: boolean;
    projectContext?: ProjectContext;
}

export type CodegenType =
    | 'project'      // Full project scaffolding
    | 'controller'   // API controller
    | 'service'      // Business logic service
    | 'repository'   // Data access layer
    | 'dto'          // Data transfer objects
    | 'middleware'   // Express/HTTP middleware
    | 'module'       // Complete module (controller + service + repo)
    | 'config'       // Configuration files
    | 'docker'       // Docker setup
    | 'refactor';    // Code refactoring

export type CodegenFeature =
    | 'validation'
    | 'error-handling'
    | 'logging'
    | 'caching'
    | 'pagination'
    | 'filtering'
    | 'sorting'
    | 'authentication'
    | 'authorization';

export interface ProjectContext {
    existingFiles?: string[];
    codeStyle?: CodeStyle;
    framework?: string;
    database?: 'prisma' | 'drizzle' | 'typeorm' | 'mongoose';
}

export interface CodeStyle {
    useSemicolons: boolean;
    useTabsOverSpaces: boolean;
    indentSize: number;
    quoteStyle: 'single' | 'double';
}

export interface CodegenGenerationResult {
    files: GeneratedCodeFile[];
    dependencies: string[];
    devDependencies: string[];
    scripts: Record<string, string>;
    instructions: string[];
}

export interface GeneratedCodeFile {
    path: string;
    content: string;
    description: string;
    language: string;
}

// ============================================
// CODEGEN AGENT CLASS
// ============================================

export class CodegenAgent implements IAgent {
    // IAgent required properties
    public readonly id = 'codegen-agent';
    public readonly name = 'Code Generation Agent';
    public readonly tier: AgentTier = 3;
    public readonly capabilities = [
        'code-generation',
        'boilerplate-creation',
        'refactoring',
        'code-optimization',
        'project-scaffolding',
        'module-generation',
        'template-generation',
    ];
    public readonly description = 'Generates production-ready TypeScript code, scaffolding, and boilerplate';
    public readonly version = '1.0.0';

    private model: BaseChatModel;
    private config: CodegenConfig | null = null;
    private isInitialized = false;

    constructor() {
        // Support multiple providers: Groq (primary), OpenAI, or Z.AI
        const groqApiKey = process.env.GROQ_API_KEY;
        const openaiApiKey = process.env.OPENAI_API_KEY;

        if (groqApiKey) {
            // Use Groq (fast inference)
            this.model = new ChatGroq({
                apiKey: groqApiKey,
                model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                temperature: 0.3,
            });
            console.log(`🤖 CodegenAgent using Groq (${process.env.GROQ_MODEL || "llama-3.3-70b-versatile"})`);
        } else if (openaiApiKey) {
            // Use OpenAI or OpenAI-compatible API (Z.AI, etc.)
            this.model = new ChatOpenAI({
                modelName: process.env.MODEL_NAME || "gpt-4",
                openAIApiKey: openaiApiKey,
                configuration: {
                    baseURL: process.env.OPENAI_BASE_URL,
                },
                temperature: 0.3,
            });
            console.log(`🤖 CodegenAgent using OpenAI (${process.env.MODEL_NAME || "gpt-4"})`);
        } else {
            // Default to Groq without key (will fail at runtime if not set)
            this.model = new ChatGroq({
                apiKey: "placeholder-will-fail",
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
            });
            console.warn(`⚠️ CodegenAgent: No API key found. Set GROQ_API_KEY or OPENAI_API_KEY.`);
        }
    }

    // ============================================
    // IAgent INTERFACE METHODS
    // ============================================

    async initialize(_config: AgentConfig): Promise<void> {
        console.log(`🔧 [${this.name}] Initializing...`);
        this.isInitialized = true;
        console.log(`✅ [${this.name}] Initialized`);
    }

    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();

        console.log(`🔧 [${this.name}] Executing task: ${input.task.substring(0, 50)}...`);

        try {
            // Analyze requirements from task
            const config = await this.analyzeRequirements(input.task);

            // Generate code based on config
            const result = await this.generateCode(config);

            const executionTime = Date.now() - startTime;

            return {
                success: true,
                files: result.files.map(f => ({
                    path: f.path,
                    content: f.content,
                    type: 'code' as const,
                    language: f.language,
                })),
                message: `Generated ${result.files.length} files for ${config.type} "${config.name}"`,
                metadata: {
                    executionTime,
                    dependencies: result.dependencies,
                    devDependencies: result.devDependencies,
                    scripts: result.scripts,
                    instructions: result.instructions,
                },
                suggestedNextAgents: this.suggestNextAgents(config),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'CODEGEN_ERROR',
                    message: errorMessage,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                },
            };
        }
    }

    async healthCheck(): Promise<AgentHealthStatus> {
        return {
            healthy: this.isInitialized,
            message: this.isInitialized ? 'Codegen agent is ready' : 'Agent not initialized',
            details: {
                version: this.version,
                capabilities: this.capabilities,
            },
        };
    }

    async shutdown(): Promise<void> {
        console.log(`🔧 [${this.name}] Shutting down...`);
        this.isInitialized = false;
    }

    // ============================================
    // REQUIREMENT ANALYSIS
    // ============================================

    async analyzeRequirements(task: string): Promise<CodegenConfig> {
        console.log(`🔍 [${this.name}] Analyzing requirements...`);

        const systemPrompt = `You are a code generation expert. Analyze the user's request and extract the configuration needed to generate code.

Return a JSON object with these fields:
{
    "type": "project" | "controller" | "service" | "repository" | "dto" | "middleware" | "module" | "config" | "docker" | "refactor",
    "name": "the name of what to generate (e.g., 'User', 'ProductService', 'my-app')",
    "language": "typescript" | "javascript",
    "framework": "express" | "fastify" | "hono" | "nestjs" (optional),
    "features": ["validation", "error-handling", "logging", "caching", "pagination", "filtering", "authentication"] (optional),
    "structure": "layered" | "modular" | "monolith" (optional),
    "includeDocker": true/false (optional),
    "includeTests": true/false (optional)
}

Guidelines:
- "type" should match what the user wants to generate
- For CRUD operations, use "module" which generates controller + service + repository
- "name" should be PascalCase for classes, kebab-case for projects
- Default to TypeScript unless JavaScript is explicitly requested
- Include Docker for project scaffolding`;

        const response = await this.model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(task),
        ]);

        const content = response.content.toString();

        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    type: parsed.type || 'module',
                    name: parsed.name || 'Generated',
                    language: parsed.language || 'typescript',
                    framework: parsed.framework,
                    features: parsed.features || [],
                    structure: parsed.structure || 'layered',
                    includeDocker: parsed.includeDocker ?? false,
                    includeTests: parsed.includeTests ?? false,
                };
            }
        } catch (e) {
            console.warn('Failed to parse LLM response, using defaults');
        }

        // Default config
        return {
            type: 'module',
            name: 'Generated',
            language: 'typescript',
            framework: 'express',
            features: ['validation', 'error-handling'],
            structure: 'layered',
        };
    }

    // ============================================
    // CODE GENERATION
    // ============================================

    async generateCode(config: CodegenConfig): Promise<CodegenGenerationResult> {
        console.log(`⚡ [${this.name}] Generating ${config.type}: ${config.name}`);

        const result: CodegenGenerationResult = {
            files: [],
            dependencies: [],
            devDependencies: [],
            scripts: {},
            instructions: [],
        };

        switch (config.type) {
            case 'project':
                await this.generateProject(config, result);
                break;
            case 'controller':
                await this.generateController(config, result);
                break;
            case 'service':
                await this.generateService(config, result);
                break;
            case 'repository':
                await this.generateRepository(config, result);
                break;
            case 'dto':
                await this.generateDto(config, result);
                break;
            case 'middleware':
                await this.generateMiddleware(config, result);
                break;
            case 'module':
                await this.generateModule(config, result);
                break;
            case 'config':
                await this.generateConfig(config, result);
                break;
            case 'docker':
                await this.generateDocker(config, result);
                break;
            case 'refactor':
                await this.generateRefactor(config, result);
                break;
        }

        return result;
    }

    // ============================================
    // GENERATION METHODS
    // ============================================

    private async generateProject(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        const name = config.name.toLowerCase().replace(/\s+/g, '-');

        // Package.json
        result.files.push({
            path: 'package.json',
            content: this.generatePackageJson(name, config),
            description: 'NPM package configuration',
            language: 'json',
        });

        // TypeScript config
        result.files.push({
            path: 'tsconfig.json',
            content: TYPESCRIPT_PROJECT_TEMPLATE,
            description: 'TypeScript configuration',
            language: 'json',
        });

        // Main entry point
        result.files.push({
            path: 'src/index.ts',
            content: this.generateMainEntry(config),
            description: 'Application entry point',
            language: 'typescript',
        });

        // App setup
        result.files.push({
            path: 'src/app.ts',
            content: EXPRESS_API_TEMPLATE,
            description: 'Express app configuration',
            language: 'typescript',
        });

        // Config
        result.files.push({
            path: 'src/config/index.ts',
            content: CONFIG_TEMPLATE,
            description: 'Application configuration',
            language: 'typescript',
        });

        // Docker files
        if (config.includeDocker) {
            result.files.push({
                path: 'Dockerfile',
                content: DOCKERFILE_TEMPLATE,
                description: 'Docker container configuration',
                language: 'dockerfile',
            });

            result.files.push({
                path: 'docker-compose.yml',
                content: this.generateDockerCompose(name),
                description: 'Docker Compose configuration',
                language: 'yaml',
            });

            result.files.push({
                path: '.dockerignore',
                content: 'node_modules\ndist\n.env\n*.log',
                description: 'Docker ignore file',
                language: 'text',
            });
        }

        // Environment example
        result.files.push({
            path: '.env.example',
            content: this.generateEnvExample(config),
            description: 'Environment variables template',
            language: 'text',
        });

        // Git ignore
        result.files.push({
            path: '.gitignore',
            content: 'node_modules/\ndist/\n.env\n*.log\ncoverage/',
            description: 'Git ignore file',
            language: 'text',
        });

        // Dependencies
        result.dependencies = ['express', 'dotenv', 'cors', 'helmet'];
        result.devDependencies = ['typescript', '@types/node', '@types/express', '@types/cors', 'ts-node', 'nodemon'];

        result.scripts = {
            'dev': 'nodemon --exec ts-node src/index.ts',
            'build': 'tsc',
            'start': 'node dist/index.js',
        };

        result.instructions = [
            `1. cd ${name}`,
            '2. npm install',
            '3. cp .env.example .env',
            '4. npm run dev',
        ];
    }

    private async generateController(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        const name = this.toPascalCase(config.name);
        const fileName = this.toKebabCase(config.name);

        const content = await this.generateWithAI('controller', config);

        result.files.push({
            path: `src/controllers/${fileName}.controller.ts`,
            content: content || this.getControllerTemplate(name, config),
            description: `${name} REST API controller`,
            language: 'typescript',
        });

        result.dependencies = ['express'];
        result.devDependencies = ['@types/express'];
    }

    private async generateService(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        const name = this.toPascalCase(config.name);
        const fileName = this.toKebabCase(config.name);

        const content = await this.generateWithAI('service', config);

        result.files.push({
            path: `src/services/${fileName}.service.ts`,
            content: content || this.getServiceTemplate(name, config),
            description: `${name} business logic service`,
            language: 'typescript',
        });
    }

    private async generateRepository(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        const name = this.toPascalCase(config.name);
        const fileName = this.toKebabCase(config.name);

        const content = await this.generateWithAI('repository', config);

        result.files.push({
            path: `src/repositories/${fileName}.repository.ts`,
            content: content || this.getRepositoryTemplate(name, config),
            description: `${name} data access repository`,
            language: 'typescript',
        });
    }

    private async generateDto(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        const name = this.toPascalCase(config.name);
        const fileName = this.toKebabCase(config.name);

        result.files.push({
            path: `src/dtos/${fileName}.dto.ts`,
            content: this.getDtoTemplate(name),
            description: `${name} data transfer objects`,
            language: 'typescript',
        });

        if (config.features?.includes('validation')) {
            result.dependencies.push('zod');
        }
    }

    private async generateMiddleware(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        const name = this.toPascalCase(config.name);
        const fileName = this.toKebabCase(config.name);

        result.files.push({
            path: `src/middleware/${fileName}.middleware.ts`,
            content: MIDDLEWARE_TEMPLATE.replace(/Example/g, name),
            description: `${name} middleware`,
            language: 'typescript',
        });
    }

    private async generateModule(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        // Generate full module with controller, service, repository, and DTOs
        await this.generateController(config, result);
        await this.generateService(config, result);
        await this.generateRepository(config, result);
        await this.generateDto(config, result);

        const name = this.toPascalCase(config.name);
        const fileName = this.toKebabCase(config.name);

        // Add routes file
        result.files.push({
            path: `src/routes/${fileName}.routes.ts`,
            content: this.getRoutesTemplate(name, fileName),
            description: `${name} route definitions`,
            language: 'typescript',
        });

        // Add index barrel file
        result.files.push({
            path: `src/modules/${fileName}/index.ts`,
            content: this.getModuleIndexTemplate(name, fileName),
            description: `${name} module exports`,
            language: 'typescript',
        });

        result.instructions = [
            `1. Import and use the ${name} routes in your main app`,
            `2. Example: app.use('/api/${fileName}s', ${this.toCamelCase(config.name)}Routes)`,
        ];
    }

    private async generateConfig(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        result.files.push({
            path: 'src/config/index.ts',
            content: CONFIG_TEMPLATE,
            description: 'Application configuration',
            language: 'typescript',
        });

        result.files.push({
            path: 'src/config/database.ts',
            content: this.getDatabaseConfigTemplate(config),
            description: 'Database configuration',
            language: 'typescript',
        });
    }

    private async generateDocker(config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        const name = config.name.toLowerCase().replace(/\s+/g, '-');

        result.files.push({
            path: 'Dockerfile',
            content: DOCKERFILE_TEMPLATE,
            description: 'Docker container configuration',
            language: 'dockerfile',
        });

        result.files.push({
            path: 'docker-compose.yml',
            content: this.generateDockerCompose(name),
            description: 'Docker Compose configuration',
            language: 'yaml',
        });

        result.files.push({
            path: '.dockerignore',
            content: 'node_modules\ndist\n.env\n*.log\n.git',
            description: 'Docker ignore file',
            language: 'text',
        });

        result.instructions = [
            '1. Build the image: docker build -t app .',
            '2. Run with compose: docker-compose up -d',
        ];
    }

    private async generateRefactor(_config: CodegenConfig, result: CodegenGenerationResult): Promise<void> {
        result.instructions = [
            'Refactoring requires existing code context.',
            'Please provide the code you want to refactor in the task description.',
        ];
    }

    // ============================================
    // AI-POWERED GENERATION
    // ============================================

    private async generateWithAI(type: string, config: CodegenConfig): Promise<string | null> {
        const systemPrompt = `You are an expert TypeScript developer. Generate production-ready ${type} code.

Requirements:
- Language: ${config.language}
- Framework: ${config.framework || 'express'}
- Name: ${config.name}
- Features: ${config.features?.join(', ') || 'none'}

Rules:
1. Use TypeScript best practices
2. Include proper error handling
3. Add JSDoc comments
4. Use dependency injection pattern
5. Make code testable
6. Return ONLY the code, no explanations`;

        try {
            const response = await this.model.invoke([
                new SystemMessage(systemPrompt),
                new HumanMessage(`Generate a ${type} for "${config.name}" with CRUD operations`),
            ]);

            const content = response.content.toString();
            return this.extractCode(content);
        } catch (error) {
            console.warn(`AI generation failed, using template for ${type}`);
            return null;
        }
    }

    private extractCode(response: string): string {
        // Extract code from markdown code blocks
        const codeMatch = response.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
        if (codeMatch) {
            return codeMatch[1].trim();
        }
        return response.trim();
    }

    // ============================================
    // TEMPLATE GETTERS
    // ============================================

    private getControllerTemplate(name: string, config: CodegenConfig): string {
        const serviceName = `${name}Service`;
        const serviceVar = this.toCamelCase(serviceName);

        return `/**
 * ${name} Controller
 * Handles HTTP requests for ${name} resources
 */

import { Request, Response, NextFunction } from 'express';
import { ${serviceName} } from '../services/${this.toKebabCase(name)}.service';

export class ${name}Controller {
    constructor(private readonly ${serviceVar}: ${serviceName}) {}

    /**
     * Get all ${name.toLowerCase()}s
     */
    async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const items = await this.${serviceVar}.findAll();
            res.json({ success: true, data: items });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get ${name.toLowerCase()} by ID
     */
    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const item = await this.${serviceVar}.findById(id);
            
            if (!item) {
                res.status(404).json({ success: false, error: '${name} not found' });
                return;
            }
            
            res.json({ success: true, data: item });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create new ${name.toLowerCase()}
     */
    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const data = req.body;
            const item = await this.${serviceVar}.create(data);
            res.status(201).json({ success: true, data: item });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update ${name.toLowerCase()}
     */
    async update(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const data = req.body;
            const item = await this.${serviceVar}.update(id, data);
            
            if (!item) {
                res.status(404).json({ success: false, error: '${name} not found' });
                return;
            }
            
            res.json({ success: true, data: item });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete ${name.toLowerCase()}
     */
    async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            await this.${serviceVar}.delete(id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}
`;
    }

    private getServiceTemplate(name: string, config: CodegenConfig): string {
        const repoName = `${name}Repository`;
        const repoVar = this.toCamelCase(repoName);

        return `/**
 * ${name} Service
 * Business logic for ${name} operations
 */

import { ${repoName} } from '../repositories/${this.toKebabCase(name)}.repository';
import { Create${name}Dto, Update${name}Dto } from '../dtos/${this.toKebabCase(name)}.dto';

export interface ${name} {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export class ${name}Service {
    constructor(private readonly ${repoVar}: ${repoName}) {}

    /**
     * Find all ${name.toLowerCase()}s
     */
    async findAll(): Promise<${name}[]> {
        return this.${repoVar}.findAll();
    }

    /**
     * Find ${name.toLowerCase()} by ID
     */
    async findById(id: string): Promise<${name} | null> {
        return this.${repoVar}.findById(id);
    }

    /**
     * Create new ${name.toLowerCase()}
     */
    async create(data: Create${name}Dto): Promise<${name}> {
        // Add business logic here
        return this.${repoVar}.create(data);
    }

    /**
     * Update ${name.toLowerCase()}
     */
    async update(id: string, data: Update${name}Dto): Promise<${name} | null> {
        const existing = await this.${repoVar}.findById(id);
        if (!existing) {
            return null;
        }
        
        // Add business logic here
        return this.${repoVar}.update(id, data);
    }

    /**
     * Delete ${name.toLowerCase()}
     */
    async delete(id: string): Promise<void> {
        await this.${repoVar}.delete(id);
    }
}
`;
    }

    private getRepositoryTemplate(name: string, config: CodegenConfig): string {
        return `/**
 * ${name} Repository
 * Data access layer for ${name} entities
 */

import { ${name} } from '../services/${this.toKebabCase(name)}.service';
import { Create${name}Dto, Update${name}Dto } from '../dtos/${this.toKebabCase(name)}.dto';

export class ${name}Repository {
    private items: Map<string, ${name}> = new Map();

    /**
     * Find all ${name.toLowerCase()}s
     */
    async findAll(): Promise<${name}[]> {
        return Array.from(this.items.values());
    }

    /**
     * Find ${name.toLowerCase()} by ID
     */
    async findById(id: string): Promise<${name} | null> {
        return this.items.get(id) || null;
    }

    /**
     * Create new ${name.toLowerCase()}
     */
    async create(data: Create${name}Dto): Promise<${name}> {
        const id = this.generateId();
        const now = new Date();
        
        const item: ${name} = {
            id,
            ...data,
            createdAt: now,
            updatedAt: now,
        } as ${name};
        
        this.items.set(id, item);
        return item;
    }

    /**
     * Update ${name.toLowerCase()}
     */
    async update(id: string, data: Update${name}Dto): Promise<${name} | null> {
        const existing = this.items.get(id);
        if (!existing) {
            return null;
        }
        
        const updated: ${name} = {
            ...existing,
            ...data,
            updatedAt: new Date(),
        };
        
        this.items.set(id, updated);
        return updated;
    }

    /**
     * Delete ${name.toLowerCase()}
     */
    async delete(id: string): Promise<void> {
        this.items.delete(id);
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
`;
    }

    private getDtoTemplate(name: string): string {
        return `/**
 * ${name} DTOs
 * Data transfer objects for ${name}
 */

import { z } from 'zod';

/**
 * Schema for creating a new ${name}
 */
export const Create${name}Schema = z.object({
    // Add your fields here
    name: z.string().min(1).max(100),
    description: z.string().optional(),
});

export type Create${name}Dto = z.infer<typeof Create${name}Schema>;

/**
 * Schema for updating a ${name}
 */
export const Update${name}Schema = Create${name}Schema.partial();

export type Update${name}Dto = z.infer<typeof Update${name}Schema>;

/**
 * Query parameters for listing ${name}s
 */
export const ${name}QuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ${name}QueryDto = z.infer<typeof ${name}QuerySchema>;
`;
    }

    private getRoutesTemplate(name: string, fileName: string): string {
        const controllerVar = `${this.toCamelCase(name)}Controller`;

        return `/**
 * ${name} Routes
 * Route definitions for ${name} API
 */

import { Router } from 'express';
import { ${name}Controller } from '../controllers/${fileName}.controller';
import { ${name}Service } from '../services/${fileName}.service';
import { ${name}Repository } from '../repositories/${fileName}.repository';

// Initialize dependencies
const ${this.toCamelCase(name)}Repository = new ${name}Repository();
const ${this.toCamelCase(name)}Service = new ${name}Service(${this.toCamelCase(name)}Repository);
const ${controllerVar} = new ${name}Controller(${this.toCamelCase(name)}Service);

const router = Router();

// GET /${fileName}s - Get all
router.get('/', (req, res, next) => ${controllerVar}.getAll(req, res, next));

// GET /${fileName}s/:id - Get by ID
router.get('/:id', (req, res, next) => ${controllerVar}.getById(req, res, next));

// POST /${fileName}s - Create new
router.post('/', (req, res, next) => ${controllerVar}.create(req, res, next));

// PUT /${fileName}s/:id - Update
router.put('/:id', (req, res, next) => ${controllerVar}.update(req, res, next));

// DELETE /${fileName}s/:id - Delete
router.delete('/:id', (req, res, next) => ${controllerVar}.delete(req, res, next));

export default router;
`;
    }

    private getModuleIndexTemplate(name: string, fileName: string): string {
        return `/**
 * ${name} Module
 * Exports all ${name} related components
 */

export { ${name}Controller } from '../../controllers/${fileName}.controller';
export { ${name}Service } from '../../services/${fileName}.service';
export { ${name}Repository } from '../../repositories/${fileName}.repository';
export * from '../../dtos/${fileName}.dto';
export { default as ${this.toCamelCase(name)}Routes } from '../../routes/${fileName}.routes';
`;
    }

    private generatePackageJson(name: string, config: CodegenConfig): string {
        return JSON.stringify({
            name,
            version: '1.0.0',
            description: `${name} backend service`,
            main: 'dist/index.js',
            scripts: {
                dev: 'nodemon --exec ts-node src/index.ts',
                build: 'tsc',
                start: 'node dist/index.js',
                test: 'jest',
            },
            keywords: ['typescript', 'express', 'api'],
            author: '',
            license: 'MIT',
            dependencies: {
                express: '^4.18.2',
                dotenv: '^16.3.1',
                cors: '^2.8.5',
                helmet: '^7.1.0',
                zod: '^3.22.4',
            },
            devDependencies: {
                typescript: '^5.3.3',
                '@types/node': '^20.10.0',
                '@types/express': '^4.17.21',
                '@types/cors': '^2.8.15',
                'ts-node': '^10.9.2',
                nodemon: '^3.0.2',
            },
        }, null, 2);
    }

    private generateMainEntry(config: CodegenConfig): string {
        return `/**
 * Application Entry Point
 */

import app from './app';
import { config } from './config';

const PORT = config.port || 3000;

app.listen(PORT, () => {
    console.log(\`🚀 Server running on port \${PORT}\`);
    console.log(\`📚 Environment: \${config.nodeEnv}\`);
});
`;
    }

    private generateDockerCompose(name: string): string {
        return `version: '3.8'

services:
  ${name}:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
`;
    }

    private generateEnvExample(config: CodegenConfig): string {
        return `# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# CORS
CORS_ORIGINS=http://localhost:3000
`;
    }

    private getDatabaseConfigTemplate(config: CodegenConfig): string {
        return `/**
 * Database Configuration
 */

export const databaseConfig = {
    url: process.env.DATABASE_URL || '',
    poolMin: 2,
    poolMax: 10,
};
`;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private toPascalCase(str: string): string {
        return str
            .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
            .replace(/^(.)/, (c) => c.toUpperCase());
    }

    private toCamelCase(str: string): string {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    private toKebabCase(str: string): string {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase();
    }

    private suggestNextAgents(config: CodegenConfig): string[] {
        const suggestions: string[] = [];

        if (config.features?.includes('authentication')) {
            suggestions.push('auth-agent');
        }
        if (config.includeDocker) {
            suggestions.push('cicd-agent');
        }
        if (config.includeTests) {
            suggestions.push('test-agent');
        }

        return suggestions;
    }
}

// Export singleton instance
export const codegenAgent = new CodegenAgent();

// Default export for dynamic loading
export default codegenAgent;
