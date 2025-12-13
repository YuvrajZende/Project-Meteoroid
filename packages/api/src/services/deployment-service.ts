/**
 * ============================================
 * DEPLOYMENT SERVICE
 * ============================================
 * 
 * Phase 15.2: Netlify/Vercel Integration
 * 
 * Handles automated deployments to Netlify and Vercel,
 * including build triggers, preview URLs, and deployment history.
 */

// ============================================
// TYPES
// ============================================

export type DeploymentProvider = 'netlify' | 'vercel';
export type DeploymentStatus = 'pending' | 'building' | 'ready' | 'error' | 'cancelled';

export interface DeploymentConfig {
    netlifyToken?: string;
    netlifyTeamId?: string;
    vercelToken?: string;
    vercelTeamId?: string;
    defaultProvider: DeploymentProvider;
}

export interface DeploymentSite {
    id: string;
    name: string;
    url: string;
    adminUrl: string;
    provider: DeploymentProvider;
    createdAt: Date;
}

export interface DeploymentResult {
    id: string;
    siteId: string;
    status: DeploymentStatus;
    url: string | null;
    previewUrl: string | null;
    deployUrl: string | null;
    adminUrl: string;
    provider: DeploymentProvider;
    commitSha?: string;
    commitMessage?: string;
    buildTime?: number;
    createdAt: Date;
    updatedAt: Date;
    error?: string;
}

export interface DeployOptions {
    projectId: string;
    projectName: string;
    files: Array<{
        path: string;
        content: string;
    }>;
    provider?: DeploymentProvider;
    branch?: string;
    commitMessage?: string;
    production?: boolean;
}

export interface NetlifySite {
    id: string;
    name: string;
    url: string;
    admin_url: string;
    ssl_url: string;
    deploy_url: string;
    state: string;
}

export interface NetlifyDeploy {
    id: string;
    site_id: string;
    state: string;
    url: string;
    ssl_url: string;
    deploy_ssl_url: string;
    admin_url: string;
    deploy_url: string;
    commit_ref: string | null;
    title: string | null;
    created_at: string;
    updated_at: string;
    error_message: string | null;
}

// ============================================
// DEPLOYMENT SERVICE CLASS
// ============================================

export class DeploymentService {
    private config: DeploymentConfig;
    private initialized: boolean = false;

    constructor(config?: Partial<DeploymentConfig>) {
        this.config = {
            netlifyToken: config?.netlifyToken || process.env.NETLIFY_AUTH_TOKEN,
            netlifyTeamId: config?.netlifyTeamId || process.env.NETLIFY_TEAM_ID,
            vercelToken: config?.vercelToken || process.env.VERCEL_TOKEN,
            vercelTeamId: config?.vercelTeamId || process.env.VERCEL_TEAM_ID,
            defaultProvider: config?.defaultProvider ||
                (process.env.DEFAULT_DEPLOY_PROVIDER as DeploymentProvider) || 'netlify',
        };
    }

    /**
     * Initialize the deployment service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        this.initialized = true;
    }

    /**
     * Check if a provider is configured
     */
    isProviderConfigured(provider: DeploymentProvider): boolean {
        if (provider === 'netlify') {
            return !!this.config.netlifyToken;
        }
        if (provider === 'vercel') {
            return !!this.config.vercelToken;
        }
        return false;
    }

    /**
     * Get available deployment providers
     */
    getAvailableProviders(): DeploymentProvider[] {
        const providers: DeploymentProvider[] = [];
        if (this.config.netlifyToken) providers.push('netlify');
        if (this.config.vercelToken) providers.push('vercel');
        return providers;
    }

    // ============================================
    // NETLIFY INTEGRATION
    // ============================================

