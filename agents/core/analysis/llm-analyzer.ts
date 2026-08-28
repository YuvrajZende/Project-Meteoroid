/**
 * LLM Analyzer
 * 
 * Uses LLM (Groq/OpenAI/ZAI) to enhance pattern-based analysis:
 * - Summarize component purposes
 * - Infer full API contracts
 * - Understand model relationships
 * - Generate enhanced backend specifications
 */

import { ChatGroq } from '@langchain/groq';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import * as fs from 'fs';
import * as path from 'path';
import type {
    ExtractedAPICall,
    InferredModel,
    FrontendAnalysisResult,
} from './types.js';

// ============================================
// TYPES
// ============================================

export interface ComponentSummary {
    filePath: string;
    componentName: string;
    purpose: string;
    dependencies: string[];
    stateManagement: string | null;
    apiCalls: string[];
}

export interface APIContract {
    endpoint: string;
    method: string;
    description: string;
    requestSchema: Record<string, unknown>;
    responseSchema: Record<string, unknown>;
    authRequired: boolean;
    rateLimit?: string;
}

export interface ModelRelationship {
    sourceModel: string;
    targetModel: string;
    relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
    foreignKey: string;
    description: string;
}

export interface EnhancedSpecification {
    projectOverview: string;
    appType: string;
    keyFeatures: string[];
    dataFlowSummary: string;
    securityRequirements: string[];
    scalabilityNotes: string[];
    suggestedArchitecture: string;
}

export interface LLMEnhancedAnalysis {
    componentSummaries: ComponentSummary[];
    apiContracts: APIContract[];
    modelRelationships: ModelRelationship[];
    enhancedSpec: EnhancedSpecification;
    analysisNotes: string[];
}

// ============================================
// LLM ANALYZER CLASS
// ============================================

export class LLMAnalyzer {
    private llm: ChatGroq | ChatOpenAI;
    private provider: 'groq' | 'openai' | 'zai';

    constructor() {
        // Determine which LLM to use based on available API keys
        if (process.env.GROQ_API_KEY) {
            this.provider = 'groq';
            this.llm = new ChatGroq({
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
            });
        } else if (process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY) {
            // ZAI uses OpenAI-compatible API
            const isZai = !!process.env.ZAI_API_KEY;
            this.provider = isZai ? 'zai' : 'openai';
            this.llm = new ChatOpenAI({
                modelName: isZai ? 'glm-4' : 'gpt-4o-mini',
                temperature: 0.3,
                openAIApiKey: process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY,
                configuration: isZai ? {
                    baseURL: 'https://api.z.ai/api/coding/paas/v4',
                } : undefined,
            });
        } else {
            throw new Error('No LLM API key found. Set GROQ_API_KEY, ZAI_API_KEY, or OPENAI_API_KEY');
        }

        console.log(`[LLM Analyzer] Using ${this.provider.toUpperCase()} for analysis`);
    }

    /**
     * Run complete LLM-enhanced analysis
     */
    async analyze(
        patternAnalysis: FrontendAnalysisResult,
        rootPath: string
    ): Promise<LLMEnhancedAnalysis> {
        console.log('[LLM Analyzer] Starting enhanced analysis...');

        // 1. Get key component files to analyze
        const keyFiles = await this.findKeyComponentFiles(rootPath);
        console.log(`[LLM Analyzer] Found ${keyFiles.length} key components`);

        // 2. Summarize components
        console.log('[LLM Analyzer] Summarizing components...');
        const componentSummaries = await this.summarizeComponents(keyFiles, rootPath);

        // 3. Infer API contracts
        console.log('[LLM Analyzer] Inferring API contracts...');
        const apiContracts = await this.inferAPIContracts(patternAnalysis.apiCalls);

        // 4. Analyze model relationships
        console.log('[LLM Analyzer] Analyzing model relationships...');
        const modelRelationships = await this.analyzeModelRelationships(patternAnalysis.dataModels);

        // 5. Generate enhanced specification
        console.log('[LLM Analyzer] Generating enhanced specification...');
        const enhancedSpec = await this.generateEnhancedSpec(patternAnalysis, componentSummaries);

        return {
            componentSummaries,
            apiContracts,
            modelRelationships,
            enhancedSpec,
            analysisNotes: [
                `Analyzed ${keyFiles.length} key components`,
                `Inferred ${apiContracts.length} API contracts`,
                `Found ${modelRelationships.length} model relationships`,
                `Provider: ${this.provider}`,
            ],
        };
    }

