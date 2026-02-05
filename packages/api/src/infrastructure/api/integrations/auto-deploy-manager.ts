/**
 * ============================================
 * AUTO-DEPLOY MANAGER
 * ============================================
 *
 * Phase 15.4: Auto-Deploy Pipeline
 *
 * Manages automatic deployments after code generation,
 * database persistence, and SSE progress streaming.
 */

import { EventEmitter } from 'events';
import {
    getDeploymentService,
    getGitHubService,
    type DeploymentStatus,
} from './index.js';
import { ConnectionManager } from '../connection-manager/index.js';

// ============================================
// TYPES
// ============================================

export interface AutoDeployConfig {
    enabled: boolean;
    provider: 'netlify' | 'vercel';
    autoCommitToGithub: boolean;
    delayMs: number;
}

export interface DeploymentEvent {
    type: 'started' | 'progress' | 'success' | 'error' | 'complete';
    projectId: string;
    deploymentId?: string;
    message: string;
    progress?: number; // 0-100
    data?: Record<string, unknown>;
    timestamp: Date;
}

export interface ProjectDeploymentState {
    projectId: string;
    status: DeploymentStatus | 'idle' | 'queued';
    currentDeploymentId?: string;
    lastDeploymentUrl?: string;
    lastDeployedAt?: Date;
    error?: string;
}

export interface StoredDeployment {
    id: string;
    projectId: string;
    userId?: string;
    provider: string;
    providerDeployId: string;
    status: DeploymentStatus;
    url?: string;
    previewUrl?: string;
    commitSha?: string;
    commitMessage?: string;
    fileCount: number;
    buildTimeMs?: number;
    isProduction: boolean;
    triggeredBy: 'manual' | 'auto' | 'webhook' | 'rollback';
    createdAt: Date;
    updatedAt: Date;
    deployedAt?: Date;
    error?: string;
}

// ============================================
// AUTO-DEPLOY MANAGER CLASS
// ============================================

export class AutoDeployManager extends EventEmitter {
    private config: AutoDeployConfig;
    private initialized: boolean = false;
    private projectStates: Map<string, ProjectDeploymentState> = new Map();
    private pendingDeploys: Map<string, NodeJS.Timeout> = new Map();
    private supabaseEnabled: boolean = false;
    private pendingRecords: StoredDeployment[] = [];
    private flushInterval: NodeJS.Timeout | null = null;

    constructor(config?: Partial<AutoDeployConfig>) {
        super();

        this.config = {
            enabled: config?.enabled ?? (process.env.AUTO_DEPLOY_ENABLED === 'true'),
            provider: config?.provider ??
                (process.env.DEFAULT_DEPLOY_PROVIDER as 'netlify' | 'vercel') ?? 'netlify',
            autoCommitToGithub: config?.autoCommitToGithub ?? false,
            delayMs: config?.delayMs ?? 2000, // Wait 2s before deploying to batch changes
        };
    }

    /**
     * Initialize the auto-deploy manager
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Check Supabase configuration
        this.supabaseEnabled = !!(
            process.env.SUPABASE_URL &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        if (this.supabaseEnabled) {
            // Flush pending records every 30 seconds
            this.flushInterval = setInterval(
                () => this.flushPendingRecords(),
                30000
            );
        }

        this.initialized = true;
    }

    /**
     * Check if auto-deploy is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Get project deployment state
     */
    getProjectState(projectId: string): ProjectDeploymentState {
        return this.projectStates.get(projectId) || {
            projectId,
            status: 'idle',
        };
    }

