/**
 * ============================================
 * CODE WRITER AGENT - FILE WRITING OPERATIONS
 * ============================================
 * 
 * The CodeWriterAgent is responsible for:
 * - Writing generated code to actual files
 * - Updating existing files with new code
 * - Handling file content merging
 * - Managing backup and rollback
 * 
 * Owner: Person 4
 * Tier: 3 (Support Agent)
 */

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
    GeneratedFile,
} from '@loveable/shared';

dotenv.config();

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface WriteOperation {
    path: string;
    content: string;
    mode: 'create' | 'overwrite' | 'append' | 'merge';
    backup?: boolean;
}

export interface WriteResult {
    written: WrittenFile[];
    skipped: SkippedFile[];
    errors: WriteError[];
    backups: string[];
}

export interface WrittenFile {
    path: string;
    bytesWritten: number;
    mode: string;
}

export interface SkippedFile {
    path: string;
    reason: string;
}

export interface WriteError {
    path: string;
    error: string;
}

// ============================================
// CODE WRITER AGENT CLASS
// ============================================

export class CodeWriterAgent implements IAgent {
    // IAgent required properties
    public readonly id = 'codewriter-agent';
    public readonly name = 'Code Writer Agent';
    public readonly tier: AgentTier = 3;
    public readonly capabilities = [
        'file-writing',
        'code-writing',
        'file-update',
        'file-append',
        'backup-files',
        'overwrite-files',
    ];
    public readonly description = 'Writes generated code to files on the filesystem';
    public readonly version = '1.0.0';

    private isInitialized = false;
    private baseOutputPath: string = process.cwd();
    private createBackups: boolean = true;
    private backupDir: string = '.backups';

    constructor() { }

    // ============================================
    // IAgent INTERFACE METHODS
    // ============================================

    async initialize(config: AgentConfig): Promise<void> {
        console.log(`✍️ [${this.name}] Initializing...`);

        if (config.customSettings?.outputPath) {
            this.baseOutputPath = config.customSettings.outputPath as string;
        }
        if (config.customSettings?.createBackups !== undefined) {
            this.createBackups = config.customSettings.createBackups as boolean;
        }
        if (config.customSettings?.backupDir) {
            this.backupDir = config.customSettings.backupDir as string;
        }

        this.isInitialized = true;
        console.log(`✅ [${this.name}] Initialized, base path: ${this.baseOutputPath}`);
    }

