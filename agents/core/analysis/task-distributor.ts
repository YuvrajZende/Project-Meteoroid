/**
 * Task Distributor
 * 
 * Creates individual task files for each agent based on the analysis results.
 * The orchestrator uses these files to assign work to specific agents.
 * 
 * Generated files:
 * - auth-agent.md
 * - db-agent.md
 * - api-agent.md
 * - security-agent.md
 * - deploy-agent.md
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
    FrontendAnalysisResult,
    InferredModel,
    ExtractedAPICall,
    DetectedAuthStrategy,
} from './types.js';

// ============================================
// TYPES
// ============================================

export interface TaskDistributorConfig {
    /** Analysis result from Frontend Analyzer */
    analysisResult: FrontendAnalysisResult;

    /** Output directory for task files */
    outputDir: string;

    /** Project name for headers */
    projectName?: string;
}

export interface DistributedTask {
    agentId: string;
    agentName: string;
    taskFilePath: string;
    priority: number;
    estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface DistributionResult {
    tasks: DistributedTask[];
    tasksDir: string;
    totalAgents: number;
}

// ============================================
// TASK DISTRIBUTOR
// ============================================

export class TaskDistributor {
    private config: TaskDistributorConfig;
    private tasksDir: string;

    constructor(config: TaskDistributorConfig) {
        this.config = config;
        this.tasksDir = path.join(config.outputDir, 'tasks');
    }

    /**
     * Distribute tasks to all needed agents
     */
    async distribute(): Promise<DistributionResult> {
        // Ensure tasks directory exists
        await fs.promises.mkdir(this.tasksDir, { recursive: true });

        const tasks: DistributedTask[] = [];
        const { analysisResult } = this.config;

        // 1. Database Agent (always if models exist)
        if (analysisResult.dataModels.length > 0) {
            const task = await this.createDatabaseAgentTask();
            tasks.push(task);
        }

        // 2. Auth Agent (if auth detected)
        if (
            analysisResult.authStrategy.provider !== 'none' ||
            analysisResult.authStrategy.protectedRoutes.length > 0
        ) {
            const task = await this.createAuthAgentTask();
            tasks.push(task);
        }

        // 3. API Agent (if endpoints detected)
        if (analysisResult.apiCalls.length > 0) {
            const task = await this.createApiAgentTask();
            tasks.push(task);
        }

        // 4. Security Agent (always)
        const securityTask = await this.createSecurityAgentTask();
        tasks.push(securityTask);

        // 5. Deploy Agent (always)
        const deployTask = await this.createDeployAgentTask();
        tasks.push(deployTask);

        // Create index file
        await this.createTaskIndex(tasks);

        console.log(`[TaskDistributor] Created ${tasks.length} task files in ${this.tasksDir}`);

        return {
            tasks,
            tasksDir: this.tasksDir,
            totalAgents: tasks.length,
        };
    }

    // ========================================
    // AGENT TASK GENERATORS
    // ========================================

    /**
     * Create database agent task file
     */
    private async createDatabaseAgentTask(): Promise<DistributedTask> {
        const { analysisResult } = this.config;
        const { dataModels, suggestions } = analysisResult;

        const lines = [
            '# Database Agent Task',
            '',
            `> Project: ${this.config.projectName || 'Backend'}`,
            `> Generated: ${new Date().toISOString()}`,
            '',
            '## Configuration',
            '',
            `- **ORM:** ${suggestions.recommendedOrm}`,
            `- **Database:** ${suggestions.recommendedDatabase}`,
            `- **Total Models:** ${dataModels.length}`,
            '',
            '## Models to Generate',
            '',
        ];

        // Add each model
        for (const model of dataModels) {
            lines.push(`### ${model.name}`);
            lines.push('');
            lines.push('```prisma');
            lines.push(`model ${model.name} {`);

            for (const field of model.fields) {
                const prismaType = this.toPrismaType(field.type, field.arrayType);
                const optional = field.optional ? '?' : '';
                const isPK = model.primaryKey === field.name;
                const attrs = isPK ? ' @id @default(uuid())' : '';
                lines.push(`  ${field.name} ${prismaType}${optional}${attrs}`);
            }

            // Add relationships
            for (const rel of model.relationships) {
                if (rel.type === 'one-to-many') {
                    lines.push(`  ${rel.fieldName} ${rel.targetModel}[]`);
                } else {
                    lines.push(`  ${rel.fieldName} ${rel.targetModel}? @relation(fields: [${rel.fieldName}Id], references: [id])`);
                    lines.push(`  ${rel.fieldName}Id String?`);
                }
            }

            // Add timestamps
            lines.push('  createdAt DateTime @default(now())');
            lines.push('  updatedAt DateTime @updatedAt');
            lines.push('}');
            lines.push('```');
            lines.push('');
        }

        // Instructions
        lines.push('## Instructions');
        lines.push('');
        lines.push('1. Generate complete Prisma schema with all models');
        lines.push('2. Create initial migration');
        lines.push('3. Generate seed data for development');
        lines.push('4. Create database service with CRUD operations');
        lines.push('');

        // Write file
        const filePath = path.join(this.tasksDir, 'db-agent.md');
        await fs.promises.writeFile(filePath, lines.join('\n'), 'utf-8');

        return {
            agentId: 'database-agent',
            agentName: 'Database Agent',
            taskFilePath: filePath,
            priority: 1, // Highest priority - database first
            estimatedComplexity: dataModels.length > 5 ? 'high' : 'medium',
        };
    }

