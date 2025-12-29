/**
 * Code Quality Assessment Service
 * 
 * Evaluates generated code BEFORE postprocessing to:
 * 1. Check for completeness (all required components present)
 * 2. Verify code structure matches the blueprint
 * 3. Identify missing or incomplete files
 * 4. Suggest improvements or regeneration
 * 
 * This runs BETWEEN Power Model generation and Code Postprocessing
 */

import { getSupabaseAdmin } from '../infrastructure/database-client.js';

// ============================================
// TYPES
// ============================================

export interface QualityAssessmentConfig {
    enabled: boolean;
    minFilesRequired: number;
    requiredFileTypes: string[];
    checkDatabaseSchema: boolean;
    checkAuthImplementation: boolean;
    checkErrorHandling: boolean;
    minCodeLinesPerFile: number;
}

export interface QualityIssue {
    severity: 'error' | 'warning' | 'suggestion';
    category: 'missing_file' | 'incomplete_code' | 'missing_component' | 'structure' | 'best_practice';
    message: string;
    file?: string;
    suggestedFix?: string;
}

export interface QualityAssessmentResult {
    passed: boolean;
    score: number; // 0-100
    issues: QualityIssue[];
    summary: {
        totalFiles: number;
        completeFiles: number;
        incompleteFiles: number;
        missingComponents: string[];
        codeQualityScore: number;
        structureScore: number;
        completenessScore: number;
    };
    recommendations: string[];
    shouldRegenerate: boolean;
    regenerationPrompt?: string;
}

export interface GeneratedFile {
    path: string;
    content: string;
}

export interface ArchitectureBlueprint {
    routes: Array<{ method: string; path: string; handler: string; description: string }>;
    services: Array<{ name: string; methods: string[] }>;
    database: {
        tables: Array<{ name: string; columns: Array<{ name: string; type: string }> }>;
    };
    middleware: Array<{ name: string; order: number; description: string }>;
    asciiDiagram?: string;
}

// ============================================
// QUALITY ASSESSMENT SERVICE
// ============================================

export class QualityAssessmentService {
    private config: QualityAssessmentConfig;
    private initialized: boolean = false;

