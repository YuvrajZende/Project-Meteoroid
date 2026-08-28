/**
 * ============================================
 * DEPENDENCY AGENT - NPM PACKAGE MANAGEMENT
 * ============================================
 * 
 * The DependencyAgent is responsible for:
 * - Installing npm dependencies
 * - Managing package.json
 * - Running npm scripts
 * - Updating packages
 * - Cleaning node_modules
 * 
 * Owner: Person 4
 * Tier: 3 (Support Agent)
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as dotenv from "dotenv";
import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus,
    AgentTier,
} from '@loveable/shared';

dotenv.config();

const execAsync = promisify(exec);

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface DependencyConfig {
    packageManager: 'npm' | 'yarn' | 'pnpm';
    projectPath: string;
}

export interface InstallResult {
    success: boolean;
    installedPackages: string[];
    errors: string[];
    stdout: string;
    stderr: string;
    executionTime: number;
}

export interface PackageInfo {
    name: string;
    version: string;
    isDev: boolean;
}

// ============================================
// DEPENDENCY AGENT CLASS
// ============================================

export class DependencyAgent implements IAgent {
    // IAgent required properties
    public readonly id = 'dependency-agent';
    public readonly name = 'Dependency Agent';
    public readonly tier: AgentTier = 3;
    public readonly capabilities = [
        'npm-install',
        'package-management',
        'dependency-install',
        'npm-scripts',
        'package-update',
        'npm-init',
    ];
    public readonly description = 'Installs npm dependencies and manages packages';
    public readonly version = '1.0.0';

    private isInitialized = false;
    private packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm';
    private defaultTimeout = 300000; // 5 minutes

    constructor() { }

    // ============================================
    // IAgent INTERFACE METHODS
    // ============================================

    async initialize(config: AgentConfig): Promise<void> {
        console.log(`📦 [${this.name}] Initializing...`);

        if (config.customSettings?.packageManager) {
            this.packageManager = config.customSettings.packageManager as 'npm' | 'yarn' | 'pnpm';
        }

        this.isInitialized = true;
        console.log(`✅ [${this.name}] Initialized with ${this.packageManager}`);
    }

    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();
        const taskLower = input.task.toLowerCase();

        console.log(`📦 [${this.name}] Executing: ${input.task.substring(0, 50)}...`);

        try {
            const projectPath = (input.context?.projectPath as string) ||
                (input.context?.outputPath as string) ||
                process.cwd();

            let result: InstallResult;

            // Determine what action to take
            if (taskLower.includes('install') || taskLower.includes('add')) {
                // Extract packages to install
                const packages = this.extractPackages(input.task, input.context);
                const isDev = taskLower.includes('dev') || taskLower.includes('-d');

                if (packages.length > 0) {
                    result = await this.installPackages(packages, projectPath, isDev);
                } else {
                    // Just run npm install
                    result = await this.installAllDependencies(projectPath);
                }
            } else if (taskLower.includes('init')) {
                result = await this.initProject(projectPath);
            } else if (taskLower.includes('update')) {
                result = await this.updatePackages(projectPath);
            } else if (taskLower.includes('script') || taskLower.includes('run')) {
                const scriptName = this.extractScriptName(input.task);
                result = await this.runScript(scriptName, projectPath);
            } else if (taskLower.includes('clean')) {
                result = await this.cleanNodeModules(projectPath);
            } else {
                // Default: run npm install
                result = await this.installAllDependencies(projectPath);
            }

            const executionTime = Date.now() - startTime;

            return {
                success: result.success,
                message: result.success
                    ? `Successfully installed ${result.installedPackages.length} packages`
                    : `Installation failed: ${result.errors.join(', ')}`,
                metadata: {
                    executionTime,
                    projectPath,
                    packageManager: this.packageManager,
                    installedPackages: result.installedPackages,
                    errors: result.errors,
                    stdout: result.stdout,
                    stderr: result.stderr,
                },
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'DEPENDENCY_ERROR',
                    message: errorMessage,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                },
            };
        }
    }

    async healthCheck(): Promise<AgentHealthStatus> {
        // Check if npm/yarn/pnpm is available
        let npmAvailable = false;
        try {
            await execAsync(`${this.packageManager} --version`);
            npmAvailable = true;
        } catch {
            npmAvailable = false;
        }

        return {
            healthy: this.isInitialized && npmAvailable,
            message: npmAvailable
                ? `Dependency agent is ready (${this.packageManager})`
                : `${this.packageManager} not found`,
            details: {
                version: this.version,
                capabilities: this.capabilities,
                packageManager: this.packageManager,
            },
        };
    }

    async shutdown(): Promise<void> {
        console.log(`📦 [${this.name}] Shutting down...`);
        this.isInitialized = false;
    }

    // ============================================
    // PACKAGE MANAGEMENT METHODS
    // ============================================

    /**
     * Install all dependencies from package.json
     */
    async installAllDependencies(projectPath: string): Promise<InstallResult> {
        console.log(`📦 [${this.name}] Installing all dependencies in ${projectPath}`);

        const command = this.getInstallCommand();
        return this.runCommand(command, projectPath, 'all dependencies');
    }

    /**
     * Install specific packages
     */
    async installPackages(
        packages: string[],
        projectPath: string,
        isDev: boolean = false
    ): Promise<InstallResult> {
        console.log(`📦 [${this.name}] Installing ${packages.join(', ')} in ${projectPath}`);

        const command = this.getInstallPackagesCommand(packages, isDev);
        return this.runCommand(command, projectPath, packages.join(', '));
    }

    /**
     * Initialize a new npm project
     */
    async initProject(projectPath: string): Promise<InstallResult> {
        console.log(`📦 [${this.name}] Initializing project in ${projectPath}`);

        const command = `${this.packageManager} init -y`;
        return this.runCommand(command, projectPath, 'npm init');
    }

    /**
     * Update all packages
     */
    async updatePackages(projectPath: string): Promise<InstallResult> {
        console.log(`📦 [${this.name}] Updating packages in ${projectPath}`);

        let command: string;
        switch (this.packageManager) {
            case 'yarn':
                command = 'yarn upgrade';
                break;
            case 'pnpm':
                command = 'pnpm update';
                break;
            default:
                command = 'npm update';
        }

        return this.runCommand(command, projectPath, 'package update');
    }

    /**
     * Run an npm script
     */
    async runScript(scriptName: string, projectPath: string): Promise<InstallResult> {
        console.log(`📦 [${this.name}] Running script '${scriptName}' in ${projectPath}`);

        const command = `${this.packageManager} run ${scriptName}`;
        return this.runCommand(command, projectPath, `script:${scriptName}`);
    }

    /**
     * Clean node_modules
     */
    async cleanNodeModules(projectPath: string): Promise<InstallResult> {
        console.log(`📦 [${this.name}] Cleaning node_modules in ${projectPath}`);

        const nodeModulesPath = path.join(projectPath, 'node_modules');

        try {
            await fs.rm(nodeModulesPath, { recursive: true, force: true });
            return {
                success: true,
                installedPackages: [],
                errors: [],
                stdout: 'node_modules deleted',
                stderr: '',
                executionTime: 0,
            };
        } catch (error) {
            return {
                success: false,
                installedPackages: [],
                errors: [error instanceof Error ? error.message : 'Failed to clean'],
                stdout: '',
                stderr: '',
                executionTime: 0,
            };
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private getInstallCommand(): string {
        switch (this.packageManager) {
            case 'yarn':
                return 'yarn install';
            case 'pnpm':
                return 'pnpm install';
            default:
                return 'npm install';
        }
    }

    private getInstallPackagesCommand(packages: string[], isDev: boolean): string {
        const packagesStr = packages.join(' ');

        switch (this.packageManager) {
            case 'yarn':
                return isDev
                    ? `yarn add -D ${packagesStr}`
                    : `yarn add ${packagesStr}`;
            case 'pnpm':
                return isDev
                    ? `pnpm add -D ${packagesStr}`
                    : `pnpm add ${packagesStr}`;
            default:
                return isDev
                    ? `npm install --save-dev ${packagesStr}`
                    : `npm install ${packagesStr}`;
        }
    }

    private async runCommand(
        command: string,
        cwd: string,
        description: string
    ): Promise<InstallResult> {
        const startTime = Date.now();

        console.log(`  🔄 Running: ${command}`);

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: this.defaultTimeout,
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer
            });

            const executionTime = Date.now() - startTime;

            console.log(`  ✅ Completed in ${executionTime}ms`);

            return {
                success: true,
                installedPackages: [description],
                errors: [],
                stdout,
                stderr,
                executionTime,
            };
        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            const errorMsg = error.message || 'Unknown error';

            console.error(`  ❌ Failed: ${errorMsg}`);

            return {
                success: false,
                installedPackages: [],
                errors: [errorMsg],
                stdout: error.stdout || '',
                stderr: error.stderr || '',
                executionTime,
            };
        }
    }

    private extractPackages(task: string, context?: Record<string, unknown>): string[] {
        // Check context first
        if (context?.packages && Array.isArray(context.packages)) {
            return context.packages as string[];
        }

        if (context?.dependencies && Array.isArray(context.dependencies)) {
            return context.dependencies as string[];
        }

        // Try to extract from task string
        // Pattern: install express lodash axios
        const installMatch = task.match(/install\s+(.+?)(?:\s+(?:as|in|to)\s|$)/i);
        if (installMatch) {
            const packagesStr = installMatch[1];
            // Filter out common words
            const filtered = packagesStr.split(/\s+/).filter(pkg =>
                pkg.length > 0 &&
                !['the', 'and', 'or', 'with', 'as', 'dev', 'dependencies'].includes(pkg.toLowerCase()) &&
                /^[@a-z0-9]/.test(pkg)
            );
            if (filtered.length > 0) {
                return filtered;
            }
        }

        return [];
    }

    private extractScriptName(task: string): string {
        const match = task.match(/run\s+(\w+)/i);
        return match ? match[1] : 'dev';
    }

    // ============================================
    // PUBLIC UTILITY METHODS
    // ============================================

    /**
     * Install dependencies from a codegen output
     */
    async installFromCodegenOutput(
        codegenOutput: AgentOutput,
        projectPath: string
    ): Promise<InstallResult> {
        const dependencies: string[] = codegenOutput.metadata?.dependencies as string[] || [];
        const devDependencies: string[] = codegenOutput.metadata?.devDependencies as string[] || [];

        const results: InstallResult[] = [];

        // Install regular dependencies
        if (dependencies.length > 0) {
            console.log(`📦 [${this.name}] Installing dependencies: ${dependencies.join(', ')}`);
            results.push(await this.installPackages(dependencies, projectPath, false));
        }

        // Install dev dependencies
        if (devDependencies.length > 0) {
            console.log(`📦 [${this.name}] Installing devDependencies: ${devDependencies.join(', ')}`);
            results.push(await this.installPackages(devDependencies, projectPath, true));
        }

        // Combine results
        return {
            success: results.every(r => r.success),
            installedPackages: results.flatMap(r => r.installedPackages),
            errors: results.flatMap(r => r.errors),
            stdout: results.map(r => r.stdout).join('\n'),
            stderr: results.map(r => r.stderr).join('\n'),
            executionTime: results.reduce((sum, r) => sum + r.executionTime, 0),
        };
    }

    /**
     * Check if a package is installed
     */
    async isPackageInstalled(packageName: string, projectPath: string): Promise<boolean> {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(content);

            return !!(
                packageJson.dependencies?.[packageName] ||
                packageJson.devDependencies?.[packageName]
            );
        } catch {
            return false;
        }
    }

    /**
     * Get installed packages
     */
    async getInstalledPackages(projectPath: string): Promise<PackageInfo[]> {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(content);

            const packages: PackageInfo[] = [];

            for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
                packages.push({ name, version: version as string, isDev: false });
            }

            for (const [name, version] of Object.entries(packageJson.devDependencies || {})) {
                packages.push({ name, version: version as string, isDev: true });
            }

            return packages;
        } catch {
            return [];
        }
    }
}

// Export singleton instance
export const dependencyAgent = new DependencyAgent();

// Default export for dynamic loading
export default dependencyAgent;