    /**
     * Create auth agent task file
     */
    private async createAuthAgentTask(): Promise<DistributedTask> {
        const { analysisResult } = this.config;
        const { authStrategy, routes } = analysisResult;

        const protectedRoutes = routes.filter(r => r.isProtected);

        const lines = [
            '# Auth Agent Task',
            '',
            `> Project: ${this.config.projectName || 'Backend'}`,
            `> Generated: ${new Date().toISOString()}`,
            '',
            '## Configuration',
            '',
            `- **Provider:** ${authStrategy.provider}`,
            `- **Package:** ${authStrategy.packageName || 'To be configured'}`,
            `- **Token Storage:** ${authStrategy.tokenStorage}`,
            '',
            '## Features Required',
            '',
            `- [${authStrategy.features.emailPassword ? 'x' : ' '}] Email/Password Authentication`,
            `- [${authStrategy.features.socialLogin ? 'x' : ' '}] Social OAuth (Google, GitHub)`,
            `- [${authStrategy.features.magicLink ? 'x' : ' '}] Magic Link / Passwordless`,
            `- [${authStrategy.features.mfa ? 'x' : ' '}] Multi-Factor Authentication`,
            `- [${authStrategy.features.sso ? 'x' : ' '}] Single Sign-On (SSO)`,
            '',
            '## Protected Routes',
            '',
        ];

        if (authStrategy.protectedRoutes.length > 0) {
            for (const route of authStrategy.protectedRoutes) {
                lines.push(`- \`${route}\``);
            }
        } else if (protectedRoutes.length > 0) {
            for (const route of protectedRoutes) {
                lines.push(`- \`${route.path}\``);
            }
        } else {
            lines.push('- No protected routes detected (configure manually)');
        }

        // Instructions
        lines.push('');
        lines.push('## Instructions');
        lines.push('');

        if (authStrategy.provider === 'clerk') {
            lines.push('1. Generate Clerk middleware setup');
            lines.push('2. Create `useAuth` wrapper hook');
            lines.push('3. Generate protected route HOC');
            lines.push('4. Set up webhook handlers for user sync');
        } else if (authStrategy.provider === 'nextauth') {
            lines.push('1. Generate NextAuth configuration');
            lines.push('2. Create auth API route handlers');
            lines.push('3. Generate session provider wrapper');
            lines.push('4. Create middleware for protected routes');
        } else {
            lines.push('1. Generate JWT-based authentication middleware');
            lines.push('2. Create login/register endpoints');
            lines.push('3. Generate session management');
            lines.push('4. Create protected route middleware');
        }

        lines.push('');

        // Write file
        const filePath = path.join(this.tasksDir, 'auth-agent.md');
        await fs.promises.writeFile(filePath, lines.join('\n'), 'utf-8');

        return {
            agentId: 'auth-agent',
            agentName: 'Auth Agent',
            taskFilePath: filePath,
            priority: 2,
            estimatedComplexity: authStrategy.features.mfa ? 'high' : 'medium',
        };
    }

