/**
 * Model Registry - Production-Grade AI Model Configuration
 *
 * Comprehensive registry of all supported AI models with:
 * - Pricing information (per 1M tokens)
 * - Speed classification (fast vs powerful)
 * - Provider-specific configuration
 * - Automatic model selection (first model whose API key is configured)
 */

// ============================================
// TYPES
// ============================================

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'zai' | 'together' | 'openrouter' | 'groq';
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
    /** False for models that reject temperature/top_p (e.g. Claude Opus 5.5 / Sonnet 5.5). */
    supportsTemperature: boolean;
    avgLatencyMs: number; // Average response time
    qualityScore: number; // 0-100, subjective quality rating
    baseUrl: string;
    apiKeyEnvVar: string;
    /** Same model on OpenRouter, used when calls go through the OpenRouter gateway. */
    openrouterId?: string;
    /** Model name sent to the API when it differs from `id` (set for gateway-routed models). */
    apiModelId?: string;
}

export interface ProviderConfig {
    name: ModelProvider;
    displayName: string;
    baseUrl: string;
    apiKeyEnvVar: string;
    headers?: Record<string, string>;
}

// Z.AI must never derive from OPENAI_BASE_URL / OPENAI_API_KEY: each provider uses only its own key.
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4';
const OPENAI_URL = 'https://api.openai.com/v1';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const GROQ_URL = 'https://api.groq.com/openai/v1';

// ============================================
// PROVIDER CONFIGURATIONS
// ============================================

export const PROVIDER_CONFIGS: Record<ModelProvider, ProviderConfig> = {
    openai: {
        name: 'openai',
        displayName: 'OpenAI',
        baseUrl: OPENAI_URL,
        apiKeyEnvVar: 'OPENAI_API_KEY',
    },
    anthropic: {
        name: 'anthropic',
        displayName: 'Anthropic',
        baseUrl: ANTHROPIC_URL,
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
        headers: {
            'anthropic-version': '2023-06-01',
        },
    },
    deepseek: {
        name: 'deepseek',
        displayName: 'DeepSeek',
        baseUrl: DEEPSEEK_URL,
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    },
    zai: {
        name: 'zai',
        displayName: 'Z.AI (GLM)',
        baseUrl: ZAI_BASE_URL,
        apiKeyEnvVar: 'ZAI_API_KEY',
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
        baseUrl: OPENROUTER_URL,
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        headers: {
            'HTTP-Referer': 'https://github.com/meteoroid',
            'X-Title': 'Meteoroid',
        },
    },
    groq: {
        name: 'groq',
        displayName: 'Groq',
        baseUrl: GROQ_URL,
        apiKeyEnvVar: 'GROQ_API_KEY',
    },
};

// ============================================
// MODEL REGISTRY
// ============================================
// IDs verified Oct 2026 against provider docs (Groq, OpenAI, DeepSeek, Anthropic,
// OpenRouter). Prices are USD per 1M tokens. Entries marked "approx" could not be
// confirmed from a public price list. DeepSeek prices use the peak-hour rate
// (off-peak is 50% cheaper).

type ModelInit = Omit<ModelConfig, 'supportsStreaming' | 'supportsJsonMode' | 'supportsTemperature' | 'baseUrl' | 'apiKeyEnvVar'>
    & Partial<Pick<ModelConfig, 'supportsJsonMode' | 'supportsTemperature' | 'baseUrl'>>;

function defineModel(init: ModelInit): ModelConfig {
    const provider = PROVIDER_CONFIGS[init.provider];
    return {
        supportsStreaming: true,
        supportsJsonMode: true,
        // Current OpenAI reasoning models reject non-default temperature; omitting it is always safe.
        supportsTemperature: init.provider !== 'openai',
        baseUrl: provider.baseUrl,
        apiKeyEnvVar: provider.apiKeyEnvVar,
        ...init,
    };
}

