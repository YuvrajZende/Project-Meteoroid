/**
 * AuditRepository Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditRepository } from '../audit.repository.js';
import { MockDatabase } from './mock-database.js';
import { mockAuditLogRow } from './fixtures.js';
import { RepositoryError } from '../base.repository.js';
import type { IDatabase } from '../../interfaces/database.interface.js';

describe('AuditRepository', () => {
    let repository: AuditRepository;
    let mockDatabase: MockDatabase;

    beforeEach(() => {
        mockDatabase = new MockDatabase();
        repository = new AuditRepository(mockDatabase as unknown as IDatabase);
        mockDatabase.clearAll();
    });

    describe('create', () => {
        it('should create a new audit log', async () => {
            const newLog = {
                projectId: 'proj_123',
                userId: 'user_123',
                action: 'project.created',
                entityType: 'project',
                entityId: 'proj_123',
                changes: { name: { from: null, to: 'New Project' } },
                metadata: { ipAddress: '127.0.0.1' },
            };

            const result = await repository.create(newLog);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^audit_/);
            expect(result.action).toBe('project.created');
            expect(result.createdAt).toBeInstanceOf(Date);
        });

        it('should throw RepositoryError on database error', async () => {
            mockDatabase.throwError(new Error('Database error'));

            const newLog = {
                projectId: 'proj_123',
                userId: 'user_123',
                action: 'project.created',
                entityType: 'project',
                entityId: 'proj_123',
                changes: {},
                metadata: {},
            };

            await expect(repository.create(newLog)).rejects.toThrow(RepositoryError);
        });
    });

    describe('findByProject', () => {
        it('should find audit logs for a project', async () => {
            mockDatabase.seed('audit_logs', [mockAuditLogRow]);

            const results = await repository.findByProject('proj_test_123');

            expect(results).toHaveLength(1);
            expect(results[0].projectId).toBe('proj_test_123');
            expect(results[0].action).toBe('project.created');
        });

        it('should return empty array for project with no logs', async () => {
            const results = await repository.findByProject('non_existent');

            expect(results).toEqual([]);
        });
    });

    describe('findByUser', () => {
        it('should find audit logs for a user', async () => {
            mockDatabase.seed('audit_logs', [mockAuditLogRow]);

            const results = await repository.findByUser('user_test_123');

            expect(results).toHaveLength(1);
            expect(results[0].userId).toBe('user_test_123');
        });
    });

    describe('findByAction', () => {
        it('should find audit logs by action', async () => {
            mockDatabase.seed('audit_logs', [mockAuditLogRow]);

            const results = await repository.findByAction('project.created');

            expect(results).toHaveLength(1);
            expect(results[0].action).toBe('project.created');
        });
    });

    describe('findByEntity', () => {
        it('should find audit logs by entity type and id', async () => {
            mockDatabase.seed('audit_logs', [mockAuditLogRow]);

            const results = await repository.findByEntity('project', 'proj_test_123');

            expect(results).toHaveLength(1);
            expect(results[0].entityType).toBe('project');
            expect(results[0].entityId).toBe('proj_test_123');
        });
    });

    describe('getRecent', () => {
        it('should get recent audit logs for project', async () => {
            const logs = Array.from({ length: 10 }, (_, i) => ({
                ...mockAuditLogRow,
                id: `audit_test_${i}`,
                created_at: new Date(Date.now() - i * 1000).toISOString(),
            }));

            mockDatabase.seed('audit_logs', logs);

            const results = await repository.getRecent('proj_test_123', 5);

            expect(results.length).toBeLessThanOrEqual(5);
        });
    });

    describe('search', () => {
        beforeEach(() => {
            const logs = [
                { ...mockAuditLogRow, id: 'audit_1', action: 'project.created', user_id: 'user_1' },
                { ...mockAuditLogRow, id: 'audit_2', action: 'project.updated', user_id: 'user_2' },
                { ...mockAuditLogRow, id: 'audit_3', action: 'task.started', user_id: 'user_1' },
            ];
            mockDatabase.seed('audit_logs', logs);
        });

        it('should filter by project id', async () => {
            const results = await repository.search({ projectId: 'proj_test_123' });

            expect(results.length).toBeGreaterThan(0);
            expect(results.every(r => r.projectId === 'proj_test_123')).toBe(true);
        });

        it('should filter by user id', async () => {
            const results = await repository.search({ userId: 'user_1' });

            expect(results.every(r => r.userId === 'user_1')).toBe(true);
        });

        it('should filter by action', async () => {
            const results = await repository.search({ action: 'project.created' });

            expect(results.every(r => r.action === 'project.created')).toBe(true);
        });

        it('should filter by entity type', async () => {
            const results = await repository.search({ entityType: 'project' });

            expect(results.every(r => r.entityType === 'project')).toBe(true);
        });

        it('should filter by date range', async () => {
            const startDate = new Date('2024-01-01T00:00:00Z');
            const endDate = new Date('2024-12-31T23:59:59Z');

            const results = await repository.search({ startDate, endDate });

            expect(Array.isArray(results)).toBe(true);
        });

        it('should combine multiple filters', async () => {
            const results = await repository.search({
                projectId: 'proj_test_123',
                userId: 'user_1',
                action: 'project.created',
            });

            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('deleteOlderThan', () => {
        it('should delete logs older than specified date', async () => {
            const oldDate = new Date('2023-01-01T00:00:00Z');
            const recentDate = new Date('2024-01-01T00:00:00Z');

            const logs = [
                { ...mockAuditLogRow, id: 'audit_old', created_at: oldDate.toISOString() },
                { ...mockAuditLogRow, id: 'audit_recent', created_at: recentDate.toISOString() },
            ];

            mockDatabase.seed('audit_logs', logs);

            const cutoffDate = new Date('2023-06-01T00:00:00Z');
            const deletedCount = await repository.deleteOlderThan(cutoffDate);

            expect(deletedCount).toBe(1);

            const remaining = mockDatabase.getTableData('audit_logs');
            expect(remaining.length).toBe(1);
            expect(remaining[0].id).toBe('audit_recent');
        });
    });

    describe('getStatistics', () => {
        beforeEach(() => {
            const logs = [
                { ...mockAuditLogRow, id: 'audit_1', action: 'project.created' },
                { ...mockAuditLogRow, id: 'audit_2', action: 'project.created' },
                { ...mockAuditLogRow, id: 'audit_3', action: 'project.updated' },
                { ...mockAuditLogRow, id: 'audit_4', action: 'task.started', user_id: 'user_2' },
            ];
            mockDatabase.seed('audit_logs', logs);
        });

        it('should return statistics for project', async () => {
            const stats = await repository.getStatistics('proj_test_123');

            expect(stats).toBeDefined();
            expect(typeof stats.totalActions).toBe('number');
            expect(typeof stats.actionsByType).toBe('object');
            expect(typeof stats.uniqueUsers).toBe('number');
        });

        it('should count actions by type', async () => {
            const stats = await repository.getStatistics('proj_test_123');

            expect(stats.actionsByType['project.created']).toBeDefined();
            expect(stats.actionsByType['project.updated']).toBeDefined();
        });

        it('should count unique users', async () => {
            const stats = await repository.getStatistics('proj_test_123');

            expect(stats.uniqueUsers).toBeGreaterThan(0);
        });

        it('should filter by time range', async () => {
            const timeRange = {
                start: new Date('2024-01-01T00:00:00Z'),
                end: new Date('2024-12-31T23:59:59Z'),
            };

            const stats = await repository.getStatistics('proj_test_123', timeRange);

            expect(stats).toBeDefined();
        });
    });
});
