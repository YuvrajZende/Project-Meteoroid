/**
 * Testing Iteration Repository
 * Week 2: Repository Layer - Day 12
 *
 * Handles database operations for testing_iterations table
 * Used by LearningService to store and retrieve test iterations
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type { TestingIteration } from '../interfaces/learning.interface.js';
import { BaseRepository } from './base.repository.js';

export interface ITestingIterationRepository {
    create(iteration: Omit<TestingIteration, 'id' | 'createdAt'>): Promise<TestingIteration>;
    findById(id: string): Promise<TestingIteration | null>;
    findByProjectId(projectId: string): Promise<TestingIteration[]>;
    findByTestType(testType: TestingIteration['testType']): Promise<TestingIteration[]>;
    findRecent(options?: { limit?: number }): Promise<TestingIteration[]>;
    count(): Promise<number>;
}

@injectable()
export class TestingIterationRepository extends BaseRepository implements ITestingIterationRepository {
    protected readonly tableName = 'testing_iterations';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Create a new testing iteration
     */
    async create(iteration: Omit<TestingIteration, 'id' | 'createdAt'>): Promise<TestingIteration> {
        try {
            const row = this.entityToRow({
                id: this.generateId(),
                ...iteration,
                createdAt: this.now(),
            });

            const results = await this.query<any>(
                `INSERT INTO testing_iterations (
                    id, project_id, test_type, test_description, user_query,
                    expected_behavior, actual_result, success, lessons, related_files, tags, created_at
                ) VALUES ($id, $projectId, $testType, $testDescription, $userQuery, $expectedBehavior, $actualResult, $success, $lessons, $relatedFiles, $tags, $createdAt)
                RETURNING *`,
                row
            );

            if (!results[0]) {
                throw new Error('Failed to create testing iteration');
            }

            return this.rowToEntity<TestingIteration>(results[0]);
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Find testing iteration by ID
     */
    async findById(id: string): Promise<TestingIteration | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM testing_iterations WHERE id = $id`,
                { id }
            );

            return results[0] ? this.rowToEntity<TestingIteration>(results[0]) : null;
        } catch (error) {
            this.handleError(error, 'findById');
        }
    }

    /**
     * Find testing iterations by project ID
     */
    async findByProjectId(projectId: string): Promise<TestingIteration[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM testing_iterations
                 WHERE project_id = $projectId
                 ORDER BY created_at DESC`,
                { projectId }
            );

            return results.map(r => this.rowToEntity<TestingIteration>(r));
        } catch (error) {
            this.handleError(error, 'findByProjectId');
        }
    }

    /**
     * Find testing iterations by test type
     */
    async findByTestType(testType: TestingIteration['testType']): Promise<TestingIteration[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM testing_iterations
                 WHERE test_type = $testType
                 ORDER BY created_at DESC`,
                { testType }
            );

            return results.map(r => this.rowToEntity<TestingIteration>(r));
        } catch (error) {
            this.handleError(error, 'findByTestType');
        }
    }

    /**
     * Find recent testing iterations
     */
    async findRecent(options?: { limit?: number }): Promise<TestingIteration[]> {
        try {
            const limit = options?.limit || 50;

            const results = await this.query<any>(
                `SELECT * FROM testing_iterations
                 ORDER BY created_at DESC
                 LIMIT $limit`,
                { limit }
            );

            return results.map(r => this.rowToEntity<TestingIteration>(r));
        } catch (error) {
            this.handleError(error, 'findRecent');
        }
    }

    /**
     * Count total testing iterations
     */
    async count(): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM testing_iterations`
            );

            return Number(results[0]?.count || 0);
        } catch (error) {
            this.handleError(error, 'count');
        }
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