const MODELS: ModelConfig[] = [
    // ============================================
    // FAST MODELS (analysis, context preparation)
    // ============================================

    // Groq production (~280 tok/s). Price approx: Groq now lists Llama as enterprise pricing.
    defineModel({
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile (Groq)',
        provider: 'groq',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation', 'reasoning'],
        pricing: { inputPerMillion: 0.59, outputPerMillion: 0.79 },
        maxContextTokens: 131072,
        maxOutputTokens: 32768,
        avgLatencyMs: 200,
        qualityScore: 86,
    }),
    // Groq production (~500 tok/s). Reasoning model: spends hidden tokens before answering.
    defineModel({
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B (Groq)',
        provider: 'groq',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation', 'reasoning'],
        pricing: { inputPerMillion: 0.15, outputPerMillion: 0.60, cacheHitPerMillion: 0.075 },
        maxContextTokens: 131072,
        maxOutputTokens: 65536,
        avgLatencyMs: 250,
        qualityScore: 88,
    }),
    // Groq production (~1000 tok/s). Output price approx.
    defineModel({
        id: 'openai/gpt-oss-20b',
        name: 'GPT-OSS 20B (Groq)',
        provider: 'groq',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation'],
        pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 },
        maxContextTokens: 131072,
        maxOutputTokens: 65536,
        avgLatencyMs: 150,
        qualityScore: 80,
    }),
    // Groq production. Price approx.
    defineModel({
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant (Groq)',
        provider: 'groq',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation'],
        pricing: { inputPerMillion: 0.05, outputPerMillion: 0.08 },
        maxContextTokens: 131072,
        maxOutputTokens: 8192,
        avgLatencyMs: 100,
        qualityScore: 72,
    }),
    defineModel({
        id: 'gpt-6-luna',
        name: 'GPT-6 Luna',
        provider: 'openai',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation', 'reasoning'],
        pricing: { inputPerMillion: 0.10, outputPerMillion: 0.50 },
        maxContextTokens: 1050000,
        maxOutputTokens: 128000,
        avgLatencyMs: 600,
        qualityScore: 85,
    }),
    defineModel({
        id: 'deepseek-flash',
        name: 'DeepSeek V4.1 Flash (Direct)',
        provider: 'deepseek',
        tier: 'fast',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: { inputPerMillion: 0.30, outputPerMillion: 1.20, cacheHitPerMillion: 0.006 },
        maxContextTokens: 1000000,
        maxOutputTokens: 384000,
        avgLatencyMs: 900,
        qualityScore: 88,
    }),
    defineModel({
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        provider: 'anthropic',
        tier: 'fast',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: { inputPerMillion: 1.00, outputPerMillion: 5.00, cacheHitPerMillion: 0.10 },
        maxContextTokens: 200000,
        maxOutputTokens: 64000,
        supportsJsonMode: false,
        avgLatencyMs: 700,
        qualityScore: 88,
    }),
    // Legacy OpenRouter alias - availability and pricing not re-verified (approx).
    defineModel({
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek Chat (OpenRouter)',
        provider: 'openrouter',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation', 'reasoning'],
        pricing: { inputPerMillion: 0.14, outputPerMillion: 0.28 },
        maxContextTokens: 64000,
        maxOutputTokens: 8192,
        avgLatencyMs: 800,
        qualityScore: 85,
    }),
    // Z.AI - not re-verified; kept for entity-extractor compatibility. Price approx.
    defineModel({
        id: 'glm-4-flash',
        name: 'GLM-4 Flash (Z.AI)',
        provider: 'zai',
        tier: 'fast',
        capabilities: ['analysis', 'context-preparation'],
        pricing: { inputPerMillion: 0.10, outputPerMillion: 0.40 },
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
        avgLatencyMs: 400,
        qualityScore: 70,
    }),

    // ============================================
    // BALANCED MODELS
    // ============================================

    // Z.AI - not re-verified; optional. Price approx.
    defineModel({
        id: 'glm-4.6',
        name: 'GLM-4.6 (Z.AI)',
        provider: 'zai',
        tier: 'balanced',
        capabilities: ['analysis', 'code-generation', 'reasoning'],
        pricing: { inputPerMillion: 0.50, outputPerMillion: 1.50 },
        maxContextTokens: 128000,
        maxOutputTokens: 8192,
        avgLatencyMs: 1200,
        qualityScore: 85,
    }),
    defineModel({
        id: 'gpt-6.1-sol',
        name: 'GPT-6.1 Sol',
        provider: 'openai',
        tier: 'balanced',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: { inputPerMillion: 2.00, outputPerMillion: 10.00 },
        maxContextTokens: 1050000,
        maxOutputTokens: 128000,
        avgLatencyMs: 1500,
        qualityScore: 94,
    }),
    defineModel({
        id: 'claude-sonnet-5-5',
        name: 'Claude Sonnet 5.5',
        provider: 'anthropic',
        tier: 'balanced',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: { inputPerMillion: 2.00, outputPerMillion: 10.00, cacheHitPerMillion: 0.20 },
        maxContextTokens: 1000000,
        maxOutputTokens: 128000,
        supportsJsonMode: false,
        supportsTemperature: false,
        avgLatencyMs: 1800,
        qualityScore: 96,
    }),

    // ============================================
    // POWERFUL MODELS (code generation)
    // ============================================

    // DEFAULT POWER MODEL. (The former `qwen/qwen3.6-plus:free` id does not exist on OpenRouter.)
    // Paid OpenRouter variant. Price and context approx.
    defineModel({
        id: 'qwen/qwen3.6-plus',
        name: 'Qwen3.6 Plus (OpenRouter)',
        provider: 'openrouter',
        tier: 'powerful',
        capabilities: ['analysis', 'code-generation', 'reasoning'],
        pricing: { inputPerMillion: 0.40, outputPerMillion: 2.40 },
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        avgLatencyMs: 1500,
        qualityScore: 88,
    }),
    defineModel({
        id: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro (Direct)',
        provider: 'deepseek',
        tier: 'powerful',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: { inputPerMillion: 1.32, outputPerMillion: 3.96, cacheHitPerMillion: 0.044 },
        maxContextTokens: 1000000,
        maxOutputTokens: 384000,
        avgLatencyMs: 2000,
        qualityScore: 93,
    }),
    defineModel({
        id: 'claude-opus-5-5',
        name: 'Claude Opus 5.5',
        provider: 'anthropic',
        tier: 'powerful',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: { inputPerMillion: 4.00, outputPerMillion: 20.00, cacheHitPerMillion: 0.20 },
        maxContextTokens: 1000000,
        maxOutputTokens: 128000,
        supportsJsonMode: false,
        supportsTemperature: false,
        avgLatencyMs: 2500,
        qualityScore: 98,
    }),
    defineModel({
        id: 'gpt-6-astra',
        name: 'GPT-6 Astra',
        provider: 'openai',
        tier: 'powerful',
        capabilities: ['analysis', 'code-generation', 'reasoning', 'context-preparation'],
        pricing: { inputPerMillion: 10.00, outputPerMillion: 50.00 },
        maxContextTokens: 1050000,
        maxOutputTokens: 128000,
        avgLatencyMs: 3000,
        qualityScore: 97,
    }),
];

