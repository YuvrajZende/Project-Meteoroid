/**
 * OAuth State Service
 * Secure state management for OAuth flows (CSRF protection)
 * 
 * Implements cryptographically secure state tokens with:
 * - Automatic expiration
 * - Single-use enforcement
 * - Associated data binding
 * 
 * @module services/oauth-state-service
 */

import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

/**
 * OAuth state configuration
 */
export interface OAuthStateConfig {
    /** State token expiry in milliseconds (default: 10 minutes) */
    expiryMs: number;
    /** Maximum stored states per user (default: 10) */
    maxStatesPerUser: number;
    /** Clean up interval in milliseconds (default: 1 minute) */
    cleanupIntervalMs: number;
}

/**
 * Stored state data
 */
export interface StoredState {
    /** The state token */
    state: string;
    /** OAuth provider (github, google, etc.) */
    provider: string;
    /** User ID or session ID */
    userId?: string;
    /** Additional data to pass through OAuth flow */
    metadata?: Record<string, unknown>;
    /** Redirect URL after OAuth */
    redirectUri?: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Expiration timestamp */
    expiresAt: Date;
    /** Whether the state has been used */
    used: boolean;
}

/**
 * State validation result
 */
export interface StateValidationResult {
    valid: boolean;
    expired: boolean;
    alreadyUsed: boolean;
    data: StoredState | null;
    error?: string;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: OAuthStateConfig = {
    expiryMs: 10 * 60 * 1000,       // 10 minutes
    maxStatesPerUser: 10,            // Prevent memory exhaustion
    cleanupIntervalMs: 60 * 1000,    // 1 minute
};

// ============================================
// OAUTH STATE SERVICE CLASS
// ============================================

/**
 * OAuth State Service
 * Manages secure state tokens for OAuth flows
 */
export class OAuthStateService {
    private config: OAuthStateConfig;
    private states: Map<string, StoredState> = new Map();
    private userStates: Map<string, Set<string>> = new Map();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;
    private initialized: boolean = false;

    constructor(config?: Partial<OAuthStateConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the OAuth state service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredStates();
        }, this.config.cleanupIntervalMs);

        this.initialized = true;
    }

    /**
     * Generate a new state token
     * @param provider - OAuth provider name
     * @param userId - Optional user ID to associate
     * @param metadata - Optional metadata to pass through
     * @param redirectUri - Optional redirect URI after OAuth
     * @returns Generated state token
     */
    generateState(
        provider: string,
        userId?: string,
        metadata?: Record<string, unknown>,
        redirectUri?: string
    ): string {
        // Generate cryptographically secure state
        const state = crypto.randomBytes(32).toString('base64url');

        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.config.expiryMs);

        const storedState: StoredState = {
            state,
            provider,
            userId,
            metadata,
            redirectUri,
            createdAt: now,
            expiresAt,
            used: false,
        };

        // Store the state
        this.states.set(state, storedState);

        // Track by user if provided
        if (userId) {
            let userStateSet = this.userStates.get(userId);
            if (!userStateSet) {
                userStateSet = new Set();
                this.userStates.set(userId, userStateSet);
            }

            // Enforce max states per user
            if (userStateSet.size >= this.config.maxStatesPerUser) {
                // Remove oldest state for this user
                const oldest = userStateSet.values().next().value;
                if (oldest) {
                    this.states.delete(oldest);
                    userStateSet.delete(oldest);
                }
            }

            userStateSet.add(state);
        }

        return state;
    }

    /**
     * Validate and consume a state token
     * @param state - State token to validate
     * @param provider - Expected OAuth provider
     * @returns Validation result with associated data
     */
    validateState(state: string, provider: string): StateValidationResult {
        const storedState = this.states.get(state);

        // Check if state exists
        if (!storedState) {
            return {
                valid: false,
                expired: false,
                alreadyUsed: false,
                data: null,
                error: 'Invalid state token',
            };
        }

        // Check if provider matches
        if (storedState.provider !== provider) {
            return {
                valid: false,
                expired: false,
                alreadyUsed: false,
                data: storedState,
                error: 'Provider mismatch',
            };
        }

        // Check if already used
        if (storedState.used) {
            return {
                valid: false,
                expired: false,
                alreadyUsed: true,
                data: storedState,
                error: 'State already used',
            };
        }

        // Check if expired
        if (new Date() > storedState.expiresAt) {
            // Clean up expired state
            this.deleteState(state);
            return {
                valid: false,
                expired: true,
                alreadyUsed: false,
                data: storedState,
                error: 'State expired',
            };
        }

        // Mark as used (single-use)
        storedState.used = true;

        // Schedule cleanup (delete after a short delay to prevent replay)
        setTimeout(() => {
            this.deleteState(state);
        }, 5000); // 5 second grace period

        return {
            valid: true,
            expired: false,
            alreadyUsed: false,
            data: storedState,
        };
    }

    /**
     * Consume and delete a state token (for immediate cleanup)
     */
    consumeState(state: string): StoredState | null {
        const storedState = this.states.get(state);
        if (storedState) {
            this.deleteState(state);
        }
        return storedState || null;
    }

    /**
     * Delete a state token
     */
    private deleteState(state: string): void {
        const storedState = this.states.get(state);
        if (storedState) {
            // Remove from user tracking
            if (storedState.userId) {
                const userStateSet = this.userStates.get(storedState.userId);
                if (userStateSet) {
                    userStateSet.delete(state);
                    if (userStateSet.size === 0) {
                        this.userStates.delete(storedState.userId);
                    }
                }
            }
            this.states.delete(state);
        }
    }

    /**
     * Clean up expired states
     */
    private cleanupExpiredStates(): void {
        const now = new Date();
        let cleaned = 0;

        for (const [state, data] of this.states.entries()) {
            if (now > data.expiresAt) {
                this.deleteState(state);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[OAUTH-STATE] Cleaned up ${cleaned} expired states`);
        }
    }

    /**
     * Revoke all states for a user
     */
    revokeUserStates(userId: string): number {
        const userStateSet = this.userStates.get(userId);
        if (!userStateSet) return 0;

        const count = userStateSet.size;
        for (const state of userStateSet) {
            this.states.delete(state);
        }
        this.userStates.delete(userId);

        return count;
    }

    /**
     * Get state count (for monitoring)
     */
    getStateCount(): number {
        return this.states.size;
    }

    /**
     * Get state count for a user
     */
    getUserStateCount(userId: string): number {
        return this.userStates.get(userId)?.size || 0;
    }

    /**
     * Build OAuth authorization URL with state
     */
    buildAuthorizationUrl(
        baseUrl: string,
        clientId: string,
        redirectUri: string,
        scope: string,
        state: string,
        additionalParams?: Record<string, string>
    ): string {
        const url = new URL(baseUrl);
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', scope);
        url.searchParams.set('state', state);
        url.searchParams.set('response_type', 'code');

        if (additionalParams) {
            for (const [key, value] of Object.entries(additionalParams)) {
                url.searchParams.set(key, value);
            }
        }

        return url.toString();
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.states.clear();
        this.userStates.clear();
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: OAuthStateService | null = null;

/**
 * Get the singleton OAuthStateService instance
 */
export function getOAuthStateService(): OAuthStateService {
    if (!instance) {
        instance = new OAuthStateService();
    }
    return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetOAuthStateService(): void {
    if (instance) {
        instance.shutdown();
    }
    instance = null;
}
