/**
 * Code Validator Service
 * 
 * Phase 17.6: Code Quality Checks
 * 
 * Validates generated code for:
 * - TypeScript type errors
 * - ESLint violations
 * - Common code issues
 * - Import/export consistency
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, mkdtemp, writeFile, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { API_ROOT } from '../../../infrastructure/repo-root.js';

const execFileAsync = promisify(execFile);

/** Max captured stdout/stderr from child tools (bytes) */
const MAX_TOOL_OUTPUT = 10 * 1024 * 1024;
/** Kill child tools that hang */
const TOOL_TIMEOUT_MS = 60_000;

/**
 * Resolve a package's JS entry script so it can be run as `node <script>`
 * via execFile (no shell, no npx, works on Windows without .cmd shims).
 */
function resolveToolScript(pkg: string, relativeScript: string): string | null {
    try {
        // Resolve via package.json: bin scripts are often not listed in package "exports"
        const pkgJson = require.resolve(`${pkg}/package.json`);
        return join(dirname(pkgJson), relativeScript);
    } catch {
        return null;
    }
}

/**
 * Private, project-owned root for per-run validation dirs. Deliberately NOT
 * os.tmpdir(): tools like ESLint/tsc walk parent dirs for config, and a shared
 * temp dir lets other local users plant configs (code execution).
 */
const VALIDATION_ROOT = join(API_ROOT, '.cache', 'validation');

async function createRunDir(): Promise<string> {
    await mkdir(VALIDATION_ROOT, { recursive: true, mode: 0o700 });
    return mkdtemp(join(VALIDATION_ROOT, 'run-'));
}

/**
 * Map an arbitrary (untrusted) generated file path to a safe flat filename
 * inside the temp dir - no separators, no traversal.
 */
function toTempFileName(filePath: string): string {
    const flat = filePath.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_');
    return flat.length > 0 ? flat : '_file.ts';
}

export interface ValidationError {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    rule?: string;
    fixable?: boolean;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
    stats: {
        totalErrors: number;
        totalWarnings: number;
        filesChecked: number;
        filesWithErrors: number;
        syntaxErrors: number;
        typeErrors: number;
        lintErrors: number;
    };
    summary: string;
}

export interface CodeFile {
    path: string;
    content: string;
}

export interface ValidatorConfig {
    enableTypeCheck: boolean;
    enableLint: boolean;
    enableSyntaxCheck: boolean;
    autoFix: boolean;
    strictMode: boolean;
}

// ============================================
// CODE VALIDATOR
// ============================================

export class CodeValidator {
    private config: ValidatorConfig;

    constructor(config?: Partial<ValidatorConfig>) {
        this.config = {
            enableTypeCheck: config?.enableTypeCheck ?? true,
            enableLint: config?.enableLint ?? false, // Disabled by default (requires eslint)
            enableSyntaxCheck: config?.enableSyntaxCheck ?? true,
            autoFix: config?.autoFix ?? false,
            strictMode: config?.strictMode ?? true,
        };
    }

    /**
     * Validate a single code string
     */
    async validateCode(code: string, filename: string = 'temp.ts'): Promise<ValidationResult> {
        return this.validateFiles([{ path: filename, content: code }]);
    }

    /**
     * Validate multiple files
     */
    async validateFiles(files: CodeFile[]): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        let syntaxErrors = 0;
        let typeErrors = 0;
        let lintErrors = 0;
        const filesWithErrors = new Set<string>();

        console.log(`[CODE-VALIDATOR] Validating ${files.length} files...`);

        // Step 1: Syntax validation (always runs, no external deps)
        if (this.config.enableSyntaxCheck) {
            for (const file of files) {
                const syntaxResult = this.validateSyntax(file.content, file.path);
                errors.push(...syntaxResult.filter(e => e.severity === 'error'));
                warnings.push(...syntaxResult.filter(e => e.severity === 'warning'));
                syntaxErrors += syntaxResult.filter(e => e.severity === 'error').length;
                syntaxResult.forEach(e => filesWithErrors.add(e.file));
            }
        }

