/**
 * Frontend Analyzer Agent
 * 
 * An intelligent agent that analyzes frontend repositories to extract:
 * - Framework detection (React, Vue, Next.js, etc.)
 * - API call extraction (endpoints, methods, auth requirements)
 * - Data model inference (from TypeScript interfaces, Zod schemas, forms)
 * - Authentication strategy detection (Clerk, Auth0, Firebase, etc.)
 * - Route structure analysis
 * - Dependency mapping
 * 
 * This information is used to generate backend specifications and code.
 */

import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus,
    AgentTier,
} from '@loveable/shared';

import { FrameworkDetector } from './framework-detector.js';
import { APICallExtractor } from './api-extractor.js';
import { AuthDetector } from './auth-detector.js';
import { DataModelInferrer } from './model-inferrer.js';
import { RouteAnalyzer } from './route-analyzer.js';
import type {
    FrontendAnalysisResult,
    FrontendAnalyzerConfig,
    AuthProviderType
} from './types.js';

/**
 * Frontend Analyzer Agent
 * Tier 1 Core Agent - Essential for the analysis layer
 */
export class FrontendAnalyzerAgent implements IAgent {
    // ========================================
    // REQUIRED: Agent Identity
    // ========================================

    public readonly id = 'frontend-analyzer';
    public readonly name = 'Frontend Analyzer Agent';
    public readonly tier: AgentTier = 1;

    public readonly capabilities: string[] = [
        // Framework detection
        'framework-detection',
        'react-detection',
        'vue-detection',
        'next-detection',
        'nuxt-detection',
        'svelte-detection',
        'angular-detection',

        // API extraction
        'api-extraction',
        'endpoint-detection',
        'fetch-analysis',
        'axios-analysis',
        'swr-analysis',
        'react-query-analysis',

        // Data modeling
        'model-inference',
        'typescript-analysis',
        'zod-schema-analysis',
        'form-state-analysis',

        // Auth detection
        'auth-detection',
        'clerk-detection',
        'auth0-detection',
        'firebase-detection',
        'supabase-detection',
        'nextauth-detection',

        // Routing
        'route-analysis',
        'protected-route-detection',

        // Dependencies
        'dependency-analysis',
        'package-analysis',
    ];

    public readonly description =
        'Analyzes frontend repositories to extract backend requirements including ' +
        'framework detection, API endpoints, data models, authentication strategies, ' +
        'and routing structure.';

    public readonly version = '1.0.0';

    // ========================================
    // PRIVATE: Internal state
    // ========================================

    private initialized = false;
    private config: AgentConfig = {};

    // ========================================
    // REQUIRED: IAgent Methods
    // ========================================

    /**
     * Initialize the agent
     */
    async initialize(config: AgentConfig): Promise<void> {
        console.log(`[${this.name}] Initializing...`);
        this.config = config;
        this.initialized = true;
        console.log(`[${this.name}] Initialized successfully`);
    }

