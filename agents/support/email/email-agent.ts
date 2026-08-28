/**
 * ============================================
 * EMAIL AGENT - CORE IMPLEMENTATION
 * ============================================
 * 
 * The Email Agent is responsible for generating email systems
 * including templates, transactional emails, and notification services.
 * 
 * Capabilities:
 * - Email service configuration (Resend, Nodemailer, SendGrid)
 * - Transactional email templates
 * - HTML/Text email generation
 * - Email queue integration
 * - Template management
 * - Email analytics tracking
 * 
 * @author Person 4 (DevOps Engineer)
 */

// ============================================
// TYPES
// ============================================

export type EmailProvider = 'resend' | 'nodemailer' | 'sendgrid' | 'ses' | 'mailgun';
export type EmailType = 'transactional' | 'marketing' | 'notification' | 'digest';
export type TemplateFormat = 'html' | 'mjml' | 'react-email';

export interface EmailAgentConfig {
    provider: EmailProvider;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    templateFormat: TemplateFormat;
    queueEnabled: boolean;
    trackingEnabled: boolean;
}

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    type: EmailType;
    variables: TemplateVariable[];
    htmlContent?: string;
    textContent?: string;
}

export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    default?: unknown;
    description?: string;
}

export interface EmailConfig {
    provider: EmailProvider;
    apiKey?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
        user: string;
        pass: string;
    };
}

export interface EmailGeneratedFile {
    path: string;
    content: string;
    type: 'service' | 'template' | 'types' | 'queue' | 'config';
}

export interface EmailGenerationResult {
    success: boolean;
    files: EmailGeneratedFile[];
    templates: string[];
    provider: EmailProvider;
}

// ============================================
// TEMPLATES
// ============================================

const RESEND_SERVICE_TEMPLATE = `import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
    }>;
}

export async function sendEmail(options: SendEmailOptions) {
    try {
        const { data, error } = await resend.emails.send({
            from: '{{fromName}} <{{fromEmail}}>',
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            cc: options.cc,
            bcc: options.bcc,
            reply_to: options.replyTo,
            attachments: options.attachments,
        });

        if (error) {
            throw new Error(\`Failed to send email: \${error.message}\`);
        }

        return { success: true, messageId: data?.id };
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
}

export async function sendBatchEmails(emails: SendEmailOptions[]) {
    const results = await Promise.allSettled(
        emails.map(email => sendEmail(email))
    );

    return results.map((result, index) => ({
        to: emails[index].to,
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason : undefined,
    }));
}
`;

const NODEMAILER_SERVICE_TEMPLATE = `import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter;

export function initializeEmailService() {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
    }>;
}

export async function sendEmail(options: SendEmailOptions) {
    if (!transporter) {
        initializeEmailService();
    }

    try {
        const info = await transporter.sendMail({
            from: '{{fromName}} <{{fromEmail}}>',
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            cc: options.cc,
            bcc: options.bcc,
            replyTo: options.replyTo,
            attachments: options.attachments,
        });

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email send error:', error);
        throw error;
    }
}

export async function verifyConnection() {
    if (!transporter) {
        initializeEmailService();
    }
    return transporter.verify();
}
`;

const EMAIL_QUEUE_TEMPLATE = `import { Queue, Worker } from 'bullmq';
import { sendEmail, type SendEmailOptions } from './email-service.js';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Email Queue
export const emailQueue = new Queue<SendEmailOptions>('email-queue', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

// Email Worker
export const emailWorker = new Worker<SendEmailOptions>(
    'email-queue',
    async (job) => {
        console.log(\`Processing email job \${job.id} to \${job.data.to}\`);
        
        try {
            const result = await sendEmail(job.data);
            console.log(\`Email sent successfully: \${result.messageId}\`);
            return result;
        } catch (error) {
            console.error(\`Email job \${job.id} failed:\`, error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 5,
    }
);

emailWorker.on('completed', (job) => {
    console.log(\`Email job \${job.id} completed\`);
});

emailWorker.on('failed', (job, err) => {
    console.error(\`Email job \${job?.id} failed:\`, err.message);
});

// Queue email for sending
export async function queueEmail(options: SendEmailOptions, delay?: number) {
    const job = await emailQueue.add('send-email', options, {
        delay,
    });
    return { jobId: job.id };
}

// Queue batch emails
export async function queueBatchEmails(emails: SendEmailOptions[]) {
    const jobs = await emailQueue.addBulk(
        emails.map(email => ({
            name: 'send-email',
            data: email,
        }))
    );
    return jobs.map(job => ({ jobId: job.id }));
}
`;

