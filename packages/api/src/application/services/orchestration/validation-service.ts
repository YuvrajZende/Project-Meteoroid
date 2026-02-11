/**
 * Validation Service
 * Phase 1, Week 1, Day 8-9: Code Quality Validation
 *
 * This service handles:
 * - Syntax validation
 * - Code quality checks
 * - Security scanning
 * - Best practices verification
 *
 * Replaces the validation logic from the monolithic IntegratedOrchestrator.
 */

import { injectable } from 'inversify';
import type { IValidationService, ValidationResult, CodeToValidate } from '../../../interfaces/validation.interface.js';

@injectable()
export class ValidationService implements IValidationService {
    private statistics = {
        totalValidations: 0,
        passedValidations: 0,
        failedValidations: 0,
        totalScore: 0,
    };

    /**
     * Validate generated code (comprehensive check)
     */
    async validate(input: CodeToValidate): Promise<ValidationResult> {
        console.log(`[ValidationService] Validating ${input.filePath || 'code'}`);

        this.statistics.totalValidations++;

        // Run all validation checks in parallel
        const [syntax, quality, security, bestPractices] = await Promise.all([
            this.validateSyntax(input.code, input.language),
            this.checkQuality(input.code, input.language),
            this.scanSecurity(input.code, input.language),
            this.checkBestPractices(input.code, input.language),
        ]);

        // Calculate overall score
        const syntaxScore = syntax.isValid ? 25 : 0;
        const qualityScore = quality.score * 0.4;
        const securityScore = security.hasVulnerabilities ? 0 : 25;
        const practicesScore = bestPractices.score * 0.1;
        const overallScore = Math.min(100, syntaxScore + qualityScore + securityScore + practicesScore);

        // Collect errors and warnings
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];
        const suggestions: string[] = [];

        // Add syntax errors
        syntax.errors.forEach(err => {
            errors.push({
                file: input.filePath || 'unknown',
                line: err.line,
                column: err.column,
                message: err.message,
                severity: 'error',
            });
        });

        // Add quality issues as warnings
        quality.issues.forEach(issue => {
            warnings.push({
                file: input.filePath || 'unknown',
                message: issue.message,
                severity: issue.type === 'complexity' ? 'warning' : 'info',
            });
        });

        // Add security vulnerabilities as errors
        security.vulnerabilities.forEach(vuln => {
            if (vuln.severity === 'critical' || vuln.severity === 'high') {
                errors.push({
                    file: input.filePath || 'unknown',
                    line: 0,
                    column: 0,
                    message: `Security: ${vuln.type} - ${vuln.description}`,
                    severity: 'error',
                });
            } else {
                warnings.push({
                    file: input.filePath || 'unknown',
                    message: `Security: ${vuln.type} - ${vuln.description}`,
                    severity: 'warning',
                });
            }
        });

        // Add best practice suggestions
        bestPractices.violated.forEach(violation => {
            suggestions.push(violation.suggestion);
        });

        // Track statistics
        if (overallScore >= 70) {
            this.statistics.passedValidations++;
        } else {
            this.statistics.failedValidations++;
        }
        this.statistics.totalScore += overallScore;

        const result: ValidationResult = {
            isValid: overallScore >= 70 && errors.length === 0,
            score: overallScore,
            details: {
                syntax,
                quality,
                security,
                bestPractices,
            },
            errors,
            warnings,
            suggestions,
        };

        console.log(`[ValidationService] Validation ${result.isValid ? 'passed' : 'failed'} with score ${overallScore}`);