    async execute(input: AgentInput): Promise<AgentOutput> {
        const startTime = Date.now();

        console.log(`✍️ [${this.name}] Executing task: ${input.task.substring(0, 50)}...`);

        try {
            // Get files from previous agent outputs or context
            const files = this.extractFilesFromInput(input);

            if (files.length === 0) {
                return {
                    success: false,
                    error: {
                        code: 'NO_FILES',
                        message: 'No files provided to write. Pass files in context.files or from previousOutputs.',
                    },
                    metadata: {
                        executionTime: Date.now() - startTime,
                    },
                };
            }

            // Determine output path
            const outputPath = (input.context?.outputPath as string) || this.baseOutputPath;

            // Write all files
            const result = await this.writeFiles(files, outputPath, {
                backup: this.createBackups,
                mode: (input.context?.writeMode as 'create' | 'overwrite') || 'create',
            });

            const executionTime = Date.now() - startTime;

            return {
                success: result.errors.length === 0,
                files: result.written.map(f => ({
                    path: f.path,
                    content: '',
                    type: 'code' as const,
                    language: 'typescript',
                })),
                message: `Wrote ${result.written.length} files, skipped ${result.skipped.length}, errors: ${result.errors.length}`,
                metadata: {
                    executionTime,
                    outputPath,
                    written: result.written,
                    skipped: result.skipped,
                    errors: result.errors,
                    backups: result.backups,
                },
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'WRITE_ERROR',
                    message: errorMessage,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                },
            };
        }
    }

    async healthCheck(): Promise<AgentHealthStatus> {
        return {
            healthy: this.isInitialized,
            message: this.isInitialized ? 'Code writer agent is ready' : 'Agent not initialized',
            details: {
                version: this.version,
                capabilities: this.capabilities,
                baseOutputPath: this.baseOutputPath,
                createBackups: this.createBackups,
            },
        };
    }

    async shutdown(): Promise<void> {
        console.log(`✍️ [${this.name}] Shutting down...`);
        this.isInitialized = false;
    }

    // ============================================
    // INPUT EXTRACTION
    // ============================================

    private extractFilesFromInput(input: AgentInput): GeneratedFile[] {
        const files: GeneratedFile[] = [];

        // Check context.files
        if (input.context?.files && Array.isArray(input.context.files)) {
            files.push(...(input.context.files as GeneratedFile[]));
        }

        // Check previousOutputs from other agents (like CodegenAgent)
        if (input.previousOutputs) {
            for (const output of input.previousOutputs) {
                if (output.files) {
                    files.push(...output.files);
                }
            }
        }

        return files;
    }

    // ============================================
    // FILE WRITING OPERATIONS
    // ============================================

    async writeFiles(
        files: GeneratedFile[],
        basePath: string,
        options: { backup?: boolean; mode?: 'create' | 'overwrite' }
    ): Promise<WriteResult> {
        const result: WriteResult = {
            written: [],
            skipped: [],
            errors: [],
            backups: [],
        };

        console.log(`✍️ [${this.name}] Writing ${files.length} files to ${basePath}`);

        for (const file of files) {
            const fullPath = path.join(basePath, file.path);

            try {
                // Check if file exists
                const exists = await this.fileExists(fullPath);

                if (exists && options.mode === 'create') {
                    result.skipped.push({
                        path: file.path,
                        reason: 'File already exists (mode: create)',
                    });
                    console.log(`  ⏭️ Skipped: ${file.path} (exists)`);
                    continue;
                }

                // Create backup if file exists and backup is enabled
                if (exists && options.backup) {
                    const backupPath = await this.createBackup(fullPath, basePath);
                    result.backups.push(backupPath);
                    console.log(`  📦 Backup: ${backupPath}`);
                }

                // Ensure directory exists
                await fs.mkdir(path.dirname(fullPath), { recursive: true });

                // Write the file
                await fs.writeFile(fullPath, file.content, 'utf-8');

                const stats = await fs.stat(fullPath);
                result.written.push({
                    path: file.path,
                    bytesWritten: stats.size,
                    mode: exists ? 'overwritten' : 'created',
                });
                console.log(`  ✅ Wrote: ${file.path} (${stats.size} bytes)`);

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                result.errors.push({
                    path: file.path,
                    error: errorMsg,
                });
                console.error(`  ❌ Error: ${file.path} - ${errorMsg}`);
            }
        }

        console.log(`✍️ [${this.name}] Write operation complete!`);
        console.log(`   Written: ${result.written.length}`);
        console.log(`   Skipped: ${result.skipped.length}`);
        console.log(`   Errors: ${result.errors.length}`);

        return result;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async createBackup(filePath: string, basePath: string): Promise<string> {
        const relativePath = path.relative(basePath, filePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(basePath, this.backupDir, `${relativePath}.${timestamp}.bak`);

        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.copyFile(filePath, backupPath);

        return backupPath;
    }

    // ============================================
    // PUBLIC UTILITY METHODS
    // ============================================

    /**
     * Write a single file
     */
    async writeSingleFile(
        filePath: string,
        content: string,
        options?: { backup?: boolean; overwrite?: boolean }
    ): Promise<WrittenFile> {
        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.baseOutputPath, filePath);

        const exists = await this.fileExists(fullPath);

        if (exists && !options?.overwrite) {
            throw new Error(`File already exists: ${filePath}. Set overwrite: true to replace.`);
        }

        if (exists && options?.backup) {
            await this.createBackup(fullPath, this.baseOutputPath);
        }

        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');

        const stats = await fs.stat(fullPath);
        return {
            path: filePath,
            bytesWritten: stats.size,
            mode: exists ? 'overwritten' : 'created',
        };
    }

    /**
     * Append content to a file
     */
    async appendToFile(filePath: string, content: string): Promise<void> {
        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.baseOutputPath, filePath);

        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.appendFile(fullPath, content, 'utf-8');
    }

    /**
     * Read a file's content
     */
    async readFile(filePath: string): Promise<string> {
        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.baseOutputPath, filePath);

        return fs.readFile(fullPath, 'utf-8');
    }

    /**
     * Delete a file
     */
    async deleteFile(filePath: string, backup: boolean = true): Promise<void> {
        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.baseOutputPath, filePath);

        if (backup) {
            await this.createBackup(fullPath, this.baseOutputPath);
        }

        await fs.unlink(fullPath);
    }

    /**
     * Write multiple files from CodegenAgent output
     */
    async writeFromCodegenOutput(
        codegenOutput: AgentOutput,
        basePath?: string
    ): Promise<WriteResult> {
        const outputPath = basePath || this.baseOutputPath;

        if (!codegenOutput.files) {
            return {
                written: [],
                skipped: [],
                errors: [{ path: '', error: 'No files in codegen output' }],
                backups: [],
            };
        }

        return this.writeFiles(codegenOutput.files, outputPath, {
            backup: this.createBackups,
            mode: 'create',
        });
    }
}

// Export singleton instance
export const codeWriterAgent = new CodeWriterAgent();

// Default export for dynamic loading
export default codeWriterAgent;
