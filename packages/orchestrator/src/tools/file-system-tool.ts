/**
 * ============================================
 * FILE SYSTEM TOOL - AGENT FILE OPERATIONS
 * ============================================
 * 
 * Allows agents to read/write files in the project.
 * Provides safe, sandboxed file access with validation.
 * 
 * Features:
 * - Read project files
 * - Write generated code to files
 * - Create directory structures
 * - Validate file paths for safety
 * - Track file modifications
 */

import * as fs from "fs";
import * as path from "path";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface FileOperation {
    id: string;
    type: "read" | "write" | "create" | "delete" | "mkdir";
    path: string;
    timestamp: Date;
    agentId: string;
    success: boolean;
    error?: string;
}

export interface FileContent {
    path: string;
    content: string;
    size: number;
    lastModified: Date;
    language: string;
}

export interface DirectoryListing {
    path: string;
    files: string[];
    directories: string[];
}

export interface WriteOptions {
    overwrite?: boolean;
    createDirs?: boolean;
    backup?: boolean;
}

// ============================================
// FILE SYSTEM TOOL CLASS
// ============================================

export class FileSystemTool {
    private projectRoot: string;
    private operationHistory: FileOperation[] = [];
    private allowedExtensions: string[] = [
        ".ts", ".js", ".tsx", ".jsx",
        ".json", ".yaml", ".yml",
        ".md", ".txt", ".env.example",
        ".prisma", ".sql", ".graphql",
        ".dockerfile", ".dockerignore",
        ".gitignore", ".eslintrc", ".prettierrc"
    ];
    private blockedPaths: string[] = [
        "node_modules",
        ".git",
        ".env",
        "dist",
        "build",
        ".secret"
    ];

    constructor(projectRoot?: string) {
        this.projectRoot = projectRoot || process.cwd();
    }

    // ============================================
    // VALIDATION
    // ============================================

    /**
     * Validate that a path is safe to access
     */
    private validatePath(filePath: string): { safe: boolean; reason?: string } {
        // Normalize path
        const normalizedPath = path.normalize(filePath);
        const absolutePath = path.isAbsolute(normalizedPath)
            ? normalizedPath
            : path.join(this.projectRoot, normalizedPath);

        // Check if path is within project root
        if (!absolutePath.startsWith(this.projectRoot)) {
            return { safe: false, reason: "Path is outside project root" };
        }

        // Check for blocked paths
        for (const blocked of this.blockedPaths) {
            if (absolutePath.includes(path.sep + blocked + path.sep) ||
                absolutePath.endsWith(path.sep + blocked) ||
                absolutePath.includes(blocked + path.sep)) {
                return { safe: false, reason: `Access to ${blocked} is blocked` };
            }
        }

        // Check extension for writes
        const ext = path.extname(absolutePath).toLowerCase();
        if (ext && !this.allowedExtensions.includes(ext)) {
            return { safe: false, reason: `Extension ${ext} is not allowed` };
        }

        return { safe: true };
    }

