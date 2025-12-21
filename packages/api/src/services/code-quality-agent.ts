/**
 * Code Quality Agent (Phase 25)
 * 
 * Validates and fixes ALL generated code before writing to disk.
 * 
 * Capabilities:
 * - Deduplication: Detect and resolve duplicate file paths
 * - Truncation Detection: Find incomplete files
 * - Import Resolution: Validate all imports exist
 * - Syntax Validation: Fix language mixing
 * - Architecture Consistency: Ensure single framework
 * - Entity Validation: Verify entities are implemented
 * - Auto-Fix: Apply automatic fixes where possible
 * - Learning Integration: Log issues as anti-patterns
 * 
 * @see docs/Guide/FEATURE_INTEGRATION_GUIDE.md
 */

import { getLearningService, type LearningService } from './learning-service.js';
import { getVectorLearningSystem, type VectorLearningSystem } from './vector-learning-system.js';
import type { ExtractedEntity } from './entity-extractor.js';
import { getSupabaseAdmin } from './database-client.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export interface QualityCheck {
    name: string;
    passed: boolean;
    issues: string[];
    autoFixApplied: boolean;
    fixDetails?: string;
}

export interface QualityReport {
    overallScore: number; // 0-100
    checks: QualityCheck[];
    filesModified: string[];
    issuesLogged: number;
    patternsExtracted: string[];
}

export interface QualityAgentConfig {
    enableAutoFix: boolean;
    enableLearning: boolean;
    qualityThreshold: number; // Minimum score to proceed (0-100)
    maxAutoFixAttempts: number;
}

export interface ValidationContext {
    originalPrompt: string;
    entities: ExtractedEntity[];
    framework: string;
    language: string;
    subtasks: string[];
    projectId?: string;
}

interface GenerationIssue {
    type: string;
    filePath?: string;
    details: Record<string, unknown>;
    resolution: 'auto_fixed' | 'regenerated' | 'manual' | 'unresolved';
    resolutionDetails?: Record<string, unknown>;
}

// ============================================
// CODE QUALITY AGENT CLASS
// ============================================

export class CodeQualityAgent {
    private config: QualityAgentConfig;
    private learningService: LearningService;
    private vectorSystem: VectorLearningSystem;
    private initialized = false;
    private supabaseEnabled = false;

