/**
 * Unit Tests: GenerationIterationRepository
 * Tests for generation_iterations repository operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GenerationIterationRepository } from '../generation-iteration.repository.js';
import { MockDatabase } from './mock-database.js';

describe('GenerationIterationRepository', () => {
    let repository: GenerationIterationRepository;
    let mockDb: MockDatabase;

    // ============================================
    // TEST FIXTURES
    // ============================================

    const mockIterationRow = {
        id: 'iter_001',
        task_id: 'task_001',
        project_id: 'proj_001',
        user_id: 'user_001',
        prompt: 'Create a REST API endpoint',
        generated_code: JSON.stringify([{ path: 'handler.ts', content: 'export async function handler() { return { status: 200 }; }', language: 'typescript' }]),
        config: JSON.stringify({ model: 'gpt-4', temperature: 0.7 }),
        success: true,
        errors: JSON.stringify([]),
        feedback: JSON.stringify({ rating: 5, issues: [] }),
        test_results: JSON.stringify({ passed: 5, failed: 0, skipped: 0 }),
        metrics: JSON.stringify({ duration: 1200, tokensUsed: 500 }),
        created_at: '2024-01-15T10:00:00Z',
    };

    beforeEach(() => {
        mockDb = new MockDatabase();
        repository = new GenerationIterationRepository(mockDb);
    });

    // ============================================
    // CREATE
    // ============================================

    describe('create', () => {
        it('should create a new generation iteration', async () => {
            const input = {
                taskId: 'task_001',
                projectId: 'proj_001',
                userId: 'user_001',
                prompt: 'Create a REST API endpoint',
                generatedCode: [{ path: 'handler.ts', content: 'export function handler() { return { status: 200 }; }', language: 'typescript' }],
                config: { model: 'gpt-4', temperature: 0.7 },
                success: true,
                errors: [],
                feedback: { rating: 5 as const, comments: 'good' },
                testResults: { passed: 5, failed: 0, skipped: 0 },
                metrics: { duration: 1200, tokensUsed: 500 },
            };

            const result = await repository.create(input);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^iter_\d+_\w+$/);
            expect(result.taskId).toBe(input.taskId);
            expect(result.projectId).toBe(input.projectId);
            expect(result.prompt).toBe(input.prompt);
            expect(result.success).toBe(true);
            expect(result.createdAt).toBeInstanceOf(Date);
        });

        it('should generate unique IDs for each iteration', async () => {
            const input = {
                taskId: 'task_001',
                projectId: 'proj_001',
                userId: 'user_001',
                prompt: 'Test prompt',
                generatedCode: [{ path: 'code.ts', content: 'code', language: 'typescript' }],
                config: {},
                success: true,
                errors: [],
                metrics: { duration: 100, tokensUsed: 10 },
            };

            const result1 = await repository.create(input);
            const result2 = await repository.create(input);

            expect(result1.id).not.toBe(result2.id);
        });

        it('should handle errors during creation', async () => {
            const badDb = new MockDatabase();
            badDb.query = () => { throw new Error('Database connection failed'); };
            const badRepo = new GenerationIterationRepository(badDb);

            await expect(badRepo.create({
                taskId: 'task_001',
                projectId: 'proj_001',
                userId: 'user_001',
                prompt: 'Test',
                generatedCode: [{ path: 'code.ts', content: 'code', language: 'typescript' }],
                config: {},
                success: true,
                errors: [],
                metrics: { duration: 100, tokensUsed: 10 },
            })).rejects.toThrow('RepositoryError');
        });
    });

    // ============================================
    // FIND BY ID
    // ============================================

    describe('findById', () => {
        it('should find iteration by ID', async () => {
            mockDb.seed('generation_iterations', [mockIterationRow]);

            const result = await repository.findById('iter_001');

            expect(result).toBeDefined();
            expect(result?.id).toBe('iter_001');
            expect(result?.taskId).toBe('task_001');
            expect(result?.prompt).toBe('Create a REST API endpoint');
        });

        it('should return null if iteration not found', async () => {
            const result = await repository.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should parse JSON fields correctly', async () => {
            mockDb.seed('generation_iterations', [mockIterationRow]);

            const result = await repository.findById('iter_001');

            expect(result?.config).toEqual({ model: 'gpt-4', temperature: 0.7 });
            expect(result?.feedback).toEqual({ quality: 'good', issues: [] });
            expect(result?.testResults).toEqual({ passed: 5, total: 5 });
            expect(result?.metrics).toEqual({ latency: 1200, tokens: 500 });
            expect(result?.errors).toEqual([]);
        });
    });

    // ============================================
    // FIND BY TASK ID
    // ============================================

    describe('findByTaskId', () => {
        it('should find all iterations for a task', async () => {
            mockDb.seed('generation_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'iter_002', task_id: 'task_001' },
                { ...mockIterationRow, id: 'iter_003', task_id: 'task_002' },
            ]);

            const results = await repository.findByTaskId('task_001');

            expect(results).toHaveLength(2);
            expect(results.every(r => r.taskId === 'task_001')).toBe(true);
        });

        it('should return empty array if no iterations found', async () => {
            const results = await repository.findByTaskId('nonexistent');

            expect(results).toEqual([]);
        });

        it('should order iterations by created_at DESC', async () => {
            mockDb.seed('generation_iterations', [
                { ...mockIterationRow, id: 'iter_001', created_at: '2024-01-15T10:00:00Z' },
                { ...mockIterationRow, id: 'iter_002', created_at: '2024-01-15T11:00:00Z' },
                { ...mockIterationRow, id: 'iter_003', created_at: '2024-01-15T09:00:00Z' },
            ]);

            const results = await repository.findByTaskId('task_001');

            expect(results[0].id).toBe('iter_002'); // Most recent
            expect(results[1].id).toBe('iter_001');
            expect(results[2].id).toBe('iter_003');
        });
    });

    // ============================================
    // FIND BY PROJECT ID
    // ============================================

    describe('findByProjectId', () => {
        beforeEach(() => {
            mockDb.seed('generation_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'iter_002', project_id: 'proj_001' },
                { ...mockIterationRow, id: 'iter_003', project_id: 'proj_002' },
            ]);
        });

        it('should find all iterations for a project', async () => {
            const results = await repository.findByProjectId('proj_001');

            expect(results).toHaveLength(2);
            expect(results.every(r => r.projectId === 'proj_001')).toBe(true);
        });

        it('should support pagination with limit', async () => {
            const results = await repository.findByProjectId('proj_001', { limit: 1 });

            expect(results).toHaveLength(1);
        });

        it('should support pagination with offset', async () => {
            const results = await repository.findByProjectId('proj_001', { offset: 1 });

            expect(results).toHaveLength(1);
        });

        it('should support combined limit and offset', async () => {
            const results = await repository.findByProjectId('proj_001', { limit: 1, offset: 1 });

            expect(results).toHaveLength(1);
        });

        it('should return empty array for non-existent project', async () => {
            const results = await repository.findByProjectId('nonexistent');

            expect(results).toEqual([]);
        });
    });

    // ============================================
    // FIND BY SUCCESS
    // ============================================

    describe('findBySuccess', () => {
        beforeEach(() => {
            mockDb.seed('generation_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'iter_002', success: true },
                { ...mockIterationRow, id: 'iter_003', success: false },
                { ...mockIterationRow, id: 'iter_004', success: false },
            ]);
        });

        it('should find successful iterations', async () => {
            const results = await repository.findBySuccess(true);

            expect(results).toHaveLength(2);
            expect(results.every(r => r.success === true)).toBe(true);
        });

        it('should find failed iterations', async () => {
            const results = await repository.findBySuccess(false);

            expect(results).toHaveLength(2);
            expect(results.every(r => r.success === false)).toBe(true);
        });

        it('should limit results by default', async () => {
            // Seed more than 50 iterations
            const manyIterations = Array.from({ length: 60 }, (_, i) => ({
                ...mockIterationRow,
                id: `iter_${i}`,
                success: true,
            }));

            mockDb.clearAll();
            mockDb.seed('generation_iterations', manyIterations);

            const results = await repository.findBySuccess(true);

            expect(results.length).toBeLessThanOrEqual(50);
        });

        it('should respect custom limit', async () => {
            const results = await repository.findBySuccess(true, { limit: 1 });

            expect(results).toHaveLength(1);
        });
    });

    // ============================================
    // FIND RECENT
    // ============================================

    describe('findRecent', () => {
        beforeEach(() => {
            mockDb.seed('generation_iterations', [
                { ...mockIterationRow, id: 'iter_001', created_at: '2024-01-15T10:00:00Z' },
                { ...mockIterationRow, id: 'iter_002', created_at: '2024-01-15T11:00:00Z' },
                { ...mockIterationRow, id: 'iter_003', created_at: '2024-01-15T09:00:00Z' },
            ]);
        });

        it('should return iterations ordered by created_at DESC', async () => {
            const results = await repository.findRecent();

            expect(results[0].id).toBe('iter_002');
            expect(results[1].id).toBe('iter_001');
            expect(results[2].id).toBe('iter_003');
        });

        it('should support limit parameter', async () => {
            const results = await repository.findRecent({ limit: 2 });

            expect(results).toHaveLength(2);
        });

        it('should support offset parameter', async () => {
            const results = await repository.findRecent({ offset: 1 });

            expect(results).toHaveLength(2);
            expect(results[0].id).toBe('iter_001');
        });

        it('should return empty array when no iterations exist', async () => {
            mockDb.clearAll();

            const results = await repository.findRecent();

            expect(results).toEqual([]);
        });
    });

    // ============================================
    // SEARCH BY PROMPT
    // ============================================

    describe('searchByPrompt', () => {
        beforeEach(() => {
            mockDb.seed('generation_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'iter_002', prompt: 'Create a user authentication system' },
                { ...mockIterationRow, id: 'iter_003', prompt: 'Add unit tests for API' },
                { ...mockIterationRow, id: 'iter_004', prompt: 'Build a REST API', project_id: 'proj_002' },
            ]);
        });

        it('should search iterations by prompt content (case insensitive)', async () => {
            const results = await repository.searchByPrompt('API');

            expect(results.length).toBeGreaterThanOrEqual(2);
            expect(results.every(r => r.prompt.toLowerCase().includes('api'))).toBe(true);
        });

        it('should limit results by default', async () => {
            const results = await repository.searchByPrompt('API');

            expect(results.length).toBeLessThanOrEqual(20);
        });

        it('should respect custom limit', async () => {
            const results = await repository.searchByPrompt('API', { limit: 1 });

            expect(results).toHaveLength(1);
        });

        it('should filter by project ID when provided', async () => {
            const results = await repository.searchByPrompt('API', { projectId: 'proj_001' });

            expect(results.length).toBeGreaterThanOrEqual(1);
            expect(results.every(r => r.projectId === 'proj_001')).toBe(true);
        });

        it('should return empty array for non-matching query', async () => {
            const results = await repository.searchByPrompt('nonexistent');

            expect(results).toEqual([]);
        });

        it('should handle partial matches', async () => {
            const results = await repository.searchByPrompt('REST');

            expect(results.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ============================================
    // UPDATE
    // ============================================

    describe('update', () => {
        beforeEach(() => {
            mockDb.seed('generation_iterations', [mockIterationRow]);
        });

        it('should update iteration fields', async () => {
            await repository.update('iter_001', {
                success: false,
                errors: ['Syntax error'],
            });

            const result = await repository.findById('iter_001');
            expect(result?.success).toBe(false);
            expect(result?.errors).toEqual(['Syntax error']);
        });

        it('should update JSON fields correctly', async () => {
            const newFeedback = { rating: 5 as const, comments: 'excellent', issues: [] };
            const newMetrics = { duration: 800, tokensUsed: 300 };

            await repository.update('iter_001', {
                feedback: newFeedback,
                metrics: newMetrics,
            });

            const result = await repository.findById('iter_001');
            expect(result?.feedback).toEqual(newFeedback);
            expect(result?.metrics).toEqual(newMetrics);
        });

        it('should not update id or createdAt fields', async () => {
            await repository.update('iter_001', {
                success: false,
            });

            const result = await repository.findById('iter_001');
            expect(result?.id).toBe('iter_001');
        });

        it('should handle empty updates gracefully', async () => {
            await expect(repository.update('iter_001', {})).resolves.not.toThrow();
        });

        it('should handle multiple field updates', async () => {
            await repository.update('iter_001', {
                success: false,
                generatedCode: [{ path: 'updated.ts', content: 'updated code', language: 'typescript' }],
                config: { model: 'gpt-3.5-turbo' },
            });

            const result = await repository.findById('iter_001');
            expect(result?.success).toBe(false);
            expect(result?.generatedCode).toEqual([{ path: 'updated.ts', content: 'updated code', language: 'typescript' }]);
            expect(result?.config).toEqual({ model: 'gpt-3.5-turbo' });
        });
    });

    // ============================================
    // UPDATE FEEDBACK
    // ============================================

    describe('updateFeedback', () => {
        beforeEach(() => {
            mockDb.seed('generation_iterations', [mockIterationRow]);
        });

        it('should update feedback field', async () => {
            const newFeedback = {
                rating: 5 as const,
                comments: 'excellent',
                issues: [],
            };

            await repository.updateFeedback('iter_001', newFeedback);

            const result = await repository.findById('iter_001');
            expect(result?.feedback).toEqual(newFeedback);
        });

        it('should handle undefined feedback', async () => {
            await repository.updateFeedback('iter_001', undefined);

            const result = await repository.findById('iter_001');
            expect(result?.feedback).toBeUndefined();
        });
    });

    // ============================================
    // COUNT
    // ============================================

    describe('count', () => {
        it('should return total count of iterations', async () => {
            mockDb.seed('generation_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'iter_002' },
                { ...mockIterationRow, id: 'iter_003' },
            ]);

            const count = await repository.count();

            expect(count).toBe(3);
        });

        it('should return 0 when no iterations exist', async () => {
            const count = await repository.count();

            expect(count).toBe(0);
        });
    });

    // ============================================
    // COUNT BY PROJECT
    // ============================================

    describe('countByProject', () => {
        beforeEach(() => {
            mockDb.seed('generation_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'iter_002', project_id: 'proj_001' },
                { ...mockIterationRow, id: 'iter_003', project_id: 'proj_002' },
                { ...mockIterationRow, id: 'iter_004', project_id: 'proj_002' },
            ]);
        });

        it('should count iterations for a specific project', async () => {
            const count = await repository.countByProject('proj_001');

            expect(count).toBe(2);
        });

        it('should return 0 for non-existent project', async () => {
            const count = await repository.countByProject('nonexistent');

            expect(count).toBe(0);
        });

        it('should count correctly for project with multiple iterations', async () => {
            const count = await repository.countByProject('proj_002');

            expect(count).toBe(2);
        });
    });

    // ============================================
    // EDGE CASES
    // ============================================

    describe('Edge Cases', () => {
        it('should handle special characters in prompt', async () => {
            mockDb.seed('generation_iterations', [{
                ...mockIterationRow,
                prompt: 'Create API with "quotes" and \'apostrophes\'',
            }]);

            const results = await repository.searchByPrompt('quotes');

            expect(results).toHaveLength(1);
            expect(results[0].prompt).toContain('quotes');
        });

        it('should handle very long prompts', async () => {
            const longPrompt = 'a'.repeat(10000);

            await repository.create({
                taskId: 'task_001',
                projectId: 'proj_001',
                userId: 'user_001',
                prompt: longPrompt,
                generatedCode: [{ path: 'code.ts', content: 'code', language: 'typescript' }],
                config: {},
                success: true,
                errors: [],
                metrics: { duration: 100, tokensUsed: 10 },
            });

            const results = await repository.searchByPrompt('a');
            expect(results).toHaveLength(1);
        });

        it('should handle complex config objects', async () => {
            const complexConfig = {
                model: 'gpt-4',
                temperature: 0.7,
                maxTokens: 2000,
                topP: 0.9,
                frequencyPenalty: 0.5,
                presencePenalty: 0.5,
                stop: ['\n', 'END'],
                nested: {
                    deep: {
                        value: 123,
                    },
                },
            };

            await repository.create({
                taskId: 'task_001',
                projectId: 'proj_001',
                userId: 'user_001',
                prompt: 'Test',
                generatedCode: [{ path: 'code.ts', content: 'code', language: 'typescript' }],
                config: complexConfig,
                success: true,
                errors: [],
                metrics: { duration: 100, tokensUsed: 10 },
            });

            const results = await repository.findByProjectId('proj_001');
            expect(results[0].config).toEqual(complexConfig);
        });

        it('should handle null optional fields', async () => {
            mockDb.seed('generation_iterations', [{
                ...mockIterationRow,
                feedback: null,
                test_results: null,
                metrics: null,
                errors: null,
            }]);

            const result = await repository.findById('iter_001');
            expect(result?.feedback).toBeNull();
            expect(result?.testResults).toBeNull();
            expect(result?.metrics).toBeNull();
            expect(result?.errors).toBeNull();
        });
    });
});
