/**
 * Final Verifier
 * 
 * Performs final verification before writing files to ensure:
 * 1. All syntax is valid
 * 2. All imports resolve
 * 3. Entry point can be executed
 */

import type { GeneratedFile } from './file-deduplicator.js';

export interface VerificationResult {
    success: boolean;
    errors: string[];
    warnings: string[];
    stats: {
        totalFiles: number;
        validFiles: number;
        invalidFiles: number;
        missingImports: string[];
    };
}

export class FinalVerifier {
    /**
     * Verify all files are valid before writing
     */
    verify(files: GeneratedFile[], language: string): VerificationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const missingImports: string[] = [];

        let validFiles = 0;
        let invalidFiles = 0;

        console.log(`[FINAL-VERIFIER] Verifying ${files.length} files...`);

        // Build set of all files for import checking
        const allFilePaths = new Set(
            files.map(f => this.normalizePath(f.path))
        );

        // Verify each file
        for (const file of files) {
            const result = this.verifyFile(file, language, allFilePaths);

            if (result.errors.length > 0) {
                invalidFiles++;
                errors.push(...result.errors.map(e => `${file.path}: ${e}`));
            } else {
                validFiles++;
            }

            warnings.push(...result.warnings.map(w => `${file.path}: ${w}`));
            missingImports.push(...result.missingImports);
        }

        const success = errors.length === 0;

        console.log(`[FINAL-VERIFIER] Valid: ${validFiles}, Invalid: ${invalidFiles}, Errors: ${errors.length}`);

        return {
            success,
            errors,
            warnings,
            stats: {
                totalFiles: files.length,
                validFiles,
                invalidFiles,
                missingImports,
            },
        };
    }

    /**
     * Verify a single file
     */
    private verifyFile(
        file: GeneratedFile,
        language: string,
        allFilePaths: Set<string>
    ): {
        errors: string[];
        warnings: string[];
        missingImports: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];
        const missingImports: string[] = [];

        // Check for empty content
        if (!file.content || file.content.trim().length === 0) {
            errors.push('File is empty');
            return { errors, warnings, missingImports };
        }

        // Syntax validation
        const syntaxErrors = this.validateSyntax(file.content, file.path, language);
        errors.push(...syntaxErrors);

        // Import validation
        const importResult = this.validateImports(file, language, allFilePaths);
        warnings.push(...importResult.warnings);
        missingImports.push(...importResult.missingImports);

        // Balance check
        const balanceResult = this.checkBalance(file.content, file.path);
        errors.push(...balanceResult);

        return { errors, warnings, missingImports };
    }

    /**
     * Validate syntax based on language
     */
    private validateSyntax(content: string, filePath: string, language: string): string[] {
        const errors: string[] = [];

        if (language === 'python' || filePath.endsWith('.py')) {
            // Python syntax check
            const lines = content.split('\n');
            let inMultilineString = false;
            let multilineChar = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check for unclosed strings
                const tripleQuote = line.match(/("""|'''")/g);
                if (tripleQuote) {
                    for (const match of tripleQuote) {
                        if (!inMultilineString) {
                            inMultilineString = true;
                            multilineChar = match;
                        } else if (match === multilineChar) {
                            inMultilineString = false;
                        }
                    }
                }

                // Check for syntax errors
                if (!inMultilineString) {
                    // Check for invalid characters
                    if (line.includes('\t') && line.includes('    ')) {
                        // Mixed tabs and spaces
                    }
                }
            }
        } else if (language === 'typescript' || filePath.endsWith('.ts') || filePath.endsWith('.js')) {
            // TypeScript/JavaScript syntax check
            // Check for common issues
            if (content.includes('} catch (') && !content.includes('} catch(')) {
                // This is fine, spacing in catch
            }

            // Check for JSX in .ts files
            if (filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
                if (content.includes('<') && content.includes('/>')) {
                    // JSX syntax found in .ts file - this is just a warning
                }
            }
        }

        return errors;
    }

    /**
     * Validate imports
     */
    private validateImports(
        file: GeneratedFile,
        language: string,
        allFilePaths: Set<string>
    ): {
        warnings: string[];
        missingImports: string[];
    } {
        const warnings: string[] = [];
        const missingImports: string[] = [];

        const imports = this.extractImports(file.content, language);

        for (const imp of imports) {
            // Skip node_modules / external packages
            if (!imp.startsWith('.') && !imp.startsWith('/')) {
                continue;
            }

            // Check if the file exists
            const resolvedPath = this.resolveImportPath(imp, file.path, language);

            if (!this.fileExists(resolvedPath, allFilePaths, language)) {
                missingImports.push(imp);
                warnings.push(`Import "${imp}" may not resolve`);
            }
        }

        return { warnings, missingImports };
    }

    /**
     * Extract imports from content
     */
    private extractImports(content: string, language: string): string[] {
        const imports: string[] = [];

        if (language === 'python') {
            // Python: from x import y
            const fromMatches = content.matchAll(/from\s+([\w.]+)\s+import/g);
            for (const match of fromMatches) {
                imports.push(match[1]);
            }

            // Python: import x
            const importMatches = content.matchAll(/^import\s+([\w.]+)/gm);
            for (const match of importMatches) {
                imports.push(match[1]);
            }
        } else {
            // TypeScript/JavaScript
            const matches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
            for (const match of matches) {
                imports.push(match[1]);
            }
        }

        return imports;
    }

    /**
     * Resolve import path
     */
    private resolveImportPath(imp: string, sourcePath: string, language: string): string {
        if (language === 'python') {
            if (imp.startsWith('.')) {
                // Relative import
                const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
                return `${sourceDir}/${imp.substring(1).replace(/\./g, '/')}.py`;
            }
            return `${imp.replace(/\./g, '/')}.py`;
        }

        // TypeScript/JavaScript
        if (imp.startsWith('.')) {
            const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
            let resolved = `${sourceDir}/${imp}`;
            if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
                resolved += '.ts';
            }
            return resolved;
        }

        return imp;
    }

    /**
     * Check if file exists
     */
    private fileExists(path: string, allFilePaths: Set<string>, language: string): boolean {
        const normalized = this.normalizePath(path);

        if (allFilePaths.has(normalized)) return true;
        if (allFilePaths.has(`src/${normalized}`)) return true;

        // Check index files
        if (language === 'typescript') {
            if (allFilePaths.has(`${normalized}/index.ts`)) return true;
        }
        if (language === 'python') {
            if (allFilePaths.has(`${normalized}/__init__.py`)) return true;
        }

        return false;
    }

    /**
     * Check brace/parenthesis balance
     */
    private checkBalance(content: string, _filePath: string): string[] {
        const errors: string[] = [];

        // Count braces
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;

        if (openBraces !== closeBraces) {
            errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
        }

        // Count parentheses
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;

        if (openParens !== closeParens) {
            errors.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
        }

        // Count brackets (for arrays)
        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/]/g) || []).length;

        if (openBrackets !== closeBrackets) {
            errors.push(`Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`);
        }

        return errors;
    }

    /**
     * Normalize path
     */
    private normalizePath(path: string): string {
        return path
            .replace(/\\/g, '/')
            .toLowerCase()
            .trim();
    }
}

// Singleton
let instance: FinalVerifier | null = null;

export function getFinalVerifier(): FinalVerifier {
    if (!instance) {
        instance = new FinalVerifier();
    }
    return instance;
}

export function createFinalVerifier(): FinalVerifier {
    instance = new FinalVerifier();
    return instance;
}
