/**
 * Multi-Model Orchestrator - Production-Grade Two-Stage Pipeline
 *
 * This is the CRITICAL component for cost optimization:
 * - Stage 1: Fast Model (analysis, context preparation, ASCII architecture) - ~$0.0001/request
 * - Stage 2: Powerful Model (code generation from blueprint) - ~$0.01/request
 *
 * Expected savings: 10x cost reduction, 40% quality improvement
 *
 * Phase 14: Integrated with Tech Stack Constraints for opinionated code generation.
 * Phase 20: Added Architecture Blueprint Generator for ASCII art system design.
 */

import { injectable, unmanaged } from 'inversify';

// Registry
import {
    getModel,
    getConfiguredModelPair,
    getPowerFallbackModel,
    isModelConfigured,
    type ModelProvider,
} from '../../../services/registry/model-registry.js';

// Infrastructure
import { getCostTracker, type CostRecord } from '../../../infrastructure/cost-tracker.js';
import { callRegisteredModel, type ChatMessage } from '../../../infrastructure/ai-client.js';
import { broadcastFileWritten, broadcastPipelineStep } from '../../../routes/websocket.js';

// Config & Middleware
import { detectStackType, generateConstraintPrompt } from '../../../config/stack-constraints.js';
import { DO_NOT_SUGGEST_BLOCK } from '../../../middleware/constraint-injection.js';

// Architecture
import { getArchitectureBlueprintGenerator, type ArchitectureBlueprint } from '../../../domain/services/architecture/architecture-blueprint.js';

// Analysis
import { getRobustJSONParser } from '../../../domain/services/analysis/robust-json-parser.js';

// Learning
import { getEnhancedLearningContextBuilder } from '../../../domain/services/learning/enhanced-learning-context.js';

// ============================================
// TYPES
// ============================================

export interface MultiModelConfig {
    // Fast model for analysis (Stage 1)
    fastModel: string;
    fastModelProvider: ModelProvider;

    // Powerful model for generation (Stage 2)
    powerModel: string;
    powerModelProvider: ModelProvider;

    // Fallback configuration
    fallbackEnabled: boolean;
    fallbackModel: string;

    // Timeouts
    fastModelTimeout: number;
    powerModelTimeout: number;

    // Token limits
    maxContextTokens: number;
    maxOutputTokens: number;
}

export interface ContextAnalysis {
    complexity: 'simple' | 'moderate' | 'complex';
    requiredCapabilities: string[];
    suggestedAgents: string[];
    relevantFiles: string[];
    dependencies: string[];
    estimatedTokens: number;
    scope: 'single-file' | 'multi-file' | 'project-wide';
    subtasks: string[];
    // Phase 20: Architecture Blueprint
    architectureBlueprint?: ArchitectureBlueprint;
}

export interface GenerationResult {
    success: boolean;
    /** Provider error when generation (including fallback) failed */
    error?: string;
    code: string;
    explanation: string;
    files: Array<{ path: string; content: string }>;

    // Cost tracking
    analysisCost: CostRecord | null;
    generationCost: CostRecord | null;
    totalCost: number;

    // Performance
    analysisTime: number;
    generationTime: number;
    totalTime: number;

    // Model info
    analysisModel: string;
    generationModel: string;

    // Context
    contextAnalysis: ContextAnalysis;

    // Phase 20: Architecture Blueprint
    architectureDiagram?: string;
}

export interface MultiModelRequest {
    prompt: string;
    taskId: string;
    projectId: string;
    userId?: string;
    context?: {
        existingCode?: string;
        techStack?: string[];
        framework?: string;
        language?: string;
    };
}

// ============================================
// MULTI-MODEL ORCHESTRATOR
// ============================================

@injectable()
export class MultiModelOrchestrator {
    private config: MultiModelConfig;
    private initialized: boolean = false;

