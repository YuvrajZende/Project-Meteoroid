/**
 * File Deduplicator
 * 
 * Eliminates duplicate files by path, keeping the most complete version.
 * Works for ALL languages: TypeScript, Python, Go, Rust, Java, etc.
 * 
 * Problem: Multiple agents generate overlapping code (same file written 2-3 times)
 * Solution: Keep the version with most content, discard others
 */

export interface GeneratedFile {
    path: string;
    content: string;
    language?: string;
    type?: 'code' | 'config' | 'schema' | 'migration' | 'doc';
}

export interface DeduplicationResult {
    files: GeneratedFile[];
    duplicatesRemoved: number;
    duplicates: Array<{
        path: string;
        keptSize: number;
        discardedVersions: number;
    }>;
}

export class FileDeduplicator {
    /**
     * Deduplicate files by path, keeping the most complete version
     */
    deduplicate(files: GeneratedFile[]): DeduplicationResult {
        const fileMap = new Map<string, GeneratedFile>();
        const duplicates: DeduplicationResult['duplicates'] = [];
        let duplicatesRemoved = 0;

        for (const file of files) {
            const normalizedPath = this.normalizePath(file.path);
            const existing = fileMap.get(normalizedPath);

            if (existing) {
                // Found duplicate - keep the one with more content
                if (file.content.length > existing.content.length) {
                    fileMap.set(normalizedPath, file);
                    duplicates.push({
                        path: normalizedPath,
                        keptSize: file.content.length,
                        discardedVersions: 1,
                    });
                } else {
                    duplicates.push({
                        path: normalizedPath,
                        keptSize: existing.content.length,
                        discardedVersions: 1,
                    });
                }
                duplicatesRemoved++;
            } else {
                fileMap.set(normalizedPath, file);
            }
        }

        const deduplicatedFiles = Array.from(fileMap.values()).map(file => ({
            ...file,
            path: this.normalizeOutputPath(file.path),
        }));

        console.log(`[FILE-DEDUPLICATOR] Input: ${files.length} files, Output: ${deduplicatedFiles.length} files, Duplicates removed: ${duplicatesRemoved}`);

        return {
            files: deduplicatedFiles,
            duplicatesRemoved,
            duplicates,
        };
    }

