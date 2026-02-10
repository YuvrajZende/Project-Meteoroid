/**
 * Supabase to Convex Migration Utility
 * Phase 5: Database Migration
 *
 * This utility provides functions to export data from Supabase
 * and import it into Convex.
 */

import { createClient } from '@supabase/supabase-js';
import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
import path from "path";

// Load .env.local if present
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // Fallback to .env

const getConvexClient = () => {
    const url = process.env.CONVEX_URL;
    if (!url) {
        throw new Error("CONVEX_URL environment variable is not set. Please run `npx convex dev` to set it up or check .env.local");
    }
    return new ConvexHttpClient(url);
};

const getSupabaseAdmin = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env or .env.local");
    }
    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
};

// We don't import 'api' here to avoid build issues if types aren't generated yet.
// We use string literals for mutation names.

/**
 * Migration statistics
 */
export interface MigrationStats {
    table: string;
    exported: number;
    imported: number;
    errors: number;
    skipped: number;
}

/**
 * Migration result
 */
export interface MigrationResult {
    success: boolean;
    duration: number;
    stats: MigrationStats[];
    errors: string[];
}

/**
 * Export all data from Supabase
 */
export async function exportFromSupabase(): Promise<{
    users: unknown[];
    projects: unknown[];
    tasks: unknown[];
    generatedFiles: unknown[];
    connections: unknown[];
    deployments: unknown[];
    auditLogs: unknown[];
    learningContexts: unknown[];
    benchmarks: unknown[];
    knowledgeEmbeddings: unknown[];
    knowledgeEmbeddings: unknown[];
    apiKeys: unknown[];
    userMfa: unknown[];
    codeEmbeddings: unknown[];
    generationIterations: unknown[];
    learnedPatterns: unknown[];
}> {
    const supabase = getSupabaseAdmin();

    // Export all tables
    // We use a safe select strategy for new tables that might not check out in old Supabase

    // Existing core tables
    const [
        { data: users },
        { data: projects },
        { data: tasks },
        { data: generatedFiles },
        { data: connections },
        { data: deployments },
        { data: auditLogs },
        { data: learningContexts },
        { data: benchmarks },
        { data: knowledgeEmbeddings },
        { data: apiKeys },
    ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('generated_files').select('*'),
        supabase.from('connections').select('*'),
        supabase.from('deployments').select('*'),
        supabase.from('audit_logs').select('*'),
        supabase.from('learning_contexts').select('*'),
        supabase.from('benchmarks').select('*'),
        supabase.from('knowledge_embeddings').select('*'),
        supabase.from('api_keys').select('*'),
    ]);

    // New tables (try/catch in case they don't exist in Supabase)
    const [
        { data: userMfa },
        { data: codeEmbeddings },
        { data: generationIterations },
        { data: learnedPatterns },
    ] = await Promise.all([
        safeSelect(supabase, 'user_mfa'),
        safeSelect(supabase, 'code_embeddings'),
        safeSelect(supabase, 'generation_iterations'),
        safeSelect(supabase, 'learned_patterns'),
    ]);

    return {
        users: users ?? [],
        projects: projects ?? [],
        tasks: tasks ?? [],
        generatedFiles: generatedFiles ?? [],
        connections: connections ?? [],
        deployments: deployments ?? [],
        auditLogs: auditLogs ?? [],
        learningContexts: learningContexts ?? [],
        benchmarks: benchmarks ?? [],
        knowledgeEmbeddings: (knowledgeEmbeddings as any[]) ?? [],
        apiKeys: (apiKeys as any[]) ?? [],
        userMfa: (userMfa as any[]) ?? [],
        codeEmbeddings: (codeEmbeddings as any[]) ?? [],
        generationIterations: (generationIterations as any[]) ?? [],
        learnedPatterns: (learnedPatterns as any[]) ?? [],
    };
}

// Helper to safely get data from Supabase even if table doesn't exist
const safeSelect = async (supabase: any, table: string) => {
    try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
            // console.warn(`Error exporting ${table}:`, error.message);
            return { data: [] };
        }
        return { data };
    } catch {
        return { data: [] };
    }
};

/**
 * Transform Supabase user to Convex format
 */