    constructor(@unmanaged() config?: Partial<MultiModelConfig>) {
        // Env-selected models when their key is set, otherwise first configured model per tier
        const [defaultFast, defaultPower] = getConfiguredModelPair();

        const fastModel = config?.fastModel || defaultFast.id;
        const powerModel = config?.powerModel || defaultPower.id;
        // Provider always follows the registry entry, so a model can never be sent to another provider's host.
        const fastProvider = getModel(fastModel)?.provider ?? defaultFast.provider;
        const powerProvider = getModel(powerModel)?.provider ?? defaultPower.provider;

        this.config = {
            // Stage 1: Fast model (cheap, quick analysis)
            fastModel,
            fastModelProvider: fastProvider,

            // Stage 2: Powerful model (quality code generation)
            powerModel,
            powerModelProvider: powerProvider,

            // Fallback: explicit, env, or the next configured power-tier model
            fallbackEnabled: config?.fallbackEnabled ?? true,
            fallbackModel: config?.fallbackModel
                || process.env.FALLBACK_MODEL_NAME
                || getPowerFallbackModel(powerModel)?.id
                || '',

            // Timeouts (configurable via env vars). Each is a hard cap on total wall time per call, retries included.
            fastModelTimeout: config?.fastModelTimeout || parseInt(process.env.FAST_MODEL_TIMEOUT || '30000', 10), // 30s for analysis
            powerModelTimeout: config?.powerModelTimeout || parseInt(process.env.POWER_MODEL_TIMEOUT || '600000', 10), // 10min for generation

            // Token limits (clamped to each model's maxOutputTokens at call time)
            maxContextTokens: config?.maxContextTokens || 32000,
            maxOutputTokens: config?.maxOutputTokens || parseInt(process.env.POWER_MODEL_MAX_TOKENS || '16384', 10),
        };
    }