const WELCOME_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{appName}}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { background: white; padding: 40px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome, {{userName}}! 🎉</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}},</p>
            <p>Thank you for joining {{appName}}! We're excited to have you on board.</p>
            <p>Here's what you can do next:</p>
            <ul>
                <li>Complete your profile</li>
                <li>Explore our features</li>
                <li>Connect with other users</li>
            </ul>
            <center>
                <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
            </center>
            <p>If you have any questions, feel free to reply to this email.</p>
            <p>Best regards,<br>The {{appName}} Team</p>
        </div>
        <div class="footer">
            <p>© {{year}} {{appName}}. All rights reserved.</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>`;

const PASSWORD_RESET_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a2e; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: white; padding: 40px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #e94560; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
            <p>Hi {{userName}},</p>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>
            <center>
                <a href="{{resetUrl}}" class="button">Reset Password</a>
            </center>
            <div class="warning">
                <strong>⚠️ Security Notice:</strong> This link will expire in {{expiryHours}} hours. If you didn't request this, please ignore this email.
            </div>
            <p>For security, this request was received from:</p>
            <ul>
                <li>IP Address: {{ipAddress}}</li>
                <li>Time: {{requestTime}}</li>
            </ul>
        </div>
        <div class="footer">
            <p>© {{year}} {{appName}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

const NOTIFICATION_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{subject}}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .button { display: inline-block; background: #4CAF50; color: white; padding: 10px 25px; text-decoration: none; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="icon">{{icon}}</div>
            <h2>{{title}}</h2>
            <p>{{message}}</p>
            {{#if actionUrl}}
            <a href="{{actionUrl}}" class="button">{{actionText}}</a>
            {{/if}}
        </div>
    </div>
</body>
</html>`;

// ============================================
// EMAIL AGENT CLASS
// ============================================

export class EmailAgent {
    private config: EmailAgentConfig;

    constructor(config?: Partial<EmailAgentConfig>) {
        this.config = {
            provider: config?.provider || 'resend',
            fromEmail: config?.fromEmail || 'noreply@example.com',
            fromName: config?.fromName || 'App',
            replyTo: config?.replyTo,
            templateFormat: config?.templateFormat || 'html',
            queueEnabled: config?.queueEnabled ?? true,
            trackingEnabled: config?.trackingEnabled ?? true,
        };
    }

    /**
     * Analyze requirements and determine email templates needed
     */
    async analyzeRequirements(userRequest: string): Promise<EmailTemplate[]> {
        const templates: EmailTemplate[] = [];
        const request = userRequest.toLowerCase();

        const templatePatterns = [
            {
                pattern: /welcome|signup|register|onboard/i,
                template: this.createWelcomeTemplate(),
            },
            {
                pattern: /password|reset|forgot/i,
                template: this.createPasswordResetTemplate(),
            },
            {
                pattern: /verify|confirm|email\s*verification/i,
                template: this.createVerificationTemplate(),
            },
            {
                pattern: /invoice|receipt|payment|order/i,
                template: this.createInvoiceTemplate(),
            },
            {
                pattern: /notification|alert|notify/i,
                template: this.createNotificationTemplate(),
            },
            {
                pattern: /digest|summary|weekly|daily/i,
                template: this.createDigestTemplate(),
            },
            {
                pattern: /invite|invitation/i,
                template: this.createInviteTemplate(),
            },
        ];

        for (const { pattern, template } of templatePatterns) {
            if (pattern.test(request)) {
                templates.push(template);
            }
        }

        // Default to welcome template if nothing specific found
        if (templates.length === 0) {
            templates.push(this.createWelcomeTemplate());
            templates.push(this.createPasswordResetTemplate());
        }

        return templates;
    }

