/**
 * ============================================
 * ARCHITECTURE AGENT - PROJECT STRUCTURE CREATION
 * ============================================
 * 
 * The ArchitectureAgent is responsible for:
 * - Designing project structure
 * - Creating directories using mkdir
 * - Creating files using touch/write
 * - Setting up the file system for code generation
 * 
 * Owner: Person 4
 * Tier: 3 (Support Agent)
 */


import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";
import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus,
    AgentTier,
} from '@loveable/shared';

dotenv.config();

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface ProjectStructure {
    name: string;
    type: 'express' | 'fastify' | 'nestjs' | 'generic';
    directories: DirectoryNode[];
    files: FileNode[];
}

export interface DirectoryNode {
    path: string;
    description?: string;
}

export interface FileNode {
    path: string;
    content?: string;
    description?: string;
}

export interface ArchitectureResult {
    projectPath: string;
    createdDirectories: string[];
    createdFiles: string[];
    errors: string[];
}

// ============================================
// PROJECT STRUCTURE TEMPLATES
// ============================================

const EXPRESS_STRUCTURE: Omit<ProjectStructure, 'name'> = {
    type: 'express',
    directories: [
        { path: 'src', description: 'Source code' },
        { path: 'src/config', description: 'Configuration files' },
        { path: 'src/controllers', description: 'Route controllers' },
        { path: 'src/services', description: 'Business logic' },
        { path: 'src/repositories', description: 'Data access layer' },
        { path: 'src/dtos', description: 'Data transfer objects' },
        { path: 'src/middleware', description: 'Express middleware' },
        { path: 'src/routes', description: 'Route definitions' },
        { path: 'src/utils', description: 'Utility functions' },
        { path: 'src/types', description: 'TypeScript type definitions' },
        { path: 'tests', description: 'Test files' },
        { path: 'tests/unit', description: 'Unit tests' },
        { path: 'tests/integration', description: 'Integration tests' },
    ],
    files: [
        { path: 'src/index.ts', description: 'Application entry point' },
        { path: 'src/app.ts', description: 'Express app setup' },
        { path: 'src/config/index.ts', description: 'Configuration' },
        { path: 'package.json', description: 'NPM package file' },
        { path: 'tsconfig.json', description: 'TypeScript config' },
        { path: '.env.example', description: 'Environment template' },
        { path: '.gitignore', description: 'Git ignore file' },
        { path: 'README.md', description: 'Project documentation' },
    ],
};

const NESTJS_STRUCTURE: Omit<ProjectStructure, 'name'> = {
    type: 'nestjs',
    directories: [
        { path: 'src', description: 'Source code' },
        { path: 'src/common', description: 'Shared code' },
        { path: 'src/common/decorators', description: 'Custom decorators' },
        { path: 'src/common/filters', description: 'Exception filters' },
        { path: 'src/common/guards', description: 'Auth guards' },
        { path: 'src/common/interceptors', description: 'Interceptors' },
        { path: 'src/common/pipes', description: 'Validation pipes' },
        { path: 'src/config', description: 'Configuration' },
        { path: 'src/modules', description: 'Feature modules' },
        { path: 'test', description: 'Test files' },
    ],
    files: [
        { path: 'src/main.ts', description: 'Application entry point' },
        { path: 'src/app.module.ts', description: 'Root module' },
        { path: 'nest-cli.json', description: 'NestJS CLI config' },
        { path: 'package.json', description: 'NPM package file' },
        { path: 'tsconfig.json', description: 'TypeScript config' },
        { path: 'tsconfig.build.json', description: 'Build config' },
        { path: '.env.example', description: 'Environment template' },
        { path: '.gitignore', description: 'Git ignore file' },
    ],
};

const MICROSERVICE_STRUCTURE: Omit<ProjectStructure, 'name'> = {
    type: 'generic',
    directories: [
        { path: 'src', description: 'Source code' },
        { path: 'src/api', description: 'API layer' },
        { path: 'src/domain', description: 'Domain logic' },
        { path: 'src/domain/entities', description: 'Domain entities' },
        { path: 'src/domain/events', description: 'Domain events' },
        { path: 'src/domain/services', description: 'Domain services' },
        { path: 'src/infrastructure', description: 'Infrastructure' },
        { path: 'src/infrastructure/database', description: 'Database' },
        { path: 'src/infrastructure/messaging', description: 'Message queue' },
        { path: 'src/infrastructure/http', description: 'HTTP clients' },
        { path: 'proto', description: 'Protocol buffer definitions' },
        { path: 'tests', description: 'Test files' },
    ],
    files: [
        { path: 'src/index.ts', description: 'Entry point' },
        { path: 'docker-compose.yml', description: 'Docker compose' },
        { path: 'Dockerfile', description: 'Docker file' },
        { path: 'package.json', description: 'NPM package file' },
        { path: 'tsconfig.json', description: 'TypeScript config' },
    ],
};