    /**
     * Initialize the orchestrator
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[MULTI-MODEL] Initializing Multi-Model Orchestrator...');
        console.log(`[MULTI-MODEL] Fast Model: ${this.config.fastModel} (${this.config.fastModelProvider})`);
        console.log(`[MULTI-MODEL] Power Model: ${this.config.powerModel} (${this.config.powerModelProvider})`);

        // Validate model configurations
        const fastModelConfig = getModel(this.config.fastModel);
        const powerModelConfig = getModel(this.config.powerModel);

        if (!fastModelConfig) {
            console.warn(`[MULTI-MODEL] Fast model "${this.config.fastModel}" not in registry - analysis will use heuristic fallback`);
        } else if (!isModelConfigured(fastModelConfig)) {
            console.warn(`[MULTI-MODEL] ${fastModelConfig.apiKeyEnvVar} not set for fast model ${fastModelConfig.id}`);
        }

        if (!powerModelConfig) {
            console.warn(`[MULTI-MODEL] Power model "${this.config.powerModel}" not in registry - generation will fail`);
        } else if (!isModelConfigured(powerModelConfig)) {
            console.warn(`[MULTI-MODEL] ${powerModelConfig.apiKeyEnvVar} not set for power model ${powerModelConfig.id}`);
        }

        if (this.config.fallbackModel) {
            console.log(`[MULTI-MODEL] Fallback Model: ${this.config.fallbackModel}`);
        }

        this.initialized = true;
        console.log('[MULTI-MODEL] Initialization complete');
    }

    /**
     * Execute the two-stage multi-model pipeline
     */
    async execute(request: MultiModelRequest): Promise<GenerationResult> {
        await this.initialize();

        const startTime = Date.now();
        const costTracker = getCostTracker();

        console.log(`\n${'='.repeat(70)}`);
        console.log('  MULTI-MODEL PIPELINE - Starting');
        console.log(`${'='.repeat(70)}`);
        console.log(`  Task: ${request.prompt.substring(0, 100)}...`);
        console.log(`  Project: ${request.projectId}`);
        console.log('');

        // Budget check
        const budgetCheck = costTracker.canProceed();
        if (!budgetCheck.allowed) {
            throw new Error(`Budget limit reached: ${budgetCheck.reason}`);
        }

        let analysisCost: CostRecord | null = null;
        let generationCost: CostRecord | null = null;
        let contextAnalysis: ContextAnalysis;

        // ============================================
        // STAGE 1: Fast Model Analysis
        // ============================================
        console.log('[STAGE 1] Running fast model analysis...');
        const analysisStart = Date.now();

        try {
            contextAnalysis = await this.runAnalysis(request);
            const analysisTime = Date.now() - analysisStart;

            console.log(`[STAGE 1] Analysis complete in ${analysisTime}ms`);
            console.log(`[STAGE 1] Complexity: ${contextAnalysis.complexity}`);
            console.log(`[STAGE 1] Estimated tokens: ${contextAnalysis.estimatedTokens}`);
            console.log(`[STAGE 1] Subtasks: ${contextAnalysis.subtasks.length}`);

            // Phase 20: Generate Architecture Blueprint
            console.log('[STAGE 1.5] Generating Architecture Blueprint...');
            try {
                const blueprintGenerator = getArchitectureBlueprintGenerator();
                const blueprint = blueprintGenerator.generateBlueprint({
                    prompt: request.prompt,
                    projectName: request.projectId || 'generated-project',
                    language: request.context?.language || 'TypeScript',
                    framework: request.context?.framework || 'Fastify',
                    features: contextAnalysis.requiredCapabilities,
                    includeAuth: contextAnalysis.requiredCapabilities.includes('authentication'),
                    includeDatabase: true,
                    includeMonitoring: contextAnalysis.requiredCapabilities.includes('monitoring'),
                });
                contextAnalysis.architectureBlueprint = blueprint;
                console.log(`[STAGE 1.5] Blueprint generated: ${blueprint.estimatedFiles} files, ${blueprint.complexity} complexity`);
                console.log(`[STAGE 1.5] Routes: ${blueprint.routes.length}, Services: ${blueprint.services.length}, Tables: ${blueprint.database.tables.length}`);
            } catch (blueprintError) {
                console.warn('[STAGE 1.5] Blueprint generation failed:', blueprintError);
                // Continue without blueprint - power model will still work
            }

            // Record analysis cost (estimate based on prompt size)
            const analysisInputTokens = Math.ceil(request.prompt.length / 4);
            const analysisOutputTokens = 500; // Typical analysis response

            analysisCost = costTracker.recordCost({
                modelId: this.config.fastModel,
                inputTokens: analysisInputTokens,
                outputTokens: analysisOutputTokens,
                stage: 'analysis',
                taskId: request.taskId,
                projectId: request.projectId,
                userId: request.userId,
                latencyMs: analysisTime,
                success: true,
            });

        } catch (error) {
            const analysisTime = Date.now() - analysisStart;
            console.error('[STAGE 1] Analysis failed:', error);

            // Use fallback analysis
            contextAnalysis = this.getFallbackAnalysis(request.prompt);

            costTracker.recordCost({
                modelId: this.config.fastModel,
                inputTokens: Math.ceil(request.prompt.length / 4),
                outputTokens: 0,
                stage: 'analysis',
                taskId: request.taskId,
                projectId: request.projectId,
                userId: request.userId,
                latencyMs: analysisTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        const analysisTime = Date.now() - analysisStart;

        // ============================================
        // STAGE 2: Powerful Model Code Generation
        // ============================================
        console.log('\n[STAGE 2] Running powerful model code generation...');
        const generationStart = Date.now();

        let code = '';
        let explanation = '';
        let files: Array<{ path: string; content: string }> = [];
        let success = false;
        let generationError: string | undefined;

        try {
            const generationResult = await this.runGeneration(request, contextAnalysis);
            code = generationResult.code;
            explanation = generationResult.explanation;
            files = generationResult.files;
            success = true;

            const generationTime = Date.now() - generationStart;
            console.log(`[STAGE 2] Generation complete in ${generationTime}ms`);
            console.log(`[STAGE 2] Files generated: ${files.length}`);
            console.log(`[STAGE 2] Code length: ${code.length} chars`);

            // Record generation cost
            // Estimate input tokens from the prompt + analysis (avoid redundant buildContext call)
            const promptLength = (request.prompt?.length || 0) + JSON.stringify(contextAnalysis || {}).length;
            const contextTokens = promptLength / 4;
            const outputTokens = Math.ceil(code.length / 4);

            generationCost = costTracker.recordCost({
                modelId: this.config.powerModel,
                inputTokens: Math.ceil(contextTokens),
                outputTokens: outputTokens,
                stage: 'code-generation',
                taskId: request.taskId,
                projectId: request.projectId,
                userId: request.userId,
                latencyMs: generationTime,
                success: true,
            });

        } catch (error) {
            const generationTime = Date.now() - generationStart;
            console.error('[STAGE 2] Generation failed:', error);
            generationError = error instanceof Error ? error.message : String(error);

            costTracker.recordCost({
                modelId: this.config.powerModel,
                inputTokens: Math.ceil(request.prompt.length / 4),
                outputTokens: 0,
                stage: 'code-generation',
                taskId: request.taskId,
                projectId: request.projectId,
                userId: request.userId,
                latencyMs: generationTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Try fallback if enabled
            if (this.config.fallbackEnabled && this.config.fallbackModel) {
                console.log(`[STAGE 2] Attempting fallback model ${this.config.fallbackModel}...`);
                try {
                    const fallbackResult = await this.runFallbackGeneration(request, contextAnalysis);
                    code = fallbackResult.code;
                    explanation = fallbackResult.explanation;
                    files = fallbackResult.files;
                    success = true;
                    console.log('[STAGE 2] Fallback succeeded');
                } catch (fallbackError) {
                    console.error('[STAGE 2] Fallback also failed:', fallbackError);
                    generationError = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                }
            }
        }

        const generationTime = Date.now() - generationStart;
        const totalTime = Date.now() - startTime;
        const totalCost = (analysisCost?.totalCost || 0) + (generationCost?.totalCost || 0);

        console.log(`\n${'='.repeat(70)}`);
        console.log('  MULTI-MODEL PIPELINE - Complete');
        console.log(`${'='.repeat(70)}`);
        console.log(`  Total Time: ${totalTime}ms`);
        console.log(`  Analysis Model: ${this.config.fastModel}`);
        console.log(`  Generation Model: ${this.config.powerModel}`);
        console.log(`  Total Cost: $${totalCost.toFixed(6)}`);
        console.log(`  Success: ${success}`);
        console.log('');

        return {
            success,
            error: success ? undefined : generationError,
            code,
            explanation,
            files,
            analysisCost,
            generationCost,
            totalCost,
            analysisTime,
            generationTime,
            totalTime,
            analysisModel: this.config.fastModel,
            generationModel: this.config.powerModel,
            contextAnalysis,
            // Phase 20: Include ASCII architecture diagram
            architectureDiagram: contextAnalysis.architectureBlueprint?.asciiDiagram,
        };
    }

    /**
     * Get language-specific settings for prompt generation
     */
    private getLanguageSettings(language: string, framework: string): {
        extension: string;
        entryPoint: string;
        techStack: string;
        typeHints: string;
        docStyle: string;
        depFile: string;
        syntaxNote: string;
        isTypeScript: boolean;
    } {
        const configs: Record<string, {
            extension: string;
            entryPoint: string;
            techStack: string;
            typeHints: string;
            docStyle: string;
            depFile: string;
            syntaxNote: string;
        }> = {
            typescript: {
                extension: '.ts',
                entryPoint: 'src/index.ts',
                techStack: `${framework} framework, Prisma for ORM, Zod for validation, and Pino for logging`,
                typeHints: 'with strict types',
                docStyle: 'Add JSDoc comments for functions',
                depFile: 'Include package.json with all dependencies',
                syntaxNote: 'Use TypeScript syntax with proper types.',
            },
            javascript: {
                extension: '.js',
                entryPoint: 'src/index.js',
                techStack: `${framework} framework, Sequelize for ORM`,
                typeHints: '',
                docStyle: 'Add JSDoc comments for functions',
                depFile: 'Include package.json with all dependencies',
                syntaxNote: 'Use modern ES6+ JavaScript syntax.',
            },
            python: {
                extension: '.py',
                entryPoint: 'app.py',
                techStack: `${framework} for the web framework, SQLAlchemy for ORM, Pydantic for validation`,
                typeHints: 'with type hints',
                docStyle: 'Add docstrings for functions',
                depFile: 'Include requirements.txt with all dependencies',
                syntaxNote: 'Use Python 3.10+ syntax, type hints where appropriate.',
            },
            go: {
                extension: '.go',
                entryPoint: 'cmd/main.go',
                techStack: `${framework} for the web framework, GORM for ORM`,
                typeHints: '',
                docStyle: 'Add GoDoc comments for exported functions',
                depFile: 'Include go.mod with all dependencies',
                syntaxNote: 'Use idiomatic Go syntax. Use proper error handling with error returns.',
            },
            rust: {
                extension: '.rs',
                entryPoint: 'src/main.rs',
                techStack: `${framework} for the web framework, Diesel for ORM, serde for serialization`,
                typeHints: 'with proper types',
                docStyle: 'Add /// doc comments for public functions',
                depFile: 'Include Cargo.toml with all dependencies',
                syntaxNote: 'Use idiomatic Rust syntax with proper ownership and borrowing.',
            },
            java: {
                extension: '.java',
                entryPoint: 'src/main/java/Application.java',
                techStack: `${framework} framework, JPA/Hibernate for ORM`,
                typeHints: 'with proper types',
                docStyle: 'Add Javadoc comments for classes and methods',
                depFile: 'Include pom.xml with all dependencies',
                syntaxNote: 'Use Java 17+ features. Follow Spring/Java naming conventions.',
            },
            cpp: {
                extension: '.cpp',
                entryPoint: 'src/main.cpp',
                techStack: `${framework} for the web framework`,
                typeHints: 'with proper types',
                docStyle: 'Add Doxygen comments for functions',
                depFile: 'Include CMakeLists.txt with all dependencies',
                syntaxNote: 'Use modern C++17/20 features.',
            },
            csharp: {
                extension: '.cs',
                entryPoint: 'Program.cs',
                techStack: `${framework} framework, Entity Framework Core for ORM`,
                typeHints: 'with proper types',
                docStyle: 'Add XML documentation comments for public members',
                depFile: 'Include .csproj with all dependencies',
                syntaxNote: 'Use C# 10+ features with nullable reference types.',
            },
            ruby: {
                extension: '.rb',
                entryPoint: 'app.rb',
                techStack: `${framework} framework, ActiveRecord for ORM`,
                typeHints: '',
                docStyle: 'Add YARD documentation comments',
                depFile: 'Include Gemfile with all dependencies',
                syntaxNote: 'Use modern Ruby 3.x syntax.',
            },
            php: {
                extension: '.php',
                entryPoint: 'public/index.php',
                techStack: `${framework} framework, Eloquent for ORM`,
                typeHints: 'with type declarations',
                docStyle: 'Add PHPDoc comments for classes and methods',
                depFile: 'Include composer.json with all dependencies',
                syntaxNote: 'Use PHP 8.1+ features with strict types.',
            },
            kotlin: {
                extension: '.kt',
                entryPoint: 'src/main/kotlin/Application.kt',
                techStack: `${framework} framework, Exposed for ORM`,
                typeHints: '',
                docStyle: 'Add KDoc comments for public functions',
                depFile: 'Include build.gradle.kts with all dependencies',
                syntaxNote: 'Use idiomatic Kotlin with null safety.',
            },
            swift: {
                extension: '.swift',
                entryPoint: 'Sources/App/main.swift',
                techStack: `${framework} framework, Fluent for ORM`,
                typeHints: 'with proper types',
                docStyle: 'Add documentation comments for public APIs',
                depFile: 'Include Package.swift with all dependencies',
                syntaxNote: 'Use Swift 5.9+ features.',
            },
        };

        // Get config for language, fallback to TypeScript
        const config = configs[language] || configs['typescript'];

        return {
            ...config,
            isTypeScript: language === 'typescript' || language === 'javascript',
        };
    }

    /**
     * Stage 1: Run fast model analysis
     */
    private async runAnalysis(request: MultiModelRequest): Promise<ContextAnalysis> {
        const systemPrompt = `You are an expert code analysis assistant. Analyze the given task and respond with a JSON object.
Your response MUST be valid JSON with this exact structure:
{
  "complexity": "simple" | "moderate" | "complex",
  "requiredCapabilities": ["authentication", "security", etc.],
  "suggestedAgents": ["auth-agent", "security-agent", etc.],
  "relevantFiles": ["src/auth.ts", etc.],
  "dependencies": ["bcrypt", "jsonwebtoken", etc.],
  "estimatedTokens": 2000,
  "scope": "single-file" | "multi-file" | "project-wide",
  "subtasks": ["task 1", "task 2", etc.]
}

Respond ONLY with valid JSON. No markdown, no explanation.`;

        let userPrompt = `Analyze this development task:\n\n${request.prompt}`;

        if (request.context?.techStack) {
            userPrompt += `\n\nTech Stack: ${request.context.techStack.join(', ')}`;
        }
        if (request.context?.framework) {
            userPrompt += `\nFramework: ${request.context.framework}`;
        }

        const response = await this.callModel(
            this.config.fastModel,
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            { temperature: 0.3, maxTokens: 1024, timeoutMs: this.config.fastModelTimeout }
        );

        // Use robust JSON parser
        const jsonParser = getRobustJSONParser();
        const parseResult = jsonParser.parse<ContextAnalysis>(response);

        if (parseResult.success && parseResult.data) {
            if (parseResult.repairAttempted) {
                console.log('[MULTI-MODEL] JSON repaired successfully');
            }
            return parseResult.data;
        } else {
            console.warn('[MULTI-MODEL] Failed to parse analysis:', parseResult.error);
            return this.getFallbackAnalysis(request.prompt);
        }
    }

    /**
     * Stage 2: Run powerful model code generation
     * Phase 14: Now includes stack constraints for opinionated generation
     * Phase 20: Now includes architecture blueprint for consistent code structure
     */
    private async runGeneration(
        request: MultiModelRequest,
        analysis: ContextAnalysis
    ): Promise<{ code: string; explanation: string; files: Array<{ path: string; content: string }> }> {
        const context = await this.buildContext(request, analysis);
        const language = request.context?.language || 'TypeScript';
        const framework = request.context?.framework || 'Fastify';

        // Phase 14: Detect stack type and get constraints
        const stackType = detectStackType(request.prompt);
        const constraintPrompt = generateConstraintPrompt(stackType);

        // Phase 20: Build blueprint context if available
        let blueprintContext = '';
        if (analysis.architectureBlueprint) {
            const blueprint = analysis.architectureBlueprint;
            blueprintContext = `
ARCHITECTURE BLUEPRINT (Follow this structure exactly):
================================================================================

PROJECT: ${blueprint.projectName}
COMPLEXITY: ${blueprint.complexity}
ESTIMATED FILES: ${blueprint.estimatedFiles}

REQUIRED ROUTES:
${blueprint.routes.map(r => `- ${r.method} ${r.path} → ${r.handler} (${r.description})`).join('\n')}

REQUIRED SERVICES:
${blueprint.services.map(s => `- ${s.name}: ${s.methods.join(', ')}`).join('\n')}

DATABASE TABLES:
${blueprint.database.tables.map(t => `- ${t.name}: ${t.columns.map(c => c.name).join(', ')}`).join('\n')}

FILE STRUCTURE TO GENERATE:
${blueprint.fileStructure.slice(0, 20).join('\n')}

MIDDLEWARE CHAIN:
${blueprint.middleware.map(m => `${m.order}. ${m.name} - ${m.description}`).join('\n')}

AGENTS TO CONSIDER:
${blueprint.agents.map(a => `- ${a.name} (${a.role}): ${a.capabilities.join(', ')}`).join('\n')}

================================================================================
IMPORTANT: Generate ALL files shown in the blueprint. Follow the exact routes,
services, and database schema defined above. This blueprint was generated during
analysis and represents the complete system architecture.
================================================================================
`;
        }

        // Determine file extension and language-specific settings
        const langLower = language.toLowerCase();
        const langConfig = this.getLanguageSettings(langLower, framework);

        // Build enhanced system prompt with constraints and blueprint
        const systemPrompt = `You are an expert ${language} developer specializing in ${framework} backend development.
Generate production-ready, clean, and well-documented code.

${langConfig.isTypeScript ? constraintPrompt : ''}

CORE REQUIREMENTS:
- Use ${language} ${langConfig.typeHints}
- Use ${framework} framework ONLY
- Use ${langConfig.techStack}
- Include proper error handling
- ${langConfig.docStyle}
- Generate complete, runnable code
- ${langConfig.depFile}

${blueprintContext}

${DO_NOT_SUGGEST_BLOCK}

CRITICAL: You MUST respond with a valid JSON object containing MULTIPLE files.
Each file must be a separate object in the "files" array.
DO NOT combine multiple files into one. Each file should have its OWN path and content.

RESPONSE FORMAT (JSON):
{
  "code": "// Summary of main functionality",
  "explanation": "Brief explanation of what was generated",
  "files": [
    {"path": "${langConfig.entryPoint}", "content": "// COMPLETE ${language} code for entry point"},
    {"path": "handlers/user${langConfig.extension}", "content": "// COMPLETE handler code"},
    {"path": "models/user${langConfig.extension}", "content": "// COMPLETE model code"},
    {"path": "${langConfig.extension === '.go' ? 'go.mod' : langConfig.extension === '.rs' ? 'Cargo.toml' : langConfig.extension === '.java' ? 'pom.xml' : 'package.json'}", "content": "// COMPLETE dependency file"}
  ]
}

RULES:
1. Generate AT LEAST 3-5 files for a complete project
2. All ${language} files MUST use ${langConfig.extension} extension
3. Each file must contain COMPLETE, working code (not snippets)
4. Include the dependency/project file (${langConfig.depFile.split(' ')[1] || 'dependencies'})
5. ${langConfig.syntaxNote}
6. Respond ONLY with valid JSON. No markdown, no explanation outside JSON.`;

        const response = await this.callModel(
            this.config.powerModel,
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context },
            ],
            { temperature: 0.5, maxTokens: this.config.maxOutputTokens, timeoutMs: this.config.powerModelTimeout }
        );

        // Use robust JSON parser with aggressive repair
        const jsonParser = getRobustJSONParser();
        const parseResult = jsonParser.parse<{
            code: string;
            explanation: string;
            files: Array<{ path: string; content: string }>;
        }>(response);

        if (parseResult.success && parseResult.data) {
            const parsed = parseResult.data;

            if (parseResult.repairAttempted) {
                console.log('[POWER MODEL] JSON repaired successfully after error');
            }

            // Validate the response structure
            if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
                console.warn('[POWER MODEL] Response missing files array, extracting from code');
                return {
                    code: parsed.code || response,
                    explanation: parsed.explanation || 'Generated code',
                    files: [{ path: langConfig.entryPoint, content: parsed.code || response }],
                };
            }

            console.log(`[POWER MODEL] Successfully parsed ${parsed.files.length} files`);
            
            // STREAMING: Broadcast each file as it's generated
            const projectId = request.projectId || 'project';
            for (let i = 0; i < parsed.files.length; i++) {
                const file = parsed.files[i];
                broadcastFileWritten(projectId, file.path, file.content.length);
                broadcastPipelineStep(i + 1, 'generating', `Generated: ${file.path}`);
            }
            
            return parsed;
        } else {
            console.error('[POWER MODEL] JSON parsing failed:', parseResult.error);
            console.log('[POWER MODEL] Raw response length:', response.length);
            console.log('[POWER MODEL] Raw response preview:', response.substring(0, 500));

            // Try to extract files from the response using regex
            const extractedFiles = this.extractFilesFromResponse(response, langConfig.extension);
            if (extractedFiles.length > 0) {
                console.log(`[POWER MODEL] Extracted ${extractedFiles.length} files using fallback`);
                return {
                    code: response,
                    explanation: 'Generated code (extracted from response)',
                    files: extractedFiles,
                };
            }

            // Last resort: return as single file
            return {
                code: response,
                explanation: 'Generated code (raw output)',
                files: [{ path: langConfig.entryPoint, content: response }],
            };
        }
    }

    /**
     * Extract files from malformed response using patterns
     */
    private extractFilesFromResponse(response: string, _defaultExt: string): Array<{ path: string; content: string }> {
        const files: Array<{ path: string; content: string }> = [];

        // Try to find file markers like "// filename.go" or "# filename.py"
        const filePatterns = [
            /\/\/\s*([^\s]+\.(go|rs|java|py|ts|js|cs|cpp|rb|php|kt|swift))\s*\n([\s\S]*?)(?=\/\/\s*[^\s]+\.\w+\s*\n|$)/gi,
            /#\s*([^\s]+\.(py|rb))\s*\n([\s\S]*?)(?=#\s*[^\s]+\.\w+\s*\n|$)/gi,
            /```\w*\s*([^\s]+\.(go|rs|java|py|ts|js|cs|cpp|rb|php|kt|swift))\s*\n([\s\S]*?)```/gi,
        ];

        for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(response)) !== null) {
                files.push({
                    path: match[1],
                    content: match[3] || match[2],
                });
            }
        }