    private createWelcomeTemplate(): EmailTemplate {
        return {
            id: 'welcome',
            name: 'Welcome Email',
            subject: 'Welcome to {{appName}}!',
            type: 'transactional',
            variables: [
                { name: 'userName', type: 'string', required: true, description: 'User name' },
                { name: 'appName', type: 'string', required: true, description: 'Application name' },
                { name: 'dashboardUrl', type: 'string', required: true, description: 'Dashboard URL' },
            ],
            htmlContent: WELCOME_EMAIL_TEMPLATE,
        };
    }

    private createPasswordResetTemplate(): EmailTemplate {
        return {
            id: 'password-reset',
            name: 'Password Reset',
            subject: 'Reset your password',
            type: 'transactional',
            variables: [
                { name: 'userName', type: 'string', required: true },
                { name: 'resetUrl', type: 'string', required: true },
                { name: 'expiryHours', type: 'number', required: false, default: 24 },
            ],
            htmlContent: PASSWORD_RESET_TEMPLATE,
        };
    }

    private createVerificationTemplate(): EmailTemplate {
        return {
            id: 'email-verification',
            name: 'Email Verification',
            subject: 'Verify your email address',
            type: 'transactional',
            variables: [
                { name: 'userName', type: 'string', required: true },
                { name: 'verifyUrl', type: 'string', required: true },
                { name: 'code', type: 'string', required: false },
            ],
        };
    }

    private createInvoiceTemplate(): EmailTemplate {
        return {
            id: 'invoice',
            name: 'Invoice Email',
            subject: 'Invoice #{{invoiceNumber}}',
            type: 'transactional',
            variables: [
                { name: 'invoiceNumber', type: 'string', required: true },
                { name: 'amount', type: 'number', required: true },
                { name: 'currency', type: 'string', required: false, default: 'USD' },
                { name: 'items', type: 'array', required: true },
                { name: 'dueDate', type: 'string', required: true },
            ],
        };
    }

    private createNotificationTemplate(): EmailTemplate {
        return {
            id: 'notification',
            name: 'Notification Email',
            subject: '{{subject}}',
            type: 'notification',
            variables: [
                { name: 'title', type: 'string', required: true },
                { name: 'message', type: 'string', required: true },
                { name: 'actionUrl', type: 'string', required: false },
                { name: 'actionText', type: 'string', required: false },
            ],
            htmlContent: NOTIFICATION_TEMPLATE,
        };
    }

    private createDigestTemplate(): EmailTemplate {
        return {
            id: 'digest',
            name: 'Digest Email',
            subject: 'Your {{period}} digest',
            type: 'digest',
            variables: [
                { name: 'period', type: 'string', required: true },
                { name: 'items', type: 'array', required: true },
                { name: 'summary', type: 'object', required: false },
            ],
        };
    }

    private createInviteTemplate(): EmailTemplate {
        return {
            id: 'invite',
            name: 'Invitation Email',
            subject: "{{inviterName}} invited you to {{appName}}",
            type: 'transactional',
            variables: [
                { name: 'inviterName', type: 'string', required: true },
                { name: 'appName', type: 'string', required: true },
                { name: 'inviteUrl', type: 'string', required: true },
                { name: 'message', type: 'string', required: false },
            ],
        };
    }

    /**
     * Generate email service file
     */
    generateEmailService(): string {
        switch (this.config.provider) {
            case 'resend':
                return RESEND_SERVICE_TEMPLATE
                    .replace(/\{\{fromName\}\}/g, this.config.fromName)
                    .replace(/\{\{fromEmail\}\}/g, this.config.fromEmail);
            case 'nodemailer':
                return NODEMAILER_SERVICE_TEMPLATE
                    .replace(/\{\{fromName\}\}/g, this.config.fromName)
                    .replace(/\{\{fromEmail\}\}/g, this.config.fromEmail);
            default:
                return RESEND_SERVICE_TEMPLATE
                    .replace(/\{\{fromName\}\}/g, this.config.fromName)
                    .replace(/\{\{fromEmail\}\}/g, this.config.fromEmail);
        }
    }

    /**
     * Generate email queue integration
     */
    generateEmailQueue(): string {
        return EMAIL_QUEUE_TEMPLATE;
    }

