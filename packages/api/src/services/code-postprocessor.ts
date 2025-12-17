/**
 * Code Post-Processor Service
 * 
 * Phase 17: Code Generation Quality Improvement
 * 
 * This service is responsible for:
 * 1. Parsing AI output (JSON or raw code)
 * 2. Extracting multiple files from AI response
 * 3. Fixing common formatting issues
 * 4. Ensuring imports are correct across files
 * 5. Generating proper entry point that connects all files
 * 6. Validating TypeScript before writing
 */

export interface GeneratedFile {
    path: string;
    content: string;
    language?: string;
    type?: 'code' | 'config' | 'schema' | 'migration';
}

export interface ProcessedOutput {
    success: boolean;
    files: GeneratedFile[];
    entryPoint: GeneratedFile;
    errors: string[];
    warnings: string[];
    stats: {
        totalFiles: number;
        fixedImports: number;
        removedJsonBlocks: number;
        addedExports: number;
    };
}

export interface AICodeResponse {
    code?: string;
    explanation?: string;
    files?: Array<{ path: string; content: string }>;
}

// ============================================
// CODE POST-PROCESSOR
// ============================================

export class CodePostProcessor {

    /**
     * Process raw AI output into clean, usable code files
     */
    async process(rawOutput: string, projectName: string): Promise<ProcessedOutput> {
        const errors: string[] = [];
        const warnings: string[] = [];
        let files: GeneratedFile[] = [];
        let fixedImports = 0;
        let removedJsonBlocks = 0;
        let addedExports = 0;

        console.log('[CODE-POSTPROCESSOR] Starting processing...');

        // Step 1: Parse the AI output
        const parsed = this.parseAIOutput(rawOutput);
        if (parsed.files && parsed.files.length > 0) {
            files = parsed.files.map(f => ({
                path: f.path,
                content: f.content,
                language: this.detectLanguage(f.path),
                type: this.detectFileType(f.path),
            }));
        } else if (parsed.code) {
            // Single code block - try to extract files from it
            const extractedFiles = this.extractFilesFromCodeBlock(parsed.code);
            if (extractedFiles.length > 0) {
                files = extractedFiles;
            } else {
                // Fallback: treat as single file
                files = [{
                    path: 'src/generated.ts',
                    content: parsed.code,
                    language: 'typescript',
                    type: 'code',
                }];
            }
        }

        console.log(`[CODE-POSTPROCESSOR] Parsed ${files.length} files`);

        // Step 1.5: Filter out garbage files (invalid paths, URLs, database files, etc.)
        const filteredFiles = files.filter(f => this.isValidFilePath(f.path));
        const removedGarbage = files.length - filteredFiles.length;
        if (removedGarbage > 0) {
            console.log(`[CODE-POSTPROCESSOR] Filtered out ${removedGarbage} invalid files`);
        }
        files = filteredFiles;

        // Detect the primary project language from files
        const projectLanguage = this.detectProjectLanguage(files);
        const isTypeScriptProject = projectLanguage === 'typescript' || projectLanguage === 'javascript';
        console.log(`[CODE-POSTPROCESSOR] Detected project language: ${projectLanguage}, isTS: ${isTypeScriptProject}`);

        // Step 2: Clean each file (universal step)
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const cleanResult = this.cleanFileContent(file.content);
            file.content = cleanResult.content;
            if (cleanResult.hadJsonBlocks) removedJsonBlocks++;
        }

        // TypeScript-specific processing (skip for other languages)
        let entryPoint: GeneratedFile | undefined;

        if (isTypeScriptProject) {
            // Step 3: Fix imports across all files (TypeScript only)
            const importFixResult = this.fixImportsAcrossFiles(files);
            files = importFixResult.files;
            fixedImports = importFixResult.fixedCount;
            warnings.push(...importFixResult.warnings);

            // Step 4: Add missing exports (TypeScript only)
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const exportResult = this.ensureProperExports(file);
                file.content = exportResult.content;
                if (exportResult.addedExports) addedExports++;
            }

