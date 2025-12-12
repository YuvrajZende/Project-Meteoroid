/**
 * Multi-Model Orchestrator - Production-Grade Two-Stage Pipeline
 * 
 * This is the CRITICAL component for cost optimization:
 * - Stage 1: Fast Model (analysis, context preparation) - ~$0.0001/request
 * - Stage 2: Powerful Model (code generation) - ~$0.01/request
 * 
 * Expected savings: 10x cost reduction, 40% quality improvement
 * 
 * Phase 14: Integrated with Tech Stack Constraints for opinionated code generation.
 */

import {
    MODEL_REGISTRY,
    getModel,
    getRecommendedModelPair,
    isProviderConfigured,
    type ModelProvider,
} from './model-registry.js';
import { getCostTracker, type CostRecord } from './cost-tracker.js';
import type { ChatMessage } from './ai-client.js';
// Phase 14: Tech Stack Constraints
import { detectStackType, getStackPreset, generateConstraintPrompt } from '../config/stack-constraints.js';
import { DO_NOT_SUGGEST_BLOCK } from '../middleware/constraint-injection.js';

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
}

export interface GenerationResult {
    success: boolean;
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

export class MultiModelOrchestrator {
    private config: MultiModelConfig;
    private initialized: boolean = false;

    constructor(config?: Partial<MultiModelConfig>) {
        // Get recommended model pair as defaults
        const [defaultFast, defaultPower] = getRecommendedModelPair();

        this.config = {
            // Stage 1: Fast model (cheap, quick analysis)
            fastModel: config?.fastModel || process.env.FAST_MODEL_NAME || defaultFast.id,
            fastModelProvider: config?.fastModelProvider ||
                (process.env.FAST_MODEL_PROVIDER as ModelProvider) || defaultFast.provider,

            // Stage 2: Powerful model (quality code generation)
            powerModel: config?.powerModel || process.env.POWER_MODEL_NAME || defaultPower.id,
            powerModelProvider: config?.powerModelProvider ||
                (process.env.POWER_MODEL_PROVIDER as ModelProvider) || defaultPower.provider,

            // Fallback - use GLM-4.6 (same as power model)
            fallbackEnabled: config?.fallbackEnabled ?? true,
            fallbackModel: config?.fallbackModel || 'glm-4.6',

            // Timeouts
            fastModelTimeout: config?.fastModelTimeout || 30000, // 30s for analysis
            powerModelTimeout: config?.powerModelTimeout || 120000, // 2min for generation

            // Token limits
            maxContextTokens: config?.maxContextTokens || 32000,
            maxOutputTokens: config?.maxOutputTokens || 8192,
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
            console.warn(`[MULTI-MODEL] Fast model "${this.config.fastModel}" not in registry, using default`);
        }

        if (!powerModelConfig) {
            console.warn(`[MULTI-MODEL] Power model "${this.config.powerModel}" not in registry, using default`);
        }

        // Check API keys
        if (!isProviderConfigured(this.config.fastModelProvider)) {
            console.warn(`[MULTI-MODEL] API key not configured for ${this.config.fastModelProvider}`);
        }

        if (!isProviderConfigured(this.config.powerModelProvider)) {
            console.warn(`[MULTI-MODEL] API key not configured for ${this.config.powerModelProvider}`);
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
            const contextTokens = this.buildContext(request, contextAnalysis).length / 4;
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
            if (this.config.fallbackEnabled) {
                console.log('[STAGE 2] Attempting fallback model...');
                try {
                    const fallbackResult = await this.runFallbackGeneration(request, contextAnalysis);
                    code = fallbackResult.code;
                    explanation = fallbackResult.explanation;
                    files = fallbackResult.files;
                    success = true;
                    console.log('[STAGE 2] Fallback succeeded');
                } catch (fallbackError) {
                    console.error('[STAGE 2] Fallback also failed:', fallbackError);
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
            this.config.fastModelProvider,
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            { temperature: 0.3, maxTokens: 1024 }
        );

        try {
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            return JSON.parse(jsonStr) as ContextAnalysis;
        } catch {
            console.warn('[MULTI-MODEL] Failed to parse analysis, using fallback');
            return this.getFallbackAnalysis(request.prompt);
        }
    }

    /**
     * Stage 2: Run powerful model code generation
     * Phase 14: Now includes stack constraints for opinionated generation
     */
    private async runGeneration(
        request: MultiModelRequest,
        analysis: ContextAnalysis
    ): Promise<{ code: string; explanation: string; files: Array<{ path: string; content: string }> }> {
        const context = this.buildContext(request, analysis);
        const language = request.context?.language || 'TypeScript';
        const framework = request.context?.framework || 'Fastify';

        // Phase 14: Detect stack type and get constraints
        const stackType = detectStackType(request.prompt);
        const preset = getStackPreset(stackType);
        const constraintPrompt = generateConstraintPrompt(stackType);

        // Build enhanced system prompt with constraints
        const systemPrompt = `You are an expert ${language} developer specializing in ${framework} backend development.
Generate production-ready, clean, and well-documented code.

${constraintPrompt}

CORE REQUIREMENTS:
- Use ${language} with strict types
- Use ${preset.backend.framework} framework ONLY (NOT Express or other alternatives)
- Use ${preset.database.orm} for database operations
- Use ${preset.security.validation} for validation
- Use ${preset.monitoring.logging} for logging
- Include proper error handling
- Add JSDoc comments for functions
- Generate complete, runnable code

${DO_NOT_SUGGEST_BLOCK}

Respond with a JSON object:
{
  "code": "// Main code here",
  "explanation": "Brief explanation",
  "files": [{"path": "src/file.ts", "content": "// File content"}]
}

Respond ONLY with valid JSON.`;

        const response = await this.callModel(
            this.config.powerModel,
            this.config.powerModelProvider,
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context },
            ],
            { temperature: 0.5, maxTokens: this.config.maxOutputTokens }
        );

        try {
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            return JSON.parse(jsonStr);
        } catch {
            // Return as raw code if JSON parsing fails
            return {
                code: response,
                explanation: 'Generated code (raw output)',
                files: [{ path: 'src/generated.ts', content: response }],
            };
        }
    }