    constructor(config?: Partial<QualityAgentConfig>) {
        this.config = {
            enableAutoFix: config?.enableAutoFix ?? true,
            enableLearning: config?.enableLearning ?? true,
            qualityThreshold: config?.qualityThreshold ?? 60,
            maxAutoFixAttempts: config?.maxAutoFixAttempts ?? 3,
        };

        this.learningService = getLearningService();
        this.vectorSystem = getVectorLearningSystem();

        // Mark services as used (for future integration)
        void this.learningService;
        void this.vectorSystem;

        // Check Supabase availability
        this.supabaseEnabled = !!(
            process.env.SUPABASE_URL &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
    }

    /**
     * Initialize the agent
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        console.log('[CODE-QUALITY] Initializing Code Quality Agent...');
        this.initialized = true;
        console.log('[CODE-QUALITY] Code Quality Agent ready');
    }

    /**
     * MAIN ENTRY POINT - Validate and fix generated files
     */
    async validateAndFix(
        generatedFiles: Map<string, string>,
        context: ValidationContext
    ): Promise<{
        fixedFiles: Map<string, string>;
        report: QualityReport;
        shouldProceed: boolean;
    }> {
        console.log(`[CODE-QUALITY] Validating ${generatedFiles.size} files...`);

        const checks: QualityCheck[] = [];
        let fixedFiles = new Map(generatedFiles);

        // ============================================
        // CHECK 1: File Deduplication
        // ============================================
        const dedupeResult = await this.deduplicateFiles(fixedFiles);
        checks.push(dedupeResult.check);
        fixedFiles = dedupeResult.files;

        // ============================================
        // CHECK 2: Truncation Detection & Fix
        // ============================================
        const truncationResult = await this.fixTruncations(fixedFiles, context);
        checks.push(truncationResult.check);
        fixedFiles = truncationResult.files;

        // ============================================
        // CHECK 3: Import Resolution
        // ============================================
        const importResult = await this.resolveImports(fixedFiles, context);
        checks.push(importResult.check);
        fixedFiles = importResult.files;

        // ============================================
        // CHECK 4: Syntax Validation & Fix
        // ============================================
        const syntaxResult = await this.fixSyntaxIssues(fixedFiles, context.language);
        checks.push(syntaxResult.check);
        fixedFiles = syntaxResult.files;

        // ============================================
        // CHECK 5: Architecture Consistency
        // ============================================
        const archResult = await this.enforceArchitecture(fixedFiles, context.framework);
        checks.push(archResult.check);
        fixedFiles = archResult.files;

        // ============================================
        // CHECK 6: Entity Completeness
        // ============================================
        const entityResult = await this.validateEntities(fixedFiles, context.entities);
        checks.push(entityResult.check);

        // ============================================
        // CHECK 7: Single Entry Point
        // ============================================
        const entryResult = await this.validateEntryPoints(fixedFiles, context.language);
        checks.push(entryResult.check);
        fixedFiles = entryResult.files;

        // ============================================
        // CALCULATE OVERALL SCORE
        // ============================================
        const passedChecks = checks.filter(c => c.passed).length;
        const overallScore = Math.round((passedChecks / checks.length) * 100);

        console.log(`[CODE-QUALITY] Score: ${overallScore}/100 (${passedChecks}/${checks.length} checks passed)`);

        // ============================================
        // LOG TO LEARNING SYSTEM
        // ============================================
        let patternsExtracted: string[] = [];
        if (this.config.enableLearning) {
            patternsExtracted = await this.logToLearningSystem(
                checks,
                context,
                overallScore
            );
        }

        const report: QualityReport = {
            overallScore,
            checks,
            filesModified: [...fixedFiles.keys()],
            issuesLogged: checks.filter(c => !c.passed).length,
            patternsExtracted
        };

        return {
            fixedFiles,
            report,
            shouldProceed: overallScore >= this.config.qualityThreshold
        };
    }

    // ============================================
    // CHECK 1: FILE DEDUPLICATION
    // ============================================

    private async deduplicateFiles(files: Map<string, string>): Promise<{
        files: Map<string, string>;
        check: QualityCheck;
    }> {
        const seen = new Map<string, { content: string; originalPath: string }>();
        const duplicates: string[] = [];
        const fixedFiles = new Map<string, string>();

        for (const [path, content] of files) {
            const normalizedPath = this.normalizePath(path);

            if (seen.has(normalizedPath)) {
                duplicates.push(path);
                const existing = seen.get(normalizedPath)!;

                // Keep the more complete version (more lines, no truncation markers)
                const existingLines = existing.content.split('\n').length;
                const newLines = content.split('\n').length;
                const existingTruncated = this.hasTrancationMarkers(existing.content);
                const newTruncated = this.hasTrancationMarkers(content);

                // Prefer new version if it's longer AND not truncated, OR if existing is truncated
                if ((newLines > existingLines && !newTruncated) || existingTruncated) {
                    // New version is better
                    fixedFiles.delete(existing.originalPath);
                    fixedFiles.set(path, content);
                    seen.set(normalizedPath, { content, originalPath: path });
                }
                // Otherwise keep existing
            } else {
                seen.set(normalizedPath, { content, originalPath: path });
                fixedFiles.set(path, content);
            }
        }

        return {
            files: fixedFiles,
            check: {
                name: 'File Deduplication',
                passed: duplicates.length === 0,
                issues: duplicates.map(d => `Duplicate: ${d}`),
                autoFixApplied: duplicates.length > 0,
                fixDetails: duplicates.length > 0
                    ? `Removed ${duplicates.length} duplicates, kept most complete versions`
                    : undefined
            }
        };
    }

    // ============================================
    // CHECK 2: TRUNCATION DETECTION
    // ============================================

    private async fixTruncations(
        files: Map<string, string>,
        _context: ValidationContext
    ): Promise<{
        files: Map<string, string>;
        check: QualityCheck;
    }> {
        const issues: string[] = [];
        const fixedFiles = new Map<string, string>();

        for (const [path, content] of files) {
            const truncationCheck = this.detectTruncation(path, content);

            if (truncationCheck.isTruncated) {
                issues.push(`${path}: ${truncationCheck.reason}`);

                if (this.config.enableAutoFix) {
                    // Try to fix by removing trailing garbage
                    const fixed = this.attemptTruncationFix(content, path);
                    fixedFiles.set(path, fixed);
                } else {
                    fixedFiles.set(path, content);
                }
            } else {
                fixedFiles.set(path, content);
            }
        }

        return {
            files: fixedFiles,
            check: {
                name: 'Truncation Detection',
                passed: issues.length === 0,
                issues,
                autoFixApplied: issues.length > 0 && this.config.enableAutoFix,
                fixDetails: issues.length > 0
                    ? `Found ${issues.length} truncated files, attempted fixes`
                    : undefined
            }
        };
    }

    private detectTruncation(path: string, content: string): {
        isTruncated: boolean;
        reason: string;
    } {
        const ext = path.split('.').pop()?.toLowerCase();

        // Check for another file appended mid-content
        if (/\/\/\s*(package\.json|tsconfig\.json|README\.md)/m.test(content)) {
            return { isTruncated: true, reason: 'Another file appended mid-content' };
        }

        if (/^#\s*(requirements\.txt|setup\.py|README\.md)/m.test(content)) {
            return { isTruncated: true, reason: 'Another file appended mid-content' };
        }

        // Brace balance check for JS/TS
        if (['ts', 'js', 'tsx', 'jsx'].includes(ext || '')) {
            const opens = (content.match(/{/g) || []).length;
            const closes = (content.match(/}/g) || []).length;
            if (opens > closes + 2) { // Allow small imbalance for edge cases
                return { isTruncated: true, reason: `Unbalanced braces: ${opens} opens, ${closes} closes` };
            }
        }

        // Prisma schema check
        if (ext === 'prisma') {
            if (!content.includes('model ') && !content.includes('generator ')) {
                return { isTruncated: true, reason: 'Empty Prisma schema (no models or generators)' };
            }
        }

        // Python: check for incomplete class/function
        if (ext === 'py') {
            const lastDef = content.lastIndexOf('\ndef ');
            const lastClass = content.lastIndexOf('\nclass ');
            const lastBlock = Math.max(lastDef, lastClass);

            if (lastBlock > content.length - 50) {
                // Definition near end with little content after
                const afterBlock = content.substring(lastBlock);
                if (!afterBlock.includes(':') || afterBlock.trim().endsWith(':')) {
                    return { isTruncated: true, reason: 'Incomplete function/class definition' };
                }
            }
        }

        return { isTruncated: false, reason: '' };
    }

    private attemptTruncationFix(content: string, _path: string): string {
        // Remove any appended file content
        const patterns = [
            /\n\/\/\s*(package\.json|tsconfig\.json)[\s\S]*$/,
            /\n#\s*(requirements\.txt|setup\.py)[\s\S]*$/,
            /\n{\s*"name":\s*"[^"]+",\s*"version"[\s\S]*$/, // JSON appended
        ];

        let fixed = content;
        for (const pattern of patterns) {
            fixed = fixed.replace(pattern, '\n');
        }

        return fixed.trimEnd() + '\n';
    }

    // ============================================
    // CHECK 3: IMPORT RESOLUTION
    // ============================================

    private async resolveImports(
        files: Map<string, string>,
        _context: ValidationContext
    ): Promise<{
        files: Map<string, string>;
        check: QualityCheck;
    }> {
        const issues: string[] = [];
        const fixedFiles = new Map(files);
        const allPaths = new Set([...files.keys()].map(p => this.normalizePath(p)));

        for (const [path, content] of files) {
            const imports = this.extractImports(path, content);
            const missing: string[] = [];

            for (const imp of imports) {
                if (imp.isRelative) {
                    const resolvedPath = this.resolveRelativePath(path, imp.path);
                    const normalizedResolved = this.normalizePath(resolvedPath);

                    // Check if the file exists
                    const exists = allPaths.has(normalizedResolved) ||
                        allPaths.has(normalizedResolved + '.ts') ||
                        allPaths.has(normalizedResolved + '.js') ||
                        allPaths.has(normalizedResolved + '/index.ts') ||
                        allPaths.has(normalizedResolved + '/index.js');

                    if (!exists) {
                        missing.push(imp.path);
                    }
                }
            }

            if (missing.length > 0) {
                issues.push(`${path}: Missing imports: ${missing.join(', ')}`);
            }
        }

        return {
            files: fixedFiles,
            check: {
                name: 'Import Resolution',
                passed: issues.length === 0,
                issues,
                autoFixApplied: false, // Complex to auto-fix, just report
                fixDetails: issues.length > 0
                    ? `Found ${issues.length} files with missing imports`
                    : undefined
            }
        };
    }

    private extractImports(path: string, content: string): Array<{
        path: string;
        isRelative: boolean;
        full: string;
    }> {
        const imports: Array<{ path: string; isRelative: boolean; full: string }> = [];
        const ext = path.split('.').pop()?.toLowerCase();

        if (['ts', 'js', 'tsx', 'jsx'].includes(ext || '')) {
            // TypeScript/JavaScript imports
            const importRegex = /import\s+(?:.*?from\s+)?['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                imports.push({
                    path: importPath,
                    isRelative: importPath.startsWith('.'),
                    full: match[0]
                });
            }
        } else if (ext === 'py') {
            // Python imports
            const fromImportRegex = /from\s+([.\w]+)\s+import/g;
            let match;
            while ((match = fromImportRegex.exec(content)) !== null) {
                const importPath = match[1];
                imports.push({
                    path: importPath,
                    isRelative: importPath.startsWith('.'),
                    full: match[0]
                });
            }
        }

