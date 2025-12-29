/**
 * AI Integration Service
 * Enhanced AI service with agent integration and prompt management
 * 
 * @author Person 2 (AI/ML Engineer)
 */

import {
    SYSTEM_PROMPTS,
    FEW_SHOT_EXAMPLES,
    CHAIN_OF_THOUGHT,
    buildDatabasePrompt,
    buildQueuePrompt,
    buildTestPrompt,
    buildCodeGenerationPrompt,
    trackPromptUsage,
    type PromptMetrics,
} from './prompts/agent-prompts.js';

// ============================================
// TYPES
// ============================================

export interface AIRequest {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
}

export interface AIResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model: string;
    finishReason: string;
}

export interface AgentTask {
    agentType: 'database' | 'queue' | 'test' | 'code';
    requirements: string;
    context?: Record<string, unknown>;
}

export interface AgentResult {
    success: boolean;
    output: string;
    files?: Array<{ path: string; content: string }>;
    metadata?: Record<string, unknown>;
}

export interface AIIntegrationConfig {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    maxRetries?: number;
    timeout?: number;
    enableMetrics?: boolean;
}

// ============================================
// AI INTEGRATION SERVICE
// ============================================

export class AIIntegrationService {
    private config: Required<AIIntegrationConfig>;
    private isInitialized = false;
    private metricsEnabled = true;

    constructor(config?: AIIntegrationConfig) {
        this.config = {
            apiKey: config?.apiKey || this.findApiKey(),
            baseUrl: config?.baseUrl || this.getDefaultBaseUrl(),
            defaultModel: config?.defaultModel || 'gpt-4',
            maxRetries: config?.maxRetries || 3,
            timeout: config?.timeout || 30000,
            enableMetrics: config?.enableMetrics ?? true,
        };
        this.metricsEnabled = this.config.enableMetrics;
    }

    private findApiKey(): string {
        // Check environment variables for API keys
        const keys = [
            'OPENAI_API_KEY',
            'ANTHROPIC_API_KEY',
            'ZAI_API_KEY',
            'AI_API_KEY',
        ];

        for (const key of keys) {
            const value = typeof process !== 'undefined' ? process.env?.[key] : undefined;
            if (value) return value;
        }

        return '';
    }

    private getDefaultBaseUrl(): string {
        // Determine base URL based on available API key
        const hasOpenAI = typeof process !== 'undefined' && process.env?.OPENAI_API_KEY;
        const hasAnthropic = typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY;
        const hasZAI = typeof process !== 'undefined' && process.env?.ZAI_API_KEY;

        if (hasOpenAI) return 'https://api.openai.com/v1';
        if (hasAnthropic) return 'https://api.anthropic.com/v1';
        if (hasZAI) return 'https://open.bigmodel.cn/api/paas/v4';

        return 'https://api.openai.com/v1';
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('[AI-INTEGRATION] Initializing AI Integration Service');
        console.log(`[AI-INTEGRATION] Base URL: ${this.config.baseUrl}`);
        console.log(`[AI-INTEGRATION] Default Model: ${this.config.defaultModel}`);
        console.log(`[AI-INTEGRATION] API Key: ${this.config.apiKey ? '***configured***' : 'NOT CONFIGURED'}`);

        this.isInitialized = true;
    }

    // ============================================
    // CORE AI METHODS
    // ============================================