    /**
     * Trigger deployment after code generation
     * Called by the orchestrator/code generation pipeline
     */
    async triggerDeployAfterCodeGen(
        projectId: string,
        files: Array<{ path: string; content: string }>,
        options: {
            userId?: string;
            commitMessage?: string;
            immediate?: boolean;
        } = {}
    ): Promise<void> {
        if (!this.config.enabled) {
            console.log(`[AUTO-DEPLOY] Auto-deploy disabled, skipping for project ${projectId}`);
            return;
        }

        console.log(`[AUTO-DEPLOY] Queuing deployment for project ${projectId} (${files.length} files)`);

        // Clear any pending deploy for this project
        const existingTimeout = this.pendingDeploys.get(projectId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Update state to queued
        this.updateProjectState(projectId, { status: 'queued' });
        this.emitEvent({
            type: 'started',
            projectId,
            message: 'Deployment queued',
            progress: 0,
        });

        // Delay deployment to batch rapid changes (unless immediate)
        const delay = options.immediate ? 0 : this.config.delayMs;

        const timeout = setTimeout(async () => {
            this.pendingDeploys.delete(projectId);
            await this.executeDeployment(projectId, files, options);
        }, delay);

        this.pendingDeploys.set(projectId, timeout);
    }

    /**
     * Execute the actual deployment
     */
    private async executeDeployment(
        projectId: string,
        files: Array<{ path: string; content: string }>,
        options: {
            userId?: string;
            commitMessage?: string;
        }
    ): Promise<void> {
        const deploymentService = getDeploymentService();
        const startTime = Date.now();

        try {
            // Update state to building
            this.updateProjectState(projectId, { status: 'building' });
            this.emitEvent({
                type: 'progress',
                projectId,
                message: 'Starting deployment...',
                progress: 10,
            });

            // Initialize deployment service
            await deploymentService.initialize();

            this.emitEvent({
                type: 'progress',
                projectId,
                message: 'Uploading files...',
                progress: 30,
            });

            // Deploy to provider
            const result = await deploymentService.deploy({
                projectId,
                projectName: `project-${projectId}`,
                files,
                provider: this.config.provider,
                production: false, // Always deploy as preview first
                commitMessage: options.commitMessage || `Auto-deploy: ${files.length} files`,
            });

            const buildTime = Date.now() - startTime;

            // Update state to ready
            this.updateProjectState(projectId, {
                status: 'ready',
                currentDeploymentId: result.id,
                lastDeploymentUrl: result.url || result.previewUrl || undefined,
                lastDeployedAt: new Date(),
            });

            this.emitEvent({
                type: 'success',
                projectId,
                deploymentId: result.id,
                message: 'Deployment successful!',
                progress: 100,
                data: {
                    url: result.url,
                    previewUrl: result.previewUrl,
                    buildTimeMs: buildTime,
                },
            });

            // Store in database
            await this.storeDeployment({
                id: result.id,
                projectId,
                userId: options.userId,
                provider: result.provider,
                providerDeployId: result.id,
                status: result.status,
                url: result.url || undefined,
                previewUrl: result.previewUrl || undefined,
                commitMessage: options.commitMessage,
                fileCount: files.length,
                buildTimeMs: buildTime,
                isProduction: false,
                triggeredBy: 'auto',
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                deployedAt: new Date(),
            });

            console.log(`[AUTO-DEPLOY] Deployment complete for ${projectId}: ${result.url || result.previewUrl}`);

            // Optionally commit to GitHub
            if (this.config.autoCommitToGithub) {
                await this.commitToGitHub(projectId, files, options.commitMessage);
            }

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[AUTO-DEPLOY] Deployment failed for ${projectId}:`, error);

            this.updateProjectState(projectId, {
                status: 'error',
                error: errorMsg,
            });

            this.emitEvent({
                type: 'error',
                projectId,
                message: `Deployment failed: ${errorMsg}`,
                progress: 0,
                data: { error: errorMsg },
            });
        }
    }

    /**
     * Commit files to GitHub (if configured)
     * Uses ConnectionManager to get user's GitHub credentials
     */
    private async commitToGitHub(
        projectId: string,
        files: Array<{ path: string; content: string }>,
        commitMessage?: string
    ): Promise<void> {
        try {
            const githubService = getGitHubService();

            if (!githubService.isConfigured()) {
                console.log('[AUTO-DEPLOY] GitHub not configured, skipping commit');
                return;
            }

            // Get user's GitHub credentials from ConnectionManager
            // For now, we'll use environment variables as fallback
            const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
            const githubRepo = process.env.GITHUB_REPO;

            if (!githubToken || !githubRepo) {
                console.log('[AUTO-DEPLOY] GitHub credentials not configured, skipping commit');
                console.log('[AUTO-DEPLOY] To enable GitHub commits, set up a GitHub connection via ConnectionManager');
                return;
            }

            // Parse repo owner and name
            const [owner, repo] = githubRepo.split('/');

            if (!owner || !repo) {
                console.error('[AUTO-DEPLOY] Invalid GITHUB_REPO format. Expected: owner/repo');
                return;
            }

            console.log(`[AUTO-DEPLOY] Committing to GitHub: ${owner}/${repo}`);

            // Create commit using GitHub service
            // Note: This is a simplified implementation. In production, you would:
            // 1. Use ConnectionManager to get the user's GitHub connection
            // 2. Extract the token and repo info from the connection
            // 3. Use the GitHub API to create a commit with the files

            const defaultBranch = 'main';
            const timestamp = new Date().toISOString();

            console.log(`[AUTO-DEPLOY] GitHub commit prepared for ${projectId} at ${timestamp}`);
            console.log(`[AUTO-DEPLOY] Files to commit: ${files.length}`);
            console.log(`[AUTO-DEPLOY] Commit message: ${commitMessage || 'Auto-commit from deployment'}`);

            // Implement actual GitHub API call to create commit
            try {
                const result = await githubService.commitFiles(githubToken, {
                    owner,
                    repo,
                    message: commitMessage || `Auto-commit: ${files.length} files from project ${projectId}`,
                    files: files.map(f => ({
                        path: f.path,
                        content: f.content,
                    })),
                    branch: defaultBranch,
                });

                console.log(`[AUTO-DEPLOY] GitHub commit successful: ${result.sha}`);
                console.log(`[AUTO-DEPLOY] Commit URL: ${result.url}`);

                // Store commit SHA in deployment state
                this.updateProjectState(projectId, {
                    lastDeployedAt: new Date(),
                });

                return result;
            } catch (commitError) {
                const errorMsg = commitError instanceof Error ? commitError.message : String(commitError);
                console.error(`[AUTO-DEPLOY] Failed to create GitHub commit: ${errorMsg}`);
                throw commitError;
            }
        } catch (error) {
            console.error('[AUTO-DEPLOY] GitHub commit failed:', error);
            // Don't fail the deployment if GitHub commit fails
        }
    }

    /**
     * Update project deployment state
     */
    private updateProjectState(
        projectId: string,
        update: Partial<ProjectDeploymentState>
    ): void {
        const current = this.projectStates.get(projectId) || {
            projectId,
            status: 'idle' as const,
        };

        const newState = { ...current, ...update };
        this.projectStates.set(projectId, newState);
    }

    /**
     * Emit deployment event (for SSE streaming)
     */
    private emitEvent(event: Omit<DeploymentEvent, 'timestamp'>): void {
        const fullEvent: DeploymentEvent = {
            ...event,
            timestamp: new Date(),
        };

        this.emit('deployment', fullEvent);
        this.emit(`deployment:${event.projectId}`, fullEvent);
    }

    /**
     * Subscribe to deployment events for a project (for SSE)
     */
    subscribeToProject(
        projectId: string,
        callback: (event: DeploymentEvent) => void
    ): () => void {
        const eventName = `deployment:${projectId}`;
        this.on(eventName, callback);

        // Return unsubscribe function
        return () => {
            this.off(eventName, callback);
        };
    }

    /**
     * Subscribe to all deployment events
     */
    subscribeToAll(callback: (event: DeploymentEvent) => void): () => void {
        this.on('deployment', callback);
        return () => {
            this.off('deployment', callback);
        };
    }

    // ============================================
    // DATABASE PERSISTENCE
    // ============================================

    /**
     * Store deployment record (queues for batch insert)
     */
    private async storeDeployment(deployment: StoredDeployment): Promise<void> {
        if (!this.supabaseEnabled) {
            console.log('[AUTO-DEPLOY] Database not configured, skipping persistence');
            return;
        }

        this.pendingRecords.push(deployment);

        // Immediate flush if we have many records
        if (this.pendingRecords.length >= 10) {
            await this.flushPendingRecords();
        }
    }

    /**
     * Validate UUID format
     */
    private isValidUUID(str: string | undefined): boolean {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }

    /**
     * Flush pending deployment records to database
     */
    private async flushPendingRecords(): Promise<void> {
        if (!this.supabaseEnabled || this.pendingRecords.length === 0) {
            return;
        }

        const recordsToFlush = [...this.pendingRecords];
        this.pendingRecords = [];

        try {
            // Dynamic import to avoid issues when Supabase is not configured
            const { getSupabaseAdmin } = await import('../infrastructure/database-client.js');
            const supabase = getSupabaseAdmin();

            // Transform to database format
            const dbRecords = recordsToFlush.map(record => ({
                id: record.id,
                project_id: this.isValidUUID(record.projectId) ? record.projectId : null,
                user_id: this.isValidUUID(record.userId) ? record.userId : null,
                provider: record.provider,
                provider_deploy_id: record.providerDeployId,
                status: record.status,
                url: record.url || null,
                preview_url: record.previewUrl || null,
                commit_sha: record.commitSha || null,
                commit_message: record.commitMessage || null,
                file_count: record.fileCount,
                build_time_ms: record.buildTimeMs || null,
                is_production: record.isProduction,
                triggered_by: record.triggeredBy,
                created_at: record.createdAt.toISOString(),
                updated_at: record.updatedAt.toISOString(),
                deployed_at: record.deployedAt?.toISOString() || null,
                error_message: record.error || null,
            }));

            // First ensure site exists
            for (const record of recordsToFlush) {
                const siteId = `loveable-${record.projectId}`;

                // Upsert site record
                await supabase.from('deployment_sites').upsert({
                    id: siteId,
                    project_id: this.isValidUUID(record.projectId) ? record.projectId : null,
                    provider: record.provider,
                    provider_site_id: siteId,
                    site_name: siteId,
                    site_url: record.url || null,
                    status: 'active',
                }, { onConflict: 'provider,provider_site_id' });
            }

            // Insert deployment records
            const { error } = await supabase
                .from('deployments')
                .upsert(dbRecords.map(r => ({
                    ...r,
                    site_id: `loveable-${r.project_id}`,
                })), { onConflict: 'provider,provider_deploy_id' });

            if (error) {
                console.error('[AUTO-DEPLOY] Failed to persist deployments:', error);
                // Put records back for retry
                this.pendingRecords.unshift(...recordsToFlush);
            } else {
                console.log(`[AUTO-DEPLOY] Persisted ${recordsToFlush.length} deployment records`);
            }

        } catch (error) {
            console.error('[AUTO-DEPLOY] Database persistence error:', error);
            this.pendingRecords.unshift(...recordsToFlush);
        }
    }

    /**
     * Get deployment history for a project from database
     */
    async getDeploymentHistory(
        projectId: string,
        options: { limit?: number; offset?: number } = {}
    ): Promise<StoredDeployment[]> {
        if (!this.supabaseEnabled) {
            return [];
        }

        try {
            const { getSupabaseAdmin } = await import('../infrastructure/database-client.js');
            const supabase = getSupabaseAdmin();

            const { data, error } = await supabase
                .from('deployments')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false })
                .range(
                    options.offset || 0,
                    (options.offset || 0) + (options.limit || 20) - 1
                );

            if (error) {
                console.error('[AUTO-DEPLOY] Failed to get history:', error);
                return [];
            }

            return (data || []).map(row => ({
                id: row.id,
                projectId: row.project_id,
                userId: row.user_id,
                provider: row.provider,
                providerDeployId: row.provider_deploy_id,
                status: row.status,
                url: row.url,
                previewUrl: row.preview_url,
                commitSha: row.commit_sha,
                commitMessage: row.commit_message,
                fileCount: row.file_count,
                buildTimeMs: row.build_time_ms,
                isProduction: row.is_production,
                triggeredBy: row.triggered_by,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
                deployedAt: row.deployed_at ? new Date(row.deployed_at) : undefined,
                error: row.error_message,
            }));

        } catch (error) {
            console.error('[AUTO-DEPLOY] Failed to get deployment history:', error);
            return [];
        }
    }

    /**
     * Cancel pending deployment for a project
     */
    cancelPendingDeploy(projectId: string): boolean {
        const timeout = this.pendingDeploys.get(projectId);
        if (timeout) {
            clearTimeout(timeout);
            this.pendingDeploys.delete(projectId);
            this.updateProjectState(projectId, { status: 'idle' });
            console.log(`[AUTO-DEPLOY] Cancelled pending deploy for ${projectId}`);
            return true;
        }
        return false;
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        console.log('[AUTO-DEPLOY] Shutting down auto-deploy manager...');

        // Clear all pending deploys
        for (const [projectId, timeout] of this.pendingDeploys) {
            clearTimeout(timeout);
            console.log(`[AUTO-DEPLOY] Cancelled pending deploy for ${projectId}`);
        }
        this.pendingDeploys.clear();

        // Clear flush interval
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        // Flush remaining records
        await this.flushPendingRecords();

        this.initialized = false;
        console.log('[AUTO-DEPLOY] Auto-deploy manager shutdown complete');
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: AutoDeployManager | null = null;

export function getAutoDeployManager(): AutoDeployManager {
    if (!instance) {
        instance = new AutoDeployManager();
    }
    return instance;
}

export function createAutoDeployManager(config?: Partial<AutoDeployConfig>): AutoDeployManager {
    instance = new AutoDeployManager(config);
    return instance;
}

// ============================================
// EXPORTS
// ============================================

export default {
    AutoDeployManager,
    getAutoDeployManager,
    createAutoDeployManager,
};
