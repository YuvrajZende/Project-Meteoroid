/**
 * Learned Pattern Repository
 * Week 2: Repository Layer - Day 12
 *
 * Handles database operations for learned_patterns table
 * Used by LearningService to store and retrieve learned patterns
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type { LearnedPattern } from '../interfaces/learning.interface.js';
import { BaseRepository } from './base.repository.js';

export interface ILearnedPatternRepository {
    create(pattern: Omit<LearnedPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearnedPattern>;
    findById(id: string): Promise<LearnedPattern | null>;
    findByPatternType(patternType: LearnedPattern['patternType']): Promise<LearnedPattern[]>;
    findByConfidence(minConfidence: number): Promise<LearnedPattern[]>;
    findTopPatterns(options?: { limit?: number }): Promise<LearnedPattern[]>;
    updateFrequency(id: string): Promise<void>;
    count(): Promise<number>;
}

@injectable()
export class LearnedPatternRepository extends BaseRepository implements ILearnedPatternRepository {
    protected readonly tableName = 'learned_patterns';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Create a new learned pattern
     */
    async create(pattern: Omit<LearnedPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearnedPattern> {
        try {
            const row = this.entityToRow({
                id: this.generateId(),
                ...pattern,
                createdAt: this.now(),
                updatedAt: this.now(),
            });

            const results = await this.query<any>(
                `INSERT INTO learned_patterns (
                    pattern_type, description, example, context, frequency, confidence, related_prompts, created_at, updated_at
                ) VALUES ($patternType, $description, $example, $context, $frequency, $confidence, $relatedPrompts, $createdAt, $updatedAt)
                RETURNING *`,
                row
            );

            if (!results[0]) {
                throw new Error('Failed to create learned pattern');
            }

            return this.rowToEntity<LearnedPattern>(results[0]);
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Find pattern by ID
     */
    async findById(id: string): Promise<LearnedPattern | null> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM learned_patterns WHERE id = $id`,
                { id }
            );

            return results[0] ? this.rowToEntity<LearnedPattern>(results[0]) : null;
        } catch (error) {
            this.handleError(error, 'findById');
        }
    }

    /**
     * Find patterns by type
     */
    async findByPatternType(patternType: LearnedPattern['patternType']): Promise<LearnedPattern[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM learned_patterns
                 WHERE pattern_type = $patternType
                 ORDER BY frequency DESC, confidence DESC`,
                { patternType }
            );

            return results.map(r => this.rowToEntity<LearnedPattern>(r));
        } catch (error) {
            this.handleError(error, 'findByPatternType');
        }
    }

    /**
     * Find patterns by minimum confidence
     */
    async findByConfidence(minConfidence: number): Promise<LearnedPattern[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM learned_patterns
                 WHERE confidence >= $minConfidence
                 ORDER BY frequency DESC, confidence DESC`,
                { minConfidence }
            );

            return results.map(r => this.rowToEntity<LearnedPattern>(r));
        } catch (error) {
            this.handleError(error, 'findByConfidence');
        }
    }

    /**
     * Find top patterns by frequency and confidence
     */
    async findTopPatterns(options?: { limit?: number }): Promise<LearnedPattern[]> {
        try {
            const limit = options?.limit || 100;

            const results = await this.query<any>(
                `SELECT * FROM learned_patterns
                 ORDER BY frequency DESC, confidence DESC
                 LIMIT $limit`,
                { limit }
            );

            return results.map(r => this.rowToEntity<LearnedPattern>(r));
        } catch (error) {
            this.handleError(error, 'findTopPatterns');
        }
    }

    /**
     * Update pattern frequency
     */
    async updateFrequency(id: string): Promise<void> {
        try {
            await this.query(
                `UPDATE learned_patterns
                 SET frequency = frequency + 1, updated_at = $updatedAt
                 WHERE id = $id`,
                { id, updatedAt: this.now().toISOString() }
            );
        } catch (error) {
            this.handleError(error, 'updateFrequency');
        }
    }

    /**
     * Count total patterns
     */
    async count(): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `SELECT COUNT(*) as count FROM learned_patterns`
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
        return crypto.randomUUID();
    }
}
