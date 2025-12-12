/**
 * ============================================
 * GITHUB SERVICE
 * ============================================
 * 
 * Phase 15.1: GitHub Integration
 * 
 * Handles GitHub OAuth, repository creation, 
 * and automated commits for generated projects.
 */

import { Octokit } from '@octokit/rest';

// ============================================
// TYPES
// ============================================

export interface GitHubConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    appName: string;
}

export interface GitHubUser {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatarUrl: string;
}

export interface GitHubRepo {
    id: number;
    name: string;
    fullName: string;
    htmlUrl: string;
    cloneUrl: string;
    sshUrl: string;
    defaultBranch: string;
    private: boolean;
}

export interface CreateRepoOptions {
    name: string;
    description?: string;
    private?: boolean;
    autoInit?: boolean;
}

export interface CommitOptions {
    repo: string;
    owner: string;
    branch?: string;
    message: string;
    files: Array<{
        path: string;
        content: string;
    }>;
}

export interface CommitResult {
    sha: string;
    url: string;
    message: string;
}

// ============================================
// GITHUB SERVICE CLASS
// ============================================

export class GitHubService {
    private config: GitHubConfig;
    private initialized: boolean = false;

    constructor(config?: Partial<GitHubConfig>) {
        this.config = {
            clientId: config?.clientId || process.env.GITHUB_CLIENT_ID || '',
            clientSecret: config?.clientSecret || process.env.GITHUB_CLIENT_SECRET || '',
            redirectUri: config?.redirectUri || process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback',
            appName: config?.appName || process.env.GITHUB_APP_NAME || 'Loveable Backend',
        };
    }

    /**
     * Initialize the GitHub service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[GITHUB] Initializing GitHub service...');

        if (!this.config.clientId || !this.config.clientSecret) {
            console.warn('[GITHUB] GitHub OAuth not configured - some features will be disabled');
        }

        this.initialized = true;
        console.log('[GITHUB] GitHub service initialized');
    }

    /**
     * Check if GitHub OAuth is configured
     */
    isConfigured(): boolean {
        return !!(this.config.clientId && this.config.clientSecret);
    }

