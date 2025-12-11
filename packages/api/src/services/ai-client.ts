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
        this.config = {
            apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
            baseUrl: config?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            model: config?.model || process.env.MODEL_NAME || 'glm-4',
            timeout: config?.timeout || 120000, // 2 minutes for complex code generation
        };

        if (!this.config.apiKey) {
            throw new Error('[AI-CLIENT] No API key configured. Set OPENAI_API_KEY in .env');
        }

        console.log('[AI-CLIENT] Initialized');
        console.log(`[AI-CLIENT] Base URL: ${this.config.baseUrl}`);
        console.log(`[AI-CLIENT] Model: ${this.config.model}`);
    }

    /**
     * Send a chat completion request to the AI
     */
    async chat(messages: ChatMessage[], options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<string> {
        const url = `${this.config.baseUrl}/chat/completions`;

        const requestBody: ChatCompletionRequest = {
            model: this.config.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2048,
            stream: false,
        };

        console.log(`[AI-CLIENT] Sending request to ${url}`);
        console.log(`[AI-CLIENT] Model: ${this.config.model}`);
        console.log(`[AI-CLIENT] Messages: ${messages.length}`);

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
            const duration = Date.now() - startTime;

            console.log(`[AI-CLIENT] Response received in ${duration}ms`);
            console.log(`[AI-CLIENT] Tokens used: ${data.usage?.total_tokens || 'unknown'}`);

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
