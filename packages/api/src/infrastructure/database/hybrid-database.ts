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
 */

import { getSupabaseAdmin } from './database-client.js';
import type { IDatabase, Transaction } from '../../interfaces/database.interface.js';

/**
 * Tables that should use Supabase (vector operations)
 */
const SUPABASE_TABLES = new Set([
    'knowledge_embeddings',
]);

/**
 * Tables that should use local PostgreSQL
 */
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
    'posts', // Local development table
]);

/**
 * Hybrid Database Implementation
 */
export class HybridDatabase implements IDatabase {
    private initialized: boolean = false;

    /**
     * Execute a SQL query, routing to the appropriate database
     */
    async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        // Extract table name from SQL
        const tableNameMatch = sql.match(/FROM\s+(\w+)|INSERT\s+INTO\s+(\w+)|UPDATE\s+(\w+)/i);
        if (!tableNameMatch) {
            throw new Error('Could not extract table name from SQL');
        }
        const tableName = (tableNameMatch[1] || tableNameMatch[2] || tableNameMatch[3]).toLowerCase();

        // Route to Supabase for vector tables
        if (SUPABASE_TABLES.has(tableName)) {
            return this.querySupabase<T>(sql, params);
        }

        // Route to local PostgreSQL for relational tables
        if (LOCAL_TABLES.has(tableName)) {
            return this.queryLocal<T>(sql, params);
        }

        // Default to local PostgreSQL
        return this.queryLocal<T>(sql, params);
    }

    /**
     * Query Supabase (for vector operations)
     */
    private async querySupabase<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        const supabase = getSupabaseAdmin();
        const tableNameMatch = sql.match(/FROM\s+(\w+)|INSERT\s+INTO\s+(\w+)|UPDATE\s+(\w+)/i);
        const tableName = tableNameMatch![1] || tableNameMatch![2] || tableNameMatch![3];

        // Handle SELECT queries
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            let query = supabase.from(tableName).select('*');

            // Parse WHERE clause
            if (sql.includes('WHERE')) {
                const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);
                if (whereMatch && params) {
                    const [, column, paramKey] = whereMatch;
                    query = query.eq(column, params[paramKey]);
                }
            }

            // Parse ORDER BY
            const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
            if (orderMatch) {
                const [, column, direction] = orderMatch;
                if (direction?.toUpperCase() === 'DESC') {
                    query = query.order(column, { ascending: false });
                } else {
                    query = query.order(column, { ascending: true });
                }
            }

            // Parse LIMIT
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

        // Handle INSERT queries
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
            const { data, error } = await supabase
                .from(tableName)
                .insert(params)
                .select();

            if (error) {
                throw new Error(`Supabase insert failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        // Handle UPDATE queries
        if (sql.trim().toUpperCase().startsWith('UPDATE')) {
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);
            let query = supabase.from(tableName);

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                query = query.eq(column, params[paramKey]);
            }

            const updateData = { ...params };
            if (whereMatch) {
                delete updateData[whereMatch[2]];
            }

            const { data, error } = await query.update(updateData).select();

            if (error) {
                throw new Error(`Supabase update failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        // Handle DELETE queries
        if (sql.trim().toUpperCase().startsWith('DELETE')) {
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);
            let query = supabase.from(tableName);

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                query = query.eq(column, params[paramKey]);
            }

            const { error } = await query.delete();

            if (error) {
                throw new Error(`Supabase delete failed: ${error.message}`);
            }

            return [] as T[];
        }

        throw new Error('Unsupported SQL query type for Supabase');
    }

    /**
     * Query local PostgreSQL via MCP (for relational operations)
     */
    private async queryLocal<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        // Use the MCP PostgreSQL server
        const { execute_sql } = await import('mcp__postgres__execute_sql');

        // Replace $param-style with PostgreSQL's $1, $2 style
        let paramIndex = 1;
        const pgSql = sql.replace(/\$(\w+)/g, (match, paramName) => {
            if (params && paramName in params) {
                return `$${paramIndex++}`;
            }
            return match;
        });

        // Convert params object to array
        const paramValues: any[] = [];
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
            const result = await execute_sql({ sql: pgSql });

            // The MCP tool returns the result in a specific format
            if (result && Array.isArray(result)) {
                return result as T[];
            }

            return [] as T[];
        } catch (error) {
            throw new Error(`Local PostgreSQL query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Execute a transaction (uses local PostgreSQL)
     */
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

    /**
     * Get connection health status for both databases
     */
    async getConnectionState(): Promise<{
        connected: boolean;
        latency?: number;
        local: { connected: boolean; latency?: number };
        supabase: { connected: boolean; latency?: number };
    }> {
        const startTime = Date.now();

        try {
            // Check local PostgreSQL via MCP
            let localConnected = false;
            try {
                await this.queryLocal('SELECT 1');
                localConnected = true;
            } catch {
                localConnected = false;
            }

            // Check Supabase
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

    /**
     * Initialize database connections
     */
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

    /**
     * Close database connections
     */
    async close(): Promise<void> {
        this.initialized = false;
    }

    /**
     * Vector similarity search via Supabase pgvector
     */
    async vectorSearch(
        embedding: number[],
        options: {
            threshold?: number;
            count?: number;
            tableName?: string;
        } = {}
    ): Promise<any[]> {
        const { threshold = 0.78, count = 10, tableName = 'knowledge_embeddings' } = options;

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

            return (data || []) as any[];
        } catch (error) {
            console.error('[HybridDatabase] Vector search error:', error);
            return [];
        }
    }
}
