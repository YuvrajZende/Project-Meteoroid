/**
 * ProjectRepository Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectRepository } from '../project.repository.js';
import { MockDatabase } from './mock-database.js';
import { mockProject, mockProjectRow, generateMockProjects } from './fixtures.js';
import { RepositoryError } from '../base.repository.js';
import type { IDatabase } from '../../interfaces/database.interface.js';

describe('ProjectRepository', () => {
    let repository: ProjectRepository;
    let mockDatabase: MockDatabase;

    beforeEach(() => {
        mockDatabase = new MockDatabase();
        repository = new ProjectRepository(mockDatabase as unknown as IDatabase);
        mockDatabase.clearAll();
    });

    describe('create', () => {
        it('should create a new project', async () => {
            const newProject = {
                userId: 'user_123',
                name: 'New Project',
                description: 'A new test project',
                config: { language: 'typescript' },
                techStack: ['typescript'],
                status: 'active' as const,
                filesCount: 0,
                lastGeneratedAt: new Date(),
            };

            const result = await repository.create(newProject);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^proj_/);
            expect(result.name).toBe('New Project');
            expect(result.userId).toBe('user_123');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should store project in database', async () => {
            const newProject = {
                userId: 'user_123',
                name: 'New Project',
                description: 'A new test project',
                config: { language: 'typescript' },
                techStack: ['typescript'],
                status: 'active' as const,
                filesCount: 0,
            };

            await repository.create(newProject);

            const tableData = mockDatabase.getTableData('projects');
            expect(tableData).toHaveLength(1);
            expect(tableData[0].name).toBe('New Project');
        });

        it('should throw RepositoryError on database error', async () => {
            mockDatabase.throwError(new Error('Database connection failed'));

            const newProject = {
                userId: 'user_123',
                name: 'New Project',
                description: 'A new test project',
                config: {},
                techStack: [],
                status: 'active' as const,
                filesCount: 0,
            };

            await expect(repository.create(newProject)).rejects.toThrow(RepositoryError);
        });
    });

    describe('findById', () => {
        it('should find project by id', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            const result = await repository.findById('proj_test_123');

            expect(result).toBeDefined();
            expect(result?.id).toBe('proj_test_123');
            expect(result?.name).toBe('Test Project');
        });

        it('should return null for non-existent project', async () => {
            const result = await repository.findById('non_existent');

            expect(result).toBeNull();
        });

        it('should exclude deleted projects', async () => {
            const deletedProjectRow = { ...mockProjectRow, id: 'proj_deleted', status: 'deleted' };
            mockDatabase.seed('projects', [mockProjectRow, deletedProjectRow]);

            const result = await repository.findById('proj_deleted');

            expect(result).toBeNull();
        });
    });

    describe('findByUser', () => {
        it('should find all projects for a user', async () => {
            const projects = generateMockProjects(3, 'user_123');
            const projectRows = projects.map(p => ({
                id: p.id,
                user_id: p.userId,
                name: p.name,
                description: p.description,
                config: JSON.stringify(p.config),
                tech_stack: p.techStack,
                status: p.status,
                files_count: p.filesCount,
                last_generated_at: p.lastGeneratedAt?.toISOString(),
                created_at: p.createdAt.toISOString(),
                updated_at: p.updatedAt.toISOString(),
            }));

            mockDatabase.seed('projects', projectRows);

            const results = await repository.findByUser('user_123');

            expect(results).toHaveLength(3);
            expect(results[0].userId).toBe('user_123');
        });

        it('should exclude deleted projects', async () => {
            const projects = generateMockProjects(2, 'user_123');
            const projectRows = projects.map(p => ({
                id: p.id,
                user_id: p.userId,
                name: p.name,
                description: p.description,
                config: JSON.stringify(p.config),
                tech_stack: p.techStack,
                status: p.status,
                files_count: p.filesCount,
                last_generated_at: p.lastGeneratedAt?.toISOString(),
                created_at: p.createdAt.toISOString(),
                updated_at: p.updatedAt.toISOString(),
            }));

            // Add a deleted project
            projectRows.push({ ...projectRows[0], id: 'proj_deleted', status: 'deleted' });

            mockDatabase.seed('projects', projectRows);

            const results = await repository.findByUser('user_123');

            expect(results).toHaveLength(2);
            expect(results.every(p => p.status !== 'deleted')).toBe(true);
        });
    });

    describe('findPaginated', () => {
        beforeEach(() => {
            const projects = generateMockProjects(25, 'user_123');
            const projectRows = projects.map(p => ({
                id: p.id,
                user_id: p.userId,
                name: p.name,
                description: p.description,
                config: JSON.stringify(p.config),
                tech_stack: p.techStack,
                status: p.status,
                files_count: p.filesCount,
                last_generated_at: p.lastGeneratedAt?.toISOString(),
                created_at: p.createdAt.toISOString(),
                updated_at: p.updatedAt.toISOString(),
            }));
            mockDatabase.seed('projects', projectRows);
        });

        it('should return paginated results', async () => {
            const result = await repository.findPaginated('user_123', { limit: 10, offset: 0 });

            expect(result.data).toHaveLength(10);
            expect(result.total).toBe(25);
            expect(result.limit).toBe(10);
            expect(result.offset).toBe(0);
            expect(result.hasMore).toBe(true);
        });

        it('should indicate no more pages on last page', async () => {
            const result = await repository.findPaginated('user_123', { limit: 10, offset: 20 });

            expect(result.data).toHaveLength(5);
            expect(result.hasMore).toBe(false);
        });

        it('should return total count', async () => {
            const result = await repository.findPaginated('user_123');

            expect(result.total).toBe(25);
        });
    });

    describe('update', () => {
        it('should update project fields', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            await repository.update('proj_test_123', {
                name: 'Updated Project',
                status: 'archived',
            });

            const tableData = mockDatabase.getTableData('projects');
            expect(tableData[0].name).toBe('Updated Project');
            expect(tableData[0].status).toBe('archived');
        });

        it('should update timestamp', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            const beforeUpdate = new Date();
            await repository.update('proj_test_123', { name: 'Updated' });

            const tableData = mockDatabase.getTableData('projects');
            const updatedAt = new Date(tableData[0].updated_at as string);
            expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
        });
    });

    describe('upsert', () => {
        it('should create new project if not exists', async () => {
            const newProject = {
                userId: 'user_123',
                name: 'New Project',
                description: 'New',
                config: {},
                techStack: [],
                status: 'active' as const,
                filesCount: 0,
            };

            const result = await repository.upsert(newProject);

            expect(result.id).toBeDefined();
            expect(result.name).toBe('New Project');
        });

        it('should update existing project', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            const updates = {
                userId: 'user_test_123',
                name: 'Updated Project',
                description: 'Updated description',
                config: { language: 'typescript' },
                techStack: ['typescript'],
                status: 'active' as const,
                filesCount: 50,
            };

            const result = await repository.upsert({ ...updates, id: 'proj_test_123' });

            expect(result.id).toBe('proj_test_123');
            expect(result.name).toBe('Updated Project');
        });
    });

    describe('delete', () => {
        it('should soft delete project', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            await repository.delete('proj_test_123');

            const tableData = mockDatabase.getTableData('projects');
            expect(tableData[0].status).toBe('deleted');
        });

        it('should not remove row from database', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            await repository.delete('proj_test_123');

            const tableData = mockDatabase.getTableData('projects');
            expect(tableData).toHaveLength(1);
        });
    });

    describe('archive', () => {
        it('should archive project', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            await repository.archive('proj_test_123');

            const tableData = mockDatabase.getTableData('projects');
            expect(tableData[0].status).toBe('archived');
        });
    });

    describe('count', () => {
        it('should count projects for user', async () => {
            const projects = generateMockProjects(5, 'user_123');
            const projectRows = projects.map(p => ({
                id: p.id,
                user_id: p.userId,
                name: p.name,
                description: p.description,
                config: JSON.stringify(p.config),
                tech_stack: p.techStack,
                status: p.status,
                files_count: p.filesCount,
                last_generated_at: p.lastGeneratedAt?.toISOString(),
                created_at: p.createdAt.toISOString(),
                updated_at: p.updatedAt.toISOString(),
            }));
            mockDatabase.seed('projects', projectRows);

            const count = await repository.count('user_123');

            expect(count).toBe(5);
        });

        it('should exclude deleted projects from count', async () => {
            const projects = generateMockProjects(5, 'user_123');
            const projectRows = projects.map(p => ({
                id: p.id,
                user_id: p.userId,
                name: p.name,
                description: p.description,
                config: JSON.stringify(p.config),
                tech_stack: p.techStack,
                status: p.status,
                files_count: p.filesCount,
                last_generated_at: p.lastGeneratedAt?.toISOString(),
                created_at: p.createdAt.toISOString(),
                updated_at: p.updatedAt.toISOString(),
            }));
            projectRows.push({ ...projectRows[0], id: 'proj_deleted', status: 'deleted' });
            mockDatabase.seed('projects', projectRows);

            const count = await repository.count('user_123');

            expect(count).toBe(5);
        });
    });

    describe('updateLastGenerated', () => {
        it('should update last_generated_at and files_count', async () => {
            mockDatabase.seed('projects', [mockProjectRow]);

            const beforeUpdate = new Date();
            await repository.updateLastGenerated('proj_test_123', 100);

            const tableData = mockDatabase.getTableData('projects');
            expect(tableData[0].files_count).toBe(100);

            const lastGenerated = new Date(tableData[0].last_generated_at as string);
            expect(lastGenerated.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
        });
    });
});
