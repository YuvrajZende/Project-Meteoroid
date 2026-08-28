/**
 * UserRepository Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UserRepository } from '../user.repository.js';
import { MockDatabase } from './mock-database.js';
import { mockUser, mockUserRow, generateMockUsers } from './fixtures.js';
import { RepositoryError } from '../base.repository.js';
import type { IDatabase } from '../../interfaces/database.interface.js';

describe('UserRepository', () => {
    let repository: UserRepository;
    let mockDatabase: MockDatabase;

    beforeEach(() => {
        mockDatabase = new MockDatabase();
        repository = new UserRepository(mockDatabase as unknown as IDatabase);
        mockDatabase.clearAll();
    });

    describe('create', () => {
        it('should create a new user', async () => {
            const newUser = {
                email: 'newuser@example.com',
                name: 'New User',
                passwordHash: 'hashed_password',
                role: 'user' as const,
                preferences: { theme: 'light' },
                lastLoginAt: new Date(),
            };

            const result = await repository.create(newUser);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^user_/);
            expect(result.email).toBe('newuser@example.com');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should store user in database', async () => {
            const newUser = {
                email: 'test@example.com',
                name: 'Test User',
                passwordHash: 'hash',
                role: 'user' as const,
                preferences: {},
                lastLoginAt: new Date(),
            };

            await repository.create(newUser);

            const tableData = mockDatabase.getTableData('users');
            expect(tableData).toHaveLength(1);
            expect(tableData[0].email).toBe('test@example.com');
        });

        it('should throw RepositoryError on database error', async () => {
            mockDatabase.throwError(new Error('Database error'));

            const newUser = {
                email: 'test@example.com',
                name: 'Test',
                passwordHash: 'hash',
                role: 'user' as const,
                preferences: {},
                lastLoginAt: new Date(),
            };

            await expect(repository.create(newUser)).rejects.toThrow(RepositoryError);
        });
    });

    describe('findById', () => {
        it('should find user by id', async () => {
            mockDatabase.seed('users', [mockUserRow]);

            const result = await repository.findById('user_test_123');

            expect(result).toBeDefined();
            expect(result?.id).toBe('user_test_123');
            expect(result?.email).toBe('test@example.com');
        });

        it('should return null for non-existent user', async () => {
            const result = await repository.findById('non_existent');

            expect(result).toBeNull();
        });
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
            mockDatabase.seed('users', [mockUserRow]);

            const result = await repository.findByEmail('test@example.com');

            expect(result).toBeDefined();
            expect(result?.email).toBe('test@example.com');
        });

        it('should return null for non-existent email', async () => {
            const result = await repository.findByEmail('nonexistent@example.com');

            expect(result).toBeNull();
        });
    });

    describe('update', () => {
        it('should update user fields', async () => {
            mockDatabase.seed('users', [mockUserRow]);

            await repository.update('user_test_123', {
                name: 'Updated Name',
                role: 'admin',
            });

            const tableData = mockDatabase.getTableData('users');
            expect(tableData[0].name).toBe('Updated Name');
            expect(tableData[0].role).toBe('admin');
        });

        it('should serialize preferences as JSON', async () => {
            mockDatabase.seed('users', [mockUserRow]);

            await repository.update('user_test_123', {
                preferences: { theme: 'dark', notifications: false },
            });

            const tableData = mockDatabase.getTableData('users');
            expect(tableData[0].preferences).toBeDefined();
        });

        it('should not update id or createdAt', async () => {
            mockDatabase.seed('users', [mockUserRow]);

            await repository.update('user_test_123', {
                id: 'different_id',
                createdAt: new Date('2020-01-01'),
            });

            const tableData = mockDatabase.getTableData('users');
            expect(tableData[0].id).toBe('user_test_123');
            expect(tableData[0].created_at).toBe('2024-01-01T00:00:00Z');
        });
    });

    describe('updateLastLogin', () => {
        it('should update last_login_at timestamp', async () => {
            mockDatabase.seed('users', [mockUserRow]);

            const beforeUpdate = new Date();
            await repository.updateLastLogin('user_test_123');

            const tableData = mockDatabase.getTableData('users');
            const lastLogin = new Date(tableData[0].last_login_at as string);
            expect(lastLogin.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
        });
    });

    describe('updatePreferences', () => {
        it('should merge preferences', async () => {
            const userRow = {
                ...mockUserRow,
                preferences: JSON.stringify({ theme: 'dark', language: 'en' }),
            };
            mockDatabase.seed('users', [userRow]);

            await repository.updatePreferences('user_test_123', {
                notifications: true,
                theme: 'light',
            });

            const tableData = mockDatabase.getTableData('users');
            const prefs = JSON.parse(tableData[0].preferences as string);
            expect(prefs).toEqual({
                theme: 'light',
                language: 'en',
                notifications: true,
            });
        });

        it('should initialize preferences if none exist', async () => {
            const userRow = {
                ...mockUserRow,
                preferences: null,
            };
            mockDatabase.seed('users', [userRow]);

            await repository.updatePreferences('user_test_123', {
                theme: 'dark',
            });

            const tableData = mockDatabase.getTableData('users');
            const prefs = JSON.parse(tableData[0].preferences as string);
            expect(prefs).toEqual({ theme: 'dark' });
        });
    });

    describe('delete', () => {
        it('should delete user', async () => {
            mockDatabase.seed('users', [mockUserRow]);

            await repository.delete('user_test_123');

            const tableData = mockDatabase.getTableData('users');
            expect(tableData).toHaveLength(0);
        });
    });

    describe('findAll', () => {
        it('should return all users', async () => {
            const users = generateMockUsers(5);
            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const results = await repository.findAll();

            expect(results).toHaveLength(5);
        });

        it('should support ordering', async () => {
            const users = generateMockUsers(5);
            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const results = await repository.findAll({
                orderBy: 'created_at',
                order: 'DESC',
            });

            expect(results).toHaveLength(5);
        });

        it('should support pagination', async () => {
            const users = generateMockUsers(25);
            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const results = await repository.findAll({
                limit: 10,
                offset: 5,
            });

            expect(results.length).toBeLessThanOrEqual(10);
        });
    });

    describe('findByRole', () => {
        it('should find users by role', async () => {
            const users = generateMockUsers(5);
            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const results = await repository.findByRole('user');

            expect(results.length).toBeGreaterThan(0);
            expect(results.every(u => u.role === 'user')).toBe(true);
        });
    });

    describe('search', () => {
        it('should search by name', async () => {
            const users = generateMockUsers(5);
            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const results = await repository.search('Test');

            expect(results.length).toBeGreaterThan(0);
        });

        it('should search by email', async () => {
            const users = generateMockUsers(5);
            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const results = await repository.search('example');

            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('count', () => {
        it('should count total users', async () => {
            const users = generateMockUsers(7);
            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const count = await repository.count();

            expect(count).toBe(7);
        });
    });

    describe('countByRole', () => {
        it('should count users by role', async () => {
            const users = [
                ...generateMockUsers(3).map(u => ({ ...u, role: 'admin' as const })),
                ...generateMockUsers(5).map(u => ({ ...u, role: 'user' as const })),
            ];

            const userRows = users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                password_hash: u.passwordHash,
                role: u.role,
                preferences: JSON.stringify(u.preferences),
                last_login_at: u.lastLoginAt?.toISOString(),
                created_at: u.createdAt.toISOString(),
                updated_at: u.updatedAt.toISOString(),
            }));

            mockDatabase.seed('users', userRows);

            const counts = await repository.countByRole();

            expect(counts.admin).toBe(3);
            expect(counts.user).toBe(5);
        });
    });
});
