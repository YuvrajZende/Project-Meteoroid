/**
 * Repository Cloner
 * 
 * Clones GitHub repositories to local directories for analysis.
 * Supports:
 * - HTTPS and SSH URLs
 * - Shallow cloning (--depth 1)
 * - Branch selection
 * - Temp directory management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================
// TYPES
// ============================================

export interface CloneOptions {
    /** GitHub repository URL (HTTPS or SSH) */
    repoUrl: string;

    /** Branch to clone (default: main) */
    branch?: string;

    /** Target directory (default: temp directory) */
    targetDir?: string;

    /** Use shallow clone for faster cloning (default: true) */
    shallow?: boolean;

    /** Depth for shallow clone (default: 1) */
    depth?: number;

    /** Timeout in milliseconds (default: 120000 = 2 minutes) */
    timeout?: number;
}

export interface CloneResult {
    /** Whether the clone was successful */
    success: boolean;

    /** Local path where the repo was cloned */
    localPath: string;

    /** Repository name extracted from URL */
    repoName: string;

    /** Owner/organization name */
    owner: string;

    /** Branch that was cloned */
    branch: string;

    /** Commit hash of the cloned repo */
    commitHash?: string;

    /** Error message if clone failed */
    error?: string;

    /** Clone duration in milliseconds */
    duration: number;
}

export interface RepoMetadata {
    name: string;
    owner: string;
    url: string;
    branch: string;
    commitHash: string;
    clonedAt: Date;
    localPath: string;
}

// ============================================
// URL PARSING
// ============================================

/**
 * Parse a GitHub URL to extract owner and repo name
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - github.com/owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string; isValid: boolean } {
    // Remove trailing .git
    const cleanUrl = url.replace(/\.git$/, '');

    // HTTPS pattern: https://github.com/owner/repo
    const httpsMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (httpsMatch) {
        return { owner: httpsMatch[1], repo: httpsMatch[2], isValid: true };
    }

    // SSH pattern: git@github.com:owner/repo
    const sshMatch = cleanUrl.match(/git@github\.com:([^\/]+)\/(.+)/);
    if (sshMatch) {
        return { owner: sshMatch[1], repo: sshMatch[2], isValid: true };
    }

    return { owner: '', repo: '', isValid: false };
}

/**
 * Check if git is installed
 */
