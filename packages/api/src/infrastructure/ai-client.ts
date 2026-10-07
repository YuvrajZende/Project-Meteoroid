/**
 * AI Client Service
 *
 * Single place that talks to model providers over HTTP:
 * - `callRegisteredModel()` calls any model in MODEL_REGISTRY using only that provider's own key
 *   (Anthropic via the native Messages API, everyone else via OpenAI-compatible chat/completions).
 * - `AIClient` is a thin default-model wrapper used by the simple-script fast path and analyzers.
 *
 * Uses the global fetch (undici keep-alive pool) - no per-request clients or agents.
 */

import { injectable, unmanaged } from 'inversify';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
    getModel,
    getConfiguredModelPair,
    isModelConfigured,
    POWER_MODEL_PRIORITY,
    type ModelConfig,
} from '../services/registry/model-registry.js';

// ============================================
// ENV LOADING
// ============================================

/**
 * Walk up from this module to the monorepo root (package.json with "workspaces").
 * Independent of process.cwd(), so it works from the repo root, packages/api, or dist/.
 */
function findRepoRoot(startDir: string): string | null {
    let dir = startDir;
    for (;;) {
        const pkgPath = path.join(dir, 'package.json');
        try {
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { workspaces?: unknown };
                if (pkg.workspaces) return dir;
            }
        } catch {
            // Unreadable package.json - keep walking up
        }
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

// config/env.ts normally loads .env first; dotenv never overrides already-set vars, so this is a safe no-op then.
// This package compiles to CommonJS, so __dirname is the module's directory (src/ or dist/).
const repoRoot = findRepoRoot(__dirname);
if (repoRoot) {
    dotenv.config({ path: path.join(repoRoot, 'packages', 'api', '.env'), quiet: true });
    dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
}

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface AIClientConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeout?: number;
}

export interface ModelCallOptions {
    temperature?: number;
    maxTokens?: number;
    /** Hard cap on total wall time for the call, retries included. */
    timeoutMs: number;
    /** Retries for 429/408/5xx/network errors (timeouts are never retried). Default 3. */
    maxRetries?: number;
    /** Override the registry key / base URL (same provider). */
    apiKey?: string;
    baseUrl?: string;
}

// ============================================
// PROVIDER CALLS
// ============================================

interface PreparedRequest {
    url: string;
    headers: Record<string, string>;
    body: string;
}

const OPENROUTER_HEADERS = {
    'HTTP-Referer': 'https://github.com/meteoroid',
    'X-Title': 'Meteoroid',
};

function buildOpenAICompatibleRequest(
    model: ModelConfig,
    apiKey: string,
    baseUrl: string,
    messages: ChatMessage[],
    maxTokens: number,
    temperature?: number
): PreparedRequest {
    const body: Record<string, unknown> = {
        model: model.apiModelId ?? model.id,
        messages,
        stream: false,
    };
    // Current OpenAI models take max_completion_tokens; other OpenAI-compatible APIs take max_tokens.
    body[model.provider === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = maxTokens;
    if (model.supportsTemperature && temperature !== undefined) body.temperature = temperature;

    return {
        url: `${baseUrl}/chat/completions`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...(model.provider === 'openrouter' ? OPENROUTER_HEADERS : {}),
        },
        body: JSON.stringify(body),
    };
}

function buildAnthropicRequest(
    model: ModelConfig,
    apiKey: string,
    baseUrl: string,
    messages: ChatMessage[],
    maxTokens: number,
    temperature?: number
): PreparedRequest {
    const system = messages
        .filter(m => m.role === 'system')
        .map(m => m.content)
        .join('\n\n');
    const conversation = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
        model: model.id,
        max_tokens: maxTokens,
        messages: conversation,
    };
    if (system) body.system = system;
    // Opus 5.5 / Sonnet 5.5 reject sampling params; Haiku 4.5 accepts them.
    if (model.supportsTemperature && temperature !== undefined) body.temperature = temperature;

    return {
        url: `${baseUrl}/messages`,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
    };
}

function parseOpenAICompatibleResponse(data: unknown): string {
    const parsed = data as { choices?: Array<{ message?: { content?: string | null } }> };
    return parsed.choices?.[0]?.message?.content || '';
}

