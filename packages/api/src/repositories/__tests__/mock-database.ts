/**
 * Mock Database for Repository Testing
 * Simulates database behavior for unit tests
 */

import type { IDatabase, Transaction } from '../../interfaces/database.interface.js';

type QueryResult<T> = T[];
type QueryParams = Record<string, unknown>;

class MockTransaction implements Transaction {
    private db: MockDatabase;

    constructor(db: MockDatabase) {
        this.db = db;
    }

    async query<T>(sql: string, params?: QueryParams): Promise<{ data: T[] | null; error: string | null; count: number }> {
        const results = await this.db.query<T>(sql, params);
        return { data: results, error: null, count: results.length };
    }

    async commit(): Promise<void> {
        // Mock commit - no-op
    }

    async rollback(): Promise<void> {
        // Mock rollback - no-op
    }
}

export class MockDatabase implements IDatabase {
    private tables: Map<string, Record<string, unknown>[]> = new Map();
    private shouldThrowError: boolean = false;
    private errorToThrow: Error = new Error('Database error');

    constructor() {
        // Initialize empty tables
        this.tables.set('users', []);
        this.tables.set('projects', []);
        this.tables.set('tasks', []);
        this.tables.set('audit_logs', []);
        // Learning service tables
        this.tables.set('generation_iterations', []);
        this.tables.set('testing_iterations', []);
        this.tables.set('learned_patterns', []);
        this.tables.set('project_contexts', []);
    }

    /**
     * Mock query execution
     */
    async query<T>(sql: string, params?: QueryParams): Promise<QueryResult<T>> {
        if (this.shouldThrowError) {
            throw this.errorToThrow;
        }

        // Parse SQL to determine table and operation
        const upperSql = sql.toUpperCase().trim();

        // Handle INSERT
        if (upperSql.startsWith('INSERT')) {
            return this.handleInsert<T>(sql, params);
        }

        // Handle SELECT
        if (upperSql.startsWith('SELECT')) {
            return this.handleSelect<T>(sql, params);
        }

        // Handle UPDATE
        if (upperSql.startsWith('UPDATE')) {
            return this.handleUpdate<T>(sql, params);
        }

        // Handle DELETE
        if (upperSql.startsWith('DELETE')) {
            return this.handleDelete<T>(sql, params);
        }

        return [] as T[];
    }

    /**
     * Handle INSERT queries
     */
    private handleInsert<T>(sql: string, params?: QueryParams): QueryResult<T> {
        const tableName = this.extractTableName(sql);
        const table = this.tables.get(tableName);

        if (!table) {
            throw new Error(`Table ${tableName} not found`);
        }

        // Extract data from params
        const row = { ...(params || {}) };

        // Auto-generate id if not present
        if (!row.id && tableName === 'users') {
            row.id = `user_${Date.now()}`;
        } else if (!row.id && tableName === 'projects') {
            row.id = `proj_${Date.now()}`;
        } else if (!row.id && tableName === 'tasks') {
            row.id = `task_${Date.now()}`;
        } else if (!row.id && tableName === 'audit_logs') {
            row.id = `audit_${Date.now()}`;
        }

        // Add timestamps if not present
        if (!row.created_at) {
            row.created_at = new Date().toISOString();
        }
        if (!row.updated_at) {
            row.updated_at = new Date().toISOString();
        }

        table.push(row);

        // Return the inserted row
        return [row] as QueryResult<T>;
    }

