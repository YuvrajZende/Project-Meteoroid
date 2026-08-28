/**
 * Project Repository
 * Week 2: Repository Layer - Day 11
 *
 * Handles all database operations for projects
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
import { BaseRepository, RepositoryError } from './base.repository.js';

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
        return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