    /**
     * Create API agent task file
     */
    private async createApiAgentTask(): Promise<DistributedTask> {
        const { analysisResult } = this.config;
        const { apiCalls, suggestions } = analysisResult;

        // Group endpoints by resource
        const grouped = this.groupEndpointsByResource(apiCalls);

        const lines = [
            '# API Agent Task',
            '',
            `> Project: ${this.config.projectName || 'Backend'}`,
            `> Generated: ${new Date().toISOString()}`,
            '',
            '## Configuration',
            '',
            `- **Style:** ${suggestions.apiStyle}`,
            `- **Total Endpoints:** ${apiCalls.length}`,
            `- **Resources:** ${grouped.size}`,
            '',
            '## Endpoints to Generate',
            '',
        ];

        // List by resource
        for (const [resource, endpoints] of grouped) {
            lines.push(`### ${resource}`);
            lines.push('');
            lines.push('| Method | Endpoint | Auth | Params |');
            lines.push('|--------|----------|------|--------|');

            for (const ep of endpoints) {
                const auth = ep.requiresAuth ? '🔒' : '-';
                const params = ep.pathParams?.join(', ') || '-';
                lines.push(`| ${ep.method} | \`${ep.endpoint}\` | ${auth} | ${params} |`);
            }

            lines.push('');
        }

        // Instructions
        lines.push('## Instructions');
        lines.push('');
        lines.push('1. Generate Express router with all endpoints');
        lines.push('2. Create controller functions with validation');
        lines.push('3. Add request/response DTOs with Zod');
        lines.push('4. Implement error handling middleware');
        lines.push('5. Generate OpenAPI/Swagger documentation');
        lines.push('');

        // Write file
        const filePath = path.join(this.tasksDir, 'api-agent.md');
        await fs.promises.writeFile(filePath, lines.join('\n'), 'utf-8');

        return {
            agentId: 'api-agent',
            agentName: 'API Agent',
            taskFilePath: filePath,
            priority: 3,
            estimatedComplexity: apiCalls.length > 10 ? 'high' : 'medium',
        };
    }

    /**
     * Create security agent task file
     */
    private async createSecurityAgentTask(): Promise<DistributedTask> {
        const { analysisResult } = this.config;

        const lines = [
            '# Security Agent Task',
            '',
            `> Project: ${this.config.projectName || 'Backend'}`,
            `> Generated: ${new Date().toISOString()}`,
            '',
            '## Security Requirements',
            '',
            '### CORS Configuration',
            '- Configure allowed origins for frontend',
            '- Set appropriate methods and headers',
            '',
            '### Rate Limiting',
            '- API rate limiting per IP/user',
            '- Brute force protection for auth endpoints',
            '',
            '### Input Validation',
            '- Request body validation',
            '- Query parameter sanitization',
            '- SQL injection prevention',
            '- XSS protection',
            '',
            '### Headers',
            '- Helmet.js security headers',
            '- CSRF protection',
            '',
            '## Instructions',
            '',
            '1. Generate CORS middleware with proper configuration',
            '2. Create rate limiting middleware',
            '3. Set up Helmet.js with recommended settings',
            '4. Generate input sanitization utilities',
            '5. Create security audit logging',
            '',
        ];

        // Write file
        const filePath = path.join(this.tasksDir, 'security-agent.md');
        await fs.promises.writeFile(filePath, lines.join('\n'), 'utf-8');

        return {
            agentId: 'security-agent',
            agentName: 'Security Agent',
            taskFilePath: filePath,
            priority: 4,
            estimatedComplexity: 'medium',
        };
    }

