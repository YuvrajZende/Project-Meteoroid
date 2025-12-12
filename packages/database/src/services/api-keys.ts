/**
 * API Keys Service
 * Database operations for user-generated API keys
 */

import { randomBytes, createHash } from 'crypto';
import { getSupabaseAdmin } from '../client.js';

/**
 * API Key entity
 */
export interface ApiKey {
    id: string;
    user_id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    scopes: string[];
    expires_at: string | null;
    last_used_at: string | null;
    created_at: string;
}

/**
 * API Key scopes
 */
export type ApiKeyScope = 'read' | 'write' | 'admin';

/**
 * API Key insert DTO
 */
export interface ApiKeyInsert {
    user_id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    scopes?: string[];
    expires_at?: string | null;
}

/**
 * API Key update DTO
 */
export interface ApiKeyUpdate {
    name?: string;
    scopes?: string[];
    expires_at?: string | null;
    last_used_at?: string | null;
}

/**
 * ApiKeysService - API key management
 */
export class ApiKeysService {
    private supabase = getSupabaseAdmin();

    /**
     * Generate a new API key
     * Returns the plain key (only shown once) and the database record
     */
    async generate(userId: string, name: string, options?: {
        scopes?: ApiKeyScope[];
        expiresInDays?: number;
    }): Promise<{ key: string; record: ApiKey }> {
        // Generate a random key
        const keyBytes = randomBytes(32);
        const key = `lv_${keyBytes.toString('base64url')}`;

        // Hash the key for storage
        const keyHash = this.hashKey(key);
        const keyPrefix = key.substring(0, 10);

        // Calculate expiration
        const expiresAt = options?.expiresInDays
            ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

        const { data, error } = await this.supabase
            .from('api_keys')
            .insert({
                user_id: userId,
                name,
                key_hash: keyHash,
                key_prefix: keyPrefix,
                scopes: options?.scopes || ['read'],
                expires_at: expiresAt,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create API key: ${error.message}`);
        }

        return { key, record: data as ApiKey };
    }

    /**
     * Hash an API key for secure storage
     */
    private hashKey(key: string): string {
        return createHash('sha256').update(key).digest('hex');
    }

    /**
     * Validate an API key and return the associated record
     */
    async validate(key: string): Promise<ApiKey | null> {
        const keyHash = this.hashKey(key);

        const { data, error } = await this.supabase
            .from('api_keys')
            .select('*')
            .eq('key_hash', keyHash)
            .single();

        if (error || !data) {
            return null;
        }

        const apiKey = data as ApiKey;

        // Check if expired
        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
            return null;
        }

        // Update last used timestamp
        await this.updateLastUsed(apiKey.id);

        return apiKey;
    }

    /**
     * Update last used timestamp
     */
    private async updateLastUsed(id: string): Promise<void> {
        await this.supabase
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', id);
    }

    /**
     * Get all API keys for a user (excludes hash)
     */
    async getByUserId(userId: string): Promise<Omit<ApiKey, 'key_hash'>[]> {
        const { data, error } = await this.supabase
            .from('api_keys')
            .select('id, user_id, name, key_prefix, scopes, expires_at, last_used_at, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get API keys: ${error.message}`);
        }

        return (data || []) as Omit<ApiKey, 'key_hash'>[];
    }

    /**
     * Revoke (delete) an API key
     */
    async revoke(id: string, userId: string): Promise<boolean> {
        const { error } = await this.supabase
            .from('api_keys')
            .delete()
            .eq('id', id)
            .eq('user_id', userId); // Ensure user owns the key

        if (error) {
            throw new Error(`Failed to revoke API key: ${error.message}`);
        }

        return true;
    }

    /**
     * Update API key settings
     */
    async update(id: string, userId: string, updates: ApiKeyUpdate): Promise<ApiKey | null> {
        const { data, error } = await this.supabase
            .from('api_keys')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to update API key: ${error.message}`);
        }

        return data as ApiKey;
    }

    /**
     * Check if a key has required scope
     */
    hasScope(apiKey: ApiKey, requiredScope: ApiKeyScope): boolean {
        // Admin scope implies all permissions
        if (apiKey.scopes.includes('admin')) return true;

        // Write scope implies read
        if (requiredScope === 'read' && apiKey.scopes.includes('write')) return true;

        return apiKey.scopes.includes(requiredScope);
    }
}

// Export singleton instance
export const apiKeysService = new ApiKeysService();
