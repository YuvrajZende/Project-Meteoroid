/**
 * Output Validation System
 * Validates AI-generated code for quality and correctness
 * 
 * @author Person 2 (AI/ML Engineer)
 * @phase Phase 5 - AI Optimization
 */

// ============================================
// TYPES
// ============================================

export interface ValidationResult {
    valid: boolean;
    score: number; // 0-100
    errors: ValidationError[];
    warnings: ValidationWarning[];
    suggestions: string[];
    metadata: ValidationMetadata;
}

export interface ValidationError {
    type: 'syntax' | 'type' | 'import' | 'security' | 'logic';
    message: string;
    line?: number;
    column?: number;
    severity: 'error' | 'critical';
}

export interface ValidationWarning {
    type: 'style' | 'performance' | 'best-practice' | 'deprecated';
    message: string;
    line?: number;
    suggestion?: string;
}

export interface ValidationMetadata {
    codeLength: number;
    complexity: number;
    hasTests: boolean;
    hasDocumentation: boolean;
    hasTypeAnnotations: boolean;
    importCount: number;
    exportCount: number;
    functionCount: number;
    classCount: number;
}

export interface ValidationRule {
    id: string;
    name: string;
    description: string;
    severity: 'error' | 'warning';
    check: (code: string) => { passed: boolean; message?: string; line?: number };
}

// ============================================
// BUILT-IN VALIDATION RULES
// ============================================