    /**
     * Generate email template file
     */
    generateTemplateFile(template: EmailTemplate): string {
        let code = `/**\n * ${template.name} Email Template\n * Type: ${template.type}\n */\n\n`;

        // Generate interface for template variables
        code += `export interface ${this.toPascalCase(template.id)}Variables {\n`;
        for (const variable of template.variables) {
            const optional = !variable.required ? '?' : '';
            code += `    ${variable.name}${optional}: ${variable.type};\n`;
        }
        code += `}\n\n`;

        // Generate template render function
        code += `export function render${this.toPascalCase(template.id)}(variables: ${this.toPascalCase(template.id)}Variables): { subject: string; html: string; text: string } {\n`;
        code += `    const subject = \`${template.subject.replace(/\{\{(\w+)\}\}/g, '${variables.$1}')}\`;\n\n`;

        if (template.htmlContent) {
            code += `    const html = \`${template.htmlContent.replace(/`/g, '\\`').replace(/\{\{(\w+)\}\}/g, '${variables.$1}')}\`;\n\n`;
        } else {
            code += `    const html = \`\n        <h1>\${variables.title || 'Notification'}</h1>\n        <p>\${variables.message || ''}</p>\n    \`;\n\n`;
        }

        code += `    const text = html.replace(/<[^>]*>/g, '').trim();\n\n`;
        code += `    return { subject, html, text };\n`;
        code += `}\n`;

        return code;
    }

    /**
     * Generate types file
     */
    generateTypesFile(): string {
        return `/**
 * Email Types
 */

export type EmailProvider = 'resend' | 'nodemailer' | 'sendgrid' | 'ses' | 'mailgun';
export type EmailType = 'transactional' | 'marketing' | 'notification' | 'digest';

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: EmailAttachment[];
    tags?: string[];
    metadata?: Record<string, string>;
}

export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface EmailTemplate<T = Record<string, unknown>> {
    id: string;
    name: string;
    subject: string;
    render: (variables: T) => { subject: string; html: string; text: string };
}
`;
    }

    /**
     * Generate all email files
     */
    async generate(userRequest: string): Promise<EmailGenerationResult> {
        const templates = await this.analyzeRequirements(userRequest);
        const files: EmailGeneratedFile[] = [];

        // Generate email service
        files.push({
            path: 'src/services/email/email-service.ts',
            content: this.generateEmailService(),
            type: 'service',
        });

        // Generate types
        files.push({
            path: 'src/services/email/types.ts',
            content: this.generateTypesFile(),
            type: 'types',
        });

        // Generate queue if enabled
        if (this.config.queueEnabled) {
            files.push({
                path: 'src/services/email/email-queue.ts',
                content: this.generateEmailQueue(),
                type: 'queue',
            });
        }

        // Generate templates
        for (const template of templates) {
            files.push({
                path: `src/services/email/templates/${template.id}.ts`,
                content: this.generateTemplateFile(template),
                type: 'template',
            });
        }

        // Generate index file
        files.push({
            path: 'src/services/email/index.ts',
            content: this.generateIndexFile(templates),
            type: 'service',
        });

        return {
            success: true,
            files,
            templates: templates.map(t => t.id),
            provider: this.config.provider,
        };
    }

    private generateIndexFile(templates: EmailTemplate[]): string {
        let code = `/**\n * Email Service Exports\n */\n\n`;
        code += `export * from './email-service.js';\n`;
        code += `export * from './types.js';\n`;

        if (this.config.queueEnabled) {
            code += `export * from './email-queue.js';\n`;
        }

        code += `\n// Templates\n`;
        for (const template of templates) {
            code += `export * from './templates/${template.id}.js';\n`;
        }

        return code;
    }

    private toPascalCase(str: string): string {
        return str
            .split(/[-_\s]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }
}

// ============================================
// SINGLETON
// ============================================

let emailAgent: EmailAgent | null = null;

export function getEmailAgent(): EmailAgent {
    if (!emailAgent) {
        emailAgent = new EmailAgent();
    }
    return emailAgent;
}

export const emailAgentInstance = getEmailAgent();
export default emailAgentInstance;
