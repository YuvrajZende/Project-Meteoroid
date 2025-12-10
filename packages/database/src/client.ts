/**
 * Supabase Client
 * Configures and exports the Supabase client for database operations
 * 
 * NOTE: For full type safety, generate types using Supabase CLI:
 * npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable requirements
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Validate that required environment variables are present
 */
function validateEnv(): { url: string; anonKey: string; serviceKey?: string } {
    if (!SUPABASE_URL) {
        throw new Error('SUPABASE_URL environment variable is required');
    }
    if (!SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_ANON_KEY environment variable is required');
    }

    return {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
    };
}

// Use 'any' for now - replace with generated types later
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseSchema = any;

/**
 * Create Supabase client for client-side operations (respects RLS)
 */
export function createSupabaseClient(): SupabaseClient<DatabaseSchema> {
    const { url, anonKey } = validateEnv();

    return createClient<DatabaseSchema>(url, anonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: false, // Server-side, don't persist
        },
    });
}

/**
 * Create Supabase admin client (bypasses RLS)
 * Use with caution - only for server-side operations
 */
export function createSupabaseAdmin(): SupabaseClient<DatabaseSchema> {
    const { url, serviceKey } = validateEnv();

    if (!serviceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
    }

    return createClient<DatabaseSchema>(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// Singleton instances
let supabaseClient: SupabaseClient<DatabaseSchema> | null = null;
let supabaseAdmin: SupabaseClient<DatabaseSchema> | null = null;

/**
 * Get the singleton Supabase client
 */
export function getSupabase(): SupabaseClient<DatabaseSchema> {
    if (!supabaseClient) {
        supabaseClient = createSupabaseClient();
    }
    return supabaseClient;
}

/**
 * Get the singleton Supabase admin client
 */
export function getSupabaseAdmin(): SupabaseClient<DatabaseSchema> {
    if (!supabaseAdmin) {
        supabaseAdmin = createSupabaseAdmin();
    }
    return supabaseAdmin;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('users').select('count').limit(1);

        if (error && error.code !== 'PGRST116') {
            // PGRST116 means table doesn't exist yet (which is fine during setup)
            console.error('Database connection test failed:', error.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Database connection test failed:', error);
        return false;
    }
}
