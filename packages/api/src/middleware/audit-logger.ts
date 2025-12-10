/**
 * Audit Logger
 * Comprehensive audit logging for security and compliance
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Audit event types
 */
export type AuditEventType =
    | 'auth.login'
    | 'auth.logout'
    | 'auth.register'
    | 'auth.password_reset'
    | 'auth.token_refresh'
    | 'auth.api_key_create'
    | 'auth.api_key_revoke'
    | 'auth.failed_login'
    | 'task.create'
    | 'task.complete'
    | 'task.fail'
    | 'task.cancel'
    | 'project.create'
    | 'project.update'
    | 'project.delete'
    | 'admin.action'
    | 'security.bot_blocked'
    | 'security.rate_limited'
    | 'security.suspicious_request';

/**
 * Audit log entry
 */
export interface AuditEntry {
    timestamp: string;
    eventType: AuditEventType;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    action: string;
    ipAddress: string;
    userAgent: string;
    requestId: string;
    metadata?: Record<string, unknown>;
    success: boolean;
    errorMessage?: string;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
    enabled?: boolean;
    logToConsole?: boolean;
    logToDatabase?: boolean;
    sensitiveFields?: string[];
}

/**
 * AuditLogger class
 */
export class AuditLogger {
    private config: Required<AuditLoggerConfig>;
    private buffer: AuditEntry[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor(config: AuditLoggerConfig = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            logToConsole: config.logToConsole ?? (process.env.NODE_ENV !== 'production'),
            logToDatabase: config.logToDatabase ?? true,
            sensitiveFields: config.sensitiveFields ?? ['password', 'token', 'apiKey', 'secret'],
        };

        // Start flush interval (every 10 seconds)
        if (this.config.logToDatabase) {
            this.flushInterval = setInterval(() => this.flush(), 10000);
        }
    }

    /**
     * Log an audit event
     */
    log(
        eventType: AuditEventType,
        request: FastifyRequest,
        options: {
            userId?: string;
            resourceType?: string;
            resourceId?: string;
            action: string;
            metadata?: Record<string, unknown>;
            success?: boolean;
            errorMessage?: string;
        }
    ): void {
        if (!this.config.enabled) return;

        const entry: AuditEntry = {
            timestamp: new Date().toISOString(),
            eventType,
            userId: options.userId,
            resourceType: options.resourceType,
            resourceId: options.resourceId,
            action: options.action,
            ipAddress: request.ip || 'unknown',
            userAgent: (request.headers['user-agent'] as string) || 'unknown',
            requestId: (request.id as string) || 'unknown',
            metadata: this.sanitizeMetadata(options.metadata),
            success: options.success ?? true,
            errorMessage: options.errorMessage,
        };

        // Console logging
        if (this.config.logToConsole) {
            const emoji = entry.success ? '✅' : '❌';
            console.log(
                `${emoji} [AUDIT] ${entry.eventType} | User: ${entry.userId || 'anonymous'} | ${entry.action}`
            );
        }

        // Add to buffer for database flush
        if (this.config.logToDatabase) {
            this.buffer.push(entry);
        }
    }

    /**
     * Log authentication event
     */
    logAuth(
        request: FastifyRequest,
        action: 'login' | 'logout' | 'register' | 'failed_login' | 'token_refresh',
        options: {
            userId?: string;
            email?: string;
            success?: boolean;
            errorMessage?: string;
        }
    ): void {
        this.log(`auth.${action}` as AuditEventType, request, {
            userId: options.userId,
            action: `User ${action}`,
            metadata: { email: options.email },
            success: options.success,
            errorMessage: options.errorMessage,
        });
    }

    /**
     * Log task event
     */
    logTask(
        request: FastifyRequest,
        action: 'create' | 'complete' | 'fail' | 'cancel',
        options: {
            userId: string;
            taskId: string;
            metadata?: Record<string, unknown>;
        }
    ): void {
        this.log(`task.${action}` as AuditEventType, request, {
            userId: options.userId,
            resourceType: 'task',
            resourceId: options.taskId,
            action: `Task ${action}`,
            metadata: options.metadata,
            success: action !== 'fail',
        });
    }

    /**
     * Log project event
     */
    logProject(
        request: FastifyRequest,
        action: 'create' | 'update' | 'delete',
        options: {
            userId: string;
            projectId: string;
            metadata?: Record<string, unknown>;
        }
    ): void {
        this.log(`project.${action}` as AuditEventType, request, {
            userId: options.userId,
            resourceType: 'project',
            resourceId: options.projectId,
            action: `Project ${action}`,
            metadata: options.metadata,
        });
    }

    /**
     * Log security event
     */
    logSecurity(
        request: FastifyRequest,
        eventType: 'bot_blocked' | 'rate_limited' | 'suspicious_request',
        metadata?: Record<string, unknown>
    ): void {
        this.log(`security.${eventType}` as AuditEventType, request, {
            action: `Security event: ${eventType}`,
            metadata,
            success: false,
        });
    }

    /**
     * Sanitize metadata to remove sensitive fields
     */
    private sanitizeMetadata(
        metadata?: Record<string, unknown>
    ): Record<string, unknown> | undefined {
        if (!metadata) return undefined;

        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(metadata)) {
            if (this.config.sensitiveFields.includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Flush buffer to database
     */
    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;

        const entries = [...this.buffer];
        this.buffer = [];

        // TODO: Batch insert to Supabase audit_logs table
        // const { error } = await supabase.from('audit_logs').insert(entries);

        if (process.env.NODE_ENV !== 'production') {
            console.log(`📝 Flushed ${entries.length} audit logs`);
        }
    }

    /**
     * Get recent logs from buffer
     */
    getRecent(count: number = 100): AuditEntry[] {
        return this.buffer.slice(-count);
    }

    /**
     * Stop the logger
     */
    stop(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        // Final flush
        this.flush();
    }
}

// Export singleton
let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
    if (!auditLoggerInstance) {
        auditLoggerInstance = new AuditLogger();
    }
    return auditLoggerInstance;
}

export function createAuditLogger(config?: AuditLoggerConfig): AuditLogger {
    auditLoggerInstance = new AuditLogger(config);
    return auditLoggerInstance;
}
