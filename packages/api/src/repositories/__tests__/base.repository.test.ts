/**
 * BaseRepository Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseRepository, RepositoryError } from '../base.repository.js';
import { MockDatabase } from './mock-database.js';
import type { IDatabase } from '../../interfaces/database.interface.js';

// Create a concrete implementation for testing
class TestRepository extends BaseRepository {
    protected readonly tableName = 'test_table';

    // Expose protected methods for testing
    public testRowToEntity<T>(row: Record<string, unknown>): T {
        return this.rowToEntity<T>(row);
    }

    public testEntityToRow(entity: Record<string, unknown>): Record<string, unknown> {
        return this.entityToRow(entity);
    }

    public testBuildOrderBy(options?: { orderBy?: string; order?: 'ASC' | 'DESC' }): string {
        return this.buildOrderBy(options);
    }

    public testBuildPagination(options?: { limit?: number; offset?: number }): string {
        return this.buildPagination(options);
    }
}

describe('BaseRepository', () => {
    let repository: TestRepository;
    let mockDatabase: MockDatabase;

    beforeEach(() => {
        mockDatabase = new MockDatabase();
        repository = new TestRepository(mockDatabase as unknown as IDatabase);
    });

    describe('rowToEntity', () => {
        it('should convert snake_case database row to camelCase entity', () => {
            const row = {
                id: '123',
                user_id: 'user_1',
                project_name: 'Test Project',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z',
                is_active: true,
            };

            const entity = repository.testRowToEntity<any>(row);

            expect(entity).toEqual({
                id: '123',
                userId: 'user_1',
                projectName: 'Test Project',
                createdAt: new Date('2024-01-15T10:00:00Z'),
                updatedAt: new Date('2024-01-15T10:00:00Z'),
                isActive: true,
            });
        });

        it('should convert ISO string dates to Date objects', () => {
            const row = {
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-16T11:45:30.123Z',
            };

            const entity = repository.testRowToEntity<any>(row);

            expect(entity.createdAt).toBeInstanceOf(Date);
            expect(entity.createdAt.toISOString()).toBe('2024-01-15T10:30:00.000Z');
            expect(entity.updatedAt).toBeInstanceOf(Date);
            expect(entity.updatedAt.toISOString()).toBe('2024-01-16T11:45:30.123Z');
        });

        it('should handle config JSON strings', () => {
            const row = {
                id: '123',
                config: '{"theme":"dark","notifications":true}',
            };

            const entity = repository.testRowToEntity<any>(row);

            expect(entity.config).toEqual({ theme: 'dark', notifications: true });
        });

        it('should handle preferences JSON strings', () => {
            const row = {
                id: '123',
                preferences: '{"theme":"dark","notifications":true}',
            };

            const entity = repository.testRowToEntity<any>(row);

            expect(entity.preferences).toEqual({ theme: 'dark', notifications: true });
        });

        it('should preserve non-JSON string values', () => {
            const row = {
                id: '123',
                name: 'Test',
                description: 'A test value',
            };

            const entity = repository.testRowToEntity<any>(row);

            expect(entity.name).toBe('Test');
            expect(entity.description).toBe('A test value');
        });
    });

    describe('entityToRow', () => {
        it('should convert camelCase entity to snake_case database row', () => {
            const entity = {
                id: '123',
                userId: 'user_1',
                projectName: 'Test Project',
            };

            const row = repository.testEntityToRow(entity);

            expect(row).toEqual({
                id: '123',
                user_id: 'user_1',
                project_name: 'Test Project',
            });
        });

        it('should convert Date objects to ISO strings', () => {
            const entity = {
                createdAt: new Date('2024-01-15T10:30:00Z'),
                updatedAt: new Date('2024-01-16T11:45:30Z'),
            };

            const row = repository.testEntityToRow(entity);

            expect(row.created_at).toBe('2024-01-15T10:30:00.000Z');
            expect(row.updated_at).toBe('2024-01-16T11:45:30.000Z');
        });

        it('should convert objects to JSON strings', () => {
            const entity = {
                config: { theme: 'dark', notifications: true },
                preferences: { language: 'en' },
            };

            const row = repository.testEntityToRow(entity);

            expect(row.config).toBe('{"theme":"dark","notifications":true}');
            expect(row.preferences).toBe('{"language":"en"}');
        });

        it('should skip undefined values', () => {
            const entity = {
                id: '123',
                name: 'Test',
                description: undefined,
                optional: undefined,
            };

            const row = repository.testEntityToRow(entity);

            expect(row).toEqual({
                id: '123',
                name: 'Test',
            });
            expect(row).not.toHaveProperty('description');
            expect(row).not.toHaveProperty('optional');
        });
    });

    describe('buildOrderBy', () => {
        it('should return empty string when no options provided', () => {
            const result = repository.testBuildOrderBy();
            expect(result).toBe('');
        });

        it('should build ORDER BY with default ASC direction', () => {
            const result = repository.testBuildOrderBy({ orderBy: 'created_at' });
            expect(result).toBe('ORDER BY created_at ASC');
        });

        it('should build ORDER BY with DESC direction', () => {
            const result = repository.testBuildOrderBy({ orderBy: 'created_at', order: 'DESC' });
            expect(result).toBe('ORDER BY created_at DESC');
        });

        it('should convert camelCase to snake_case for column names', () => {
            const result = repository.testBuildOrderBy({ orderBy: 'createdAt' });
            expect(result).toBe('ORDER BY created_at ASC');
        });
    });

    describe('buildPagination', () => {
        it('should return empty string when no options provided', () => {
            const result = repository.testBuildPagination();
            expect(result).toBe('');
        });

        it('should build LIMIT clause', () => {
            const result = repository.testBuildPagination({ limit: 10 });
            expect(result).toBe('LIMIT 10');
        });

        it('should build OFFSET clause', () => {
            const result = repository.testBuildPagination({ offset: 20 });
            expect(result).toBe('OFFSET 20');
        });

        it('should build LIMIT and OFFSET clauses', () => {
            const result = repository.testBuildPagination({ limit: 10, offset: 20 });
            expect(result).toBe('LIMIT 10 OFFSET 20');
        });
    });

    describe('handleError', () => {
        it('should throw RepositoryError with context', () => {
            const originalError = new Error('Connection failed');

            expect(() => {
                (repository as any).handleError(originalError, 'testOperation');
            }).toThrow(RepositoryError);
        });

        it('should include repository name in error (TestRepository)', () => {
            const originalError = new Error('Connection failed');

            try {
                (repository as any).handleError(originalError, 'testOperation');
            } catch (error) {
                expect(error).toBeInstanceOf(RepositoryError);
                if (error instanceof RepositoryError) {
                    expect(error.repository).toBe('TestRepository');
                }
            }
        });

        it('should include original error', () => {
            const originalError = new Error('Connection failed');

            try {
                (repository as any).handleError(originalError, 'testOperation');
            } catch (error) {
                expect(error).toBeInstanceOf(RepositoryError);
                if (error instanceof RepositoryError) {
                    expect(error.originalError).toBe(originalError);
                }
            }
        });
    });

    describe('query method', () => {
        it('should execute queries through database', async () => {
            const mockData = [{ id: '1', name: 'Test' }];
            mockDatabase.seed('users', mockData);

            const result = await (repository as any).query('SELECT * FROM users');

            expect(result).toEqual(mockData);
        });

        it('should pass parameters to database', async () => {
            mockDatabase.seed('users', [
                { id: '1', name: 'Test 1' },
                { id: '2', name: 'Test 2' },
            ]);

            const result = await (repository as any).query('SELECT * FROM users WHERE id = $1', { id: '1' });

            expect(result).toEqual([{ id: '1', name: 'Test 1' }]);
        });
    });

    describe('now method', () => {
        it('should return current date', () => {
            const before = new Date();
            const result = (repository as any).now();
            const after = new Date();

            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });
});
