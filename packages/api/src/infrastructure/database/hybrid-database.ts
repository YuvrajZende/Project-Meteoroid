/**
 * Hybrid Database Adapter
 *
 * Relational queries go through SupabaseDatabase (strict SQL -> PostgREST
 * translator); vector similarity search uses the Supabase `match_embeddings`
 * RPC (pgvector).
 *
 * There is no separate local-PostgreSQL path: the previous implementation
 * dynamically imported an MCP tool name as if it were an npm package, which
 * could never work at runtime.
 *
 * NOTE: Imports from supabase-client.ts (not database-client.ts) to avoid a
 * circular dependency.
 */

import { getSupabaseAdmin } from './supabase-client.js';
import { SupabaseDatabase } from './supabase-database.js';
import type { IDatabase, Transaction } from '../../interfaces/database.interface.js';

export class HybridDatabase implements IDatabase {
    private initialized: boolean = false;
    private readonly relational = new SupabaseDatabase();

    async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        return this.relational.query<T>(sql, params);
    }

    async transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T> {
        return this.relational.transaction(callback);
    }

    async getConnectionState(): Promise<{
        connected: boolean;
        latency?: number;
        supabase: { connected: boolean; latency?: number };
    }> {
        const startTime = Date.now();
        let connected = false;

        try {
            const { error } = await getSupabaseAdmin().from('knowledge_embeddings').select('id').limit(1);
            connected = !error;
        } catch {
            connected = false;
        }

        const latency = Date.now() - startTime;
        return {
            connected,
            latency: connected ? latency : undefined,
            supabase: { connected, latency: connected ? latency : undefined },
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        const state = await this.getConnectionState();
        if (!state.connected) {
            throw new Error('Failed to connect to Supabase');
        }

        this.initialized = true;
    }

    async close(): Promise<void> {
        this.initialized = false;
    }

    async vectorSearch(
        embedding: number[],
        options: {
            threshold?: number;
            count?: number;
        } = {}
    ): Promise<unknown[]> {
        const { threshold = 0.78, count = 10 } = options;

        try {
            const { data, error } = await getSupabaseAdmin().rpc('match_embeddings', {
                query_embedding: embedding,
                match_threshold: threshold,
                match_count: count,
            });

            if (error) {
                throw new Error(`Vector search failed: ${error.message}`);
            }

            return (data || []) as unknown[];
        } catch (error) {
            console.error('[HybridDatabase] Vector search error:', error);
            return [];
        }
    }
}
