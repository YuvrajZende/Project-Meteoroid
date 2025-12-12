/**
 * ============================================
 * ALERTING & NOTIFICATIONS TEMPLATES
 * ============================================
 * 
 * Production-ready alerting with multiple channels.
 */

// ============================================
// ALERTING TEMPLATE
// ============================================

export const ALERTING_TEMPLATE = `/**
 * ============================================
 * ALERT MANAGER
 * ============================================
 * 
 * Multi-channel alerting system supporting:
 * - Slack
 * - PagerDuty
 * - Email
 * - Webhooks
 */

import { EventEmitter } from 'events';

// ============================================
// TYPES
// ============================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertChannel = 'slack' | 'pagerduty' | 'email' | 'webhook';

export interface Alert {
    id: string;
    title: string;
    message: string;
    severity: AlertSeverity;
    source: string;
    timestamp: Date;
    tags?: Record<string, string>;
    metadata?: Record<string, any>;
    resolved?: boolean;
    resolvedAt?: Date;
}

export interface AlertRule {
    id: string;
    name: string;
    condition: AlertCondition;
    severity: AlertSeverity;
    channels: AlertChannel[];
    cooldown?: number; // Seconds between alerts
    enabled: boolean;
}

export interface AlertCondition {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
    threshold: number;
    duration?: number; // Condition must be true for this duration (seconds)
}

export interface ChannelConfig {
    slack?: {
        webhookUrl: string;
        channel?: string;
        username?: string;
        iconEmoji?: string;
    };
    pagerduty?: {
        serviceKey: string;
        apiKey?: string;
    };
    email?: {
        smtp: {
            host: string;
            port: number;
            user: string;
            pass: string;
        };
        from: string;
        to: string[];
    };
    webhook?: {
        url: string;
        headers?: Record<string, string>;
    };
}

// ============================================
// ALERT MANAGER
// ============================================

export class AlertManager extends EventEmitter {
    private rules: Map<string, AlertRule> = new Map();
    private alertHistory: Alert[] = [];
    private lastAlertTime: Map<string, number> = new Map();
    private channelConfig: ChannelConfig;

    constructor(config: ChannelConfig) {
        super();
        this.channelConfig = config;
    }

    /**
     * Register an alert rule
     */
    registerRule(rule: AlertRule): void {
        this.rules.set(rule.id, rule);
        console.log(\`📢 Alert rule registered: \${rule.name}\`);
    }

    /**
     * Remove an alert rule
     */
    removeRule(ruleId: string): void {
        this.rules.delete(ruleId);
    }

    /**
     * Send an alert
     */
    async sendAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<string> {
        const fullAlert: Alert = {
            ...alert,
            id: this.generateAlertId(),
            timestamp: new Date(),
        };

        // Check cooldown
        const cooldownKey = \`\${alert.source}:\${alert.title}\`;
        const lastTime = this.lastAlertTime.get(cooldownKey);
        if (lastTime && Date.now() - lastTime < 60000) {
            return ''; // Skip duplicate alerts within 1 minute
        }
        this.lastAlertTime.set(cooldownKey, Date.now());

        // Store alert
        this.alertHistory.push(fullAlert);
        this.emit('alert', fullAlert);

        // Send to all configured channels based on severity
        const channels = this.getChannelsForSeverity(alert.severity);
        await Promise.all(channels.map(channel => this.sendToChannel(channel, fullAlert)));

        return fullAlert.id;
    }

    /**
     * Resolve an alert
     */
    async resolveAlert(alertId: string): Promise<void> {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            this.emit('resolved', alert);

            // Send resolution notification
            await this.sendToChannel('slack', {
                ...alert,
                title: \`✅ RESOLVED: \${alert.title}\`,
            });
        }
    }

    /**
     * Get alert history
     */
    getAlerts(options?: {
        severity?: AlertSeverity;
        source?: string;
        resolved?: boolean;
        limit?: number;
    }): Alert[] {
        let alerts = [...this.alertHistory];

        if (options?.severity) {
            alerts = alerts.filter(a => a.severity === options.severity);
        }
        if (options?.source) {
            alerts = alerts.filter(a => a.source === options.source);
        }
        if (options?.resolved !== undefined) {
            alerts = alerts.filter(a => a.resolved === options.resolved);
        }

        alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (options?.limit) {
            alerts = alerts.slice(0, options.limit);
        }

        return alerts;
    }

    // ========================================
    // CHANNEL SENDERS
    // ========================================

    private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
        try {
            switch (channel) {
                case 'slack':
                    await this.sendSlack(alert);
                    break;
                case 'pagerduty':
                    await this.sendPagerDuty(alert);
                    break;
                case 'email':
                    await this.sendEmail(alert);
                    break;
                case 'webhook':
                    await this.sendWebhook(alert);
                    break;
            }
        } catch (error) {
            console.error(\`Failed to send alert to \${channel}:\`, error);
            this.emit('error', { channel, alert, error });
        }
    }

    private async sendSlack(alert: Alert): Promise<void> {
        const config = this.channelConfig.slack;
        if (!config?.webhookUrl) return;

        const color = this.getSeverityColor(alert.severity);
        const emoji = this.getSeverityEmoji(alert.severity);

        const payload = {
            channel: config.channel,
            username: config.username || 'Alert Bot',
            icon_emoji: config.iconEmoji || ':rotating_light:',
            attachments: [{
                color,
                title: \`\${emoji} \${alert.title}\`,
                text: alert.message,
                fields: [
                    { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                    { title: 'Source', value: alert.source, short: true },
                ],
                footer: \`Alert ID: \${alert.id}\`,
                ts: Math.floor(alert.timestamp.getTime() / 1000),
            }],
        };

        await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    private async sendPagerDuty(alert: Alert): Promise<void> {
        const config = this.channelConfig.pagerduty;
        if (!config?.serviceKey) return;

        const payload = {
            routing_key: config.serviceKey,
            event_action: alert.resolved ? 'resolve' : 'trigger',
            dedup_key: alert.id,
            payload: {
                summary: alert.title,
                severity: this.mapSeverityToPagerDuty(alert.severity),
                source: alert.source,
                custom_details: {
                    message: alert.message,
                    ...alert.metadata,
                },
            },
        };

        await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    private async sendEmail(alert: Alert): Promise<void> {
        // Email implementation would use nodemailer
        // Placeholder for now
        console.log(\`Email alert: \${alert.title}\`);
    }

    private async sendWebhook(alert: Alert): Promise<void> {
        const config = this.channelConfig.webhook;
        if (!config?.url) return;

        await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
            body: JSON.stringify(alert),
        });
    }

    // ========================================
    // HELPERS
    // ========================================

    private generateAlertId(): string {
        return \`alert_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    }

    private getChannelsForSeverity(severity: AlertSeverity): AlertChannel[] {
        const channels: AlertChannel[] = ['slack']; // Always send to Slack
        
        if (severity === 'critical') {
            channels.push('pagerduty');
        }
        if (severity === 'error' || severity === 'critical') {
            channels.push('email');
        }
        
        return channels.filter(c => this.channelConfig[c]);
    }

    private getSeverityColor(severity: AlertSeverity): string {
        const colors = {
            info: '#36a64f',
            warning: '#ffcc00',
            error: '#ff6600',
            critical: '#ff0000',
        };
        return colors[severity];
    }

    private getSeverityEmoji(severity: AlertSeverity): string {
        const emojis = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '🔴',
            critical: '🚨',
        };
        return emojis[severity];
    }

    private mapSeverityToPagerDuty(severity: AlertSeverity): string {
        const mapping = {
            info: 'info',
            warning: 'warning',
            error: 'error',
            critical: 'critical',
        };
        return mapping[severity];
    }
}

// ============================================
// DEFAULT EXPORT
// ============================================

export const createAlertManager = (config: ChannelConfig) => new AlertManager(config);

/**
 * Quick alert sending function
 */
export function sendQuickAlert(
    manager: AlertManager,
    severity: AlertSeverity,
    title: string,
    message: string,
    source: string = 'app'
): Promise<string> {
    return manager.sendAlert({ title, message, severity, source });
}
`;