    /**
     * Send a request to the AI API with retry logic
     */
    async chat(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                // Build the request body
                const body = {
                    model: request.model || this.config.defaultModel,
                    messages: [
                        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
                        { role: 'user', content: request.prompt },
                    ],
                    temperature: request.temperature ?? 0.7,
                    max_tokens: request.maxTokens ?? 4096,
                };

                // Make the API request
                const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`,
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');

                    // Retry on rate limits (429) or server errors (5xx)
                    if (response.status === 429 || response.status >= 500) {
                        throw new Error(`AI API error (retryable): ${response.status} ${errorText}`);
                    }
                    throw new Error(`AI API error: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                const result: AIResponse = {
                    content: data.choices?.[0]?.message?.content || '',
                    usage: data.usage ? {
                        promptTokens: data.usage.prompt_tokens,
                        completionTokens: data.usage.completion_tokens,
                        totalTokens: data.usage.total_tokens,
                    } : undefined,
                    model: data.model || this.config.defaultModel,
                    finishReason: data.choices?.[0]?.finish_reason || 'unknown',
                };

                // Track metrics on success
                if (this.metricsEnabled) {
                    trackPromptUsage({
                        promptId: 'chat',
                        version: '1.0.0',
                        tokensUsed: result.usage?.totalTokens || 0,
                        responseTime: Date.now() - startTime,
                        success: true,
                        timestamp: new Date(),
                    });
                }

                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Only retry on retryable errors
                const isRetryable = lastError.message.includes('retryable') ||
                    lastError.message.includes('ECONNREFUSED') ||
                    lastError.message.includes('timeout');

                if (attempt < this.config.maxRetries && isRetryable) {
                    // Exponential backoff: 1s, 2s, 4s...
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    console.warn(`[AI-INTEGRATION] Attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    break;
                }
            }
        }

        // Track failed request
        console.error('[AI-INTEGRATION] Chat failed after retries:', lastError);
        if (this.metricsEnabled) {
            trackPromptUsage({
                promptId: 'chat',
                version: '1.0.0',
                tokensUsed: 0,
                responseTime: Date.now() - startTime,
                success: false,
                timestamp: new Date(),
            });
        }

        throw lastError || new Error('Chat request failed');
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    // ============================================
    // AGENT-SPECIFIC METHODS
    // ============================================

    /**
     * Execute a task for a specific agent
     */
    async executeAgentTask(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();

        try {
            let prompt: string;
            let systemPrompt: string;

            switch (task.agentType) {
                case 'database':
                    systemPrompt = SYSTEM_PROMPTS.DATABASE_AGENT;
                    prompt = buildDatabasePrompt(task.requirements, {
                        orm: task.context?.orm as 'prisma' | 'drizzle',
                        database: task.context?.database as 'postgresql' | 'mysql' | 'sqlite',
                        includeRLS: task.context?.includeRLS as boolean,
                    });
                    break;

                case 'queue':
                    systemPrompt = SYSTEM_PROMPTS.QUEUE_AGENT;
                    prompt = buildQueuePrompt(task.requirements, {
                        provider: task.context?.provider as 'bullmq' | 'redis',
                        includeWorker: task.context?.includeWorker as boolean,
                        includeScheduler: task.context?.includeScheduler as boolean,
                    });
                    break;

                case 'test':
                    systemPrompt = SYSTEM_PROMPTS.TEST_AGENT;
                    prompt = buildTestPrompt(task.requirements, {
                        framework: task.context?.framework as 'vitest' | 'jest' | 'playwright',
                        testType: task.context?.testType as 'unit' | 'integration' | 'e2e',
                        sourceCode: task.context?.sourceCode as string,
                    });
                    break;

                case 'code':
                default:
                    systemPrompt = SYSTEM_PROMPTS.CODE_GENERATION;
                    prompt = buildCodeGenerationPrompt(task.requirements, {
                        language: task.context?.language as string,
                        framework: task.context?.framework as string,
                        existingCode: task.context?.existingCode as string,
                        constraints: task.context?.constraints as string[],
                    });
                    break;
            }

            // Execute the AI request
            const response = await this.chat({
                prompt,
                systemPrompt,
                temperature: 0.7,
                maxTokens: 4096,
            });

            // Parse the response to extract code
            const files = this.extractCodeFromResponse(response.content);

            return {
                success: true,
                output: response.content,
                files,
                metadata: {
                    agentType: task.agentType,
                    tokensUsed: response.usage?.totalTokens,
                    model: response.model,
                    duration: Date.now() - startTime,
                },
            };
        } catch (error) {
            console.error(`[AI-INTEGRATION] Agent task failed:`, error);
            return {
                success: false,
                output: error instanceof Error ? error.message : 'Unknown error',
                metadata: {
                    agentType: task.agentType,
                    error: true,
                    duration: Date.now() - startTime,
                },
            };
        }
    }

    /**
     * Generate database schema using AI
     */
    async generateDatabaseSchema(requirements: string, options?: {
        orm?: 'prisma' | 'drizzle';
        database?: 'postgresql' | 'mysql' | 'sqlite';
        includeRLS?: boolean;
    }): Promise<AgentResult> {
        return this.executeAgentTask({
            agentType: 'database',
            requirements,
            context: options,
        });
    }

    /**
     * Generate queue configuration using AI
     */
    async generateQueueConfig(requirements: string, options?: {
        provider?: 'bullmq' | 'redis';
        includeWorker?: boolean;
        includeScheduler?: boolean;
    }): Promise<AgentResult> {
        return this.executeAgentTask({
            agentType: 'queue',
            requirements,
            context: options,
        });
    }

    /**
     * Generate tests using AI
     */
    async generateTests(requirements: string, options?: {
        framework?: 'vitest' | 'jest' | 'playwright';
        testType?: 'unit' | 'integration' | 'e2e';
        sourceCode?: string;
    }): Promise<AgentResult> {
        return this.executeAgentTask({
            agentType: 'test',
            requirements,
            context: options,
        });
    }

    /**
     * Generate code using AI
     */
    async generateCode(task: string, options?: {
        language?: string;
        framework?: string;
        existingCode?: string;
        constraints?: string[];
    }): Promise<AgentResult> {
        return this.executeAgentTask({
            agentType: 'code',
            requirements: task,
            context: options,
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Extract code blocks from AI response
     */
    private extractCodeFromResponse(response: string): Array<{ path: string; content: string }> {
        const files: Array<{ path: string; content: string }> = [];

        // Match code blocks with optional filename
        const codeBlockRegex = /```(?:typescript|javascript|ts|js|prisma|sql)?(?:\s+\/\/\s*(.+?)\n)?\n([\s\S]*?)```/g;
        let match;

        while ((match = codeBlockRegex.exec(response)) !== null) {
            const filename = match[1]?.trim() || `file-${files.length}.ts`;
            const content = match[2].trim();

            if (content) {
                files.push({
                    path: filename,
                    content,
                });
            }
        }

        return files;
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus(): {
        initialized: boolean;
        hasApiKey: boolean;
        model: string;
        baseUrl: string;
    } {
        return {
            initialized: this.isInitialized,
            hasApiKey: !!this.config.apiKey,
            model: this.config.defaultModel,
            baseUrl: this.config.baseUrl,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let instance: AIIntegrationService | null = null;

export function getAIIntegrationService(): AIIntegrationService {
    if (!instance) {
        instance = new AIIntegrationService();
    }
    return instance;
}

// ============================================
// EXPORTS
// ============================================

export {
    SYSTEM_PROMPTS,
    FEW_SHOT_EXAMPLES,
    CHAIN_OF_THOUGHT,
    buildDatabasePrompt,
    buildQueuePrompt,
    buildTestPrompt,
    buildCodeGenerationPrompt,
};
