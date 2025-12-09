/**
 * ============================================
 * OUTPUT VALIDATOR - AGENT OUTPUT VERIFICATION
 * ============================================
 * 
 * Validates agent outputs BEFORE they're accepted.
 * Provides fast, deterministic checks to complement
 * the slower LLM-based deviation detection.
 * 
 * Validation Layers:
 * 1. Structure Check - Is the output well-formed?
 * 2. Syntax Check - Does the code parse correctly?
 * 3. Completeness Check - Are required sections present?
 * 4. Integration Check - Are imports/exports valid?
 */

import { AgentName, AGENT_REGISTRY } from "../state";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface ValidationResult {
    isValid: boolean;
    score: number;            // 0-100 validation score
    errors: ValidationError[];
    warnings: ValidationWarning[];
    metadata: ValidationMetadata;
}

export interface ValidationError {
    code: string;
    message: string;
    severity: "critical" | "major" | "minor";
    location?: string;        // Line number or section
    suggestion?: string;
}

export interface ValidationWarning {
    code: string;
    message: string;
    suggestion?: string;
}

export interface ValidationMetadata {
    agent: AgentName;
    taskId: string;
    validatedAt: Date;
    duration: number;
    checksPerformed: string[];
}

export interface ValidationRule {
    name: string;
    description: string;
    check: (output: string, context: ValidationContext) => ValidationCheckResult;
}

export interface ValidationContext {
    agent: AgentName;
    taskDescription: string;
    validationCriteria: string[];
    expectedOutputType: OutputType;
}

export interface ValidationCheckResult {
    passed: boolean;
    score: number;
    errors?: ValidationError[];
    warnings?: ValidationWarning[];
}

export type OutputType =
    | "typescript"
    | "javascript"
    | "prisma"
    | "sql"
    | "yaml"
    | "dockerfile"
    | "json"
    | "markdown"
    | "mixed";

// ============================================
// VALIDATION RULES
// ============================================

const COMMON_RULES: ValidationRule[] = [
    {
        name: "non-empty",
        description: "Output must not be empty",
        check: (output) => ({
            passed: output.trim().length > 0,
            score: output.trim().length > 0 ? 100 : 0,
            errors: output.trim().length === 0 ? [{
                code: "EMPTY_OUTPUT",
                message: "Agent produced empty output",
                severity: "critical"
            }] : undefined
        })
    },
    {
        name: "minimum-length",
        description: "Output must have meaningful content",
        check: (output) => {
            const length = output.trim().length;
            if (length < 50) {
                return {
                    passed: false,
                    score: 20,
                    errors: [{
                        code: "TOO_SHORT",
                        message: "Output is too short to be useful",
                        severity: "major",
                        suggestion: "Agent should provide more detailed output"
                    }]
                };
            }
            return { passed: true, score: 100 };
        }
    },
    {
        name: "has-code-block",
        description: "Output should contain code blocks for code-generating agents",
        check: (output, context) => {
            const codeAgents: AgentName[] = [
                "auth_agent", "db_agent", "api_agent", "security_agent",
                "queue_agent", "cicd_agent", "monitoring_agent", "test_agent",
                "infra_agent", "codegen_agent", "microservice_agent", "email_agent"
            ];

            if (!codeAgents.includes(context.agent)) {
                return { passed: true, score: 100 };
            }

            const hasCodeBlock = /```[\w]*\n[\s\S]*?```/.test(output);
            return {
                passed: hasCodeBlock,
                score: hasCodeBlock ? 100 : 40,
                warnings: !hasCodeBlock ? [{
                    code: "NO_CODE_BLOCK",
                    message: "Code-generating agent did not produce code blocks",
                    suggestion: "Wrap code in ```typescript or appropriate language tags"
                }] : undefined
            };
        }
    },
    {
        name: "no-placeholder",
        description: "Output should not contain placeholders",
        check: (output) => {
            const placeholders = [
                /\[YOUR_.*?\]/gi,
                /\{YOUR_.*?\}/gi,
                /TODO:/gi,
                /FIXME:/gi,
                /\.\.\./g,  // Only count ... if there are multiple
                /<insert.*?>/gi,
                /REPLACE_THIS/gi
            ];

            const foundPlaceholders: string[] = [];
            for (const pattern of placeholders) {
                const matches = output.match(pattern);
                if (matches) {
                    foundPlaceholders.push(...matches.slice(0, 3));
                }
            }

            // Allow a few todos, but not too many
            const todoCount = (output.match(/TODO:/gi) || []).length;
            if (todoCount > 3) {
                foundPlaceholders.push("Too many TODOs");
            }

            return {
                passed: foundPlaceholders.length === 0,
                score: Math.max(0, 100 - foundPlaceholders.length * 15),
                warnings: foundPlaceholders.length > 0 ? [{
                    code: "HAS_PLACEHOLDERS",
                    message: `Found ${foundPlaceholders.length} placeholders: ${foundPlaceholders.slice(0, 3).join(", ")}`,
                    suggestion: "Replace placeholders with actual implementations"
                }] : undefined
            };
        }
    }
];

