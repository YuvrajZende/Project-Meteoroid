/**
 * Supabase Database Adapter
 * Implements IDatabase interface for Supabase
 * Provides a bridge between the repository pattern and Supabase client
 */

import { getSupabaseAdmin } from './database-client.js';
import type { IDatabase, Transaction } from '../../interfaces/database.interface.js';

export class SupabaseDatabase implements IDatabase {
    private initialized: boolean = false;

    /**
     * Execute a SQL query using Supabase
     * Note: Supabase doesn't support raw SQL directly in the JS client.
     * This is a simplified adapter - repositories should use Supabase's query builder directly.
     */
    async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
        const supabase = getSupabaseAdmin();

        // Extract table name from SQL
        const tableNameMatch = sql.match(/FROM\s+(\w+)|INSERT\s+INTO\s+(\w+)|UPDATE\s+(\w+)/i);
        if (!tableNameMatch) {
            throw new Error('Could not extract table name from SQL');
        }
        const tableName = tableNameMatch[1] || tableNameMatch[2] || tableNameMatch[3];

        // For SELECT queries
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            // Apply WHERE conditions if params exist
            let query = supabase.from(tableName).select('*');

            // Simple WHERE clause parsing for id = $id pattern
            if (sql.includes('WHERE')) {
                const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);
                if (whereMatch && params) {
                    const [, column, paramKey] = whereMatch;
                    query = query.eq(column, params[paramKey]);
                }
            }

            // Apply ORDER BY
            const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
            if (orderMatch) {
                const [, column, direction] = orderMatch;
                if (direction?.toUpperCase() === 'DESC') {
                    query = query.order(column, { ascending: false });
                } else {
                    query = query.order(column, { ascending: true });
                }
            }

            // Apply LIMIT
            const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
                query = query.limit(parseInt(limitMatch[1], 10));
            }

            // Apply OFFSET
            const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
            if (offsetMatch) {
                query = query.range(parseInt(offsetMatch[1], 10), parseInt(offsetMatch[1], 10) + (limitMatch ? parseInt(limitMatch[1], 10) - 1 : 999));
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Query failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        // For INSERT queries
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
            // Extract columns and values from params
            const { data, error } = await supabase
                .from(tableName)
                .insert(params)
                .select();

            if (error) {
                throw new Error(`Insert failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        // For UPDATE queries
        if (sql.trim().toUpperCase().startsWith('UPDATE')) {
            // Extract WHERE conditions
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);

            let query = supabase.from(tableName);

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                query = query.eq(column, params[paramKey]);
            }

            // Get the values to update (excluding WHERE params)
            const updateData = { ...params };
            if (whereMatch) {
                delete updateData[whereMatch[2]];
            }

            const { data, error } = await query.update(updateData).select();

            if (error) {
                throw new Error(`Update failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        // For DELETE queries
        if (sql.trim().toUpperCase().startsWith('DELETE')) {
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);

            let query = supabase.from(tableName);

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                query = query.eq(column, params[paramKey]);
            }

            const { error } = await query.delete();

            if (error) {
                throw new Error(`Delete failed: ${error.message}`);
            }

            return [] as T[];
        }

        throw new Error('Unsupported SQL query type');
    }

    /**
     * Execute a transaction
     * Note: Supabase doesn't support client-side transactions the same way.
     * This is a no-op for now - transactions should be handled at the RPC level.
     */
    async transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T> {
        // Supabase handles transactions server-side via RPC functions
        // For now, execute the callback directly
        const trx: Transaction = {
            query: async <T>(sql: string, params?: Record<string, unknown>) => {
                const result = await this.query<T>(sql, params);
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
     * Get connection health status
     */
    async getConnectionState(): Promise<{ connected: boolean; latency?: number }> {
        const startTime = Date.now();

        try {
            const supabase = getSupabaseAdmin();
            // Simple health check
            const { error } = await supabase.from('users').select('id').limit(1);

            const latency = Date.now() - startTime;

            if (error) {
                return { connected: false };
            }

            return { connected: true, latency };
        } catch {
            return { connected: false };
        }
    }

    /**
     * Close database connection
     * Note: Supabase client doesn't need explicit closing
     */
    async close(): Promise<void> {
        // Supabase client is a singleton, no need to close
        this.initialized = false;
    }

    /**
     * Initialize database connection
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const state = await this.getConnectionState();
        if (!state.connected) {
            throw new Error('Failed to connect to Supabase');
        }

        this.initialized = true;
    }
}
