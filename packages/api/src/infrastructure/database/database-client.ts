/**
 * Database Client Service
 * Provides hybrid database connection:
 * - Local PostgreSQL (via MCP) for relational data
 * - Supabase (with pgvector) for vector operations
 * 
 * PERFORMANCE FEATURES:
 * - Connection pooling via Supabase pooler
 * - Connection health monitoring
 * - Automatic reconnection on failure
 * - Query timeout configuration
 * 
 * NOTE: This module imports from supabase-client.ts to avoid circular dependencies
 */

import { getSupabaseClient as getClient, getSupabaseAdmin as getAdmin, getDbConfig, resetSupabaseClients } from './supabase-client.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HybridDatabase } from './hybrid-database.js';

let hybridDatabase: HybridDatabase | null = null;
let lastHealthCheck: Date | null = null;
let connectionHealthy: boolean = true;

export function getSupabaseClient(): SupabaseClient {
    return getClient();
}

export function getSupabaseAdmin(): SupabaseClient {
    return getAdmin();
}

export function getHybridDatabase(): HybridDatabase {
    if (!hybridDatabase) {
        const { HybridDatabase } = require('./hybrid-database.js');
        hybridDatabase = new HybridDatabase();
    }
    return hybridDatabase!;
}

export async function checkSupabaseConnection(): Promise<{
    connected: boolean;
    message: string;
    latency?: number;
    error?: string;
}> {
    try {
        const startTime = Date.now();
        const supabase = getSupabaseAdmin();

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

        let functionExists = false;
        try {
            const testEmbedding = new Array(1536).fill(0.001);
            const { error: funcError } = await supabase.rpc('match_embeddings', {
                query_embedding: testEmbedding,
                match_threshold: 0.1,
                match_count: 1,
            });

            functionExists = !funcError || funcError.code !== '42883';
        } catch {
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

export async function checkLocalConnection(): Promise<{
    connected: boolean;
    message: string;
    latency?: number;
    error?: string;
}> {
    try {
        const startTime = Date.now();
        const hybridDb = getHybridDatabase();

        const state = await hybridDb.getConnectionState();
        const latency = Date.now() - startTime;

        if (!state.local.connected) {
            return {
                connected: false,
                message: 'Local PostgreSQL connection failed',
                error: 'Could not connect to local PostgreSQL via MCP',
            };
        }

        return {
            connected: true,
            message: 'Local PostgreSQL healthy',
            latency,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
            connected: false,
            message: 'Local PostgreSQL check failed',
            error: errorMsg,
        };
    }
}

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

export async function checkDatabaseHealth(): Promise<{
    local: Awaited<ReturnType<typeof checkLocalConnection>>;
    supabase: Awaited<ReturnType<typeof checkSupabaseConnection>>;
    vectorStore: Awaited<ReturnType<typeof checkVectorStore>>;
}> {
    const [localResult, supabaseResult, vectorResult] = await Promise.allSettled([
        checkLocalConnection(),
        checkSupabaseConnection(),
        checkVectorStore(),
    ]);

    return {
        local: localResult.status === 'fulfilled'
            ? await localResult.value
            : { connected: false, message: 'Check failed', error: 'Promise rejected' },
        supabase: supabaseResult.status === 'fulfilled'
            ? await supabaseResult.value
            : { connected: false, message: 'Check failed', error: 'Promise rejected' },
        vectorStore: vectorResult.status === 'fulfilled'
            ? await vectorResult.value
            : { connected: false, message: 'Check failed', tableExists: false, functionExists: false, error: 'Promise rejected' },
    };
}

export function getConnectionStats(): {
    poolerEnabled: boolean;
    lastHealthCheck: Date | null;
    connectionHealthy: boolean;
    clientInitialized: boolean;
    adminInitialized: boolean;
} {
    const DB_CONFIG = getDbConfig();
    return {
        poolerEnabled: DB_CONFIG.pooler.enabled,
        lastHealthCheck,
        connectionHealthy,
        clientInitialized: true,
        adminInitialized: true,
    };
}

export function updateConnectionHealth(healthy: boolean): void {
    connectionHealthy = healthy;
    lastHealthCheck = new Date();
}

export function resetConnections(): void {
    resetSupabaseClients();
    hybridDatabase = null;
    connectionHealthy = true;
    lastHealthCheck = null;
    console.log('[DATABASE] Connections reset');
}

export { getDbConfig };