        return imports;
    }

    // ============================================
    // CHECK 4: SYNTAX VALIDATION
    // ============================================

    private async fixSyntaxIssues(
        files: Map<string, string>,
        _language: string
    ): Promise<{
        files: Map<string, string>;
        check: QualityCheck;
    }> {
        const issues: string[] = [];
        const fixedFiles = new Map<string, string>();

        for (const [path, content] of files) {
            const ext = path.split('.').pop()?.toLowerCase();
            let fixed = content;

            // Python file with TypeScript syntax
            if (ext === 'py') {
                if (content.includes('export class ')) {
                    issues.push(`${path}: TypeScript 'export class' in Python file`);
                    fixed = fixed.replace(/^export\s+class\s+/gm, 'class ');
                }
                if (content.includes('export function ')) {
                    fixed = fixed.replace(/^export\s+function\s+/gm, 'def ');
                }
                if (content.includes('export const ')) {
                    fixed = fixed.replace(/^export\s+const\s+/gm, '');
                }
            }

            // TypeScript file with Python syntax
            if (['ts', 'js'].includes(ext || '')) {
                if (/^def\s+\w+\s*\(/m.test(content)) {
                    issues.push(`${path}: Python 'def' in TypeScript file`);
                    // Can't auto-fix this reliably
                }
            }

            fixedFiles.set(path, this.config.enableAutoFix ? fixed : content);
        }

        return {
            files: fixedFiles,
            check: {
                name: 'Syntax Validation',
                passed: issues.length === 0,
                issues,
                autoFixApplied: issues.length > 0 && this.config.enableAutoFix,
                fixDetails: issues.length > 0
                    ? `Fixed ${issues.length} syntax mixing issues`
                    : undefined
            }
        };
    }

    // ============================================
    // CHECK 5: ARCHITECTURE CONSISTENCY
    // ============================================

    private async enforceArchitecture(
        files: Map<string, string>,
        _expectedFramework: string
    ): Promise<{
        files: Map<string, string>;
        check: QualityCheck;
    }> {
        const issues: string[] = [];
        const detectedFrameworks = new Set<string>();

        for (const [_path, content] of files) {
            const framework = this.detectFramework(content);
            if (framework) {
                detectedFrameworks.add(framework);
            }
        }

        // Check for framework mixing
        if (detectedFrameworks.size > 1) {
            issues.push(`Multiple frameworks detected: ${[...detectedFrameworks].join(', ')}`);
        }

        // Check for forbidden patterns
        for (const [path, content] of files) {
            if (content.includes('require(\'express\')') || content.includes('from \'express\'')) {
                issues.push(`${path}: Express is forbidden (use Fastify)`);
            }
            if (content.includes('mongoose.connect') || content.includes('from \'mongoose\'')) {
                issues.push(`${path}: Mongoose is forbidden (use Prisma)`);
            }
        }

        return {
            files: files, // Architecture issues can't be auto-fixed
            check: {
                name: 'Architecture Consistency',
                passed: issues.length === 0,
                issues,
                autoFixApplied: false,
                fixDetails: issues.length > 0
                    ? `Found ${issues.length} architecture violations`
                    : undefined
            }
        };
    }

    private detectFramework(content: string): string | null {
        if (content.includes('@Module(') || content.includes('@Injectable(')) {
            return 'NestJS';
        }
        if (content.includes('Fastify(') || content.includes('fastify.register')) {
            return 'Fastify';
        }
        if (content.includes('FastAPI(') || content.includes('from fastapi')) {
            return 'FastAPI';
        }
        if (content.includes('express()') || content.includes('from \'express\'')) {
            return 'Express';
        }
        return null;
    }

    // ============================================
    // CHECK 6: ENTITY VALIDATION
    // ============================================

    private async validateEntities(
        files: Map<string, string>,
        entities: ExtractedEntity[]
    ): Promise<{
        check: QualityCheck;
    }> {
        const issues: string[] = [];
        const allContent = [...files.values()].join('\n');

        for (const entity of entities) {
            // Check if entity name appears in any file
            const entityRegex = new RegExp(`\\b${entity.name}\\b`, 'i');
            if (!entityRegex.test(allContent)) {
                issues.push(`Entity '${entity.name}' not implemented in any file`);
            }
        }

        return {
            check: {
                name: 'Entity Completeness',
                passed: issues.length === 0,
                issues,
                autoFixApplied: false,
                fixDetails: issues.length > 0
                    ? `Missing ${issues.length} entities from implementation`
                    : undefined
            }
        };
    }

    // ============================================
    // CHECK 7: SINGLE ENTRY POINT
    // ============================================

    private async validateEntryPoints(
        files: Map<string, string>,
        language: string
    ): Promise<{
        files: Map<string, string>;
        check: QualityCheck;
    }> {
        const entryPointPatterns = language === 'python'
            ? ['app.py', 'main.py', '__main__.py']
            : ['index.ts', 'main.ts', 'app.ts', 'server.ts'];

        const foundEntryPoints: string[] = [];
        const fixedFiles = new Map(files);

        for (const [path, _content] of files) {
            const filename = path.split(/[/\\]/).pop() || '';
            if (entryPointPatterns.includes(filename)) {
                foundEntryPoints.push(path);
            }
        }

        const issues: string[] = [];
        if (foundEntryPoints.length > 1) {
            issues.push(`Multiple entry points found: ${foundEntryPoints.join(', ')}`);

            // Keep only the first one that matches package.json main
            // For now, prefer index.ts/app.py
            if (this.config.enableAutoFix) {
                const preferred = foundEntryPoints.find(p =>
                    p.includes('index.ts') || p.includes('app.py')
                ) || foundEntryPoints[0];

                for (const ep of foundEntryPoints) {
                    if (ep !== preferred && (ep.includes('main.ts') || ep.includes('server.ts'))) {
                        // Don't delete, but flag it
                        // In future: merge or remove duplicate entry points
                    }
                }
            }
        }

        return {
            files: fixedFiles,
            check: {
                name: 'Single Entry Point',
                passed: foundEntryPoints.length <= 1,
                issues,
                autoFixApplied: false,
                fixDetails: foundEntryPoints.length > 1
                    ? `Found ${foundEntryPoints.length} entry points (should be 1)`
                    : undefined
            }
        };
    }

    // ============================================
    // LEARNING SYSTEM INTEGRATION
    // ============================================

    private async logToLearningSystem(
        checks: QualityCheck[],
        context: ValidationContext,
        _score: number
    ): Promise<string[]> {
        const patterns: string[] = [];

        // Log failed checks as anti-patterns
        for (const check of checks.filter(c => !c.passed)) {
            try {
                await this.storeGenerationIssue({
                    type: check.name.toLowerCase().replace(/ /g, '_'),
                    details: {
                        issues: check.issues,
                        prompt: context.originalPrompt.substring(0, 200),
                        framework: context.framework,
                        language: context.language
                    },
                    resolution: check.autoFixApplied ? 'auto_fixed' : 'unresolved',
                    resolutionDetails: check.autoFixApplied
                        ? { fixDetails: check.fixDetails }
                        : undefined
                });

                patterns.push(`Anti-pattern: ${check.name}`);
            } catch (error) {
                console.error(`[CODE-QUALITY] Failed to log issue: ${error}`);
            }
        }

        console.log(`[CODE-QUALITY] Logged ${patterns.length} issues to learning system`);
        return patterns;
    }

    private async storeGenerationIssue(issue: GenerationIssue): Promise<void> {
        if (!this.supabaseEnabled) {
            return;
        }

        try {
            const supabase = getSupabaseAdmin();

            const { error } = await supabase
                .from('generation_issues')
                .insert({
                    id: uuidv4(),
                    issue_type: issue.type,
                    file_path: issue.filePath || null,
                    details: issue.details,
                    resolution: issue.resolution,
                    resolution_details: issue.resolutionDetails || null,
                    created_at: new Date().toISOString()
                });

            if (error) {
                // Table might not exist yet - that's okay
                if (!error.message.includes('does not exist')) {
                    console.warn(`[CODE-QUALITY] Failed to store issue: ${error.message}`);
                }
            }
        } catch (error) {
            console.warn(`[CODE-QUALITY] Database error: ${error}`);
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private normalizePath(path: string): string {
        return path
            .toLowerCase()
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .replace(/^\.\//, '')
            .replace(/\.(ts|js|tsx|jsx)$/, '');
    }

    private resolveRelativePath(fromPath: string, importPath: string): string {
        const fromDir = fromPath.split(/[/\\]/).slice(0, -1).join('/');

        if (importPath.startsWith('../')) {
            const parts = fromDir.split('/');
            const importParts = importPath.split('/');

            let upCount = 0;
            for (const part of importParts) {
                if (part === '..') upCount++;
                else break;
            }

            const baseParts = parts.slice(0, -upCount);
            const restParts = importParts.slice(upCount);

            return [...baseParts, ...restParts].join('/');
        } else if (importPath.startsWith('./')) {
            return `${fromDir}/${importPath.slice(2)}`;
        }

        return importPath;
    }

    private hasTrancationMarkers(content: string): boolean {
        return /\/\/\s*(package\.json|tsconfig\.json)/m.test(content) ||
            /^{\s*"name":/m.test(content.slice(-500));
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        console.log('[CODE-QUALITY] Code Quality Agent shutdown complete');
    }

    /**
     * Get agent status
     */
    getStatus(): { initialized: boolean; config: QualityAgentConfig } {
        return {
            initialized: this.initialized,
            config: this.config
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let instance: CodeQualityAgent | null = null;

export function getCodeQualityAgent(): CodeQualityAgent {
    if (!instance) {
        instance = new CodeQualityAgent();
    }
    return instance;
}

export function createCodeQualityAgent(config?: Partial<QualityAgentConfig>): CodeQualityAgent {
    return new CodeQualityAgent(config);
}