        // Step 2: TypeScript type checking (requires temp files)
        if (this.config.enableTypeCheck) {
            try {
                const typeResult = await this.runTypeScript(files);
                errors.push(...typeResult.filter(e => e.severity === 'error'));
                warnings.push(...typeResult.filter(e => e.severity === 'warning'));
                typeErrors += typeResult.filter(e => e.severity === 'error').length;
                typeResult.forEach(e => filesWithErrors.add(e.file));
            } catch (error) {
                console.warn('[CODE-VALIDATOR] TypeScript check skipped:', error);
            }
        }

        // Step 3: ESLint (if enabled and available)
        if (this.config.enableLint) {
            try {
                const lintResult = await this.runESLint(files);
                errors.push(...lintResult.filter(e => e.severity === 'error'));
                warnings.push(...lintResult.filter(e => e.severity === 'warning'));
                lintErrors += lintResult.filter(e => e.severity === 'error').length;
                lintResult.forEach(e => filesWithErrors.add(e.file));
            } catch (error) {
                console.warn('[CODE-VALIDATOR] ESLint check skipped:', error);
            }
        }

        const totalErrors = errors.length;
        const totalWarnings = warnings.length;
        const valid = totalErrors === 0;

        const summary = this.generateSummary(files.length, totalErrors, totalWarnings, filesWithErrors.size);

        console.log(`[CODE-VALIDATOR] ${summary}`);