    /**
     * Fallback generation using backup model
     */
    private async runFallbackGeneration(
        request: MultiModelRequest,
        analysis: ContextAnalysis
    ): Promise<{ code: string; explanation: string; files: Array<{ path: string; content: string }> }> {
        const context = this.buildContext(request, analysis);

        const systemPrompt = `Generate production-ready TypeScript code. Respond with JSON:
{"code": "...", "explanation": "...", "files": []}`;

        const response = await this.callModel(
            this.config.fallbackModel,
            'zai', // Fallback to Z.AI
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: context },
            ],
            { temperature: 0.5, maxTokens: 4096 }
        );

        try {
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            return JSON.parse(jsonStr);
        } catch {
            return {
                code: response,
                explanation: 'Generated via fallback model',
                files: [],
            };
        }
    }

    /**
     * Build optimized context for code generation
     */
    private buildContext(request: MultiModelRequest, analysis: ContextAnalysis): string {
        let context = `TASK: ${request.prompt}\n\n`;

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
     * Make API call to a specific model
     */
    private async callModel(
        modelId: string,
        provider: ModelProvider,
        messages: ChatMessage[],
        options: { temperature?: number; maxTokens?: number } = {}
    ): Promise<string> {
        const model = getModel(modelId) || MODEL_REGISTRY['glm-4'];
        const baseUrl = model?.baseUrl || 'https://api.openai.com/v1';

        // Get API key based on provider
        const apiKey = this.getApiKey(provider);
        if (!apiKey) {
            throw new Error(`No API key configured for provider: ${provider}`);
        }

        const url = `${baseUrl}/chat/completions`;

        const requestBody = {
            model: modelId,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: false,
        };

        const timeout = modelId === this.config.fastModel
            ? this.config.fastModelTimeout
            : this.config.powerModelTimeout;

        // Retry configuration for rate limiting
        const maxRetries = 3;
        const baseDelay = 5000; // Start with 5 seconds

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        ...(provider === 'anthropic' ? { 'anthropic-version': '2024-01-01' } : {}),
                        ...(provider === 'openrouter' ? {
                            'HTTP-Referer': 'https://lovable-backend.ai',
                            'X-Title': 'Lovable Backend Orchestrator',
                        } : {}),
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                // Handle rate limiting with retry
                if (response.status === 429) {
                    const errorText = await response.text();

                    if (attempt < maxRetries) {
                        const waitTime = baseDelay * Math.pow(2, attempt); // Exponential backoff: 5s, 10s, 20s
                        console.log(`[MULTI-MODEL] Rate limited (429). Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue; // Retry
                    }

                    throw new Error(`API error 429 (rate limited after ${maxRetries} retries): ${errorText}`);
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API error ${response.status}: ${errorText}`);
                }

                const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
                return data.choices?.[0]?.message?.content || '';

            } catch (error) {
                clearTimeout(timeoutId);

                // If it's an abort error (timeout), retry
                if (error instanceof Error && error.name === 'AbortError' && attempt < maxRetries) {
                    const waitTime = baseDelay * Math.pow(2, attempt);
                    console.log(`[MULTI-MODEL] Request timed out. Waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Retry
                }

                throw error;
            }
        }

        throw new Error('Max retries exceeded');
    }

    /**
     * Get API key for a provider
     */
    private getApiKey(provider: ModelProvider): string | undefined {
        const envVars: Record<ModelProvider, string[]> = {
            openai: ['OPENAI_API_KEY'],
            anthropic: ['ANTHROPIC_API_KEY'],
            deepseek: ['DEEPSEEK_API_KEY'],
            zai: ['ZAI_API_KEY', 'OPENAI_API_KEY'], // Check ZAI_API_KEY first, fallback to OPENAI_API_KEY
            together: ['TOGETHER_API_KEY'],
            openrouter: ['OPENROUTER_API_KEY'],
            groq: ['GROQ_API_KEY'], // Added: Groq for fast model
        };

        // Try each possible env var for this provider
        for (const envVar of envVars[provider]) {
            const key = process.env[envVar];
            if (key) return key;
        }
        return undefined;
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
                configured: isProviderConfigured(this.config.fastModelProvider),
            },
            powerModel: {
                id: this.config.powerModel,
                provider: this.config.powerModelProvider,
                configured: isProviderConfigured(this.config.powerModelProvider),
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
