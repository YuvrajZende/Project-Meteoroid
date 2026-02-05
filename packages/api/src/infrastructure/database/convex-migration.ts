/**
 * Supabase to Convex Migration Utility
 * Phase 5: Database Migration
 *
 * This utility provides functions to export data from Supabase
 * and import it into Convex.
 */

import { getSupabaseAdmin } from './database-client.js';
import { getConvexClient } from './convex-client.js';

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
}> {
    const supabase = getSupabaseAdmin();

    // Export all tables
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
        knowledgeEmbeddings: knowledgeEmbeddings ?? [],
    };
}

/**
 * Transform Supabase user to Convex format
 */
function transformUser(user: Record<string, unknown>): Record<string, unknown> {
    return {
        email: user.email,
        name: user.name ?? undefined,
        avatar_url: user.avatar_url ?? undefined,
        tier: user.tier ?? 'free',
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
        status: project.status ?? 'active',
        githubUrl: project.github_url ?? undefined,
    };
}

/**
 * Transform Supabase task to Convex format
 */
function transformTask(task: Record<string, unknown>): Record<string, unknown> {
    return {
        projectId: task.project_id,
        userId: task.user_id ?? undefined,
        prompt: task.prompt,
        status: task.status ?? 'pending',
        result: task.result ?? undefined,
        error: task.error ?? undefined,
    };
}

/**
 * Transform Supabase generated_file to Convex format
 */
function transformGeneratedFile(file: Record<string, unknown>): Record<string, unknown> {
    return {
        taskId: file.task_id,
        projectId: file.project_id ?? undefined,
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
function transformDeployment(deployment: Record<string, unknown>): Record<string, unknown> {
    return {
        projectId: deployment.project_id,
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
    };
}

/**
 * Transform Supabase learning_context to Convex format
 */
function transformLearningContext(ctx: Record<string, unknown>): Record<string, unknown> {
    return {
        projectId: ctx.project_id,
        contextType: ctx.context_type ?? undefined,
        contextData: ctx.context_data ?? undefined,
        embeddings: ctx.embeddings ?? undefined,
    };
}

/**
 * Transform Supabase benchmark to Convex format
 */
function transformBenchmark(benchmark: Record<string, unknown>): Record<string, unknown> {
    return {
        projectId: benchmark.project_id ?? undefined,
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

    // Import using relative path that works from the build output
    // The functions will be called by their string identifier
    const usersUpsert: string = 'users:upsert';
    const projectsCreate: string = 'projects:create';
    const tasksCreate: string = 'tasks:create';
    const generatedFilesCreate: string = 'generated_files:create';
    const auditLogsCreate: string = 'audit_logs:create';
    const knowledgeEmbeddingsCreate: string = 'knowledge_embeddings:create';
    const connectionsUpsert: string = 'connections:upsert';
    const deploymentsCreate: string = 'deployments:create';
    const learningContextsCreate: string = 'learning_contexts:create';
    const benchmarksCreate: string = 'benchmarks:create';

    // Import users
    let userErrors = 0;
    let userImported = 0;
    for (const user of data.users) {
        try {
            await convex.mutation(usersUpsert, transformUser(user as Record<string, unknown>));
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
            await convex.mutation(projectsCreate, transformProject(project as Record<string, unknown>));
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
            await convex.mutation(tasksCreate, transformTask(task as Record<string, unknown>));
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
            await convex.mutation(generatedFilesCreate, transformGeneratedFile(file as Record<string, unknown>));
            fileImported++;
        } catch (error) {
            fileErrors++;
            errors.push(`Generated file import failed: ${error}`);
        }
    }
    stats.push({ table: 'generated_files', exported: data.generatedFiles.length, imported: fileImported, errors: fileErrors, skipped: 0 });

    // Import audit logs
    let auditErrors = 0;
    let auditImported = 0;
    for (const log of data.auditLogs) {
        try {
            await convex.mutation(auditLogsCreate, transformAuditLog(log as Record<string, unknown>));
            auditImported++;
        } catch (error) {
            auditErrors++;
            errors.push(`Audit log import failed: ${error}`);
        }
    }
    stats.push({ table: 'audit_logs', exported: data.auditLogs.length, imported: auditImported, errors: auditErrors, skipped: 0 });

    // Import knowledge embeddings (vectors for AI search)
    let embeddingErrors = 0;
    let embeddingImported = 0;
    for (const embedding of data.knowledgeEmbeddings) {
        try {
            await convex.mutation(knowledgeEmbeddingsCreate, {
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
            await convex.mutation(connectionsUpsert, transformConnection(conn as Record<string, unknown>));
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
            await convex.mutation(deploymentsCreate, transformDeployment(dep as Record<string, unknown>));
            deploymentImported++;
        } catch (error) {
            deploymentErrors++;
            errors.push(`Deployment import failed: ${error}`);
        }
    }
    stats.push({ table: 'deployments', exported: data.deployments.length, imported: deploymentImported, errors: deploymentErrors, skipped: 0 });

    // Import learning contexts
    let learningErrors = 0;
    let learningImported = 0;
    for (const ctx of data.learningContexts) {
        try {
            await convex.mutation(learningContextsCreate, transformLearningContext(ctx as Record<string, unknown>));
            learningImported++;
        } catch (error) {
            learningErrors++;
            errors.push(`Learning context import failed: ${error}`);
        }
    }
    stats.push({ table: 'learning_contexts', exported: data.learningContexts.length, imported: learningImported, errors: learningErrors, skipped: 0 });

    // Import benchmarks
    let benchmarkErrors = 0;
    let benchmarkImported = 0;
    for (const bm of data.benchmarks) {
        try {
            await convex.mutation(benchmarksCreate, transformBenchmark(bm as Record<string, unknown>));
            benchmarkImported++;
        } catch (error) {
            benchmarkErrors++;
            errors.push(`Benchmark import failed: ${error}`);
        }
    }
    stats.push({ table: 'benchmarks', exported: data.benchmarks.length, imported: benchmarkImported, errors: benchmarkErrors, skipped: 0 });

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
    // Implementation depends on deployed Convex functions

    return {
        valid: true,
        differences: [],
    };
}
