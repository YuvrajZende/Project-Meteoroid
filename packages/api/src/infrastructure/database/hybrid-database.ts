/**
 * Hybrid Database Adapter
 *
 * Routes queries to the appropriate database:
 * - Local PostgreSQL (via MCP) for relational data (users, projects, tasks, etc.)
 * - Supabase for vector operations (knowledge_embeddings with pgvector)
 *
 * This gives us the best of both worlds:
 * - Local speed and control for relational queries
 * - Battle-tested pgvector for semantic search
 *
 * NOTE: Imports getSupabaseAdmin from supabase-client.ts to avoid circular dependency
 */

import { getSupabaseAdmin } from './supabase-client.js';
import type { IDatabase, Transaction } from '../../interfaces/database.interface.js';

const SUPABASE_TABLES = new Set([
    'knowledge_embeddings',
]);

const LOCAL_TABLES = new Set([
    'users',
    'projects',
    'tasks',
    'generated_files',
    'connections',
    'deployments',
    'audit_logs',
    'learning_contexts',
    'benchmarks',
    'api_keys',
    'posts',
]);

export class HybridDatabase implements IDatabase {
    private initialized: boolean = false;

    async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        const tableNameMatch = sql.match(/FROM\s+(\w+)|INSERT\s+INTO\s+(\w+)|UPDATE\s+(\w+)/i);
        if (!tableNameMatch) {
            throw new Error('Could not extract table name from SQL');
        }
        const tableName = (tableNameMatch[1] || tableNameMatch[2] || tableNameMatch[3]).toLowerCase();

        if (SUPABASE_TABLES.has(tableName)) {
            return this.querySupabase<T>(sql, params, tableName);
        }

        if (LOCAL_TABLES.has(tableName)) {
            return this.queryLocal<T>(sql, params);
        }

        return this.queryLocal<T>(sql, params);
    }

    private async querySupabase<T>(sql: string, params?: Record<string, unknown>, tableName?: string): Promise<T[]> {
        const supabase = getSupabaseAdmin();
        const tableNameMatch = sql.match(/FROM\s+(\w+)|INSERT\s+INTO\s+(\w+)|UPDATE\s+(\w+)/i);
        const resolvedTableName = tableName || (tableNameMatch![1] || tableNameMatch![2] || tableNameMatch![3]);

        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            let query = supabase.from(resolvedTableName).select('*');

            if (sql.includes('WHERE')) {
                const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);
                if (whereMatch && params) {
                    const [, column, paramKey] = whereMatch;
                    query = query.eq(column, params[paramKey]);
                }
            }

            const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
            if (orderMatch) {
                const [, column, direction] = orderMatch;
                if (direction?.toUpperCase() === 'DESC') {
                    query = query.order(column, { ascending: false });
                } else {
                    query = query.order(column, { ascending: true });
                }
            }

            const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
                query = query.limit(parseInt(limitMatch[1], 10));
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Supabase query failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        if (sql.trim().toUpperCase().startsWith('INSERT')) {
            const { data, error } = await supabase
                .from(resolvedTableName)
                .insert(params)
                .select();

            if (error) {
                throw new Error(`Supabase insert failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        if (sql.trim().toUpperCase().startsWith('UPDATE')) {
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);

            const updateData = { ...params };

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                delete updateData[paramKey];
                const { data, error } = await supabase
                    .from(resolvedTableName)
                    .update(updateData)
                    .eq(column, params[paramKey])
                    .select();

                if (error) {
                    throw new Error(`Supabase update failed: ${error.message}`);
                }

                return (data || []) as T[];
            }

            const { data, error } = await supabase
                .from(resolvedTableName)
                .update(updateData)
                .select();

            if (error) {
                throw new Error(`Supabase update failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        if (sql.trim().toUpperCase().startsWith('DELETE')) {
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                const { error } = await supabase
                    .from(resolvedTableName)
                    .delete()
                    .eq(column, params[paramKey]);

                if (error) {
                    throw new Error(`Supabase delete failed: ${error.message}`);
                }

                return [] as T[];
            }

            const { error } = await supabase.from(resolvedTableName).delete();

            if (error) {
                throw new Error(`Supabase delete failed: ${error.message}`);
            }

            return [] as T[];
        }

        throw new Error('Unsupported SQL query type for Supabase');
    }

    private async queryLocal<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        let paramIndex = 1;
        const pgSql = sql.replace(/\$(\w+)/g, (match, paramName) => {
            if (params && paramName in params) {
                return `$${paramIndex++}`;
            }
            return match;
        });

        const paramValues: unknown[] = [];
        if (params) {
            const paramNames = sql.match(/\$(\w+)/g) || [];
            for (const param of paramNames) {
                const paramName = param.substring(1);
                if (paramName in params) {
                    paramValues.push(params[paramName]);
                }
            }
        }

        try {
            const { execute_sql } = await import('mcp__postgres__execute_sql');
            const result = await execute_sql({ sql: pgSql });

            if (result && Array.isArray(result)) {
                return result as T[];
            }

            return [] as T[];
        } catch (error) {
            throw new Error(`Local PostgreSQL query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T> {
        const trx: Transaction = {
            query: async <T>(sql: string, params?: Record<string, unknown>) => {
                const result = await this.queryLocal<T>(sql, params);
                return {
                    data: result,
                    error: null,
                    count: result.length,
                };
            },
            commit: async () => {},
            rollback: async () => {},
        };

        return callback(trx);
    }

    async getConnectionState(): Promise<{
        connected: boolean;
        latency?: number;
        local: { connected: boolean; latency?: number };
        supabase: { connected: boolean; latency?: number };
    }> {
        const startTime = Date.now();

        try {
            let localConnected = false;
            try {
                await this.queryLocal('SELECT 1');
                localConnected = true;
            } catch {
                localConnected = false;
            }

            let supabaseConnected = false;
            try {
                const supabase = getSupabaseAdmin();
                await supabase.from('knowledge_embeddings').select('id').limit(1);
                supabaseConnected = true;
            } catch {
                supabaseConnected = false;
            }

            const latency = Date.now() - startTime;

            return {
                connected: localConnected || supabaseConnected,
                latency,
                local: { connected: localConnected },
                supabase: { connected: supabaseConnected },
            };
        } catch {
            return {
                connected: false,
                local: { connected: false },
                supabase: { connected: false },
            };
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        const state = await this.getConnectionState();
        if (!state.local.connected && !state.supabase.connected) {
            throw new Error('Failed to connect to either local PostgreSQL or Supabase');
        }

        console.log('[HybridDatabase] Initialized:', {
            local: state.local.connected ? '✅ Connected' : '❌ Failed',
            supabase: state.supabase.connected ? '✅ Connected' : '❌ Failed',
        });

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
            tableName?: string;
        } = {}
    ): Promise<unknown[]> {
        const { threshold = 0.78, count = 10 } = options;

        const supabase = getSupabaseAdmin();

        try {
            const { data, error } = await supabase.rpc('match_embeddings', {
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
