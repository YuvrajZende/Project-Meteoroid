/**
 * Supabase Client Factory
 * 
 * Separate module to break circular dependency between database-client.ts and hybrid-database.ts
 * This module ONLY handles client creation, no imports from hybrid-database.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Note: SUPABASE_USE_POOLER no longer rewrites the REST URL. *.pooler.supabase.co is a
// Postgres (Supavisor) host, not a PostgREST host, so rewriting broke every request.
// supabase-js talks HTTP to SUPABASE_URL; the global fetch keeps connections alive.
const DB_CONFIG = {
    // Kept for getDbConfig() consumers; the REST client never uses a pooler host.
    pooler: {
        enabled: false,
        minConnections: 2,
        maxConnections: 10,
    },
    timeouts: {
        query: 30000,
        connection: 10000,
    },
    healthCheckInterval: 60000,
};

let supabaseClient: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: true,
            persistSession: false,
        },
        db: {
            schema: 'public',
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });
}

export function createSupabaseAdmin(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        db: {
            schema: 'public',
        },
    });
}

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        supabaseClient = createSupabaseClient();
        console.log('[DATABASE] Supabase client initialized');
    }
    return supabaseClient;
}

export function getSupabaseAdmin(): SupabaseClient {
    if (!supabaseAdmin) {
        supabaseAdmin = createSupabaseAdmin();
        console.log('[DATABASE] Supabase admin client initialized');
    }
    return supabaseAdmin;
}

export function resetSupabaseClients(): void {
    supabaseClient = null;
    supabaseAdmin = null;
    console.log('[DATABASE] Supabase clients reset');
}

export function getDbConfig(): typeof DB_CONFIG {
    return { ...DB_CONFIG };
}
