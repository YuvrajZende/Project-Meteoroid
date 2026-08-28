/**
 * Unit Tests: TestingIterationRepository
 * Tests for testing_iterations repository operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestingIterationRepository } from '../testing-iteration.repository.js';
import { MockDatabase } from './mock-database.js';
import type { TestingIteration } from '../../interfaces/learning.interface.js';

describe('TestingIterationRepository', () => {
    let repository: TestingIterationRepository;
    let mockDb: MockDatabase;

    // ============================================
    // TEST FIXTURES
    // ============================================

    const mockIterationEntity: TestingIteration = {
        id: 'test_001',
        projectId: 'proj_001',
        testType: 'authentication',
        testDescription: 'Test user login with valid credentials',
        userQuery: 'I want to test if users can log in',
        expectedBehavior: 'User should be authenticated and redirected to dashboard',
        actualResult: 'Login successful, redirect working',
        success: true,
        lessons: ['Login flow works correctly'],
        relatedFiles: ['src/auth/login.ts'],
        tags: ['auth', 'login', 'success'],
        createdAt: new Date('2024-01-15T10:00:00Z'),
    };

    const mockIterationRow = {
        id: 'test_001',
        project_id: 'proj_001',
        test_type: 'authentication',
        test_description: 'Test user login with valid credentials',
        user_query: 'I want to test if users can log in',
        expected_behavior: 'User should be authenticated and redirected to dashboard',
        actual_result: 'Login successful, redirect working',
        success: true,
        lessons: JSON.stringify(['Login flow works correctly']),
        related_files: JSON.stringify(['src/auth/login.ts']),
        tags: JSON.stringify(['auth', 'login', 'success']),
        created_at: '2024-01-15T10:00:00Z',
    };

    beforeEach(() => {
        mockDb = new MockDatabase();
        repository = new TestingIterationRepository(mockDb);
    });

    // ============================================
    // CREATE
    // ============================================

    describe('create', () => {
        it('should create a new testing iteration', async () => {
            const input = {
                projectId: 'proj_001',
                testType: 'authentication' as const,
                testDescription: 'Test user login',
                userQuery: 'Test login functionality',
                expectedBehavior: 'User should login',
                actualResult: 'Login successful',
                success: true,
                lessons: ['Works'],
                relatedFiles: ['src/auth.ts'],
                tags: ['auth'],
            };

            const result = await repository.create(input);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^test_\d+_\w+$/);
            expect(result.projectId).toBe(input.projectId);
            expect(result.testType).toBe('authentication');
            expect(result.success).toBe(true);
            expect(result.createdAt).toBeInstanceOf(Date);
        });

        it('should generate unique IDs for each iteration', async () => {
            const input = {
                projectId: 'proj_001',
                testType: 'authentication' as const,
                testDescription: 'Test',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: [],
                relatedFiles: [],
                tags: [],
            };

            const result1 = await repository.create(input);
            const result2 = await repository.create(input);

            expect(result1.id).not.toBe(result2.id);
        });

        it('should handle all test types', async () => {
            const testTypes: TestingIteration['testType'][] = [
                'authentication',
                'authorization',
                'data-validation',
                'error-handling',
                'performance',
                'integration',
                'ui-ux',
                'other',
            ];

            for (const testType of testTypes) {
                const result = await repository.create({
                    projectId: 'proj_001',
                    testType,
                    testDescription: `Test ${testType}`,
                    userQuery: 'Test',
                    expectedBehavior: 'Test',
                    actualResult: 'Test',
                    success: true,
                    lessons: [],
                    relatedFiles: [],
                    tags: [],
                });

                expect(result.testType).toBe(testType);
            }
        });

        it('should handle null optional fields', async () => {
            const result = await repository.create({
                projectId: 'proj_001',
                testType: 'other',
                testDescription: 'Test',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: null,
                relatedFiles: null,
                tags: null,
            });

            expect(result.lessons).toBeNull();
            expect(result.relatedFiles).toBeNull();
            expect(result.tags).toBeNull();
        });

        it('should handle errors during creation', async () => {
            const badDb = new MockDatabase();
            badDb.query = () => { throw new Error('Database connection failed'); };
            const badRepo = new TestingIterationRepository(badDb);

            await expect(badRepo.create({
                projectId: 'proj_001',
                testType: 'other',
                testDescription: 'Test',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: [],
                relatedFiles: [],
                tags: [],
            })).rejects.toThrow('failed');
        });
    });

    // ============================================
    // FIND BY ID
    // ============================================

    describe('findById', () => {
        it('should find iteration by ID', async () => {
            mockDb.seed('testing_iterations', [mockIterationRow]);

            const result = await repository.findById('test_001');

            expect(result).toBeDefined();
            expect(result?.id).toBe('test_001');
            expect(result?.projectId).toBe('proj_001');
            expect(result?.testType).toBe('authentication');
            expect(result?.testDescription).toBe('Test user login with valid credentials');
        });

        it('should return null if iteration not found', async () => {
            const result = await repository.findById('nonexistent');

            expect(result).toBeNull();
        });

        it('should parse JSON fields correctly', async () => {
            mockDb.seed('testing_iterations', [mockIterationRow]);

            const result = await repository.findById('test_001');

            expect(result?.lessons).toEqual(['Login flow works correctly']);
            expect(result?.relatedFiles).toEqual(['src/auth/login.ts']);
            expect(result?.tags).toEqual(['auth', 'login', 'success']);
        });

        it('should handle null JSON fields', async () => {
            mockDb.seed('testing_iterations', [{
                ...mockIterationRow,
                lessons: null,
                related_files: null,
                tags: null,
            }]);

            const result = await repository.findById('test_001');

            expect(result?.lessons).toBeNull();
            expect(result?.relatedFiles).toBeNull();
            expect(result?.tags).toBeNull();
        });
    });

    // ============================================
    // FIND BY PROJECT ID
    // ============================================

    describe('findByProjectId', () => {
        beforeEach(() => {
            mockDb.seed('testing_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'test_002', project_id: 'proj_001' },
                { ...mockIterationRow, id: 'test_003', project_id: 'proj_002' },
            ]);
        });

        it('should find all iterations for a project', async () => {
            const results = await repository.findByProjectId('proj_001');

            expect(results).toHaveLength(2);
            expect(results.every(r => r.projectId === 'proj_001')).toBe(true);
        });

        it('should return empty array if no iterations found', async () => {
            const results = await repository.findByProjectId('nonexistent');

            expect(results).toEqual([]);
        });

        it('should order iterations by created_at DESC', async () => {
            mockDb.seed('testing_iterations', [
                { ...mockIterationRow, id: 'test_001', created_at: '2024-01-15T10:00:00Z' },
                { ...mockIterationRow, id: 'test_002', created_at: '2024-01-15T11:00:00Z' },
                { ...mockIterationRow, id: 'test_003', created_at: '2024-01-15T09:00:00Z' },
            ]);

            const results = await repository.findByProjectId('proj_001');

            expect(results[0].id).toBe('test_002'); // Most recent
            expect(results[1].id).toBe('test_001');
            expect(results[2].id).toBe('test_003');
        });
    });

    // ============================================
    // FIND BY TEST TYPE
    // ============================================

    describe('findByTestType', () => {
        beforeEach(() => {
            mockDb.seed('testing_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'test_002', test_type: 'authentication' },
                { ...mockIterationRow, id: 'test_003', test_type: 'authorization' },
                { ...mockIterationRow, id: 'test_004', test_type: 'data-validation' },
                { ...mockIterationRow, id: 'test_005', test_type: 'authentication' },
            ]);
        });

        it('should find iterations by test type', async () => {
            const results = await repository.findByTestType('authentication');

            expect(results).toHaveLength(3);
            expect(results.every(r => r.testType === 'authentication')).toBe(true);
        });

        it('should return empty array for non-existent test type', async () => {
            const results = await repository.findByTestType('performance');

            expect(results).toEqual([]);
        });

        it('should order by created_at DESC', async () => {
            mockDb.seed('testing_iterations', [
                { ...mockIterationRow, id: 'test_001', test_type: 'authentication', created_at: '2024-01-15T10:00:00Z' },
                { ...mockIterationRow, id: 'test_002', test_type: 'authentication', created_at: '2024-01-15T11:00:00Z' },
            ]);

            const results = await repository.findByTestType('authentication');

            expect(results[0].id).toBe('test_002');
            expect(results[1].id).toBe('test_001');
        });

        it('should handle all test types', async () => {
            const testTypes: TestingIteration['testType'][] = [
                'authentication',
                'authorization',
                'data-validation',
                'error-handling',
                'performance',
                'integration',
                'ui-ux',
                'other',
            ];

            for (const testType of testTypes) {
                mockDb.clearAll();
                mockDb.seed('testing_iterations', [{
                    ...mockIterationRow,
                    id: `test_${testType}`,
                    test_type: testType,
                }]);

                const results = await repository.findByTestType(testType);
                expect(results).toHaveLength(1);
                expect(results[0].testType).toBe(testType);
            }
        });
    });

    // ============================================
    // FIND RECENT
    // ============================================

    describe('findRecent', () => {
        beforeEach(() => {
            mockDb.seed('testing_iterations', [
                { ...mockIterationRow, id: 'test_001', created_at: '2024-01-15T10:00:00Z' },
                { ...mockIterationRow, id: 'test_002', created_at: '2024-01-15T11:00:00Z' },
                { ...mockIterationRow, id: 'test_003', created_at: '2024-01-15T09:00:00Z' },
            ]);
        });

        it('should return iterations ordered by created_at DESC', async () => {
            const results = await repository.findRecent();

            expect(results[0].id).toBe('test_002');
            expect(results[1].id).toBe('test_001');
            expect(results[2].id).toBe('test_003');
        });

        it('should limit results by default', async () => {
            // Seed more than 50 iterations
            const manyIterations = Array.from({ length: 60 }, (_, i) => ({
                ...mockIterationRow,
                id: `test_${i}`,
                created_at: `2024-01-15T${String(i).padStart(2, '0')}:00:00Z`,
            }));

            mockDb.clearAll();
            mockDb.seed('testing_iterations', manyIterations);

            const results = await repository.findRecent();

            expect(results.length).toBeLessThanOrEqual(50);
        });

        it('should respect custom limit', async () => {
            const results = await repository.findRecent({ limit: 2 });

            expect(results).toHaveLength(2);
            expect(results[0].id).toBe('test_002');
            expect(results[1].id).toBe('test_001');
        });

        it('should return empty array when no iterations exist', async () => {
            mockDb.clearAll();

            const results = await repository.findRecent();

            expect(results).toEqual([]);
        });
    });

    // ============================================
    // COUNT
    // ============================================

    describe('count', () => {
        it('should return total count of iterations', async () => {
            mockDb.seed('testing_iterations', [
                mockIterationRow,
                { ...mockIterationRow, id: 'test_002' },
                { ...mockIterationRow, id: 'test_003' },
                { ...mockIterationRow, id: 'test_004' },
            ]);

            const count = await repository.count();

            expect(count).toBe(4);
        });

        it('should return 0 when no iterations exist', async () => {
            const count = await repository.count();

            expect(count).toBe(0);
        });
    });

    // ============================================
    // EDGE CASES
    // ============================================

    describe('Edge Cases', () => {
        it('should handle special characters in fields', async () => {
            const specialData = {
                projectId: 'proj_001',
                testType: 'other' as const,
                testDescription: 'Test with "quotes" and \'apostrophes\'',
                userQuery: 'Query with <html> & special chars: @#$%',
                expectedBehavior: 'Expected with unicode: \u2713',
                actualResult: 'Actual result',
                success: true,
                lessons: ['Lesson with "quotes"'],
                relatedFiles: ['path/to/file.ts'],
                tags: ['tag-with-dash', 'tag_with_underscore'],
            };

            const result = await repository.create(specialData);

            expect(result.testDescription).toContain('quotes');
            expect(result.userQuery).toContain('<html>');
            expect(result.lessons).toEqual(['Lesson with "quotes"']);
            expect(result.tags).toEqual(['tag-with-dash', 'tag_with_underscore']);
        });

        it('should handle very long strings', async () => {
            const longString = 'a'.repeat(10000);

            const result = await repository.create({
                projectId: 'proj_001',
                testType: 'other',
                testDescription: longString,
                userQuery: longString,
                expectedBehavior: longString,
                actualResult: longString,
                success: true,
                lessons: [longString],
                relatedFiles: [longString],
                tags: [longString],
            });

            expect(result.testDescription).toHaveLength(10000);
        });

        it('should handle empty arrays for optional fields', async () => {
            const result = await repository.create({
                projectId: 'proj_001',
                testType: 'other',
                testDescription: 'Test',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: [],
                relatedFiles: [],
                tags: [],
            });

            expect(result.lessons).toEqual([]);
            expect(result.relatedFiles).toEqual([]);
            expect(result.tags).toEqual([]);
        });

        it('should handle arrays with many items', async () => {
            const manyItems = Array.from({ length: 100 }, (_, i) => `item_${i}`);

            const result = await repository.create({
                projectId: 'proj_001',
                testType: 'other',
                testDescription: 'Test',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: manyItems,
                relatedFiles: manyItems,
                tags: manyItems,
            });

            expect(result.lessons).toHaveLength(100);
            expect(result.relatedFiles).toHaveLength(100);
            expect(result.tags).toHaveLength(100);
        });

        it('should handle mixed success values', async () => {
            mockDb.seed('testing_iterations', [
                { ...mockIterationRow, id: 'test_001', success: true },
                { ...mockIterationRow, id: 'test_002', success: false },
                { ...mockIterationRow, id: 'test_003', success: true },
                { ...mockIterationRow, id: 'test_004', success: false },
                { ...mockIterationRow, id: 'test_005', success: true },
            ]);

            const results = await repository.findByProjectId('proj_001');
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            expect(successCount).toBe(3);
            expect(failCount).toBe(2);
        });

        it('should handle different date formats', async () => {
            const dates = [
                '2024-01-15T10:00:00Z',
                '2024-12-31T23:59:59Z',
                '2024-02-29T12:00:00Z', // Leap year
            ];

            for (const date of dates) {
                mockDb.seed('testing_iterations', [{
                    ...mockIterationRow,
                    id: `test_${date}`,
                    created_at: date,
                }]);

                const result = await repository.findById(`test_${date}`);
                expect(result?.createdAt.toISOString()).toBe(new Date(date).toISOString());
            }
        });
    });

    // ============================================
    // INTEGRATION TESTS
    // ============================================

    describe('Integration', () => {
        it('should create and find iteration', async () => {
            const created = await repository.create({
                projectId: 'proj_001',
                testType: 'authentication',
                testDescription: 'Test login',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: [],
                relatedFiles: [],
                tags: [],
            });

            const found = await repository.findById(created.id);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.testDescription).toBe('Test login');
        });

        it('should support multiple projects', async () => {
            await repository.create({
                projectId: 'proj_001',
                testType: 'authentication',
                testDescription: 'Test for proj 1',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: [],
                relatedFiles: [],
                tags: [],
            });

            await repository.create({
                projectId: 'proj_002',
                testType: 'authentication',
                testDescription: 'Test for proj 2',
                userQuery: 'Test',
                expectedBehavior: 'Test',
                actualResult: 'Test',
                success: true,
                lessons: [],
                relatedFiles: [],
                tags: [],
            });

            const proj1Results = await repository.findByProjectId('proj_001');
            const proj2Results = await repository.findByProjectId('proj_002');

            expect(proj1Results).toHaveLength(1);
            expect(proj2Results).toHaveLength(1);
            expect(proj1Results[0].testDescription).toBe('Test for proj 1');
            expect(proj2Results[0].testDescription).toBe('Test for proj 2');
        });
    });
});