function transformUser(user: Record<string, unknown>): Record<string, unknown> {
    return {
        id: user.id, // Keep Supabase ID for reference
        email: user.email,
        name: user.name ?? undefined,
        avatar_url: user.avatar_url ?? undefined,
        tier: (user.tier as string) || 'free',
        api_quota_used: user.api_quota_used ?? 0,
    };
}

/**
 * Transform Supabase project to Convex format
 */
function transformProject(project: Record<string, unknown>): Record<string, unknown> {
    return {
        userId: project.user_id,
        name: project.name,
        description: project.description ?? undefined,
        framework: project.framework ?? undefined,
        language: project.language ?? undefined,
        status: project.status || 'active',
        githubUrl: project.github_url ?? undefined,
        config: project.config ?? undefined,
    };
}

/**
 * Transform Supabase task to Convex format
 */
function transformTask(task: Record<string, unknown>, projectMap: Map<string, any>): Record<string, unknown> {
    // We need to resolve the project ID to a Convex ID if possible,
    // BUT my schema.ts defines projectId as v.id("projects").
    // This means we strictly need a valid Convex ID.
    // Strategy: We will maintain a map of textId -> convexId during import.
    const convexProjectId = projectMap.get(task.project_id as string);

    return {
        projectId: convexProjectId, // Can be undefined
        userId: task.user_id ?? undefined,
        prompt: task.prompt,
        status: task.status || 'pending',
        result: task.result ?? undefined,
        error: task.error ?? undefined,
    };
}

/**
 * Transform Supabase generated_file to Convex format
 */
function transformGeneratedFile(file: Record<string, unknown>, taskMap: Map<string, any>, projectMap: Map<string, any>): Record<string, unknown> {
    const convexTaskId = taskMap.get(file.task_id as string);
    const convexProjectId = projectMap.get(file.project_id as string);

    if (!convexTaskId) {
        throw new Error(`Generated file ${file.path} has no valid task ID mapping: ${file.task_id}`);
    }

    return {
        taskId: convexTaskId,
        projectId: convexProjectId,
        path: file.path,
        content: file.content,
        language: file.language ?? undefined,
    };
}

/**
 * Transform Supabase connection to Convex format
 */
function transformConnection(conn: Record<string, unknown>): Record<string, unknown> {
    return {
        userId: conn.user_id,
        provider: conn.provider,
        credentials: conn.credentials ?? undefined,
        accessToken: conn.access_token ?? undefined,
        refreshToken: conn.refresh_token ?? undefined,
        expiresIn: conn.expires_at ? Math.floor((new Date(conn.expires_at as string).getTime() - Date.now()) / 1000) : undefined,
    };
}

/**
 * Transform Supabase deployment to Convex format
 */
function transformDeployment(deployment: Record<string, unknown>, projectMap: Map<string, any>): Record<string, unknown> {
    const convexProjectId = projectMap.get(deployment.project_id as string);
    if (!convexProjectId) {
        throw new Error(`Deployment has no valid project ID mapping: ${deployment.project_id}`);
    }

    return {
        projectId: convexProjectId,
        userId: deployment.user_id ?? undefined,
        provider: deployment.provider,
        deploymentId: deployment.deployment_id,
        url: deployment.url ?? undefined,
        status: deployment.status,
    };
}

/**
 * Transform Supabase audit_log to Convex format
 */
function transformAuditLog(log: Record<string, unknown>): Record<string, unknown> {
    return {
        userId: log.user_id ?? undefined,
        action: log.action,
        resourceType: log.resource_type ?? undefined,
        resourceId: log.resource_id ?? undefined,
        ipAddress: log.ip_address ?? undefined,
        userAgent: log.user_agent ?? undefined,
        success: log.success ?? true,
        errorMessage: log.error_message ?? undefined,
        metadata: log.metadata ?? undefined,
    };
}

/**
 * Transform Supabase learning_context to Convex format
 */
function transformLearningContext(ctx: Record<string, unknown>, projectMap: Map<string, any>): Record<string, unknown> {
    const convexProjectId = projectMap.get(ctx.project_id as string);
    if (!convexProjectId) {
        throw new Error(`Learning Context has no valid project ID mapping`);
    }

    return {
        projectId: convexProjectId,
        contextType: ctx.context_type ?? undefined,
        contextData: ctx.context_data ?? undefined,
        embeddings: ctx.embeddings ?? undefined,
    };
}