        return {
            valid,
            errors,
            warnings,
            stats: {
                totalErrors,
                totalWarnings,
                filesChecked: files.length,
                filesWithErrors: filesWithErrors.size,
                syntaxErrors,
                typeErrors,
                lintErrors,
            },
            summary,
        };
    }

    /**
     * Validate syntax without external tools
     */
    private validateSyntax(code: string, filename: string): ValidationError[] {
        const errors: ValidationError[] = [];

        // Check 1: Unbalanced braces
        const braceBalance = this.checkBalanced(code, '{', '}');
        if (braceBalance !== 0) {
            errors.push({
                file: filename,
                line: 1,
                column: 1,
                message: `Unbalanced braces: ${braceBalance > 0 ? 'missing ' + braceBalance + ' closing' : 'extra ' + Math.abs(braceBalance) + ' closing'} brace(s)`,
                severity: 'error',
                rule: 'syntax/balanced-braces',
            });
        }

        // Check 2: Unbalanced parentheses
        const parenBalance = this.checkBalanced(code, '(', ')');
        if (parenBalance !== 0) {
            errors.push({
                file: filename,
                line: 1,
                column: 1,
                message: `Unbalanced parentheses: ${parenBalance > 0 ? 'missing ' + parenBalance + ' closing' : 'extra ' + Math.abs(parenBalance) + ' closing'} parenthesis(es)`,
                severity: 'error',
                rule: 'syntax/balanced-parens',
            });
        }

        // Check 3: Unbalanced brackets
        const bracketBalance = this.checkBalanced(code, '[', ']');
        if (bracketBalance !== 0) {
            errors.push({
                file: filename,
                line: 1,
                column: 1,
                message: `Unbalanced brackets: ${bracketBalance > 0 ? 'missing ' + bracketBalance + ' closing' : 'extra ' + Math.abs(bracketBalance) + ' closing'} bracket(s)`,
                severity: 'error',
                rule: 'syntax/balanced-brackets',
            });
        }

        // Check 4: Unclosed strings
        const stringErrors = this.checkUnclosedStrings(code);
        errors.push(...stringErrors.map(line => ({
            file: filename,
            line,
            column: 1,
            message: 'Unclosed string literal',
            severity: 'error' as const,
            rule: 'syntax/unclosed-string',
        })));

        // Check 5: Invalid import statements
        const importErrors = this.checkImports(code, filename);
        errors.push(...importErrors);

        // Check 6: Markdown code blocks (shouldn't be in TS files)
        if (code.includes('```')) {
            const lines = code.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('```')) {
                    errors.push({
                        file: filename,
                        line: idx + 1,
                        column: line.indexOf('```') + 1,
                        message: 'Markdown code block found in TypeScript file',
                        severity: 'error',
                        rule: 'syntax/no-markdown',
                    });
                }
            });
        }

        // Check 7: JSON structure in code files
        if (code.includes('"path":') && code.includes('"content":')) {
            errors.push({
                file: filename,
                line: 1,
                column: 1,
                message: 'File contains JSON structure instead of code',
                severity: 'error',
                rule: 'syntax/no-json-structure',
            });
        }

        // Check 8: Missing semicolons after statements (warning)
        const missingSemicolons = this.checkMissingSemicolons(code);
        missingSemicolons.forEach(line => {
            errors.push({
                file: filename,
                line,
                column: 1,
                message: 'Statement may be missing semicolon',
                severity: 'warning',
                rule: 'style/semi',
                fixable: true,
            });
        });

        return errors;
    }

    /**
     * Run TypeScript type checker
     */
    private async runTypeScript(files: CodeFile[]): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        const tscScript = resolveToolScript('typescript', 'bin/tsc');
        if (!tscScript) {
            console.log('[CODE-VALIDATOR] TypeScript not available, skipping type check');
            return errors;
        }

        // Per-run isolated temp dir (no cross-request collisions)
        const runDir = await createRunDir();

        try {
            for (const file of files) {
                await writeFile(join(runDir, toTempFileName(file.path)), file.content);
            }

            // Write minimal tsconfig
            // The temp dir lives outside the project, so point module/type resolution
            // back at the project's node_modules (where typescript itself was resolved).
            const nodeModulesDir = dirname(dirname(dirname(tscScript)));
            const tsconfigPath = join(runDir, 'tsconfig.json');
            await writeFile(tsconfigPath, JSON.stringify({
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ESNext',
                    moduleResolution: 'Node',
                    strict: this.config.strictMode,
                    skipLibCheck: true,
                    noEmit: true,
                    baseUrl: '.',
                    paths: {
                        '*': [join(nodeModulesDir, '*'), join(nodeModulesDir, '@types', '*')],
                    },
                    typeRoots: [join(nodeModulesDir, '@types')],
                },
                include: ['*.ts'],
            }, null, 2));

            try {
                await execFileAsync(process.execPath, [tscScript, '--project', tsconfigPath, '--pretty', 'false'], {
                    cwd: runDir,
                    timeout: TOOL_TIMEOUT_MS,
                    maxBuffer: MAX_TOOL_OUTPUT,
                    windowsHide: true,
                });
            } catch (error) {
                // tsc exits non-zero when there are diagnostics
                const output = (error as { stdout?: string; stderr?: string }).stdout ||
                    (error as { stderr?: string }).stderr || '';
                errors.push(...this.parseTscOutput(output, files));
            }
        } finally {
            await rm(runDir, { recursive: true, force: true }).catch(() => undefined);
        }

        return errors;
    }

    /**
     * Run ESLint
     */
    private async runESLint(files: CodeFile[]): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        const eslintScript = resolveToolScript('eslint', 'bin/eslint.js');
        if (!eslintScript) {
            console.log('[CODE-VALIDATOR] ESLint not available, skipping lint check');
            return errors;
        }

        const runDir = await createRunDir();

        const collect = (stdout: string): void => {
            const results = JSON.parse(stdout) as Array<{
                filePath: string;
                messages: Array<{ line: number; column: number; message: string; severity: number; ruleId?: string; fix?: unknown }>;
            }>;
            for (const result of results) {
                for (const msg of result.messages) {
                    errors.push({
                        file: result.filePath,
                        line: msg.line,
                        column: msg.column,
                        message: msg.message,
                        severity: msg.severity === 2 ? 'error' : 'warning',
                        rule: msg.ruleId,
                        fixable: !!msg.fix,
                    });
                }
            }
        };

        try {
            const tempFiles: string[] = [];
            for (const file of files) {
                const tempPath = join(runDir, toTempFileName(file.path));
                await writeFile(tempPath, file.content);
                tempFiles.push(tempPath);
            }

            // Pin an explicit config; never discover configs from the filesystem (ESLint 8 eslintrc mode)
            let tsParser: string | null = null;
            try {
                tsParser = require.resolve('@typescript-eslint/parser');
            } catch {
                tsParser = null;
            }
            const eslintConfigPath = join(runDir, 'eslint.config.json');
            await writeFile(eslintConfigPath, JSON.stringify({
                root: true,
                ...(tsParser ? { parser: tsParser } : {}),
                parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
                env: { es2022: true, node: true },
                rules: {},
            }, null, 2));

            try {
                const { stdout } = await execFileAsync(
                    process.execPath,
                    [
                        eslintScript,
                        '--no-eslintrc',
                        '--no-ignore',
                        '--config', eslintConfigPath,
                        '--format', 'json',
                        '--',
                        ...tempFiles,
                    ],
                    { cwd: runDir, timeout: TOOL_TIMEOUT_MS, maxBuffer: MAX_TOOL_OUTPUT, windowsHide: true }
                );
                collect(stdout);
            } catch (error) {
                // ESLint returns non-zero on errors
                const output = (error as { stdout?: string }).stdout || '';
                if (output.startsWith('[')) {
                    try {
                        collect(output);
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        } finally {
            await rm(runDir, { recursive: true, force: true }).catch(() => undefined);
        }

        return errors;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private checkBalanced(code: string, open: string, close: string): number {
        let balance = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < code.length; i++) {
            const char = code[i];
            const prevChar = i > 0 ? code[i - 1] : '';

            // Handle string detection
            if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }

            // Skip chars inside strings
            if (inString) continue;

            // Handle comments
            if (char === '/' && code[i + 1] === '/') {
                // Skip to end of line
                while (i < code.length && code[i] !== '\n') i++;
                continue;
            }
            if (char === '/' && code[i + 1] === '*') {
                // Skip to end of block comment
                i += 2;
                while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
                i++;
                continue;
            }

            if (char === open) balance++;
            if (char === close) balance--;
        }

        return balance;
    }

    private checkUnclosedStrings(code: string): number[] {
        const errorLines: number[] = [];
        const lines = code.split('\n');

        lines.forEach((line, idx) => {
            // Skip comments
            const trimmed = line.trim();
            if (trimmed.startsWith('//')) return;

            // Count quotes (simplified check)
            let inString = false;
            let stringChar = '';
            let escaped = false;

            for (const char of line) {
                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (char === '\\') {
                    escaped = true;
                    continue;
                }

                if ((char === '"' || char === "'") && !inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar && inString) {
                    inString = false;
                }
            }

            // Template literals can span multiple lines, so only flag ' and "
            if (inString && stringChar !== '`') {
                errorLines.push(idx + 1);
            }
        });

        return errorLines;
    }

    private checkImports(code: string, filename: string): ValidationError[] {
        const errors: ValidationError[] = [];
        const lines = code.split('\n');

        lines.forEach((line, idx) => {
            const trimmed = line.trim();

            // Check for 'from' without 'import'
            if (trimmed.startsWith('from ') && !code.substring(0, code.indexOf(line)).includes('import')) {
                errors.push({
                    file: filename,
                    line: idx + 1,
                    column: 1,
                    message: 'Invalid import statement: "from" without "import"',
                    severity: 'error',
                    rule: 'syntax/valid-import',
                });
            }

            // Check for import without from
            if (trimmed.startsWith('import ') && !trimmed.includes(' from ') && !trimmed.includes('import type')) {
                // Check if it's a side-effect import (import 'module')
                if (!trimmed.match(/^import\s+['"`]/)) {
                    errors.push({
                        file: filename,
                        line: idx + 1,
                        column: 1,
                        message: 'Import statement may be missing "from" clause',
                        severity: 'warning',
                        rule: 'syntax/valid-import',
                    });
                }
            }
        });

        return errors;
    }

    private checkMissingSemicolons(code: string): number[] {
        const warnings: number[] = [];
        const lines = code.split('\n');

        lines.forEach((line, idx) => {
            const trimmed = line.trim();

            // Skip empty lines, comments, and lines that shouldn't end with semicolons
            if (!trimmed ||
                trimmed.startsWith('//') ||
                trimmed.startsWith('/*') ||
                trimmed.startsWith('*') ||
                trimmed.endsWith('{') ||
                trimmed.endsWith('}') ||
                trimmed.endsWith(',') ||
                trimmed.endsWith(':') ||
                trimmed.endsWith('(') ||
                trimmed.endsWith(';') ||
                trimmed.startsWith('if') ||
                trimmed.startsWith('else') ||
                trimmed.startsWith('for') ||
                trimmed.startsWith('while') ||
                trimmed.startsWith('switch') ||
                trimmed.startsWith('try') ||
                trimmed.startsWith('catch') ||
                trimmed.startsWith('finally')) {
                return;
            }

            // Check statements that should have semicolons
            if ((trimmed.startsWith('const ') ||
                trimmed.startsWith('let ') ||
                trimmed.startsWith('var ') ||
                trimmed.startsWith('return ') ||
                trimmed.startsWith('throw ') ||
                trimmed.includes('= ')) &&
                !trimmed.endsWith(';') &&
                !trimmed.endsWith('{') &&
                !trimmed.includes('=>')) {
                warnings.push(idx + 1);
            }
        });

        return warnings;
    }

    private parseTscOutput(output: string, files: CodeFile[]): ValidationError[] {
        const errors: ValidationError[] = [];
        const lines = output.split(/\r?\n/);

        const errorPattern = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;

        for (const line of lines) {
            const match = line.match(errorPattern);
            if (match) {
                const [, _file, lineNum, col, severity, code, message] = match;

                // Map temp file back to original
                const originalFile = files.find(f =>
                    _file.includes(toTempFileName(f.path))
                );

                errors.push({
                    file: originalFile?.path || _file,
                    line: parseInt(lineNum, 10),
                    column: parseInt(col, 10),
                    message: `${code}: ${message}`,
                    severity: severity as 'error' | 'warning',
                    rule: code,
                });
            }
        }

        return errors;
    }

    private generateSummary(
        filesChecked: number,
        totalErrors: number,
        totalWarnings: number,
        filesWithErrors: number
    ): string {
        if (totalErrors === 0 && totalWarnings === 0) {
            return `✅ All ${filesChecked} files passed validation`;
        }

        const parts: string[] = [];
        if (totalErrors > 0) {
            parts.push(`${totalErrors} error${totalErrors > 1 ? 's' : ''}`);
        }
        if (totalWarnings > 0) {
            parts.push(`${totalWarnings} warning${totalWarnings > 1 ? 's' : ''}`);
        }

        return `${totalErrors > 0 ? '❌' : '⚠️'} ${parts.join(', ')} in ${filesWithErrors}/${filesChecked} files`;
    }
}

// ============================================
// SINGLETON
// ============================================

let validatorInstance: CodeValidator | null = null;

export function getCodeValidator(): CodeValidator {
    if (!validatorInstance) {
        validatorInstance = new CodeValidator();
    }
    return validatorInstance;
}

export function createCodeValidator(config?: Partial<ValidatorConfig>): CodeValidator {
    validatorInstance = new CodeValidator(config);
    return validatorInstance;
}