function parseAnthropicResponse(modelId: string, data: unknown): string {
    const parsed = data as {
        content?: Array<{ type: string; text?: string }>;
        stop_reason?: string;
    };
    if (parsed.stop_reason === 'refusal') {
        throw new Error(`${modelId} declined the request (stop_reason: refusal)`);
    }
    // Thinking blocks are skipped; only text blocks form the answer.
    return (parsed.content ?? [])
        .filter(block => block.type === 'text' && typeof block.text === 'string')
        .map(block => block.text)
        .join('');
}

/**
 * Sleep before a retry. Honors Retry-After (seconds or HTTP date), else exponential backoff with jitter.
 * Returns false without sleeping if the wait would cross the call's deadline.
 */
async function backoff(
    attempt: number,
    retryAfter: string | null,
    deadline: number,
    modelId: string,
    reason: string
): Promise<boolean> {
    let waitMs = 2000 * 2 ** attempt + Math.floor(Math.random() * 500);
    if (retryAfter) {
        const seconds = Number(retryAfter);
        const parsed = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
        if (Number.isFinite(parsed) && parsed >= 0) waitMs = parsed;
    }

    if (Date.now() + waitMs >= deadline) return false;

    console.log(`[AI-CLIENT] ${modelId}: ${reason}. Retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1})...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return true;
}

/**
 * Call a model from MODEL_REGISTRY.
 *
 * - Unknown model ids throw (never silently routed to another provider's host).
 * - Uses only the model's own provider key (`apiKeyEnvVar`).
 * - Retries 429/408/5xx and network errors with backoff honoring Retry-After.
 * - Timeouts are NOT retried; `timeoutMs` caps total wall time across all attempts.
 */
export async function callRegisteredModel(
    modelId: string,
    messages: ChatMessage[],
    options: ModelCallOptions
): Promise<string> {
    const model = getModel(modelId);
    if (!model) {
        throw new Error(`Unknown model "${modelId}": not in MODEL_REGISTRY. Check FAST_MODEL_NAME / POWER_MODEL_NAME / MODEL_NAME.`);
    }

    const apiKey = options.apiKey || process.env[model.apiKeyEnvVar];
    if (!apiKey) {
        throw new Error(`${model.apiKeyEnvVar} is not set (required for ${model.provider} model ${model.id})`);
    }

    // ZAI_BASE_URL is re-read at call time in case .env loaded after the registry module.
    const baseUrl = options.baseUrl
        || (model.provider === 'zai' ? process.env.ZAI_BASE_URL : undefined)
        || model.baseUrl;
    const maxTokens = Math.min(options.maxTokens ?? 4096, model.maxOutputTokens);
    const request = model.provider === 'anthropic'
        ? buildAnthropicRequest(model, apiKey, baseUrl, messages, maxTokens, options.temperature)
        : buildOpenAICompatibleRequest(model, apiKey, baseUrl, messages, maxTokens, options.temperature);

    const maxRetries = options.maxRetries ?? 3;
    const deadline = Date.now() + options.timeoutMs;

    for (let attempt = 0; ; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            throw new Error(`${model.id} call exceeded ${options.timeoutMs}ms wall-time budget`);
        }

        let response: Response;
        try {
            response = await fetch(request.url, {
                method: 'POST',
                headers: request.headers,
                body: request.body,
                signal: AbortSignal.timeout(remaining),
            });
        } catch (error) {
            const name = error instanceof Error ? error.name : '';
            if (name === 'TimeoutError' || name === 'AbortError') {
                // Never retry a timed-out generation: it would burn the same budget again.
                throw new Error(`${model.id} request timed out after ${options.timeoutMs}ms`);
            }
            if (attempt < maxRetries && await backoff(attempt, null, deadline, model.id, 'network error')) {
                continue;
            }
            throw error;
        }

        if (response.ok) {
            const data: unknown = await response.json();
            return model.provider === 'anthropic'
                ? parseAnthropicResponse(model.id, data)
                : parseOpenAICompatibleResponse(data);
        }

        const errorText = await response.text().catch(() => '');
        const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
        if (retryable && attempt < maxRetries
            && await backoff(attempt, response.headers.get('retry-after'), deadline, model.id, `HTTP ${response.status}`)) {
            continue;
        }

        throw new Error(`${model.provider} API error ${response.status} (${model.id}): ${errorText.substring(0, 500)}`);
    }
}

// ============================================
// AI CLIENT CLASS
// ============================================

/**
 * Resolve the default single-model id: MODEL_NAME if registered and keyed, else the configured
 * power model, else the first power-tier model with a key.
 */
function resolveDefaultModelId(): string {
    const fromEnv = process.env.MODEL_NAME ? getModel(process.env.MODEL_NAME) ?? undefined : undefined;
    if (fromEnv && isModelConfigured(fromEnv)) return fromEnv.id;

    const power = getConfiguredModelPair()[1];
    if (isModelConfigured(power)) return power.id;

    for (const id of POWER_MODEL_PRIORITY) {
        const model = getModel(id);
        if (model && isModelConfigured(model)) return model.id;
    }
    return power.id;
}

@injectable()
export class AIClient {
    private config: AIClientConfig;

    constructor(@unmanaged() config?: Partial<AIClientConfig>) {
        const modelId = config?.model || resolveDefaultModelId();
        const model = getModel(modelId);

        this.config = {
            apiKey: config?.apiKey || (model ? process.env[model.apiKeyEnvVar] || '' : ''),
            baseUrl: config?.baseUrl || model?.baseUrl || '',
            model: modelId,
            timeout: config?.timeout || 120000, // 2 minutes for complex code generation
        };
    }

    /**
     * Send a chat request to the configured model
     */
    async chat(messages: ChatMessage[], options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<string> {
        const startTime = Date.now();
        try {
            return await callRegisteredModel(this.config.model, messages, {
                temperature: options?.temperature ?? 0.7,
                maxTokens: options?.maxTokens ?? 2048,
                timeoutMs: this.config.timeout ?? 120000,
                apiKey: this.config.apiKey || undefined,
                baseUrl: this.config.baseUrl || undefined,
            });
        } catch (error) {
            console.error(`[AI-CLIENT] Request failed after ${Date.now() - startTime}ms:`, error);
            throw error;
        }
    }

    /**
     * Analyze a task and suggest an execution plan
     */
    async analyzeTask(taskDescription: string): Promise<{
        complexity: 'simple' | 'moderate' | 'complex';
        subtasks: string[];
        suggestedAgents: string[];
        estimatedSteps: number;
    }> {
        const systemPrompt = `You are a backend development orchestrator. Analyze the given task and respond with a JSON object containing:
- complexity: "simple", "moderate", or "complex"
- subtasks: array of specific subtasks to complete
- suggestedAgents: array of agent types needed (e.g., "auth-agent", "security-agent", "api-agent", "database-agent")
- estimatedSteps: number of steps to complete

Respond ONLY with valid JSON, no markdown or explanation.`;

        const response = await this.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this task:\n\n${taskDescription}` },
        ], { temperature: 0.3 });

        try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            return JSON.parse(jsonStr);
        } catch {
            // Fallback if JSON parsing fails
            console.warn('[AI-CLIENT] Failed to parse analysis response, using fallback');
            return {
                complexity: 'moderate',
                subtasks: ['Analyze requirements', 'Implement solution', 'Test and validate'],
                suggestedAgents: ['api-agent'],
                estimatedSteps: 3,
            };
        }
    }

    /**
     * Generate code for a specific task
     */
    async generateCode(task: string, context?: {
        language?: string;
        framework?: string;
        existingCode?: string;
    }): Promise<{
        code: string;
        explanation: string;
        files: Array<{ path: string; content: string }>;
    }> {
        const language = context?.language || 'TypeScript';
        const framework = context?.framework || 'Express/Fastify';

        const systemPrompt = `You are an expert ${language} developer specializing in ${framework}.
Generate clean, production-ready code for the given task.
Respond with a JSON object containing:
- code: the main code snippet
- explanation: brief explanation of what the code does
- files: array of {path, content} for files to create

Respond ONLY with valid JSON.`;

        let userPrompt = `Generate code for: ${task}`;
        if (context?.existingCode) {
            userPrompt += `\n\nExisting code context:\n${context.existingCode}`;
        }

        const response = await this.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], { temperature: 0.5, maxTokens: 4096 });

        try {
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            return JSON.parse(jsonStr);
        } catch {
            // Return raw response if JSON fails
            return {
                code: response,
                explanation: 'Generated code',
                files: [],
            };
        }
    }

    /**
     * Get the current configuration
     */
    getConfig(): { baseUrl: string; model: string } {
        return {
            baseUrl: this.config.baseUrl,
            model: this.config.model,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let aiClientInstance: AIClient | null = null;

export function getAIClient(): AIClient {
    if (!aiClientInstance) {
        aiClientInstance = new AIClient();
    }
    return aiClientInstance;
}

export function createAIClient(config?: Partial<AIClientConfig>): AIClient {
    aiClientInstance = new AIClient(config);
    return aiClientInstance;
}
