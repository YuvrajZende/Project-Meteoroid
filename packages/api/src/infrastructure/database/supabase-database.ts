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
     * Clean params: strip dollar-sign prefixes and parse JSON strings back to native types.
     * BaseRepository.entityToRow() converts arrays/objects to JSON strings,
     * but Supabase expects native JS arrays/objects for jsonb/json columns.
     */
    private cleanParams(params?: Record<string, unknown>): Record<string, unknown> {
        if (!params) return {};

        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(params)) {
            // Strip leading $ from key names (e.g., $taskId -> taskId)
            const cleanKey = key.startsWith('$') ? key.slice(1) : key;

            // Parse JSON strings back to native objects/arrays for Supabase
            if (typeof value === 'string') {
                // Check if the string looks like JSON (array or object)
                const trimmed = value.trim();
                if (
                    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
                    (trimmed.startsWith('{') && trimmed.endsWith('}'))
                ) {
                    try {
                        cleaned[cleanKey] = JSON.parse(trimmed);
                    } catch {
                        // Not valid JSON, keep as string
                        cleaned[cleanKey] = value;
                    }
                } else {
                    cleaned[cleanKey] = value;
                }
            } else {
                cleaned[cleanKey] = value;
            }
        }
        return cleaned;
    }

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
            // Clean params: parse JSON strings back to native types for Supabase
            const cleanedData = this.cleanParams(params);

            const { data, error } = await supabase
                .from(tableName)
                .insert(cleanedData)
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

            // Extract SET clause to detect computed expressions like "frequency = frequency + 1"
            const setClause = sql.match(/SET\s+(.*?)(?:\s+WHERE|$)/is);
            const hasComputedExpression = setClause?.[1]?.match(/\w+\s*=\s*\w+\s*[+\-*/]\s*\d+/);

            if (hasComputedExpression) {
                // For computed expressions (e.g., "frequency = frequency + 1"),
                // we need to use Supabase RPC or fetch-then-update approach
                // because Supabase REST API doesn't support column references in SET
                const whereColumn = whereMatch?.[1];
                const whereParamKey = whereMatch?.[2];
                const whereValue = whereParamKey && params ? params[whereParamKey] : undefined;

                if (whereColumn && whereValue) {
                    // First, fetch the current row
                    const { data: currentRows, error: fetchError } = await supabase
                        .from(tableName)
                        .select('*')
                        .eq(whereColumn, whereValue);

                    if (fetchError) {
                        throw new Error(`Update (fetch) failed: ${fetchError.message}`);
                    }

                    if (!currentRows || currentRows.length === 0) {
                        return [] as T[];
                    }

                    const currentRow = currentRows[0] as Record<string, unknown>;

                    // Build the update data by evaluating computed expressions
                    const updateData: Record<string, unknown> = {};
                    const setClauses = setClause![1].split(',').map(s => s.trim());

                    for (const clause of setClauses) {
                        // Match: column = column + N or column = column - N
                        const computedMatch = clause.match(/(\w+)\s*=\s*(\w+)\s*([+\-*/])\s*(\d+)/);
                        // Match: column = $paramName
                        const paramMatch = clause.match(/(\w+)\s*=\s*\$(\w+)/);

                        if (computedMatch) {
                            const [, targetCol, sourceCol, operator, operand] = computedMatch;
                            const currentValue = Number(currentRow[sourceCol] || 0);
                            const numOperand = Number(operand);

                            switch (operator) {
                                case '+': updateData[targetCol] = currentValue + numOperand; break;
                                case '-': updateData[targetCol] = currentValue - numOperand; break;
                                case '*': updateData[targetCol] = currentValue * numOperand; break;
                                case '/': updateData[targetCol] = numOperand !== 0 ? currentValue / numOperand : 0; break;
                            }
                        } else if (paramMatch && params) {
                            const [, column, paramKey] = paramMatch;
                            updateData[column] = params[paramKey];
                        }
                    }

                    // Now do the actual update
                    const { data, error } = await supabase
                        .from(tableName)
                        .update(updateData)
                        .eq(whereColumn, whereValue)
                        .select();

                    if (error) {
                        throw new Error(`Update failed: ${error.message}`);
                    }

                    return (data || []) as T[];
                }
            }

            // Standard UPDATE: no computed expressions
            // Get the values to update (excluding WHERE params)
            const updateData = this.cleanParams(params);
            if (whereMatch) {
                delete updateData[whereMatch[2]];
            }

            // Build the query: .update() first, THEN .eq() for WHERE
            // Supabase requires: supabase.from(table).update(data).eq(col, val)
            let updateQuery = supabase.from(tableName).update(updateData);

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                updateQuery = updateQuery.eq(column, params[paramKey]);
            }

            const { data, error } = await updateQuery.select();

            if (error) {
                throw new Error(`Update failed: ${error.message}`);
            }

            return (data || []) as T[];
        }

        // For DELETE queries
        if (sql.trim().toUpperCase().startsWith('DELETE')) {
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\$(\w+)/i);

            let query = supabase.from(tableName).delete();

            if (whereMatch && params) {
                const [, column, paramKey] = whereMatch;
                query = query.eq(column, params[paramKey]);
            }

            const { error } = await query;

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
            commit: async () => { },
            rollback: async () => { },
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
