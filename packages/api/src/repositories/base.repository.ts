/**
 * Base Repository
 * Week 2: Repository Layer - Day 11
 *
 * Provides common functionality for all repositories:
 * - Error handling
 * - Query building
 * - Type conversion
 * - Logging
 */

import { injectable } from 'inversify';
import type { IDatabase } from '../interfaces/database.interface.js';

/**
 * Custom error for repository operations
 */
export class RepositoryError extends Error {
    constructor(
        message: string,
        public readonly repository: string,
        public readonly originalError?: unknown
    ) {
        super(message);
        this.name = 'RepositoryError';
    }
}

/**
 * Base repository with common functionality
 */
@injectable()
export abstract class BaseRepository {
    protected readonly tableName: string;

    constructor(protected database: IDatabase) {
        // Abstract property - must be set by subclass
        this.tableName = (this as any).constructor.name.replace('Repository', '').toLowerCase() + 's';
    }

    /**
     * Handle database errors consistently
     */
    protected handleError(error: unknown, operation: string): never {
        // Extract repository name from tableName (convert 'users' -> 'UserRepository')
        let singularName: string;
        if (this.tableName.endsWith('s') && !this.tableName.endsWith('_')) {
            // Simple plural like 'users' -> 'user'
            singularName = this.tableName.slice(0, -1);
        } else if (this.tableName.endsWith('_table')) {
            // Test table name like 'test_table' -> 'test'
            singularName = this.tableName.replace('_table', '');
        } else if (this.tableName.endsWith('ies')) {
            // Plural ending in 'ies' like 'audit_logs' -> 'audit_log'
            singularName = this.tableName.slice(0, -3) + 'y';
        } else {
            singularName = this.tableName;
        }

        const repositoryName = singularName.charAt(0).toUpperCase() + singularName.slice(1) + 'Repository';

        console.error(`[${this.tableName}] ${operation} failed:`, error);

        if (error instanceof Error) {
            throw new RepositoryError(
                `${repositoryName}: ${operation} failed - ${error.message}`,
                repositoryName,
                error
            );
        }

        throw new RepositoryError(
            `${repositoryName}: ${operation} failed`,
            repositoryName,
            error
        );
    }

    /**
     * Convert database row to entity with type conversion
     */
    protected rowToEntity<T>(row: Record<string, unknown>): T {
        // Debug marker to verify this code is being executed
        if (process.env.VITEST_DEBUG_ROW_TO_ENTITY === 'true') {
            console.log('[rowToEntity] Processing row:', JSON.stringify(row));
        }

        const entity: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(row)) {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

            // Convert date strings to Date objects
            if (value && typeof value === 'string' && (
                key.endsWith('_at') ||
                key.endsWith('At') ||
                key === 'createdAt' ||
                key === 'updatedAt' ||
                key.endsWith('Date')
            )) {
                entity[camelKey] = new Date(value);
            }
            // Try to parse JSON strings for objects (config, preferences, metadata, changes, result, errors)
            else if (value && typeof value === 'string' && (
                key === 'config' ||
                key === 'preferences' ||
                key === 'metadata' ||
                key === 'changes' ||
                key === 'result' ||
                key === 'errors' ||
                // Generation iteration fields
                key === 'generated_code' ||
                key === 'test_results' ||
                key === 'metrics' ||
                key === 'feedback' ||
                // Testing iteration fields
                key === 'lessons' ||
                key === 'related_files' ||
                key === 'tags' ||
                // Learned pattern fields
                key === 'related_prompts' ||
                // Project context fields
                key === 'recent_projects' ||
                key === 'recent_prompts' ||
                key === 'tech_stack_history'
            )) {
                try {
                    const parsed = JSON.parse(value);
                    entity[camelKey] = parsed;
                } catch {
                    // If parsing fails, keep as string
                    entity[camelKey] = value;
                }
            }
            else {
                entity[camelKey] = value;
            }
        }

        return entity as T;
    }

    /**
     * Convert entity to database row with type conversion
     */
    protected entityToRow(entity: Record<string, unknown>): Record<string, unknown> {
        const row: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(entity)) {
            // Skip undefined values
            if (value === undefined) continue;

            // Convert camelCase to snake_case for database columns
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

            // Convert Date objects to ISO strings
            if (value instanceof Date) {
                row[snakeKey] = value.toISOString();
            }
            // Convert objects to JSON strings
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                row[snakeKey] = JSON.stringify(value);
            }
            // Convert arrays to JSON strings
            else if (Array.isArray(value)) {
                row[snakeKey] = JSON.stringify(value);
            }
            else {
                row[snakeKey] = value;
            }
        }

        return row;
    }

    /**
     * Build ORDER BY clause
     */
    protected buildOrderBy(options?: { orderBy?: string; order?: 'ASC' | 'DESC' }): string {
        // Return empty string if no orderBy specified
        if (!options || typeof options.orderBy !== 'string' || options.orderBy.trim() === '') {
            return '';
        }

        // Convert camelCase to snake_case for column name
        const column = options.orderBy
            .replace(/([a-z])([A-Z])/g, '$1_$2')  // Add underscore before capital letters
            .toLowerCase();

        // Default direction is ASC
        const direction = options.order || 'ASC';
        return `ORDER BY ${column} ${direction}`;
    }

    /**
     * Build LIMIT/OFFSET clause
     */
    protected buildPagination(options?: { limit?: number; offset?: number }): string {
        const clauses: string[] = [];

        if (options?.limit) {
            clauses.push(`LIMIT ${options.limit}`);
        }

        if (options?.offset) {
            clauses.push(`OFFSET ${options.offset}`);
        }

        return clauses.join(' ');
    }

    /**
     * Execute a query and return results
     */
    protected async query<T>(sql: string, params: Record<string, unknown> = {}): Promise<T[]> {
        try {
            const results = await this.database.query<T>(sql, params);
            return results || [];
        } catch (error) {
            this.handleError(error, 'query');
        }
    }

    /**
     * Execute a query and return a single result
     */
    protected async queryOne<T>(sql: string, params: Record<string, unknown> = {}): Promise<T | null> {
        const results = await this.query<T>(sql, params);
        return results[0] || null;
    }

    /**
     * Get current timestamp for created_at/updated_at
     */
    protected now(): Date {
        return new Date();
    }
}