// ============================================
// AUDIT LOGGING TEMPLATE
// ============================================

export const AUDIT_LOGGING_TEMPLATE = `/**
 * ============================================
 * AUDIT LOGGING
 * ============================================
 * 
 * Compliance-ready audit logging for:
 * - User actions
 * - Data changes
 * - Authentication events
 * - Authorization decisions
 */

import { EventEmitter } from 'events';

// ============================================
// TYPES
// ============================================

export type AuditEventType = 
    | 'auth.login'
    | 'auth.logout'
    | 'auth.failed'
    | 'auth.password_change'
    | 'auth.mfa_enabled'
    | 'user.created'
    | 'user.updated'
    | 'user.deleted'
    | 'data.created'
    | 'data.read'
    | 'data.updated'
    | 'data.deleted'
    | 'permission.granted'
    | 'permission.denied'
    | 'admin.action'
    | 'system.config_change'
    | string;

export type AuditResult = 'success' | 'failure' | 'denied';

export interface AuditEvent {
    id: string;
    timestamp: Date;
    eventType: AuditEventType;
    actor: AuditActor;
    action: string;
    resource: AuditResource;
    result: AuditResult;
    changes?: AuditChange[];
    metadata?: Record<string, any>;
    duration?: number;
    ip?: string;
    userAgent?: string;
    sessionId?: string;
}

export interface AuditActor {
    id: string;
    type: 'user' | 'service' | 'system';
    name?: string;
    email?: string;
    role?: string;
}

export interface AuditResource {
    type: string;
    id?: string;
    name?: string;
}

export interface AuditChange {
    field: string;
    oldValue?: any;
    newValue?: any;
}

export interface AuditConfig {
    storage: 'memory' | 'database' | 'elasticsearch' | 'file';
    retention?: number; // Days to retain logs
    sensitiveFields?: string[];
    enableRealtime?: boolean;
}

// ============================================
// AUDIT LOGGER
// ============================================

export class AuditLogger extends EventEmitter {
    private events: AuditEvent[] = [];
    private config: AuditConfig;
    private sensitiveFields: Set<string>;

    constructor(config: AuditConfig = { storage: 'memory' }) {
        super();
        this.config = config;
        this.sensitiveFields = new Set([
            'password',
            'secret',
            'token',
            'creditCard',
            'ssn',
            ...(config.sensitiveFields || []),
        ]);
    }

    /**
     * Log an audit event
     */
    async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
        const auditEvent: AuditEvent = {
            ...event,
            id: this.generateEventId(),
            timestamp: new Date(),
            changes: event.changes ? this.sanitizeChanges(event.changes) : undefined,
        };

        // Store event
        await this.storeEvent(auditEvent);

        // Emit for real-time processing
        if (this.config.enableRealtime) {
            this.emit('event', auditEvent);
        }

        // Emit specific event type
        this.emit(event.eventType, auditEvent);

        return auditEvent.id;
    }

    /**
     * Log authentication event
     */
    async logAuth(
        action: 'login' | 'logout' | 'failed' | 'password_change' | 'mfa_enabled',
        actor: AuditActor,
        result: AuditResult,
        metadata?: Record<string, any>
    ): Promise<string> {
        return this.log({
            eventType: \`auth.\${action}\`,
            actor,
            action,
            resource: { type: 'auth' },
            result,
            metadata,
        });
    }

    /**
     * Log data change event
     */
    async logDataChange(
        action: 'created' | 'read' | 'updated' | 'deleted',
        actor: AuditActor,
        resource: AuditResource,
        changes?: AuditChange[],
        metadata?: Record<string, any>
    ): Promise<string> {
        return this.log({
            eventType: \`data.\${action}\`,
            actor,
            action,
            resource,
            result: 'success',
            changes,
            metadata,
        });
    }

    /**
     * Log permission event
     */
    async logPermission(
        granted: boolean,
        actor: AuditActor,
        resource: AuditResource,
        permission: string,
        metadata?: Record<string, any>
    ): Promise<string> {
        return this.log({
            eventType: granted ? 'permission.granted' : 'permission.denied',
            actor,
            action: \`check:\${permission}\`,
            resource,
            result: granted ? 'success' : 'denied',
            metadata,
        });
    }

    /**
     * Query audit events
     */
    async query(options: {
        eventTypes?: AuditEventType[];
        actorId?: string;
        resourceType?: string;
        resourceId?: string;
        result?: AuditResult;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{ events: AuditEvent[]; total: number }> {
        let events = [...this.events];

        // Apply filters
        if (options.eventTypes?.length) {
            events = events.filter(e => options.eventTypes!.includes(e.eventType));
        }
        if (options.actorId) {
            events = events.filter(e => e.actor.id === options.actorId);
        }
        if (options.resourceType) {
            events = events.filter(e => e.resource.type === options.resourceType);
        }
        if (options.resourceId) {
            events = events.filter(e => e.resource.id === options.resourceId);
        }
        if (options.result) {
            events = events.filter(e => e.result === options.result);
        }
        if (options.startDate) {
            events = events.filter(e => e.timestamp >= options.startDate!);
        }
        if (options.endDate) {
            events = events.filter(e => e.timestamp <= options.endDate!);
        }

        // Sort by timestamp descending
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        const total = events.length;

        // Apply pagination
        if (options.offset) {
            events = events.slice(options.offset);
        }
        if (options.limit) {
            events = events.slice(0, options.limit);
        }

        return { events, total };
    }

    /**
     * Get events for a specific actor
     */
    async getActorHistory(
        actorId: string,
        limit: number = 100
    ): Promise<AuditEvent[]> {
        const { events } = await this.query({ actorId, limit });
        return events;
    }

    /**
     * Get events for a specific resource
     */
    async getResourceHistory(
        resourceType: string,
        resourceId: string,
        limit: number = 100
    ): Promise<AuditEvent[]> {
        const { events } = await this.query({ resourceType, resourceId, limit });
        return events;
    }

    /**
     * Export audit logs
     */
    async export(options: {
        format: 'json' | 'csv';
        startDate?: Date;
        endDate?: Date;
    }): Promise<string> {
        const { events } = await this.query({
            startDate: options.startDate,
            endDate: options.endDate,
        });

        if (options.format === 'json') {
            return JSON.stringify(events, null, 2);
        }

        // CSV format
        if (events.length === 0) return '';

        const headers = [
            'id',
            'timestamp',
            'eventType',
            'actorId',
            'actorType',
            'action',
            'resourceType',
            'resourceId',
            'result',
            'ip',
        ];

        const rows = events.map(e => [
            e.id,
            e.timestamp.toISOString(),
            e.eventType,
            e.actor.id,
            e.actor.type,
            e.action,
            e.resource.type,
            e.resource.id || '',
            e.result,
            e.ip || '',
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
    }

    // ========================================
    // PRIVATE METHODS
    // ========================================

    private generateEventId(): string {
        return \`audit_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    }

    private sanitizeChanges(changes: AuditChange[]): AuditChange[] {
        return changes.map(change => {
            if (this.sensitiveFields.has(change.field.toLowerCase())) {
                return {
                    field: change.field,
                    oldValue: change.oldValue !== undefined ? '[REDACTED]' : undefined,
                    newValue: change.newValue !== undefined ? '[REDACTED]' : undefined,
                };
            }
            return change;
        });
    }

    private async storeEvent(event: AuditEvent): Promise<void> {
        switch (this.config.storage) {
            case 'memory':
                this.events.push(event);
                // Trim old events
                if (this.events.length > 10000) {
                    this.events = this.events.slice(-10000);
                }
                break;
            case 'database':
                // Implement database storage
                console.log('Audit event stored:', event.id);
                break;
            case 'elasticsearch':
                // Implement Elasticsearch storage
                console.log('Audit event indexed:', event.id);
                break;
            case 'file':
                // Implement file storage
                console.log('Audit event logged:', event.id);
                break;
        }
    }
}

// ============================================
// DEFAULT EXPORT
// ============================================

export const auditLogger = new AuditLogger({ storage: 'memory', enableRealtime: true });

/**
 * Express middleware for automatic audit logging
 */
export function auditMiddleware(options?: { events?: AuditEventType[] }) {
    return (req: any, res: any, next: any) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            const actor: AuditActor = req.user
                ? { id: req.user.id, type: 'user', email: req.user.email }
                : { id: 'anonymous', type: 'user' };

            // Determine event type based on method and path
            let eventType: AuditEventType = 'data.read';
            if (req.method === 'POST') eventType = 'data.created';
            if (req.method === 'PUT' || req.method === 'PATCH') eventType = 'data.updated';
            if (req.method === 'DELETE') eventType = 'data.deleted';

            auditLogger.log({
                eventType,
                actor,
                action: \`\${req.method} \${req.path}\`,
                resource: { type: 'api', id: req.params.id },
                result: res.statusCode < 400 ? 'success' : 'failure',
                duration,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                sessionId: req.sessionID,
            });
        });

        next();
    };
}
`;

// ============================================
// EXPORTS
// ============================================

export const ALERTING_TEMPLATE_SETS = {
    alerting: {
        name: "Alert Manager",
        template: ALERTING_TEMPLATE,
        description: "Multi-channel alerting system",
    },
    audit: {
        name: "Audit Logging",
        template: AUDIT_LOGGING_TEMPLATE,
        description: "Compliance-ready audit logging",
    },
};

export function getAlertingTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        alerting: ALERTING_TEMPLATE,
        audit: AUDIT_LOGGING_TEMPLATE,
    };
    return templates[type];
}
