/**
 * AI Client Service
 * Makes REAL API calls to Z.AI (GLM-4) or OpenAI
 * No mocks - actual AI responses
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (handles running from packages/api)
const rootEnvPath = path.resolve(process.cwd(), '..', '..', '.env');
const localEnvPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: localEnvPath });
dotenv.config({ path: rootEnvPath });

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

// ============================================
// AI CLIENT CLASS
// ============================================

export class AIClient {
    private config: AIClientConfig;

    constructor(config?: Partial<AIClientConfig>) {
        // Try to find an available API key
        const apiKey = config?.apiKey || this.findAvailableApiKey();
        const { baseUrl, model } = this.getDefaultConfig(apiKey);

        this.config = {
            apiKey: apiKey,
            baseUrl: config?.baseUrl || baseUrl,
            model: config?.model || process.env.MODEL_NAME || model,
            timeout: config?.timeout || 120000, // 2 minutes for complex code generation
        };

        if (!this.config.apiKey) {
            // API key not configured - will throw on actual API call
        }
    }

    /**
     * Find an available API key from environment variables
     */
    private findAvailableApiKey(): string {
        // Priority order: OPENAI > ZAI > OPENROUTER > DEEPSEEK > ANTHROPIC
        return process.env.OPENAI_API_KEY
            || process.env.ZAI_API_KEY  // Z.AI separate key
            || process.env.OPENROUTER_API_KEY
            || process.env.DEEPSEEK_API_KEY
            || process.env.ANTHROPIC_API_KEY
            || '';
    }

    /**
     * Get default configuration based on available API key
     */
    private getDefaultConfig(apiKey: string): { baseUrl: string; model: string } {
        // If using Z.AI base URL (via OPENAI_BASE_URL)
        if (process.env.OPENAI_BASE_URL?.includes('z.ai')) {
            return {
                baseUrl: process.env.OPENAI_BASE_URL,
                model: 'glm-4',
            };
        }

        // If using Z.AI key directly
        if (apiKey === process.env.ZAI_API_KEY && apiKey) {
            return {
                baseUrl: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4',
                model: 'glm-4',
            };
        }

        // If using OpenRouter
        if (apiKey === process.env.OPENROUTER_API_KEY && apiKey) {
            return {
                baseUrl: 'https://openrouter.ai/api/v1',
                model: 'deepseek/deepseek-chat',
            };
        }

        // If using DeepSeek directly
        if (apiKey === process.env.DEEPSEEK_API_KEY && apiKey) {
            return {
                baseUrl: 'https://api.deepseek.com/v1',
                model: 'deepseek-chat',
            };
        }

        // Default to configured base URL or OpenAI
        return {
            baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            model: 'glm-4',
        };
    }

    /**
     * Send a chat completion request to the AI
     */
    async chat(messages: ChatMessage[], options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<string> {
        if (!this.config.apiKey) {
            throw new Error('[AI-CLIENT] Cannot make AI request - no API key configured. Set OPENAI_API_KEY, OPENROUTER_API_KEY, or DEEPSEEK_API_KEY');
        }

        const url = `${this.config.baseUrl}/chat/completions`;

        const requestBody: ChatCompletionRequest = {
            model: this.config.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2048,
            stream: false,
        };

        const startTime = Date.now();

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText}`);
            }

            const data = await response.json() as ChatCompletionResponse;
            const content = data.choices[0]?.message?.content || '';
            return content;

        } catch (error) {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            console.error(`[AI-CLIENT] Request failed after ${duration}ms:`, error);
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