/** OpenRouter ids for registry models (verified against openrouter.ai/api/v1/models, Oct 2026). */
const OPENROUTER_IDS: Record<string, string> = {
    'llama-3.3-70b-versatile': 'meta-llama/llama-3.3-70b-instruct',
    'llama-3.1-8b-instant': 'meta-llama/llama-3.1-8b-instruct',
    'openai/gpt-oss-120b': 'openai/gpt-oss-120b',
    'openai/gpt-oss-20b': 'openai/gpt-oss-20b',
    'gpt-6-luna': 'openai/gpt-6-luna',
    'gpt-6.1-sol': 'openai/gpt-6.1-sol',
    'gpt-6-astra': 'openai/gpt-6-astra',
    'deepseek-flash': 'deepseek/deepseek-v4.1-flash',
    'deepseek-v4-pro': 'deepseek/deepseek-v4-pro',
    'claude-haiku-4-5-20251001': 'anthropic/claude-haiku-4.5',
    'claude-sonnet-5-5': 'anthropic/claude-sonnet-5.5',
    'claude-opus-5-5': 'anthropic/claude-opus-5.5',
    'glm-4.6': 'z-ai/glm-4.6',
};

export const MODEL_REGISTRY: Record<string, ModelConfig> = Object.fromEntries(
    MODELS.map(model => [
        model.id,
        { ...model, openrouterId: model.provider === 'openrouter' ? model.id : OPENROUTER_IDS[model.id] },
    ])
);

// ============================================
// OPENROUTER GATEWAY
// ============================================

/**
 * With OPENROUTER_API_KEY set, every model call (planner, builder, fallback, chat, sub-agents,
 * custom agents) goes through OpenRouter using that single key. AI_GATEWAY=direct opts out and
 * uses each provider's own key instead.
 */
export function isGatewayEnabled(): boolean {
    const mode = (process.env.AI_GATEWAY ?? 'auto').trim().toLowerCase();
    if (mode === 'direct' || mode === 'off' || mode === 'none') return false;
    return !!process.env.OPENROUTER_API_KEY;
}

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL_ID = /^[a-z0-9-]+\/[\w.:-]+$/i;

function viaGateway(model: ModelConfig): ModelConfig | null {
    if (!model.openrouterId) return null;
    return {
        ...model,
        provider: 'openrouter',
        baseUrl: OPENROUTER_BASE,
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        apiModelId: model.openrouterId,
    };
}

/** Any "vendor/model" id works through the gateway, even if it isn't in the registry. */
function adHocOpenRouterModel(id: string): ModelConfig {
    return {
        id,
        name: `${id} (OpenRouter)`,
        provider: 'openrouter',
        tier: 'powerful',
        capabilities: ['analysis', 'code-generation', 'reasoning'],
        pricing: { inputPerMillion: 0, outputPerMillion: 0 }, // unknown here; OpenRouter bills per its catalog
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        supportsStreaming: true,
        supportsJsonMode: true,
        supportsTemperature: true,
        avgLatencyMs: 2000,
        qualityScore: 80,
        baseUrl: OPENROUTER_BASE,
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        openrouterId: id,
        apiModelId: id,
    };
}