        return result;
    }

    /**
     * Validate syntax only
     */
    async validateSyntax(code: string, _language: string): Promise<ValidationResult['details']['syntax']> {
        const errors: Array<{ line: number; column: number; message: string }> = [];

        // Basic syntax checks
        const lines = code.split('\n');

        // Check for balanced braces
        let braceCount = 0;
        let parenCount = 0;
        let bracketCount = 0;

        lines.forEach((line, index) => {
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
                if (char === '(') parenCount++;
                if (char === ')') parenCount--;
                if (char === '[') bracketCount++;
                if (char === ']') bracketCount--;

                // Detect mismatched brackets
                if (braceCount < 0) {
                    errors.push({ line: index + 1, column: i + 1, message: 'Unmatched closing brace' });
                    braceCount = 0;
                }
                if (parenCount < 0) {
                    errors.push({ line: index + 1, column: i + 1, message: 'Unmatched closing parenthesis' });
                    parenCount = 0;
                }
                if (bracketCount < 0) {
                    errors.push({ line: index + 1, column: i + 1, message: 'Unmatched closing bracket' });
                    bracketCount = 0;
                }
            }
        });

        // Check for unclosed brackets at end
        if (braceCount > 0) {
            errors.push({ line: lines.length, column: 0, message: `${braceCount} unclosed brace(s)` });
        }
        if (parenCount > 0) {
            errors.push({ line: lines.length, column: 0, message: `${parenCount} unclosed parenthesis(s)` });
        }
        if (bracketCount > 0) {
            errors.push({ line: lines.length, column: 0, message: `${bracketCount} unclosed bracket(s)` });
        }

        // Check for basic syntax issues
        lines.forEach((line, index) => {
            // Check for console.log in production code
            if (line.includes('console.log') && !line.includes('//')) {
                errors.push({ line: index + 1, column: line.indexOf('console.log'), message: 'console.log statement should be removed in production' });
            }

            // Check for debugger statements
            if (line.includes('debugger')) {
                errors.push({ line: index + 1, column: line.indexOf('debugger'), message: 'debugger statement found' });
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Check code quality
     */
    async checkQuality(code: string, _language: string): Promise<ValidationResult['details']['quality']> {
        const issues: ValidationResult['details']['quality']['issues'] = [];
        let score = 100;

        const lines = code.split('\n');

        // Check line length
        lines.forEach((line, index) => {
            if (line.length > 120) {
                issues.push({
                    type: 'formatting',
                    message: `Line ${index + 1} exceeds 120 characters (${line.length})`,
                    location: `line:${index + 1}`,
                });
                score -= 2;
            }
        });

        // Check function complexity (basic)
        const functionMatches = code.match(/function\s+\w+/g) || [];
        const arrowFunctionMatches = code.match(/\w+\s*=>\s*{/g) || [];
        const totalFunctions = functionMatches.length + arrowFunctionMatches.length;

        if (totalFunctions > 10) {
            issues.push({
                type: 'complexity',
                message: `File contains ${totalFunctions} functions, consider splitting`,
            });
            score -= 10;
        }

        // Check for duplicate code patterns (basic)
        const duplicateLines = this.findDuplicateLines(lines);
        duplicateLines.forEach(lineNum => {
            issues.push({
                type: 'duplication',
                message: `Duplicate code detected at line ${lineNum}`,
            });
            score -= 5;
        });

        // Check for magic numbers
        lines.forEach((line, index) => {
            const magicNumbers = line.match(/\b\d{3,}\b/g);
            if (magicNumbers && magicNumbers.length > 0 && !line.includes('//')) {
                issues.push({
                    type: 'naming',
                    message: `Magic number(s) found at line ${index + 1}: ${magicNumbers.join(', ')}`,
                    location: `line:${index + 1}`,
                });
                score -= 1;
            }
        });

        return {
            score: Math.max(0, score),
            issues,
        };
    }

    /**
     * Security scan
     */
    async scanSecurity(code: string, _language: string): Promise<ValidationResult['details']['security']> {
        const vulnerabilities: ValidationResult['details']['security']['vulnerabilities'] = [];

        const lowerCode = code.toLowerCase();

        // Check for dangerous patterns
        const dangerousPatterns = [
            { pattern: /eval\s*\(/, type: 'Code Injection', severity: 'critical' as const },
            { pattern: /dangerouslySetInnerHTML/, type: 'XSS', severity: 'high' as const },
            { pattern: /innerHTML\s*=/, type: 'XSS', severity: 'medium' as const },
            { pattern: /document\.write/, type: 'XSS', severity: 'medium' as const },
            { pattern: /Math\.random\s*\(\s*\)/, type: 'Weak Random', severity: 'low' as const },
            { pattern: /password\s*=\s*["'][^"']+["']/i, type: 'Hardcoded Password', severity: 'high' as const },
            { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/i, type: 'Hardcoded API Key', severity: 'high' as const },
            { pattern: /secret\s*=\s*["'][^"']+["']/i, type: 'Hardcoded Secret', severity: 'high' as const },
        ];

        dangerousPatterns.forEach(({ pattern, type, severity }) => {
            const matches = code.match(pattern);
            if (matches) {
                vulnerabilities.push({
                    severity,
                    type,
                    description: `Detected ${type} pattern`,
                });
            }
        });

        // Check for SQL injection risks
        if (lowerCode.includes('execute') || lowerCode.includes('query')) {
            if (lowerCode.includes('${') || lowerCode.includes('+')) {
                vulnerabilities.push({
                    severity: 'high',
                    type: 'SQL Injection',
                    description: 'Potential SQL injection with string concatenation',
                });
            }
        }

        return {
            hasVulnerabilities: vulnerabilities.some(v => v.severity === 'critical' || v.severity === 'high'),
            vulnerabilities,
        };
    }

    /**
     * Check best practices
     */
    async checkBestPractices(code: string, language: string): Promise<ValidationResult['details']['bestPractices']> {
        const followed: string[] = [];
        const violated: Array<{ practice: string; suggestion: string }> = [];
        let score = 100;

        // Check for TypeScript interfaces
        if (language === 'typescript') {
            if (code.includes('interface ')) {
                followed.push('Uses TypeScript interfaces');
                score += 5;
            } else {
                violated.push({
                    practice: 'TypeScript interfaces',
                    suggestion: 'Consider using interfaces for type definitions',
                });
                score -= 5;
            }
        }

        // Check for error handling
        if (code.includes('try {') || code.includes('.catch(')) {
            followed.push('Has error handling');
            score += 5;
        } else {
            violated.push({
                practice: 'Error handling',
                suggestion: 'Add try-catch blocks for error handling',
            });
            score -= 10;
        }

        // Check for async/await usage
        if (code.includes('async ') || code.includes('await ')) {
            followed.push('Uses modern async/await');
        }

        // Check for comments
        const hasComments = code.includes('//') || code.includes('/*') || code.includes('*');
        if (hasComments) {
            followed.push('Has code comments');
        }

        // Check for imports/exports
        if (code.includes('import ') || code.includes('require(')) {
            followed.push('Uses modular imports');
        }

        // Check for constants
        if (code.includes('const ') || code.includes('readonly ')) {
            followed.push('Uses constants where appropriate');
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            followed,
            violated,
        };
    }

    /**
     * Get validation statistics
     */
    getStatistics() {
        return {
            totalValidations: this.statistics.totalValidations,
            passedValidations: this.statistics.passedValidations,
            failedValidations: this.statistics.failedValidations,
            averageScore: this.statistics.totalValidations > 0
                ? this.statistics.totalScore / this.statistics.totalValidations
                : 0,
        };
    }

    /**
     * Find duplicate lines in code
     */
    private findDuplicateLines(lines: string[]): number[] {
        const lineCount = new Map<string, number[]>();
        const duplicates: number[] = [];

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.length > 10) { // Only check non-trivial lines
                if (!lineCount.has(trimmed)) {
                    lineCount.set(trimmed, []);
                }
                lineCount.get(trimmed)!.push(index + 1);
            }
        });

        lineCount.forEach((lineNumbers, _line) => {
            if (lineNumbers.length > 2) {
                duplicates.push(...lineNumbers.slice(1));
            }
        });

        return [...new Set(duplicates)];
    }
}