    constructor(config?: Partial<QualityAssessmentConfig>) {
        this.config = {
            enabled: config?.enabled ?? true,
            minFilesRequired: config?.minFilesRequired ?? 3,
            requiredFileTypes: config?.requiredFileTypes ?? ['entry', 'route', 'model'],
            checkDatabaseSchema: config?.checkDatabaseSchema ?? true,
            checkAuthImplementation: config?.checkAuthImplementation ?? true,
            checkErrorHandling: config?.checkErrorHandling ?? true,
            minCodeLinesPerFile: config?.minCodeLinesPerFile ?? 10,
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        console.log('[QUALITY] Quality Assessment Service initialized');
        this.initialized = true;
    }

    /**
     * Assess the quality of generated code
     */
    async assess(
        files: GeneratedFile[],
        blueprint?: ArchitectureBlueprint,
        language: string = 'typescript',
        framework: string = 'fastify'
    ): Promise<QualityAssessmentResult> {
        console.log(`[QUALITY] Assessing ${files.length} files for ${language}/${framework}`);

        const issues: QualityIssue[] = [];
        const recommendations: string[] = [];
        let score = 100;

        // 1. Check minimum files
        if (files.length < this.config.minFilesRequired) {
            issues.push({
                severity: 'error',
                category: 'missing_file',
                message: `Only ${files.length} files generated, minimum ${this.config.minFilesRequired} required`,
                suggestedFix: 'Regenerate with more explicit file requirements',
            });
            score -= 30;
        }

        // 2. Check for empty or minimal files
        const incompleteFiles: string[] = [];
        for (const file of files) {
            const lines = file.content.split('\n').filter(l => l.trim()).length;
            if (lines < this.config.minCodeLinesPerFile) {
                incompleteFiles.push(file.path);
                issues.push({
                    severity: 'warning',
                    category: 'incomplete_code',
                    message: `File ${file.path} has only ${lines} lines of code`,
                    file: file.path,
                    suggestedFix: 'File may be incomplete or a stub',
                });
                score -= 5;
            }
        }

        // 3. Check for required components based on language
        const componentChecks = this.checkRequiredComponents(files, language, framework);
        issues.push(...componentChecks.issues);
        score -= componentChecks.penalty;

        // 4. Check against blueprint if provided
        if (blueprint) {
            const blueprintChecks = this.checkAgainstBlueprint(files, blueprint);
            issues.push(...blueprintChecks.issues);
            score -= blueprintChecks.penalty;
        }

        // 5. Check for common patterns
        const patternChecks = this.checkCommonPatterns(files, language);
        issues.push(...patternChecks.issues);
        recommendations.push(...patternChecks.recommendations);
        score -= patternChecks.penalty;

        // 6. Calculate sub-scores
        const structureScore = this.calculateStructureScore(files, language);
        const completenessScore = Math.max(0, 100 - (incompleteFiles.length * 10));
        const codeQualityScore = this.calculateCodeQualityScore(files, language);

        // Final score
        score = Math.max(0, Math.min(100, score));
        const passed = score >= 60 && issues.filter(i => i.severity === 'error').length === 0;

        // Determine if regeneration is needed
        const shouldRegenerate = score < 40 || files.length === 0;
        let regenerationPrompt: string | undefined;

        if (shouldRegenerate) {
            regenerationPrompt = this.buildRegenerationPrompt(issues, blueprint, language, framework);
        }

        const result: QualityAssessmentResult = {
            passed,
            score,
            issues,
            summary: {
                totalFiles: files.length,
                completeFiles: files.length - incompleteFiles.length,
                incompleteFiles: incompleteFiles.length,
                missingComponents: issues
                    .filter(i => i.category === 'missing_component')
                    .map(i => i.message),
                codeQualityScore,
                structureScore,
                completenessScore,
            },
            recommendations,
            shouldRegenerate,
            regenerationPrompt,
        };

        // Store assessment for learning
        await this.storeAssessment(result, language, framework);

        console.log(`[QUALITY] Assessment complete: score=${score}, passed=${passed}, issues=${issues.length}`);
        return result;
    }

    /**
     * Check for required components based on language/framework
     */
    private checkRequiredComponents(
        files: GeneratedFile[],
        language: string,
        framework: string
    ): { issues: QualityIssue[]; penalty: number } {
        const issues: QualityIssue[] = [];
        let penalty = 0;

        const langLower = language.toLowerCase();
        const allContent = files.map(f => f.content).join('\n');

        // Check for entry point
        const entryPatterns: Record<string, RegExp[]> = {
            go: [/func\s+main\s*\(\)/],
            rust: [/fn\s+main\s*\(\)/],
            python: [/if\s+__name__\s*==\s*['""]__main__['""]/, /app\s*=\s*(Flask|FastAPI)/],
            java: [/public\s+static\s+void\s+main/, /@SpringBootApplication/],
            typescript: [/app\.listen\(/, /Fastify\(\)/],
            csharp: [/static\s+void\s+Main/, /WebApplication\.CreateBuilder/],
        };

        const patterns = entryPatterns[langLower] || entryPatterns['typescript'];
        const hasEntry = patterns.some(p => p.test(allContent));

        if (!hasEntry) {
            issues.push({
                severity: 'error',
                category: 'missing_component',
                message: `Missing entry point for ${language}`,
                suggestedFix: `Add a main/entry function for ${framework}`,
            });
            penalty += 20;
        }

        // Check for route handlers
        const routePatterns: Record<string, RegExp[]> = {
            go: [/\.(GET|POST|PUT|DELETE)\s*\(/, /gin\./],
            rust: [/\.route\(/, /web::(get|post|put|delete)/],
            python: [/@app\.(get|post|put|delete|route)/, /router\./],
            java: [/@(Get|Post|Put|Delete)Mapping/, /@RequestMapping/],
            typescript: [/\.(get|post|put|delete)\s*\(/, /fastify\./],
            csharp: [/\[Http(Get|Post|Put|Delete)\]/, /MapGet|MapPost/],
        };

        const routePats = routePatterns[langLower] || routePatterns['typescript'];
        const hasRoutes = routePats.some(p => p.test(allContent));

        if (!hasRoutes) {
            issues.push({
                severity: 'warning',
                category: 'missing_component',
                message: 'No HTTP route handlers found',
                suggestedFix: 'Add route handlers for API endpoints',
            });
            penalty += 10;
        }

        // Check for database/model patterns
        if (this.config.checkDatabaseSchema) {
            const dbPatterns: Record<string, RegExp[]> = {
                go: [/gorm\.Model/, /type\s+\w+\s+struct\s*{/],
                rust: [/diesel/, /#\[derive\(.*Queryable/],
                python: [/db\.Model/, /Base\s*=\s*declarative_base/, /class\s+\w+\s*\(.*Model/],
                java: [/@Entity/, /@Table/, /extends\s+JpaRepository/],
                typescript: [/prisma/, /schema\s*{/, /model\s+\w+\s*{/],
                csharp: [/DbContext/, /DbSet</, /\[Table\]/],
            };

            const dbPats = dbPatterns[langLower] || dbPatterns['typescript'];
            const hasDb = dbPats.some(p => p.test(allContent));

            if (!hasDb) {
                issues.push({
                    severity: 'suggestion',
                    category: 'missing_component',
                    message: 'No database models or ORM usage detected',
                    suggestedFix: 'Consider adding database models if persistence is needed',
                });
                penalty += 5;
            }
        }

        // Check for error handling
        if (this.config.checkErrorHandling) {
            const errorPatterns = [
                /try\s*{/,
                /catch\s*\(/,
                /\.catch\s*\(/,
                /if\s+err\s*!=\s*nil/,
                /except\s*:/,
                /Result<.*,\s*\w+Error>/,
                /throws\s+\w+Exception/,
            ];

            const hasErrorHandling = errorPatterns.some(p => p.test(allContent));
            if (!hasErrorHandling) {
                issues.push({
                    severity: 'warning',
                    category: 'best_practice',
                    message: 'Limited error handling detected',
                    suggestedFix: 'Add try-catch blocks and error responses',
                });
                penalty += 5;
            }
        }

        return { issues, penalty };
    }

    /**
     * Check files against the architecture blueprint
     */
    private checkAgainstBlueprint(
        files: GeneratedFile[],
        blueprint: ArchitectureBlueprint
    ): { issues: QualityIssue[]; penalty: number } {
        const issues: QualityIssue[] = [];
        let penalty = 0;
        const allContent = files.map(f => f.content.toLowerCase()).join('\n');

        // Check for expected routes
        for (const route of blueprint.routes.slice(0, 5)) {
            const routePath = route.path.replace(/[{}:]/g, '').toLowerCase();
            if (!allContent.includes(routePath) && !allContent.includes(route.handler.toLowerCase())) {
                issues.push({
                    severity: 'warning',
                    category: 'structure',
                    message: `Blueprint route ${route.method} ${route.path} may be missing`,
                    suggestedFix: `Implement handler: ${route.handler}`,
                });
                penalty += 2;
            }
        }

        // Check for expected database tables
        for (const table of blueprint.database.tables.slice(0, 3)) {
            const tableName = table.name.toLowerCase();
            if (!allContent.includes(tableName)) {
                issues.push({
                    severity: 'warning',
                    category: 'structure',
                    message: `Blueprint table "${table.name}" may not be implemented`,
                    suggestedFix: `Add model/entity for ${table.name}`,
                });
                penalty += 3;
            }
        }

        return { issues, penalty };
    }

    /**
     * Check for common code patterns and best practices
     */
    private checkCommonPatterns(
        files: GeneratedFile[],
        _language: string
    ): { issues: QualityIssue[]; recommendations: string[]; penalty: number } {
        const issues: QualityIssue[] = [];
        const recommendations: string[] = [];
        let penalty = 0;

        const allContent = files.map(f => f.content).join('\n');

        // Check for hardcoded credentials
        if (/password\s*[:=]\s*['""][^'""]+['""]/i.test(allContent)) {
            issues.push({
                severity: 'error',
                category: 'best_practice',
                message: 'Hardcoded password detected',
                suggestedFix: 'Use environment variables for sensitive data',
            });
            penalty += 10;
        }

        // Check for environment variable usage
        const envPatterns = [
            /process\.env\./,
            /os\.getenv\(/,
            /os\.Getenv\(/,
            /System\.getenv\(/,
            /Environment\./,
        ];
        if (!envPatterns.some(p => p.test(allContent))) {
            recommendations.push('Consider using environment variables for configuration');
        }

        // Check for logging
        const logPatterns = [
            /console\.(log|info|warn|error)/,
            /logger\./,
            /log\.(info|debug|warn|error)/,
            /logging\./,
            /println!/,
        ];
        if (!logPatterns.some(p => p.test(allContent))) {
            recommendations.push('Add logging for better debugging and monitoring');
        }

        return { issues, recommendations, penalty };
    }

    /**
     * Calculate structure score based on file organization
     */
    private calculateStructureScore(files: GeneratedFile[], _language: string): number {
        let score = 50;

        // Bonus for organized file structure
        const hasRoutes = files.some(f => f.path.includes('route') || f.path.includes('handler'));
        const hasModels = files.some(f => f.path.includes('model') || f.path.includes('entity'));
        const hasServices = files.some(f => f.path.includes('service') || f.path.includes('repository'));
        const hasConfig = files.some(f => f.path.includes('config') || f.path.includes('.env'));

        if (hasRoutes) score += 15;
        if (hasModels) score += 15;
        if (hasServices) score += 10;
        if (hasConfig) score += 10;

        return Math.min(100, score);
    }

    /**
     * Calculate code quality score
     */
    private calculateCodeQualityScore(files: GeneratedFile[], _language: string): number {
        let totalScore = 0;
        let fileCount = 0;

        for (const file of files) {
            let fileScore = 50;
            const content = file.content;
            const lines = content.split('\n');

            // Check for comments/documentation
            const commentPatterns = [/\/\//, /\/\*/, /#/, /"""/, /'''/];
            const hasComments = commentPatterns.some(p => p.test(content));
            if (hasComments) fileScore += 15;

            // Check for reasonable line count
            const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
            if (codeLines >= 10 && codeLines <= 500) fileScore += 15;

            // Check for imports/dependencies
            const hasImports = /^(import|from|require|using|use)\s/m.test(content);
            if (hasImports) fileScore += 10;

            // Check for functions/methods
            const hasFunctions = /(function|func|def|fn|async|public\s+(static\s+)?(void|async))\s/m.test(content);
            if (hasFunctions) fileScore += 10;

            totalScore += Math.min(100, fileScore);
            fileCount++;
        }

        return fileCount > 0 ? Math.round(totalScore / fileCount) : 0;
    }

    /**
     * Build a prompt for regeneration if quality is too low
     */
    private buildRegenerationPrompt(
        issues: QualityIssue[],
        _blueprint: ArchitectureBlueprint | undefined,
        language: string,
        framework: string
    ): string {
        const errorIssues = issues.filter(i => i.severity === 'error');
        const warningIssues = issues.filter(i => i.severity === 'warning');

        let prompt = `Please regenerate the ${language}/${framework} code with the following fixes:\n\n`;

        prompt += `CRITICAL ISSUES TO FIX:\n`;
        for (const issue of errorIssues) {
            prompt += `- ${issue.message}`;
            if (issue.suggestedFix) prompt += ` (${issue.suggestedFix})`;
            prompt += `\n`;
        }

        if (warningIssues.length > 0) {
            prompt += `\nWARNINGS TO ADDRESS:\n`;
            for (const issue of warningIssues.slice(0, 5)) {
                prompt += `- ${issue.message}\n`;
            }
        }

        prompt += `\nEnsure you generate complete, working files with proper structure.`;

        return prompt;
    }

    /**
     * Store assessment results for learning
     */
    private async storeAssessment(
        result: QualityAssessmentResult,
        language: string,
        framework: string
    ): Promise<void> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return;

        try {
            await supabase.from('quality_assessments').insert({
                language,
                framework,
                score: result.score,
                passed: result.passed,
                total_files: result.summary.totalFiles,
                complete_files: result.summary.completeFiles,
                issues_count: result.issues.length,
                error_count: result.issues.filter(i => i.severity === 'error').length,
                should_regenerate: result.shouldRegenerate,
                summary: result.summary,
                created_at: new Date().toISOString(),
            });
        } catch (error) {
            // Table might not exist, that's ok
            console.warn('[QUALITY] Could not store assessment:', error);
        }
    }
}

// ============================================
// SINGLETON
// ============================================

let qualityAssessmentInstance: QualityAssessmentService | null = null;

export function getQualityAssessment(config?: Partial<QualityAssessmentConfig>): QualityAssessmentService {
    if (!qualityAssessmentInstance) {
        qualityAssessmentInstance = new QualityAssessmentService(config);
    }
    return qualityAssessmentInstance;
}