    /**
     * Create a new Netlify site
     */
    async createNetlifySite(name: string): Promise<DeploymentSite> {
        if (!this.config.netlifyToken) {
            throw new Error('Netlify token not configured');
        }

        console.log(`[DEPLOY] Creating Netlify site: ${name}`);

        const response = await fetch('https://api.netlify.com/api/v1/sites', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.netlifyToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                account_slug: this.config.netlifyTeamId,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create Netlify site: ${error}`);
        }

        const site = await response.json() as NetlifySite;

        console.log(`[DEPLOY] Netlify site created: ${site.url}`);

        return {
            id: site.id,
            name: site.name,
            url: site.ssl_url || site.url,
            adminUrl: site.admin_url,
            provider: 'netlify',
            createdAt: new Date(),
        };
    }

    /**
     * Deploy files to Netlify using the deploy API
     */
    async deployToNetlify(
        siteId: string,
        files: Array<{ path: string; content: string }>,
        options: { production?: boolean; message?: string } = {}
    ): Promise<DeploymentResult> {
        if (!this.config.netlifyToken) {
            throw new Error('Netlify token not configured');
        }

        console.log(`[DEPLOY] Deploying ${files.length} files to Netlify site: ${siteId}`);

        // Create a file digest
        const fileDigest: Record<string, string> = {};
        const fileContents: Record<string, string> = {};

        for (const file of files) {
            // Normalize path (remove leading slash if present)
            const normalizedPath = file.path.startsWith('/')
                ? file.path.slice(1)
                : file.path;

            // Calculate SHA1 hash for the file
            const hash = await this.sha1Hash(file.content);
            fileDigest[`/${normalizedPath}`] = hash;
            fileContents[hash] = file.content;
        }

        // Create deploy with file digest
        const createDeployResponse = await fetch(
            `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.netlifyToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: fileDigest,
                    draft: !options.production,
                    title: options.message || 'Deployed by Loveable Backend',
                }),
            }
        );

        if (!createDeployResponse.ok) {
            const error = await createDeployResponse.text();
            throw new Error(`Failed to create Netlify deploy: ${error}`);
        }

        const deploy = await createDeployResponse.json() as NetlifyDeploy & { required: string[] };

        // Upload required files
        if (deploy.required && deploy.required.length > 0) {
            console.log(`[DEPLOY] Uploading ${deploy.required.length} files...`);

            for (const sha of deploy.required) {
                const content = fileContents[sha];
                if (!content) continue;

                await fetch(
                    `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${sha}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${this.config.netlifyToken}`,
                            'Content-Type': 'application/octet-stream',
                        },
                        body: content,
                    }
                );
            }
        }

        // Wait for deploy to be ready (poll status)
        const finalDeploy = await this.waitForNetlifyDeploy(deploy.id);

        console.log(`[DEPLOY] Netlify deployment complete: ${finalDeploy.ssl_url}`);

        return {
            id: finalDeploy.id,
            siteId: finalDeploy.site_id,
            status: this.mapNetlifyStatus(finalDeploy.state),
            url: finalDeploy.ssl_url,
            previewUrl: finalDeploy.deploy_ssl_url,
            deployUrl: finalDeploy.deploy_url,
            adminUrl: finalDeploy.admin_url,
            provider: 'netlify',
            commitMessage: finalDeploy.title || undefined,
            createdAt: new Date(finalDeploy.created_at),
            updatedAt: new Date(finalDeploy.updated_at),
            error: finalDeploy.error_message || undefined,
        };
    }

    /**
     * Wait for Netlify deploy to be ready
     */
    private async waitForNetlifyDeploy(
        deployId: string,
        maxAttempts: number = 60,
        intervalMs: number = 2000
    ): Promise<NetlifyDeploy> {
        for (let i = 0; i < maxAttempts; i++) {
            const response = await fetch(
                `https://api.netlify.com/api/v1/deploys/${deployId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.netlifyToken}`,
                    },
                }
            );

            const deploy = await response.json() as NetlifyDeploy;

            if (deploy.state === 'ready' || deploy.state === 'error') {
                return deploy;
            }

            console.log(`[DEPLOY] Waiting for deploy... (${deploy.state})`);
            await this.sleep(intervalMs);
        }

        throw new Error('Deploy timed out');
    }

    /**
     * Get Netlify site by ID
     */
    async getNetlifySite(siteId: string): Promise<DeploymentSite | null> {
        if (!this.config.netlifyToken) {
            throw new Error('Netlify token not configured');
        }

        try {
            const response = await fetch(
                `https://api.netlify.com/api/v1/sites/${siteId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.netlifyToken}`,
                    },
                }
            );

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                throw new Error(`Failed to get Netlify site: ${response.statusText}`);
            }

            const site = await response.json() as NetlifySite;

            return {
                id: site.id,
                name: site.name,
                url: site.ssl_url || site.url,
                adminUrl: site.admin_url,
                provider: 'netlify',
                createdAt: new Date(),
            };
        } catch (error) {
            console.error('[DEPLOY] Error getting Netlify site:', error);
            return null;
        }
    }

    /**
     * List deployments for a Netlify site
     */
    async listNetlifyDeployments(
        siteId: string,
        options: { page?: number; perPage?: number } = {}
    ): Promise<DeploymentResult[]> {
        if (!this.config.netlifyToken) {
            throw new Error('Netlify token not configured');
        }

        const params = new URLSearchParams({
            page: String(options.page || 1),
            per_page: String(options.perPage || 20),
        });

        const response = await fetch(
            `https://api.netlify.com/api/v1/sites/${siteId}/deploys?${params}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.config.netlifyToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to list Netlify deploys: ${response.statusText}`);
        }

        const deploys = await response.json() as NetlifyDeploy[];

        return deploys.map(deploy => ({
            id: deploy.id,
            siteId: deploy.site_id,
            status: this.mapNetlifyStatus(deploy.state),
            url: deploy.ssl_url,
            previewUrl: deploy.deploy_ssl_url,
            deployUrl: deploy.deploy_url,
            adminUrl: deploy.admin_url,
            provider: 'netlify' as const,
            commitSha: deploy.commit_ref || undefined,
            commitMessage: deploy.title || undefined,
            createdAt: new Date(deploy.created_at),
            updatedAt: new Date(deploy.updated_at),
            error: deploy.error_message || undefined,
        }));
    }

    /**
     * Rollback to a previous Netlify deployment
     */
    async rollbackNetlifyDeploy(siteId: string, deployId: string): Promise<DeploymentResult> {
        if (!this.config.netlifyToken) {
            throw new Error('Netlify token not configured');
        }

        console.log(`[DEPLOY] Rolling back to deploy: ${deployId}`);

        const response = await fetch(
            `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}/restore`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.netlifyToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to rollback: ${response.statusText}`);
        }

        const deploy = await response.json() as NetlifyDeploy;

        console.log(`[DEPLOY] Rollback complete: ${deploy.ssl_url}`);

        return {
            id: deploy.id,
            siteId: deploy.site_id,
            status: this.mapNetlifyStatus(deploy.state),
            url: deploy.ssl_url,
            previewUrl: deploy.deploy_ssl_url,
            deployUrl: deploy.deploy_url,
            adminUrl: deploy.admin_url,
            provider: 'netlify',
            createdAt: new Date(deploy.created_at),
            updatedAt: new Date(deploy.updated_at),
        };
    }

    /**
     * Delete a Netlify site
     */
    async deleteNetlifySite(siteId: string): Promise<void> {
        if (!this.config.netlifyToken) {
            throw new Error('Netlify token not configured');
        }

        console.log(`[DEPLOY] Deleting Netlify site: ${siteId}`);

        const response = await fetch(
            `https://api.netlify.com/api/v1/sites/${siteId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.config.netlifyToken}`,
                },
            }
        );

        if (!response.ok && response.status !== 404) {
            throw new Error(`Failed to delete site: ${response.statusText}`);
        }

        console.log(`[DEPLOY] Netlify site deleted: ${siteId}`);
    }

    // ============================================
    // VERCEL INTEGRATION (Placeholder)
    // ============================================

    /**
     * Deploy to Vercel (placeholder - to be implemented)
     */
    async deployToVercel(
        _projectName: string,
        _files: Array<{ path: string; content: string }>,
        _options: { production?: boolean } = {}
    ): Promise<DeploymentResult> {
        // TODO: Implement Vercel deployment
        throw new Error('Vercel deployment not yet implemented');
    }

    // ============================================
    // UNIFIED DEPLOYMENT API
    // ============================================

    /**
     * Deploy a project using the configured provider
     */
    async deploy(options: DeployOptions): Promise<DeploymentResult> {
        const provider = options.provider || this.config.defaultProvider;

        console.log(`[DEPLOY] Starting deployment via ${provider}...`);
        console.log(`[DEPLOY] Project: ${options.projectName}`);
        console.log(`[DEPLOY] Files: ${options.files.length}`);

        if (!this.isProviderConfigured(provider)) {
            throw new Error(`Provider ${provider} is not configured`);
        }

        if (provider === 'netlify') {
            // Create site if needed, then deploy
            const siteName = `loveable-${options.projectId}`;

            // Try to get existing site or create new one
            let site: DeploymentSite;
            const existingSite = await this.getNetlifySite(siteName);

            if (existingSite) {
                site = existingSite;
            } else {
                site = await this.createNetlifySite(siteName);
            }

            // Deploy files
            return await this.deployToNetlify(site.id, options.files, {
                production: options.production,
                message: options.commitMessage || `Deploy: ${options.projectName}`,
            });
        }

        if (provider === 'vercel') {
            return await this.deployToVercel(options.projectName, options.files, {
                production: options.production,
            });
        }

        throw new Error(`Unknown provider: ${provider}`);
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Map Netlify status to our status
     */
    private mapNetlifyStatus(state: string): DeploymentStatus {
        switch (state) {
            case 'ready':
                return 'ready';
            case 'building':
            case 'enqueued':
            case 'uploading':
            case 'uploaded':
            case 'preparing':
            case 'prepared':
            case 'processing':
                return 'building';
            case 'error':
                return 'error';
            case 'cancelled':
                return 'cancelled';
            default:
                return 'pending';
        }
    }

    /**
     * Calculate SHA1 hash of content
     */
    private async sha1Hash(content: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        console.log('[DEPLOY] Shutting down deployment service...');
        this.initialized = false;
        console.log('[DEPLOY] Deployment service shutdown complete');
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: DeploymentService | null = null;

export function getDeploymentService(): DeploymentService {
    if (!instance) {
        instance = new DeploymentService();
    }
    return instance;
}

export function createDeploymentService(config?: Partial<DeploymentConfig>): DeploymentService {
    instance = new DeploymentService(config);
    return instance;
}

// ============================================
// EXPORTS
// ============================================

export default {
    DeploymentService,
    getDeploymentService,
    createDeploymentService,
};
