/**
 * Project Context Repository
 * Week 2: Repository Layer - Day 12
 *
 * Handles database operations for project_contexts table
 * Used by ContextManager to store and retrieve persistent context
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type { PersistentContext } from '../interfaces/context.interface.js';
import { BaseRepository } from './base.repository.js';

export interface IProjectContextRepository {
    save(context: PersistentContext): Promise<void>;
    get(userId: string, projectId: string): Promise<PersistentContext | null>;
    update(userId: string, projectId: string, updates: Partial<Omit<PersistentContext, 'userId' | 'projectId'>>): Promise<void>;
    delete(userId: string, projectId: string): Promise<void>;
    updateLastActive(userId: string, projectId: string): Promise<void>;
    findByUserId(userId: string): Promise<PersistentContext[]>;
    count(): Promise<number>;
}

@injectable()
export class ProjectContextRepository extends BaseRepository implements IProjectContextRepository {
    protected readonly tableName = 'project_contexts';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Save or update project context
     */
    async save(context: PersistentContext): Promise<void> {
        try {
            const existing = await this.get(context.userId, context.projectId);

            if (existing) {
                // Update existing context
                await this.update(context.userId, context.projectId, context);
            } else {
                // Insert new context
                const row = this.entityToRow({
                    ...context,
                    lastActive: context.lastActive || this.now(),
                });

                await this.query(
                    `INSERT INTO project_contexts (
                        user_id, project_id, preferences, recent_projects, recent_prompts,
                        tech_stack_history, last_active
                    ) VALUES ($userId, $projectId, $preferences, $recentProjects, $recentPrompts, $techStackHistory, $lastActive)
                    ON CONFLICT (user_id, project_id) DO UPDATE SET
                        preferences = EXCLUDED.preferences,
                        recent_projects = EXCLUDED.recent_projects,
                        recent_prompts = EXCLUDED.recent_prompts,
                        tech_stack_history = EXCLUDED.tech_stack_history,
                        last_active = EXCLUDED.last_active`,
                    row
                );
            }
        } catch (error) {
            this.handleError(error, 'save');
        }
    }

    /**
     * Get project context
     */
    async get(userId: string, projectId: string): Promise<PersistentContext | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM project_contexts
                 WHERE user_id = $userId AND project_id = $projectId
                 LIMIT 1`,
                { userId, projectId }
            );

            if (!results[0]) {
                return null;
            }

            const data = results[0];
            return {
                userId: data.user_id,
                projectId: data.project_id,
                preferences: data.preferences ? JSON.parse(data.preferences) : {},
                recentProjects: data.recent_projects ? JSON.parse(data.recent_projects) : [],
                recentPrompts: data.recent_prompts ? JSON.parse(data.recent_prompts) : [],
                techStackHistory: data.tech_stack_history ? JSON.parse(data.tech_stack_history) : [],
                lastActive: new Date(data.last_active),
            };
        } catch (error) {
            this.handleError(error, 'get');
        }
    }

    /**
     * Update project context
     */
    async update(userId: string, projectId: string, updates: Partial<Omit<PersistentContext, 'userId' | 'projectId'>>): Promise<void> {
        try {
            const fields: string[] = [];
            const values: Record<string, unknown> = { userId, projectId };
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (key === 'userId' || key === 'projectId') continue;

                const paramName = `$${paramIndex++}`;
                fields.push(`${this.toSnakeCase(key)} = ${paramName}`);

                if (key === 'preferences' || key === 'recentProjects' || key === 'recentPrompts' || key === 'techStackHistory') {
                    values[paramName] = JSON.stringify(value);
                } else if (value instanceof Date) {
                    values[paramName] = value.toISOString();
                } else {
                    values[paramName] = value;
                }
            }

            if (fields.length === 0) return;

            await this.query(
                `UPDATE project_contexts SET ${fields.join(', ')}, last_active = $lastActive
                 WHERE user_id = $userId AND project_id = $projectId`,
                { ...values, lastActive: this.now().toISOString() }
            );
        } catch (error) {
            this.handleError(error, 'update');
        }
    }

    /**
     * Delete project context
     */
    async delete(userId: string, projectId: string): Promise<void> {
        try {
            await this.query(
                `DELETE FROM project_contexts WHERE user_id = $userId AND project_id = $projectId`,
                { userId, projectId }
            );
        } catch (error) {
            this.handleError(error, 'delete');
        }
    }

    /**
     * Update last active timestamp
     */
    async updateLastActive(userId: string, projectId: string): Promise<void> {
        try {
            await this.query(
                `UPDATE project_contexts SET last_active = $lastActive
                 WHERE user_id = $userId AND project_id = $projectId`,
                { userId, projectId, lastActive: this.now().toISOString() }
            );
        } catch (error) {
            this.handleError(error, 'updateLastActive');
        }
    }

    /**
     * Find all contexts for a user
     */
    async findByUserId(userId: string): Promise<PersistentContext[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM project_contexts
                 WHERE user_id = $userId
                 ORDER BY last_active DESC`,
                { userId }
            );

            return results.map(r => this.rowToEntity<PersistentContext>(r));
        } catch (error) {
            this.handleError(error, 'findByUserId');
        }
    }

    /**
     * Count total project contexts
     */
    async count(): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM project_contexts`
            );

            return Number(results[0]?.count || 0);
        } catch (error) {
            this.handleError(error, 'count');
        }
    }

    /**
     * Convert camelCase to snake_case
     */
    private toSnakeCase(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }
}