    /**
     * Handle SELECT queries with enhanced SQL support
     */
    private handleSelect<T>(sql: string, params?: QueryParams): QueryResult<T> {
        const tableName = this.extractTableName(sql);
        const table = this.tables.get(tableName);

        if (!table) {
            throw new Error(`Table ${tableName} not found`);
        }

        let results = [...table];

        // Parse and apply WHERE clauses
        if (sql.includes('WHERE')) {
            results = this.applyWhereClause(results, sql, params);
        }

        // Handle ORDER BY
        if (sql.includes('ORDER BY')) {
            results = this.applyOrderBy(results, sql);
        }

        // Handle GROUP BY
        if (sql.includes('GROUP BY')) {
            results = this.applyGroupBy(results, sql);
        }

        // Parse LIMIT and OFFSET values (but apply in correct order: OFFSET first, then LIMIT)
        const limitMatch = sql.match(/LIMIT\s+(\$?\w+|\d+)/i);
        const offsetMatch = sql.match(/OFFSET\s+(\$?\w+|\d+)/i);

        let limitValue: string | undefined = limitMatch?.[1];
        let offsetValue: string | undefined = offsetMatch?.[1];

        // Resolve actual values
        let limit: number | undefined;
        let offset: number | undefined;

        if (offsetValue) {
            if (offsetValue.startsWith('$')) {
                const offsetParam = offsetValue.slice(1);
                if (offsetParam in (params || {})) {
                    offset = params?.[offsetParam] as number;
                } else {
                    offset = (params?.[offsetParam] ?? params?.[offsetValue]) as number;
                }
            } else {
                offset = parseInt(offsetValue, 10);
            }
        }

        if (limitValue) {
            if (limitValue.startsWith('$')) {
                const limitParam = limitValue.slice(1);
                if (limitParam in (params || {})) {
                    limit = params?.[limitParam] as number;
                } else {
                    limit = (params?.[limitParam] ?? params?.[limitValue]) as number;
                }
            } else {
                limit = parseInt(limitValue, 10);
            }
        }

        // Apply OFFSET first (skip rows)
        if (!isNaN(offset ?? NaN) && offset! > 0) {
            results = results.slice(offset!);
        }

        // Then apply LIMIT (take rows)
        if (!isNaN(limit ?? NaN) && limit! > 0) {
            results = results.slice(0, limit!);
        }

        // Handle COUNT(*) aggregation (only if not already handled by GROUP BY)
        if (sql.includes('COUNT(*)') && !sql.includes('GROUP BY')) {
            return [{ count: BigInt(results.length) }] as QueryResult<T>;
        }
        if (sql.includes('COUNT(') && !sql.includes('GROUP BY')) {
            return [{ count: BigInt(results.length) }] as QueryResult<T>;
        }

        return results as QueryResult<T>;
    }

