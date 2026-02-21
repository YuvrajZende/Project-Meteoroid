/**
 * Task Repository
 * Week 2: Repository Layer - Day 11
 *
 * Handles all database operations for tasks
 * 
 * PERFORMANCE FEATURES:
 * - Batch loading of tasks by project IDs (prevents N+1)
 * - Single query with aggregations for statistics
 * - Optimized queries for dashboard data
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

// ============================================
// PERFORMANCE: Extended types for eager loading
// ============================================

export interface TaskWithProject extends Task {
    project?: {
        id: string;
        name: string;
        status: string;
    };
}

export interface TaskStats {
    total: number;
    byStatus: Map<Task['status'], number>;
    byType: Map<Task['type'], number>;
    avgDuration: number | null;
}

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

    // ============================================
    // PERFORMANCE: N+1 Query Prevention Methods
    // ============================================

    /**
     * PERFORMANCE: Find tasks by multiple project IDs in a single query
     * Prevents N+1 when loading tasks for multiple projects
     */
    async findByProjectIds(projectIds: string[], options?: QueryOptions): Promise<Map<string, Task[]>> {
        if (projectIds.length === 0) return new Map();

        try {
            const orderBy = this.buildOrderBy(options);
            const limit = options?.limit || 100;

            const results = await this.query<any>(
                `SELECT * FROM tasks
                 WHERE project_id = ANY($projectIds)
                 ${orderBy}
                 LIMIT $limit`,
                { projectIds, limit }
            );

            const tasksByProject = new Map<string, Task[]>();
            
            for (const row of results) {
                const task = this.rowToEntity<Task>(row);
                const projectId = task.projectId;
                
                if (!tasksByProject.has(projectId)) {
                    tasksByProject.set(projectId, []);
                }
                tasksByProject.get(projectId)!.push(task);
            }

            // Add empty arrays for projects with no tasks
            for (const id of projectIds) {
                if (!tasksByProject.has(id)) {
                    tasksByProject.set(id, []);
                }
            }

            return tasksByProject;
        } catch (error) {
            this.handleError(error, 'findByProjectIds');
        }
    }

    /**
     * PERFORMANCE: Get recent tasks with project info in single query
     * Prevents N+1 for dashboard task list
     */
    async getRecentWithProject(userId: string, limit: number): Promise<TaskWithProject[]> {
        try {
            const results = await this.query<any>(
                `SELECT 
                    t.*,
                    jsonb_build_object(
                        'id', p.id,
                        'name', p.name,
                        'status', p.status
                    ) as project
                FROM tasks t
                INNER JOIN projects p ON p.id = t.project_id
                WHERE t.user_id = $userId
                ORDER BY t.updated_at DESC
                LIMIT $limit`,
                { userId, limit }
            );

            return results.map(r => ({
                ...this.rowToEntity<Task>(r),
                project: r.project,
            }));
        } catch (error) {
            this.handleError(error, 'getRecentWithProject');
        }
    }

    /**
     * PERFORMANCE: Get comprehensive task statistics in a single query
     * Replaces multiple count queries
     */
    async getStats(userId: string): Promise<TaskStats> {
        try {
            const results = await this.query<{
                total: bigint;
                status: Task['status'] | null;
                type: Task['type'] | null;
                avg_duration: number | null;
            }>(
                `SELECT 
                    COUNT(*) as total,
                    status,
                    type,
                    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
                FROM tasks
                WHERE user_id = $userId
                GROUP BY GROUPING SETS ((status), (type), ())
                WITH ROLLUP`,
                { userId }
            );

            let total = 0;
            const byStatus = new Map<Task['status'], number>();
            const byType = new Map<Task['type'], number>();
            let avgDuration: number | null = null;

            for (const row of results) {
                if (row.status && !row.type) {
                    byStatus.set(row.status, Number(row.total));
                } else if (row.type && !row.status) {
                    byType.set(row.type, Number(row.total));
                } else if (!row.status && !row.type) {
                    total = Number(row.total);
                    avgDuration = row.avg_duration;
                }
            }

            return { total, byStatus, byType, avgDuration };
        } catch (error) {
            this.handleError(error, 'getStats');
        }
    }

    /**
     * PERFORMANCE: Batch update task statuses
     * More efficient than individual updates
     */
    async batchUpdateStatus(updates: Array<{ id: string; status: Task['status'] }>): Promise<void> {
        if (updates.length === 0) return;

        try {
            // Use a single query with CASE for batch update
            const ids = updates.map(u => u.id);
            const statusCases = updates
                .map((_, i) => `WHEN id = $id${i} THEN $status${i}`)
                .join(' ');

            const params: Record<string, unknown> = {};
            updates.forEach((u, i) => {
                params[`id${i}`] = u.id;
                params[`status${i}`] = u.status;
            });
            params['ids'] = ids;

            await this.query(
                `UPDATE tasks 
                 SET 
                     status = CASE ${statusCases} END,
                     updated_at = $updatedAt
                 WHERE id = ANY($ids)`,
                { ...params, updatedAt: this.now().toISOString() }
            );
        } catch (error) {
            this.handleError(error, 'batchUpdateStatus');
        }
    }

    /**
     * PERFORMANCE: Find tasks by IDs in a single query
     */
    async findByIds(ids: string[]): Promise<Task[]> {
        if (ids.length === 0) return [];

        try {
            const results = await this.query<any>(
                `SELECT * FROM tasks WHERE id = ANY($ids)`,
                { ids }
            );

            return results.map(r => this.rowToEntity<Task>(r));
        } catch (error) {
            this.handleError(error, 'findByIds');
        }
    }
}
