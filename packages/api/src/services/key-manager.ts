/**
 * Key Manager
 * Manages AI provider API keys with rotation, failover, and cost tracking
 */

import { EventEmitter } from 'events';

/**
 * Supported AI providers
 */
export type AIProvider = 'openai' | 'anthropic' | 'zai';

/**
 * Key status
 */
export type KeyStatus = 'active' | 'rate_limited' | 'error' | 'exhausted';

/**
 * Individual key metadata
 */
export interface KeyMetadata {
    key: string;
    provider: AIProvider;
    status: KeyStatus;
    usageCount: number;
    rateLimitHits: number;
    lastUsed: Date | null;
    lastError: string | null;
    tokensUsed: number;
    estimatedCost: number;
    blacklistedUntil: Date | null;
}

/**
 * Key selection strategy
 */
export type SelectionStrategy = 'round-robin' | 'least-used' | 'random';

/**
 * Key manager configuration
 */
export interface KeyManagerConfig {
    /** Selection strategy (default: round-robin) */
    strategy?: SelectionStrategy;

    /** How long to blacklist a key after rate limit (ms) */
    blacklistDuration?: number;

    /** Max retries before giving up */
    maxRetries?: number;

    /** Enable cost tracking */
    trackCosts?: boolean;
}

/**
 * Cost per 1K tokens for different models (approximate)
 */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'glm-4': { input: 0.001, output: 0.001 },
};

/**
 * KeyManager - Manages API keys with rotation and failover
 */
export class KeyManager extends EventEmitter {
    private keys: Map<AIProvider, KeyMetadata[]> = new Map();
    private currentIndex: Map<AIProvider, number> = new Map();
    private config: Required<KeyManagerConfig>;

    constructor(config: KeyManagerConfig = {}) {
        super();
        this.config = {
            strategy: config.strategy || 'round-robin',
            blacklistDuration: config.blacklistDuration || 60000, // 1 minute
            maxRetries: config.maxRetries || 3,
            trackCosts: config.trackCosts ?? true,
        };

        // Initialize from environment
        this.loadKeysFromEnv();
    }

    /**
     * Load keys from environment variables
     */
    private loadKeysFromEnv(): void {
        // OpenAI keys
        const openaiKeys = process.env.OPENAI_KEYS?.split(',').filter(k => k.trim()) || [];
        if (process.env.OPENAI_API_KEY) {
            openaiKeys.unshift(process.env.OPENAI_API_KEY);
        }
        this.registerKeys('openai', openaiKeys);

        // Anthropic keys
        const anthropicKeys = process.env.ANTHROPIC_KEYS?.split(',').filter(k => k.trim()) || [];
        if (process.env.ANTHROPIC_API_KEY) {
            anthropicKeys.unshift(process.env.ANTHROPIC_API_KEY);
        }
        this.registerKeys('anthropic', anthropicKeys);

        // Z.AI keys (GLM-4)
        const zaiKeys = process.env.ZAI_KEYS?.split(',').filter(k => k.trim()) || [];
        if (process.env.ZAI_API_KEY) {
            zaiKeys.unshift(process.env.ZAI_API_KEY);
        }
        this.registerKeys('zai', zaiKeys);

        console.log('[KEY-MANAGER] Initialized:');
        console.log(`   OpenAI: ${this.keys.get('openai')?.length || 0} keys`);
        console.log(`   Anthropic: ${this.keys.get('anthropic')?.length || 0} keys`);
        console.log(`   Z.AI: ${this.keys.get('zai')?.length || 0} keys`);
    }

    /**
     * Register keys for a provider
     */
    private registerKeys(provider: AIProvider, keys: string[]): void {
        const keyMetadata: KeyMetadata[] = keys.map(key => ({
            key: key.trim(),
            provider,
            status: 'active',
            usageCount: 0,
            rateLimitHits: 0,
            lastUsed: null,
            lastError: null,
            tokensUsed: 0,
            estimatedCost: 0,
            blacklistedUntil: null,
        }));

        this.keys.set(provider, keyMetadata);
        this.currentIndex.set(provider, 0);
    }

    /**
     * Get the next available key for a provider
     */
    getKey(provider: AIProvider): string | null {
        const providerKeys = this.keys.get(provider);
        if (!providerKeys || providerKeys.length === 0) {
            return null;
        }

        const now = new Date();

        // Clear expired blacklists
        for (const keyMeta of providerKeys) {
            if (keyMeta.blacklistedUntil && keyMeta.blacklistedUntil <= now) {
                keyMeta.blacklistedUntil = null;
                keyMeta.status = 'active';
            }
        }

        // Get available keys
        const availableKeys = providerKeys.filter(k =>
            k.status === 'active' && !k.blacklistedUntil
        );

        if (availableKeys.length === 0) {
            this.emit('allKeysExhausted', provider);
            return null;
        }

        // Select key based on strategy
        let selectedKey: KeyMetadata;

        switch (this.config.strategy) {
            case 'least-used':
                selectedKey = availableKeys.reduce((min, k) =>
                    k.usageCount < min.usageCount ? k : min
                );
                break;

            case 'random':
                selectedKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
                break;

            case 'round-robin':
            default:
                const currentIdx = this.currentIndex.get(provider) || 0;
                selectedKey = availableKeys[currentIdx % availableKeys.length];
                this.currentIndex.set(provider, (currentIdx + 1) % availableKeys.length);
                break;
        }

        // Update usage
        selectedKey.usageCount++;
        selectedKey.lastUsed = now;

        return selectedKey.key;
    }

