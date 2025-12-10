/**
 * Audit Service
 * Database operations for audit logs
 */

import { getSupabaseAdmin } from '../client.js';

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
    resource_type: string;
    resource_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    metadata?: Record<string, unknown> | null;
}

/**
 * AuditService - Audit logging operations
 */
export class AuditService {
    private supabase = getSupabaseAdmin();

    /**
     * Log an audit event
     */
    async log(event: AuditLogInsert): Promise<AuditLog> {
        const { data, error } = await this.supabase
            .from('audit_logs')
            .insert({
                user_id: event.user_id || null,
                action: event.action,
                resource_type: event.resource_type,
                resource_id: event.resource_id || null,
                ip_address: event.ip_address || null,
                user_agent: event.user_agent || null,
                metadata: event.metadata || null,
            })
            .select()
            .single();

        if (error) {
            // Don't throw on audit failures - just log it
            console.error('Failed to create audit log:', error.message);
            return {} as AuditLog;
        }

        return data as AuditLog;
    }

    /**
     * Get audit logs for a user
     */
    async getByUserId(userId: string, options?: {
        action?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ logs: AuditLog[]; total: number }> {
        let query = this.supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (options?.action) {
            query = query.eq('action', options.action);
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        const { data, error, count } = await query;

        if (error) {
            throw new Error(`Failed to get audit logs: ${error.message}`);
        }

        return {
            logs: (data || []) as AuditLog[],
            total: count || 0,
        };
    }

    /**
     * Get audit logs for a resource
     */
    async getByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
        const { data, error } = await this.supabase
            .from('audit_logs')
            .select('*')
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get audit logs: ${error.message}`);
        }

        return (data || []) as AuditLog[];
    }

    /**
     * Get recent security events
     */
    async getSecurityEvents(options?: {
        limit?: number;
    }): Promise<AuditLog[]> {
        const securityActions = [
            'user.login',
            'user.logout',
            'api_key.create',
            'api_key.revoke',
            'admin.action',
        ];

        const { data, error } = await this.supabase
            .from('audit_logs')
            .select('*')
            .in('action', securityActions)
            .order('created_at', { ascending: false })
            .limit(options?.limit || 100);

        if (error) {
            throw new Error(`Failed to get security events: ${error.message}`);
        }

        return (data || []) as AuditLog[];
    }
}

// Export singleton instance
export const auditService = new AuditService();