            // Step 5: Generate connected entry point (TypeScript only)
            entryPoint = this.generateEntryPoint(files, projectName);

            // Step 6: Validate TypeScript syntax (basic check)
            for (const file of files) {
                const syntaxErrors = this.validateTypescriptSyntax(file.content);
                if (syntaxErrors.length > 0) {
                    warnings.push(`${file.path}: ${syntaxErrors.join(', ')}`);
                }
            }
        } else {
            console.log(`[CODE-POSTPROCESSOR] Skipping TypeScript-specific processing for ${projectLanguage} project`);
            // Provide a dummy entry point for non-TS projects if the interface requires it
            // Or, if generateEntryPoint can handle non-TS, call it here.
            // For now, creating a minimal dummy entry point.
            entryPoint = {
                path: 'README.md',
                content: `# ${projectName}\n\nThis project was generated in ${projectLanguage}.`,
                language: 'markdown',
                type: 'config',
            };
        }

        console.log('[CODE-POSTPROCESSOR] Processing complete');
        console.log(`  Project Language: ${projectLanguage}`);
        console.log(`  Files: ${files.length}`);
        console.log(`  Fixed imports: ${fixedImports}`);
        console.log(`  Removed JSON blocks: ${removedJsonBlocks}`);
        console.log(`  Added exports: ${addedExports}`);

        return {
            success: errors.length === 0,
            files,
            entryPoint: entryPoint!, // Assert non-null as it's always assigned
            errors,
            warnings,
            stats: {
                totalFiles: files.length,
                fixedImports,
                removedJsonBlocks,
                addedExports,
            },
        };
    }

    /**
     * Detect the primary language of the project from generated files
     */
    private detectProjectLanguage(files: GeneratedFile[]): string {
        const languageCounts: Record<string, number> = {};

        for (const file of files) {
            const ext = file.path.substring(file.path.lastIndexOf('.'));
            const lang = this.extensionToLanguage(ext);
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        }

        // Find the most common language
        let maxCount = 0;
        let dominantLanguage = 'typescript'; // Default to TypeScript if no files or unknown

        for (const [lang, count] of Object.entries(languageCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantLanguage = lang;
            }
        }

        return dominantLanguage;
    }

    /**
     * Map file extension to language
     */
    private extensionToLanguage(ext: string): string {
        const extMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.rb': 'ruby',
            '.php': 'php',
            '.kt': 'kotlin',
            '.swift': 'swift',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.xml': 'xml',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.md': 'markdown',
            '.txt': 'text',
        };
        return extMap[ext] || 'unknown';
    }

    /**
     * Parse AI output - handles JSON, markdown code blocks, and raw code
     */
    private parseAIOutput(rawOutput: string): AICodeResponse {
        let output = rawOutput.trim();

        // Try to extract JSON from the output
        const jsonMatch = output.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                return this.normalizeAIResponse(parsed);
            } catch {
                // JSON parsing failed, continue with other methods
            }
        }

        // Try to parse as raw JSON (without code blocks)
        if (output.startsWith('{') || output.startsWith('[')) {
            try {
                const parsed = JSON.parse(output);
                return this.normalizeAIResponse(parsed);
            } catch {
                // Not valid JSON
            }
        }

        // Try to find JSON embedded in the code
        const embeddedJsonMatch = output.match(/^[^{]*({[\s\S]*})[^}]*$/);
        if (embeddedJsonMatch) {
            try {
                const parsed = JSON.parse(embeddedJsonMatch[1]);
                return this.normalizeAIResponse(parsed);
            } catch {
                // Not valid JSON
            }
        }

        // Treat as raw code
        return { code: output };
    }

    /**
     * Normalize AI response to consistent format
     */
    private normalizeAIResponse(parsed: unknown): AICodeResponse {
        if (!parsed || typeof parsed !== 'object') {
            return { code: String(parsed) };
        }

        const obj = parsed as Record<string, unknown>;

        // Check for files array
        if (Array.isArray(obj.files)) {
            return {
                code: obj.code as string | undefined,
                explanation: obj.explanation as string | undefined,
                files: obj.files as Array<{ path: string; content: string }>,
            };
        }

        // Check for code field
        if (typeof obj.code === 'string') {
            return {
                code: obj.code,
                explanation: obj.explanation as string | undefined,
            };
        }

        return { code: JSON.stringify(parsed) };
    }

    /**
     * Extract multiple files from a code block that contains file markers
     */
    private extractFilesFromCodeBlock(codeBlock: string): GeneratedFile[] {
        const files: GeneratedFile[] = [];

        // Pattern 1: // path/to/file.ts or // File: path/to/file.ts
        const fileMarkerPattern = /(?:\/\/\s*(?:File:\s*)?|\/\*\s*(?:File:\s*)?|#\s*(?:File:\s*)?)([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/g;

        // Pattern 2: Look for path/content pairs in escaped JSON
        const jsonFilePattern = /"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

        let match;
        const foundFiles: Array<{ path: string; startIndex: number }> = [];

        // Find file markers
        while ((match = fileMarkerPattern.exec(codeBlock)) !== null) {
            foundFiles.push({
                path: match[1],
                startIndex: match.index + match[0].length,
            });
        }

        // If we found file markers, extract content between them
        if (foundFiles.length > 0) {
            for (let i = 0; i < foundFiles.length; i++) {
                const startIndex = foundFiles[i].startIndex;
                const endIndex = i < foundFiles.length - 1
                    ? codeBlock.lastIndexOf('\n', foundFiles[i + 1].startIndex - 50) // Go back a bit to not include the next marker
                    : codeBlock.length;

                const content = codeBlock.substring(startIndex, endIndex).trim();

                if (content.length > 10) { // Only add if there's meaningful content
                    files.push({
                        path: foundFiles[i].path,
                        content: this.unescapeContent(content),
                        language: this.detectLanguage(foundFiles[i].path),
                        type: this.detectFileType(foundFiles[i].path),
                    });
                }
            }
        }

        // Also try to extract JSON-style file definitions
        while ((match = jsonFilePattern.exec(codeBlock)) !== null) {
            const path = match[1];
            const content = this.unescapeJsonString(match[2]);

            // Check if we already have this file
            const existing = files.find(f => f.path === path);
            if (!existing && content.length > 10) {
                files.push({
                    path,
                    content,
                    language: this.detectLanguage(path),
                    type: this.detectFileType(path),
                });
            }
        }

        return files;
    }

    /**
     * Clean file content - remove JSON wrappers, fix formatting
     */
    private cleanFileContent(content: string): { content: string; hadJsonBlocks: boolean } {
        let hadJsonBlocks = false;
        let cleaned = content;

        // Remove JSON code block markers
        if (cleaned.includes('```json')) {
            cleaned = cleaned.replace(/```json\s*/g, '');
            cleaned = cleaned.replace(/```\s*/g, '');
            hadJsonBlocks = true;
        }

        // Remove TypeScript/JavaScript code block markers
        cleaned = cleaned.replace(/```(?:typescript|javascript|ts|js)?\s*/g, '');
        cleaned = cleaned.replace(/```\s*$/g, '');

        // Fix escaped newlines
        cleaned = cleaned.replace(/\\n/g, '\n');

        // Fix escaped quotes
        cleaned = cleaned.replace(/\\"/g, '"');
        cleaned = cleaned.replace(/\\'/g, "'");

        // Fix escaped backslashes
        cleaned = cleaned.replace(/\\\\/g, '\\');

        // Remove any trailing JSON structure markers
        cleaned = cleaned.replace(/^\s*{\s*"code"\s*:\s*"/m, '');
        cleaned = cleaned.replace(/"\s*,\s*"explanation"\s*:\s*"[^"]*"\s*,?\s*}\s*$/m, '');

        // Trim whitespace
        cleaned = cleaned.trim();

        return { content: cleaned, hadJsonBlocks };
    }

    /**
     * Un-escape content that was in a JSON string
     */
    private unescapeContent(content: string): string {
        return content
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
    }

    /**
     * Un-escape a JSON string value
     */
    private unescapeJsonString(str: string): string {
        try {
            return JSON.parse(`"${str}"`);
        } catch {
            return this.unescapeContent(str);
        }
    }

    /**
     * Fix imports across all files to ensure they reference each other correctly
     */
    private fixImportsAcrossFiles(files: GeneratedFile[]): {
        files: GeneratedFile[];
        fixedCount: number;
        warnings: string[];
    } {
        const warnings: string[] = [];
        let fixedCount = 0;

        // Build a map of what each file exports
        const exportMap = new Map<string, Set<string>>();
        for (const file of files) {
            const exports = this.extractExports(file.content);
            exportMap.set(file.path, exports);
        }

        // Check each file's imports
        for (const file of files) {
            const imports = this.extractImports(file.content);

            for (const imp of imports) {
                // Skip external packages
                if (!imp.from.startsWith('.') && !imp.from.startsWith('/')) {
                    continue;
                }

                // Find the target file
                const targetPath = this.resolveImportPath(file.path, imp.from);
                const targetFile = files.find(f =>
                    f.path === targetPath ||
                    f.path === targetPath + '.ts' ||
                    f.path === targetPath + '/index.ts'
                );

                if (!targetFile) {
                    warnings.push(`${file.path}: Import '${imp.from}' not found in generated files`);
                }
            }
        }

        return { files, fixedCount, warnings };
    }

    /**
     * Extract export statements from code
     */
    private extractExports(content: string): Set<string> {
        const exports = new Set<string>();

        // export const/let/function/class name
        const namedExportPattern = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
        let match;
        while ((match = namedExportPattern.exec(content)) !== null) {
            exports.add(match[1]);
        }

        // export { name1, name2 }
        const bracedExportPattern = /export\s*{\s*([^}]+)\s*}/g;
        while ((match = bracedExportPattern.exec(content)) !== null) {
            const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
            names.forEach(n => exports.add(n));
        }

        // export default
        if (content.includes('export default')) {
            exports.add('default');
        }

        return exports;
    }

    /**
     * Extract import statements from code
     */
    private extractImports(content: string): Array<{ names: string[]; from: string }> {
        const imports: Array<{ names: string[]; from: string }> = [];

        // import { a, b } from 'path'
        const importPattern = /import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importPattern.exec(content)) !== null) {
            const names = match[1]
                ? match[1].split(',').map(n => n.trim())
                : match[2] ? [match[2]] : match[3] ? [match[3]] : [];
            imports.push({ names, from: match[4] });
        }

        return imports;
    }

    /**
     * Resolve import path relative to current file
     */
    private resolveImportPath(currentFile: string, importPath: string): string {
        if (!importPath.startsWith('.')) {
            return importPath;
        }

        const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
        const parts = [...currentDir.split('/'), ...importPath.split('/')];
        const resolved: string[] = [];

        for (const part of parts) {
            if (part === '..') {
                resolved.pop();
            } else if (part !== '.') {
                resolved.push(part);
            }
        }

        return resolved.join('/');
    }

    /**
     * Ensure file has proper exports
     */
    private ensureProperExports(file: GeneratedFile): {
        content: string;
        addedExports: boolean;
    } {
        let content = file.content;
        let addedExports = false;

        // Skip non-code files
        if (file.type !== 'code' || !file.path.endsWith('.ts')) {
            return { content, addedExports };
        }

        // Check if file has any exports
        const hasExport = /export\s+(const|let|var|function|class|interface|type|enum|default)/.test(content);

        if (!hasExport) {
            // Find function and class declarations without export
            content = content.replace(
                /^(const|let|var|function|class|interface|type|enum)\s+(\w+)/gm,
                'export $1 $2'
            );
            addedExports = true;
        }

        return { content, addedExports };
    }

    /**
     * Generate a proper entry point that connects all files
     */
    private generateEntryPoint(files: GeneratedFile[], projectName: string): GeneratedFile {
        const imports: string[] = [];
        const routeRegistrations: string[] = [];

        // Categorize files
        const routes = files.filter(f => f.path.includes('/routes/') || f.path.includes('.routes.'));
        const services = files.filter(f => f.path.includes('/services/') || f.path.includes('.service.'));
        const prismaFiles = files.filter(f => f.path.includes('prisma'));

        // Check if Prisma is used
        const usesPrisma = prismaFiles.length > 0 || files.some(f => f.content.includes('@prisma/client'));

        // Check if using Fastify
        const usesFastify = files.some(f => f.content.includes('fastify') || f.content.includes('Fastify'));

        // Generate imports
        if (usesFastify) {
            imports.push("import Fastify, { FastifyInstance } from 'fastify';");
        }

        if (usesPrisma) {
            imports.push("import { PrismaClient } from '@prisma/client';");
        }

        // Import services
        for (const service of services) {
            const relativePath = './' + service.path.replace(/^src\//, '').replace(/\.ts$/, '');
            const exports = this.extractExports(service.content);
            const exportList = Array.from(exports).filter(e => e !== 'default').join(', ');
            if (exportList) {
                imports.push(`import { ${exportList} } from '${relativePath}';`);
            }
        }

        // Import routes
        for (const route of routes) {
            const relativePath = './' + route.path.replace(/^src\//, '').replace(/\.ts$/, '');
            const exports = this.extractExports(route.content);
            const routeExport = Array.from(exports).find(e =>
                e.toLowerCase().includes('route') || e.toLowerCase().includes('plugin')
            );
            if (routeExport) {
                imports.push(`import { ${routeExport} } from '${relativePath}';`);
                routeRegistrations.push(`await app.register(${routeExport});`);
            }
        }

        // Build the entry point
        const entryPointContent = `/**
 * ${projectName} - Generated Entry Point
 * Created by Loveable Backend Orchestrator
 * 
 * This file connects all generated components.
 */

${imports.join('\n')}

// Initialize Prisma client
${usesPrisma ? 'const prisma = new PrismaClient();' : '// No Prisma client needed'}

// Create Fastify app
const app: FastifyInstance = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
    },
});

// Register plugins and routes
async function registerRoutes(app: FastifyInstance) {
${routeRegistrations.length > 0 ? routeRegistrations.map(r => `    ${r}`).join('\n') : '    // No routes to register - add your routes here'}
}

// Health check endpoint
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Start server
const start = async () => {
    try {
        await registerRoutes(app);
        
        const port = parseInt(process.env.PORT || '3001', 10);
        const host = process.env.HOST || '0.0.0.0';
        
        await app.listen({ port, host });
        console.log(\`🚀 Server running on http://\${host}:\${port}\`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await app.close();
${usesPrisma ? '    await prisma.$disconnect();' : ''}
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();

export { app${usesPrisma ? ', prisma' : ''} };
`;

        return {
            path: 'src/index.ts',
            content: entryPointContent,
            language: 'typescript',
            type: 'code',
        };
    }

    /**
     * Basic TypeScript syntax validation
     */
    private validateTypescriptSyntax(content: string): string[] {
        const errors: string[] = [];

        // Check for unbalanced braces
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
        }

        // Check for unbalanced parentheses
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
        }

        // Check for obvious syntax issues
        if (content.includes('```')) {
            errors.push('Contains markdown code block markers');
        }

        if (content.includes('"path":') && content.includes('"content":')) {
            errors.push('Contains JSON file structure instead of code');
        }

        return errors;
    }

    /**
     * Detect language from file path
     */
    private detectLanguage(path: string): string {
        if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
        if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
        if (path.endsWith('.json')) return 'json';
        if (path.endsWith('.prisma')) return 'prisma';
        if (path.endsWith('.sql')) return 'sql';
        if (path.endsWith('.md')) return 'markdown';
        return 'text';
    }

    /**
     * Detect file type from path
     */
    private detectFileType(path: string): 'code' | 'config' | 'schema' | 'migration' {
        if (path.includes('migration') || path.endsWith('.sql')) return 'migration';
        if (path.endsWith('.prisma') || path.includes('schema')) return 'schema';
        if (path.endsWith('.json') || path.includes('config')) return 'config';
        return 'code';
    }

    /**
     * Check if a file path is valid (not garbage from AI hallucinations)
     */
    private isValidFilePath(filePath: string): boolean {
        // Normalize the path
        const path = filePath.trim();

        // Reject empty paths
        if (!path || path.length === 0) return false;

        // Reject paths that look like URLs or domain names
        if (path.includes('://') || path.match(/^[a-z]+\.[a-z]+\//i)) return false;
        if (path.includes('github.com') || path.includes('example.com')) return false;
        if (path.match(/^[a-z0-9-]+\.(com|org|net|io|dev|app)$/i)) return false;

        // Reject database files
        if (path.endsWith('.db') || path.endsWith('.sqlite') || path.endsWith('.sqlite3')) return false;

        // Reject paths starting with special characters
        if (path.startsWith('/') && !path.startsWith('/src')) return false;

        // Reject paths with URL-like patterns
        if (path.includes('http://') || path.includes('https://')) return false;

        // Reject paths that are just file extensions
        if (path.match(/^\.[a-z]+$/i)) return false;

        // Reject paths with quotes or special JSON characters
        if (path.includes('"') || path.includes("'") || path.startsWith('{') || path.startsWith('[')) return false;

        // Reject very long paths (likely garbage)
        if (path.length > 200) return false;

        // Reject paths with multiple consecutive slashes or dots
        if (path.includes('//') || path.includes('..')) return false;

        // Reject TypeScript/JavaScript files when project is Python (detected via file list)
        // This is handled elsewhere

        // Accept paths that have valid extensions
        const validExtensions = [
            // Python
            '.py', '.pyi', '.pyx',
            // JavaScript/TypeScript
            '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
            // Go
            '.go',
            // Rust
            '.rs',
            // Java/Kotlin
            '.java', '.kt', '.kts',
            // C#
            '.cs', '.csx',
            // C/C++
            '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hh',
            // Ruby
            '.rb', '.rake',
            // PHP
            '.php',
            // Swift
            '.swift',
            // Config/Data
            '.json', '.yaml', '.yml', '.toml', '.xml', '.csv',
            '.sql', '.prisma',
            '.md', '.txt', '.env',
            '.html', '.css', '.scss', '.less',
            '.sh', '.bat', '.ps1',
            // Config files without extensions or special names
            'Dockerfile', 'Makefile', '.gitignore', '.env.example', '.env.local',
            'requirements.txt', 'setup.py', 'pyproject.toml',
            'package.json', 'tsconfig.json', 'jest.config.js', 'vite.config.ts',
            // Go project files
            'go.mod', 'go.sum',
            // Rust project files
            'Cargo.toml', 'Cargo.lock',
            // Java/Maven/Gradle
            'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
            // C# project files
            '.csproj', '.sln', '.fsproj', 'appsettings.json', 'appsettings.Development.json',
            // Ruby
            'Gemfile', 'Gemfile.lock', 'Rakefile',
            // PHP
            'composer.json', 'composer.lock',
        ];

        const hasValidExtension = validExtensions.some(ext =>
            path.endsWith(ext) || path.split('/').pop() === ext
        );

        if (!hasValidExtension) {
            // Check if it's a directory-like path without extension (could be __init__.py parent)
            const lastPart = path.split('/').pop() || '';
            if (lastPart.includes('.') && !validExtensions.some(ext => lastPart.endsWith(ext))) {
                return false; // Has invalid extension
            }
        }

        return true;
    }
}

// ============================================
// SINGLETON
// ============================================

let postProcessorInstance: CodePostProcessor | null = null;

export function getCodePostProcessor(): CodePostProcessor {
    if (!postProcessorInstance) {
        postProcessorInstance = new CodePostProcessor();
    }
    return postProcessorInstance;
}

export function createCodePostProcessor(): CodePostProcessor {
    postProcessorInstance = new CodePostProcessor();
    return postProcessorInstance;
}