// ============================================
// MODEL SELECTION HELPERS
// ============================================

/**
 * Get all models by tier
 */
export function getModelsByTier(tier: ModelTier): ModelConfig[] {
    return MODELS.filter(m => m.tier === tier);
}

/**
 * Get all models by provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
    return MODELS.filter(m => m.provider === provider);
}

/**
 * Get all models that support a specific capability
 */
export function getModelsByCapability(capability: ModelCapability): ModelConfig[] {
    return MODELS.filter(m => m.capabilities.includes(capability));
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
    const registered = MODEL_REGISTRY[modelId];
    if (!isGatewayEnabled()) return registered ?? null;
    if (registered) return viaGateway(registered) ?? registered;
    return OPENROUTER_MODEL_ID.test(modelId) ? adHocOpenRouterModel(modelId) : null;
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

/** Fallback priority for the fast (analysis) stage. First model with a configured key wins. */
export const FAST_MODEL_PRIORITY: readonly string[] = [
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b',
    'deepseek-flash',
    'gpt-6-luna',
    'claude-haiku-4-5-20251001',
    'deepseek/deepseek-chat',
];

/** Fallback priority for the power (generation) stage. First model with a configured key wins. */
export const POWER_MODEL_PRIORITY: readonly string[] = [
    'qwen/qwen3.6-plus',
    'deepseek-v4-pro',
    'claude-sonnet-5-5',
    'gpt-6.1-sol',
    'claude-opus-5-5',
];

/**
 * True when the model's own provider API key is set in process.env.
 */
export function isModelConfigured(model: ModelConfig): boolean {
    return !!process.env[model.apiKeyEnvVar];
}

function pickFirstConfigured(ids: readonly string[], exclude?: string): ModelConfig {
    for (const id of ids) {
        const model = getModel(id);
        if (model && model.id !== exclude && isModelConfigured(model)) return model;
    }
    // Nothing configured: return the top choice so errors name a real model/key.
    return getModel(ids[0]) ?? MODEL_REGISTRY[ids[0]];
}

/**
 * Get recommended model pair for multi-model pipeline.
 * Returns [fastModel, powerfulModel], each the first in its priority list whose API key is set.
 */
export function getRecommendedModelPair(): [ModelConfig, ModelConfig] {
    return [pickFirstConfigured(FAST_MODEL_PRIORITY), pickFirstConfigured(POWER_MODEL_PRIORITY)];
}

/**
 * Get a configured power-tier fallback model different from `excludeId`, or null.
 */
export function getPowerFallbackModel(excludeId: string): ModelConfig | null {
    const model = pickFirstConfigured(POWER_MODEL_PRIORITY, excludeId);
    return model.id !== excludeId && isModelConfigured(model) ? model : null;
}

/**
 * Get model pair based on environment configuration (FAST_MODEL_NAME / POWER_MODEL_NAME).
 * The env-selected model is used when it exists and its key is set; otherwise the first
 * configured model from the priority list.
 */
export function getConfiguredModelPair(): [ModelConfig, ModelConfig] {
    const resolve = (envName: string | undefined, priority: readonly string[]): ModelConfig => {
        const chosen = envName ? getModel(envName) ?? undefined : undefined;
        if (chosen && isModelConfigured(chosen)) return chosen;
        if (envName && !chosen) {
            console.warn(`[MODEL-REGISTRY] Unknown model "${envName}", using first configured fallback`);
        }
        return pickFirstConfigured(priority);
    };

    // In gateway mode OPENROUTER_*_MODEL take precedence and may be any OpenRouter model id.
    const gateway = isGatewayEnabled();
    return [
        resolve((gateway && process.env.OPENROUTER_FAST_MODEL) || process.env.FAST_MODEL_NAME, FAST_MODEL_PRIORITY),
        resolve((gateway && process.env.OPENROUTER_POWER_MODEL) || process.env.POWER_MODEL_NAME, POWER_MODEL_PRIORITY),
    ];
}

/**
 * List all available models for CLI selection
 */
export function listAllModels(): { fast: ModelConfig[]; balanced: ModelConfig[]; powerful: ModelConfig[] } {
    return {
        fast: getModelsByTier('fast'),
        balanced: getModelsByTier('balanced'),
        powerful: getModelsByTier('powerful'),
    };
}

/**
 * Check if API key is configured for a provider
 */
export function isProviderConfigured(provider: ModelProvider): boolean {
    return !!process.env[PROVIDER_CONFIGS[provider].apiKeyEnvVar];
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(): ModelProvider[] {
    return (Object.keys(PROVIDER_CONFIGS) as ModelProvider[]).filter(isProviderConfigured);
}

/**
 * Get all available models (those with configured API keys)
 */
export function getAvailableModels(): ModelConfig[] {
    return MODELS.filter(isModelConfigured);
}