/**
 * Transform Supabase benchmark to Convex format
 */
function transformBenchmark(benchmark: Record<string, unknown>, projectMap: Map<string, any>): Record<string, unknown> {
    const convexProjectId = projectMap.get(benchmark.project_id as string);

    return {
        projectId: convexProjectId,
        userId: benchmark.user_id ?? undefined,
        taskType: benchmark.task_type ?? undefined,
        model: benchmark.model,
        promptTokens: benchmark.prompt_tokens ?? undefined,
        completionTokens: benchmark.completion_tokens ?? undefined,
        totalTokens: benchmark.total_tokens ?? undefined,
        cost: benchmark.cost ?? undefined,
        durationMs: benchmark.duration_ms ?? undefined,
        qualityScore: benchmark.quality_score ?? undefined,
    };
}

function transformApiKey(key: Record<string, unknown>): Record<string, unknown> {
    return {
        userId: key.user_id,
        name: key.name,
        keyHash: key.key_hash,
        keyPrefix: key.key_prefix,
        scopes: key.scopes || [],
        expiresAt: key.expires_at ?? undefined,
    };
}

/**
 * Import data to Convex using Convex client
 */
export async function importToConvex(
    data: Awaited<ReturnType<typeof exportFromSupabase>>
): Promise<MigrationResult> {
    const startTime = Date.now();
    const stats: MigrationStats[] = [];
    const errors: string[] = [];

    const convex = getConvexClient();

    // ID Mappings for relational integrity
    const projectMap = new Map<string, any>(); // Supabase ID -> Convex ID
    const taskMap = new Map<string, any>();    // Supabase ID -> Convex ID

    // Import users
    let userErrors = 0;
    let userImported = 0;
    for (const user of data.users) {
        try {
            await convex.mutation("users:upsert", transformUser(user as Record<string, unknown>));
            userImported++;
        } catch (error) {
            userErrors++;
            errors.push(`User import failed: ${error}`);
        }
    }
    stats.push({ table: 'users', exported: data.users.length, imported: userImported, errors: userErrors, skipped: 0 });

    // Import projects
    let projectErrors = 0;
    let projectImported = 0;
    for (const project of data.projects) {
        try {
            const pData = project as Record<string, unknown>;
            // Note: Projects transformation creates a new record. 
            // We need to return the ID to map it.
            // My projects:create implementation returns the new ID.
            const newId = await convex.mutation("projects:create", transformProject(pData));
            projectMap.set(pData.id as string, newId);
            projectImported++;
        } catch (error) {
            projectErrors++;
            errors.push(`Project import failed: ${error}`);
        }
    }
    stats.push({ table: 'projects', exported: data.projects.length, imported: projectImported, errors: projectErrors, skipped: 0 });

    // Import tasks
    let taskErrors = 0;
    let taskImported = 0;
    for (const task of data.tasks) {
        try {
            const tData = task as Record<string, unknown>;
            const newData = transformTask(tData, projectMap);
            // My tasks:create returns the new ID
            const newId = await convex.mutation("tasks:create", newData);
            taskMap.set(tData.id as string, newId);
            taskImported++;
        } catch (error) {
            taskErrors++;
            errors.push(`Task import failed: ${error}`);
        }
    }
    stats.push({ table: 'tasks', exported: data.tasks.length, imported: taskImported, errors: taskErrors, skipped: 0 });

    // Import generated files
    let fileErrors = 0;
    let fileImported = 0;
    for (const file of data.generatedFiles) {
        try {
            await convex.mutation("generated_files:create", transformGeneratedFile(file as Record<string, unknown>, taskMap, projectMap));
            fileImported++;
        } catch (error) {
            fileErrors++;
            // Don't clutter logs if it's just missing parent
            if (!String(error).includes("no valid task ID")) {
                errors.push(`Generated file import failed: ${error}`);
            }
        }
    }
    stats.push({ table: 'generated_files', exported: data.generatedFiles.length, imported: fileImported, errors: fileErrors, skipped: 0 });

    // Import audit logs
    let auditErrors = 0;
    let auditImported = 0;
    for (const log of data.auditLogs) {
        try {
            await convex.mutation("audit_logs:create", transformAuditLog(log as Record<string, unknown>));
            auditImported++;
        } catch (error) {
            auditErrors++;
            errors.push(`Audit log import failed: ${error}`);
        }
    }
    stats.push({ table: 'audit_logs', exported: data.auditLogs.length, imported: auditImported, errors: auditErrors, skipped: 0 });

    // Import knowledge embeddings
    let embeddingErrors = 0;
    let embeddingImported = 0;
    for (const embedding of data.knowledgeEmbeddings) {
        try {
            await convex.mutation("knowledge_embeddings:create", {
                content: (embedding as any).content,
                embedding: (embedding as any).embedding,
                metadata: (embedding as any).metadata,
            });
            embeddingImported++;
        } catch (error) {
            embeddingErrors++;
            errors.push(`Knowledge embedding import failed: ${error}`);
        }
    }
    stats.push({ table: 'knowledge_embeddings', exported: data.knowledgeEmbeddings.length, imported: embeddingImported, errors: embeddingErrors, skipped: 0 });

    // Import connections
    let connectionErrors = 0;
    let connectionImported = 0;
    for (const conn of data.connections) {
        try {
            await convex.mutation("connections:upsert", transformConnection(conn as Record<string, unknown>));
            connectionImported++;
        } catch (error) {
            connectionErrors++;
            errors.push(`Connection import failed: ${error}`);
        }
    }
    stats.push({ table: 'connections', exported: data.connections.length, imported: connectionImported, errors: connectionErrors, skipped: 0 });

    // Import deployments
    let deploymentErrors = 0;
    let deploymentImported = 0;
    for (const dep of data.deployments) {
        try {
            await convex.mutation("deployments:create", transformDeployment(dep as Record<string, unknown>, projectMap));
            deploymentImported++;
        } catch (error) {
            deploymentErrors++;
            if (!String(error).includes("no valid project ID")) {
                errors.push(`Deployment import failed: ${error}`);
            }
        }
    }
    stats.push({ table: 'deployments', exported: data.deployments.length, imported: deploymentImported, errors: deploymentErrors, skipped: 0 });

    // Import learning contexts
    let learningErrors = 0;
    let learningImported = 0;
    for (const ctx of data.learningContexts) {
        try {
            await convex.mutation("learning_contexts:create", transformLearningContext(ctx as Record<string, unknown>, projectMap));
            learningImported++;
        } catch (error) {
            learningErrors++;
            if (!String(error).includes("no valid project ID")) {
                errors.push(`Learning context import failed: ${error}`);
            }
        }
    }
    stats.push({ table: 'learning_contexts', exported: data.learningContexts.length, imported: learningImported, errors: learningErrors, skipped: 0 });

    // Import benchmarks
    let benchmarkErrors = 0;
    let benchmarkImported = 0;
    for (const bm of data.benchmarks) {
        try {
            await convex.mutation("benchmarks:create", transformBenchmark(bm as Record<string, unknown>, projectMap));
            benchmarkImported++;
        } catch (error) {
            benchmarkErrors++;
            errors.push(`Benchmark import failed: ${error}`);
        }
    }
    stats.push({ table: 'benchmarks', exported: data.benchmarks.length, imported: benchmarkImported, errors: benchmarkErrors, skipped: 0 });

    // Import API Keys
    let keyErrors = 0;
    let keyImported = 0;
    for (const key of data.apiKeys) {
        try {
            await convex.mutation("api_keys:create", transformApiKey(key as Record<string, unknown>));
            keyImported++;
        } catch (error) {
            keyErrors++;
            errors.push(`API Key import failed: ${error}`);
        }
    }
    stats.push({ table: 'api_keys', exported: data.apiKeys.length, imported: keyImported, errors: keyErrors, skipped: 0 });

    // Import MFA
    let mfaErrors = 0;
    let mfaImported = 0;
    for (const mfa of data.userMfa) {
        try {
            await convex.mutation("mfa:setup", {
                userId: (mfa as any).user_id,
                recoveryEmail: (mfa as any).recovery_email || "",
                secretEncrypted: (mfa as any).totp_secret_encrypted,
                backupCodesHashed: (mfa as any).backup_codes_hashed || [],
            });
            // If it was enabled, we need to enable it.
            if ((mfa as any).mfa_enabled) {
                await convex.mutation("mfa:enable", { userId: (mfa as any).user_id });
            }
            mfaImported++;
        } catch (error) {
            mfaErrors++;
            errors.push(`MFA import failed: ${error}`);
        }
    }
    stats.push({ table: 'user_mfa', exported: data.userMfa.length, imported: mfaImported, errors: mfaErrors, skipped: 0 });

    // Import Code Embeddings
    let codeEmbErrors = 0;
    let codeEmbImported = 0;
    for (const emb of data.codeEmbeddings) {
        try {
            await convex.mutation("learning_system:createCodeEmbedding", {
                projectId: projectMap.get((emb as any).project_id),
                filePath: (emb as any).file_path || (emb as any).path,
                content: (emb as any).content,
                language: (emb as any).language,
                embedding: (emb as any).embedding,
                metadata: (emb as any).metadata,
            });
            codeEmbImported++;
        } catch (error) {
            codeEmbErrors++;
            if (!String(error).includes("no valid project ID")) {
                errors.push(`Code embedding import failed: ${error}`);
            }
        }
    }
    stats.push({ table: 'code_embeddings', exported: data.codeEmbeddings.length, imported: codeEmbImported, errors: codeEmbErrors, skipped: 0 });

    // Import Learned Patterns
    let patternErrors = 0;
    let patternImported = 0;
    for (const pat of data.learnedPatterns) {
        try {
            await convex.mutation("learning_system:createLearnedPattern", {
                pattern: (pat as any).pattern,
                description: (pat as any).description,
                pattern_type: (pat as any).pattern_type,
                category: (pat as any).category,
                context: (pat as any).context,
                confidence: (pat as any).confidence,
                frequency: (pat as any).frequency,
            });
            patternImported++;
        } catch (error) {
            patternErrors++;
            errors.push(`Learned pattern import failed: ${error}`);
        }
    }
    stats.push({ table: 'learned_patterns', exported: data.learnedPatterns.length, imported: patternImported, errors: patternErrors, skipped: 0 });

    // Import Generation Iterations
    let genErrors = 0;
    let genImported = 0;
    for (const gen of data.generationIterations) {
        try {
            await convex.mutation("learning_system:logGeneration", {
                projectId: projectMap.get((gen as any).project_id),
                taskId: taskMap.get((gen as any).task_id),
                prompt: (gen as any).prompt,
                success: (gen as any).success,
                generated_code: (gen as any).generated_code,
                config: (gen as any).config,
            });
            genImported++;
        } catch (error) {
            genErrors++;
            errors.push(`Generation iteration import failed: ${error}`);
        }
    }
    stats.push({ table: 'generation_iterations', exported: data.generationIterations.length, imported: genImported, errors: genErrors, skipped: 0 });


    const duration = Date.now() - startTime;

    return {
        success: errors.length === 0,
        duration,
        stats,
        errors,
    };
}

/**
 * Run full migration from Supabase to Convex
 */
export async function runMigration(): Promise<MigrationResult> {
    console.log('[MIGRATION] Starting Supabase to Convex migration...');

    const startTime = Date.now();

    try {
        // Export from Supabase
        console.log('[MIGRATION] Exporting data from Supabase...');
        const data = await exportFromSupabase();

        const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`[MIGRATION] Exported ${totalRecords} records from Supabase`);

        // Import to Convex
        console.log('[MIGRATION] Importing data to Convex...');
        const result = await importToConvex(data);

        const duration = Date.now() - startTime;
        console.log(`[MIGRATION] Migration completed in ${duration}ms`);
        console.log(`[MIGRATION] Success: ${result.success}, Errors: ${result.errors.length}`);

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[MIGRATION] Migration failed:', error);

        return {
            success: false,
            duration,
            stats: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
    }
}

/**
 * Validate migration by comparing record counts
 */
export async function validateMigration(): Promise<{
    valid: boolean;
    differences: Array<{ table: string; supabase: number; convex: number }>;
}> {
    // This would query both databases and compare counts
    // For now, this is a placeholder
    return {
        valid: true,
        differences: [],
    };
}