    /**
     * Create deploy agent task file
     */
    private async createDeployAgentTask(): Promise<DistributedTask> {
        const { analysisResult } = this.config;

        const lines = [
            '# Deployment Agent Task',
            '',
            `> Project: ${this.config.projectName || 'Backend'}`,
            `> Generated: ${new Date().toISOString()}`,
            '',
            '## Deployment Requirements',
            '',
            '### Docker',
            '- Generate multi-stage Dockerfile',
            '- Create docker-compose for local development',
            '- Include database service',
            '',
            '### CI/CD',
            '- GitHub Actions workflow',
            '- Automated testing',
            '- Build and deploy pipeline',
            '',
            '### Environment',
            '- Generate `.env.example` with all required variables',
            '- Document environment configuration',
            '',
            '## Environment Variables Needed',
            '',
            '```env',
            '# Database',
            'DATABASE_URL=',
            '',
            '# Auth',
        ];

        if (analysisResult.authStrategy.provider === 'clerk') {
            lines.push('CLERK_SECRET_KEY=');
            lines.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=');
        } else {
            lines.push('JWT_SECRET=');
            lines.push('JWT_EXPIRES_IN=');
        }

        lines.push('');
        lines.push('# Server');
        lines.push('PORT=3001');
        lines.push('NODE_ENV=production');
        lines.push('```');
        lines.push('');
        lines.push('## Instructions');
        lines.push('');
        lines.push('1. Generate Dockerfile with Node.js base');
        lines.push('2. Create docker-compose.yml with PostgreSQL');
        lines.push('3. Generate GitHub Actions workflow');
        lines.push('4. Create railway.toml for Railway deployment');
        lines.push('5. Generate health check endpoint');
        lines.push('');

        // Write file
        const filePath = path.join(this.tasksDir, 'deploy-agent.md');
        await fs.promises.writeFile(filePath, lines.join('\n'), 'utf-8');

        return {
            agentId: 'cicd-agent',
            agentName: 'Deployment Agent',
            taskFilePath: filePath,
            priority: 5,
            estimatedComplexity: 'medium',
        };
    }

    /**
     * Create task index file
     */
    private async createTaskIndex(tasks: DistributedTask[]): Promise<void> {
        const lines = [
            '# Agent Tasks Index',
            '',
            `> Generated: ${new Date().toISOString()}`,
            '',
            '## Execution Order',
            '',
            '| Priority | Agent | Task File | Complexity |',
            '|----------|-------|-----------|------------|',
        ];

        // Sort by priority
        const sorted = [...tasks].sort((a, b) => a.priority - b.priority);

        for (const task of sorted) {
            const fileName = path.basename(task.taskFilePath);
            lines.push(`| ${task.priority} | ${task.agentName} | [${fileName}](./${fileName}) | ${task.estimatedComplexity} |`);
        }

        lines.push('');
        lines.push('## Usage');
        lines.push('');
        lines.push('The orchestrator will execute agents in priority order:');
        lines.push('1. Database first (dependencies for other agents)');
        lines.push('2. Auth second (middleware for API)');
        lines.push('3. API third (uses DB and Auth)');
        lines.push('4. Security fourth (wraps API)');
        lines.push('5. Deployment last (packages everything)');
        lines.push('');

        const indexPath = path.join(this.tasksDir, 'index.md');
        await fs.promises.writeFile(indexPath, lines.join('\n'), 'utf-8');
    }

    // ========================================
    // HELPERS
    // ========================================

    /**
     * Convert TypeScript type to Prisma type
     */
    private toPrismaType(type: string, arrayType?: string): string {
        switch (type) {
            case 'string':
            case 'uuid':
            case 'email':
            case 'url':
            case 'enum':
                return 'String';
            case 'number':
                return 'Int';
            case 'boolean':
                return 'Boolean';
            case 'date':
                return 'DateTime';
            case 'object':
                return 'Json';
            case 'array':
                // Break recursion
                if (arrayType === 'array') return 'String[]';
                return `${this.toPrismaType(arrayType || 'string')}[]`;
            default:
                return 'String';
        }
    }

    /**
     * Group endpoints by resource (first path segment after /api/)
     */
    private groupEndpointsByResource(endpoints: ExtractedAPICall[]): Map<string, ExtractedAPICall[]> {
        const grouped = new Map<string, ExtractedAPICall[]>();

        for (const ep of endpoints) {
            // Extract resource from path like /api/users/:id -> users
            const match = ep.endpoint.match(/\/(?:api\/)?(\w+)/);
            const resource = match ? match[1] : 'other';
            const resourceName = resource.charAt(0).toUpperCase() + resource.slice(1);

            const existing = grouped.get(resourceName) || [];
            existing.push(ep);
            grouped.set(resourceName, existing);
        }

        return grouped;
    }
}

export default TaskDistributor;
