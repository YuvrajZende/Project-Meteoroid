/**
 * User Repository
 * Week 2: Repository Layer - Day 11
 *
 * Handles all database operations for users
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type {
    IUserRepository,
    User,
    QueryOptions,
} from '../interfaces/repository.interface.js';
import { BaseRepository } from './base.repository.js';

@injectable()
export class UserRepository extends BaseRepository implements IUserRepository {
    protected readonly tableName = 'users';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Create a new user
     */
    async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
        try {
            const row = this.entityToRow({
                id: this.generateId(),
                ...user,
                createdAt: this.now(),
                updatedAt: this.now(),
            });

            const results = await this.query<any>(
                `INSERT INTO users (id, email, name, password_hash, role, preferences, last_login_at, created_at, updated_at)
                 VALUES ($id, $email, $name, $passwordHash, $role, $preferences::jsonb, $lastLoginAt, $createdAt, $updatedAt)
                 RETURNING *`,
                row
            );

            if (!results[0]) {
                throw new Error('Failed to create user');
            }

            return this.rowToEntity<User>(results[0]);
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Find user by ID
     */
    async findById(id: string): Promise<User | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM users WHERE id = $id`,
                { id }
            );

            return results[0] ? this.rowToEntity<User>(results[0]) : null;
        } catch (error) {
            this.handleError(error, 'findById');
        }
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM users WHERE email = $email`,
                { email }
            );

            return results[0] ? this.rowToEntity<User>(results[0]) : null;
        } catch (error) {
            this.handleError(error, 'findByEmail');
        }
    }

    /**
     * Update user
     */
    async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
        try {
            const fields: string[] = [];
            const values: Record<string, unknown> = { id };
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (key === 'id' || key === 'createdAt') continue;

                const paramName = `$${paramIndex++}`;
                fields.push(`${this.toSnakeCase(key)} = ${paramName}`);

                if (key === 'preferences') {
                    values[paramName] = JSON.stringify(value);
                } else if (value instanceof Date) {
                    values[paramName] = value.toISOString();
                } else {
                    values[paramName] = value;
                }
            }

            if (fields.length === 0) return;

            fields.push(`updated_at = $${paramIndex}`);
            values[paramIndex] = this.now().toISOString();

            await this.query(
                `UPDATE users SET ${fields.join(', ')} WHERE id = $id`,
                values
            );
        } catch (error) {
            this.handleError(error, 'update');
        }
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(id: string): Promise<void> {
        try {
            await this.query(
                `UPDATE users SET last_login_at = $lastLoginAt, updated_at = $updatedAt WHERE id = $id`,
                {
                    id,
                    lastLoginAt: this.now().toISOString(),
                    updatedAt: this.now().toISOString(),
                }
            );
        } catch (error) {
            this.handleError(error, 'updateLastLogin');
        }
    }

    /**
     * Update user preferences
     */
    async updatePreferences(id: string, preferences: Partial<User['preferences']>): Promise<void> {
        try {
            // Get existing preferences
            const user = await this.findById(id);
            const existing = user?.preferences || {};

            // Merge preferences
            const merged = { ...existing, ...preferences };

            await this.query(
                `UPDATE users SET preferences = $preferences::jsonb, updated_at = $updatedAt WHERE id = $id`,
                {
                    id,
                    preferences: JSON.stringify(merged),
                    updatedAt: this.now().toISOString(),
                }
            );
        } catch (error) {
            this.handleError(error, 'updatePreferences');
        }
    }

    /**
     * Delete user
     */
    async delete(id: string): Promise<void> {
        try {
            await this.query(
                `DELETE FROM users WHERE id = $id`,
                { id }
            );
        } catch (error) {
            this.handleError(error, 'delete');
        }
    }

    /**
     * Get all users
     */
    async findAll(options?: QueryOptions): Promise<User[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM users
                 ${orderBy}
                 ${pagination}`
            );

            return results.map(r => this.rowToEntity<User>(r));
        } catch (error) {
            this.handleError(error, 'findAll');
        }
    }

    /**
     * Get users by role
     */
    async findByRole(role: User['role'], options?: QueryOptions): Promise<User[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM users
                 WHERE role = $role
                 ${orderBy}
                 ${pagination}`,
                { role }
            );

            return results.map(r => this.rowToEntity<User>(r));
        } catch (error) {
            this.handleError(error, 'findByRole');
        }
    }

    /**
     * Search users by name or email
     */
    async search(query: string, options?: QueryOptions): Promise<User[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);
            const searchTerm = `%${query}%`;

            const results = await this.query<any>(
                `SELECT * FROM users
                 WHERE name ILIKE $query OR email ILIKE $query
                 ${orderBy}
                 ${pagination}`,
                { query: searchTerm }
            );

            return results.map(r => this.rowToEntity<User>(r));
        } catch (error) {
            this.handleError(error, 'search');
        }
    }

    /**
     * Count total users
     */
    async count(): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM users`
            );

            return Number(results[0]?.count || 0);
        } catch (error) {
            this.handleError(error, 'count');
        }
    }

    /**
     * Count users by role
     */
    async countByRole(): Promise<Record<User['role'], number>> {
        try {
            const results = await this.query<{ role: User['role']; count: bigint }>(
                `SELECT role, COUNT(*) as count FROM users GROUP BY role`
            );

            const counts: Record<string, number> = {
                admin: 0,
                user: 0,
                viewer: 0,
            };

            for (const row of results) {
                counts[row.role] = Number(row.count);
            }

            return counts as Record<User['role'], number>;
        } catch (error) {
            this.handleError(error, 'countByRole');
        }
    }

    /**
     * Convert camelCase to snake_case
     */
    private toSnakeCase(str: string): string {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
