/**
 * Code Post-Processor Service
 * 
 * Phase 17: Code Generation Quality Improvement
 * Phase 26: Enhanced with DependencyRegistry and ImportRegistry
 * 
 * This service is responsible for:
 * 1. Parsing AI output (JSON or raw code)
 * 2. Extracting multiple files from AI response
 * 3. Fixing common formatting issues
 * 4. Ensuring imports are correct across files
 * 5. Generating proper entry point that connects all files
 * 6. Validating TypeScript before writing
 * 7. Auto-detecting and registering dependencies (Phase 26)
 * 8. Deduplicating imports across files (Phase 26)
 */

import { getDependencyRegistry, type DependencyRegistry } from '../registry/dependency-registry.js';
import { getImportRegistry, type ImportRegistry } from '../registry/import-registry.js';
import { getServiceFileGenerator, type ServiceFileGenerator } from '../registry/service-file-generator.js';

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
        deduplicatedImports: number;  // Phase 26
        detectedDependencies: number; // Phase 26
    };
    packageJson?: object;  // Phase 26: Auto-generated package.json
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
    // Phase 26: Service instances
    private dependencyRegistry: DependencyRegistry;
    private importRegistry: ImportRegistry;
    private serviceFileGenerator: ServiceFileGenerator;

    constructor() {
        this.dependencyRegistry = getDependencyRegistry();
        this.importRegistry = getImportRegistry();
        this.serviceFileGenerator = getServiceFileGenerator();
    }

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
        let deduplicatedImports = 0;
        let detectedDependencies = 0;

        console.log('[CODE-POSTPROCESSOR] Starting processing...');

        // Phase 26: Clear registries for fresh analysis
        this.dependencyRegistry.clear();
        this.importRegistry.clear();

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

        // Phase 26: Analyze dependencies across all files
        const fileMap = new Map<string, string>();
        for (const file of files) {
            fileMap.set(file.path, file.content);
            // Detect dependencies in each file
            const deps = this.dependencyRegistry.analyzeCode(file.content, file.path);
            detectedDependencies += deps.length;
        }

        // Language-aware processing
        let entryPoint: GeneratedFile | undefined;
        let packageJson: object | undefined;

        if (isTypeScriptProject) {
            // TypeScript/JavaScript processing
            // Phase 26: Deduplicate imports in each file using ImportRegistry
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const result = this.importRegistry.deduplicateImports(file.content, file.path);
                if (result.changesMade > 0) {
                    file.content = result.deduplicatedCode;
                    deduplicatedImports += result.changesMade;
                }
            }

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

            // Generate package.json for TypeScript/JavaScript projects
            packageJson = this.dependencyRegistry.generatePackageJson(projectName);

        } else if (projectLanguage === 'python') {
            // Python-specific processing
            console.log(`[CODE-POSTPROCESSOR] Processing Python project`);

            // Validate Python syntax for all .py files
            for (const file of files) {
                if (file.path.endsWith('.py')) {
                    const syntaxErrors = this.validatePythonSyntax(file.content);
                    if (syntaxErrors.length > 0) {
                        warnings.push(`${file.path}: ${syntaxErrors.join(', ')}`);
                    }
                }
            }

            // ORM Consistency Check - detect mixed Django ORM and SQLAlchemy
            const ormCheck = this.validateORMConsistency(files);
            if (ormCheck.hasMixedORM) {
                warnings.push(`⚠️ Mixed ORM detected: ${ormCheck.message}`);
                console.log(`[CODE-POSTPROCESSOR] WARNING: ${ormCheck.message}`);
            }

            // Fix Python imports across files
            const pythonImportResult = this.fixPythonImportsAcrossFiles(files);
            files = pythonImportResult.files;
            fixedImports = pythonImportResult.fixedCount;
            warnings.push(...pythonImportResult.warnings);

            // Ensure __init__.py files exist in Python packages
            files = this.ensurePythonInitFiles(files);

            // Generate Python entry point
            entryPoint = this.generatePythonEntryPoint(files, projectName);

            // Don't generate package.json for Python - leave it undefined
            packageJson = undefined;

        } else if (projectLanguage === 'go') {
            // Go processing
            console.log(`[CODE-POSTPROCESSOR] Processing Go project`);
            entryPoint = this.generateGoEntryPoint(files, projectName);
            packageJson = undefined;

        } else if (projectLanguage === 'rust') {
            // Rust processing
            console.log(`[CODE-POSTPROCESSOR] Processing Rust project`);
            entryPoint = this.generateRustEntryPoint(files, projectName);
            packageJson = undefined;

        } else if (projectLanguage === 'java') {
            // Java processing
            console.log(`[CODE-POSTPROCESSOR] Processing Java project`);
            entryPoint = this.generateJavaEntryPoint(files, projectName);
            packageJson = undefined;

        } else {
            // Other languages - basic processing
            console.log(`[CODE-POSTPROCESSOR] Processing ${projectLanguage} project (basic mode)`);
            entryPoint = {
                path: 'README.md',
                content: `# ${projectName}\n\nThis project was generated in ${projectLanguage}.\n\n## Getting Started\n\nPlease refer to the generated files for setup instructions.`,
                language: 'markdown',
                type: 'config',
            };
            packageJson = undefined;
        }

        // ============================================
        // STEP: Generate missing service files
        // ============================================
        // This ensures that all imported services are actually created
        console.log('[CODE-POSTPROCESSOR] Checking for missing service files...');

        const serviceAnalysis = this.serviceFileGenerator.analyzeAndGenerate(files);

        if (serviceAnalysis.generated.length > 0) {
            console.log(`[CODE-POSTPROCESSOR] Generated ${serviceAnalysis.generated.length} missing service files`);
            files.push(...serviceAnalysis.generated);

            // Add warnings for generated services
            for (const imp of serviceAnalysis.missing) {
                warnings.push(`Generated stub for ${imp.serviceName} (imported in ${imp.sourceFile})`);
            }
        }

        console.log('[CODE-POSTPROCESSOR] Processing complete');
        console.log(`  Project Language: ${projectLanguage}`);
        console.log(`  Files: ${files.length}`);
        console.log(`  Fixed imports: ${fixedImports}`);
        console.log(`  Removed JSON blocks: ${removedJsonBlocks}`);
        console.log(`  Added exports: ${addedExports}`);
        console.log(`  Deduplicated imports: ${deduplicatedImports}`);
        console.log(`  Detected dependencies: ${detectedDependencies}`);
        console.log(`  Generated services: ${serviceAnalysis.generated.length}`);

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
                deduplicatedImports,
                detectedDependencies,
            },
            packageJson,
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
                let endIndex: number;

                if (i < foundFiles.length - 1) {
                    // Find the actual start of the next file marker, not just go back 50 chars
                    const nextMarkerStart = foundFiles[i + 1].startIndex - foundFiles[i + 1].path.length - 20;
                    // Find the last newline before the next marker
                    const lastNewline = codeBlock.lastIndexOf('\n', nextMarkerStart);
                    endIndex = lastNewline > startIndex ? lastNewline : nextMarkerStart;
                } else {
                    endIndex = codeBlock.length;
                }

                let content = codeBlock.substring(startIndex, endIndex).trim();

                // Ensure balanced braces for code files
                if (this.isCodeFile(foundFiles[i].path)) {
                    content = this.ensureBalancedBraces(content);
                }

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

        // Import services (with alias if there are common names)
        const serviceNameCounts = new Map<string, number>();
        for (const service of services) {
            const relativePath = './' + service.path.replace(/^src\//, '').replace(/\.ts$/, '');
            const exports = this.extractExports(service.content);
            const exportItems: string[] = [];

            for (const exp of exports) {
                if (exp === 'default') continue;

                // Track name usage
                const count = serviceNameCounts.get(exp) || 0;
                serviceNameCounts.set(exp, count + 1);

                if (count > 0) {
                    // Generate alias based on file path
                    const pathParts = relativePath.split('/');
                    const fileName = pathParts[pathParts.length - 1];
                    const alias = `${fileName.replace(/[^a-zA-Z0-9]/g, '')}${exp}`;
                    exportItems.push(`${exp} as ${alias}`);
                } else {
                    exportItems.push(exp);
                }
            }

            if (exportItems.length > 0) {
                imports.push(`import { ${exportItems.join(', ')} } from '${relativePath}';`);
            }
        }

        // Import routes - GENERATE UNIQUE ALIASES to avoid conflicts
        const routeAliases: string[] = []; // Track actual alias names for registration

        for (const route of routes) {
            const relativePath = './' + route.path.replace(/^src\//, '').replace(/\.ts$/, '');
            const exports = this.extractExports(route.content);
            const routeExport = Array.from(exports).find(e =>
                e.toLowerCase().includes('route') || e.toLowerCase().includes('plugin') || e === 'router'
            );

            if (routeExport) {
                // Generate unique alias based on file name
                const pathParts = relativePath.split('/');
                const fileName = pathParts[pathParts.length - 1];
                // Convert to camelCase alias: routes/auth.ts -> authRoutes
                const baseName = fileName.replace(/[^a-zA-Z0-9]/g, '');
                const alias = `${baseName}${routeExport.charAt(0).toUpperCase() + routeExport.slice(1)}`;

                imports.push(`import { ${routeExport} as ${alias} } from '${relativePath}';`);
                routeRegistrations.push(`await app.register(${alias});`);
                routeAliases.push(alias);
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
     * Attempt to fix unbalanced braces and parentheses
     */
    tryFixUnbalancedSyntax(content: string): { content: string; fixed: boolean; fixes: string[] } {
        const fixes: string[] = [];
        let fixed = false;
        let result = content;

        // Count braces
        let openBraces = (result.match(/{/g) || []).length;
        let closeBraces = (result.match(/}/g) || []).length;

        // If more open braces, try adding closing braces at end
        if (openBraces > closeBraces) {
            const diff = openBraces - closeBraces;
            // Find the last line with content and add closing braces
            const lines = result.split('\n');
            let insertIndex = lines.length - 1;

            // Find last non-empty line
            while (insertIndex > 0 && lines[insertIndex].trim() === '') {
                insertIndex--;
            }

            // Add the missing closing braces with proper indentation
            for (let i = 0; i < diff; i++) {
                lines.splice(insertIndex + 1 + i, 0, '}');
            }

            result = lines.join('\n');
            fixes.push(`Added ${diff} missing closing brace(s)`);
            fixed = true;
        } else if (closeBraces > openBraces) {
            // If more close braces, try removing extra ones from the end
            const diff = closeBraces - openBraces;
            const lines = result.split('\n');
            let removed = 0;

            for (let i = lines.length - 1; i >= 0 && removed < diff; i--) {
                if (lines[i].trim() === '}') {
                    lines.splice(i, 1);
                    removed++;
                }
            }

            result = lines.join('\n');
            fixes.push(`Removed ${removed} extra closing brace(s)`);
            fixed = true;
        }

        // Count parentheses
        let openParens = (result.match(/\(/g) || []).length;
        let closeParens = (result.match(/\)/g) || []).length;

        // If more open parens, add closing ones
        if (openParens > closeParens) {
            const diff = openParens - closeParens;
            result = result.trimEnd() + ')'.repeat(diff) + '\n';
            fixes.push(`Added ${diff} missing closing parenthesis(es)`);
            fixed = true;
        } else if (closeParens > openParens) {
            // Remove extra close parens from end
            const diff = closeParens - openParens;
            result = result.replace(new RegExp(`\\)+$`), '');
            fixes.push(`Removed ${diff} extra closing parenthesis(es)`);
            fixed = true;
        }

        return { content: result, fixed, fixes };
    }

    /**
     * Validate and optionally fix TypeScript syntax issues
     */
    validateAndFixSyntax(content: string, filePath: string): { content: string; errors: string[]; fixed: boolean } {
        const initialErrors = this.validateTypescriptSyntax(content);

        if (initialErrors.length === 0) {
            return { content, errors: [], fixed: false };
        }

        // Try to fix the issues
        const fixResult = this.tryFixUnbalancedSyntax(content);

        if (fixResult.fixed) {
            console.log(`[SYNTAX-FIX] ${filePath}: ${fixResult.fixes.join(', ')}`);

            // Re-validate after fix
            const remainingErrors = this.validateTypescriptSyntax(fixResult.content);
            return {
                content: fixResult.content,
                errors: remainingErrors,
                fixed: true,
            };
        }

        return { content, errors: initialErrors, fixed: false };
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

    // ============================================
    // MULTI-LANGUAGE HELPER METHODS
    // ============================================

    /**
     * Check if a file is a code file that needs brace balancing
     */
    private isCodeFile(path: string): boolean {
        const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.java', '.cs', '.go', '.rs', '.py', '.rb', '.php'];
        return codeExtensions.some(ext => path.endsWith(ext));
    }

    /**
     * Ensure balanced braces in code content
     */
    private ensureBalancedBraces(content: string): string {
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;

        let result = content;

        // Add missing closing braces
        if (openBraces > closeBraces) {
            const diff = openBraces - closeBraces;
            result = result.trimEnd() + '\n' + '}'.repeat(diff);
        }

        return result;
    }

    /**
     * Validate Python syntax (basic checks)
     */
    private validatePythonSyntax(content: string): string[] {
        const errors: string[] = [];

        // Check for JavaScript-style comments
        if (content.match(/^\s*\/\//m)) {
            errors.push('Contains JavaScript-style comments (//)');
        }

        // Check for unbalanced parentheses
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
        }

        // Check for unbalanced brackets
        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/\]/g) || []).length;
        if (openBrackets !== closeBrackets) {
            errors.push(`Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`);
        }

        // Check for markdown code block markers
        if (content.includes('```')) {
            errors.push('Contains markdown code block markers');
        }

        // Check for var/let/const (JavaScript keywords in Python)
        if (content.match(/\b(var|let|const)\s+\w+\s*=/)) {
            errors.push('Contains JavaScript variable declarations');
        }

        return errors;
    }

    /**
     * Fix Python imports across files
     */
    private fixPythonImportsAcrossFiles(files: GeneratedFile[]): {
        files: GeneratedFile[];
        fixedCount: number;
        warnings: string[];
    } {
        const warnings: string[] = [];
        let fixedCount = 0;

        // Build module map
        const moduleMap = new Map<string, string>();
        for (const file of files) {
            if (file.path.endsWith('.py')) {
                // Convert file path to module path
                // e.g., 'src/services/auth_service.py' -> 'services.auth_service'
                const modulePath = file.path
                    .replace(/^src\//, '')
                    .replace(/\.py$/, '')
                    .replace(/\//g, '.');
                moduleMap.set(modulePath, file.path);
            }
        }

        // Check each file's imports
        for (const file of files) {
            if (!file.path.endsWith('.py')) continue;

            const importPattern = /^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
            let match;

            while ((match = importPattern.exec(file.content)) !== null) {
                const importedModule = match[1] || match[2];

                // Skip standard library and third-party imports
                if (this.isPythonStandardOrThirdParty(importedModule)) {
                    continue;
                }

                // Check if module exists
                if (!moduleMap.has(importedModule) && !moduleMap.has(importedModule.split('.')[0])) {
                    warnings.push(`${file.path}: Import '${importedModule}' may not exist in generated files`);
                }
            }
        }

        return { files, fixedCount, warnings };
    }

    /**
     * Check if a Python import is from standard library or known third-party
     */
    private isPythonStandardOrThirdParty(moduleName: string): boolean {
        const standardModules = [
            'os', 'sys', 'json', 'typing', 'datetime', 'pathlib', 'logging', 'asyncio',
            're', 'math', 'random', 'collections', 'itertools', 'functools', 'uuid',
            'hashlib', 'base64', 'time', 'enum', 'abc', 'dataclasses', 'contextlib',
        ];

        const thirdPartyPrefixes = [
            'django', 'flask', 'fastapi', 'sqlalchemy', 'pydantic', 'starlette',
            'rest_framework', 'celery', 'redis', 'pymongo', 'boto3', 'requests',
            'aiohttp', 'uvicorn', 'gunicorn', 'pytest', 'numpy', 'pandas',
        ];

        const firstPart = moduleName.split('.')[0];
        return standardModules.includes(firstPart) ||
            thirdPartyPrefixes.some(prefix => firstPart.startsWith(prefix));
    }

    /**
     * Validate ORM consistency - detect mixed Django ORM and SQLAlchemy
     */
    private validateORMConsistency(files: GeneratedFile[]): { hasMixedORM: boolean; message: string } {
        let hasDjangoORM = false;
        let hasSQLAlchemy = false;
        const djangoFiles: string[] = [];
        const sqlalchemyFiles: string[] = [];

        for (const file of files) {
            if (!file.path.endsWith('.py')) continue;

            // Detect Django ORM
            const djangoPatterns = [
                /from django\.db import/,
                /from django\.db\.models import/,
                /models\.Model/,
                /models\.CharField/,
                /models\.IntegerField/,
                /models\.ForeignKey/,
                /AbstractBaseUser/,
                /PermissionsMixin/,
            ];

            // Detect SQLAlchemy
            const sqlalchemyPatterns = [
                /from sqlalchemy/,
                /import sqlalchemy/,
                /declarative_base/,
                /Column\(/,
                /relationship\(/,
                /ForeignKey\(/,
                /create_engine/,
                /Session\(/,
            ];

            const hasDjango = djangoPatterns.some(p => p.test(file.content));
            const hasSQLAlch = sqlalchemyPatterns.some(p => p.test(file.content));

            if (hasDjango) {
                hasDjangoORM = true;
                djangoFiles.push(file.path);
            }
            if (hasSQLAlch) {
                hasSQLAlchemy = true;
                sqlalchemyFiles.push(file.path);
            }
        }

        if (hasDjangoORM && hasSQLAlchemy) {
            return {
                hasMixedORM: true,
                message: `Project uses both Django ORM (${djangoFiles.slice(0, 2).join(', ')}) and SQLAlchemy (${sqlalchemyFiles.slice(0, 2).join(', ')}). Consider using one ORM consistently.`,
            };
        }

        return { hasMixedORM: false, message: '' };
    }

    /**
     * Ensure Python packages have __init__.py files
     */
    private ensurePythonInitFiles(files: GeneratedFile[]): GeneratedFile[] {
        const directories = new Set<string>();

        // Collect all directories that contain .py files
        for (const file of files) {
            if (file.path.endsWith('.py')) {
                const parts = file.path.split('/');
                parts.pop(); // Remove the filename

                // Add all parent directories
                for (let i = 1; i <= parts.length; i++) {
                    directories.add(parts.slice(0, i).join('/'));
                }
            }
        }

        // Add __init__.py for each directory if missing
        for (const dir of directories) {
            const initPath = `${dir}/__init__.py`;
            const exists = files.some(f => f.path === initPath);

            if (!exists && dir !== '' && !dir.startsWith('.')) {
                files.push({
                    path: initPath,
                    content: `# ${dir.split('/').pop()} package\n`,
                    language: 'python',
                    type: 'code',
                });
            }
        }

        return files;
    }

    /**
     * Generate Python entry point
     */
    private generatePythonEntryPoint(files: GeneratedFile[], projectName: string): GeneratedFile {
        // Detect framework
        const isDjango = files.some(f =>
            f.content.includes('django') ||
            f.content.includes('DJANGO_SETTINGS_MODULE')
        );
        const isFastAPI = files.some(f =>
            f.content.includes('from fastapi') ||
            f.content.includes('FastAPI(')
        );
        const isFlask = files.some(f =>
            f.content.includes('from flask') ||
            f.content.includes('Flask(')
        );

        if (isDjango) {
            return this.generateDjangoEntryPoint(files, projectName);
        } else if (isFastAPI) {
            return this.generateFastAPIEntryPoint(files, projectName);
        } else if (isFlask) {
            return this.generateFlaskEntryPoint(files, projectName);
        }

        // Default to FastAPI style
        return this.generateFastAPIEntryPoint(files, projectName);
    }

    /**
     * Generate Django entry point (manage.py)
     */
    private generateDjangoEntryPoint(files: GeneratedFile[], projectName: string): GeneratedFile {
        const settingsModule = this.findDjangoSettingsModule(files) || 'config.settings';

        const content = `#!/usr/bin/env python
"""
${projectName} - Django Management Script
Generated by Loveable Backend Orchestrator
"""

import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${settingsModule}')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
`;

        return {
            path: 'manage.py',
            content,
            language: 'python',
            type: 'code',
        };
    }

    /**
     * Find Django settings module from generated files
     */
    private findDjangoSettingsModule(files: GeneratedFile[]): string | null {
        for (const file of files) {
            if (file.path.endsWith('settings.py')) {
                // Convert path to module
                return file.path
                    .replace(/^src\//, '')
                    .replace(/\.py$/, '')
                    .replace(/\//g, '.');
            }
        }
        return null;
    }

    /**
     * Generate FastAPI entry point
     */
    private generateFastAPIEntryPoint(files: GeneratedFile[], projectName: string): GeneratedFile {
        const routerImports: string[] = [];
        const routerRegistrations: string[] = [];

        // Find router files
        for (const file of files) {
            if (file.path.includes('/routes/') || file.path.includes('/routers/') || file.path.includes('_routes.py')) {
                const modulePath = file.path
                    .replace(/^src\//, '')
                    .replace(/\.py$/, '')
                    .replace(/\//g, '.');
                const routerName = file.path.split('/').pop()?.replace('.py', '') || 'router';

                routerImports.push(`from ${modulePath} import router as ${routerName}_router`);
                routerRegistrations.push(`app.include_router(${routerName}_router, prefix="/api/v1")`);
            }
        }

        const content = `"""
${projectName} - FastAPI Application
Generated by Loveable Backend Orchestrator
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="${projectName}",
    description="Generated API",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
${routerImports.length > 0 ? routerImports.join('\n') : '# Add your router imports here'}

${routerRegistrations.length > 0 ? routerRegistrations.join('\n') : '# Add your router registrations here'}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "Server is running"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to ${projectName}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`;

        return {
            path: 'main.py',
            content,
            language: 'python',
            type: 'code',
        };
    }

    /**
     * Generate Flask entry point
     */
    private generateFlaskEntryPoint(_files: GeneratedFile[], projectName: string): GeneratedFile {
        const content = `"""
${projectName} - Flask Application
Generated by Loveable Backend Orchestrator
"""

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'


@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "Server is running"})


@app.route('/')
def index():
    """Root endpoint"""
    return jsonify({"message": "Welcome to ${projectName}"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=True)
`;

        return {
            path: 'app.py',
            content,
            language: 'python',
            type: 'code',
        };
    }

    /**
     * Generate Go entry point
     */
    private generateGoEntryPoint(_files: GeneratedFile[], projectName: string): GeneratedFile {
        const content = `// ${projectName} - Go Application
// Generated by Loveable Backend Orchestrator

package main

import (
    "log"
    "os"

    "github.com/gin-gonic/gin"
    "github.com/joho/godotenv"
)

func main() {
    // Load .env file
    if err := godotenv.Load(); err != nil {
        log.Println("No .env file found")
    }

    // Set Gin mode
    if os.Getenv("GIN_MODE") == "release" {
        gin.SetMode(gin.ReleaseMode)
    }

    r := gin.Default()

    // Health check
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })

    // Welcome endpoint
    r.GET("/", func(c *gin.Context) {
        c.JSON(200, gin.H{"message": "Welcome to ${projectName}"})
    })

    // Start server
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    log.Printf("Server starting on port %s", port)
    if err := r.Run(":" + port); err != nil {
        log.Fatal(err)
    }
}
`;

        return {
            path: 'cmd/main.go',
            content,
            language: 'go',
            type: 'code',
        };
    }

    /**
     * Generate Rust entry point
     */
    private generateRustEntryPoint(_files: GeneratedFile[], projectName: string): GeneratedFile {
        const content = `//! ${projectName} - Rust Application
//! Generated by Loveable Backend Orchestrator

use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::Serialize;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
}

#[derive(Serialize)]
struct MessageResponse {
    message: String,
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok".to_string(),
    })
}

async fn index() -> impl Responder {
    HttpResponse::Ok().json(MessageResponse {
        message: format!("Welcome to ${projectName}"),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    env_logger::init();

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);

    println!("Starting server at http://{}", addr);

    HttpServer::new(|| {
        App::new()
            .route("/health", web::get().to(health))
            .route("/", web::get().to(index))
    })
    .bind(&addr)?
    .run()
    .await
}
`;

        return {
            path: 'src/main.rs',
            content,
            language: 'rust',
            type: 'code',
        };
    }

    /**
     * Generate Java entry point
     */
    private generateJavaEntryPoint(_files: GeneratedFile[], projectName: string): GeneratedFile {
        const packageName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');

        const content = `package com.${packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ${projectName} - Spring Boot Application
 * Generated by Loveable Backend Orchestrator
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
`;

        return {
            path: `src/main/java/com/${packageName}/Application.java`,
            content,
            language: 'java',
            type: 'code',
        };
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