// ============================================
// ARCHITECTURE AGENT CLASS
// ============================================

export class ArchitectureAgent implements IAgent {
    // IAgent required properties
    public readonly id = 'architecture-agent';
    public readonly name = 'Architecture Agent';
    public readonly tier: AgentTier = 3;
    public readonly capabilities = [
        'project-structure',
        'directory-creation',
        'file-creation',
        'scaffold-project',
        'mkdir',
        'touch',
    ];
    public readonly description = 'Creates project structure with directories and files on the filesystem';
    public readonly version = '1.0.0';

    private isInitialized = false;
    private baseOutputPath: string = process.cwd();

    constructor() { }

    // ============================================
    // IAgent INTERFACE METHODS
    // ============================================

    async initialize(config: AgentConfig): Promise<void> {
        console.log(`📁 [${this.name}] Initializing...`);

        if (config.customSettings?.outputPath) {
            this.baseOutputPath = config.customSettings.outputPath as string;
        }

        this.isInitialized = true;
        console.log(`✅ [${this.name}] Initialized, base path: ${this.baseOutputPath}`);
    }

    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();

        console.log(`📁 [${this.name}] Executing task: ${input.task.substring(0, 50)}...`);

        try {
            // Parse the structure from input
            const structure = this.parseStructureFromTask(input.task, input.context);

            // Determine output path
            const outputPath = (input.context?.outputPath as string) ||
                path.join(this.baseOutputPath, structure.name);

            // Create the project structure
            const result = await this.createProjectStructure(structure, outputPath);

            const executionTime = Date.now() - startTime;

            return {
                success: result.errors.length === 0,
                files: result.createdFiles.map(f => ({
                    path: f,
                    content: '',
                    type: 'code' as const,
                    language: 'text',
                })),
                message: `Created ${result.createdDirectories.length} directories and ${result.createdFiles.length} files at ${result.projectPath}`,
                metadata: {
                    executionTime,
                    projectPath: result.projectPath,
                    createdDirectories: result.createdDirectories,
                    createdFiles: result.createdFiles,
                    errors: result.errors,
                },
                suggestedNextAgents: ['codewriter-agent', 'codegen-agent'],
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'ARCHITECTURE_ERROR',
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
            message: this.isInitialized ? 'Architecture agent is ready' : 'Agent not initialized',
            details: {
                version: this.version,
                capabilities: this.capabilities,
                baseOutputPath: this.baseOutputPath,
            },
        };
    }

    async shutdown(): Promise<void> {
        console.log(`📁 [${this.name}] Shutting down...`);
        this.isInitialized = false;
    }

    // ============================================
    // STRUCTURE PARSING
    // ============================================

    private parseStructureFromTask(task: string, context?: Record<string, unknown>): ProjectStructure {
        const taskLower = task.toLowerCase();

        // Extract project name
        let projectName = 'my-project';
        const nameMatch = task.match(/(?:called?|named?|for)\s+['""]?([a-zA-Z][a-zA-Z0-9-_]*)['""]?/i);
        if (nameMatch) {
            projectName = nameMatch[1].toLowerCase().replace(/\s+/g, '-');
        } else if (context?.projectName) {
            projectName = (context.projectName as string).toLowerCase().replace(/\s+/g, '-');
        }

        // Determine project type
        let template: Omit<ProjectStructure, 'name'>;

        if (taskLower.includes('nestjs') || taskLower.includes('nest')) {
            template = NESTJS_STRUCTURE;
        } else if (taskLower.includes('microservice') || taskLower.includes('grpc')) {
            template = MICROSERVICE_STRUCTURE;
        } else {
            template = EXPRESS_STRUCTURE;
        }

        return {
            name: projectName,
            ...template,
        };
    }

    // ============================================
    // FILE SYSTEM OPERATIONS
    // ============================================

    async createProjectStructure(structure: ProjectStructure, outputPath: string): Promise<ArchitectureResult> {
        const result: ArchitectureResult = {
            projectPath: outputPath,
            createdDirectories: [],
            createdFiles: [],
            errors: [],
        };

        console.log(`📁 [${this.name}] Creating project structure at: ${outputPath}`);

        // Create base project directory
        try {
            await this.createDirectory(outputPath);
            result.createdDirectories.push(outputPath);
            console.log(`  ✅ Created: ${outputPath}`);
        } catch (error) {
            const msg = `Failed to create base directory: ${outputPath}`;
            result.errors.push(msg);
            console.error(`  ❌ ${msg}`);
            return result;
        }

        // Create all directories
        for (const dir of structure.directories) {
            const dirPath = path.join(outputPath, dir.path);
            try {
                await this.createDirectory(dirPath);
                result.createdDirectories.push(dir.path);
                console.log(`  ✅ mkdir: ${dir.path}`);
            } catch (error) {
                const msg = `Failed to create directory: ${dir.path}`;
                result.errors.push(msg);
                console.error(`  ❌ ${msg}`);
            }
        }

        // Create all files (empty or with default content)
        for (const file of structure.files) {
            const filePath = path.join(outputPath, file.path);
            try {
                await this.createFile(filePath, file.content || this.getDefaultContent(file.path));
                result.createdFiles.push(file.path);
                console.log(`  ✅ touch: ${file.path}`);
            } catch (error) {
                const msg = `Failed to create file: ${file.path}`;
                result.errors.push(msg);
                console.error(`  ❌ ${msg}`);
            }
        }

        console.log(`📁 [${this.name}] Structure creation complete!`);
        console.log(`   Directories: ${result.createdDirectories.length}`);
        console.log(`   Files: ${result.createdFiles.length}`);
        console.log(`   Errors: ${result.errors.length}`);

        return result;
    }