    /**
     * Execute analysis task
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        if (!this.initialized) {
            return {
                success: false,
                error: {
                    code: 'NOT_INITIALIZED',
                    message: 'Agent has not been initialized',
                },
            };
        }

        const startTime = Date.now();

        try {
            // Extract repository path from context or task
            const repoPath = this.extractRepoPath(input);

            if (!repoPath) {
                return {
                    success: false,
                    error: {
                        code: 'MISSING_PATH',
                        message: 'Repository path not provided. Include it in context.repositoryPath or specify in task.',
                    },
                };
            }

            console.log(`[${this.name}] Analyzing repository: ${repoPath}`);

            // Run the full analysis
            const analysisResult = await this.analyzeRepository({
                rootPath: repoPath,
                deepAnalysis: (input.context?.deepAnalysis as boolean) ?? true,
            });

            const executionTime = Date.now() - startTime;

            // Generate the output file with analysis results
            const analysisJson = JSON.stringify(analysisResult, null, 2);
            const analysisMd = this.generateMarkdownReport(analysisResult);

            return {
                success: true,
                message: `Successfully analyzed frontend repository. Found ${analysisResult.apiCalls.length} API calls, ${analysisResult.dataModels.length} data models, ${analysisResult.routes.length} routes.`,
                files: [
                    {
                        path: 'analysis/frontend-analysis.json',
                        content: analysisJson,
                        type: 'doc',
                        language: 'json',
                    },
                    {
                        path: 'analysis/frontend-analysis.md',
                        content: analysisMd,
                        type: 'doc',
                        language: 'markdown',
                    },
                ],
                metadata: {
                    executionTime,
                    framework: analysisResult.framework.type,
                    apiCallsFound: analysisResult.apiCalls.length,
                    modelsInferred: analysisResult.dataModels.length,
                    routesDetected: analysisResult.routes.length,
                    authProvider: analysisResult.authStrategy.provider,
                    analysisResult, // Include full result in metadata for downstream agents
                },
                suggestedNextAgents: this.suggestNextAgents(analysisResult),
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'ANALYSIS_ERROR',
                    message: errorMessage,
                    details: error,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                },
            };
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<AgentHealthStatus> {
        return {
            healthy: this.initialized,
            message: this.initialized
                ? 'Frontend Analyzer Agent is healthy and ready'
                : 'Agent not initialized',
            details: {
                version: this.version,
                capabilities: this.capabilities.length,
            },
        };
    }

    /**
     * Shutdown
     */
    async shutdown(): Promise<void> {
        console.log(`[${this.name}] Shutting down...`);
        this.initialized = false;
    }

    // ========================================
    // PRIVATE: Analysis Methods
    // ========================================

    /**
     * Extract repository path from input
     */
    private extractRepoPath(input: AgentInput): string | null {
        // Check context first
        if (input.context?.repositoryPath) {
            return input.context.repositoryPath as string;
        }
        if (input.context?.path) {
            return input.context.path as string;
        }
        if (input.context?.rootPath) {
            return input.context.rootPath as string;
        }

        // Try to extract from task description
        const pathMatch = input.task.match(/(?:analyze|path|repo(?:sitory)?)\s*[:\s]+([^\s,]+)/i);
        if (pathMatch) {
            return pathMatch[1];
        }

        return null;
    }

    /**
     * Run the complete frontend analysis
     */
    async analyzeRepository(config: FrontendAnalyzerConfig): Promise<FrontendAnalysisResult> {
        const { rootPath } = config;

        console.log(`[${this.name}] Starting analysis of ${rootPath}`);

        // 1. Detect framework
        console.log(`[${this.name}] Detecting framework...`);
        const frameworkDetector = new FrameworkDetector(rootPath);
        const framework = await frameworkDetector.detect();
        const dependencies = await frameworkDetector.getDependencies();

        console.log(`[${this.name}] Detected: ${framework.type} (confidence: ${framework.confidence.toFixed(2)})`);

        // 2. Extract API calls
        console.log(`[${this.name}] Extracting API calls...`);
        const apiExtractor = new APICallExtractor(rootPath);
        const apiCalls = await apiExtractor.extract();
        console.log(`[${this.name}] Found ${apiCalls.length} API calls`);

        // 3. Detect auth strategy
        console.log(`[${this.name}] Detecting authentication strategy...`);
        const authDetector = new AuthDetector(rootPath);
        const authStrategy = await authDetector.detect();
        console.log(`[${this.name}] Auth provider: ${authStrategy.provider}`);

        // 4. Infer data models
        console.log(`[${this.name}] Inferring data models...`);
        const modelInferrer = new DataModelInferrer(rootPath);
        const dataModels = await modelInferrer.infer();
        console.log(`[${this.name}] Inferred ${dataModels.length} data models`);

        // 5. Analyze routes
        console.log(`[${this.name}] Analyzing routes...`);
        const routeAnalyzer = new RouteAnalyzer(rootPath, framework.type);
        const routes = await routeAnalyzer.analyze();
        console.log(`[${this.name}] Found ${routes.length} routes`);

        // 6. Generate suggestions
        const suggestions = this.generateSuggestions(framework, authStrategy, apiCalls);

        // Count files analyzed
        const stats = {
            totalFiles: 0,
            jsxFiles: 0,
            tsFiles: 0,
            apiCallsFound: apiCalls.length,
            modelsInferred: dataModels.length,
            routesDetected: routes.length,
        };

        return {
            analyzedAt: new Date(),
            repositoryPath: rootPath,
            framework,
            apiCalls,
            dataModels,
            authStrategy,
            routes,
            dependencies,
            filesAnalyzed: stats.totalFiles,
            stats,
            warnings: this.generateWarnings(framework, authStrategy, apiCalls),
            suggestions,
        };
    }

