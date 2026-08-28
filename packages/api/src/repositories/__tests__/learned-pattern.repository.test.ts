/**
 * Unit Tests: LearnedPatternRepository
 * Tests for learned_patterns repository operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LearnedPatternRepository } from '../learned-pattern.repository.js';
import { MockDatabase } from './mock-database.js';
import type { LearnedPattern } from '../../interfaces/learning.interface.js';

describe('LearnedPatternRepository', () => {
    let repository: LearnedPatternRepository;
    let mockDb: MockDatabase;

    // ============================================
    // TEST FIXTURES
    // ============================================

    const mockPatternEntity: LearnedPattern = {
        id: 'pattern_001',
        patternType: 'code-structure',
        description: 'Common REST API controller pattern',
        example: 'export async function handler(req, res) { ... }',
        context: 'Used in Fastify route handlers',
        frequency: 15,
        confidence: 0.92,
        relatedPrompts: ['create API endpoint', 'add route handler', 'implement controller'],
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
    };

    const mockPatternRow = {
        id: 'pattern_001',
        pattern_type: 'code-structure',
        description: 'Common REST API controller pattern',
        example: 'export async function handler(req, res) { ... }',
        context: 'Used in Fastify route handlers',
        frequency: 15,
        confidence: 0.92,
        related_prompts: JSON.stringify(['create API endpoint', 'add route handler', 'implement controller']),
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
    };

    beforeEach(() => {
        mockDb = new MockDatabase();
        repository = new LearnedPatternRepository(mockDb);
    });

    // ============================================
    // CREATE
    // ============================================

    describe('create', () => {
        it('should create a new learned pattern', async () => {
            const input = {
                patternType: 'code-structure' as const,
                description: 'Common REST API pattern',
                example: 'export function handler() {}',
                context: 'Used in API routes',
                frequency: 10,
                confidence: 0.85,
                relatedPrompts: ['create API'],
            };

            const result = await repository.create(input);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^pattern_\d+_\w+$/);
            expect(result.patternType).toBe('code-structure');
            expect(result.description).toBe('Common REST API pattern');
            expect(result.frequency).toBe(10);
            expect(result.confidence).toBe(0.85);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should generate unique IDs for each pattern', async () => {
            const input = {
                patternType: 'code-structure' as const,
                description: 'Test',
                example: 'test',
                context: 'test',
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: [],
            };

            const result1 = await repository.create(input);
            const result2 = await repository.create(input);

            expect(result1.id).not.toBe(result2.id);
        });

        it('should set createdAt and updatedAt to current time', async () => {
            const beforeCreate = new Date();

            const result = await repository.create({
                patternType: 'code-structure' as const,
                description: 'Test',
                example: 'test',
                context: 'test',
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: [],
            });

            const afterCreate = new Date();

            expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
            expect(result.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
            expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
            expect(result.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
        });

        it('should handle all pattern types', async () => {
            const patternTypes: LearnedPattern['patternType'][] = [
                'code-structure',
                'error-handling',
                'testing-pattern',
                'api-design',
                'optimization',
                'security-pattern',
                'data-validation',
                'integration-pattern',
                'other',
            ];

            for (const patternType of patternTypes) {
                const result = await repository.create({
                    patternType,
                    description: `Test ${patternType}`,
                    example: 'test',
                    context: 'test',
                    frequency: 1,
                    confidence: 0.5,
                    relatedPrompts: [],
                });

                expect(result.patternType).toBe(patternType);
            }
        });

        it('should handle null optional fields', async () => {
            const result = await repository.create({
                patternType: 'other',
                description: 'Test',
                example: null,
                context: null,
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: null,
            });

            expect(result.example).toBeNull();
            expect(result.context).toBeNull();
            expect(result.relatedPrompts).toBeNull();
        });

        it('should handle errors during creation', async () => {
            const badDb = new MockDatabase();
            badDb.query = () => { throw new Error('Database connection failed'); };
            const badRepo = new LearnedPatternRepository(badDb);

            await expect(badRepo.create({
                patternType: 'other',
                description: 'Test',
                example: 'test',
                context: 'test',
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: [],
            })).rejects.toThrow('RepositoryError');
        });
    });

    // ============================================
    // FIND BY ID
    // ============================================

    describe('findById', () => {
        it('should find pattern by ID', async () => {
            mockDb.seed('learned_patterns', [mockPatternRow]);

            const result = await repository.findById('pattern_001');

            expect(result).toBeDefined();
            expect(result?.id).toBe('pattern_001');
            expect(result?.patternType).toBe('code-structure');
            expect(result?.description).toBe('Common REST API controller pattern');
            expect(result?.frequency).toBe(15);
            expect(result?.confidence).toBe(0.92);
        });

        it('should return null if pattern not found', async () => {
            const result = await repository.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should parse JSON fields correctly', async () => {
            mockDb.seed('learned_patterns', [mockPatternRow]);

            const result = await repository.findById('pattern_001');

            expect(result?.relatedPrompts).toEqual(['create API endpoint', 'add route handler', 'implement controller']);
        });

        it('should handle null JSON fields', async () => {
            mockDb.seed('learned_patterns', [{
                ...mockPatternRow,
                example: null,
                context: null,
                related_prompts: null,
            }]);

            const result = await repository.findById('pattern_001');

            expect(result?.example).toBeNull();
            expect(result?.context).toBeNull();
            expect(result?.relatedPrompts).toBeNull();
        });
    });

    // ============================================
    // FIND BY PATTERN TYPE
    // ============================================

    describe('findByPatternType', () => {
        beforeEach(() => {
            mockDb.seed('learned_patterns', [
                mockPatternRow,
                { ...mockPatternRow, id: 'pattern_002', pattern_type: 'code-structure', frequency: 20 },
                { ...mockPatternRow, id: 'pattern_003', pattern_type: 'error-handling', frequency: 10 },
                { ...mockPatternRow, id: 'pattern_004', pattern_type: 'code-structure', frequency: 5 },
            ]);
        });

        it('should find patterns by type ordered by frequency DESC', async () => {
            const results = await repository.findByPatternType('code-structure');

            expect(results).toHaveLength(3);
            expect(results.every(r => r.patternType === 'code-structure')).toBe(true);
            expect(results[0].id).toBe('pattern_002'); // frequency 20
            expect(results[1].id).toBe('pattern_001'); // frequency 15
            expect(results[2].id).toBe('pattern_004'); // frequency 5
        });

        it('should return empty array for non-existent pattern type', async () => {
            const results = await repository.findByPatternType('optimization');

            expect(results).toEqual([]);
        });

        it('should order by frequency DESC, then confidence DESC', async () => {
            mockDb.seed('learned_patterns', [
                { ...mockPatternRow, id: 'pattern_001', pattern_type: 'code-structure', frequency: 10, confidence: 0.9 },
                { ...mockPatternRow, id: 'pattern_002', pattern_type: 'code-structure', frequency: 10, confidence: 0.95 },
                { ...mockPatternRow, id: 'pattern_003', pattern_type: 'code-structure', frequency: 5, confidence: 1.0 },
            ]);

            const results = await repository.findByPatternType('code-structure');

            // Same frequency, higher confidence first
            expect(results[0].id).toBe('pattern_002');
            expect(results[1].id).toBe('pattern_001');
            expect(results[2].id).toBe('pattern_003');
        });

        it('should handle all pattern types', async () => {
            const patternTypes: LearnedPattern['patternType'][] = [
                'code-structure',
                'error-handling',
                'testing-pattern',
                'api-design',
                'optimization',
                'security-pattern',
                'data-validation',
                'integration-pattern',
                'other',
            ];

            for (const patternType of patternTypes) {
                mockDb.clearAll();
                mockDb.seed('learned_patterns', [{
                    ...mockPatternRow,
                    id: `pattern_${patternType}`,
                    pattern_type: patternType,
                }]);

                const results = await repository.findByPatternType(patternType);
                expect(results).toHaveLength(1);
                expect(results[0].patternType).toBe(patternType);
            }
        });
    });

    // ============================================
    // FIND BY CONFIDENCE
    // ============================================

    describe('findByConfidence', () => {
        beforeEach(() => {
            mockDb.seed('learned_patterns', [
                mockPatternRow,
                { ...mockPatternRow, id: 'pattern_002', confidence: 0.95, frequency: 10 },
                { ...mockPatternRow, id: 'pattern_003', confidence: 0.80, frequency: 20 },
                { ...mockPatternRow, id: 'pattern_004', confidence: 0.85, frequency: 15 },
            ]);
        });

        it('should find patterns with confidence >= threshold', async () => {
            const results = await repository.findByConfidence(0.85);

            expect(results).toHaveLength(3);
            expect(results.every(r => r.confidence >= 0.85)).toBe(true);
        });

        it('should order by frequency DESC, then confidence DESC', async () => {
            const results = await repository.findByConfidence(0.80);

            expect(results[0].id).toBe('pattern_003'); // freq 20, conf 0.80
            expect(results[1].id).toBe('pattern_004'); // freq 15, conf 0.85
        });

        it('should return empty array when no patterns meet threshold', async () => {
            const results = await repository.findByConfidence(0.99);

            expect(results).toEqual([]);
        });

        it('should handle edge case confidence values', async () => {
            mockDb.seed('learned_patterns', [
                { ...mockPatternRow, id: 'pattern_001', confidence: 0.0 },
                { ...mockPatternRow, id: 'pattern_002', confidence: 0.5 },
                { ...mockPatternRow, id: 'pattern_003', confidence: 1.0 },
            ]);

            const results = await repository.findByConfidence(0.5);

            expect(results).toHaveLength(2);
            expect(results[0].confidence).toBe(1.0);
            expect(results[1].confidence).toBe(0.5);
        });
    });

    // ============================================
    // FIND TOP PATTERNS
    // ============================================

    describe('findTopPatterns', () => {
        beforeEach(() => {
            mockDb.seed('learned_patterns', [
                { ...mockPatternRow, id: 'pattern_001', frequency: 10, confidence: 0.9 },
                { ...mockPatternRow, id: 'pattern_002', frequency: 20, confidence: 0.8 },
                { ...mockPatternRow, id: 'pattern_003', frequency: 20, confidence: 0.95 },
                { ...mockPatternRow, id: 'pattern_004', frequency: 5, confidence: 1.0 },
                { ...mockPatternRow, id: 'pattern_005', frequency: 15, confidence: 0.85 },
            ]);
        });

        it('should return patterns ordered by frequency DESC, confidence DESC', async () => {
            const results = await repository.findTopPatterns();

            expect(results[0].id).toBe('pattern_003'); // freq 20, conf 0.95
            expect(results[1].id).toBe('pattern_002'); // freq 20, conf 0.8
            expect(results[2].id).toBe('pattern_005'); // freq 15, conf 0.85
            expect(results[3].id).toBe('pattern_001'); // freq 10, conf 0.9
            expect(results[4].id).toBe('pattern_004'); // freq 5, conf 1.0
        });

        it('should limit results by default', async () => {
            // Seed more than 100 patterns
            const manyPatterns = Array.from({ length: 150 }, (_, i) => ({
                ...mockPatternRow,
                id: `pattern_${i}`,
                frequency: 100 - i,
                confidence: 0.5 + (i / 300),
            }));

            mockDb.clearAll();
            mockDb.seed('learned_patterns', manyPatterns);

            const results = await repository.findTopPatterns();

            expect(results.length).toBeLessThanOrEqual(100);
        });

        it('should respect custom limit', async () => {
            const results = await repository.findTopPatterns({ limit: 3 });

            expect(results).toHaveLength(3);
            expect(results[0].id).toBe('pattern_003');
            expect(results[1].id).toBe('pattern_002');
            expect(results[2].id).toBe('pattern_005');
        });

        it('should return empty array when no patterns exist', async () => {
            mockDb.clearAll();

            const results = await repository.findTopPatterns();

            expect(results).toEqual([]);
        });
    });

    // ============================================
    // UPDATE FREQUENCY
    // ============================================

    describe('updateFrequency', () => {
        beforeEach(() => {
            mockDb.seed('learned_patterns', [{
                ...mockPatternRow,
                frequency: 10,
                updated_at: '2024-01-15T10:00:00Z',
            }]);
        });

        it('should increment pattern frequency', async () => {
            await repository.updateFrequency('pattern_001');

            const result = await repository.findById('pattern_001');
            expect(result?.frequency).toBe(11);
        });

        it('should update the updatedAt timestamp', async () => {
            const beforeUpdate = new Date();

            await repository.updateFrequency('pattern_001');

            const afterUpdate = new Date();
            const result = await repository.findById('pattern_001');

            expect(result?.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
            expect(result?.updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
        });

        it('should handle multiple updates', async () => {
            await repository.updateFrequency('pattern_001');
            await repository.updateFrequency('pattern_001');
            await repository.updateFrequency('pattern_001');

            const result = await repository.findById('pattern_001');
            expect(result?.frequency).toBe(13);
        });

        it('should handle non-existent pattern gracefully', async () => {
            await expect(repository.updateFrequency('nonexistent')).resolves.not.toThrow();
        });
    });

    // ============================================
    // COUNT
    // ============================================

    describe('count', () => {
        it('should return total count of patterns', async () => {
            mockDb.seed('learned_patterns', [
                mockPatternRow,
                { ...mockPatternRow, id: 'pattern_002' },
                { ...mockPatternRow, id: 'pattern_003' },
                { ...mockPatternRow, id: 'pattern_004' },
                { ...mockPatternRow, id: 'pattern_005' },
            ]);

            const count = await repository.count();

            expect(count).toBe(5);
        });

        it('should return 0 when no patterns exist', async () => {
            const count = await repository.count();

            expect(count).toBe(0);
        });
    });

    // ============================================
    // EDGE CASES
    // ============================================

    describe('Edge Cases', () => {
        it('should handle special characters in fields', async () => {
            const result = await repository.create({
                patternType: 'other',
                description: 'Pattern with "quotes" and \'apostrophes\'',
                example: 'const regex = /<html>[\\s\\S]*<\\/html>/;',
                context: 'Used with special chars: @#$%',
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: ['Query with "quotes"', 'Test with <html>'],
            });

            expect(result.description).toContain('quotes');
            expect(result.example).toContain('<html>');
            expect(result.relatedPrompts).toEqual(['Query with "quotes"', 'Test with <html>']);
        });

        it('should handle very long strings', async () => {
            const longString = 'a'.repeat(10000);

            const result = await repository.create({
                patternType: 'other',
                description: longString,
                example: longString,
                context: longString,
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: [longString],
            });

            expect(result.description).toHaveLength(10000);
        });

        it('should handle empty arrays for optional fields', async () => {
            const result = await repository.create({
                patternType: 'other',
                description: 'Test',
                example: 'test',
                context: 'test',
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: [],
            });

            expect(result.relatedPrompts).toEqual([]);
        });

        it('should handle arrays with many items', async () => {
            const manyPrompts = Array.from({ length: 100 }, (_, i) => `prompt_${i}`);

            const result = await repository.create({
                patternType: 'other',
                description: 'Test',
                example: 'test',
                context: 'test',
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: manyPrompts,
            });

            expect(result.relatedPrompts).toHaveLength(100);
        });

        it('should handle boundary confidence values', async () => {
            const confidences = [0.0, 0.5, 1.0, 0.999, 0.001];

            for (const conf of confidences) {
                const result = await repository.create({
                    patternType: 'other',
                    description: `Test confidence ${conf}`,
                    example: 'test',
                    context: 'test',
                    frequency: 1,
                    confidence: conf,
                    relatedPrompts: [],
                });

                expect(result.confidence).toBe(conf);
            }
        });

        it('should handle large frequency values', async () => {
            const result = await repository.create({
                patternType: 'other',
                description: 'Test',
                example: 'test',
                context: 'test',
                frequency: 999999,
                confidence: 0.5,
                relatedPrompts: [],
            });

            expect(result.frequency).toBe(999999);

            await repository.updateFrequency(result.id);
            const updated = await repository.findById(result.id);
            expect(updated?.frequency).toBe(1000000);
        });
    });

    // ============================================
    // INTEGRATION TESTS
    // ============================================

    describe('Integration', () => {
        it('should create and find pattern', async () => {
            const created = await repository.create({
                patternType: 'code-structure',
                description: 'Test pattern',
                example: 'test',
                context: 'test',
                frequency: 1,
                confidence: 0.8,
                relatedPrompts: [],
            });

            const found = await repository.findById(created.id);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.description).toBe('Test pattern');
        });

        it('should support pattern learning workflow', async () => {
            // Create initial pattern
            const pattern = await repository.create({
                patternType: 'code-structure',
                description: 'Common pattern',
                example: 'test',
                context: 'test',
                frequency: 1,
                confidence: 0.5,
                relatedPrompts: [],
            });

            // Update frequency multiple times (simulating pattern reinforcement)
            await repository.updateFrequency(pattern.id);
            await repository.updateFrequency(pattern.id);
            await repository.updateFrequency(pattern.id);

            // Find top patterns should include this
            const topPatterns = await repository.findTopPatterns({ limit: 10 });

            const found = topPatterns.find(p => p.id === pattern.id);
            expect(found).toBeDefined();
            expect(found?.frequency).toBe(4);
        });

        it('should support confidence-based filtering', async () => {
            // Create patterns with different confidence levels
            await repository.create({
                patternType: 'other',
                description: 'High confidence',
                example: 'test',
                context: 'test',
                frequency: 10,
                confidence: 0.95,
                relatedPrompts: [],
            });

            await repository.create({
                patternType: 'other',
                description: 'Low confidence',
                example: 'test',
                context: 'test',
                frequency: 10,
                confidence: 0.6,
                relatedPrompts: [],
            });

            const highConfidence = await repository.findByConfidence(0.9);
            const allPatterns = await repository.findTopPatterns();

            expect(highConfidence.length).toBeLessThan(allPatterns.length);
            expect(highConfidence.every(p => p.confidence >= 0.9)).toBe(true);
        });
    });
});
