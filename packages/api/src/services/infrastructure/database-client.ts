/**
 * Database Client Service
 * Provides Supabase connection and health check utilities
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton Supabase clients
let supabaseClient: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get or create the Supabase client (respects RLS)
 */
export function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
        }

        supabaseClient = createClient(url, key, {
            auth: {
                autoRefreshToken: true,
                persistSession: false,
            },
        });
    }

    return supabaseClient;
}

/**
 * Get or create the Supabase admin client (bypasses RLS)
 */
export function getSupabaseAdmin(): SupabaseClient {
    if (!supabaseAdmin) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
        }

        supabaseAdmin = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }

    return supabaseAdmin;
}

/**
 * Check Supabase database connectivity
 */
export async function checkSupabaseConnection(): Promise<{
    connected: boolean;
    message: string;
    latency?: number;
    error?: string;
}> {
    try {
        const startTime = Date.now();
        const supabase = getSupabaseAdmin();

        // Try a simple auth check (fast and reliable)
        const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

        const latency = Date.now() - startTime;

        if (error) {
            return {
                connected: false,
                message: 'Supabase connection failed',
                error: error.message,
            };
        }

        return {
            connected: true,
            message: `Supabase healthy (${data.users.length} users)`,
            latency,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
            connected: false,
            message: 'Supabase connection failed',
            error: errorMsg,
        };
    }
}

/**
 * Check Vector Store (pgvector) connectivity and function availability
 */
export async function checkVectorStore(): Promise<{
    connected: boolean;
    message: string;
    tableExists: boolean;
    functionExists: boolean;
    embeddingsCount?: number;
    latency?: number;
    error?: string;
}> {
    try {
        const startTime = Date.now();
        const supabase = getSupabaseAdmin();

        // Check if knowledge_embeddings table exists
        const { count: tableCount, error: tableError } = await supabase
            .from('knowledge_embeddings')
            .select('*', { count: 'exact', head: true });

        const tableExists = !tableError || tableError.code !== '42P01';

        if (tableError && tableError.code === '42P01') {
            return {
                connected: false,
                message: 'Vector store table does not exist',
                tableExists: false,
                functionExists: false,
                error: 'knowledge_embeddings table not found',
            };
        }

        // Check if match_embeddings function exists
        let functionExists = false;
        try {
            const testEmbedding = new Array(1536).fill(0.001);
            const { error: funcError } = await supabase.rpc('match_embeddings', {
                query_embedding: testEmbedding,
                match_threshold: 0.1,
                match_count: 1,
            });

            functionExists = !funcError || funcError.code !== '42883';
        } catch (err) {
            functionExists = false;
        }

        const latency = Date.now() - startTime;

        if (!tableExists || !functionExists) {
            return {
                connected: tableExists && functionExists,
                message: `Vector store ${!tableExists ? 'table missing' : 'function missing'}`,
                tableExists,
                functionExists,
                latency,
            };
        }

        return {
            connected: true,
            message: `Vector store healthy (${tableCount ?? 0} embeddings)`,
            tableExists,
            functionExists,
            embeddingsCount: tableCount ?? 0,
            latency,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
            connected: false,
            message: 'Vector store check failed',
            tableExists: false,
            functionExists: false,
            error: errorMsg,
        };
    }
}

/**
 * Test database operations with a full CRUD cycle
 */
export async function testDatabaseOperations(): Promise<{
    success: boolean;
    operations: {
        insert: boolean;
        select: boolean;
        update: boolean;
        delete: boolean;
    };
    details: string[];
    error?: string;
}> {
    const details: string[] = [];
    const operations = {
        insert: false,
        select: false,
        update: false,
        delete: false,
    };

    try {
        const supabase = getSupabaseAdmin();
        const testId = `test-${Date.now()}`;

        // Test INSERT
        details.push('[1/4] Testing INSERT operation...');
        const { data: insertData, error: insertError } = await supabase
            .from('knowledge_embeddings')
            .insert({
                content: `Test embedding created at ${new Date().toISOString()}`,
                embedding: new Array(1536).fill(0.001),
                metadata: { test: true, id: testId },
            })
            .select()
            .single();

        if (insertError) {
            details.push(`❌ INSERT failed: ${insertError.message}`);
            throw insertError;
        }

        operations.insert = true;
        details.push(`✅ INSERT successful (ID: ${insertData.id})`);

        // Test SELECT
        details.push('[2/4] Testing SELECT operation...');
        const { data: selectData, error: selectError } = await supabase
            .from('knowledge_embeddings')
            .select('*')
            .eq('id', insertData.id)
            .single();

        if (selectError) {
            details.push(`❌ SELECT failed: ${selectError.message}`);
            throw selectError;
        }

        operations.select = true;
        details.push(`✅ SELECT successful (Content: "${selectData.content.substring(0, 30)}...")`);

        // Test UPDATE
        details.push('[3/4] Testing UPDATE operation...');
        const { error: updateError } = await supabase
            .from('knowledge_embeddings')
            .update({
                metadata: { test: true, id: testId, updated: true },
            })
            .eq('id', insertData.id);

        if (updateError) {
            details.push(`❌ UPDATE failed: ${updateError.message}`);
            throw updateError;
        }

        operations.update = true;
        details.push(`✅ UPDATE successful (Metadata updated)`);

        // Test DELETE
        details.push('[4/4] Testing DELETE operation...');
        const { error: deleteError } = await supabase
            .from('knowledge_embeddings')
            .delete()
            .eq('id', insertData.id);

        if (deleteError) {
            details.push(`❌ DELETE failed: ${deleteError.message}`);
            throw deleteError;
        }

        operations.delete = true;
        details.push(`✅ DELETE successful (Test data cleaned up)`);

        details.push('');
        details.push('🎉 All database operations completed successfully!');

        return {
            success: true,
            operations,
            details,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        details.push('');
        details.push(`❌ Database test failed: ${errorMsg}`);

        return {
            success: false,
            operations,
            details,
            error: errorMsg,
        };
    }
}