    /**
     * Generate suggestions based on analysis
     */
    private generateSuggestions(
        framework: FrontendAnalysisResult['framework'],
        authStrategy: FrontendAnalysisResult['authStrategy'],
        apiCalls: FrontendAnalysisResult['apiCalls']
    ): FrontendAnalysisResult['suggestions'] {
        // Recommend database
        let recommendedDatabase: 'postgresql' | 'mysql' | 'mongodb' = 'postgresql';

        // Recommend ORM
        let recommendedOrm: 'prisma' | 'drizzle' | 'typeorm' = 'prisma';

        // Recommend auth (use detected or suggest)
        let recommendedAuth: AuthProviderType = authStrategy.provider;
        if (recommendedAuth === 'none' || recommendedAuth === 'unknown') {
            // Suggest based on framework
            if (framework.type === 'next') {
                recommendedAuth = 'nextauth';
            } else {
                recommendedAuth = 'clerk';
            }
        }

        // Recommend API style
        let apiStyle: 'rest' | 'graphql' | 'trpc' = 'rest';
        const hasTrpc = apiCalls.some(c => c.library === 'trpc');
        const hasGraphQL = apiCalls.some(c => c.library === 'apollo' || c.library === 'urql');
        if (hasTrpc) apiStyle = 'trpc';
        else if (hasGraphQL) apiStyle = 'graphql';

        return {
            recommendedDatabase,
            recommendedOrm,
            recommendedAuth,
            apiStyle,
        };
    }

    /**
     * Generate warnings for potential issues
     */
    private generateWarnings(
        framework: FrontendAnalysisResult['framework'],
        authStrategy: FrontendAnalysisResult['authStrategy'],
        apiCalls: FrontendAnalysisResult['apiCalls']
    ): string[] {
        const warnings: string[] = [];

        if (framework.confidence < 0.5) {
            warnings.push('Low confidence in framework detection. Please verify manually.');
        }

        if (authStrategy.provider === 'unknown' && authStrategy.confidence < 0.3) {
            warnings.push('Could not detect authentication strategy. Backend will need auth configuration.');
        }

        if (apiCalls.length === 0) {
            warnings.push('No API calls detected. The frontend may use SSR data fetching or a different pattern.');
        }

        const unauthenticatedPosts = apiCalls.filter(
            c => (c.method === 'POST' || c.method === 'PUT' || c.method === 'DELETE') && !c.requiresAuth
        );
        if (unauthenticatedPosts.length > 0) {
            warnings.push(`${unauthenticatedPosts.length} mutation endpoints appear to lack authentication.`);
        }

        return warnings;
    }

    /**
     * Suggest next agents based on analysis
     */
    private suggestNextAgents(result: FrontendAnalysisResult): string[] {
        const suggestions: string[] = ['specification-generator'];

        if (result.dataModels.length > 0) {
            suggestions.push('database-agent');
        }

        if (result.authStrategy.provider !== 'none') {
            suggestions.push('auth-agent');
        }

        if (result.apiCalls.length > 0) {
            suggestions.push('api-agent');
        }

        suggestions.push('security-agent');

        return suggestions;
    }

