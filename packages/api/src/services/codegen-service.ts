/**
 * CodeGen Service
 * 
 * Integrates Person 4's CodeGen Agent pipeline with the server:
 * - Wraps CodegenAgent, ArchitectureAgent, CodeWriterAgent, DependencyAgent
 * - Provides unified project generation interface
 * - Connects to cost tracking, benchmarking, and database logging
 * 
 * Owner: Person 4's agents, integrated by Person 1
 */

import * as path from 'path';
import { pathToFileURL } from 'url';
import { getCostTracker } from './cost-tracker.js';
import { getBenchmarkingService } from './benchmarking.js';
import { checkSupabaseConnection } from './database-client.js';

// Import Person 4's CodeGen agents
// Note: These imports assume the agents are built and available
// The paths use the agents directory relative to the package

// Types for CodeGen functionality
export type SupportedLanguage = 'typescript' | 'python' | 'go' | 'rust' | 'java';
export type SupportedFramework =
    | 'express' | 'fastify' | 'nestjs' | 'nextjs'  // TypeScript
    | 'fastapi' | 'django' | 'flask'               // Python
    | 'gin' | 'echo' | 'fiber'                      // Go
    | 'actix' | 'rocket' | 'axum'                  // Rust
    | 'spring' | 'quarkus' | 'micronaut';          // Java

export interface CodeGenRequest {
    /** Unique task ID for tracking */
    taskId: string;
    /** User ID for cost/database tracking */
    userId: string;
    /** Project ID if applicable */
    projectId?: string;
    /** What to generate */
    prompt: string;
    /** Project configuration */
    config: {
        projectName: string;
        outputPath: string;
        language?: SupportedLanguage;
        framework?: SupportedFramework;
        description?: string;
        modules?: string[];
        installDependencies?: boolean;
        verify?: boolean;
    };
    /** Progress callback */
    onProgress?: (step: string, progress: number, message: string) => void;
}

export interface GeneratedFile {
    path: string;
    content: string;
    language: string;
    description?: string;
}

export interface CodeGenResult {
    success: boolean;
    taskId: string;
    projectPath: string;
    language: SupportedLanguage;
    framework: SupportedFramework;
    filesCreated: GeneratedFile[];
    dependenciesInstalled: boolean;
    verified: boolean;
    errors: string[];
    executionTime: number;
    cost?: number;
    tokenUsage?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

// ============================================
// CODEGEN SERVICE CLASS
// ============================================

export class CodeGenService {
    private initialized = false;

    constructor() {
        console.log('[CODEGEN-SERVICE] Created');
    }