    /**
     * Find key component files to analyze
     */
    private async findKeyComponentFiles(rootPath: string): Promise<string[]> {
        const keyFiles: string[] = [];
        const priorityPatterns = [
            /page\.(tsx?|jsx?)$/,
            /App\.(tsx?|jsx?)$/,
            /index\.(tsx?|jsx?)$/,
            /layout\.(tsx?|jsx?)$/,
            /api\/.*\.(ts|js)$/,
            /hooks\/.*\.(ts|js)$/,
            /context\/.*\.(tsx?|jsx?)$/,
            /store.*\.(ts|js)$/,
        ];

        const scanDir = async (dir: string): Promise<void> => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
                            await scanDir(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const relativePath = path.relative(rootPath, fullPath);
                        if (priorityPatterns.some(p => p.test(relativePath))) {
                            keyFiles.push(fullPath);
                        }
                    }
                }
            } catch { /* ignore errors */ }
        };

        await scanDir(rootPath);

        // Limit to top 15 files to avoid LLM context limits
        return keyFiles.slice(0, 15);
    }

    /**
     * Summarize what each key component does
     */
    async summarizeComponents(filePaths: string[], rootPath: string): Promise<ComponentSummary[]> {
        const summaries: ComponentSummary[] = [];

        // Process in batches to reduce API calls
        const fileContents = filePaths.map(fp => {
            try {
                const content = fs.readFileSync(fp, 'utf-8');
                // Truncate long files
                return {
                    path: path.relative(rootPath, fp),
                    content: content.length > 3000 ? content.slice(0, 3000) + '\n// ... truncated' : content,
                };
            } catch {
                return null;
            }
        }).filter(Boolean);

        if (fileContents.length === 0) return summaries;

        const prompt = `Analyze these React/Next.js components and provide a JSON array of summaries.

For each file, return:
- filePath: the file path
- componentName: main component/function name
- purpose: 1-2 sentence description of what it does
- dependencies: key imports used
- stateManagement: state management used (useState, Redux, Zustand, etc.) or null
- apiCalls: list of API endpoints called

FILES:
${fileContents.map(f => `=== ${f!.path} ===\n${f!.content}`).join('\n\n')}

Return ONLY valid JSON array, no markdown:`;

        try {
            const response = await this.llm.invoke([
                new SystemMessage('You are a code analyzer. Return only valid JSON, no explanations.'),
                new HumanMessage(prompt),
            ]);

            const text = response.content as string;
            // Extract JSON from response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed as ComponentSummary[];
            }
        } catch (error) {
            console.error('[LLM Analyzer] Component summary error:', error);
        }

        return summaries;
    }

    /**
     * Infer full API contracts from extracted API calls
     */
    async inferAPIContracts(apiCalls: ExtractedAPICall[]): Promise<APIContract[]> {
        if (apiCalls.length === 0) return [];

        // Group by endpoint to reduce noise
        const uniqueEndpoints = new Map<string, ExtractedAPICall>();
        for (const call of apiCalls) {
            const key = `${call.method}:${call.endpoint}`;
            if (!uniqueEndpoints.has(key)) {
                uniqueEndpoints.set(key, call);
            }
        }

        const calls = Array.from(uniqueEndpoints.values()).slice(0, 15);

        const prompt = `Based on these frontend API calls, infer the full API contracts.

API CALLS:
${calls.map(c => `- ${c.method} ${c.endpoint} (from: ${c.sourceFile}, auth: ${c.requiresAuth})`).join('\n')}

For each endpoint, return JSON array with:
- endpoint: the API path
- method: HTTP method
- description: what this API does (infer from endpoint name)
- requestSchema: inferred request body structure
- responseSchema: inferred response structure  
- authRequired: boolean
- rateLimit: suggested rate limit (optional)

Return ONLY valid JSON array:`;

        try {
            const response = await this.llm.invoke([
                new SystemMessage('You are an API architect. Infer realistic API contracts. Return only valid JSON.'),
                new HumanMessage(prompt),
            ]);

            const text = response.content as string;
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as APIContract[];
            }
        } catch (error) {
            console.error('[LLM Analyzer] API contract error:', error);
        }

        return [];
    }

    /**
     * Analyze relationships between data models
     */
    async analyzeModelRelationships(models: InferredModel[]): Promise<ModelRelationship[]> {
        if (models.length < 2) return [];

        const modelSummary = models.slice(0, 10).map(m => ({
            name: m.name,
            fields: m.fields.slice(0, 10).map(f => `${f.name}: ${f.type}`),
        }));

        const prompt = `Analyze these data models and infer relationships between them.

MODELS:
${modelSummary.map(m => `${m.name}: { ${m.fields.join(', ')} }`).join('\n')}

For each relationship found, return JSON array with:
- sourceModel: model that has the reference
- targetModel: model being referenced
- relationshipType: one-to-one, one-to-many, or many-to-many
- foreignKey: the field that creates the relationship
- description: explain the business relationship

Return ONLY valid JSON array:`;

        try {
            const response = await this.llm.invoke([
                new SystemMessage('You are a database architect. Analyze model relationships. Return only valid JSON.'),
                new HumanMessage(prompt),
            ]);

            const text = response.content as string;
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as ModelRelationship[];
            }
        } catch (error) {
            console.error('[LLM Analyzer] Relationship analysis error:', error);
        }

        return [];
    }

    /**
     * Generate enhanced backend specification
     */
    async generateEnhancedSpec(
        analysis: FrontendAnalysisResult,
        components: ComponentSummary[]
    ): Promise<EnhancedSpecification> {
        const prompt = `Based on this frontend analysis, generate a comprehensive backend specification.

FRAMEWORK: ${analysis.framework.type}
AUTH: ${analysis.authStrategy.provider}
API CALLS: ${analysis.apiCalls.length} endpoints
DATA MODELS: ${analysis.dataModels.map(m => m.name).join(', ')}
ROUTES: ${analysis.routes.map(r => r.path).slice(0, 10).join(', ')}
COMPONENTS: ${components.map(c => c.componentName).join(', ')}

Generate JSON with:
- projectOverview: 2-3 sentence project description
- appType: type of app (ecommerce, blog, dashboard, social, saas, etc.)
- keyFeatures: list of 5-8 main features the backend needs
- dataFlowSummary: how data flows through the app
- securityRequirements: list of security considerations
- scalabilityNotes: scalability recommendations
- suggestedArchitecture: recommended backend architecture

Return ONLY valid JSON object:`;

        try {
            const response = await this.llm.invoke([
                new SystemMessage('You are a backend architect. Generate comprehensive specifications. Return only valid JSON.'),
                new HumanMessage(prompt),
            ]);

            const text = response.content as string;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as EnhancedSpecification;
            }
        } catch (error) {
            console.error('[LLM Analyzer] Spec generation error:', error);
        }

        // Return default if LLM fails
        return {
            projectOverview: 'Frontend application requiring backend services.',
            appType: 'web-application',
            keyFeatures: ['User authentication', 'Data management', 'API services'],
            dataFlowSummary: 'Standard request-response pattern.',
            securityRequirements: ['Authentication', 'Authorization', 'Input validation'],
            scalabilityNotes: ['Consider caching', 'Database indexing'],
            suggestedArchitecture: 'REST API with PostgreSQL database',
        };
    }
}

export default LLMAnalyzer;