    /**
     * Apply WHERE clause filtering with support for AND, OR, ILIKE
     */
    private applyWhereClause(results: Record<string, unknown>[], sql: string, params?: QueryParams): Record<string, unknown>[] {
        // Extract WHERE clause from SQL
        // Use [\s\S]+? instead of .+? to match across newlines
        const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|\s+OFFSET|$)/is);
        if (!whereMatch) return results;

        const whereClause = whereMatch[1].trim();

        // Parse conditions: (condition1 AND condition2) OR (condition3)
        const conditions = this.parseWhereConditions(whereClause, params);

        return results.filter(row => {
            if (!row) return false;

            return conditions.some(conditionGroup => {
                return conditionGroup.every(condition => {
                    return this.evaluateCondition(row, condition);
                });
            });
        });
    }

    /**
     * Parse WHERE conditions into groups (handling AND/OR)
     */
    private parseWhereConditions(whereClause: string, params?: QueryParams): Array<Array<{ field: string; operator: string; value: unknown }>> {
        const conditions: Array<Array<{ field: string; operator: string; value: unknown }>> = [];
        let currentGroup: Array<{ field: string; operator: string; value: unknown }> = [];

        // Split by OR (highest priority) - handle newlines
        const orParts = whereClause.split(/\s+OR\s+/is);
        for (const orPart of orParts) {
            const andParts = orPart.split(/\s+AND\s+/is);
            currentGroup = [];

            for (const andPart of andParts) {
                const condition = this.parseCondition(andPart.trim(), params);
                if (condition) {
                    currentGroup.push(condition);
                }
            }

            if (currentGroup.length > 0) {
                conditions.push([...currentGroup]);
                currentGroup = [];
            }
        }

        if (currentGroup.length > 0) {
            conditions.push(currentGroup);
        }

        return conditions;
    }

    /**
     * Parse a single condition
     */
    private parseCondition(condition: string, params?: QueryParams): { field: string; operator: string; value: unknown } | null {
        // Match: field = $param or field ILIKE $param or field > $param
        const match = condition.match(/(\w+)\s*(=|!=|<>|>=|<=|ILIKE)\s*(\$\w+)/i);
        if (!match) {
            // Try to match string literal: field = 'value' or field = "value"
            const literalMatch = condition.match(/(\w+)\s*(=|!=|<>|>=|<=|ILIKE)\s*['"](.+?)['"]/i);
            if (literalMatch) {
                const [, field, operator, literalValue] = literalMatch;
                return { field, operator: operator.toLowerCase(), value: literalValue };
            }
            return null;
        }

        const [, field, operator, paramRef] = match;
        let value: unknown;

        // Try to get value by parameter reference first ($1, $2, $id, etc.)
        if (paramRef in (params || {})) {
            value = params?.[paramRef];
        }
        // Fallback: try without $ sign (for $1 -> 1, $id -> id)
        else if (paramRef.startsWith('$')) {
            const paramName = paramRef.slice(1);

            // Check if it's a numbered parameter like $1, $2, etc.
            if (paramName.match(/^\d+$/)) {
                // Numbered parameter - get by position (1-based index)
                const paramKeys = Object.keys(params || {});
                const position = parseInt(paramName, 10) - 1; // Convert to 0-based index
                value = paramKeys[position] !== undefined ? params?.[paramKeys[position]] : undefined;
            } else {
                // Named parameter
                value = params?.[paramName];
            }
        }
        // Last resort: try direct lookup
        else {
            value = params?.[paramRef];
        }

        if (value === undefined) return null;

        return { field, operator: operator.toLowerCase(), value };
    }

    /**
     * Evaluate a single condition against a row
     */
    private evaluateCondition(row: Record<string, unknown>, condition: { field: string; operator: string; value: unknown }): boolean {
        const { field, operator, value } = condition;

        // Get row value (try snake_case, camelCase, original field name)
        const rowValue = row[field] ?? row[this.toSnakeCase(field)] ?? row[this.toCamelCase(field)];

        // Handle ILIKE operator
        if (operator === 'ilike') {
            if (typeof value === 'string' && value.includes('%')) {
                const rowStr = String(rowValue ?? '');
                const pattern = value
                    .replace(/%/g, '.*')
                    .replace(/_/g, '.');
                return new RegExp(pattern, 'i').test(rowStr);
            }
            // ILIKE without wildcards is case-insensitive equals
            const rowStr = String(rowValue ?? '').toLowerCase();
            const valueStr = String(value).toLowerCase();
            return rowStr.includes(valueStr) || rowStr === valueStr;
        }

        // Handle comparison operators
        switch (operator) {
            case '=':
                return rowValue === value;
            case '!=':
            case '<>':
                return rowValue !== value;
            case '>':
                return this.compareValues(rowValue, value, '>');
            case '>=':
                return this.compareValues(rowValue, value, '>=');
            case '<':
                return this.compareValues(rowValue, value, '<');
            case '<=':
                return this.compareValues(rowValue, value, '<=');
            default:
                return rowValue === value;
        }
    }

    /**
     * Compare two values (with type coercion)
     */
    private compareValues(a: unknown, b: unknown, operator: '>' | '<' | '>=' | '<='): boolean {
        if (typeof a === 'string' && typeof b === 'string') {
            if (operator === '>') return a.localeCompare(b) > 0;
            if (operator === '<') return a.localeCompare(b) < 0;
            if (operator === '>=') return a.localeCompare(b) >= 0;
            if (operator === '<=') return a.localeCompare(b) <= 0;
        }
        const numA = Number(a) || 0;
        const numB = Number(b) || 0;
        switch (operator) {
            case '>': return numA > numB;
            case '<': return numA < numB;
            case '>=': return numA >= numB;
            case '<=': return numA <= numB;
            default: return false;
        }
    }

    /**
     * Apply ORDER BY clause
     */
    private applyOrderBy(results: Record<string, unknown>[], sql: string): Record<string, unknown>[] {
        if (!sql.includes('ORDER BY')) return results;

        const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
        if (!orderMatch) return results;

        const [, column, direction] = orderMatch;

        results.sort((a, b) => {
            const aVal = a[column];
            const bVal = b[column];
            // Handle string comparison
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                if (direction === 'DESC') {
                    return aVal.localeCompare(bVal) * -1;
                }
                return aVal.localeCompare(bVal);
            }
            // Handle numeric comparison
            if (direction === 'DESC') {
                return (aVal as number) > (bVal as number) ? -1 : 1;
            }
            return (aVal as number) > (bVal as number) ? 1 : -1;
        });

        return results;
    }

    /**
     * Apply GROUP BY clause
     */
    private applyGroupBy<T>(results: Record<string, unknown>[], sql: string): Record<string, unknown>[] {
        if (!sql.includes('GROUP BY')) return results;

        const groupMatch = sql.match(/GROUP BY\s+(\w+)/i);
        if (!groupMatch) return results;

        const groupColumn = groupMatch[1];
        const groups: Record<string, Record<string, unknown>[]> = {};

        // Group results by the specified column
        for (const row of results) {
            const groupKey = String(row[groupColumn] ?? '');
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(row);
        }

        // Build aggregated results
        const aggregatedResults: Record<string, unknown>[] = Object.entries(groups).map(([groupKey, rows]) => {
            const result: Record<string, unknown> = {};
            result[groupColumn] = groupKey;

            // Check for COUNT(*) in the SELECT clause
            if (sql.includes('COUNT(*)')) {
                result.count = BigInt(rows.length);
            }

            return result;
        });

        return aggregatedResults as T[];
    }

    /**
     * Convert camelCase to snake_case
     */
    private toSnakeCase(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }

    /**
     * Convert snake_case to camelCase
     */
    private toCamelCase(str: string): string {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    /**
     * Handle UPDATE queries
     */
    private handleUpdate<T>(sql: string, params?: QueryParams): QueryResult<T> {
        const tableName = this.extractTableName(sql);
        const table = this.tables.get(tableName);

        if (!table) {
            throw new Error(`Table ${tableName} not found`);
        }

        // Parse the UPDATE statement to extract SET clauses and WHERE conditions
        // Format: UPDATE table SET field1 = $1, field2 = $2 WHERE id = $id
        // Use [\s\S]+? instead of .+? to match across newlines
        const setMatch = sql.match(/SET\s+([\s\S]+?)\s+WHERE/is);
        const whereMatch = sql.match(/WHERE\s+([\s\S]+)$/is);

        if (!setMatch || !whereMatch) {
            throw new Error('Invalid UPDATE statement format');
        }

        const setClause = setMatch[1];
        const whereClause = whereMatch[1];

        // Parse SET clauses: "field1 = $1, field2 = $2"
        const setClauses = setClause.split(',').map(s => s.trim());
        const fieldUpdates: Record<string, unknown> = {};

        for (const clause of setClauses) {
            // Try to match parameter: field = $1 or field = $param
            let match = clause.match(/(\w+)\s*=\s*(\$\w+|\$?\d+)/);
            let field: string | undefined;
            let value: unknown;

            if (match) {
                field = match[1];
                const param = match[2];

                // Try to get value by parameter reference first ($1, $2, $id, etc.)
                if (param in (params || {})) {
                    value = params?.[param];
                }
                // Fallback: try without $ sign (for $1 -> 1, $id -> id)
                else if (param.startsWith('$')) {
                    const paramName = param.slice(1);
                    value = params?.[paramName];
                }
                // Last resort: try positional lookup
                else {
                    value = params?.[param];
                }
            } else {
                // Try to match string literal: field = 'value' or field = "value"
                const literalMatch = clause.match(/(\w+)\s*=\s*['"](.+?)['"]/);
                if (literalMatch) {
                    field = literalMatch[1];
                    value = literalMatch[2];
                }
            }

            if (field && value !== undefined) {
                // Convert snake_case to camelCase for the row
                const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                fieldUpdates[camelField] = value;
            }
        }

        // Find rows to update based on WHERE clause
        const rowsToUpdate = table.filter(row => {
            // Parse WHERE clause: "id = $id" or "user_id = $1"
            // Handle newlines in WHERE clause
            const whereParts = whereClause.split(/\s+AND\s+/is);
            return whereParts.every(part => {
                const [, field, param] = part.match(/(\w+)\s*=\s*(\$\w+|\$?\d+)/) || [];
                if (!field || !param) return true;

                let expectedValue: unknown;

                // Try to get value by parameter reference first ($1, $2, $id, etc.)
                if (param in (params || {})) {
                    expectedValue = params?.[param];
                }
                // Fallback: try without $ sign (for $1 -> 1, $id -> id)
                else if (param.startsWith('$')) {
                    const paramName = param.slice(1);
                    expectedValue = params?.[paramName];
                }
                // Last resort: try direct lookup
                else {
                    expectedValue = params?.[param];
                }

                // Check both snake_case and camelCase versions of the field
                const rowValue = row[field] ?? row[this.toSnakeCase(field)] ?? row[this.toCamelCase(field)];

                return rowValue === expectedValue;
            });
        });

        // Update rows
        for (const row of rowsToUpdate) {
            // Only update fields that were specified in SET clause
            for (const [field, value] of Object.entries(fieldUpdates)) {
                // Handle both camelCase and snake_case field names
                // Try camelCase first (from fieldUpdates), then snake_case
                if (field in row) {
                    row[field] = value;
                } else {
                    const snakeField = this.toSnakeCase(field);
                    if (snakeField in row) {
                        row[snakeField] = value;
                    } else {
                        // If field doesn't exist in row, add it as-is
                        row[field] = value;
                    }
                }
            }
        }

        return rowsToUpdate as QueryResult<T>;
    }

    /**
     * Handle DELETE queries
     */
    private handleDelete<T>(sql: string, params?: QueryParams): QueryResult<T> {
        const tableName = this.extractTableName(sql);
        const table = this.tables.get(tableName);

        if (!table) {
            throw new Error(`Table ${tableName} not found`);
        }

        // Check for WHERE clause
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+RETURNING|\s*$)/i);
        const returningMatch = sql.match(/RETURNING\s+(.+)/i);

        let deletedCount = 0;
        let returnData: QueryResult<T> = [] as QueryResult<T>;

        if (whereMatch) {
            // Parse WHERE conditions
            const whereClause = whereMatch[1].trim();

            // Handle simple date comparison: created_at < $date
            const dateCompareMatch = whereClause.match(/(\w+)\s*([<>=]+)\s*\$(\w+)/i);
            if (dateCompareMatch && params) {
                const [, column, operator, paramName] = dateCompareMatch;
                const paramValue = params[paramName];

                const indicesToDelete: number[] = [];
                table.forEach((row, index) => {
                    const rowValue = row[column];
                    let shouldDelete = false;

                    if (operator === '<') {
                        shouldDelete = String(rowValue) < String(paramValue);
                    } else if (operator === '<=') {
                        shouldDelete = String(rowValue) <= String(paramValue);
                    } else if (operator === '>') {
                        shouldDelete = String(rowValue) > String(paramValue);
                    } else if (operator === '>=') {
                        shouldDelete = String(rowValue) >= String(paramValue);
                    } else if (operator === '=') {
                        shouldDelete = String(rowValue) === String(paramValue);
                    }

                    if (shouldDelete) {
                        indicesToDelete.push(index);
                    }
                });

                // Delete from end to start to maintain indices
                for (let i = indicesToDelete.length - 1; i >= 0; i--) {
                    table.splice(indicesToDelete[i], 1);
                    deletedCount++;
                }
            }
        } else {
            // Simple DELETE by id
            const deleteId = params?.id;
            if (!deleteId) {
                throw new Error('DELETE requires id parameter or WHERE clause');
            }

            const index = table.findIndex(row => row.id === deleteId);
            if (index >= 0) {
                table.splice(index, 1);
                deletedCount = 1;
            }
        }

        // Handle RETURNING clause
        if (returningMatch) {
            const returningClause = returningMatch[1].trim();

            // Handle COUNT(*)
            if (returningClause.includes('COUNT(*)')) {
                returnData = [{ count: BigInt(deletedCount) }] as QueryResult<T>;
            }
            // Handle COUNT as count
            else if (returningClause.includes('COUNT(')) {
                returnData = [{ count: BigInt(deletedCount) }] as QueryResult<T>;
            }
            // Handle COUNT(*) as count
            else if (returningClause.includes('COUNT(*) as count')) {
                returnData = [{ count: BigInt(deletedCount) }] as QueryResult<T>;
            }
            else {
                returnData = [] as QueryResult<T>;
            }
        }

        return returnData;
    }

    /**
     * Extract table name from SQL query
     */
    private extractTableName(sql: string): string {
        // Match FROM or INSERT INTO table name
        const fromMatch = sql.match(/FROM\s+(\w+)/i);
        if (fromMatch) return fromMatch[1];

        const intoMatch = sql.match(/INSERT INTO\s+(\w+)/i);
        if (intoMatch) return intoMatch[1];

        const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
        if (updateMatch) return updateMatch[1];

        const deleteMatch = sql.match(/DELETE FROM\s+(\w+)/i);
        if (deleteMatch) return deleteMatch[1];

        throw new Error('Could not extract table name from SQL');
    }

    /**
     * Mock transaction support
     */
    async transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T> {
        const trx = new MockTransaction(this);
        return callback(trx);
    }

    /**
     * Seed the mock database with test data
     */
    seed(tableName: string, data: Record<string, unknown>[]): void {
        const table = this.tables.get(tableName);
        if (table) {
            table.splice(0, table.length, ...data);
        }
    }

    /**
     * Get all data from a table
     */
    getTableData(tableName: string): Record<string, unknown>[] {
        return this.tables.get(tableName) || [];
    }

    /**
     * Clear all data from a table
     */
    clearTable(tableName: string): void {
        const table = this.tables.get(tableName);
        if (table) {
            table.length = 0;
        }
    }

    /**
     * Clear all tables
     */
    clearAll(): void {
        for (const table of this.tables.values()) {
            table.length = 0;
        }
    }

    /**
     * Make the next query throw an error
     */
    throwError(error: Error): void {
        this.shouldThrowError = true;
        this.errorToThrow = error;
    }

    /**
     * Reset error state
     */
    resetErrors(): void {
        this.shouldThrowError = false;
    }

    /**
     * Get connection state (mock implementation)
     */
    async getConnectionState(): Promise<{ connected: boolean; latency?: number }> {
        return { connected: true, latency: 0 };
    }

    /**
     * Close the mock database
     */
    async close(): Promise<void> {
        this.tables.clear();
    }
}
