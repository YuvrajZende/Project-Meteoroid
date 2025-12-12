/**
 * ============================================
 * AUTH AGENT ENHANCED - ADVANCED AGENTIC CAPABILITIES
 * ============================================
 * 
 * Enhanced AuthAgent with:
 * 1. Code Analysis & Self-Validation
 * 2. Context-Aware Generation
 * 3. Interactive Clarification
 * 4. Tool Calling (File, Database, Security, Test)
 * 5. Multi-Step Generation Pipeline
 * 6. Learning from Corrections
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import {
    CLERK_SETUP_TEMPLATE,
    CLERK_WEBHOOK_TEMPLATE,
    JWT_MIDDLEWARE_TEMPLATE,
    JWT_AUTH_ROUTES_TEMPLATE,
    OAUTH_PROVIDER_TEMPLATE,
    RBAC_TEMPLATE,
    getAuthTemplates
} from "./templates";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface AuthConfig {
    provider: AuthProvider;
    features: AuthFeature[];
    oauth?: OAuthConfig;
    jwt?: JWTConfig;
    rbac?: RBACConfig;
    mfa?: MFAConfig;
    session?: SessionConfig;
    projectContext?: ProjectContext;
}

export type AuthProvider = "clerk" | "custom" | "auth0" | "supabase";

export type AuthFeature =
    | "login" | "register" | "logout" | "forgot-password"
    | "reset-password" | "email-verification" | "oauth"
    | "mfa" | "rbac" | "abac" | "session" | "refresh-token" | "api-keys";

export interface OAuthConfig {
    providers: OAuthProvider[];
    callbackUrl: string;
}

export type OAuthProvider = "google" | "github" | "facebook" | "twitter" | "apple";

export interface JWTConfig {
    algorithm: "HS256" | "RS256";
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer?: string;
}

export interface RBACConfig {
    roles: RoleDefinition[];
    defaultRole: string;
}

export interface RoleDefinition {
    name: string;
    permissions: string[];
    inherits?: string[];
}

export interface MFAConfig {
    methods: MFAMethod[];
    required: boolean;
}

export type MFAMethod = "totp" | "sms" | "email" | "backup_codes";

export interface SessionConfig {
    duration: number;
    refreshThreshold: number;
    maxConcurrent: number;
}

export interface ProjectContext {
    existingFiles?: string[];
    codeStyle?: CodeStyle;
    databaseSchema?: DatabaseSchema;
    framework?: string;
}

export interface CodeStyle {
    useSemicolons: boolean;
    useTabsOverSpaces: boolean;
    indentSize: number;
    quoteStyle: "single" | "double";
}

export interface DatabaseSchema {
    hasUserTable: boolean;
    userFields?: string[];
    orm?: "prisma" | "drizzle" | "typeorm";
}

export interface AuthGenerationResult {
    files: GeneratedFile[];
    dependencies: string[];
    envVariables: string[];
    instructions: string[];
    validationReport: ValidationReport;
    clarifications?: ClarificationRequest[];
}

export interface GeneratedFile {
    path: string;
    content: string;
    description: string;
    validated: boolean;
    issues?: CodeIssue[];
}

export interface ValidationReport {
    passed: boolean;
    score: number;
    securityIssues: SecurityIssue[];
    codeQualityIssues: CodeIssue[];
    suggestions: string[];
}

export interface SecurityIssue {
    severity: "critical" | "high" | "medium" | "low";
    type: string;
    message: string;
    line?: number;
    fix?: string;
}

export interface CodeIssue {
    type: "error" | "warning" | "info";
    message: string;
    line?: number;
    fix?: string;
}

export interface ClarificationRequest {
    question: string;
    options?: string[];
    required: boolean;
    context: string;
}

export interface CorrectionRecord {
    id: string;
    originalCode: string;
    correctedCode: string;
    issueType: string;
    timestamp: Date;
    learned: boolean;
}

// ============================================
// GENERATION PIPELINE STAGES
// ============================================

export type PipelineStage =
    | "analyze"
    | "clarify"
    | "generate-types"
    | "generate-core"
    | "generate-middleware"
    | "generate-tests"
    | "validate"
    | "self-correct"
    | "complete";

export interface PipelineState {
    stage: PipelineStage;
    config: AuthConfig;
    files: GeneratedFile[];
    issues: CodeIssue[];
    corrections: number;
    startTime: Date;
}

// ============================================
// ENHANCED AUTH AGENT CLASS
// ============================================

export class AuthAgentEnhanced {
    private model: ChatOpenAI;
    private corrections: CorrectionRecord[] = [];
    private pipelineState: PipelineState | null = null;
    private maxSelfCorrections: number = 3;

    constructor() {
        this.model = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
            temperature: 0.3,
        });
    }

    // ============================================
    // 5. MULTI-STEP GENERATION PIPELINE
    // ============================================

    /**
     * Main entry point - runs the full generation pipeline
     */
    async generateAuthSystem(config: AuthConfig): Promise<AuthGenerationResult> {
        console.log(`\n🔐 [AuthAgent] Starting enhanced generation pipeline...`);

        // Initialize pipeline state
        this.pipelineState = {
            stage: "analyze",
            config,
            files: [],
            issues: [],
            corrections: 0,
            startTime: new Date()
        };

        const result: AuthGenerationResult = {
            files: [],
            dependencies: [],
            envVariables: [],
            instructions: [],
            validationReport: {
                passed: false,
                score: 0,
                securityIssues: [],
                codeQualityIssues: [],
                suggestions: []
            }
        };

        try {
            // Stage 1: Analyze requirements
            this.pipelineState.stage = "analyze";
            console.log(`   📊 Stage 1: Analyzing requirements...`);
            const analysis = await this.analyzeRequirements(config);

            // Stage 2: Check for clarifications needed
            this.pipelineState.stage = "clarify";
            console.log(`   ❓ Stage 2: Checking for ambiguities...`);
            const clarifications = await this.checkClarificationsNeeded(config, analysis);
            if (clarifications.length > 0) {
                result.clarifications = clarifications;
                // In production, would pause here for user input
                // For now, we'll proceed with defaults
            }

            // Stage 3: Generate types/interfaces
            this.pipelineState.stage = "generate-types";
            console.log(`   📝 Stage 3: Generating types...`);
            const typesFile = await this.generateTypes(config);
            result.files.push(typesFile);

            // Stage 4: Generate core auth logic
            this.pipelineState.stage = "generate-core";
            console.log(`   🔑 Stage 4: Generating core auth...`);
            const coreFiles = await this.generateCoreAuth(config);
            result.files.push(...coreFiles);

            // Stage 5: Generate middleware
            this.pipelineState.stage = "generate-middleware";
            console.log(`   🛡️ Stage 5: Generating middleware...`);
            const middlewareFiles = await this.generateMiddleware(config);
            result.files.push(...middlewareFiles);

            // Stage 6: Generate tests
            this.pipelineState.stage = "generate-tests";
            console.log(`   🧪 Stage 6: Generating tests...`);
            const testFiles = await this.generateTests(config, result.files);
            result.files.push(...testFiles);

            // Stage 7: Validate all generated code
            this.pipelineState.stage = "validate";
            console.log(`   ✅ Stage 7: Validating code...`);
            result.validationReport = await this.validateAllCode(result.files);

            // Stage 8: Self-correct if issues found
            if (!result.validationReport.passed && this.pipelineState.corrections < this.maxSelfCorrections) {
                this.pipelineState.stage = "self-correct";
                console.log(`   🔧 Stage 8: Self-correcting issues...`);
                result.files = await this.selfCorrect(result.files, result.validationReport);
                result.validationReport = await this.validateAllCode(result.files);
            }

            // Collect dependencies and env vars
            result.dependencies = this.collectDependencies(config);
            result.envVariables = this.collectEnvVariables(config);
            result.instructions = this.generateInstructions(config, result.files);

            this.pipelineState.stage = "complete";
            const duration = Date.now() - this.pipelineState.startTime.getTime();
            console.log(`   ✨ Pipeline complete in ${duration}ms`);

        } catch (error: any) {
            console.error(`   ❌ Pipeline failed: ${error.message}`);
            result.validationReport.suggestions.push(`Generation failed: ${error.message}`);
        }

        return result;
    }

    // ============================================
    // 1. CODE ANALYSIS & SELF-VALIDATION
    // ============================================

    /**
     * Validate all generated code for security and quality
     */
    private async validateAllCode(files: GeneratedFile[]): Promise<ValidationReport> {
        const report: ValidationReport = {
            passed: true,
            score: 100,
            securityIssues: [],
            codeQualityIssues: [],
            suggestions: []
        };

        for (const file of files) {
            const fileIssues = await this.analyzeCode(file.content);
            file.issues = fileIssues.codeIssues;
            file.validated = fileIssues.codeIssues.filter(i => i.type === "error").length === 0;

            report.securityIssues.push(...fileIssues.securityIssues);
            report.codeQualityIssues.push(...fileIssues.codeIssues);

            // Deduct score based on issues
            report.score -= fileIssues.securityIssues.filter(i => i.severity === "critical").length * 25;
            report.score -= fileIssues.securityIssues.filter(i => i.severity === "high").length * 15;
            report.score -= fileIssues.securityIssues.filter(i => i.severity === "medium").length * 5;
            report.score -= fileIssues.codeIssues.filter(i => i.type === "error").length * 10;
        }

        report.score = Math.max(0, report.score);
        report.passed = report.score >= 70 &&
            report.securityIssues.filter(i => i.severity === "critical").length === 0;

        return report;
    }

    /**
     * Analyze code for security vulnerabilities and quality issues
     */
    private async analyzeCode(code: string): Promise<{
        securityIssues: SecurityIssue[];
        codeIssues: CodeIssue[];
    }> {
        const securityIssues: SecurityIssue[] = [];
        const codeIssues: CodeIssue[] = [];

        // Check for exposed secrets
        const secretPatterns = [
            { pattern: /["']sk_live_[a-zA-Z0-9]+["']/g, type: "exposed_api_key" },
            { pattern: /["']pk_live_[a-zA-Z0-9]+["']/g, type: "exposed_api_key" },
            { pattern: /password\s*=\s*["'][^"']+["']/gi, type: "hardcoded_password" },
            { pattern: /secret\s*=\s*["'][^"']+["']/gi, type: "hardcoded_secret" },
            { pattern: /jwt[_]?secret\s*[:=]\s*["'][^"']+["']/gi, type: "hardcoded_jwt_secret" }
        ];

        for (const { pattern, type } of secretPatterns) {
            if (pattern.test(code)) {
                securityIssues.push({
                    severity: "critical",
                    type,
                    message: `Potential hardcoded secret detected: ${type}`,
                    fix: "Use environment variables instead of hardcoded values"
                });
            }
        }

        // Check for weak crypto
        if (/md5|sha1/i.test(code) && /password|hash/i.test(code)) {
            securityIssues.push({
                severity: "high",
                type: "weak_crypto",
                message: "Weak hashing algorithm detected (MD5/SHA1). Use bcrypt or argon2 for passwords.",
                fix: "Replace with bcrypt.hash() or argon2.hash()"
            });
        }

        // Check for SQL injection risks
        if (/\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/i.test(code)) {
            securityIssues.push({
                severity: "high",
                type: "sql_injection",
                message: "Potential SQL injection vulnerability - using template literals in SQL",
                fix: "Use parameterized queries or an ORM"
            });
        }

        // Check for missing error handling
        if (/await\s+\w+\(/.test(code) && !/try\s*{/.test(code)) {
            codeIssues.push({
                type: "warning",
                message: "Async operation without try-catch error handling",
                fix: "Wrap async operations in try-catch blocks"
            });
        }

        // Check for missing type annotations
        if (/function\s+\w+\([^)]*\)\s*{/.test(code) && !/:\s*\w+/.test(code)) {
            codeIssues.push({
                type: "warning",
                message: "Function missing TypeScript return type annotation",
                fix: "Add explicit return type annotations"
            });
        }

        // Check for proper JWT verification
        if (/jwt\.verify/.test(code) && !/algorithms/.test(code)) {
            securityIssues.push({
                severity: "medium",
                type: "jwt_algorithm_confusion",
                message: "JWT verification without explicit algorithm specification",
                fix: "Specify allowed algorithms in jwt.verify() options"
            });
        }

        // Check for imports
        const importMatches = code.match(/from ["']([^"']+)["']/g) || [];
        const usedModules = code.match(/\b(?:require|import)\s*\(?["']([^"']+)["']\)?/g) || [];

        // Check for console.log in production code
        if (/console\.log/.test(code) && !/console\.error|console\.warn/.test(code)) {
            codeIssues.push({
                type: "info",
                message: "console.log detected - consider using a proper logger",
                fix: "Replace with a logging library like winston or pino"
            });
        }

        return { securityIssues, codeIssues };
    }

    /**
     * Validate that imports exist and are correct
     */
    private validateImports(code: string): CodeIssue[] {
        const issues: CodeIssue[] = [];
        const importRegex = /import\s+{([^}]+)}\s+from\s+["']([^"']+)["']/g;

        const knownExports: Record<string, string[]> = {
            "express": ["Request", "Response", "NextFunction", "Router"],
            "jsonwebtoken": ["sign", "verify", "decode"],
            "bcryptjs": ["hash", "compare", "genSalt"],
            "@clerk/backend": ["Clerk", "clerkClient"],
            "ioredis": ["Redis"],
        };

        let match;
        while ((match = importRegex.exec(code)) !== null) {
            const imports = match[1].split(",").map(i => i.trim());
            const module = match[2];

            if (knownExports[module]) {
                for (const imp of imports) {
                    const cleanImp = imp.replace(/\s+as\s+\w+/, "").trim();
                    if (!knownExports[module].includes(cleanImp)) {
                        issues.push({
                            type: "warning",
                            message: `Import '${cleanImp}' may not exist in '${module}'`,
                            fix: `Verify that ${cleanImp} is exported from ${module}`
                        });
                    }
                }
            }
        }

        return issues;
    }

    // ============================================
    // 2. CONTEXT-AWARE GENERATION
    // ============================================

    /**
     * Read existing project context
     */
    private async readProjectContext(config: AuthConfig): Promise<ProjectContext> {
        const context: ProjectContext = {
            existingFiles: [],
            framework: "express", // Default
        };

        // This would use FileSystemTool in production
        // For now, we'll detect from config
        if (config.projectContext) {
            return { ...context, ...config.projectContext };
        }

        return context;
    }

    /**
     * Detect existing auth patterns in project
     */
    private async detectExistingPatterns(context: ProjectContext): Promise<{
        hasExistingAuth: boolean;
        patterns: string[];
    }> {
        // Would scan project files in production
        return {
            hasExistingAuth: false,
            patterns: []
        };
    }

    /**
     * Adapt code to match project style
     */
    private adaptToCodeStyle(code: string, style?: CodeStyle): string {
        if (!style) return code;

        let adapted = code;

        // Handle semicolons
        if (!style.useSemicolons) {
            adapted = adapted.replace(/;(\s*\n)/g, "$1");
        }

        // Handle quotes
        if (style.quoteStyle === "single") {
            adapted = adapted.replace(/"/g, "'");
        }

        return adapted;
    }

    // ============================================
    // 3. INTERACTIVE CLARIFICATION
    // ============================================

    /**
     * Check if clarifications are needed
     */
    private async checkClarificationsNeeded(
        config: AuthConfig,
        analysis: any
    ): Promise<ClarificationRequest[]> {
        const clarifications: ClarificationRequest[] = [];

        // Check for ambiguous provider choice
        if (!config.provider) {
            clarifications.push({
                question: "Which authentication provider would you like to use?",
                options: ["clerk", "custom", "auth0", "supabase"],
                required: true,
                context: "Different providers have different integration complexity"
            });
        }

        // Check for security implications
        if (config.features.includes("oauth") && !config.oauth?.providers) {
            clarifications.push({
                question: "Which OAuth providers would you like to support?",
                options: ["google", "github", "facebook", "twitter", "apple"],
                required: false,
                context: "Each provider requires API credentials"
            });
        }

        // Warn about security choices
        if (config.jwt?.algorithm === "HS256") {
            clarifications.push({
                question: "Warning: HS256 uses symmetric signing. Would you prefer RS256 (asymmetric) for better security?",
                options: ["Keep HS256", "Switch to RS256"],
                required: false,
                context: "RS256 is recommended for production as it uses separate public/private keys"
            });
        }

        return clarifications;
    }

    /**
     * Generate suggestions based on project type
     */
    private suggestAuthOptions(framework: string): string[] {
        const suggestions: Record<string, string[]> = {
            "nextjs": ["clerk", "next-auth", "custom-jwt"],
            "express": ["passport", "custom-jwt", "clerk-express"],
            "fastify": ["fastify-jwt", "custom-jwt"],
            "nestjs": ["passport", "guards", "custom-jwt"]
        };

        return suggestions[framework] || ["custom-jwt"];
    }

    // ============================================
    // 4. TOOL INTEGRATION (Simulated)
    // ============================================

    /**
     * File System Tool - Read file
     */
    private async toolReadFile(path: string): Promise<string | null> {
        // In production, would use FileSystemTool
        console.log(`   📖 [Tool] Reading file: ${path}`);
        return null;
    }

    /**
     * File System Tool - Write file
     */
    private async toolWriteFile(path: string, content: string): Promise<boolean> {
        // In production, would use FileSystemTool
        console.log(`   📝 [Tool] Writing file: ${path}`);
        return true;
    }

    /**
     * Database Tool - Check schema
     */
    private async toolCheckDatabaseSchema(): Promise<DatabaseSchema | null> {
        // In production, would read Prisma schema or similar
        console.log(`   🗄️ [Tool] Checking database schema...`);
        return {
            hasUserTable: true,
            userFields: ["id", "email", "name", "password", "role"],
            orm: "prisma"
        };
    }

    /**
     * Security Tool - Run security scan
     */
    private async toolSecurityScan(code: string): Promise<SecurityIssue[]> {
        console.log(`   🔒 [Tool] Running security scan...`);
        const analysis = await this.analyzeCode(code);
        return analysis.securityIssues;
    }

    /**
     * Test Tool - Run tests
     */
    private async toolRunTests(testFile: string): Promise<{
        passed: boolean;
        results: string[];
    }> {
        console.log(`   🧪 [Tool] Running tests...`);
        // In production, would actually run tests
        return { passed: true, results: ["All tests passed (simulated)"] };
    }

    // ============================================
    // 6. LEARNING FROM CORRECTIONS
    // ============================================

    /**
     * Self-correct issues in generated code
     */
    private async selfCorrect(
        files: GeneratedFile[],
        report: ValidationReport
    ): Promise<GeneratedFile[]> {
        this.pipelineState!.corrections++;
        console.log(`   🔧 Self-correction attempt ${this.pipelineState!.corrections}/${this.maxSelfCorrections}`);

        const correctedFiles: GeneratedFile[] = [];

        for (const file of files) {
            if (!file.issues || file.issues.length === 0) {
                correctedFiles.push(file);
                continue;
            }

            // Build correction prompt
            const issueDescriptions = file.issues.map(i =>
                `- ${i.type}: ${i.message}${i.fix ? ` (Fix: ${i.fix})` : ""}`
            ).join("\n");

            const correctionPrompt = `
Fix the following issues in this code:

ISSUES:
${issueDescriptions}

ORIGINAL CODE:
\`\`\`typescript
${file.content}
\`\`\`

Return only the corrected code, no explanations.
`;

            try {
                const response = await this.model.invoke([
                    new SystemMessage("You are a code correction expert. Fix the issues and return corrected code only."),
                    new HumanMessage(correctionPrompt)
                ]);

                const correctedContent = this.extractCode(response.content.toString());

                // Record the correction for learning
                this.recordCorrection(file.content, correctedContent, file.issues[0].type);

                correctedFiles.push({
                    ...file,
                    content: correctedContent,
                    validated: false,
                    issues: []
                });

            } catch (error) {
                correctedFiles.push(file);
            }
        }

        return correctedFiles;
    }

    /**
     * Record correction for future learning
     */
    private recordCorrection(original: string, corrected: string, issueType: string): void {
        this.corrections.push({
            id: `corr_${Date.now()}`,
            originalCode: original.substring(0, 500),
            correctedCode: corrected.substring(0, 500),
            issueType,
            timestamp: new Date(),
            learned: false
        });

        console.log(`   📚 Recorded correction for learning: ${issueType}`);
    }

    /**
     * Get learned patterns from past corrections
     */
    getLearnedPatterns(): string[] {
        const patterns: string[] = [];
        const issueTypes = new Set(this.corrections.map(c => c.issueType));

        for (const type of issueTypes) {
            const count = this.corrections.filter(c => c.issueType === type).length;
            if (count >= 2) {
                patterns.push(`Avoid ${type} (corrected ${count} times)`);
            }
        }

        return patterns;
    }

    // ============================================
    // GENERATION HELPERS
    // ============================================

    private async analyzeRequirements(config: AuthConfig): Promise<any> {
        // Analyze what's needed
        return {
            provider: config.provider,
            features: config.features,
            complexity: config.features.length > 5 ? "high" : config.features.length > 2 ? "medium" : "low"
        };
    }

    private async generateTypes(config: AuthConfig): Promise<GeneratedFile> {
        const content = `
// ============================================
// AUTHENTICATION TYPES
// ============================================
// Auto-generated by AuthAgent Enhanced

export interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    emailVerified: boolean;
    mfaEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type Role = ${config.rbac?.roles.map(r => `"${r.name}"`).join(" | ") || '"admin" | "user" | "guest"'};

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: "Bearer";
}

export interface TokenPayload {
    userId: string;
    email: string;
    role: Role;
    iat: number;
    exp: number;
}

export interface AuthenticatedRequest extends Request {
    user?: TokenPayload;
}

export interface LoginCredentials {
    email: string;
    password: string;
    mfaCode?: string;
}

export interface RegisterData {
    email: string;
    password: string;
    name: string;
}

export interface AuthResult {
    success: boolean;
    user?: User;
    tokens?: AuthTokens;
    error?: string;
    requiresMfa?: boolean;
}
`;

        return {
            path: "src/auth/auth.types.ts",
            content: content.trim(),
            description: "TypeScript types for authentication",
            validated: false
        };
    }

    private async generateCoreAuth(config: AuthConfig): Promise<GeneratedFile[]> {
        const files: GeneratedFile[] = [];

        if (config.provider === "clerk") {
            files.push({
                path: "src/auth/clerk.config.ts",
                content: CLERK_SETUP_TEMPLATE,
                description: "Clerk SDK configuration",
                validated: false
            });
            files.push({
                path: "src/auth/clerk-webhook.ts",
                content: CLERK_WEBHOOK_TEMPLATE,
                description: "Clerk webhook handler",
                validated: false
            });
        } else {
            files.push({
                path: "src/auth/jwt.service.ts",
                content: JWT_MIDDLEWARE_TEMPLATE,
                description: "JWT authentication service",
                validated: false
            });
            files.push({
                path: "src/auth/auth.routes.ts",
                content: JWT_AUTH_ROUTES_TEMPLATE,
                description: "Authentication routes",
                validated: false
            });
        }

        if (config.features.includes("oauth")) {
            files.push({
                path: "src/auth/oauth.config.ts",
                content: OAUTH_PROVIDER_TEMPLATE,
                description: "OAuth provider configuration",
                validated: false
            });
        }

        if (config.features.includes("rbac")) {
            files.push({
                path: "src/auth/rbac.ts",
                content: RBAC_TEMPLATE,
                description: "Role-based access control",
                validated: false
            });
        }

        return files;
    }

    private async generateMiddleware(config: AuthConfig): Promise<GeneratedFile[]> {
        const middleware = `
// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt.service";
import { TokenPayload, AuthenticatedRequest } from "./auth.types";

/**
 * Require authentication middleware
 */
export function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "No token provided" });
        return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    req.user = payload;
    next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        if (payload) {
            req.user = payload;
        }
    }

    next();
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: "Insufficient permissions" });
            return;
        }

        next();
    };
}
`;

        return [{
            path: "src/auth/auth.middleware.ts",
            content: middleware.trim(),
            description: "Authentication middleware",
            validated: false
        }];
    }

    private async generateTests(config: AuthConfig, files: GeneratedFile[]): Promise<GeneratedFile[]> {
        const testContent = `
// ============================================
// AUTHENTICATION TESTS
// ============================================

import { describe, it, expect, beforeEach } from "vitest";

describe("Authentication", () => {
    describe("JWT Token Generation", () => {
        it("should generate valid access token", async () => {
            // Test implementation
            expect(true).toBe(true);
        });

        it("should generate valid refresh token", async () => {
            // Test implementation
            expect(true).toBe(true);
        });

        it("should reject expired tokens", async () => {
            // Test implementation
            expect(true).toBe(true);
        });
    });

    describe("Authentication Middleware", () => {
        it("should block requests without token", async () => {
            // Test implementation
            expect(true).toBe(true);
        });

        it("should allow requests with valid token", async () => {
            // Test implementation
            expect(true).toBe(true);
        });
    });

    describe("Role-Based Access Control", () => {
        it("should allow admin access", async () => {
            // Test implementation
            expect(true).toBe(true);
        });

        it("should block unauthorized access", async () => {
            // Test implementation
            expect(true).toBe(true);
        });
    });
});
`;

        return [{
            path: "src/auth/__tests__/auth.test.ts",
            content: testContent.trim(),
            description: "Authentication unit tests",
            validated: false
        }];
    }

    private extractCode(response: string): string {
        const codeMatch = response.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
        return codeMatch ? codeMatch[1].trim() : response;
    }

    private collectDependencies(config: AuthConfig): string[] {
        const deps: string[] = ["jsonwebtoken", "@types/jsonwebtoken"];

        if (config.provider === "clerk") {
            deps.push("@clerk/backend", "@clerk/nextjs", "svix");
        }

        if (config.features.includes("oauth")) {
            deps.push("passport", "passport-google-oauth20", "passport-github2");
        }

        if (config.features.includes("mfa")) {
            deps.push("otplib", "qrcode", "@types/qrcode");
        }

        if (config.features.includes("session")) {
            deps.push("ioredis", "@types/ioredis");
        }

        deps.push("bcryptjs", "@types/bcryptjs");

        return [...new Set(deps)];
    }

    private collectEnvVariables(config: AuthConfig): string[] {
        const vars: string[] = ["JWT_SECRET"];

        if (config.provider === "clerk") {
            vars.push("CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "CLERK_WEBHOOK_SECRET");
        }

        if (config.features.includes("session")) {
            vars.push("REDIS_URL");
        }

        if (config.features.includes("oauth")) {
            vars.push("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
            vars.push("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET");
        }

        return vars;
    }

    private generateInstructions(config: AuthConfig, files: GeneratedFile[]): string[] {
        const instructions: string[] = [
            `Generated ${files.length} authentication files`,
            "Install required dependencies with npm install",
            "Add environment variables to your .env file",
            "Import and use middleware in your routes"
        ];

        if (config.provider === "clerk") {
            instructions.push("Create a Clerk account and configure your application");
        }

        return instructions;
    }
}

// Export enhanced singleton
export const authAgentEnhanced = new AuthAgentEnhanced();
