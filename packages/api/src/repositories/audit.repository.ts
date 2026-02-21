/**
 * Audit Repository
 * Week 2: Repository Layer - Day 11
 *
 * Handles all database operations for audit logs
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types.js';
import type { IDatabase } from '../interfaces/database.interface.js';
import type {
    IAuditRepository,
    AuditLog,
    QueryOptions,
} from '../interfaces/repository.interface.js';
import { BaseRepository } from './base.repository.js';

@injectable()
export class AuditRepository extends BaseRepository implements IAuditRepository {
    protected readonly tableName = 'audit_logs';

    constructor(@inject(TYPES.Database) database: IDatabase) {
        super(database);
    }

    /**
     * Create audit log entry
     */
    async create(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
        try {
            const row = this.entityToRow({
                id: this.generateId(),
                ...log,
                createdAt: this.now(),
            });

            const results = await this.query<any>(
                `INSERT INTO audit_logs (id, project_id, user_id, action, entity_type, entity_id, changes, metadata, ip_address, user_agent, created_at)
                 VALUES ($id, $projectId, $userId, $action, $entityType, $entityId, $changes::jsonb, $metadata::jsonb, $ipAddress, $userAgent, $createdAt)
                 RETURNING *`,
                row
            );

            if (!results[0]) {
                throw new Error('Failed to create audit log');
            }

            return this.rowToEntity<AuditLog>(results[0]);
        } catch (error) {
            this.handleError(error, 'create');
        }
    }

    /**
     * Find audit logs for a project
     */
    async findByProject(projectId: string, options?: QueryOptions): Promise<AuditLog[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM audit_logs
                 WHERE project_id = $projectId
                 ${orderBy}
                 ${pagination}`,
                { projectId }
            );

            return results.map(r => this.rowToEntity<AuditLog>(r));
        } catch (error) {
            this.handleError(error, 'findByProject');
        }
    }

    /**
     * Find audit logs for a user
     */
    async findByUser(userId: string, options?: QueryOptions): Promise<AuditLog[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM audit_logs
                 WHERE user_id = $userId
                 ${orderBy}
                 ${pagination}`,
                { userId }
            );

            return results.map(r => this.rowToEntity<AuditLog>(r));
        } catch (error) {
            this.handleError(error, 'findByUser');
        }
    }

    /**
     * Find audit logs by action
     */
    async findByAction(action: string, options?: QueryOptions): Promise<AuditLog[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM audit_logs
                 WHERE action = $action
                 ${orderBy}
                 ${pagination}`,
                { action }
            );

            return results.map(r => this.rowToEntity<AuditLog>(r));
        } catch (error) {
            this.handleError(error, 'findByAction');
        }
    }

    /**
     * Find audit logs for an entity
     */
    async findByEntity(entityType: string, entityId: string, options?: QueryOptions): Promise<AuditLog[]> {
        try {
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM audit_logs
                 WHERE entity_type = $entityType AND entity_id = $entityId
                 ${orderBy}
                 ${pagination}`,
                { entityType, entityId }
            );

            return results.map(r => this.rowToEntity<AuditLog>(r));
        } catch (error) {
            this.handleError(error, 'findByEntity');
        }
    }

    /**
     * Get recent audit logs
     */
    async getRecent(projectId: string, limit: number): Promise<AuditLog[]> {
        try {
            const results = await this.query<any>(
                `SELECT * FROM audit_logs
                 WHERE project_id = $projectId
                 ORDER BY created_at DESC
                 LIMIT $limit`,
                { projectId, limit }
            );

            return results.map(r => this.rowToEntity<AuditLog>(r));
        } catch (error) {
            this.handleError(error, 'getRecent');
        }
    }

    /**
     * Search audit logs
     */
    async search(
        filters: {
            projectId?: string;
            userId?: string;
            action?: string;
            entityType?: string;
            startDate?: Date;
            endDate?: Date;
        },
        options?: QueryOptions
    ): Promise<AuditLog[]> {
        try {
            const conditions: string[] = [];
            const params: Record<string, unknown> = {};
            let paramIndex = 1;

            if (filters.projectId) {
                conditions.push(`project_id = $${paramIndex}`);
                params[`param${paramIndex++}`] = filters.projectId;
            }

            if (filters.userId) {
                conditions.push(`user_id = $${paramIndex}`);
                params[`param${paramIndex++}`] = filters.userId;
            }

            if (filters.action) {
                conditions.push(`action = $${paramIndex}`);
                params[`param${paramIndex++}`] = filters.action;
            }

            if (filters.entityType) {
                conditions.push(`entity_type = $${paramIndex}`);
                params[`param${paramIndex++}`] = filters.entityType;
            }

            if (filters.startDate) {
                conditions.push(`created_at >= $${paramIndex}`);
                params[`param${paramIndex++}`] = filters.startDate.toISOString();
            }

            if (filters.endDate) {
                conditions.push(`created_at <= $${paramIndex}`);
                params[`param${paramIndex++}`] = filters.endDate.toISOString();
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const orderBy = this.buildOrderBy(options);
            const pagination = this.buildPagination(options);

            const results = await this.query<any>(
                `SELECT * FROM audit_logs ${whereClause} ${orderBy} ${pagination}`,
                params
            );

            return results.map(r => this.rowToEntity<AuditLog>(r));
        } catch (error) {
            this.handleError(error, 'search');
        }
    }

    /**
     * Delete old audit logs (cleanup)
     */
    async deleteOlderThan(date: Date): Promise<number> {
        try {
            const results = await this.query<{ count: bigint }>(
                `DELETE FROM audit_logs WHERE created_at < $date RETURNING COUNT(*) as count`,
                { date: date.toISOString() }
            );

            return Number(results[0]?.count || 0);
        } catch (error) {
            this.handleError(error, 'deleteOlderThan');
        }
    }

    /**
     * Get audit statistics for a project
     */
    async getStatistics(
        projectId: string,
        timeRange?: { start: Date; end: Date }
    ): Promise<{
        totalActions: number;
        actionsByType: Record<string, number>;
        uniqueUsers: number;
    }> {
        try {
            let sql = `SELECT action, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
                      FROM audit_logs
                      WHERE project_id = $projectId`;
            const params: Record<string, unknown> = { projectId };

            if (timeRange) {
                sql += ` AND created_at >= $startDate AND created_at <= $endDate`;
                params['startDate'] = timeRange.start.toISOString();
                params['endDate'] = timeRange.end.toISOString();
            }

            sql += ` GROUP BY action`;

            const results = await this.query<{ action: string; count: bigint; unique_users: bigint }>(sql, params);

            const actionsByType: Record<string, number> = {};
            let totalActions = 0;

            for (const row of results) {
                actionsByType[row.action] = Number(row.count);
                totalActions += Number(row.count);
            }

            // Get unique users separately for accurate count
            const userResults = await this.query<{ user_id: string }>(
                `SELECT DISTINCT user_id FROM audit_logs WHERE project_id = $projectId`,
                { projectId }
            );
            const uniqueUsers = userResults.length;

            return {
                totalActions,
                actionsByType,
                uniqueUsers,
            };
        } catch (error) {
            this.handleError(error, 'getStatistics');
        }
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return crypto.randomUUID();
    }
}
