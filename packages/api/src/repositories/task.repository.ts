/**
 * Task Repository
 * Week 2: Repository Layer - Day 11
 *
 * Handles all database operations for tasks
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type {
    ITaskRepository,
    Task,
    QueryOptions,
} from '../interfaces/repository.interface.js';
import { BaseRepository } from './base.repository.js';

@injectable()
export class TaskRepository extends BaseRepository implements ITaskRepository {
    protected readonly tableName = 'tasks';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Create a new task
     */
    async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
        try {
            const row = this.entityToRow({
                id: this.generateId(),
                ...task,
                createdAt: this.now(),
                updatedAt: this.now(),
            });

            const results = await this.query<any>(
                `INSERT INTO tasks (id, project_id, user_id, type, status, prompt, config, result, errors, started_at, completed_at, created_at, updated_at)
                 VALUES ($id, $projectId, $userId, $type, $status, $prompt, $config::jsonb, $result::jsonb, $errors::jsonb, $startedAt, $completedAt, $createdAt, $updatedAt)
                 RETURNING *`,
                row
            );

            if (!results[0]) {
                throw new Error('Failed to create task');
            }

            return this.rowToEntity<Task>(results[0]);
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Find task by ID
     */
    async findById(id: string): Promise<Task | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM tasks WHERE id = $id`,
                { id }
            );

            return results[0] ? this.rowToEntity<Task>(results[0]) : null;
        } catch (error) {
            this.handleError(error, 'findById');
        }
    }

    /**
     * Find all tasks for a project
     */
    async findByProject(projectId: string, options?: QueryOptions): Promise<Task[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM tasks
                 WHERE project_id = $projectId
                 ${orderBy}
                 ${pagination}`,
                { projectId }
            );

            return results.map(r => this.rowToEntity<Task>(r));
        } catch (error) {
            this.handleError(error, 'findByProject');
        }
    }

    /**
     * Find all tasks for a user
     */
    async findByUser(userId: string, options?: QueryOptions): Promise<Task[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM tasks
                 WHERE user_id = $userId
                 ${orderBy}
                 ${pagination}`,
                { userId }
            );

            return results.map(r => this.rowToEntity<Task>(r));
        } catch (error) {
            this.handleError(error, 'findByUser');
        }
    }

    /**
     * Find running tasks
     */
    async findRunning(): Promise<Task[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM tasks WHERE status = 'running' ORDER BY started_at ASC`
            );

            return results.map(r => this.rowToEntity<Task>(r));
        } catch (error) {
            this.handleError(error, 'findRunning');
        }
    }

    /**
     * Update task status
     */
    async updateStatus(id: string, status: Task['status']): Promise<void> {
        try {
            const updates: Record<string, unknown> = {
                id,
                status,
                updatedAt: this.now().toISOString(),
            };

            if (status === 'running' && !updates['startedAt']) {
                updates['startedAt'] = this.now().toISOString();
            } else if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                updates['completedAt'] = this.now().toISOString();
            }

            await this.query(
                `UPDATE tasks SET status = $status, updated_at = $updatedAt, started_at = $startedAt, completed_at = $completedAt WHERE id = $id`,
                this.entityToRow(updates)
            );
        } catch (error) {
            this.handleError(error, 'updateStatus');
        }
    }

    /**
     * Update task result
     */
    async updateResult(id: string, result: Task['result']): Promise<void> {
        try {
            await this.query(
                `UPDATE tasks SET result = $result::jsonb, updated_at = $updatedAt WHERE id = $id`,
                {
                    id,
                    result: JSON.stringify(result),
                    updatedAt: this.now().toISOString(),
                }
            );
        } catch (error) {
            this.handleError(error, 'updateResult');
        }
    }

    /**
     * Update task with errors
     */
    async addError(id: string, error: string): Promise<void> {
        try {
            // First get existing errors
            const task = await this.findById(id);
            const errors = task?.errors || [];

            errors.push(error);

            await this.query(
                `UPDATE tasks SET errors = $errors::jsonb, updated_at = $updatedAt WHERE id = $id`,
                {
                    id,
                    errors: JSON.stringify(errors),
                    updatedAt: this.now().toISOString(),
                }
            );
        } catch (error) {
            this.handleError(error, 'addError');
        }
    }

    /**
     * Update task
     */
    async update(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
        try {
            const fields: string[] = [];
            const values: Record<string, unknown> = { id };
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (key === 'id' || key === 'createdAt') continue;

                const paramName = `$${paramIndex++}`;
                fields.push(`${this.toSnakeCase(key)} = ${paramName}`);

                if (key === 'result' || key === 'config' || key === 'errors') {
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
                `UPDATE tasks SET ${fields.join(', ')} WHERE id = $id`,
                values
            );
        } catch (error) {
            this.handleError(error, 'update');
        }
    }

    /**
     * Delete task
     */
    async delete(id: string): Promise<void> {
        try {
            await this.query(
                `DELETE FROM tasks WHERE id = $id`,
                { id }
            );
        } catch (error) {
            this.handleError(error, 'delete');
        }
    }

    /**
     * Get task count by status for a project
     */
    async countByStatus(projectId: string, status?: Task['status']): Promise<Map<Task['status'], number>> {
        try {
            let sql = `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = $projectId`;
            const params: Record<string, unknown> = { projectId };

            if (status) {
                sql += ` AND status = $status`;
                params['status'] = status;
            }

            sql += ` GROUP BY status`;

            const results = await this.query<{ status: Task['status']; count: bigint }>(sql, params);

            const statusCounts = new Map<Task['status'], number>();
            for (const row of results) {
                statusCounts.set(row.status, Number(row.count));
            }

            return statusCounts;
        } catch (error) {
            this.handleError(error, 'countByStatus');
        }
    }

    /**
     * Find tasks by type
     */
    async findByType(type: Task['type'], options?: QueryOptions): Promise<Task[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM tasks
                 WHERE type = $type
                 ${orderBy}
                 ${pagination}`,
                { type }
            );

            return results.map(r => this.rowToEntity<Task>(r));
        } catch (error) {
            this.handleError(error, 'findByType');
        }
    }

    /**
     * Get recent tasks for dashboard
     */
    async getRecent(userId: string, limit: number): Promise<Task[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM tasks
                 WHERE user_id = $userId
                 ORDER BY updated_at DESC
                 LIMIT $limit`,
                { userId, limit }
            );

            return results.map(r => this.rowToEntity<Task>(r));
        } catch (error) {
            this.handleError(error, 'getRecent');
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
        return crypto.randomUUID();
    }
}