    private async createDirectory(dirPath: string): Promise<void> {
        await fs.mkdir(dirPath, { recursive: true });
    }

    private async createFile(filePath: string, content: string = ''): Promise<void> {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(filePath, content, 'utf-8');
    }

    private getDefaultContent(filePath: string): string {
        const ext = path.extname(filePath);
        const basename = path.basename(filePath);

        switch (basename) {
            case '.gitignore':
                return `node_modules/
dist/
.env
*.log
coverage/
.DS_Store
`;

            case '.env.example':
                return `# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=

# Redis
REDIS_URL=redis://localhost:6379
`;

            case 'README.md':
                return `# Project

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

            case 'package.json':
                return JSON.stringify({
                    name: 'my-project',
                    version: '1.0.0',
                    scripts: {
                        dev: 'ts-node src/index.ts',
                        build: 'tsc',
                        start: 'node dist/index.js',
                    },
                    dependencies: {},
                    devDependencies: {
                        typescript: '^5.0.0',
                        '@types/node': '^20.0.0',
                    },
                }, null, 2);

            case 'tsconfig.json':
                return JSON.stringify({
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'NodeNext',
                        moduleResolution: 'NodeNext',
                        outDir: './dist',
                        rootDir: './src',
                        strict: true,
                        esModuleInterop: true,
                        skipLibCheck: true,
                    },
                    include: ['src/**/*'],
                    exclude: ['node_modules', 'dist'],
                }, null, 2);

            default:
                if (ext === '.ts') {
                    return `/**\n * ${basename}\n */\n\n`;
                }
                return '';
        }
    }

    // ============================================
    // PUBLIC UTILITY METHODS
    // ============================================

    /**
     * Create a custom project structure
     */
    async createCustomStructure(
        projectName: string,
        directories: string[],
        files: Array<{ path: string; content?: string }>,
        outputPath?: string
    ): Promise<ArchitectureResult> {
        const structure: ProjectStructure = {
            name: projectName,
            type: 'generic',
            directories: directories.map(d => ({ path: d })),
            files: files.map(f => ({ path: f.path, content: f.content })),
        };

        const basePath = outputPath || path.join(this.baseOutputPath, projectName);
        return this.createProjectStructure(structure, basePath);
    }

    /**
     * Add a module structure to an existing project
     */
    async createModuleStructure(
        moduleName: string,
        projectPath: string,
        type: 'express' | 'nestjs' = 'express'
    ): Promise<ArchitectureResult> {
        const kebabName = moduleName.toLowerCase().replace(/\s+/g, '-');

        let directories: DirectoryNode[];
        let files: FileNode[];

        if (type === 'nestjs') {
            directories = [
                { path: `src/modules/${kebabName}` },
                { path: `src/modules/${kebabName}/dto` },
            ];
            files = [
                { path: `src/modules/${kebabName}/${kebabName}.module.ts` },
                { path: `src/modules/${kebabName}/${kebabName}.controller.ts` },
                { path: `src/modules/${kebabName}/${kebabName}.service.ts` },
                { path: `src/modules/${kebabName}/dto/create-${kebabName}.dto.ts` },
                { path: `src/modules/${kebabName}/dto/update-${kebabName}.dto.ts` },
            ];
        } else {
            directories = [];
            files = [
                { path: `src/controllers/${kebabName}.controller.ts` },
                { path: `src/services/${kebabName}.service.ts` },
                { path: `src/repositories/${kebabName}.repository.ts` },
                { path: `src/dtos/${kebabName}.dto.ts` },
                { path: `src/routes/${kebabName}.routes.ts` },
            ];
        }

        const structure: ProjectStructure = {
            name: moduleName,
            type,
            directories,
            files,
        };

        return this.createProjectStructure(structure, projectPath);
    }

    /**
     * Get available project templates
     */
    getAvailableTemplates(): string[] {
        return ['express', 'nestjs', 'microservice'];
    }
}

// Export singleton instance
export const architectureAgent = new ArchitectureAgent();

// Default export for dynamic loading
export default architectureAgent;