        return files;
    }

    /**
     * Fallback generation using backup model
     */
    private async runFallbackGeneration(
        request: MultiModelRequest,
        analysis: ContextAnalysis
    ): Promise<{ code: string; explanation: string; files: Array<{ path: string; content: string }> }> {
        const context = await this.buildContext(request, analysis);

        // Use requested language, fallback to TypeScript
        const language = request.context?.language || 'TypeScript';
        const framework = request.context?.framework || 'Fastify';
        const langConfig = this.getLanguageSettings(language.toLowerCase(), framework);

        const systemPrompt = `Generate production-ready ${language} code for ${framework}. Respond with JSON:
{"code": "...", "explanation": "...", "files": [{"path": "${langConfig.entryPoint}", "content": "..."}]}`;

        const response = await this.callModel(
            this.config.fallbackModel,
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context },
            ],
            { temperature: 0.5, maxTokens: this.config.maxOutputTokens, timeoutMs: this.config.powerModelTimeout }
        );

        // Use robust JSON parser
        const jsonParser = getRobustJSONParser();
        const parseResult = jsonParser.parse(response);

        if (parseResult.success && parseResult.data) {
            return parseResult.data;
        } else {
            return {
                code: response,
                explanation: 'Generated via fallback model',
                files: [{ path: `src/generated${langConfig.extension}`, content: response }],
            };
        }
    }

    /**
     * Build optimized context for code generation
     * Phase 21: Now includes learning from past generations
     */
    private async buildContext(request: MultiModelRequest, analysis: ContextAnalysis): Promise<string> {
        let context = `TASK: ${request.prompt}\n\n`;

        // ============================================
        // PHASE 21: ENHANCED LEARNING CONTEXT
        // ============================================
        try {
            const learningBuilder = getEnhancedLearningContextBuilder();
            const learningContext = await learningBuilder.buildContext(request.prompt, {
                language: request.context?.language,
                framework: request.context?.framework,
                maxExperiences: 5,
                maxPatterns: 10,
                maxCodeExamples: 3,
            });

            // Add formatted learning context to prompt
            const formattedLearning = learningBuilder.formatForLLM(learningContext);
            if (formattedLearning && formattedLearning.length > 50) {
                context += formattedLearning;
                context += '\n';
                console.log(`[MULTI-MODEL] Injected learning context: ${learningContext.relevantExperiences.length} experiences, ${learningContext.patterns.length} patterns`);
            }
        } catch (error) {
            console.warn('[MULTI-MODEL] Failed to build learning context:', error);
            // Continue without learning context (graceful fallback)
        }

        context += `ANALYSIS:\n`;
        context += `- Complexity: ${analysis.complexity}\n`;
        context += `- Scope: ${analysis.scope}\n`;
        context += `- Dependencies: ${analysis.dependencies.join(', ') || 'None identified'}\n`;
        context += `\n`;

        context += `SUBTASKS:\n`;
        analysis.subtasks.forEach((task, i) => {
            context += `${i + 1}. ${task}\n`;
        });
        context += `\n`;

        if (request.context?.existingCode) {
            // Limit existing code to prevent token overflow
            const maxExistingCodeLength = 4000;
            let existingCode = request.context.existingCode;
            if (existingCode.length > maxExistingCodeLength) {
                existingCode = existingCode.substring(0, maxExistingCodeLength) + '\n// ... (truncated)';
            }
            context += `EXISTING CODE CONTEXT:\n\`\`\`\n${existingCode}\n\`\`\`\n\n`;
        }

        context += `Generate complete, production-ready code for all subtasks.`;

        return context;
    }

    /**
     * Get fallback analysis when fast model fails
     */
    private getFallbackAnalysis(prompt: string): ContextAnalysis {
        // Simple heuristic-based analysis
        const lowerPrompt = prompt.toLowerCase();

        const capabilities: string[] = [];
        const agents: string[] = [];
        const dependencies: string[] = [];

        if (lowerPrompt.includes('auth') || lowerPrompt.includes('login') || lowerPrompt.includes('jwt')) {
            capabilities.push('authentication');
            agents.push('auth-agent');
            dependencies.push('jsonwebtoken', 'bcrypt');
        }
        if (lowerPrompt.includes('security') || lowerPrompt.includes('rate limit') || lowerPrompt.includes('cors')) {
            capabilities.push('security');
            agents.push('security-agent');
            dependencies.push('@fastify/rate-limit', '@fastify/cors');
        }
        if (lowerPrompt.includes('log') || lowerPrompt.includes('monitor') || lowerPrompt.includes('health')) {
            capabilities.push('monitoring');
            agents.push('monitoring-agent');
            dependencies.push('pino');
        }
        if (lowerPrompt.includes('database') || lowerPrompt.includes('prisma') || lowerPrompt.includes('supabase')) {
            capabilities.push('database');
            agents.push('database-agent');
            dependencies.push('@prisma/client');
        }

        return {
            complexity: prompt.length > 500 ? 'complex' : prompt.length > 200 ? 'moderate' : 'simple',
            requiredCapabilities: capabilities.length > 0 ? capabilities : ['general'],
            suggestedAgents: agents.length > 0 ? agents : ['api-agent'],
            relevantFiles: [],
            dependencies,
            estimatedTokens: Math.ceil(prompt.length * 3),
            scope: capabilities.length > 2 ? 'project-wide' : capabilities.length > 1 ? 'multi-file' : 'single-file',
            subtasks: ['Analyze requirements', 'Implement solution', 'Add error handling', 'Test and validate'],
        };
    }

    /**
     * Call a registered model. Provider routing, per-provider keys, Anthropic Messages API,
     * retry policy (429/5xx with Retry-After, no timeout retries) and the wall-time cap
     * live in callRegisteredModel().
     */
    private callModel(
        modelId: string,
        messages: ChatMessage[],
        options: { temperature?: number; maxTokens?: number; timeoutMs: number }
    ): Promise<string> {
        return callRegisteredModel(modelId, messages, options);
    }

    private isConfigured(modelId: string): boolean {
        const model = getModel(modelId);
        return !!model && isModelConfigured(model);
    }

    /**
     * Get current configuration
     */
    getConfig(): MultiModelConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<MultiModelConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get status info
     */
    getStatus(): {
        initialized: boolean;
        fastModel: { id: string; provider: string; configured: boolean };
        powerModel: { id: string; provider: string; configured: boolean };
    } {
        return {
            initialized: this.initialized,
            fastModel: {
                id: this.config.fastModel,
                provider: this.config.fastModelProvider,
                configured: this.isConfigured(this.config.fastModel),
            },
            powerModel: {
                id: this.config.powerModel,
                provider: this.config.powerModelProvider,
                configured: this.isConfigured(this.config.powerModel),
            },
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let multiModelInstance: MultiModelOrchestrator | null = null;

export function getMultiModelOrchestrator(): MultiModelOrchestrator {
    if (!multiModelInstance) {
        multiModelInstance = new MultiModelOrchestrator();
    }
    return multiModelInstance;
}

export function createMultiModelOrchestrator(config?: Partial<MultiModelConfig>): MultiModelOrchestrator {
    multiModelInstance = new MultiModelOrchestrator(config);
    return multiModelInstance;
}
