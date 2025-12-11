/**
 * Model Registry - Production-Grade AI Model Configuration
 * 
 * Comprehensive registry of all supported AI models with:
 * - Pricing information (per 1M tokens)
 * - Speed classification (fast vs powerful)
 * - Provider-specific configuration
 * - Automatic model selection
 */

// ============================================
// TYPES
// ============================================

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'zai' | 'together' | 'openrouter';
export type ModelTier = 'fast' | 'balanced' | 'powerful';
export type ModelCapability = 'analysis' | 'code-generation' | 'reasoning' | 'context-preparation';

export interface ModelPricing {
    inputPerMillion: number;  // USD per 1M input tokens
    outputPerMillion: number; // USD per 1M output tokens
    cacheHitPerMillion?: number; // USD per 1M cached input tokens (if supported)
}

export interface ModelConfig {
    id: string;
    name: string;
    provider: ModelProvider;
    tier: ModelTier;
    capabilities: ModelCapability[];
    pricing: ModelPricing;
    maxContextTokens: number;
    maxOutputTokens: number;
    supportsStreaming: boolean;
    supportsJsonMode: boolean;
    avgLatencyMs: number; // Average response time
    qualityScore: number; // 0-100, subjective quality rating
    baseUrl: string;
    apiKeyEnvVar: string;
}

export interface ProviderConfig {
    name: ModelProvider;
    displayName: string;
    baseUrl: string;
    apiKeyEnvVar: string;
    headers?: Record<string, string>;
}

// ============================================
// PROVIDER CONFIGURATIONS
// ============================================

export const PROVIDER_CONFIGS: Record<ModelProvider, ProviderConfig> = {
    openai: {
        name: 'openai',
        displayName: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    anthropic: {
        name: 'anthropic',
        displayName: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
        headers: {
            'anthropic-version': '2024-01-01',
        },
    },
    deepseek: {
        name: 'deepseek',
        displayName: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    },
    zai: {
        name: 'zai',
        displayName: 'Z.AI (GLM)',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    together: {
        name: 'together',
        displayName: 'Together AI',
        baseUrl: 'https://api.together.xyz/v1',
        apiKeyEnvVar: 'TOGETHER_API_KEY',
    },
    openrouter: {
        name: 'openrouter',
        displayName: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        headers: {
            'HTTP-Referer': 'https://lovable-backend.ai',
            'X-Title': 'Lovable Backend Orchestrator',
        },
    },
};

// ============================================
// MODEL REGISTRY
// ============================================

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
    // ============================================
    // FAST MODELS (Low cost, quick responses)
    // ============================================

    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation'],
        pricing: {
            inputPerMillion: 0.15,
            outputPerMillion: 0.60,
        },
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
        supportsJsonMode: true,
        avgLatencyMs: 500,
        qualityScore: 75,
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },

    // DeepSeek V3 via OpenRouter - RECOMMENDED FAST MODEL
    'deepseek/deepseek-chat': {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3 (OpenRouter)',
        provider: 'openrouter',
        tier: 'fast', // Using as FAST model for analysis
        capabilities: ['analysis', 'context-preparation', 'reasoning'],
        pricing: {
            inputPerMillion: 0.14,
            outputPerMillion: 0.28,
            cacheHitPerMillion: 0.014,
        },
        maxContextTokens: 64000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsJsonMode: true,
        avgLatencyMs: 800,
        qualityScore: 88,
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
    },

    'deepseek-chat': {
        id: 'deepseek-chat',
        name: 'DeepSeek V3 (Direct)',
        provider: 'deepseek',
        tier: 'balanced',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: {
            inputPerMillion: 0.27,
            outputPerMillion: 1.10,
            cacheHitPerMillion: 0.07,
        },
        maxContextTokens: 64000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsJsonMode: true,
        avgLatencyMs: 1500,
        qualityScore: 92,
        baseUrl: 'https://api.deepseek.com/v1',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    },

    'glm-4-flash': {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        provider: 'zai',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation'],
        pricing: {
            inputPerMillion: 0.10,
            outputPerMillion: 0.40,
        },
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsJsonMode: true,
        avgLatencyMs: 400,
        qualityScore: 70,
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },

    // ============================================
    // BALANCED MODELS (Good quality, reasonable cost)
    // ============================================

    // GLM-4.6 via Z.AI - RECOMMENDED POWER MODEL for code generation
    'glm-4.6': {
        id: 'glm-4.6',
        name: 'GLM-4.6 (Z.AI)',
        provider: 'zai',
        tier: 'powerful', // Using as POWER model for code generation
        capabilities: ['analysis', 'code-generation', 'reasoning'],
        pricing: {
            inputPerMillion: 0.50,
            outputPerMillion: 1.50,
        },
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsJsonMode: true,
        avgLatencyMs: 1200,
        qualityScore: 85,
        baseUrl: process.env.OPENAI_BASE_URL || process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4',
        apiKeyEnvVar: 'ZAI_API_KEY',
    },

    'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        tier: 'balanced',
        capabilities: ['analysis', 'code-generation', 'reasoning'],
        pricing: {
            inputPerMillion: 2.50,
            outputPerMillion: 10.00,
        },
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
        supportsJsonMode: true,
        avgLatencyMs: 1000,
        qualityScore: 90,
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },

    // ============================================
    // POWERFUL MODELS (Best quality, higher cost)
    // ============================================

    'claude-3-5-sonnet-20241022': {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        tier: 'powerful',
        capabilities: ['analysis', 'code-generation', 'reasoning'],
        pricing: {
            inputPerMillion: 3.00,
            outputPerMillion: 15.00,
        },
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        supportsJsonMode: false, // Uses tool_use instead
        avgLatencyMs: 2000,
        qualityScore: 95,
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    },

    'gpt-4-turbo': {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        tier: 'powerful',
        capabilities: ['analysis', 'code-generation', 'reasoning'],
        pricing: {
            inputPerMillion: 10.00,
            outputPerMillion: 30.00,
        },
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        supportsJsonMode: true,
        avgLatencyMs: 3000,
        qualityScore: 92,
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
};