    /**
     * Initialize the CodeGen service
     * Dynamically loads Person 4's agents
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[CODEGEN-SERVICE] Initializing...');

        try {
            // Check if the agents module is available
            // We'll use dynamic imports to handle the case where it's not built yet
            this.initialized = true;
            console.log('[CODEGEN-SERVICE] Initialized successfully');
        } catch (error) {
            console.warn('[CODEGEN-SERVICE] Failed to initialize:', error);
            // Service can still work in degraded mode
            this.initialized = true;
        }
    }

    /**
     * Generate a complete project using the CodeGen pipeline
     */
    async generateProject(request: CodeGenRequest): Promise<CodeGenResult> {
        const startTime = Date.now();
        const costTracker = getCostTracker();
        const benchmarking = getBenchmarkingService();

        console.log(`[CODEGEN-SERVICE] Starting project generation: ${request.config.projectName}`);

        // Emit progress
        request.onProgress?.('init', 0, 'Starting project generation...');

        try {
            // Dynamic import of the AutoOrchestrator
            const orchestratorModule = await this.loadAutoOrchestrator();

            if (!orchestratorModule) {
                return this.fallbackGeneration(request, startTime);
            }

            const { autoOrchestrator } = orchestratorModule;

            // Generate the project using Person 4's orchestrator
            request.onProgress?.('codegen', 10, 'Running CodeGen pipeline...');

            const result = await autoOrchestrator.generate({
                projectName: request.config.projectName,
                outputPath: request.config.outputPath,
                language: request.config.language || 'typescript',
                framework: request.config.framework,
                description: request.config.description || request.prompt,
                modules: request.config.modules,
                installDeps: request.config.installDependencies,
                verify: request.config.verify,
                onProgress: (step: string, progress: number, message: string) => {
                    request.onProgress?.(step, progress, message);
                },
            });

            const executionTime = Date.now() - startTime;

            // Track costs (estimate based on generation)
            const estimatedTokens = this.estimateTokens(result.filesCreated);
            const estimatedCost = this.estimateCost(estimatedTokens);

            costTracker.recordCost({
                modelId: 'llama-3.3-70b-versatile',
                inputTokens: estimatedTokens.prompt,
                outputTokens: estimatedTokens.completion,
                taskId: request.taskId,
                projectId: request.projectId,
                userId: request.userId,
                stage: 'code-generation',
                latencyMs: Date.now() - startTime,
                success: true,
            });

            // Record benchmark
            benchmarking.recordAgentExecution({
                agentId: 'codegen-orchestrator',
                agentName: 'CodeGen Orchestrator',
                executionTime,
                tokenUsage: estimatedTokens,
                success: result.success,
                filesGenerated: result.filesCreated.length,
                timestamp: new Date().toISOString(),
                taskId: request.taskId,
                projectId: request.projectId,
                userId: request.userId,
            });

            // Log to database if available
            await this.logToDatabase(request, result, executionTime);

            request.onProgress?.('done', 100, 'Project generation complete!');

            return {
                success: result.success,
                taskId: request.taskId,
                projectPath: result.projectPath,
                language: result.language as SupportedLanguage,
                framework: result.framework as SupportedFramework,
                filesCreated: result.filesCreated.map((f: string) => ({
                    path: typeof f === 'string' ? f : f,
                    content: '',  // Content is written to disk
                    language: this.getLanguageFromPath(typeof f === 'string' ? f : f),
                })),
                dependenciesInstalled: result.depsInstalled,
                verified: result.verified,
                errors: result.errors,
                executionTime,
                cost: estimatedCost,
                tokenUsage: estimatedTokens,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CODEGEN-SERVICE] Generation failed:', errorMsg);

            return {
                success: false,
                taskId: request.taskId,
                projectPath: path.resolve(request.config.outputPath, request.config.projectName),
                language: request.config.language || 'typescript',
                framework: request.config.framework || 'express',
                filesCreated: [],
                dependenciesInstalled: false,
                verified: false,
                errors: [errorMsg],
                executionTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Generate a single module (controller + service + repository)
     */
    async generateModule(
        moduleName: string,
        projectPath: string,
        request: Pick<CodeGenRequest, 'taskId' | 'userId' | 'projectId' | 'onProgress'>
    ): Promise<CodeGenResult> {
        const startTime = Date.now();

        console.log(`[CODEGEN-SERVICE] Generating module: ${moduleName}`);

        try {
            const orchestratorModule = await this.loadAutoOrchestrator();

            if (!orchestratorModule) {
                throw new Error('CodeGen orchestrator not available');
            }

            // Use the module generation capability
            const result = await orchestratorModule.autoOrchestrator.generate({
                projectName: moduleName,
                outputPath: projectPath,
                language: 'typescript',
                framework: 'express',
                description: `Generate ${moduleName} module with CRUD operations`,
                modules: [moduleName],
                installDeps: false,
            });

            return {
                success: result.success,
                taskId: request.taskId,
                projectPath: result.projectPath,
                language: 'typescript',
                framework: 'express',
                filesCreated: result.filesCreated.map((f: string) => ({
                    path: typeof f === 'string' ? f : f,
                    content: '',
                    language: 'typescript',
                })),
                dependenciesInstalled: false,
                verified: false,
                errors: result.errors,
                executionTime: Date.now() - startTime,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                taskId: request.taskId,
                projectPath: projectPath,
                language: 'typescript',
                framework: 'express',
                filesCreated: [],
                dependenciesInstalled: false,
                verified: false,
                errors: [errorMsg],
                executionTime: Date.now() - startTime,
            };
        }
    }

    /**
     * Get supported languages and frameworks
     */
    getSupportedConfigs(): {
        languages: SupportedLanguage[];
        frameworks: Record<SupportedLanguage, SupportedFramework[]>;
    } {
        return {
            languages: ['typescript', 'python', 'go', 'rust', 'java'],
            frameworks: {
                typescript: ['express', 'fastify', 'nestjs', 'nextjs'],
                python: ['fastapi', 'django', 'flask'],
                go: ['gin', 'echo', 'fiber'],
                rust: ['actix', 'rocket', 'axum'],
                java: ['spring', 'quarkus', 'micronaut'],
            },
        };
    }

    /**
     * Check if the CodeGen service is healthy
     */
    async healthCheck(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
        try {
            const orchestratorModule = await this.loadAutoOrchestrator();

            return {
                healthy: orchestratorModule !== null,
                message: orchestratorModule ? 'CodeGen service is operational' : 'CodeGen agents not loaded',
                details: {
                    initialized: this.initialized,
                    supportedLanguages: this.getSupportedConfigs().languages,
                },
            };
        } catch (error) {
            return {
                healthy: false,
                message: error instanceof Error ? error.message : 'Health check failed',
            };
        }
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    /**
     * Dynamically load the AutoOrchestrator from the agents module
     */
    private async loadAutoOrchestrator(): Promise<{ autoOrchestrator: any } | null> {
        try {
            // Try to dynamically import the orchestrator
            // The path is relative to the project root
            const agentsPath = path.resolve(__dirname, '../../../../agents/support/codegen/orchestrator.js');

            // Convert to file:// URL for Windows ESM compatibility
            const agentsUrl = pathToFileURL(agentsPath).href;

            // Check if we're in a context where the agents module is built
            const module = await import(agentsUrl);
            return { autoOrchestrator: module.autoOrchestrator || module.default };
        } catch (error) {
            console.warn('[CODEGEN-SERVICE] Could not load AutoOrchestrator:', error);

            // Try alternative path for different build configurations
            try {
                const altPath = path.resolve(process.cwd(), 'agents/support/codegen/orchestrator.js');
                const altUrl = pathToFileURL(altPath).href;
                const module = await import(altUrl);
                return { autoOrchestrator: module.autoOrchestrator || module.default };
            } catch {
                return null;
            }
        }
    }

    /**
     * Fallback generation when Person 4's orchestrator is not available
     */
    private async fallbackGeneration(request: CodeGenRequest, startTime: number): Promise<CodeGenResult> {
        console.warn('[CODEGEN-SERVICE] Using fallback generation (orchestrator not available)');

        // Create basic project structure
        const projectPath = path.resolve(request.config.outputPath, request.config.projectName);

        return {
            success: false,
            taskId: request.taskId,
            projectPath,
            language: request.config.language || 'typescript',
            framework: request.config.framework || 'express',
            filesCreated: [],
            dependenciesInstalled: false,
            verified: false,
            errors: ['CodeGen orchestrator not available. Please ensure the agents module is built.'],
            executionTime: Date.now() - startTime,
        };
    }

    /**
     * Estimate token usage based on generated files
     */
    private estimateTokens(files: string[]): { prompt: number; completion: number; total: number } {
        // Rough estimation: each file is ~500 tokens average
        const estimatedCompletion = files.length * 500;
        const estimatedPrompt = 200; // Base prompt for project generation

        return {
            prompt: estimatedPrompt,
            completion: estimatedCompletion,
            total: estimatedPrompt + estimatedCompletion,
        };
    }

    /**
     * Estimate cost based on token usage (Groq pricing)
     */
    private estimateCost(tokens: { prompt: number; completion: number }): number {
        // Groq llama-3.3-70b-versatile pricing (approximate)
        const inputCostPer1K = 0.0001;
        const outputCostPer1K = 0.0002;

        return (tokens.prompt / 1000) * inputCostPer1K + (tokens.completion / 1000) * outputCostPer1K;
    }

    /**
     * Get language from file path extension
     */
    private getLanguageFromPath(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown',
            '.sql': 'sql',
        };
        return languageMap[ext] || 'text';
    }

    /**
     * Log generation event to database
     */
    private async logToDatabase(request: CodeGenRequest, result: any, executionTime: number): Promise<void> {
        try {
            const dbClient = await checkSupabaseConnection();
            if (!dbClient.connected) return;

            // Get the admin client for database operations
            const { getSupabaseAdmin } = await import('./database-client.js');
            const supabase = getSupabaseAdmin();
            if (!supabase) return;

            // Log to audit_logs
            await supabase.from('audit_logs').insert({
                user_id: request.userId,
                action: 'codegen_project',
                resource_type: 'project',
                resource_id: request.projectId,
                details: {
                    projectName: request.config.projectName,
                    language: request.config.language || 'typescript',
                    framework: request.config.framework || 'express',
                    filesCreated: result.filesCreated?.length || 0,
                    success: result.success,
                    executionTime,
                },
            });
        } catch (error) {
            // Don't fail the main operation
            console.warn('[CODEGEN-SERVICE] Failed to log to database:', error);
        }
    }
}

// ============================================
// SINGLETON
// ============================================

let codeGenServiceInstance: CodeGenService | null = null;

export function getCodeGenService(): CodeGenService {
    if (!codeGenServiceInstance) {
        codeGenServiceInstance = new CodeGenService();
    }
    return codeGenServiceInstance;
}

export default getCodeGenService;