    /**
     * Normalize path for comparison (case-insensitive, handle src/ prefix, semantic equivalence)
     */
    private normalizePath(path: string): string {
        if (!path || path.trim() === '') {
            return '';
        }

        let normalized = path
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/\/\.\//g, '/')
            .replace(/^\.\//, '')
            .toLowerCase()
            .trim();

        if (normalized.match(/[^\x00-\x7F]/)) {
            return '';
        }

        if (normalized.startsWith('@') && !normalized.match(/^@[\w-]+\//)) {
            return '';
        }

        if (normalized.startsWith('src/./')) {
            normalized = 'src/' + normalized.substring(6);
        }
        if (normalized.startsWith('src/')) {
            normalized = normalized.substring(4);
        }

        normalized = normalized
            .replace(/\.service\.ts$/, '-service.ts')
            .replace(/\.controller\.ts$/, '-controller.ts')
            .replace(/\.module\.ts$/, '-module.ts')
            .replace(/\.schema\.ts$/, '-schema.ts')
            .replace(/\.route\.ts$/, '-routes.ts')
            .replace(/\.routes\.ts$/, '-routes.ts');

        normalized = normalized.replace(/[-_]/g, '-');

        return normalized;
    }

    /**
     * Normalize path for output (ensure consistent format)
     */
    private normalizeOutputPath(path: string): string {
        if (!path || path.trim() === '') {
            return path;
        }

        let normalized = path
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/\/\.\//g, '/')
            .replace(/^\.\//, '');

        if (normalized.match(/[^\x00-\x7F]/)) {
            console.warn(`[FILE-DEDUPLICATOR] Skipping file with invalid characters: ${path}`);
            return '';
        }

        if (normalized.startsWith('@') && !normalized.match(/^@[\w-]+\//)) {
            console.warn(`[FILE-DEDUPLICATOR] Skipping invalid npm package path: ${path}`);
            return '';
        }

        if (normalized.includes('/./')) {
            normalized = normalized.replace(/\/\.\//g, '/');
        }

        return normalized;
    }

    /**
     * Check if a path is valid for file creation
     */
    isValidPath(path: string): boolean {
        if (!path || path.trim() === '') {
            return false;
        }
        if (path.match(/[^\x00-\x7F]/)) {
            return false;
        }
        if (path.startsWith('@') && !path.match(/^@[\w-]+\//)) {
            return false;
        }
        return true;
    }

    /**
     * Find all duplicates in a file list (for reporting)
     */
    findDuplicates(files: GeneratedFile[]): Map<string, GeneratedFile[]> {
        const pathGroups = new Map<string, GeneratedFile[]>();

        for (const file of files) {
            const normalizedPath = this.normalizePath(file.path);
            const group = pathGroups.get(normalizedPath) || [];
            group.push(file);
            pathGroups.set(normalizedPath, group);
        }

        // Only return paths with duplicates
        const duplicates = new Map<string, GeneratedFile[]>();
        for (const [path, group] of pathGroups) {
            if (group.length > 1) {
                duplicates.set(path, group);
            }
        }

        return duplicates;
    }

    /**
     * Merge content from multiple versions of the same file
     * Useful when different agents generate complementary code
     */
    mergeVersions(files: GeneratedFile[]): GeneratedFile {
        if (files.length === 0) {
            throw new Error('Cannot merge empty file list');
        }

        if (files.length === 1) {
            return files[0];
        }

        const path = files[0].path;
        const language = this.detectLanguage(path);

        // Sort by content length (longest first)
        const sorted = [...files].sort((a, b) => b.content.length - a.content.length);

        // Use the longest as base
        const base = sorted[0];
        let mergedContent = base.content;

        // Try to merge unique parts from other versions
        for (let i = 1; i < sorted.length; i++) {
            const additional = this.extractUniqueContent(base.content, sorted[i].content, language);
            if (additional.length > 0) {
                mergedContent = this.insertContent(mergedContent, additional, language);
            }
        }

        return {
            path,
            content: mergedContent,
            language,
            type: base.type,
        };
    }

    /**
     * Detect language from file extension
     */
    private detectLanguage(path: string): string {
        const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
        const langMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.kt': 'kotlin',
            '.cs': 'csharp',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
        };
        return langMap[ext] || 'unknown';
    }

    /**
     * Extract content that exists in source but not in target
     */
    private extractUniqueContent(target: string, source: string, _language: string): string {
        const targetLines = new Set(target.split('\n').map(l => l.trim()));
        const sourceLines = source.split('\n');

        const uniqueLines: string[] = [];
        let inUniqueBlock = false;
        let currentBlock: string[] = [];

        for (const line of sourceLines) {
            const trimmed = line.trim();

            // Skip empty lines and comments for comparison
            if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
                if (inUniqueBlock) {
                    currentBlock.push(line);
                }
                continue;
            }

            if (!targetLines.has(trimmed)) {
                if (!inUniqueBlock) {
                    inUniqueBlock = true;
                    currentBlock = [];
                }
                currentBlock.push(line);
            } else if (inUniqueBlock) {
                // End of unique block
                if (currentBlock.length > 0) {
                    uniqueLines.push(...currentBlock);
                }
                inUniqueBlock = false;
                currentBlock = [];
            }
        }

        // Don't forget trailing unique content
        if (currentBlock.length > 0) {
            uniqueLines.push(...currentBlock);
        }

        return uniqueLines.join('\n');
    }

    /**
     * Insert content at appropriate location based on language
     */
    private insertContent(base: string, addition: string, language: string): string {
        if (!addition.trim()) {
            return base;
        }

        // Simple approach: append with separator
        const separator = this.getSeparator(language);
        return base + '\n\n' + separator + '\n' + addition;
    }

    /**
     * Get comment separator for language
     */
    private getSeparator(language: string): string {
        const separators: Record<string, string> = {
            typescript: '// === Additional Generated Code ===',
            javascript: '// === Additional Generated Code ===',
            python: '# === Additional Generated Code ===',
            go: '// === Additional Generated Code ===',
            rust: '// === Additional Generated Code ===',
            java: '// === Additional Generated Code ===',
            ruby: '# === Additional Generated Code ===',
            php: '// === Additional Generated Code ===',
        };
        return separators[language] || '// === Additional Generated Code ===';
    }
}

// Singleton
let instance: FileDeduplicator | null = null;

export function getFileDeduplicator(): FileDeduplicator {
    if (!instance) {
        instance = new FileDeduplicator();
    }
    return instance;
}

export function createFileDeduplicator(): FileDeduplicator {
    instance = new FileDeduplicator();
    return instance;
}