    /**
     * Get absolute path from relative
     */
    private resolvePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        return path.join(this.projectRoot, filePath);
    }

    // ============================================
    // READ OPERATIONS
    // ============================================

    /**
     * Read a file's content
     */
    async readFile(filePath: string, agentId: string): Promise<FileContent | null> {
        const validation = this.validatePath(filePath);
        if (!validation.safe) {
            this.recordOperation("read", filePath, agentId, false, validation.reason);
            console.log(`❌ [FileSystem] Read blocked: ${validation.reason}`);
            return null;
        }

        const absolutePath = this.resolvePath(filePath);

        try {
            if (!fs.existsSync(absolutePath)) {
                this.recordOperation("read", filePath, agentId, false, "File not found");
                return null;
            }

            const content = fs.readFileSync(absolutePath, "utf-8");
            const stats = fs.statSync(absolutePath);

            this.recordOperation("read", filePath, agentId, true);
            console.log(`📖 [FileSystem] Read: ${filePath} (${content.length} chars)`);

            return {
                path: filePath,
                content,
                size: stats.size,
                lastModified: stats.mtime,
                language: this.detectLanguage(filePath),
            };
        } catch (error: any) {
            this.recordOperation("read", filePath, agentId, false, error.message);
            console.error(`❌ [FileSystem] Read error: ${error.message}`);
            return null;
        }
    }

    /**
     * Read multiple files
     */
    async readFiles(filePaths: string[], agentId: string): Promise<FileContent[]> {
        const results: FileContent[] = [];
        for (const filePath of filePaths) {
            const content = await this.readFile(filePath, agentId);
            if (content) {
                results.push(content);
            }
        }
        return results;
    }

    /**
     * Check if file exists
     */
    fileExists(filePath: string): boolean {
        const validation = this.validatePath(filePath);
        if (!validation.safe) return false;

        const absolutePath = this.resolvePath(filePath);
        return fs.existsSync(absolutePath);
    }

    // ============================================
    // WRITE OPERATIONS
    // ============================================

    /**
     * Write content to a file
     */
    async writeFile(
        filePath: string,
        content: string,
        agentId: string,
        options: WriteOptions = {}
    ): Promise<boolean> {
        const validation = this.validatePath(filePath);
        if (!validation.safe) {
            this.recordOperation("write", filePath, agentId, false, validation.reason);
            console.log(`❌ [FileSystem] Write blocked: ${validation.reason}`);
            return false;
        }

        const absolutePath = this.resolvePath(filePath);
        const { overwrite = true, createDirs = true, backup = true } = options;

        try {
            // Check if file exists
            const exists = fs.existsSync(absolutePath);
            if (exists && !overwrite) {
                this.recordOperation("write", filePath, agentId, false, "File exists and overwrite=false");
                return false;
            }

            // Create backup if file exists
            if (exists && backup) {
                const backupPath = absolutePath + ".backup";
                fs.copyFileSync(absolutePath, backupPath);
            }

            // Create directories if needed
            if (createDirs) {
                const dir = path.dirname(absolutePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            }

            // Write file
            fs.writeFileSync(absolutePath, content, "utf-8");

            this.recordOperation("write", filePath, agentId, true);
            console.log(`📝 [FileSystem] Wrote: ${filePath} (${content.length} chars)`);

            return true;
        } catch (error: any) {
            this.recordOperation("write", filePath, agentId, false, error.message);
            console.error(`❌ [FileSystem] Write error: ${error.message}`);
            return false;
        }
    }

    /**
     * Append content to a file
     */
    async appendFile(
        filePath: string,
        content: string,
        agentId: string
    ): Promise<boolean> {
        const validation = this.validatePath(filePath);
        if (!validation.safe) {
            this.recordOperation("write", filePath, agentId, false, validation.reason);
            return false;
        }

        const absolutePath = this.resolvePath(filePath);

        try {
            fs.appendFileSync(absolutePath, content, "utf-8");
            this.recordOperation("write", filePath, agentId, true);
            console.log(`📝 [FileSystem] Appended to: ${filePath}`);
            return true;
        } catch (error: any) {
            this.recordOperation("write", filePath, agentId, false, error.message);
            return false;
        }
    }

    // ============================================
    // DIRECTORY OPERATIONS
    // ============================================

    /**
     * List contents of a directory
     */
    async listDirectory(dirPath: string, agentId: string): Promise<DirectoryListing | null> {
        const validation = this.validatePath(dirPath);
        if (!validation.safe) {
            console.log(`❌ [FileSystem] List blocked: ${validation.reason}`);
            return null;
        }

        const absolutePath = this.resolvePath(dirPath);

        try {
            if (!fs.existsSync(absolutePath)) {
                return null;
            }

            const items = fs.readdirSync(absolutePath, { withFileTypes: true });
            const files: string[] = [];
            const directories: string[] = [];

            for (const item of items) {
                // Skip blocked paths
                if (this.blockedPaths.includes(item.name)) continue;

                if (item.isDirectory()) {
                    directories.push(item.name);
                } else {
                    files.push(item.name);
                }
            }

            console.log(`📂 [FileSystem] Listed: ${dirPath} (${files.length} files, ${directories.length} dirs)`);

            return { path: dirPath, files, directories };
        } catch (error: any) {
            console.error(`❌ [FileSystem] List error: ${error.message}`);
            return null;
        }
    }

    /**
     * Create a directory
     */
    async createDirectory(dirPath: string, agentId: string): Promise<boolean> {
        const validation = this.validatePath(dirPath);
        if (!validation.safe) {
            this.recordOperation("mkdir", dirPath, agentId, false, validation.reason);
            return false;
        }

        const absolutePath = this.resolvePath(dirPath);

        try {
            if (!fs.existsSync(absolutePath)) {
                fs.mkdirSync(absolutePath, { recursive: true });
                this.recordOperation("mkdir", dirPath, agentId, true);
                console.log(`📁 [FileSystem] Created dir: ${dirPath}`);
            }
            return true;
        } catch (error: any) {
            this.recordOperation("mkdir", dirPath, agentId, false, error.message);
            return false;
        }
    }

    // ============================================
    // PROJECT STRUCTURE
    // ============================================

    /**
     * Get project structure (simplified tree)
     */
    async getProjectStructure(maxDepth: number = 3): Promise<string> {
        const structure: string[] = [];

        const walk = (dir: string, depth: number, prefix: string) => {
            if (depth > maxDepth) return;

            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                const filtered = items.filter(item => !this.blockedPaths.includes(item.name));

                filtered.forEach((item, index) => {
                    const isLast = index === filtered.length - 1;
                    const marker = isLast ? "└── " : "├── ";
                    const childPrefix = isLast ? "    " : "│   ";

                    structure.push(prefix + marker + item.name + (item.isDirectory() ? "/" : ""));

                    if (item.isDirectory()) {
                        walk(path.join(dir, item.name), depth + 1, prefix + childPrefix);
                    }
                });
            } catch {
                // Skip unreadable directories
            }
        };

        structure.push(path.basename(this.projectRoot) + "/");
        walk(this.projectRoot, 1, "");

        return structure.join("\n");
    }

    /**
     * Find files matching a pattern
     */
    async findFiles(pattern: string, dirPath: string = "."): Promise<string[]> {
        const absolutePath = this.resolvePath(dirPath);
        const results: string[] = [];
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));

        const walk = (dir: string) => {
            try {
                const items = fs.readdirSync(dir, { withFileTypes: true });

                for (const item of items) {
                    if (this.blockedPaths.includes(item.name)) continue;

                    const fullPath = path.join(dir, item.name);
                    const relativePath = path.relative(this.projectRoot, fullPath);

                    if (item.isDirectory()) {
                        walk(fullPath);
                    } else if (regex.test(item.name)) {
                        results.push(relativePath);
                    }
                }
            } catch {
                // Skip unreadable directories
            }
        };

        walk(absolutePath);
        return results;
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Detect language from file extension
     */
    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
            ".ts": "typescript",
            ".tsx": "typescript",
            ".js": "javascript",
            ".jsx": "javascript",
            ".json": "json",
            ".yaml": "yaml",
            ".yml": "yaml",
            ".md": "markdown",
            ".prisma": "prisma",
            ".sql": "sql",
            ".graphql": "graphql",
        };
        return languageMap[ext] || "text";
    }

    /**
     * Record an operation for history
     */
    private recordOperation(
        type: FileOperation["type"],
        filePath: string,
        agentId: string,
        success: boolean,
        error?: string
    ): void {
        this.operationHistory.push({
            id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type,
            path: filePath,
            timestamp: new Date(),
            agentId,
            success,
            error,
        });

        // Keep only last 100 operations
        if (this.operationHistory.length > 100) {
            this.operationHistory = this.operationHistory.slice(-100);
        }
    }

    /**
     * Get operation history
     */
    getHistory(limit: number = 20): FileOperation[] {
        return this.operationHistory.slice(-limit);
    }

    /**
     * Get history for an agent
     */
    getAgentHistory(agentId: string): FileOperation[] {
        return this.operationHistory.filter(op => op.agentId === agentId);
    }

    /**
     * Set project root
     */
    setProjectRoot(root: string): void {
        this.projectRoot = root;
    }

    /**
     * Get project root
     */
    getProjectRoot(): string {
        return this.projectRoot;
    }
}

// Export singleton instance
export const fileSystemTool = new FileSystemTool();
