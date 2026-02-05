/**
 * TaskRepository Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskRepository } from '../task.repository.js';
import { MockDatabase } from './mock-database.js';
import { mockTask, mockTaskRow, generateMockTasks } from './fixtures.js';
import { RepositoryError } from '../base.repository.js';
import type { IDatabase } from '../../interfaces/database.interface.js';

describe('TaskRepository', () => {
    let repository: TaskRepository;
    let mockDatabase: MockDatabase;

    beforeEach(() => {
        mockDatabase = new MockDatabase();
        repository = new TaskRepository(mockDatabase as unknown as IDatabase);
        mockDatabase.clearAll();
    });

    describe('create', () => {
        it('should create a new task', async () => {
            const newTask = {
                projectId: 'proj_123',
                userId: 'user_123',
                type: 'generation' as const,
                status: 'pending' as const,
                prompt: 'Generate auth system',
                config: { model: 'gpt-4' },
                result: undefined,
                errors: [],
            };

            const result = await repository.create(newTask);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^task_/);
            expect(result.prompt).toBe('Generate auth system');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should throw RepositoryError on database error', async () => {
            mockDatabase.throwError(new Error('Database error'));

            const newTask = {
                projectId: 'proj_123',
                userId: 'user_123',
                type: 'generation' as const,
                status: 'pending' as const,
                prompt: 'Test',
                config: {},
                result: undefined,
                errors: [],
            };

            await expect(repository.create(newTask)).rejects.toThrow(RepositoryError);
        });
    });

    describe('findById', () => {
        it('should find task by id', async () => {
            mockDatabase.seed('tasks', [mockTaskRow]);

            const result = await repository.findById('task_test_123');

            expect(result).toBeDefined();
            expect(result?.id).toBe('task_test_123');
            expect(result?.prompt).toBe('Generate a user authentication system');
        });

        it('should return null for non-existent task', async () => {
            const result = await repository.findById('non_existent');

            expect(result).toBeNull();
        });
    });

    describe('findByProject', () => {
        it('should find all tasks for a project', async () => {
            const tasks = generateMockTasks(5, 'proj_123');
            const taskRows = tasks.map(t => ({
                id: t.id,
                project_id: t.projectId,
                user_id: t.userId,
                type: t.type,
                status: t.status,
                prompt: t.prompt,
                config: JSON.stringify(t.config),
                result: JSON.stringify(t.result),
                errors: JSON.stringify(t.errors),
                started_at: t.startedAt?.toISOString(),
                completed_at: t.completedAt?.toISOString(),
                created_at: t.createdAt.toISOString(),
                updated_at: t.updatedAt.toISOString(),
            }));

            mockDatabase.seed('tasks', taskRows);

            const results = await repository.findByProject('proj_123');

            expect(results).toHaveLength(5);
            expect(results[0].projectId).toBe('proj_123');
        });
    });

    describe('findByUser', () => {
        it('should find all tasks for a user', async () => {
            const tasks = generateMockTasks(3, 'proj_123');
            const taskRows = tasks.map(t => ({
                id: t.id,
                project_id: t.projectId,
                user_id: 'user_123',
                type: t.type,
                status: t.status,
                prompt: t.prompt,
                config: JSON.stringify(t.config),
                result: JSON.stringify(t.result),
                errors: JSON.stringify(t.errors),
                started_at: t.startedAt?.toISOString(),
                completed_at: t.completedAt?.toISOString(),
                created_at: t.createdAt.toISOString(),
                updated_at: t.updatedAt.toISOString(),
            }));

            mockDatabase.seed('tasks', taskRows);

            const results = await repository.findByUser('user_123');

            expect(results).toHaveLength(3);
            expect(results[0].userId).toBe('user_123');
        });
    });

    describe('findRunning', () => {
        it('should find running tasks', async () => {
            const tasks = generateMockTasks(5);
            const taskRows = tasks.map(t => ({
                id: t.id,
                project_id: t.projectId,
                user_id: t.userId,
                type: t.type,
                status: t.status,
                prompt: t.prompt,
                config: JSON.stringify(t.config),
                result: JSON.stringify(t.result),
                errors: JSON.stringify(t.errors),
                started_at: t.startedAt?.toISOString(),
                completed_at: t.completedAt?.toISOString(),
                created_at: t.createdAt.toISOString(),
                updated_at: t.updatedAt.toISOString(),
            }));

            mockDatabase.seed('tasks', taskRows);

            const results = await repository.findRunning();

            const runningTasks = results.filter(t => t.status === 'running');
            expect(runningTasks.length).toBeGreaterThan(0);
        });
    });

    describe('updateStatus', () => {
        it('should update task status to running', async () => {
            const pendingTaskRow = { ...mockTaskRow, status: 'pending', started_at: null };
            mockDatabase.seed('tasks', [pendingTaskRow]);

            await repository.updateStatus('task_test_123', 'running');

            const tableData = mockDatabase.getTableData('tasks');
            expect(tableData[0].status).toBe('running');
            expect(tableData[0].started_at).toBeDefined();
        });

        it('should set completed_at when status is completed', async () => {
            mockDatabase.seed('tasks', [mockTaskRow]);

            await repository.updateStatus('task_test_123', 'completed');

            const tableData = mockDatabase.getTableData('tasks');
            expect(tableData[0].status).toBe('completed');
            expect(tableData[0].completed_at).toBeDefined();
        });

        it('should set completed_at when status is failed', async () => {
            mockDatabase.seed('tasks', [mockTaskRow]);

            await repository.updateStatus('task_test_123', 'failed');

            const tableData = mockDatabase.getTableData('tasks');
            expect(tableData[0].status).toBe('failed');
            expect(tableData[0].completed_at).toBeDefined();
        });
    });

    describe('updateResult', () => {
        it('should update task result', async () => {
            mockDatabase.seed('tasks', [mockTaskRow]);

            const newResult = {
                code: 'new code',
                files: [],
                explanation: 'test',
                success: true,
                errors: [],
                metrics: { duration: 100, tokensUsed: 10, cost: 0.001 },
            };

            await repository.updateResult('task_test_123', newResult);

            const tableData = mockDatabase.getTableData('tasks');
            expect(tableData[0].result).toBeDefined();
        });
    });

    describe('addError', () => {
        it('should append error to existing errors', async () => {
            const taskWithErrorRow = {
                ...mockTaskRow,
                errors: JSON.stringify(['first error']),
            };
            mockDatabase.seed('tasks', [taskWithErrorRow]);

            await repository.addError('task_test_123', 'second error');

            const tableData = mockDatabase.getTableData('tasks');
            const errors = JSON.parse(tableData[0].errors as string);
            expect(errors).toEqual(['first error', 'second error']);
        });

        it('should initialize errors array if none exist', async () => {
            const taskWithoutErrorsRow = {
                ...mockTaskRow,
                errors: null,
            };
            mockDatabase.seed('tasks', [taskWithoutErrorsRow]);

            await repository.addError('task_test_123', 'first error');

            const tableData = mockDatabase.getTableData('tasks');
            const errors = JSON.parse(tableData[0].errors as string);
            expect(errors).toEqual(['first error']);
        });
    });

    describe('update', () => {
        it('should update task fields', async () => {
            mockDatabase.seed('tasks', [mockTaskRow]);

            await repository.update('task_test_123', {
                prompt: 'Updated prompt',
                status: 'completed',
            });

            const tableData = mockDatabase.getTableData('tasks');
            expect(tableData[0].prompt).toBe('Updated prompt');
            expect(tableData[0].status).toBe('completed');
        });
    });

    describe('delete', () => {
        it('should delete task', async () => {
            mockDatabase.seed('tasks', [mockTaskRow]);

            await repository.delete('task_test_123');

            const tableData = mockDatabase.getTableData('tasks');
            expect(tableData).toHaveLength(0);
        });
    });

    describe('countByStatus', () => {
        it('should count tasks by status', async () => {
            const tasks = generateMockTasks(10);
            const taskRows = tasks.map(t => ({
                id: t.id,
                project_id: t.projectId,
                user_id: t.userId,
                type: t.type,
                status: t.status,
                prompt: t.prompt,
                config: JSON.stringify(t.config),
                result: JSON.stringify(t.result),
                errors: JSON.stringify(t.errors),
                started_at: t.startedAt?.toISOString(),
                completed_at: t.completedAt?.toISOString(),
                created_at: t.createdAt.toISOString(),
                updated_at: t.updatedAt.toISOString(),
            }));

            mockDatabase.seed('tasks', taskRows);

            const counts = await repository.countByStatus('proj_test_123');

            expect(counts instanceof Map).toBe(true);
            expect(counts.size).toBeGreaterThan(0);
        });
    });

    describe('findByType', () => {
        it('should find tasks by type', async () => {
            const tasks = generateMockTasks(5);
            const taskRows = tasks.map(t => ({
                id: t.id,
                project_id: t.projectId,
                user_id: t.userId,
                type: t.type,
                status: t.status,
                prompt: t.prompt,
                config: JSON.stringify(t.config),
                result: JSON.stringify(t.result),
                errors: JSON.stringify(t.errors),
                started_at: t.startedAt?.toISOString(),
                completed_at: t.completedAt?.toISOString(),
                created_at: t.createdAt.toISOString(),
                updated_at: t.updatedAt.toISOString(),
            }));

            mockDatabase.seed('tasks', taskRows);

            const results = await repository.findByType('generation');

            expect(results.length).toBeGreaterThan(0);
            expect(results.every(t => t.type === 'generation')).toBe(true);
        });
    });

    describe('getRecent', () => {
        it('should get recent tasks for user', async () => {
            const tasks = generateMockTasks(5);
            const taskRows = tasks.map(t => ({
                id: t.id,
                project_id: t.projectId,
                user_id: 'user_123',
                type: t.type,
                status: t.status,
                prompt: t.prompt,
                config: JSON.stringify(t.config),
                result: JSON.stringify(t.result),
                errors: JSON.stringify(t.errors),
                started_at: t.startedAt?.toISOString(),
                completed_at: t.completedAt?.toISOString(),
                created_at: t.createdAt.toISOString(),
                updated_at: t.updatedAt.toISOString(),
            }));

            mockDatabase.seed('tasks', taskRows);

            const results = await repository.getRecent('user_123', 3);

            expect(results.length).toBeLessThanOrEqual(3);
        });
    });
});