    /**
     * Get OAuth authorization URL
     */
    getAuthorizationUrl(state: string, scopes: string[] = ['repo', 'user:email']): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: scopes.join(' '),
            state,
        });

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<string> {
        console.log('[GITHUB] Exchanging code for access token...');

        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code,
            }),
        });

        const data = await response.json() as { access_token?: string; error?: string };

        if (data.error) {
            throw new Error(`GitHub OAuth error: ${data.error}`);
        }

        if (!data.access_token) {
            throw new Error('No access token received from GitHub');
        }

        console.log('[GITHUB] Access token obtained successfully');
        return data.access_token;
    }

    /**
     * Get authenticated user info
     */
    async getUser(accessToken: string): Promise<GitHubUser> {
        const octokit = new Octokit({ auth: accessToken });

        const { data } = await octokit.users.getAuthenticated();

        return {
            id: data.id,
            login: data.login,
            name: data.name,
            email: data.email,
            avatarUrl: data.avatar_url,
        };
    }

    /**
     * Create a new repository
     */
    async createRepository(
        accessToken: string,
        options: CreateRepoOptions
    ): Promise<GitHubRepo> {
        console.log(`[GITHUB] Creating repository: ${options.name}`);

        const octokit = new Octokit({ auth: accessToken });

        const { data } = await octokit.repos.createForAuthenticatedUser({
            name: options.name,
            description: options.description || `Created by ${this.config.appName}`,
            private: options.private ?? false,
            auto_init: options.autoInit ?? true,
        });

        console.log(`[GITHUB] Repository created: ${data.html_url}`);

        return {
            id: data.id,
            name: data.name,
            fullName: data.full_name,
            htmlUrl: data.html_url,
            cloneUrl: data.clone_url,
            sshUrl: data.ssh_url,
            defaultBranch: data.default_branch || 'main',
            private: data.private,
        };
    }

    /**
     * Check if a repository exists
     */
    async repositoryExists(
        accessToken: string,
        owner: string,
        repo: string
    ): Promise<boolean> {
        const octokit = new Octokit({ auth: accessToken });

        try {
            await octokit.repos.get({ owner, repo });
            return true;
        } catch (error: any) {
            if (error.status === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Commit multiple files to a repository
     * Uses the Git Data API for atomic commits
     */
    async commitFiles(
        accessToken: string,
        options: CommitOptions
    ): Promise<CommitResult> {
        const { repo, owner, message, files, branch = 'main' } = options;

        console.log(`[GITHUB] Committing ${files.length} files to ${owner}/${repo}`);

        const octokit = new Octokit({ auth: accessToken });

        // Get the latest commit SHA
        const { data: refData } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });
        const latestCommitSha = refData.object.sha;

        // Get the tree SHA of the latest commit
        const { data: commitData } = await octokit.git.getCommit({
            owner,
            repo,
            commit_sha: latestCommitSha,
        });
        const baseTreeSha = commitData.tree.sha;

        // Create blobs for each file
        const blobs = await Promise.all(
            files.map(async (file) => {
                const { data: blob } = await octokit.git.createBlob({
                    owner,
                    repo,
                    content: Buffer.from(file.content).toString('base64'),
                    encoding: 'base64',
                });
                return {
                    path: file.path,
                    mode: '100644' as const,
                    type: 'blob' as const,
                    sha: blob.sha,
                };
            })
        );

        // Create a new tree
        const { data: newTree } = await octokit.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: blobs,
        });

        // Create a new commit with [Lovable] prefix
        const commitMessage = message.startsWith('[Lovable]')
            ? message
            : `[Lovable] ${message}`;

        const { data: newCommit } = await octokit.git.createCommit({
            owner,
            repo,
            message: commitMessage,
            tree: newTree.sha,
            parents: [latestCommitSha],
        });

        // Update the reference to point to the new commit
        await octokit.git.updateRef({
            owner,
            repo,
            ref: `heads/${branch}`,
            sha: newCommit.sha,
        });

        console.log(`[GITHUB] Committed successfully: ${newCommit.sha.substring(0, 7)}`);

        return {
            sha: newCommit.sha,
            url: newCommit.html_url,
            message: commitMessage,
        };
    }

    /**
     * Get repository contents
     */
    async getRepositoryContents(
        accessToken: string,
        owner: string,
        repo: string,
        path: string = ''
    ): Promise<any> {
        const octokit = new Octokit({ auth: accessToken });

        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
        });

        return data;
    }

    /**
     * Delete a repository
     */
    async deleteRepository(
        accessToken: string,
        owner: string,
        repo: string
    ): Promise<void> {
        console.log(`[GITHUB] Deleting repository: ${owner}/${repo}`);

        const octokit = new Octokit({ auth: accessToken });

        await octokit.repos.delete({ owner, repo });

        console.log(`[GITHUB] Repository deleted: ${owner}/${repo}`);
    }

    /**
     * List user repositories
     */
    async listRepositories(
        accessToken: string,
        options: { perPage?: number; page?: number; sort?: 'created' | 'updated' | 'pushed' | 'full_name' } = {}
    ): Promise<GitHubRepo[]> {
        const octokit = new Octokit({ auth: accessToken });

        const { data } = await octokit.repos.listForAuthenticatedUser({
            per_page: options.perPage || 30,
            page: options.page || 1,
            sort: options.sort || 'updated',
        });

        return data.map(repo => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            htmlUrl: repo.html_url,
            cloneUrl: repo.clone_url,
            sshUrl: repo.ssh_url,
            defaultBranch: repo.default_branch || 'main',
            private: repo.private,
        }));
    }

    /**
     * Create a webhook for a repository
     */
    async createWebhook(
        accessToken: string,
        owner: string,
        repo: string,
        webhookUrl: string,
        events: string[] = ['push', 'pull_request']
    ): Promise<{ id: number; url: string }> {
        console.log(`[GITHUB] Creating webhook for ${owner}/${repo}`);

        const octokit = new Octokit({ auth: accessToken });

        const { data } = await octokit.repos.createWebhook({
            owner,
            repo,
            config: {
                url: webhookUrl,
                content_type: 'json',
                secret: process.env.GITHUB_WEBHOOK_SECRET,
            },
            events,
            active: true,
        });

        console.log(`[GITHUB] Webhook created: ${data.id}`);

        return {
            id: data.id,
            url: data.url,
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        console.log('[GITHUB] Shutting down GitHub service...');
        this.initialized = false;
        console.log('[GITHUB] GitHub service shutdown complete');
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: GitHubService | null = null;

export function getGitHubService(): GitHubService {
    if (!instance) {
        instance = new GitHubService();
    }
    return instance;
}

export function createGitHubService(config?: Partial<GitHubConfig>): GitHubService {
    instance = new GitHubService(config);
    return instance;
}

// ============================================
// EXPORTS
// ============================================

export default {
    GitHubService,
    getGitHubService,
    createGitHubService,
};
