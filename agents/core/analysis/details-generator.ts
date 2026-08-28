/**
 * Details Generator
 * 
 * Generates a structured `details.md` specification file from the frontend analysis.
 * This file serves as the input for the orchestrator to distribute tasks to agents.
 * 
 * Output sections:
 * - Project Overview
 * - Authentication Requirements
 * - Database/Models
 * - API Endpoints
 * - Deployment Configuration
 * - Agent Task Summary
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
    FrontendAnalysisResult,
    InferredModel,
    ExtractedAPICall,
    DetectedAuthStrategy,
    RouteInfo,
    DependencyInfo,
} from './types.js';
import type { LLMEnhancedAnalysis } from './llm-analyzer.js';

// ============================================
// TYPES
// ============================================

export interface DetailsGeneratorConfig {
    /** The analysis result from Frontend Analyzer */
    analysisResult: FrontendAnalysisResult;

    /** Output directory for details.md */
    outputDir: string;

    /** Include JSON report alongside MD */
    includeJsonReport?: boolean;

    /** Repository metadata */
    repoMetadata?: {
        name: string;
        owner: string;
        url: string;
        branch: string;
    };

    /** LLM-enhanced analysis (optional) */
    llmAnalysis?: LLMEnhancedAnalysis;
}

export interface GeneratedDetails {
    /** Path to the generated details.md */
    detailsPath: string;

    /** Path to the JSON report (if generated) */
    jsonReportPath?: string;

    /** Summary of what was generated */
    summary: {
        authRequired: boolean;
        modelsCount: number;
        endpointsCount: number;
        routesCount: number;
        agentsNeeded: string[];
    };
}

// ============================================
// DETAILS GENERATOR
// ============================================

export class DetailsGenerator {
    private config: DetailsGeneratorConfig;

    constructor(config: DetailsGeneratorConfig) {
        this.config = config;
    }