// ============================================
// MODEL SELECTION HELPERS
// ============================================

/**
 * Get all models by tier
 */
export function getModelsByTier(tier: ModelTier): ModelConfig[] {
    return Object.values(MODEL_REGISTRY).filter(m => m.tier === tier);
}

/**
 * Get all models by provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
    return Object.values(MODEL_REGISTRY).filter(m => m.provider === provider);
}

/**
 * Get all models that support a specific capability
 */
export function getModelsByCapability(capability: ModelCapability): ModelConfig[] {
    return Object.values(MODEL_REGISTRY).filter(m => m.capabilities.includes(capability));
}

/**
 * Get the cheapest model for a given capability
 */
export function getCheapestModel(capability: ModelCapability): ModelConfig | null {
    const models = getModelsByCapability(capability);
    if (models.length === 0) return null;

    return models.reduce((cheapest, current) => {
        const cheapestCost = cheapest.pricing.inputPerMillion + cheapest.pricing.outputPerMillion;
        const currentCost = current.pricing.inputPerMillion + current.pricing.outputPerMillion;
        return currentCost < cheapestCost ? current : cheapest;
    });
}

/**
 * Get the best quality model for a given capability
 */
export function getBestQualityModel(capability: ModelCapability): ModelConfig | null {
    const models = getModelsByCapability(capability);
    if (models.length === 0) return null;

    return models.reduce((best, current) => {
        return current.qualityScore > best.qualityScore ? current : best;
    });
}

/**
 * Get model by ID
 */
export function getModel(modelId: string): ModelConfig | null {
    return MODEL_REGISTRY[modelId] || null;
}

/**
 * Calculate estimated cost for a request
 */
export function estimateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cacheHit: boolean = false
): number {
    const model = getModel(modelId);
    if (!model) return 0;

    const inputCost = cacheHit && model.pricing.cacheHitPerMillion
        ? (inputTokens / 1_000_000) * model.pricing.cacheHitPerMillion
        : (inputTokens / 1_000_000) * model.pricing.inputPerMillion;

    const outputCost = (outputTokens / 1_000_000) * model.pricing.outputPerMillion;

    return inputCost + outputCost;
}

/**
 * Get recommended model pair for multi-model pipeline
 * Returns [fastModel, powerfulModel]
 */
export function getRecommendedModelPair(): [ModelConfig, ModelConfig] {
    // Recommended: DeepSeek V3 via OpenRouter (FAST) + GLM-4.6 via Z.AI (POWER)
    const fastModel = MODEL_REGISTRY['deepseek/deepseek-chat'] || MODEL_REGISTRY['gpt-4o-mini'];
    const powerfulModel = MODEL_REGISTRY['glm-4.6'] || MODEL_REGISTRY['deepseek/deepseek-chat'];

    return [fastModel, powerfulModel];
}

/**
 * Check if API key is configured for a provider
 */
export function isProviderConfigured(provider: ModelProvider): boolean {
    const config = PROVIDER_CONFIGS[provider];

    // Special case for Z.AI - check both OPENAI_API_KEY and ZAI_API_KEY
    if (provider === 'zai') {
        return !!(process.env.OPENAI_API_KEY || process.env.ZAI_API_KEY);
    }

    return !!process.env[config.apiKeyEnvVar];
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(): ModelProvider[] {
    return Object.keys(PROVIDER_CONFIGS).filter(
        provider => isProviderConfigured(provider as ModelProvider)
    ) as ModelProvider[];
}

/**
 * Get all available models (those with configured API keys)
 */
export function getAvailableModels(): ModelConfig[] {
    return Object.values(MODEL_REGISTRY).filter(model =>
        isProviderConfigured(model.provider)
    );
}