export const SYNTAX_RULES: ValidationRule[] = [
    {
        id: 'no-console-error',
        name: 'No Console Errors',
        description: 'Code should not have obvious syntax errors',
        severity: 'error',
        check: (code) => {
            const danglingBrace = (code.match(/{/g) || []).length !== (code.match(/}/g) || []).length;
            const danglingParen = (code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length;
            const danglingBracket = (code.match(/\[/g) || []).length !== (code.match(/]/g) || []).length;

            if (danglingBrace) return { passed: false, message: 'Unmatched curly braces' };
            if (danglingParen) return { passed: false, message: 'Unmatched parentheses' };
            if (danglingBracket) return { passed: false, message: 'Unmatched square brackets' };

            return { passed: true };
        },
    },
    {
        id: 'no-empty-blocks',
        name: 'No Empty Blocks',
        description: 'Code blocks should not be empty',
        severity: 'warning',
        check: (code) => {
            const hasEmptyBlock = /{\s*}/.test(code) && !/interface\s+\w+\s*{\s*}/.test(code);
            return {
                passed: !hasEmptyBlock,
                message: hasEmptyBlock ? 'Empty code block detected' : undefined,
            };
        },
    },
];

export const TYPE_RULES: ValidationRule[] = [
    {
        id: 'no-any-type',
        name: 'Avoid Any Type',
        description: 'Avoid using any type for better type safety',
        severity: 'warning',
        check: (code) => {
            const anyMatches = code.match(/:\s*any\b/g);
            const count = anyMatches?.length || 0;
            return {
                passed: count === 0,
                message: count > 0 ? `Found ${count} uses of 'any' type` : undefined,
            };
        },
    },
    {
        id: 'interface-naming',
        name: 'Interface Naming',
        description: 'Interfaces should be PascalCase',
        severity: 'warning',
        check: (code) => {
            const interfaceRegex = /interface\s+(\w+)/g;
            let match;
            while ((match = interfaceRegex.exec(code)) !== null) {
                if (!/^[A-Z]/.test(match[1])) {
                    return {
                        passed: false,
                        message: `Interface '${match[1]}' should be PascalCase`,
                    };
                }
            }
            return { passed: true };
        },
    },
];

export const SECURITY_RULES: ValidationRule[] = [
    {
        id: 'no-eval',
        name: 'No Eval',
        description: 'Code should not use eval()',
        severity: 'error',
        check: (code) => {
            const hasEval = /\beval\s*\(/.test(code);
            return {
                passed: !hasEval,
                message: hasEval ? 'eval() is a security risk' : undefined,
            };
        },
    },
    {
        id: 'no-hardcoded-secrets',
        name: 'No Hardcoded Secrets',
        description: 'Code should not contain hardcoded secrets',
        severity: 'error',
        check: (code) => {
            const patterns = [
                /password\s*=\s*['"][^'"]+['"]/i,
                /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
                /secret\s*=\s*['"][^'"]+['"]/i,
                /token\s*=\s*['"][A-Za-z0-9+/=]{20,}['"]/i,
            ];

            for (const pattern of patterns) {
                if (pattern.test(code)) {
                    return {
                        passed: false,
                        message: 'Possible hardcoded secret detected',
                    };
                }
            }
            return { passed: true };
        },
    },
    {
        id: 'sql-injection',
        name: 'SQL Injection Prevention',
        description: 'SQL queries should use parameterized queries',
        severity: 'error',
        check: (code) => {
            const hasRawSql = /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/i.test(code) ||
                /(?:SELECT|INSERT|UPDATE|DELETE).*\$\{.*\}/i.test(code);
            return {
                passed: !hasRawSql,
                message: hasRawSql ? 'Possible SQL injection vulnerability' : undefined,
            };
        },
    },
];

export const BEST_PRACTICE_RULES: ValidationRule[] = [
    {
        id: 'has-exports',
        name: 'Has Exports',
        description: 'Module should have exports',
        severity: 'warning',
        check: (code) => {
            const hasExport = /\bexport\b/.test(code);
            return {
                passed: hasExport,
                message: hasExport ? undefined : 'Module has no exports',
            };
        },
    },
    {
        id: 'has-error-handling',
        name: 'Has Error Handling',
        description: 'Async code should have error handling',
        severity: 'warning',
        check: (code) => {
            const hasAsync = /\basync\b/.test(code);
            const hasTryCatch = /\btry\s*{/.test(code);
            const hasCatch = /\.catch\(/.test(code);

            if (hasAsync && !hasTryCatch && !hasCatch) {
                return {
                    passed: false,
                    message: 'Async code without error handling',
                };
            }
            return { passed: true };
        },
    },
    {
        id: 'no-console-log',
        name: 'No Console Log in Production',
        description: 'Avoid console.log in production code',
        severity: 'warning',
        check: (code) => {
            const hasConsoleLog = /console\.log\(/.test(code);
            return {
                passed: !hasConsoleLog,
                message: hasConsoleLog ? 'Remove console.log for production' : undefined,
            };
        },
    },
];

// ============================================
// OUTPUT VALIDATOR
// ============================================

export class OutputValidator {
    private rules: ValidationRule[] = [];

    constructor() {
        // Load default rules
        this.rules = [
            ...SYNTAX_RULES,
            ...TYPE_RULES,
            ...SECURITY_RULES,
            ...BEST_PRACTICE_RULES,
        ];
    }

    /**
     * Add a custom validation rule
     */
    addRule(rule: ValidationRule): void {
        this.rules.push(rule);
    }

    /**
     * Remove a rule by ID
     */
    removeRule(ruleId: string): void {
        this.rules = this.rules.filter(r => r.id !== ruleId);
    }

    /**
     * Validate code against all rules
     */
    validate(code: string): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const suggestions: string[] = [];

        // Run all rules
        for (const rule of this.rules) {
            const result = rule.check(code);

            if (!result.passed) {
                if (rule.severity === 'error') {
                    errors.push({
                        type: this.getRuleType(rule.id),
                        message: result.message || rule.description,
                        line: result.line,
                        severity: 'error',
                    });
                } else {
                    warnings.push({
                        type: this.getWarningType(rule.id),
                        message: result.message || rule.description,
                        line: result.line,
                        suggestion: rule.description,
                    });
                }
            }
        }

        // Extract metadata
        const metadata = this.extractMetadata(code);

        // Generate suggestions
        if (!metadata.hasDocumentation) {
            suggestions.push('Add JSDoc comments for better documentation');
        }
        if (!metadata.hasTypeAnnotations) {
            suggestions.push('Add TypeScript type annotations');
        }
        if (metadata.complexity > 10) {
            suggestions.push('Consider breaking down complex functions');
        }

        // Calculate score
        const score = this.calculateScore(errors, warnings, metadata);

        return {
            valid: errors.length === 0,
            score,
            errors,
            warnings,
            suggestions,
            metadata,
        };
    }

    /**
     * Validate code for a specific category
     */
    validateForCategory(code: string, category: 'database' | 'queue' | 'test' | 'code'): ValidationResult {
        const baseResult = this.validate(code);

        // Add category-specific checks
        switch (category) {
            case 'database':
                if (!code.includes('prisma') && !code.includes('drizzle') && !code.includes('sql')) {
                    baseResult.warnings.push({
                        type: 'best-practice',
                        message: 'Database code should use an ORM or query builder',
                    });
                }
                break;
            case 'queue':
                if (!code.includes('Queue') && !code.includes('Worker')) {
                    baseResult.warnings.push({
                        type: 'best-practice',
                        message: 'Queue code should define queues or workers',
                    });
                }
                break;
            case 'test':
                if (!code.includes('describe') && !code.includes('it') && !code.includes('test')) {
                    baseResult.warnings.push({
                        type: 'best-practice',
                        message: 'Test file should contain test definitions',
                    });
                }
                break;
        }

        return baseResult;
    }

    /**
     * Extract code metadata
     */
    private extractMetadata(code: string): ValidationMetadata {
        return {
            codeLength: code.length,
            complexity: this.calculateComplexity(code),
            hasTests: /\b(describe|it|test)\s*\(/.test(code),
            hasDocumentation: /\/\*\*[\s\S]*?\*\//.test(code),
            hasTypeAnnotations: /:\s*(string|number|boolean|void|Promise|Array|Map|Set|Record)\b/.test(code),
            importCount: (code.match(/^import\s/gm) || []).length,
            exportCount: (code.match(/^export\s/gm) || []).length,
            functionCount: (code.match(/function\s+\w+|=>\s*{|\basync\s+\(/g) || []).length,
            classCount: (code.match(/\bclass\s+\w+/g) || []).length,
        };
    }

    /**
     * Calculate cyclomatic complexity
     */
    private calculateComplexity(code: string): number {
        let complexity = 1;

        // Count decision points
        complexity += (code.match(/\bif\b/g) || []).length;
        complexity += (code.match(/\belse\s+if\b/g) || []).length;
        complexity += (code.match(/\bfor\b/g) || []).length;
        complexity += (code.match(/\bwhile\b/g) || []).length;
        complexity += (code.match(/\bswitch\b/g) || []).length;
        complexity += (code.match(/\bcase\b/g) || []).length;
        complexity += (code.match(/\bcatch\b/g) || []).length;
        complexity += (code.match(/\?\?/g) || []).length;
        complexity += (code.match(/\?\./g) || []).length;
        complexity += (code.match(/&&/g) || []).length;
        complexity += (code.match(/\|\|/g) || []).length;

        return complexity;
    }

    /**
     * Calculate quality score
     */
    private calculateScore(
        errors: ValidationError[],
        warnings: ValidationWarning[],
        metadata: ValidationMetadata
    ): number {
        let score = 100;

        // Deduct for errors (more severe)
        score -= errors.filter(e => e.severity === 'critical').length * 20;
        score -= errors.filter(e => e.severity === 'error').length * 10;

        // Deduct for warnings (less severe)
        score -= warnings.length * 3;

        // Bonus for good practices
        if (metadata.hasDocumentation) score += 5;
        if (metadata.hasTypeAnnotations) score += 5;
        if (metadata.hasTests) score += 5;
        if (metadata.exportCount > 0) score += 2;

        // Penalty for high complexity
        if (metadata.complexity > 20) score -= 10;
        else if (metadata.complexity > 15) score -= 5;

        return Math.max(0, Math.min(100, score));
    }

    private getRuleType(ruleId: string): ValidationError['type'] {
        // Check security-related rules first (before checking no- prefix)
        if (ruleId.includes('eval') || ruleId.includes('sql') || ruleId.includes('secret') || ruleId.includes('security')) return 'security';
        if (ruleId.startsWith('no-') || ruleId.includes('syntax')) return 'syntax';
        if (ruleId.includes('type') || ruleId.includes('interface')) return 'type';
        if (ruleId.includes('import')) return 'import';
        return 'logic';
    }

    private getWarningType(ruleId: string): ValidationWarning['type'] {
        if (ruleId.includes('style') || ruleId.includes('naming')) return 'style';
        if (ruleId.includes('performance')) return 'performance';
        if (ruleId.includes('deprecated')) return 'deprecated';
        return 'best-practice';
    }
}

// ============================================
// SINGLETON
// ============================================

let outputValidator: OutputValidator | null = null;

export function getOutputValidator(): OutputValidator {
    if (!outputValidator) {
        outputValidator = new OutputValidator();
    }
    return outputValidator;
}
