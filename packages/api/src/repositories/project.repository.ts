/**
 * Project Repository
 * Week 2: Repository Layer - Day 11
 *
 * Handles all database operations for projects
 * 
 * PERFORMANCE FEATURES:
 * - Batch loading of related entities (prevents N+1)
 * - Single query with JOINs for related data
 * - Query optimization with proper indexing hints
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type {
    IProjectRepository,
    Project,
    QueryOptions,
    PaginatedResult,
} from '../interfaces/repository.interface.js';
import { BaseRepository } from './base.repository.js';

// ============================================
// PERFORMANCE: Extended types for eager loading
// ============================================

export interface ProjectWithTasks extends Project {
    tasks: Array<{
        id: string;
        type: string;
        status: string;
        prompt: string;
        createdAt: Date;
    }>;
    taskCount: number;
}

export interface ProjectWithStats extends Project {
    taskCount: number;
    completedTaskCount: number;
    failedTaskCount: number;
    lastTaskAt: Date | null;
}

@injectable()
export class ProjectRepository extends BaseRepository implements IProjectRepository {
    protected readonly tableName = 'projects';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Create a new project
     */
    async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
        try {
            const row = this.entityToRow({
                id: this.generateId(),
                ...project,
                createdAt: this.now(),
                updatedAt: this.now(),
            });

            const results = await this.query<any>(
                `INSERT INTO projects (id, user_id, name, description, config, tech_stack, status, files_count, last_generated_at, created_at, updated_at)
                 VALUES ($id, $userId, $name, $description, $config, $techStack, $status, $filesCount, $lastGeneratedAt, $createdAt, $updatedAt)
                 RETURNING *`,
                row
            );

            if (!results[0]) {
                throw new Error('Failed to create project');
            }

            return this.rowToEntity<Project>(results[0]);
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Find project by ID
     */
    async findById(id: string): Promise<Project | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM projects WHERE id = $id AND status != 'deleted'`,
                { id }
            );

            return results[0] ? this.rowToEntity<Project>(results[0]) : null;
        } catch (error) {
            this.handleError(error, 'findById');
        }
    }

    /**
     * Find all projects for a user
     */
    async findByUser(userId: string, options?: QueryOptions): Promise<Project[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM projects
                 WHERE user_id = $userId AND status != 'deleted'
                 ${orderBy}
                 ${pagination}`,
                { userId }
            );

            return results.map(r => this.rowToEntity<Project>(r));
        } catch (error) {
            this.handleError(error, 'findByUser');
        }
    }

    /**
     * Find projects with pagination
     */
    async findPaginated(userId: string, options?: QueryOptions): Promise<PaginatedResult<Project>> {
        try {
            const orderBy = this.buildOrderBy(options);
            const limit = options?.limit || 20;
            const offset = options?.offset || 0;

            // Get total count
            const countResults = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM projects
                 WHERE user_id = $userId AND status != 'deleted'`,
                { userId }
            );
            const total = Number(countResults[0]?.count || 0);

            // Get paginated data
            const results = await this.query<any>(
                `SELECT * FROM projects
                 WHERE user_id = $userId AND status != 'deleted'
                 ${orderBy}
                 LIMIT ${limit} OFFSET ${offset}`,
                { userId }
            );

            const data = results.map(r => this.rowToEntity<Project>(r));

            return {
                data,
                total,
                limit,
                offset,
                hasMore: offset + data.length < total,
            };
        } catch (error) {
            this.handleError(error, 'findPaginated');
        }
    }

    /**
     * Update project
     */
    async update(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
        try {
            const fields: string[] = [];
            const values: Record<string, unknown> = { id };
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (key === 'id' || key === 'createdAt') continue;

                const paramName = `$${paramIndex++}`;
                fields.push(`${this.toSnakeCase(key)} = ${paramName}`);
                values[paramName] = value;
            }

            if (fields.length === 0) return;

            fields.push(`updated_at = $${paramIndex}`);
            values[paramIndex] = this.now().toISOString();

            await this.query(
                `UPDATE projects SET ${fields.join(', ')} WHERE id = $id`,
                this.entityToRow(values)
            );
        } catch (error) {
            this.handleError(error, 'update');
        }
    }

    /**
     * Upsert project (create or update)
     */
    async upsert(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Project> {
        // Try to find existing project first
        if (project.id) {
            const existing = await this.findById(project.id);
            if (existing) {
                await this.update(project.id, project);
                return { ...existing, ...project } as Project;
            }
        }

        // Create new project
        return this.create(project);
    }

    /**
     * Delete project (soft delete by setting status to archived)
     */
    async delete(id: string): Promise<void> {
        try {
            await this.query(
                `UPDATE projects SET status = 'deleted', updated_at = $updatedAt WHERE id = $id`,
                { id, updatedAt: this.now().toISOString() }
            );
        } catch (error) {
            this.handleError(error, 'delete');
        }
    }

    /**
     * Archive project
     */
    async archive(id: string): Promise<void> {
        try {
            await this.query(
                `UPDATE projects SET status = 'archived', updated_at = $updatedAt WHERE id = $id`,
                { id, updatedAt: this.now().toISOString() }
            );
        } catch (error) {
            this.handleError(error, 'archive');
        }
    }

    /**
     * Get project count for user
     */
    async count(userId: string): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM projects
                 WHERE user_id = $userId AND status != 'deleted'`,
                { userId }
            );

            return Number(results[0]?.count || 0);
        } catch (error) {
            this.handleError(error, 'count');
        }
    }

    /**
     * Update project's last generation timestamp
     */
    async updateLastGenerated(id: string, fileCount: number): Promise<void> {
        try {
            await this.query(
                `UPDATE projects
                 SET last_generated_at = $lastGeneratedAt,
                     files_count = $fileCount,
                     updated_at = $updatedAt
                 WHERE id = $id`,
                {
                    id,
                    lastGeneratedAt: this.now().toISOString(),
                    fileCount,
                    updatedAt: this.now().toISOString(),
                }
            );
        } catch (error) {
            this.handleError(error, 'updateLastGenerated');
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
     * PERFORMANCE: Find projects with task counts in a single query
     * Prevents N+1 when displaying project list with task counts
     */
    async findByUserWithStats(userId: string, options?: QueryOptions): Promise<ProjectWithStats[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            // Single query with LEFT JOIN and aggregation
            const results = await this.query<any>(
                `SELECT 
                    p.*,
                    COUNT(t.id) as task_count,
                    COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_task_count,
                    COUNT(t.id) FILTER (WHERE t.status = 'failed') as failed_task_count,
                    MAX(t.updated_at) as last_task_at
                FROM projects p
                LEFT JOIN tasks t ON t.project_id = p.id
                WHERE p.user_id = $userId AND p.status != 'deleted'
                GROUP BY p.id
                ${orderBy}
                ${pagination}`,
                { userId }
            );

            return results.map(r => ({
                ...this.rowToEntity<Project>(r),
                taskCount: Number(r.task_count || 0),
                completedTaskCount: Number(r.completed_task_count || 0),
                failedTaskCount: Number(r.failed_task_count || 0),
                lastTaskAt: r.last_task_at ? new Date(r.last_task_at) : null,
            }));
        } catch (error) {
            this.handleError(error, 'findByUserWithStats');
        }
    }

    /**
     * PERFORMANCE: Find project with recent tasks in a single query
     * Prevents N+1 when showing project details with tasks
     */
    async findByIdWithTasks(projectId: string, taskLimit: number = 10): Promise<ProjectWithTasks | null> {
        try {
            // Use a subquery to get recent tasks efficiently
            const results = await this.query<any>(
                `SELECT 
                    p.*,
                    COALESCE(
                        jsonb_agg(
                            jsonb_build_object(
                                'id', t.id,
                                'type', t.type,
                                'status', t.status,
                                'prompt', t.prompt,
                                'createdAt', t.created_at
                            )
                            ORDER BY t.created_at DESC
                        ) FILTER (WHERE t.id IS NOT NULL),
                        '[]'::jsonb
                    ) as tasks,
                    COUNT(t.id) as task_count
                FROM projects p
                LEFT JOIN LATERAL (
                    SELECT id, type, status, prompt, created_at
                    FROM tasks
                    WHERE project_id = p.id
                    ORDER BY created_at DESC
                    LIMIT $taskLimit
                ) t ON true
                WHERE p.id = $projectId AND p.status != 'deleted'
                GROUP BY p.id`,
                { projectId, taskLimit }
            );

            if (!results[0]) {
                return null;
            }

            const row = results[0];
            return {
                ...this.rowToEntity<Project>(row),
                tasks: row.tasks || [],
                taskCount: Number(row.task_count || 0),
            };
        } catch (error) {
            this.handleError(error, 'findByIdWithTasks');
        }
    }

    /**
     * PERFORMANCE: Batch load projects by IDs
     * Prevents N+1 when loading multiple projects
     */
    async findByIds(ids: string[]): Promise<Project[]> {
        if (ids.length === 0) return [];

        try {
            const results = await this.query<any>(
                `SELECT * FROM projects 
                 WHERE id = ANY($ids) AND status != 'deleted'`,
                { ids }
            );

            return results.map(r => this.rowToEntity<Project>(r));
        } catch (error) {
            this.handleError(error, 'findByIds');
        }
    }

    /**
     * PERFORMANCE: Batch load project stats by IDs
     * Single query for multiple project statistics
     */
    async findStatsByIds(ids: string[]): Promise<Map<string, { taskCount: number; lastTaskAt: Date | null }>> {
        if (ids.length === 0) return new Map();

        try {
            const results = await this.query<{
                project_id: string;
                task_count: bigint;
                last_task_at: string | null;
            }>(
                `SELECT 
                    t.project_id,
                    COUNT(t.id) as task_count,
                    MAX(t.updated_at) as last_task_at
                FROM tasks t
                WHERE t.project_id = ANY($ids)
                GROUP BY t.project_id`,
                { ids }
            );

            const statsMap = new Map<string, { taskCount: number; lastTaskAt: Date | null }>();
            
            for (const row of results) {
                statsMap.set(row.project_id, {
                    taskCount: Number(row.task_count),
                    lastTaskAt: row.last_task_at ? new Date(row.last_task_at) : null,
                });
            }

            // Add entries for projects with no tasks
            for (const id of ids) {
                if (!statsMap.has(id)) {
                    statsMap.set(id, { taskCount: 0, lastTaskAt: null });
                }
            }

            return statsMap;
        } catch (error) {
            this.handleError(error, 'findStatsByIds');
        }
    }
}