    /**
     * Generate a Markdown report of the analysis
     */
    private generateMarkdownReport(result: FrontendAnalysisResult): string {
        const lines: string[] = [
            '# Frontend Analysis Report',
            '',
            `**Analyzed:** ${result.repositoryPath}`,
            `**Date:** ${result.analyzedAt.toISOString()}`,
            '',
            '---',
            '',
            '## Framework Detection',
            '',
            `| Property | Value |`,
            `|----------|-------|`,
            `| Framework | ${result.framework.type} |`,
            `| Version | ${result.framework.version || 'N/A'} |`,
            `| TypeScript | ${result.framework.usesTypeScript ? 'Yes' : 'No'} |`,
            `| Build Tool | ${result.framework.buildTool || 'N/A'} |`,
            `| UI Library | ${result.framework.uiLibrary || 'N/A'} |`,
            `| State Management | ${result.framework.stateManagement || 'N/A'} |`,
            `| Confidence | ${(result.framework.confidence * 100).toFixed(0)}% |`,
            '',
            '---',
            '',
            '## Authentication',
            '',
            `| Property | Value |`,
            `|----------|-------|`,
            `| Provider | ${result.authStrategy.provider} |`,
            `| Package | ${result.authStrategy.packageName || 'N/A'} |`,
            `| Social Login | ${result.authStrategy.features.socialLogin ? 'Yes' : 'No'} |`,
            `| MFA | ${result.authStrategy.features.mfa ? 'Yes' : 'No'} |`,
            `| Token Storage | ${result.authStrategy.tokenStorage} |`,
            '',
        ];

        // API Calls section
        if (result.apiCalls.length > 0) {
            lines.push('---', '', '## API Calls', '');
            lines.push('| Method | Endpoint | Library | Auth Required |');
            lines.push('|--------|----------|---------|---------------|');
            for (const call of result.apiCalls.slice(0, 20)) {
                lines.push(`| ${call.method} | \`${call.endpoint}\` | ${call.library} | ${call.requiresAuth ? 'Yes' : 'No'} |`);
            }
            if (result.apiCalls.length > 20) {
                lines.push(``, `*... and ${result.apiCalls.length - 20} more*`);
            }
            lines.push('');
        }

        // Data Models section
        if (result.dataModels.length > 0) {
            lines.push('---', '', '## Inferred Data Models', '');
            for (const model of result.dataModels.slice(0, 10)) {
                lines.push(`### ${model.name}`, '');
                lines.push('| Field | Type | Optional |');
                lines.push('|-------|------|----------|');
                for (const field of model.fields.slice(0, 10)) {
                    const typeStr = field.type === 'array' ? `${field.arrayType}[]` : field.type;
                    lines.push(`| ${field.name} | ${typeStr} | ${field.optional ? 'Yes' : 'No'} |`);
                }
                if (model.relationships.length > 0) {
                    lines.push('', '**Relationships:**');
                    for (const rel of model.relationships) {
                        lines.push(`- ${rel.fieldName} → ${rel.targetModel} (${rel.type})`);
                    }
                }
                lines.push('');
            }
        }

        // Routes section
        if (result.routes.length > 0) {
            lines.push('---', '', '## Routes', '');
            lines.push('| Path | Dynamic | Protected |');
            lines.push('|------|---------|-----------|');
            for (const route of result.routes.slice(0, 20)) {
                lines.push(`| \`${route.path}\` | ${route.isDynamic ? 'Yes' : 'No'} | ${route.isProtected ? 'Yes' : 'No'} |`);
            }
            lines.push('');
        }

        // Suggestions section
        lines.push('---', '', '## Recommendations', '');
        lines.push(`- **Database:** ${result.suggestions.recommendedDatabase}`);
        lines.push(`- **ORM:** ${result.suggestions.recommendedOrm}`);
        lines.push(`- **Auth Provider:** ${result.suggestions.recommendedAuth}`);
        lines.push(`- **API Style:** ${result.suggestions.apiStyle}`);
        lines.push('');

        // Warnings section
        if (result.warnings.length > 0) {
            lines.push('---', '', '## Warnings', '');
            for (const warning of result.warnings) {
                lines.push(`- ⚠️ ${warning}`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }
}

// Export singleton instance
export const frontendAnalyzerAgent = new FrontendAnalyzerAgent();
export default frontendAnalyzerAgent;
