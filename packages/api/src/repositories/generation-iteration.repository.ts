/**
 * Generation Iteration Repository
 * Week 2: Repository Layer - Day 12
 *
 * Handles database operations for generation_iterations table
 * Used by LearningService to store and retrieve AI generation iterations
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type { GenerationIteration } from '../interfaces/learning.interface.js';
import { BaseRepository } from './base.repository.js';

export interface IGenerationIterationRepository {
    create(iteration: Omit<GenerationIteration, 'id' | 'createdAt'>): Promise<GenerationIteration>;
    findById(id: string): Promise<GenerationIteration | null>;
    findByTaskId(taskId: string): Promise<GenerationIteration[]>;
    findByProjectId(projectId: string, options?: { limit?: number; offset?: number }): Promise<GenerationIteration[]>;
    findBySuccess(success: boolean, options?: { limit?: number }): Promise<GenerationIteration[]>;
    findRecent(options?: { limit?: number; offset?: number }): Promise<GenerationIteration[]>;
    searchByPrompt(query: string, options?: { limit?: number; projectId?: string }): Promise<GenerationIteration[]>;
    update(id: string, updates: Partial<Omit<GenerationIteration, 'id' | 'createdAt'>>): Promise<void>;
    updateFeedback(id: string, feedback: GenerationIteration['feedback']): Promise<void>;
    count(): Promise<number>;
    countByProject(projectId: string): Promise<number>;
}

@injectable()
export class GenerationIterationRepository extends BaseRepository implements IGenerationIterationRepository {
    protected readonly tableName = 'generation_iterations';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Create a new generation iteration
     */
    async create(iteration: Omit<GenerationIteration, 'id' | 'createdAt'>): Promise<GenerationIteration> {
        try {
            const row = this.entityToRow({
                id: this.generateId(),
                ...iteration,
                createdAt: this.now(),
            });

            const results = await this.query<any>(
                `INSERT INTO generation_iterations (
                    task_id, project_id, user_id, prompt, generated_code, config,
                    success, errors, feedback, test_results, metrics, created_at
                ) VALUES ($taskId, $projectId, $userId, $prompt, $generatedCode, $config, $success, $errors, $feedback, $testResults, $metrics, $createdAt)
                RETURNING *`,
                row
            );

            if (!results[0]) {
                throw new Error('Failed to create generation iteration');
            }

            return this.rowToEntity<GenerationIteration>(results[0]);
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Find iteration by ID
     */
    async findById(id: string): Promise<GenerationIteration | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM generation_iterations WHERE id = $id`,
                { id }
            );

            return results[0] ? this.rowToEntity<GenerationIteration>(results[0]) : null;
        } catch (error) {
            this.handleError(error, 'findById');
        }
    }

    /**
     * Find iterations by task ID
     */
    async findByTaskId(taskId: string): Promise<GenerationIteration[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM generation_iterations WHERE task_id = $taskId ORDER BY created_at DESC`,
                { taskId }
            );

            return results.map(r => this.rowToEntity<GenerationIteration>(r));
        } catch (error) {
            this.handleError(error, 'findByTaskId');
        }
    }

    /**
     * Find iterations by project ID
     */
    async findByProjectId(projectId: string, options?: { limit?: number; offset?: number }): Promise<GenerationIteration[]> {
        try {
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM generation_iterations
                 WHERE project_id = $projectId
                 ORDER BY created_at DESC
                 ${pagination}`,
                { projectId }
            );

            return results.map(r => this.rowToEntity<GenerationIteration>(r));
        } catch (error) {
            this.handleError(error, 'findByProjectId');
        }
    }

    /**
     * Find iterations by success status
     */
    async findBySuccess(success: boolean, options?: { limit?: number }): Promise<GenerationIteration[]> {
        try {
            const limit = options?.limit || 50;

            const results = await this.query<any>(
                `SELECT * FROM generation_iterations
                 WHERE success = $success
                 ORDER BY created_at DESC
                 LIMIT $limit`,
                { success, limit }
            );

            return results.map(r => this.rowToEntity<GenerationIteration>(r));
        } catch (error) {
            this.handleError(error, 'findBySuccess');
        }
    }

    /**
     * Find recent iterations
     */
    async findRecent(options?: { limit?: number; offset?: number }): Promise<GenerationIteration[]> {
        try {
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM generation_iterations
                 ORDER BY created_at DESC
                 ${pagination}`
            );

            return results.map(r => this.rowToEntity<GenerationIteration>(r));
        } catch (error) {
            this.handleError(error, 'findRecent');
        }
    }

    /**
     * Search iterations by prompt content
     */
    async searchByPrompt(query: string, options?: { limit?: number; projectId?: string }): Promise<GenerationIteration[]> {
        try {
            const limit = options?.limit || 20;
            const searchTerm = `%${query}%`;

            let sql = `SELECT * FROM generation_iterations
                      WHERE prompt ILIKE $query
                      ORDER BY created_at DESC
                      LIMIT $limit`;

            const params: Record<string, unknown> = { query: searchTerm, limit };

            if (options?.projectId) {
                sql = `SELECT * FROM generation_iterations
                       WHERE prompt ILIKE $query AND project_id = $projectId
                       ORDER BY created_at DESC
                       LIMIT $limit`;
                params.projectId = options.projectId;
            }

            const results = await this.query<any>(sql, params);
            return results.map(r => this.rowToEntity<GenerationIteration>(r));
        } catch (error) {
            this.handleError(error, 'searchByPrompt');
        }
    }

    /**
     * Update iteration
     */
    async update(id: string, updates: Partial<Omit<GenerationIteration, 'id' | 'createdAt'>>): Promise<void> {
        try {
            const fields: string[] = [];
            const values: Record<string, unknown> = {};
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (key === 'id' || key === 'createdAt') continue;

                const paramName = `$${paramIndex++}`;
                fields.push(`${this.toSnakeCase(key)} = ${paramName}`);

                if (key === 'generatedCode' || key === 'config' || key === 'errors' || key === 'testResults' || key === 'metrics' || key === 'feedback') {
                    values[paramName] = JSON.stringify(value);
                } else {
                    values[paramName] = value;
                }
            }

            if (fields.length === 0) return;

            await this.query(
                `UPDATE generation_iterations SET ${fields.join(', ')} WHERE id = $id`,
                { id, ...values }
            );
        } catch (error) {
            this.handleError(error, 'update');
        }
    }

    /**
     * Update feedback for an iteration
     */
    async updateFeedback(id: string, feedback: GenerationIteration['feedback']): Promise<void> {
        try {
            await this.query(
                `UPDATE generation_iterations SET feedback = $feedback WHERE id = $id`,
                { id, feedback: JSON.stringify(feedback) }
            );
        } catch (error) {
            this.handleError(error, 'updateFeedback');
        }
    }

    /**
     * Count total iterations
     */
    async count(): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM generation_iterations`
            );

            return Number(results[0]?.count || 0);
        } catch (error) {
            this.handleError(error, 'count');
        }
    }

    /**
     * Count iterations by project
     */
    async countByProject(projectId: string): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM generation_iterations WHERE project_id = $projectId`,
                { projectId }
            );

            return Number(results[0]?.count || 0);
        } catch (error) {
            this.handleError(error, 'countByProject');
        }
    }

    /**
     * Convert camelCase to snake_case
     */
    private toSnakeCase(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return `iter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
