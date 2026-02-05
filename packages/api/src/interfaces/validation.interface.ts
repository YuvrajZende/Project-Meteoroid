/**
 * Validation Service Interface
 *
 * Defines the contract for code quality validation.
 * This service handles:
 * - Syntax validation
 * - Code quality checks
 * - Security scanning
 * - Best practices verification
 */

export interface ValidationResult {
    /** Whether validation passed */
    isValid: boolean;
    /** Overall score (0-100) */
    score: number;
    /** Detailed validation results */
    details: {
        syntax: SyntaxValidation;
        quality: QualityValidation;
        security: SecurityValidation;
        bestPractices: BestPracticesValidation;
    };
    /** Errors found */
    errors: ValidationError[];
    /** Warnings found */
    warnings: ValidationWarning[];
    /** Suggestions for improvement */
    suggestions: string[];
}

export interface SyntaxValidation {
    isValid: boolean;
    errors: Array<{
        line: number;
        column: number;
        message: string;
    }>;
}

export interface QualityValidation {
    score: number;
    issues: Array<{
        type: 'complexity' | 'duplication' | 'naming' | 'formatting';
        message: string;
        location?: string;
    }>;
}

export interface SecurityValidation {
    hasVulnerabilities: boolean;
    vulnerabilities: Array<{
        severity: 'critical' | 'high' | 'medium' | 'low';
        type: string;
        description: string;
        location?: string;
    }>;
}

export interface BestPracticesValidation {
    score: number;
    followed: string[];
    violated: Array<{
        practice: string;
        suggestion: string;
    }>;
}

export interface ValidationError {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error';
}

export interface ValidationWarning {
    file: string;
    message: string;
    severity: 'info' | 'warning';
}

export interface CodeToValidate {
    /** The code to validate */
    code: string;
    /** Language of the code */
    language: string;
    /** File path (for reporting) */
    filePath?: string;
}

/**
 * Validation Service interface
 * Handles code quality validation
 */
export interface IValidationService {
    /**
     * Validate generated code
     */
    validate(input: CodeToValidate): Promise<ValidationResult>;

    /**
     * Validate syntax only (fast check)
     */
    validateSyntax(code: string, language: string): Promise<SyntaxValidation>;

    /**
     * Check code quality
     */
    checkQuality(code: string, language: string): Promise<QualityValidation>;

    /**
     * Security scan
     */
    scanSecurity(code: string, language: string): Promise<SecurityValidation>;

    /**
     * Check best practices
     */
    checkBestPractices(code: string, language: string): Promise<BestPracticesValidation>;

    /**
     * Get validation statistics
     */
    getStatistics(): {
        totalValidations: number;
        passedValidations: number;
        failedValidations: number;
        averageScore: number;
    };
}
