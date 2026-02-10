/**
 * Meteoroid CLI - Direct LLM Client
 * Connects directly to LLM APIs without needing the backend server
 * Reads API keys from .env file
 */

import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LLMConfig {
    provider: 'groq' | 'zai' | 'openai' | 'anthropic';
    apiKey: string;
    baseUrl: string;
    model: string;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    success: boolean;
    content?: string;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENV LOADER
// ═══════════════════════════════════════════════════════════════════════════

function loadEnvFile(): Record<string, string> {
    const envPaths = [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '..', '.env'),
        resolve(process.cwd(), '..', '..', '.env'),
    ];

    for (const envPath of envPaths) {
        if (existsSync(envPath)) {
            const content = readFileSync(envPath, 'utf-8');
            const env: Record<string, string> = {};

            for (const line of content.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;

                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }

            return env;
        }
    }

    return {};
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM CLIENT
// ═══════════════════════════════════════════════════════════════════════════

class DirectLLMClient {
    private config: LLMConfig | null = null;
    private env: Record<string, string> = {};
    private initialized = false;

    initialize(): { success: boolean; provider?: string; model?: string; error?: string } {
        this.env = { ...process.env as Record<string, string>, ...loadEnvFile() };

        // Try to configure based on available API keys
        // Priority: GROQ (fast) > ZAI (power) > OpenAI > Anthropic

        // Check for Groq (fast model)
        if (this.env.GROQ_API_KEY) {
            this.config = {
                provider: 'groq',
                apiKey: this.env.GROQ_API_KEY,
                baseUrl: 'https://api.groq.com/openai/v1',
                model: this.env.FAST_MODEL_NAME || 'llama-3.3-70b-versatile',
            };
            this.initialized = true;
            return { success: true, provider: 'Groq', model: this.config.model };
        }

        // Check for Z.AI (power model)
        if (this.env.ZAI_API_KEY) {
            this.config = {
                provider: 'zai',
                apiKey: this.env.ZAI_API_KEY,
                baseUrl: this.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4',
                model: this.env.POWER_MODEL_NAME || this.env.MODEL_NAME || 'glm-4.6',
            };
            this.initialized = true;
            return { success: true, provider: 'Z.AI (GLM-4)', model: this.config.model };
        }

        // Check for OpenAI
        if (this.env.OPENAI_API_KEY) {
            this.config = {
                provider: 'openai',
                apiKey: this.env.OPENAI_API_KEY,
                baseUrl: this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
                model: 'gpt-4o-mini',
            };
            this.initialized = true;
            return { success: true, provider: 'OpenAI', model: this.config.model };
        }

        // Check for Anthropic
        if (this.env.ANTHROPIC_API_KEY) {
            this.config = {
                provider: 'anthropic',
                apiKey: this.env.ANTHROPIC_API_KEY,
                baseUrl: 'https://api.anthropic.com/v1',
                model: 'claude-3-5-sonnet-20241022',
            };
            this.initialized = true;
            return { success: true, provider: 'Anthropic', model: this.config.model };
        }

        return {
            success: false,
            error: 'No API keys found. Add GROQ_API_KEY, ZAI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY to .env'
        };
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    getProvider(): string | null {
        return this.config?.provider || null;
    }

    getModel(): string | null {
        return this.config?.model || null;
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        if (!this.config) {
            return { success: false, error: 'LLM client not initialized. Call initialize() first.' };
        }

        try {
            if (this.config.provider === 'anthropic') {
                return await this.callAnthropic(messages);
            } else {
                // OpenAI-compatible API (Groq, Z.AI, OpenAI)
                return await this.callOpenAICompatible(messages);
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Unknown error';
            return { success: false, error };
        }
    }

    private async callOpenAICompatible(messages: LLMMessage[]): Promise<LLMResponse> {
        const response = await fetch(`${this.config!.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config!.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config!.model,
                messages,
                max_tokens: 2048,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `API error ${response.status}: ${errorText}` };
        }

        const data = await response.json() as {
            choices: Array<{ message: { content: string } }>;
            usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        };

        return {
            success: true,
            content: data.choices?.[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    }

    private async callAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
        // Convert messages to Anthropic format
        const systemMessage = messages.find(m => m.role === 'system');
        const nonSystemMessages = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }));

        const response = await fetch(`${this.config!.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config!.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.config!.model,
                max_tokens: 2048,
                system: systemMessage?.content,
                messages: nonSystemMessages,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `API error ${response.status}: ${errorText}` };
        }

        const data = await response.json() as {
            content: Array<{ text: string }>;
            usage?: { input_tokens: number; output_tokens: number };
        };

        return {
            success: true,
            content: data.content?.[0]?.text || '',
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
        };
    }
}

// Singleton instance
export const llmClient = new DirectLLMClient();

export default llmClient;