const TYPESCRIPT_RULES: ValidationRule[] = [
    {
        name: "valid-imports",
        description: "TypeScript imports should be properly formatted",
        check: (output) => {
            const codeBlocks = extractCodeBlocks(output, "typescript");
            if (codeBlocks.length === 0) {
                return { passed: true, score: 100 };
            }

            const errors: ValidationError[] = [];

            for (const code of codeBlocks) {
                // Check for malformed imports
                const importLines = code.match(/^import .+$/gm) || [];

                for (const line of importLines) {
                    // Check for missing from clause
                    if (line.includes("import ") && !line.includes(" from ")) {
                        if (!line.includes("import type") && !line.match(/import\s*{/)) {
                            // Could be fine for side-effect imports
                        } else if (!line.includes("from")) {
                            errors.push({
                                code: "MALFORMED_IMPORT",
                                message: `Import missing 'from' clause: ${line.substring(0, 50)}`,
                                severity: "major"
                            });
                        }
                    }
                }

                // Check for common TypeScript errors
                if (code.includes("any[][]")) {
                    errors.push({
                        code: "SUSPICIOUS_TYPE",
                        message: "Found 'any[][]' - consider using proper types",
                        severity: "minor"
                    });
                }
            }

            return {
                passed: errors.length === 0,
                score: Math.max(0, 100 - errors.length * 20),
                errors: errors.length > 0 ? errors : undefined
            };
        }
    },
    {
        name: "has-exports",
        description: "TypeScript modules should export their main functionality",
        check: (output) => {
            const codeBlocks = extractCodeBlocks(output, "typescript");
            if (codeBlocks.length === 0) {
                return { passed: true, score: 100 };
            }

            const hasExport = codeBlocks.some(code =>
                code.includes("export ") ||
                code.includes("module.exports")
            );

            return {
                passed: hasExport,
                score: hasExport ? 100 : 70,
                warnings: !hasExport ? [{
                    code: "NO_EXPORTS",
                    message: "No exports found in TypeScript code",
                    suggestion: "Add export statements for main functions/classes"
                }] : undefined
            };
        }
    },
    {
        name: "has-types",
        description: "TypeScript code should include type annotations",
        check: (output) => {
            const codeBlocks = extractCodeBlocks(output, "typescript");
            if (codeBlocks.length === 0) {
                return { passed: true, score: 100 };
            }

            const combined = codeBlocks.join("\n");
            const hasTypes =
                combined.includes(": string") ||
                combined.includes(": number") ||
                combined.includes(": boolean") ||
                combined.includes("interface ") ||
                combined.includes("type ") ||
                combined.includes(": Promise<") ||
                combined.includes(": void") ||
                combined.includes("<T>") ||
                combined.includes(": Record<");

            return {
                passed: hasTypes,
                score: hasTypes ? 100 : 60,
                warnings: !hasTypes ? [{
                    code: "NO_TYPES",
                    message: "TypeScript code lacks type annotations",
                    suggestion: "Add TypeScript types for better type safety"
                }] : undefined
            };
        }
    }
];

const AGENT_SPECIFIC_RULES: Partial<Record<AgentName, ValidationRule[]>> = {
    auth_agent: [
        {
            name: "has-auth-concepts",
            description: "Auth code should include authentication concepts",
            check: (output) => {
                const authKeywords = [
                    "token", "jwt", "session", "cookie", "auth",
                    "login", "logout", "password", "credential",
                    "clerk", "oauth", "bearer", "middleware"
                ];

                const lower = output.toLowerCase();
                const found = authKeywords.filter(k => lower.includes(k));

                return {
                    passed: found.length >= 2,
                    score: Math.min(100, found.length * 20),
                    warnings: found.length < 2 ? [{
                        code: "MISSING_AUTH_CONCEPTS",
                        message: "Auth code should mention authentication concepts",
                        suggestion: "Include token handling, session management, or auth middleware"
                    }] : undefined
                };
            }
        },
        {
            name: "no-hardcoded-secrets",
            description: "Auth code should not contain hardcoded secrets",
            check: (output) => {
                const secretPatterns = [
                    /["']sk_live_[a-zA-Z0-9]+["']/g,
                    /["']pk_live_[a-zA-Z0-9]+["']/g,
                    /password\s*[:=]\s*["'][^"']+["']/gi,
                    /secret\s*[:=]\s*["'][^"']+["']/gi,
                    /jwt[_]?secret\s*[:=]\s*["'][^"']+["']/gi
                ];

                const errors: ValidationError[] = [];
                for (const pattern of secretPatterns) {
                    if (pattern.test(output)) {
                        errors.push({
                            code: "HARDCODED_SECRET",
                            message: "Potential hardcoded secret detected",
                            severity: "critical",
                            suggestion: "Use environment variables (process.env.SECRET_NAME)"
                        });
                        break;
                    }
                }

                return {
                    passed: errors.length === 0,
                    score: errors.length === 0 ? 100 : 0,
                    errors: errors.length > 0 ? errors : undefined
                };
            }
        },
        {
            name: "uses-secure-crypto",
            description: "Auth code should use secure cryptographic algorithms",
            check: (output) => {
                const lower = output.toLowerCase();
                const warnings: ValidationWarning[] = [];

                // Check for weak hashing
                if ((lower.includes("md5") || lower.includes("sha1")) &&
                    (lower.includes("password") || lower.includes("hash"))) {
                    warnings.push({
                        code: "WEAK_CRYPTO",
                        message: "Weak hashing algorithm detected (MD5/SHA1)",
                        suggestion: "Use bcrypt, argon2, or scrypt for password hashing"
                    });
                }

                // Check for jwt algorithm specification
                if (lower.includes("jwt.sign") && !lower.includes("algorithm")) {
                    warnings.push({
                        code: "JWT_NO_ALGORITHM",
                        message: "JWT sign without explicit algorithm",
                        suggestion: "Specify algorithm: { algorithm: 'RS256' }"
                    });
                }

                return {
                    passed: warnings.length === 0,
                    score: Math.max(0, 100 - warnings.length * 25),
                    warnings: warnings.length > 0 ? warnings : undefined
                };
            }
        },
        {
            name: "has-error-handling",
            description: "Auth code should include proper error handling",
            check: (output) => {
                const codeBlocks = extractCodeBlocks(output, "typescript");
                if (codeBlocks.length === 0) return { passed: true, score: 100 };

                const code = codeBlocks.join("\n");
                const hasTryCatch = code.includes("try") && code.includes("catch");
                const hasErrorResponse = code.includes("catch") ||
                    code.includes(".status(4") ||
                    code.includes("throw");

                return {
                    passed: hasTryCatch || hasErrorResponse,
                    score: (hasTryCatch || hasErrorResponse) ? 100 : 60,
                    warnings: !hasTryCatch && !hasErrorResponse ? [{
                        code: "NO_ERROR_HANDLING",
                        message: "Auth code lacks explicit error handling",
                        suggestion: "Wrap auth operations in try-catch blocks"
                    }] : undefined
                };
            }
        },
        {
            name: "uses-env-variables",
            description: "Auth code should use environment variables for configuration",
            check: (output) => {
                const lower = output.toLowerCase();
                const hasEnvVars = output.includes("process.env") ||
                    output.includes("import.meta.env");

                // Only check if output appears to have configuration
                if (lower.includes("secret") || lower.includes("key") || lower.includes("password")) {
                    return {
                        passed: hasEnvVars,
                        score: hasEnvVars ? 100 : 50,
                        warnings: !hasEnvVars ? [{
                            code: "NO_ENV_VARS",
                            message: "Auth configuration should use environment variables",
                            suggestion: "Replace hardcoded values with process.env.VARIABLE_NAME"
                        }] : undefined
                    };
                }

                return { passed: true, score: 100 };
            }
        }
    ],
    db_agent: [
        {
            name: "has-schema-definition",
            description: "Database code should include schema definitions",
            check: (output) => {
                const schemaKeywords = [
                    "model", "schema", "table", "column", "field",
                    "prisma", "drizzle", "create table", "@id", "@relation"
                ];

                const lower = output.toLowerCase();
                const found = schemaKeywords.filter(k => lower.includes(k));

                return {
                    passed: found.length >= 2,
                    score: Math.min(100, found.length * 15),
                    warnings: found.length < 2 ? [{
                        code: "MISSING_SCHEMA",
                        message: "Database code should include schema definitions",
                        suggestion: "Include model/table definitions with proper fields"
                    }] : undefined
                };
            }
        }
    ],
    api_agent: [
        {
            name: "has-http-methods",
            description: "API code should include HTTP method handlers",
            check: (output) => {
                const httpKeywords = [
                    "get", "post", "put", "patch", "delete",
                    "router", "endpoint", "route", "express", "fastify",
                    "request", "response", "res.json", "res.send"
                ];

                const lower = output.toLowerCase();
                const found = httpKeywords.filter(k => lower.includes(k));

                return {
                    passed: found.length >= 3,
                    score: Math.min(100, found.length * 12),
                    warnings: found.length < 3 ? [{
                        code: "MISSING_HTTP_METHODS",
                        message: "API code should include HTTP method handlers",
                        suggestion: "Include GET/POST/PUT/DELETE route handlers"
                    }] : undefined
                };
            }
        }
    ],
    security_agent: [
        {
            name: "has-security-measures",
            description: "Security code should include protective measures",
            check: (output) => {
                const securityKeywords = [
                    "sanitize", "validate", "escape", "hash",
                    "rate limit", "cors", "helmet", "csrf",
                    "xss", "sql injection", "encryption"
                ];

                const lower = output.toLowerCase();
                const found = securityKeywords.filter(k => lower.includes(k));

                return {
                    passed: found.length >= 2,
                    score: Math.min(100, found.length * 20),
                    warnings: found.length < 2 ? [{
                        code: "MISSING_SECURITY",
                        message: "Security code should include protective measures",
                        suggestion: "Include input validation, rate limiting, or security headers"
                    }] : undefined
                };
            }
        }
    ]
};

// ============================================
// OUTPUT VALIDATOR CLASS
// ============================================

export class OutputValidator {
    private commonRules: ValidationRule[];
    private typeScriptRules: ValidationRule[];
    private agentRules: Partial<Record<AgentName, ValidationRule[]>>;

    constructor() {
        this.commonRules = COMMON_RULES;
        this.typeScriptRules = TYPESCRIPT_RULES;
        this.agentRules = AGENT_SPECIFIC_RULES;
    }

    /**
     * Validate an agent's output
     */
    validate(
        output: string,
        agent: AgentName,
        taskId: string,
        taskDescription: string,
        validationCriteria: string[] = []
    ): ValidationResult {
        const startTime = Date.now();
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const checksPerformed: string[] = [];
        let totalScore = 0;
        let ruleCount = 0;

        // Determine output type
        const expectedOutputType = this.detectOutputType(output, agent);

        const context: ValidationContext = {
            agent,
            taskDescription,
            validationCriteria,
            expectedOutputType
        };

        // Run common rules
        for (const rule of this.commonRules) {
            const result = rule.check(output, context);
            checksPerformed.push(rule.name);
            totalScore += result.score;
            ruleCount++;

            if (result.errors) errors.push(...result.errors);
            if (result.warnings) warnings.push(...result.warnings);
        }

        // Run TypeScript rules if applicable
        if (expectedOutputType === "typescript" || expectedOutputType === "javascript") {
            for (const rule of this.typeScriptRules) {
                const result = rule.check(output, context);
                checksPerformed.push(rule.name);
                totalScore += result.score;
                ruleCount++;

                if (result.errors) errors.push(...result.errors);
                if (result.warnings) warnings.push(...result.warnings);
            }
        }

        // Run agent-specific rules
        const agentSpecificRules = this.agentRules[agent] || [];
        for (const rule of agentSpecificRules) {
            const result = rule.check(output, context);
            checksPerformed.push(rule.name);
            totalScore += result.score;
            ruleCount++;

            if (result.errors) errors.push(...result.errors);
            if (result.warnings) warnings.push(...result.warnings);
        }

        // Check validation criteria from task
        for (const criterion of validationCriteria) {
            const criterionResult = this.checkCriterion(output, criterion);
            checksPerformed.push(`criterion:${criterion.substring(0, 30)}`);
            totalScore += criterionResult.score;
            ruleCount++;

            if (!criterionResult.passed) {
                warnings.push({
                    code: "CRITERION_NOT_MET",
                    message: `Validation criterion may not be met: "${criterion}"`,
                    suggestion: "Ensure the output addresses this requirement"
                });
            }
        }

        const averageScore = ruleCount > 0 ? Math.round(totalScore / ruleCount) : 0;
        const hasCriticalErrors = errors.some(e => e.severity === "critical");
        const hasMajorErrors = errors.filter(e => e.severity === "major").length >= 2;

        return {
            isValid: !hasCriticalErrors && !hasMajorErrors && averageScore >= 60,
            score: averageScore,
            errors,
            warnings,
            metadata: {
                agent,
                taskId,
                validatedAt: new Date(),
                duration: Date.now() - startTime,
                checksPerformed
            }
        };
    }

    /**
     * Quick validation - just check if output is usable
     */
    quickValidate(output: string, agent: AgentName): {
        isUsable: boolean;
        reason?: string;
    } {
        if (!output || output.trim().length === 0) {
            return { isUsable: false, reason: "Empty output" };
        }

        if (output.trim().length < 50) {
            return { isUsable: false, reason: "Output too short" };
        }

        // Check for error messages
        if (output.toLowerCase().includes("i cannot") ||
            output.toLowerCase().includes("i'm unable") ||
            output.toLowerCase().includes("error:")) {
            return { isUsable: false, reason: "Output contains error or refusal" };
        }

        return { isUsable: true };
    }

    /**
     * Detect the expected output type based on agent and content
     */
    private detectOutputType(output: string, agent: AgentName): OutputType {
        // Check code blocks for language hints
        const langMatch = output.match(/```(\w+)/);
        if (langMatch) {
            const lang = langMatch[1].toLowerCase();
            if (["ts", "typescript"].includes(lang)) return "typescript";
            if (["js", "javascript"].includes(lang)) return "javascript";
            if (lang === "prisma") return "prisma";
            if (["sql", "postgresql", "mysql"].includes(lang)) return "sql";
            if (["yaml", "yml"].includes(lang)) return "yaml";
            if (lang === "dockerfile") return "dockerfile";
            if (lang === "json") return "json";
        }

        // Default based on agent
        const agentDefaults: Partial<Record<AgentName, OutputType>> = {
            auth_agent: "typescript",
            db_agent: "prisma",
            api_agent: "typescript",
            cicd_agent: "yaml",
            infra_agent: "yaml"
        };

        return agentDefaults[agent] || "mixed";
    }

    /**
     * Check if a validation criterion is likely met
     */
    private checkCriterion(output: string, criterion: string): {
        passed: boolean;
        score: number;
    } {
        const lower = output.toLowerCase();
        const criterionLower = criterion.toLowerCase();

        // Extract key words from criterion
        const keyWords = criterionLower
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 3);

        // Check how many key words appear in output
        const matchedWords = keyWords.filter(w => lower.includes(w));
        const matchRatio = keyWords.length > 0
            ? matchedWords.length / keyWords.length
            : 0;

        return {
            passed: matchRatio >= 0.5,
            score: Math.round(matchRatio * 100)
        };
    }

    /**
     * Print validation result
     */
    printResult(result: ValidationResult): void {
        const icon = result.isValid ? "✅" : "❌";
        const agentName = AGENT_REGISTRY[result.metadata.agent].name;

        console.log(`\n${icon} VALIDATION RESULT: ${agentName}`);
        console.log(`   Score: ${result.score}/100`);
        console.log(`   Duration: ${result.metadata.duration}ms`);
        console.log(`   Checks: ${result.metadata.checksPerformed.length}`);

        if (result.errors.length > 0) {
            console.log(`\n   ❌ ERRORS (${result.errors.length}):`);
            for (const error of result.errors) {
                console.log(`      [${error.severity.toUpperCase()}] ${error.message}`);
                if (error.suggestion) {
                    console.log(`         💡 ${error.suggestion}`);
                }
            }
        }

        if (result.warnings.length > 0) {
            console.log(`\n   ⚠️ WARNINGS (${result.warnings.length}):`);
            for (const warning of result.warnings.slice(0, 5)) {
                console.log(`      ${warning.message}`);
            }
        }
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractCodeBlocks(output: string, language?: string): string[] {
    const pattern = language
        ? new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, "gi")
        : /```[\w]*\n([\s\S]*?)```/gi;

    const blocks: string[] = [];
    let match;

    while ((match = pattern.exec(output)) !== null) {
        blocks.push(match[1]);
    }

    return blocks;
}

// Export singleton instance
export const outputValidator = new OutputValidator();
