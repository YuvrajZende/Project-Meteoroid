/**
 * Unit Tests: ProjectContextRepository
 * Tests for project_contexts repository operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectContextRepository } from '../project-context.repository.js';
import { MockDatabase } from './mock-database.js';
import type { PersistentContext } from '../../interfaces/context.interface.js';

describe('ProjectContextRepository', () => {
    let repository: ProjectContextRepository;
    let mockDb: MockDatabase;

    // ============================================
    // TEST FIXTURES
    // ============================================

    const mockContextEntity: PersistentContext = {
        userId: 'user_001',
        projectId: 'proj_001',
        preferences: {
            theme: 'dark',
            language: 'typescript',
            autoSave: true,
        },
        recentProjects: ['proj_001', 'proj_002'],
        recentPrompts: [
            'Create API endpoint',
            'Add authentication',
            'Write tests',
        ],
        techStackHistory: ['typescript', 'fastify', 'vitest'],
        lastActive: new Date('2024-01-15T10:00:00Z'),
    };

    const mockContextRow = {
        user_id: 'user_001',
        project_id: 'proj_001',
        preferences: JSON.stringify({
            theme: 'dark',
            language: 'typescript',
            autoSave: true,
        }),
        recent_projects: JSON.stringify(['proj_001', 'proj_002']),
        recent_prompts: JSON.stringify(['Create API endpoint', 'Add authentication', 'Write tests']),
        tech_stack_history: JSON.stringify(['typescript', 'fastify', 'vitest']),
        last_active: '2024-01-15T10:00:00Z',
    };

    beforeEach(() => {
        mockDb = new MockDatabase();
        repository = new ProjectContextRepository(mockDb);
    });

    // ============================================
    // SAVE
    // ============================================

    describe('save', () => {
        it('should create new context if it does not exist', async () => {
            await repository.save(mockContextEntity);

            const result = await repository.get('user_001', 'proj_001');

            expect(result).toBeDefined();
            expect(result?.userId).toBe('user_001');
            expect(result?.projectId).toBe('proj_001');
            expect(result?.preferences).toEqual({ theme: 'dark', language: 'typescript', autoSave: true });
        });

        it('should update existing context', async () => {
            mockDb.seed('project_contexts', [mockContextRow]);

            const updatedContext = {
                ...mockContextEntity,
                preferences: { theme: 'light', language: 'javascript', autoSave: false },
            };

            await repository.save(updatedContext);

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual({ theme: 'light', language: 'javascript', autoSave: false });
        });

        it('should handle null lastActive by setting to now', async () => {
            const contextWithoutLastActive = {
                ...mockContextEntity,
                lastActive: undefined as unknown as Date,
            };

            await repository.save(contextWithoutLastActive);

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.lastActive).toBeInstanceOf(Date);
        });

        it('should preserve lastActive if provided', async () => {
            const specificDate = new Date('2024-01-01T12:00:00Z');

            await repository.save({
                ...mockContextEntity,
                lastActive: specificDate,
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.lastActive.toISOString()).toBe(specificDate.toISOString());
        });

        it('should handle empty optional fields', async () => {
            const minimalContext: PersistentContext = {
                userId: 'user_001',
                projectId: 'proj_001',
                preferences: {},
                recentProjects: [],
                recentPrompts: [],
                techStackHistory: [],
                lastActive: new Date(),
            };

            await repository.save(minimalContext);

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual({});
            expect(result?.recentProjects).toEqual([]);
            expect(result?.recentPrompts).toEqual([]);
            expect(result?.techStackHistory).toEqual([]);
        });

        it('should handle errors during save', async () => {
            const badDb = new MockDatabase();
            badDb.query = () => { throw new Error('Database connection failed'); };
            const badRepo = new ProjectContextRepository(badDb);

            await expect(badRepo.save(mockContextEntity)).rejects.toThrow('RepositoryError');
        });
    });

    // ============================================
    // GET
    // ============================================

    describe('get', () => {
        it('should find context by userId and projectId', async () => {
            mockDb.seed('project_contexts', [mockContextRow]);

            const result = await repository.get('user_001', 'proj_001');

            expect(result).toBeDefined();
            expect(result?.userId).toBe('user_001');
            expect(result?.projectId).toBe('proj_001');
            expect(result?.preferences).toEqual({ theme: 'dark', language: 'typescript', autoSave: true });
            expect(result?.recentProjects).toEqual(['proj_001', 'proj_002']);
            expect(result?.recentPrompts).toEqual(['Create API endpoint', 'Add authentication', 'Write tests']);
            expect(result?.techStackHistory).toEqual(['typescript', 'fastify', 'vitest']);
        });

        it('should return null if context not found', async () => {
            const result = await repository.get('nonexistent', 'nonexistent');

            expect(result).toBeNull();
        });

        it('should parse JSON fields correctly', async () => {
            mockDb.seed('project_contexts', [mockContextRow]);

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toBeInstanceOf(Object);
            expect(Array.isArray(result?.recentProjects)).toBe(true);
            expect(Array.isArray(result?.recentPrompts)).toBe(true);
            expect(Array.isArray(result?.techStackHistory)).toBe(true);
        });

        it('should handle null JSON fields', async () => {
            mockDb.seed('project_contexts', [{
                ...mockContextRow,
                preferences: null,
                recent_projects: null,
                recent_prompts: null,
                tech_stack_history: null,
            }]);

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual({});
            expect(result?.recentProjects).toEqual([]);
            expect(result?.recentPrompts).toEqual([]);
            expect(result?.techStackHistory).toEqual([]);
        });

        it('should convert lastActive to Date', async () => {
            mockDb.seed('project_contexts', [mockContextRow]);

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.lastActive).toBeInstanceOf(Date);
            expect(result?.lastActive.toISOString()).toBe('2024-01-15T10:00:00.000Z');
        });
    });

    // ============================================
    // UPDATE
    // ============================================

    describe('update', () => {
        beforeEach(() => {
            mockDb.seed('project_contexts', [mockContextRow]);
        });

        it('should update single field', async () => {
            await repository.update('user_001', 'proj_001', {
                preferences: { theme: 'light' },
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual({ theme: 'light' });
        });

        it('should update multiple fields', async () => {
            await repository.update('user_001', 'proj_001', {
                preferences: { theme: 'light' },
                recentPrompts: ['New prompt'],
                lastActive: new Date('2024-01-20T10:00:00Z'),
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual({ theme: 'light' });
            expect(result?.recentPrompts).toEqual(['New prompt']);
        });

        it('should update JSON fields correctly', async () => {
            const newPreferences = { theme: 'light', language: 'python', editor: 'vscode' };

            await repository.update('user_001', 'proj_001', {
                preferences: newPreferences,
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual(newPreferences);
        });

        it('should update lastActive automatically', async () => {
            const beforeUpdate = new Date();

            await repository.update('user_001', 'proj_001', {
                preferences: { theme: 'light' },
            });

            const afterUpdate = new Date();
            const result = await repository.get('user_001', 'proj_001');

            expect(result?.lastActive.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
            expect(result?.lastActive.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
        });

        it('should handle Date objects', async () => {
            const specificDate = new Date('2024-01-01T12:00:00Z');

            await repository.update('user_001', 'proj_001', {
                lastActive: specificDate,
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.lastActive.toISOString()).toBe(specificDate.toISOString());
        });

        it('should handle empty updates gracefully', async () => {
            await expect(repository.update('user_001', 'proj_001', {})).resolves.not.toThrow();
        });

        it('should not update userId or projectId', async () => {
            await repository.update('user_001', 'proj_001', {
                // @ts-expect-error - Testing that userId is ignored
                userId: 'new_user',
                // @ts-expect-error - Testing that projectId is ignored
                projectId: 'new_project',
                preferences: { theme: 'light' },
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.userId).toBe('user_001');
            expect(result?.projectId).toBe('proj_001');
        });
    });

    // ============================================
    // DELETE
    // ============================================

    describe('delete', () => {
        beforeEach(() => {
            mockDb.seed('project_contexts', [mockContextRow]);
        });

        it('should delete context', async () => {
            await repository.delete('user_001', 'proj_001');

            const result = await repository.get('user_001', 'proj_001');

            expect(result).toBeNull();
        });

        it('should handle non-existent context gracefully', async () => {
            await expect(repository.delete('nonexistent', 'nonexistent')).resolves.not.toThrow();
        });

        it('should delete only the specified context', async () => {
            mockDb.seed('project_contexts', [
                mockContextRow,
                { ...mockContextRow, user_id: 'user_002', project_id: 'proj_002' },
            ]);

            await repository.delete('user_001', 'proj_001');

            const deleted = await repository.get('user_001', 'proj_001');
            const other = await repository.get('user_002', 'proj_002');

            expect(deleted).toBeNull();
            expect(other).toBeDefined();
        });
    });

    // ============================================
    // UPDATE LAST ACTIVE
    // ============================================

    describe('updateLastActive', () => {
        beforeEach(() => {
            mockDb.seed('project_contexts', [mockContextRow]);
        });

        it('should update lastActive timestamp', async () => {
            const beforeUpdate = new Date();

            await repository.updateLastActive('user_001', 'proj_001');

            const afterUpdate = new Date();
            const result = await repository.get('user_001', 'proj_001');

            expect(result?.lastActive.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
            expect(result?.lastActive.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
        });

        it('should handle non-existent context gracefully', async () => {
            await expect(repository.updateLastActive('nonexistent', 'nonexistent')).resolves.not.toThrow();
        });

        it('should not modify other fields', async () => {
            await repository.updateLastActive('user_001', 'proj_001');

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual({ theme: 'dark', language: 'typescript', autoSave: true });
            expect(result?.recentProjects).toEqual(['proj_001', 'proj_002']);
        });
    });

    // ============================================
    // FIND BY USER ID
    // ============================================

    describe('findByUserId', () => {
        beforeEach(() => {
            mockDb.seed('project_contexts', [
                mockContextRow,
                { ...mockContextRow, project_id: 'proj_002', last_active: '2024-01-15T11:00:00Z' },
                { ...mockContextRow, project_id: 'proj_003', last_active: '2024-01-15T09:00:00Z' },
                { ...mockContextRow, user_id: 'user_002', project_id: 'proj_001' },
            ]);
        });

        it('should find all contexts for a user', async () => {
            const results = await repository.findByUserId('user_001');

            expect(results).toHaveLength(3);
            expect(results.every(r => r.userId === 'user_001')).toBe(true);
        });

        it('should return empty array for non-existent user', async () => {
            const results = await repository.findByUserId('nonexistent');

            expect(results).toEqual([]);
        });

        it('should order by last_active DESC', async () => {
            const results = await repository.findByUserId('user_001');

            expect(results[0].projectId).toBe('proj_002'); // 11:00
            expect(results[1].projectId).toBe('proj_001'); // 10:00
            expect(results[2].projectId).toBe('proj_003'); // 09:00
        });
    });

    // ============================================
    // COUNT
    // ============================================

    describe('count', () => {
        it('should return total count of contexts', async () => {
            mockDb.seed('project_contexts', [
                mockContextRow,
                { ...mockContextRow, project_id: 'proj_002' },
                { ...mockContextRow, user_id: 'user_002' },
            ]);

            const count = await repository.count();

            expect(count).toBe(3);
        });

        it('should return 0 when no contexts exist', async () => {
            const count = await repository.count();

            expect(count).toBe(0);
        });
    });

    // ============================================
    // EDGE CASES
    // ============================================

    describe('Edge Cases', () => {
        it('should handle special characters in preferences', async () => {
            const specialPrefs = {
                'key with "quotes"': 'value with \'apostrophes\'',
                'html': '<div>&nbsp;</div>',
                'unicode': 'Hello 世界 🌍',
            };

            await repository.save({
                ...mockContextEntity,
                preferences: specialPrefs,
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual(specialPrefs);
        });

        it('should handle very long arrays', async () => {
            const longArray = Array.from({ length: 1000 }, (_, i) => `item_${i}`);

            await repository.save({
                ...mockContextEntity,
                recentPrompts: longArray,
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.recentPrompts).toHaveLength(1000);
        });

        it('should handle deeply nested preferences', async () => {
            const nestedPrefs = {
                level1: {
                    level2: {
                        level3: {
                            value: 'deep',
                            array: [1, 2, 3],
                        },
                    },
                },
            };

            await repository.save({
                ...mockContextEntity,
                preferences: nestedPrefs,
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.preferences).toEqual(nestedPrefs);
        });

        it('should handle mixed types in arrays', async () => {
            const mixedArray = [
                'string',
                123,
                true,
                null,
                { key: 'value' },
                [1, 2, 3],
            ];

            await repository.save({
                ...mockContextEntity,
                recentProjects: mixedArray as unknown as string[],
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.recentProjects).toEqual(mixedArray);
        });

        it('should handle multiple users and projects', async () => {
            const users = ['user_001', 'user_002', 'user_003'];
            const projects = ['proj_001', 'proj_002'];

            for (const user of users) {
                for (const project of projects) {
                    await repository.save({
                        ...mockContextEntity,
                        userId: user,
                        projectId: project,
                    });
                }
            }

            expect(await repository.count()).toBe(6);

            const user1Contexts = await repository.findByUserId('user_001');
            expect(user1Contexts).toHaveLength(2);
        });

        it('should handle concurrent save operations', async () => {
            const saves = [
                repository.save({ ...mockContextEntity, preferences: { v: 1 } }),
                repository.save({ ...mockContextEntity, preferences: { v: 2 } }),
                repository.save({ ...mockContextEntity, preferences: { v: 3 } }),
            ];

            await Promise.all(saves);

            const result = await repository.get('user_001', 'proj_001');
            expect(result).toBeDefined();
            expect(result?.preferences).toEqual({ v: 3 }); // Last write wins
        });
    });

    // ============================================
    // INTEGRATION TESTS
    // ============================================

    describe('Integration', () => {
        it('should support full context lifecycle', async () => {
            // Create
            await repository.save(mockContextEntity);
            let result = await repository.get('user_001', 'proj_001');
            expect(result).toBeDefined();

            // Update
            await repository.update('user_001', 'proj_001', {
                preferences: { theme: 'light' },
            });
            result = await repository.get('user_001', 'proj_001');
            expect(result?.preferences.theme).toBe('light');

            // Update last active
            await repository.updateLastActive('user_001', 'proj_001');

            // Delete
            await repository.delete('user_001', 'proj_001');
            result = await repository.get('user_001', 'proj_001');
            expect(result).toBeNull();
        });

        it('should support multi-project user context', async () => {
            // Create contexts for multiple projects
            await repository.save({
                ...mockContextEntity,
                projectId: 'proj_001',
                preferences: { theme: 'dark' },
            });

            await repository.save({
                ...mockContextEntity,
                projectId: 'proj_002',
                preferences: { theme: 'light' },
            });

            const allContexts = await repository.findByUserId('user_001');
            expect(allContexts).toHaveLength(2);

            const proj1 = await repository.get('user_001', 'proj_001');
            const proj2 = await repository.get('user_001', 'proj_002');

            expect(proj1?.preferences.theme).toBe('dark');
            expect(proj2?.preferences.theme).toBe('light');
        });

        it('should support context accumulation over time', async () => {
            await repository.save({
                ...mockContextEntity,
                recentPrompts: ['prompt1'],
                techStackHistory: ['typescript'],
            });

            await repository.update('user_001', 'proj_001', {
                recentPrompts: ['prompt1', 'prompt2'],
                techStackHistory: ['typescript', 'fastify'],
            });

            await repository.update('user_001', 'proj_001', {
                recentPrompts: ['prompt1', 'prompt2', 'prompt3'],
                techStackHistory: ['typescript', 'fastify', 'vitest'],
            });

            const result = await repository.get('user_001', 'proj_001');

            expect(result?.recentPrompts).toEqual(['prompt1', 'prompt2', 'prompt3']);
            expect(result?.techStackHistory).toEqual(['typescript', 'fastify', 'vitest']);
        });
    });
});