    /**
     * Report a rate limit hit for a key
     */
    reportRateLimit(provider: AIProvider, key: string): void {
        const keyMeta = this.findKey(provider, key);
        if (!keyMeta) return;

        keyMeta.rateLimitHits++;
        keyMeta.status = 'rate_limited';
        keyMeta.blacklistedUntil = new Date(Date.now() + this.config.blacklistDuration);
        keyMeta.lastError = 'Rate limited (429)';

        this.emit('rateLimited', { provider, key: this.maskKey(key) });
        console.warn(`[KEY-MANAGER] Key ${this.maskKey(key)} rate limited. Blacklisted for ${this.config.blacklistDuration / 1000}s`);
    }

    /**
     * Report an error for a key
     */
    reportError(provider: AIProvider, key: string, errorMessage: string): void {
        const keyMeta = this.findKey(provider, key);
        if (!keyMeta) return;

        keyMeta.status = 'error';
        keyMeta.lastError = errorMessage;
        // Briefly blacklist on errors
        keyMeta.blacklistedUntil = new Date(Date.now() + 10000); // 10 seconds

        this.emit('keyError', { provider, key: this.maskKey(key), error: errorMessage });
    }

    /**
     * Report successful usage and tokens consumed
     */
    reportUsage(
        provider: AIProvider,
        key: string,
        model: string,
        tokensUsed: { input: number; output: number }
    ): void {
        const keyMeta = this.findKey(provider, key);
        if (!keyMeta) return;

        const totalTokens = tokensUsed.input + tokensUsed.output;
        keyMeta.tokensUsed += totalTokens;
        keyMeta.status = 'active';

        // Calculate cost
        if (this.config.trackCosts) {
            const costs = MODEL_COSTS[model] || { input: 0.01, output: 0.03 };
            const cost = (tokensUsed.input / 1000 * costs.input) +
                (tokensUsed.output / 1000 * costs.output);
            keyMeta.estimatedCost += cost;
        }
    }

    /**
     * Execute with automatic key rotation and failover
     */
    async executeWithRotation<T>(
        provider: AIProvider,
        operation: (apiKey: string) => Promise<T>
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            const key = this.getKey(provider);

            if (!key) {
                throw new Error(`No available keys for provider: ${provider}`);
            }

            try {
                const result = await operation(key);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const errorMessage = lastError.message.toLowerCase();

                // Handle rate limits
                if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
                    this.reportRateLimit(provider, key);
                } else if (errorMessage.includes('500') || errorMessage.includes('internal')) {
                    this.reportError(provider, key, lastError.message);
                } else {
                    // Unknown error - don't rotate
                    throw lastError;
                }

                // Continue to next attempt with different key
                console.log(`[KEY-MANAGER] Retrying with different key (attempt ${attempt + 2}/${this.config.maxRetries})`);
            }
        }

        throw lastError || new Error('All retry attempts failed');
    }

    /**
     * Find a key's metadata
     */
    private findKey(provider: AIProvider, key: string): KeyMetadata | undefined {
        return this.keys.get(provider)?.find(k => k.key === key);
    }

    /**
     * Mask a key for logging (show first 8 and last 4 chars)
     */
    private maskKey(key: string): string {
        if (key.length <= 12) return '***';
        return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
    }

    /**
     * Get statistics for all keys
     */
    getStats(): Record<AIProvider, {
        totalKeys: number;
        activeKeys: number;
        rateLimitedKeys: number;
        totalUsage: number;
        totalTokens: number;
        estimatedCost: number;
    }> {
        const stats: Record<string, unknown> = {};

        for (const [provider, keys] of this.keys) {
            const activeKeys = keys.filter(k => k.status === 'active' && !k.blacklistedUntil).length;
            const rateLimitedKeys = keys.filter(k => k.status === 'rate_limited').length;

            stats[provider] = {
                totalKeys: keys.length,
                activeKeys,
                rateLimitedKeys,
                totalUsage: keys.reduce((sum, k) => sum + k.usageCount, 0),
                totalTokens: keys.reduce((sum, k) => sum + k.tokensUsed, 0),
                estimatedCost: Number(keys.reduce((sum, k) => sum + k.estimatedCost, 0).toFixed(4)),
            };
        }

        return stats as Record<AIProvider, {
            totalKeys: number;
            activeKeys: number;
            rateLimitedKeys: number;
            totalUsage: number;
            totalTokens: number;
            estimatedCost: number;
        }>;
    }

    /**
     * Get total estimated cost across all providers
     */
    getTotalCost(): number {
        let total = 0;
        for (const keys of this.keys.values()) {
            total += keys.reduce((sum, k) => sum + k.estimatedCost, 0);
        }
        return Number(total.toFixed(4));
    }

    /**
     * Check if a provider has any available keys
     */
    hasAvailableKeys(provider: AIProvider): boolean {
        const providerKeys = this.keys.get(provider);
        if (!providerKeys) return false;

        const now = new Date();
        return providerKeys.some(k =>
            k.status === 'active' &&
            (!k.blacklistedUntil || k.blacklistedUntil <= now)
        );
    }

    /**
     * Refresh a provider's keys (clear blacklists)
     */
    refreshProvider(provider: AIProvider): void {
        const providerKeys = this.keys.get(provider);
        if (!providerKeys) return;

        for (const key of providerKeys) {
            key.blacklistedUntil = null;
            key.status = 'active';
        }

        console.log(`[KEY-MANAGER] Refreshed all keys for ${provider}`);
    }
}

// Export singleton instance
let keyManagerInstance: KeyManager | null = null;

export function getKeyManager(): KeyManager {
    if (!keyManagerInstance) {
        keyManagerInstance = new KeyManager();
    }
    return keyManagerInstance;
}

export function createKeyManager(config?: KeyManagerConfig): KeyManager {
    keyManagerInstance = new KeyManager(config);
    return keyManagerInstance;
}