async function checkGitInstalled(): Promise<boolean> {
    try {
        await execAsync('git --version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the current commit hash
 */
async function getCommitHash(repoPath: string): Promise<string> {
    try {
        const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
        return stdout.trim();
    } catch {
        return 'unknown';
    }
}

/**
 * Get the default branch name
 */
async function getDefaultBranch(repoUrl: string): Promise<string> {
    try {
        const { stdout } = await execAsync(`git ls-remote --symref ${repoUrl} HEAD`);
        const match = stdout.match(/ref: refs\/heads\/(\S+)/);
        return match ? match[1] : 'main';
    } catch {
        return 'main';
    }
}

// ============================================
// REPO CLONER CLASS
// ============================================

export class RepoCloner {
    private tempBaseDir: string;

    constructor() {
        // Create a base temp directory for all clones
        this.tempBaseDir = path.join(os.tmpdir(), 'loveable-backend-clones');
    }

    /**
     * Ensure temp directory exists
     */
    private async ensureTempDir(): Promise<void> {
        try {
            await fs.promises.mkdir(this.tempBaseDir, { recursive: true });
        } catch {
            // Directory might already exist
        }
    }

    /**
     * Generate a unique directory name for the clone
     */
    private generateCloneDir(repoName: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return path.join(this.tempBaseDir, `${repoName}-${timestamp}-${random}`);
    }

    /**
     * Clone a GitHub repository
     */
    async clone(options: CloneOptions): Promise<CloneResult> {
        const startTime = Date.now();

        // Validate URL
        const { owner, repo, isValid } = parseGitHubUrl(options.repoUrl);
        if (!isValid) {
            return {
                success: false,
                localPath: '',
                repoName: '',
                owner: '',
                branch: '',
                error: `Invalid GitHub URL: ${options.repoUrl}`,
                duration: Date.now() - startTime,
            };
        }

        // Check git is installed
        const gitInstalled = await checkGitInstalled();
        if (!gitInstalled) {
            return {
                success: false,
                localPath: '',
                repoName: repo,
                owner,
                branch: '',
                error: 'Git is not installed or not in PATH',
                duration: Date.now() - startTime,
            };
        }

        // Ensure temp directory exists
        await this.ensureTempDir();

        // Determine target directory
        const targetDir = options.targetDir || this.generateCloneDir(repo);

        // Determine branch
        const branch = options.branch || await getDefaultBranch(options.repoUrl);

        // Build git clone command
        const args: string[] = ['clone'];

        if (options.shallow !== false) {
            args.push('--depth', String(options.depth || 1));
        }

        args.push('--branch', branch);
        args.push('--single-branch');
        args.push(options.repoUrl);
        args.push(targetDir);

        console.log(`[RepoCloner] Cloning ${owner}/${repo} (branch: ${branch})...`);
        console.log(`[RepoCloner] Target: ${targetDir}`);

        try {
            // Execute git clone
            await new Promise<void>((resolve, reject) => {
                const timeout = options.timeout || 120000;

                const gitProcess = spawn('git', args, {
                    stdio: 'pipe',
                    shell: process.platform === 'win32',
                });

                let stderr = '';

                gitProcess.stderr?.on('data', (data) => {
                    stderr += data.toString();
                    // Git outputs progress to stderr
                    process.stdout.write(data);
                });

                const timer = setTimeout(() => {
                    gitProcess.kill();
                    reject(new Error(`Clone timed out after ${timeout}ms`));
                }, timeout);

                gitProcess.on('close', (code) => {
                    clearTimeout(timer);
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Git clone failed with code ${code}: ${stderr}`));
                    }
                });

                gitProcess.on('error', (err) => {
                    clearTimeout(timer);
                    reject(err);
                });
            });

            // Get commit hash
            const commitHash = await getCommitHash(targetDir);

            console.log(`[RepoCloner] Clone complete. Commit: ${commitHash.substring(0, 8)}`);

            return {
                success: true,
                localPath: targetDir,
                repoName: repo,
                owner,
                branch,
                commitHash,
                duration: Date.now() - startTime,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Clean up partial clone if it exists
            try {
                await fs.promises.rm(targetDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }

            return {
                success: false,
                localPath: '',
                repoName: repo,
                owner,
                branch,
                error: errorMessage,
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Clone and return metadata
     */
    async cloneWithMetadata(options: CloneOptions): Promise<{ result: CloneResult; metadata?: RepoMetadata }> {
        const result = await this.clone(options);

        if (!result.success) {
            return { result };
        }

        const metadata: RepoMetadata = {
            name: result.repoName,
            owner: result.owner,
            url: options.repoUrl,
            branch: result.branch,
            commitHash: result.commitHash || 'unknown',
            clonedAt: new Date(),
            localPath: result.localPath,
        };

        return { result, metadata };
    }

    /**
     * Clean up a cloned repository
     */
    async cleanup(localPath: string): Promise<void> {
        try {
            await fs.promises.rm(localPath, { recursive: true, force: true });
            console.log(`[RepoCloner] Cleaned up: ${localPath}`);
        } catch (error) {
            console.error(`[RepoCloner] Failed to cleanup: ${localPath}`, error);
        }
    }

    /**
     * Clean up all cloned repositories in temp directory
     */
    async cleanupAll(): Promise<void> {
        try {
            await fs.promises.rm(this.tempBaseDir, { recursive: true, force: true });
            console.log(`[RepoCloner] Cleaned up all clones`);
        } catch (error) {
            console.error(`[RepoCloner] Failed to cleanup all`, error);
        }
    }

    /**
     * List all cloned repositories
     */
    async listClones(): Promise<string[]> {
        try {
            const entries = await fs.promises.readdir(this.tempBaseDir);
            return entries.map(e => path.join(this.tempBaseDir, e));
        } catch {
            return [];
        }
    }
}

// Export singleton
export const repoCloner = new RepoCloner();
export default repoCloner;
