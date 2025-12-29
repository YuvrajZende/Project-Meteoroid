/**
 * Sentry Adapter
 * Phase 21: Service Integration Framework
 */

import { BaseAdapter } from '../base-adapter.js';
import { AdapterTestResult, AdapterCodeGenerationContext, CodeTemplate } from '../../../service-registry/types.js';
import { sentryService } from '../../../service-registry/services/sentry.js';

export class SentryAdapter extends BaseAdapter {
    constructor() {
        super('sentry');
    }

    async test(credentials: Record<string, string>): Promise<AdapterTestResult> {
        const startTime = Date.now();

        try {
            // Validate DSN format
            const dsn = credentials.dsn;
            if (!dsn || !dsn.startsWith('https://')) {
                return {
                    success: false,
                    message: 'Invalid DSN format. Must start with https://',
                    latencyMs: Date.now() - startTime
                };
            }

            // Parse DSN to extract components
            const dsnRegex = /^https:\/\/([a-f0-9]+)@([a-z0-9.]+)\/(\d+)$/;
            const match = dsn.match(dsnRegex);

            if (!match) {
                return {
                    success: false,
                    message: 'Invalid DSN format. Expected: https://key@host/project',
                    latencyMs: Date.now() - startTime
                };
            }

            // Try to ping Sentry API (if auth token provided)
            if (credentials.authToken && credentials.org && credentials.project) {
                const response = await fetch(
                    `https://sentry.io/api/0/projects/${credentials.org}/${credentials.project}/`,
                    {
                        headers: {
                            'Authorization': `Bearer ${credentials.authToken}`
                        }
                    }
                );

                if (!response.ok) {
                    return {
                        success: false,
                        message: `API check failed: ${response.status} ${response.statusText}`,
                        latencyMs: Date.now() - startTime
                    };
                }
            }

            return {
                success: true,
                message: 'Sentry DSN is valid',
                latencyMs: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                message: `Validation error: ${(error as Error).message}`,
                latencyMs: Date.now() - startTime
            };
        }
    }

    generateCodeTemplate(operation: string, _context: AdapterCodeGenerationContext): string {
        const templates = this.getCodeTemplates();
        const template = templates[operation];

        if (!template) {
            return `// No template available for operation: ${operation}`;
        }

        return template.code;
    }

    getCodeTemplates(): Record<string, CodeTemplate> {
        return sentryService.codeTemplates;
    }

    getAgentInstructions(): string {
        return sentryService.agentInstructions;
    }

    getEnvVarNames(): string[] {
        return ['SENTRY_DSN'];
    }
}

export { SentryAdapter as default };
