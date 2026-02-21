/**
 * Supabase Client Factory
 * 
 * Separate module to break circular dependency between database-client.ts and hybrid-database.ts
 * This module ONLY handles client creation, no imports from hybrid-database.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DB_CONFIG = {
    pooler: {
        enabled: process.env.SUPABASE_USE_POOLER === 'true',
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

function getPoolerUrl(originalUrl: string): string {
    if (!DB_CONFIG.pooler.enabled) return originalUrl;
    return originalUrl.replace(
        /\.supabase\.co$/,
        '.pooler.supabase.co'
    );
}

export function createSupabaseClient(): SupabaseClient {
    const originalUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!originalUrl || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
    }

    const url = getPoolerUrl(originalUrl);

    return createClient(url, key, {
        auth: {
            autoRefreshToken: true,
            persistSession: false,
        },
        global: {
            headers: {
                'x-connection-pool': 'true',
            },
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
    const originalUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!originalUrl || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    }

    const url = getPoolerUrl(originalUrl);

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        global: {
            headers: {
                'x-connection-pool': 'true',
                'x-service-role': 'true',
            },
        },
        db: {
            schema: 'public',
        },
    });
}

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        supabaseClient = createSupabaseClient();
        console.log(`[DATABASE] Supabase client initialized (pooler: ${DB_CONFIG.pooler.enabled})`);
    }
    return supabaseClient;
}

export function getSupabaseAdmin(): SupabaseClient {
    if (!supabaseAdmin) {
        supabaseAdmin = createSupabaseAdmin();
        console.log(`[DATABASE] Supabase admin client initialized (pooler: ${DB_CONFIG.pooler.enabled})`);
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