    /**
     * Generate the complete details.md file
     */
    async generate(): Promise<GeneratedDetails> {
        const { analysisResult, outputDir } = this.config;

        // Ensure output directory exists
        await fs.promises.mkdir(outputDir, { recursive: true });

        // Build the markdown content
        const content = this.buildMarkdownContent();

        // Write details.md
        const detailsPath = path.join(outputDir, 'details.md');
        await fs.promises.writeFile(detailsPath, content, 'utf-8');
        console.log(`[DetailsGenerator] Generated: ${detailsPath}`);

        // Optionally write JSON report
        let jsonReportPath: string | undefined;
        if (this.config.includeJsonReport) {
            jsonReportPath = path.join(outputDir, 'analysis-report.json');
            try {
                // Create a serializable copy of the result
                // Shape mirrors FrontendAnalysisResult so the orchestrator's
                // analysis-loader-agent can re-ingest this report directly.
                const serializableResult = {
                    repositoryPath: analysisResult.repositoryPath,
                    framework: analysisResult.framework,
                    authStrategy: {
                        provider: analysisResult.authStrategy.provider,
                        packageName: analysisResult.authStrategy.packageName,
                        version: analysisResult.authStrategy.version,
                        features: analysisResult.authStrategy.features,
                        tokenStorage: analysisResult.authStrategy.tokenStorage,
                        protectedRoutes: analysisResult.authStrategy.protectedRoutes,
                    },
                    apiCalls: analysisResult.apiCalls.map(call => ({
                        endpoint: call.endpoint,
                        method: call.method,
                        library: call.library,
                        sourceFile: call.sourceFile,
                        lineNumber: call.lineNumber,
                        requiresAuth: call.requiresAuth,
                    })),
                    dataModels: analysisResult.dataModels.map(model => ({
                        name: model.name,
                        confidence: model.confidence,
                        primaryKey: model.primaryKey,
                        relationships: model.relationships.slice(0, 10), // Limit relationships
                        fields: model.fields.slice(0, 20), // Limit fields
                        sources: model.sources.slice(0, 3), // Limit sources
                    })),
                    routes: analysisResult.routes.map(route => ({
                        path: route.path,
                        componentFile: route.componentFile,
                        isDynamic: route.isDynamic,
                        isProtected: route.isProtected,
                    })),
                    // Dependencies is an array, simplify it
                    dependencies: analysisResult.dependencies.slice(0, 50).map(dep => ({
                        name: dep.name,
                        version: dep.version,
                        category: dep.category,
                    })),
                    analyzedAt: analysisResult.analyzedAt?.toISOString?.() || new Date().toISOString(),
                    suggestions: analysisResult.suggestions,
                };

                await fs.promises.writeFile(
                    jsonReportPath,
                    JSON.stringify(serializableResult, null, 2),
                    'utf-8'
                );
                console.log(`[DetailsGenerator] Generated: ${jsonReportPath}`);
            } catch (jsonError) {
                console.warn(`[DetailsGenerator] Warning: Could not generate JSON report: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
                jsonReportPath = undefined; // Mark as not created
            }
        }

        // Determine which agents are needed
        const agentsNeeded = this.determineAgentsNeeded();

        return {
            detailsPath,
            jsonReportPath,
            summary: {
                authRequired: analysisResult.authStrategy.provider !== 'none',
                modelsCount: analysisResult.dataModels.length,
                endpointsCount: analysisResult.apiCalls.length,
                routesCount: analysisResult.routes.length,
                agentsNeeded,
            },
        };
    }

    /**
     * Build the markdown content
     */
    private buildMarkdownContent(): string {
        const { analysisResult, repoMetadata, llmAnalysis } = this.config;
        const sections: string[] = [];

        // Header
        sections.push(this.buildHeader(repoMetadata));

        // LLM Enhanced Spec (if available) - at the top for visibility
        if (llmAnalysis) {
            sections.push(this.buildLLMSpecSection(llmAnalysis));
        }

        // Overview
        sections.push(this.buildOverview(analysisResult));

        // LLM Component Summaries (if available)
        if (llmAnalysis && llmAnalysis.componentSummaries.length > 0) {
            sections.push(this.buildComponentSummariesSection(llmAnalysis));
        }

        // Authentication
        sections.push(this.buildAuthSection(analysisResult.authStrategy));

        // Database/Models
        sections.push(this.buildDatabaseSection(analysisResult.dataModels));

        // LLM Model Relationships (if available)
        if (llmAnalysis && llmAnalysis.modelRelationships.length > 0) {
            sections.push(this.buildModelRelationshipsSection(llmAnalysis));
        }

        // API Endpoints
        sections.push(this.buildApiSection(analysisResult.apiCalls));

        // LLM API Contracts (if available)
        if (llmAnalysis && llmAnalysis.apiContracts.length > 0) {
            sections.push(this.buildAPIContractsSection(llmAnalysis));
        }

        // Routes
        sections.push(this.buildRoutesSection(analysisResult.routes));

        // Dependencies
        sections.push(this.buildDependenciesSection(analysisResult.dependencies));

        // Agent Tasks Summary
        sections.push(this.buildAgentTasksSection());

        return sections.join('\n\n---\n\n');
    }

    /**
     * Build header section
     */
    private buildHeader(repoMetadata?: DetailsGeneratorConfig['repoMetadata']): string {
        const lines = [
            '# Backend Requirements Specification',
            '',
            `> Generated by Meteoroid AI-Powered Backend Generator`,
            `> Date: ${new Date().toISOString()}`,
        ];

        if (repoMetadata) {
            lines.push('');
            lines.push('## Repository Info');
            lines.push(`- **Name:** ${repoMetadata.owner}/${repoMetadata.name}`);
            lines.push(`- **URL:** ${repoMetadata.url}`);
            lines.push(`- **Branch:** ${repoMetadata.branch}`);
        }

        return lines.join('\n');
    }

    // ============================================
    // LLM ENHANCED SECTIONS
    // ============================================

    /**
     * Build LLM-generated specification section
     */
    private buildLLMSpecSection(llm: LLMEnhancedAnalysis): string {
        const spec = llm.enhancedSpec;
        const lines = [
            '## 🧠 AI-Enhanced Project Analysis',
            '',
            `**App Type:** ${spec.appType}`,
            '',
            '### Project Overview',
            spec.projectOverview,
            '',
            '### Key Features Required',
        ];

        for (const feature of spec.keyFeatures) {
            lines.push(`- ${feature}`);
        }

        lines.push('');
        lines.push('### Data Flow');
        lines.push(spec.dataFlowSummary);

        lines.push('');
        lines.push('### Security Requirements');
        for (const req of spec.securityRequirements) {
            lines.push(`- ${req}`);
        }

        lines.push('');
        lines.push('### Suggested Architecture');
        lines.push(spec.suggestedArchitecture);

        return lines.join('\n');
    }

    /**
     * Build component summaries section
     */
    private buildComponentSummariesSection(llm: LLMEnhancedAnalysis): string {
        const lines = [
            '## 📦 Component Analysis',
            '',
            '| Component | Purpose | State Management |',
            '|-----------|---------|------------------|',
        ];

        for (const comp of llm.componentSummaries.slice(0, 15)) {
            const state = comp.stateManagement || 'None';
            lines.push(`| ${comp.componentName} | ${comp.purpose.slice(0, 60)} | ${state} |`);
        }

        return lines.join('\n');
    }

    /**
     * Build model relationships section
     */
    private buildModelRelationshipsSection(llm: LLMEnhancedAnalysis): string {
        const lines = [
            '## 🔗 Model Relationships',
            '',
        ];

        for (const rel of llm.modelRelationships) {
            lines.push(`- **${rel.sourceModel}** → ${rel.targetModel} (${rel.relationshipType})`);
            lines.push(`  - *${rel.description}*`);
        }

        return lines.join('\n');
    }

    /**
     * Build API contracts section
     */
    private buildAPIContractsSection(llm: LLMEnhancedAnalysis): string {
        const lines = [
            '## 📋 Inferred API Contracts',
            '',
        ];

        for (const contract of llm.apiContracts.slice(0, 10)) {
            lines.push(`### \`${contract.method} ${contract.endpoint}\``);
            lines.push('');
            lines.push(`**Description:** ${contract.description}`);
            lines.push(`**Auth Required:** ${contract.authRequired ? 'Yes 🔒' : 'No'}`);

            if (Object.keys(contract.requestSchema).length > 0) {
                lines.push('');
                lines.push('**Request Body:**');
                lines.push('```json');
                lines.push(JSON.stringify(contract.requestSchema, null, 2));
                lines.push('```');
            }

            if (Object.keys(contract.responseSchema).length > 0) {
                lines.push('');
                lines.push('**Response:**');
                lines.push('```json');
                lines.push(JSON.stringify(contract.responseSchema, null, 2));
                lines.push('```');
            }

            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Build overview section
     */
    private buildOverview(result: FrontendAnalysisResult): string {
        const lines = [
            '## Overview',
            '',
            '| Metric | Value |',
            '|--------|-------|',
            `| Framework | ${result.framework.type} |`,
            `| TypeScript | ${result.framework.usesTypeScript ? 'Yes' : 'No'} |`,
            `| UI Library | ${result.framework.uiLibrary || 'None detected'} |`,
            `| State Management | ${result.framework.stateManagement || 'None detected'} |`,
            `| Build Tool | ${result.framework.buildTool || 'Unknown'} |`,
            '',
            '### Quick Stats',
            `- **API Endpoints Found:** ${result.apiCalls.length}`,
            `- **Data Models Inferred:** ${result.dataModels.length}`,
            `- **Routes Detected:** ${result.routes.length}`,
            `- **Protected Routes:** ${result.routes.filter(r => r.isProtected).length}`,
        ];

        if (result.warnings.length > 0) {
            lines.push('', '### Warnings');
            for (const warning of result.warnings) {
                lines.push(`- ⚠️ ${warning}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Build authentication section
     */
    private buildAuthSection(auth: DetectedAuthStrategy): string {
        const lines = [
            '## Authentication Requirements',
            '',
        ];

        if (auth.provider === 'none' || auth.provider === 'unknown') {
            lines.push('> No authentication provider detected. Backend will need auth configuration.');
            lines.push('');
            lines.push('### Recommended Setup');
            lines.push('- **Provider:** Clerk or NextAuth.js');
            lines.push('- **Features:** Email/password, OAuth (Google, GitHub)');
        } else {
            lines.push(`### Detected Provider: \`${auth.provider}\``);
            if (auth.packageName) {
                lines.push(`- **Package:** ${auth.packageName} (${auth.version || 'unknown version'})`);
            }
            lines.push('');

            // Features
            lines.push('### Features Detected');
            lines.push(`- Social Login: ${auth.features.socialLogin ? '✅' : '❌'}`);
            lines.push(`- Email/Password: ${auth.features.emailPassword ? '✅' : '❌'}`);
            lines.push(`- Magic Link: ${auth.features.magicLink ? '✅' : '❌'}`);
            lines.push(`- Phone Auth: ${auth.features.phoneAuth ? '✅' : '❌'}`);
            lines.push(`- MFA: ${auth.features.mfa ? '✅' : '❌'}`);
            lines.push(`- SSO: ${auth.features.sso ? '✅' : '❌'}`);
        }

        // Protected routes
        if (auth.protectedRoutes.length > 0) {
            lines.push('');
            lines.push('### Protected Routes');
            for (const route of auth.protectedRoutes) {
                lines.push(`- \`${route}\``);
            }
        }

        // Token storage
        lines.push('');
        lines.push(`### Token Storage: \`${auth.tokenStorage}\``);

        return lines.join('\n');
    }

    /**
     * Build database/models section
     */
    private buildDatabaseSection(models: InferredModel[]): string {
        const lines = [
            '## Database Schema',
            '',
        ];

        if (models.length === 0) {
            lines.push('> No data models detected. Will need manual schema definition.');
            return lines.join('\n');
        }

        lines.push(`### Models (${models.length} total)`);
        lines.push('');

        for (const model of models) {
            lines.push(`#### ${model.name}`);
            lines.push('');

            if (model.fields.length > 0) {
                lines.push('| Field | Type | Optional | Notes |');
                lines.push('|-------|------|----------|-------|');

                for (const field of model.fields) {
                    const typeStr = field.type === 'array'
                        ? `${field.arrayType || 'unknown'}[]`
                        : field.type;
                    const isPrimaryKey = model.primaryKey === field.name;
                    const notes = isPrimaryKey ? 'Primary Key' : '';
                    lines.push(`| ${field.name} | ${typeStr} | ${field.optional ? 'Yes' : 'No'} | ${notes} |`);
                }
            }

            // Relationships
            if (model.relationships.length > 0) {
                lines.push('');
                lines.push('**Relationships:**');
                for (const rel of model.relationships) {
                    lines.push(`- \`${rel.fieldName}\` → ${rel.targetModel} (${rel.type})`);
                }
            }

            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Build API endpoints section
     */
    private buildApiSection(apiCalls: ExtractedAPICall[]): string {
        const lines = [
            '## API Endpoints',
            '',
        ];

        if (apiCalls.length === 0) {
            lines.push('> No API calls detected. Frontend may use SSR data fetching.');
            return lines.join('\n');
        }

        // Group by base path
        const grouped = new Map<string, ExtractedAPICall[]>();
        for (const call of apiCalls) {
            const basePath = call.endpoint.split('/').slice(0, 3).join('/');
            const existing = grouped.get(basePath) || [];
            existing.push(call);
            grouped.set(basePath, existing);
        }

        lines.push(`### Endpoints (${apiCalls.length} total)`);
        lines.push('');
        lines.push('| Method | Endpoint | Auth Required | Source |');
        lines.push('|--------|----------|---------------|--------|');

        for (const call of apiCalls) {
            const authBadge = call.requiresAuth ? '🔒' : '🔓';
            const source = call.sourceFile ? path.basename(call.sourceFile) : '-';
            lines.push(`| \`${call.method}\` | \`${call.endpoint}\` | ${authBadge} | ${source} |`);
        }

        // Path parameters summary
        const endpointsWithParams = apiCalls.filter(c => c.pathParams && c.pathParams.length > 0);
        if (endpointsWithParams.length > 0) {
            lines.push('');
            lines.push('### Dynamic Parameters');
            for (const call of endpointsWithParams) {
                lines.push(`- \`${call.endpoint}\`: ${call.pathParams?.join(', ')}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Build routes section
     */
    private buildRoutesSection(routes: RouteInfo[]): string {
        const lines = [
            '## Frontend Routes',
            '',
        ];

        if (routes.length === 0) {
            lines.push('> No routes detected.');
            return lines.join('\n');
        }

        lines.push('| Route | Dynamic | Protected | Component |');
        lines.push('|-------|---------|-----------|-----------|');

        for (const route of routes) {
            const component = route.componentFile ? path.basename(route.componentFile) : '-';
            lines.push(`| \`${route.path}\` | ${route.isDynamic ? 'Yes' : 'No'} | ${route.isProtected ? '🔒' : '-'} | ${component} |`);
        }

        return lines.join('\n');
    }

    /**
     * Build dependencies section
     */
    private buildDependenciesSection(deps: DependencyInfo[]): string {
        const lines = [
            '## Key Dependencies',
            '',
        ];

        if (deps.length === 0) {
            lines.push('> No relevant dependencies detected.');
            return lines.join('\n');
        }

        // Group by category
        const categories = {
            framework: deps.filter(d => d.category === 'framework'),
            'ui-library': deps.filter(d => d.category === 'ui-library'),
            'state-management': deps.filter(d => d.category === 'state-management'),
            'data-fetching': deps.filter(d => d.category === 'data-fetching'),
            auth: deps.filter(d => d.category === 'auth'),
            other: deps.filter(d => !d.category || d.category === 'other'),
        };

        for (const [category, items] of Object.entries(categories)) {
            if (items.length > 0) {
                const displayName = category
                    .split('-')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
                lines.push(`### ${displayName}`);
                for (const dep of items) {
                    lines.push(`- \`${dep.name}\` (${dep.version})`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    /**
     * Build agent tasks section
     */
    private buildAgentTasksSection(): string {
        const agentsNeeded = this.determineAgentsNeeded();
        const { analysisResult } = this.config;

        const lines = [
            '## Agent Task Distribution',
            '',
            '> The orchestrator will create individual task files for each agent.',
            '',
        ];

        for (const agent of agentsNeeded) {
            lines.push(`### ${agent}`);

            switch (agent) {
                case 'auth-agent':
                    lines.push(`- Provider: ${analysisResult.authStrategy.provider}`);
                    lines.push(`- Protected routes: ${analysisResult.authStrategy.protectedRoutes.length}`);
                    lines.push(`- Output: Middleware, guards, session handling`);
                    break;

                case 'database-agent':
                    lines.push(`- Models: ${analysisResult.dataModels.length}`);
                    lines.push(`- ORM: ${analysisResult.suggestions.recommendedOrm}`);
                    lines.push(`- Database: ${analysisResult.suggestions.recommendedDatabase}`);
                    lines.push(`- Output: Prisma schema, migrations, seed data`);
                    break;

                case 'api-agent':
                    lines.push(`- Endpoints: ${analysisResult.apiCalls.length}`);
                    lines.push(`- Style: ${analysisResult.suggestions.apiStyle}`);
                    lines.push(`- Output: Express routes, controllers, validation`);
                    break;

                case 'security-agent':
                    lines.push(`- CORS configuration`);
                    lines.push(`- Rate limiting`);
                    lines.push(`- Input validation`);
                    lines.push(`- Output: Security middleware`);
                    break;

                case 'cicd-agent':
                    lines.push(`- Dockerfile`);
                    lines.push(`- GitHub Actions workflow`);
                    lines.push(`- Output: CI/CD pipeline configuration`);
                    break;
            }

            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Determine which agents are needed based on analysis
     */
    private determineAgentsNeeded(): string[] {
        const { analysisResult } = this.config;
        const agents: string[] = [];

        // Database agent - always needed if models exist
        if (analysisResult.dataModels.length > 0) {
            agents.push('database-agent');
        }

        // Auth agent - if auth detected or protected routes exist
        if (
            analysisResult.authStrategy.provider !== 'none' ||
            analysisResult.authStrategy.protectedRoutes.length > 0
        ) {
            agents.push('auth-agent');
        }

        // API agent - if endpoints detected
        if (analysisResult.apiCalls.length > 0) {
            agents.push('api-agent');
        }

        // Security agent - always needed
        agents.push('security-agent');

        // CI/CD agent - always included for deployment
        agents.push('cicd-agent');

        return agents;
    }
}

export default DetailsGenerator;
