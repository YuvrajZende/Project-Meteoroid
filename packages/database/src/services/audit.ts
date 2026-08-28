/**
 * Audit Service
 * Database operations for audit logs
 */

import { getConvexClient, api } from '../../api/src/infrastructure/database/convex-client.js';

/**
 * Audit log entity
 */
export interface AuditLog {
    id: string;
    user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    _id: string;
}

/**
 * Audit action types
 */
export type AuditAction =
    | 'user.login'
    | 'user.logout'
    | 'user.register'
    | 'task.create'
    | 'task.complete'
    | 'task.fail'
    | 'task.cancel'
    | 'project.create'
    | 'project.update'
    | 'project.delete'
    | 'api_key.create'
    | 'api_key.revoke'
    | 'admin.action';

/**
 * Audit log insert DTO
 */
export interface AuditLogInsert {
    user_id?: string | null;
    action: AuditAction | string;
    resource_type: string; // Made required to match
    resource_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    metadata?: Record<string, unknown> | null;
}

/**
 * AuditService - Audit logging operations
 */
export class AuditService {
    private convex = getConvexClient();

    /**
     * Log an audit event
     */
    async log(event: AuditLogInsert): Promise<AuditLog> {
        try {
            const newId = await this.convex.mutation(api.audit_logs.create, {
                userId: event.user_id || undefined,
                action: event.action,
                resourceType: event.resource_type,
                resourceId: event.resource_id || undefined,
                ipAddress: event.ip_address || undefined,
                userAgent: event.user_agent || undefined,
                metadata: event.metadata || undefined,
                success: true, // Defaulting to true as per old implementation implicit success
            });

            return {
                id: newId,
                _id: newId,
                user_id: event.user_id || null,
                action: event.action,
                resource_type: event.resource_type,
                resource_id: event.resource_id || null,
                ip_address: event.ip_address || null,
                user_agent: event.user_agent || null,
                metadata: event.metadata || null,
                created_at: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Failed to create audit log:', error);
            return {} as AuditLog;
        }
    }

    /**
     * Get audit logs for a user
     */
    async getByUserId(userId: string, options?: {
        action?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ logs: AuditLog[]; total: number }> {
        const logs = await this.convex.query(api.audit_logs.listByUser, { userId });

        let filtered = logs;
        if (options?.action) {
            filtered = filtered.filter(l => l.action === options.action);
        }

        const total = filtered.length;

        if (options?.offset !== undefined || options?.limit !== undefined) {
            const start = options.offset || 0;
            const end = options.limit ? start + options.limit : filtered.length;
            filtered = filtered.slice(start, end);
        }

        return {
            logs: filtered.map(l => this.mapToEntity(l)),
            total,
        };
    }

    /**
     * Get audit logs for a resource
     */
    async getByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
        const logs = await this.convex.query(api.audit_logs.listByResource, { resourceType, resourceId });
        return logs.map(l => this.mapToEntity(l));
    }

    /**
     * Get recent security events
     */
    async getSecurityEvents(options?: {
        limit?: number;
    }): Promise<AuditLog[]> {
        const logs = await this.convex.query(api.audit_logs.listSecurityEvents, { limit: options?.limit });
        return logs.map(l => this.mapToEntity(l));
    }

    private mapToEntity(l: any): AuditLog {
        return {
            id: l._id,
            _id: l._id,
            user_id: l.userId || null,
            action: l.action,
            resource_type: l.resourceType || '',
            resource_id: l.resourceId || null,
            ip_address: l.ipAddress || null,
            user_agent: l.userAgent || null,
            metadata: l.metadata || null,
            created_at: l.created_at || new Date().toISOString(),
        };
    }
}

// Export singleton instance
export const auditService = new AuditService();
