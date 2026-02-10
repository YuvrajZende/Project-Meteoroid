/**
 * API Keys Service
 * Database operations for user-generated API keys
 */

import { randomBytes, createHash } from 'crypto';
import { getConvexClient, api } from '../../api/src/infrastructure/database/convex-client.js';

/**
 * API Key entity
 */
export interface ApiKey {
    id: string; // Convex ID
    user_id: string;
    name: string;
    key_hash: string;
    key_prefix: string;
    scopes: string[];
    expires_at: string | null;
    last_used_at: string | null;
    created_at: string;
    _id: string;
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
    key_hash: string; // Internal use but kept in DTO if needed
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
    private convex = getConvexClient();

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
            : undefined;

        const newId = await this.convex.mutation(api.api_keys.create, {
            userId,
            name,
            keyHash,
            keyPrefix,
            scopes: options?.scopes || ['read'],
            expiresAt,
        });

        // We construct the record manually to return it since we don't have a getById that allows us to fetch it easily 
        // without keyHash (which we have) but `validate` does side effects.
        // Actually we can just reconstruct it since we know what we sent.
        const record: ApiKey = {
            id: newId,
            _id: newId,
            user_id: userId,
            name,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            scopes: options?.scopes || ['read'],
            expires_at: expiresAt || null,
            last_used_at: null,
            created_at: new Date().toISOString()
        };

        return { key, record };
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

        const apiKey = await this.convex.query(api.api_keys.validateKey, { keyHash });

        if (!apiKey) {
            return null;
        }

        // Validate expiration again just in case (though query does it)
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
            return null;
        }

        // Update last used timestamp
        // This is async and fire-and-forget for performance usually, but here we await
        await this.updateLastUsed(apiKey._id);

        return this.mapToEntity(apiKey);
    }

    /**
     * Update last used timestamp
     */
    private async updateLastUsed(id: string): Promise<void> {
        await this.convex.mutation(api.api_keys.recordUsage, { id: id as any });
    }

    /**
     * Get all API keys for a user (excludes hash)
     */
    async getByUserId(userId: string): Promise<Omit<ApiKey, 'key_hash'>[]> {
        const keys = await this.convex.query(api.api_keys.listByUser, { userId });

        // Sort by created_at desc
        keys.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });

        return keys.map(k => {
            const entity = this.mapToEntity(k);
            const { key_hash, ...rest } = entity;
            return rest;
        });
    }

    /**
     * Revoke (delete) an API key
     */
    async revoke(id: string, userId: string): Promise<boolean> {
        // Need to check ownership first?
        // listByUser returns all keys. We could filter.
        // Or we just try to delete if we trust the caller.
        // Implementation:
        // Supabase RLS handled this.
        // Here we should check.
        // TODO: Optimally `delete` mutation checks ownership.
        // For now, let's fetch and check.
        // We don't have getById.
        // Let's iterate `listByUser` (inefficient if many keys but user has few usually).
        const usersKeys = await this.getByUserId(userId);
        const key = usersKeys.find(k => k.id === id);

        if (!key) {
            // throw new Error("Key not found or not owned by user");
            return false; // Or throw
        }

        await this.convex.mutation(api.api_keys.revoke, { id: id as any });
        return true;
    }

    /**
     * Update API key settings
     */
    async update(id: string, userId: string, updates: ApiKeyUpdate): Promise<ApiKey | null> {
        // Check ownership
        const usersKeys = await this.getByUserId(userId);
        const key = usersKeys.find(k => k.id === id);

        if (!key) return null;

        await this.convex.mutation(api.api_keys.update, {
            id: id as any,
            name: updates.name,
            scopes: updates.scopes,
            expiresAt: updates.expires_at || undefined
        });

        // Return updated (simulated)
        return {
            ...key,
            name: updates.name ?? key.name,
            scopes: updates.scopes ?? key.scopes,
            expires_at: updates.expires_at ?? key.expires_at,
        } as ApiKey; // Add key_hash if needed but getByUserId removed it.
        // Wait, return type is ApiKey (with hash).
        // I need to fetch it or cheat.
        // Since I can't fetch by ID easily and I don't have the hash...
        // I will return what I have, but `key_hash` will be missing if I use the result from `getByUserId`.
        // This might break types.
        // `getByUserId` returns Omit<ApiKey, 'key_hash'>.
        // `update` returns `ApiKey | null`.
        // I should stick to `ApiKey` type.
        // I'll cheat and put empty string for hash since we don't return it anyway usually.
        return {
            ...key,
            key_hash: '',
            name: updates.name ?? key.name,
            scopes: updates.scopes ?? key.scopes,
            expires_at: updates.expires_at ?? key.expires_at,
            _id: key._id // Ensure this persists
        } as ApiKey;
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

    private mapToEntity(k: any): ApiKey {
        return {
            id: k._id,
            _id: k._id,
            user_id: k.userId,
            name: k.name,
            key_hash: k.keyHash,
            key_prefix: k.keyPrefix,
            scopes: k.scopes || [],
            expires_at: k.expiresAt || null,
            last_used_at: k.lastUsedAt || null,
            created_at: k.created_at || new Date().toISOString(),
        };
    }
}

// Export singleton instance
export const apiKeysService = new ApiKeysService();
