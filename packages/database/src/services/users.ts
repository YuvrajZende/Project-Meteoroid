/**
 * Users Service
 * Database operations for the users table
 */

import { getSupabaseAdmin } from '../client.js';

/**
 * User tier enum
 */
export type UserTier = 'free' | 'pro' | 'enterprise';

/**
 * User entity
 */
export interface User {
    id: string;
    email: string;
    name: string | null;
    tier: UserTier;
    api_quota_used: number;
    created_at: string;
    updated_at: string;
}

/**
 * User insert DTO
 */
export interface UserInsert {
    id: string;
    email: string;
    name?: string | null;
    tier?: UserTier;
}

/**
 * User update DTO
 */
export interface UserUpdate {
    email?: string;
    name?: string | null;
    tier?: UserTier;
    api_quota_used?: number;
}

/**
 * UsersService - CRUD operations for users
 */
export class UsersService {
    private supabase = getSupabaseAdmin();

    /**
     * Get user by ID
     */
    async getById(id: string): Promise<User | null> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw new Error(`Failed to get user: ${error.message}`);
        }

        return data as User;
    }

    /**
     * Get user by email
     */
    async getByEmail(email: string): Promise<User | null> {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to get user: ${error.message}`);
        }

        return data as User;
    }

    /**
     * Create a new user
     */
    async create(user: UserInsert): Promise<User> {
        const { data, error } = await this.supabase
            .from('users')
            .insert({
                id: user.id,
                email: user.email,
                name: user.name || null,
                tier: user.tier || 'free',
                api_quota_used: 0,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }

        return data as User;
    }

    /**
     * Update a user
     */
    async update(id: string, updates: UserUpdate): Promise<User> {
        const { data, error } = await this.supabase
            .from('users')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }

        return data as User;
    }

    /**
     * Delete a user
     */
    async delete(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }

    /**
     * Increment API quota usage
     */
    async incrementQuota(id: string, amount: number = 1): Promise<void> {
        const user = await this.getById(id);
        if (user) {
            await this.update(id, {
                api_quota_used: user.api_quota_used + amount,
            });
        }
    }

    /**
     * Check if user has quota remaining
     */
    async hasQuotaRemaining(id: string): Promise<boolean> {
        const user = await this.getById(id);
        if (!user) return false;

        // Define quota limits per tier
        const quotaLimits: Record<UserTier, number> = {
            free: 100,
            pro: 1000,
            enterprise: 10000,
        };

        const limit = quotaLimits[user.tier];
        return user.api_quota_used < limit;
    }
}

// Export singleton instance
export const usersService = new UsersService();
