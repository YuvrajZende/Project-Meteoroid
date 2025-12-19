/**
 * Supabase Adapter
 * Phase 21: Service Integration Framework
 */

import { BaseAdapter } from '../base-adapter.js';
import { AdapterTestResult, AdapterCodeGenerationContext, CodeTemplate } from '../../service-registry/types.js';
import { supabaseService } from '../../service-registry/services/supabase.js';

export class SupabaseAdapter extends BaseAdapter {
    constructor() {
        super('supabase');
    }

    async test(credentials: Record<string, string>): Promise<AdapterTestResult> {
        const startTime = Date.now();

        try {
            // Dynamic import to avoid bundling issues
            const { createClient } = await import('@supabase/supabase-js');
            const client = createClient(credentials.url, credentials.anonKey);

            // Try a simple query to test connection
            const { error } = await client.from('_dummy_table_for_test').select('*').limit(1);

            // 42P01 = table doesn't exist, which is fine - connection works
            if (error && error.code !== '42P01' && error.code !== 'PGRST116') {
                return {
                    success: false,
                    message: `Connection failed: ${error.message}`,
                    latencyMs: Date.now() - startTime
                };
            }

            return {
                success: true,
                message: 'Successfully connected to Supabase',
                latencyMs: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${(error as Error).message}`,
                latencyMs: Date.now() - startTime
            };
        }
    }

    generateCodeTemplate(operation: string, context: AdapterCodeGenerationContext): string {
        const templates = this.getCodeTemplates();
        const template = templates[operation];

        if (!template) {
            return `// No template available for operation: ${operation}`;
        }

        let code = template.code;

        // Replace placeholders
        if (context.tableName) {
            code = code.replace(/\{\{tableName\}\}/g, context.tableName);
        }
        if (context.columns) {
            code = code.replace(/\{\{columns\}\}/g, context.columns);
        }

        return code;
    }

    getCodeTemplates(): Record<string, CodeTemplate> {
        return supabaseService.codeTemplates;
    }

    getAgentInstructions(): string {
        return supabaseService.agentInstructions;
    }

    getEnvVarNames(): string[] {
        return ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
    }
}

export { SupabaseAdapter as default };
