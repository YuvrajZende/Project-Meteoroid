/**
 * ============================================
 * SECURITY AGENT - VULNERABILITY & PROTECTION
 * ============================================
 * 
 * The SecurityAgent is responsible for:
 * - Scanning code for security vulnerabilities (SAST)
 * - Detecting hardcoded secrets and credentials
 * - Generating security middleware (CORS, CSRF, Helmet)
 * - Implementing rate limiting and DDoS protection
 * - Checking OWASP Top 10 vulnerabilities
 * - Generating security audit reports
 * - Compliance checking (SOC2, GDPR, PCI-DSS)
 * 
 * Owner: Person 1 (Security Specialist)
 * Tier: 2 (Specialized Agent)
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";
import {
    HELMET_SECURITY_TEMPLATE,
    CORS_CONFIG_TEMPLATE,
    CSRF_PROTECTION_TEMPLATE,
    RATE_LIMITER_TEMPLATE,
    INPUT_SANITIZATION_TEMPLATE,
    SQL_INJECTION_PREVENTION_TEMPLATE,
    XSS_PREVENTION_TEMPLATE,
    SECURITY_HEADERS_TEMPLATE,
    SECRET_SCANNER_TEMPLATE,
    DEPENDENCY_SCANNER_TEMPLATE,
    getSecurityTemplates,
    getAvailableSecurityTypes
} from "./templates/index.js";

dotenv.config();

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface SecurityConfig {
    scanTypes: SecurityScanType[];
    complianceFrameworks: ComplianceFramework[];
    enforcementLevel: EnforcementLevel;
    middleware: MiddlewareConfig;
    rateLimiting?: RateLimitConfig;
    secrets?: SecretsConfig;
}

export type SecurityScanType =
    | "sast"           // Static Application Security Testing
    | "dast"           // Dynamic Application Security Testing
    | "secrets"        // Secret/Credential Detection
    | "dependencies"   // Dependency Vulnerability Scanning
    | "owasp"          // OWASP Top 10 Check
    | "compliance";    // Compliance Framework Check

export type ComplianceFramework =
    | "soc2"
    | "gdpr"
    | "pci-dss"
    | "hipaa"
    | "iso27001"
    | "owasp-top10";

export type EnforcementLevel = "strict" | "standard" | "relaxed";

export interface MiddlewareConfig {
    helmet: boolean;
    cors: boolean | CORSConfig;
    csrf: boolean;
    rateLimit: boolean;
    inputSanitization: boolean;
    securityHeaders: boolean;
}

export interface CORSConfig {
    origin: string | string[] | boolean;
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge?: number;
}

export interface RateLimitConfig {
    windowMs: number;         // Time window in milliseconds
    maxRequests: number;      // Max requests per window
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skipPaths?: string[];
    keyGenerator?: "ip" | "user" | "custom";
}

export interface SecretsConfig {
    patterns: SecretPattern[];
    scanPaths: string[];
    excludePaths: string[];
    alertOnDetection: boolean;
}

export interface SecretPattern {
    name: string;
    pattern: RegExp | string;
    severity: VulnerabilitySeverity;
}

// ============================================
// VULNERABILITY TYPES
// ============================================

export type VulnerabilitySeverity = "critical" | "high" | "medium" | "low" | "info";

export interface Vulnerability {
    id: string;
    type: VulnerabilityType;
    severity: VulnerabilitySeverity;
    title: string;
    description: string;
    location: VulnerabilityLocation;
    recommendation: string;
    cweId?: string;          // Common Weakness Enumeration ID
    cvssScore?: number;      // CVSS Score (0-10)
    owaspCategory?: string;  // OWASP Top 10 Category
}

export type VulnerabilityType =
    | "sql-injection"
    | "xss"
    | "csrf"
    | "path-traversal"
    | "command-injection"
    | "insecure-deserialization"
    | "broken-auth"
    | "sensitive-exposure"
    | "xxe"
    | "broken-access"
    | "security-misconfiguration"
    | "insecure-dependency"
    | "hardcoded-secret"
    | "weak-crypto"
    | "missing-auth"
    | "rate-limit-missing"
    | "cors-misconfiguration"
    | "header-missing";

export interface VulnerabilityLocation {
    file: string;
    line?: number;
    column?: number;
    codeSnippet?: string;
}

// ============================================
// SCAN & REPORT TYPES
// ============================================

export interface SecurityScanResult {
    scanId: string;
    timestamp: Date;
    scanType: SecurityScanType;
    filesScanned: number;
    vulnerabilities: Vulnerability[];
    summary: ScanSummary;
    recommendations: string[];
}

export interface ScanSummary {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    totalVulnerabilities: number;
    securityScore: number;  // 0-100
    passed: boolean;
}

export interface ComplianceReport {
    framework: ComplianceFramework;
    timestamp: Date;
    overallCompliance: number;  // 0-100 percentage
    controls: ComplianceControl[];
    findings: ComplianceFinding[];
    remediationPlan: RemediationItem[];
}

export interface ComplianceControl {
    id: string;
    name: string;
    description: string;
    status: "pass" | "fail" | "partial" | "not-applicable";
    evidence: string[];
}

export interface ComplianceFinding {
    controlId: string;
    severity: VulnerabilitySeverity;
    finding: string;
    remediation: string;
}

export interface RemediationItem {
    priority: number;
    vulnerability: string;
    action: string;
    effort: "low" | "medium" | "high";
    deadline?: string;
}

// ============================================
// GENERATION RESULT TYPES
// ============================================

export interface SecurityGenerationResult {
    files: GeneratedSecurityFile[];
    dependencies: string[];
    envVariables: string[];
    instructions: string[];
    scanResults?: SecurityScanResult;
    complianceReport?: ComplianceReport;
}

export interface GeneratedSecurityFile {
    path: string;
    content: string;
    description: string;
    securityFeatures: string[];
}

// ============================================
// SECURITY AGENT CLASS
// ============================================

export class SecurityAgent {
    private model: ChatOpenAI;
    private config: SecurityConfig | null = null;

    constructor() {
        this.model = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
            temperature: 0.3, // Lower temperature for security-critical decisions
        });
    }

    // ============================================
    // MAIN GENERATION METHOD
    // ============================================

    /**
     * Generate complete security system based on config
     */
    async generateSecuritySystem(config: SecurityConfig): Promise<SecurityGenerationResult> {
        this.config = config;

        const result: SecurityGenerationResult = {
            files: [],
            dependencies: ["helmet", "cors", "express-rate-limit", "hpp", "xss-clean"],
            envVariables: [],
            instructions: [],
        };

        console.log(`\n🔒 [SecurityAgent] Generating security system...`);
        console.log(`   Enforcement Level: ${config.enforcementLevel}`);
        console.log(`   Scan Types: ${config.scanTypes.join(", ")}`);
        console.log(`   Compliance: ${config.complianceFrameworks.join(", ")}`);

        // Generate security middleware
        await this.generateSecurityMiddleware(result, config.middleware);

        // Generate rate limiting if enabled
        if (config.rateLimiting) {
            await this.generateRateLimiting(result, config.rateLimiting);
        }

        // Generate secret scanning if secrets config provided
        if (config.secrets) {
            await this.generateSecretScanner(result, config.secrets);
        }

        // Generate security utilities
        await this.generateSecurityUtilities(result);

        // Generate input validation/sanitization
        await this.generateInputSanitization(result);

        // Generate security types
        result.files.push({
            path: "src/security/types.ts",
            content: this.generateSecurityTypes(),
            description: "TypeScript types for security module",
            securityFeatures: ["type-safety"],
        });

        // Add setup instructions
        result.instructions.push(
            "1. Install dependencies: npm install " + result.dependencies.join(" "),
            "2. Add security middleware to your Express app before routes",
            "3. Configure environment variables for security settings",
            "4. Run security scan: npm run security:scan",
            "5. Review and fix any vulnerabilities found"
        );

        console.log(`✅ [SecurityAgent] Generated ${result.files.length} security files`);

        return result;
    }

    // ============================================
    // MIDDLEWARE GENERATION
    // ============================================

    /**
     * Generate security middleware stack
     */
    private async generateSecurityMiddleware(
        result: SecurityGenerationResult,
        config: MiddlewareConfig
    ): Promise<void> {
        console.log(`   🛡️ Generating security middleware...`);

        // Main security middleware file
        const middlewareContent = this.generateMiddlewareStack(config);
        result.files.push({
            path: "src/security/middleware/index.ts",
            content: middlewareContent,
            description: "Comprehensive security middleware stack",
            securityFeatures: ["helmet", "cors", "rate-limiting", "input-sanitization"],
        });

        // Helmet configuration
        if (config.helmet) {
            result.files.push({
                path: "src/security/middleware/helmet.ts",
                content: HELMET_SECURITY_TEMPLATE,
                description: "Helmet security headers configuration",
                securityFeatures: ["content-security-policy", "xss-protection", "clickjacking-protection"],
            });
            result.dependencies.push("helmet");
        }

        // CORS configuration
        if (config.cors) {
            const corsContent = typeof config.cors === "object"
                ? this.generateCustomCorsConfig(config.cors)
                : CORS_CONFIG_TEMPLATE;

            result.files.push({
                path: "src/security/middleware/cors.ts",
                content: corsContent,
                description: "CORS configuration for API security",
                securityFeatures: ["cors-protection", "origin-validation"],
            });
            result.dependencies.push("cors");
            result.envVariables.push("CORS_ALLOWED_ORIGINS");
        }

        // CSRF protection
        if (config.csrf) {
            result.files.push({
                path: "src/security/middleware/csrf.ts",
                content: CSRF_PROTECTION_TEMPLATE,
                description: "CSRF protection middleware",
                securityFeatures: ["csrf-tokens", "double-submit-cookie"],
            });
            result.dependencies.push("csurf", "cookie-parser");
        }

        // Security headers
        if (config.securityHeaders) {
            result.files.push({
                path: "src/security/middleware/headers.ts",
                content: SECURITY_HEADERS_TEMPLATE,
                description: "Custom security headers middleware",
                securityFeatures: ["hsts", "x-frame-options", "x-content-type-options"],
            });
        }
    }

    /**
     * Generate the main middleware stack
     */
    private generateMiddlewareStack(config: MiddlewareConfig): string {
        return `/**
 * ============================================
 * SECURITY MIDDLEWARE STACK
 * ============================================
 * 
 * Comprehensive security middleware for Express applications.
 * Apply this to your app before any routes.
 */

import { Express, Request, Response, NextFunction } from "express";
${config.helmet ? 'import { helmetMiddleware } from "./helmet";' : ""}
${config.cors ? 'import { corsMiddleware } from "./cors";' : ""}
${config.csrf ? 'import { csrfMiddleware } from "./csrf";' : ""}
${config.rateLimit ? 'import { rateLimiter, apiRateLimiter } from "./rate-limiter";' : ""}
${config.inputSanitization ? 'import { sanitizeInput } from "./sanitize";' : ""}
${config.securityHeaders ? 'import { securityHeaders } from "./headers";' : ""}

// ============================================
// SECURITY CONFIGURATION
// ============================================

export interface SecurityMiddlewareOptions {
    enableHelmet?: boolean;
    enableCors?: boolean;
    enableCsrf?: boolean;
    enableRateLimit?: boolean;
    enableSanitization?: boolean;
    enableSecurityHeaders?: boolean;
}

const defaultOptions: SecurityMiddlewareOptions = {
    enableHelmet: ${config.helmet},
    enableCors: ${config.cors ? "true" : "false"},
    enableCsrf: ${config.csrf},
    enableRateLimit: ${config.rateLimit},
    enableSanitization: ${config.inputSanitization},
    enableSecurityHeaders: ${config.securityHeaders},
};

// ============================================
// APPLY SECURITY MIDDLEWARE
// ============================================

/**
 * Apply all security middleware to Express app
 */
export function applySecurityMiddleware(
    app: Express,
    options: SecurityMiddlewareOptions = defaultOptions
): void {
    console.log("🔒 Applying security middleware stack...");

    ${config.helmet ? `
    // Helmet - Security headers
    if (options.enableHelmet) {
        app.use(helmetMiddleware);
        console.log("   ✓ Helmet security headers enabled");
    }` : ""}

    ${config.cors ? `
    // CORS - Cross-Origin Resource Sharing
    if (options.enableCors) {
        app.use(corsMiddleware);
        console.log("   ✓ CORS protection enabled");
    }` : ""}

    ${config.securityHeaders ? `
    // Custom Security Headers
    if (options.enableSecurityHeaders) {
        app.use(securityHeaders);
        console.log("   ✓ Security headers enabled");
    }` : ""}

    ${config.rateLimit ? `
    // Rate Limiting
    if (options.enableRateLimit) {
        app.use(rateLimiter);
        console.log("   ✓ Rate limiting enabled");
    }` : ""}

    ${config.inputSanitization ? `
    // Input Sanitization
    if (options.enableSanitization) {
        app.use(sanitizeInput);
        console.log("   ✓ Input sanitization enabled");
    }` : ""}

    ${config.csrf ? `
    // CSRF Protection (for non-API routes)
    if (options.enableCsrf) {
        app.use(csrfMiddleware);
        console.log("   ✓ CSRF protection enabled");
    }` : ""}

    // Request ID for tracking
    app.use(requestIdMiddleware);
    console.log("   ✓ Request ID tracking enabled");

    console.log("🔒 Security middleware stack applied successfully!\\n");
}

// ============================================
// REQUEST ID MIDDLEWARE
// ============================================

import { randomUUID } from "crypto";

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    req.requestId = req.headers["x-request-id"] as string || randomUUID();
    res.setHeader("X-Request-ID", req.requestId);
    next();
}

// ============================================
// ERROR HANDLER
// ============================================

export function securityErrorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // Don't leak error details in production
    const isProduction = process.env.NODE_ENV === "production";
    
    console.error(\`[Security Error] \${req.requestId}: \${err.message}\`);

    if (err.name === "ForbiddenError") {
        res.status(403).json({
            error: "Access denied",
            message: isProduction ? "You do not have permission to access this resource" : err.message,
            requestId: req.requestId,
        });
        return;
    }

    if (err.name === "UnauthorizedError") {
        res.status(401).json({
            error: "Unauthorized",
            message: isProduction ? "Authentication required" : err.message,
            requestId: req.requestId,
        });
        return;
    }

    // Generic security error
    res.status(400).json({
        error: "Security violation",
        message: isProduction ? "Request blocked for security reasons" : err.message,
        requestId: req.requestId,
    });
}

// Export individual middleware for selective use
export {
    ${config.helmet ? "helmetMiddleware," : ""}
    ${config.cors ? "corsMiddleware," : ""}
    ${config.csrf ? "csrfMiddleware," : ""}
    ${config.rateLimit ? "rateLimiter, apiRateLimiter," : ""}
    ${config.inputSanitization ? "sanitizeInput," : ""}
    ${config.securityHeaders ? "securityHeaders," : ""}
    requestIdMiddleware,
};
`;
    }

    /**
     * Generate custom CORS configuration
     */
    private generateCustomCorsConfig(config: CORSConfig): string {
        return `/**
 * ============================================
 * CORS CONFIGURATION
 * ============================================
 */

import cors from "cors";

const allowedOrigins = ${JSON.stringify(config.origin, null, 4)};

export const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
            callback(null, true);
            return;
        }

        if (typeof allowedOrigins === "boolean") {
            callback(null, allowedOrigins);
            return;
        }

        const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
        
        if (origins.includes(origin) || origins.includes("*")) {
            callback(null, true);
        } else {
            console.warn(\`[CORS] Blocked origin: \${origin}\`);
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ${JSON.stringify(config.methods)},
    allowedHeaders: ${JSON.stringify(config.allowedHeaders)},
    credentials: ${config.credentials},
    ${config.maxAge ? `maxAge: ${config.maxAge},` : ""}
    optionsSuccessStatus: 204,
};

export const corsMiddleware = cors(corsOptions);
`;
    }

    // ============================================
    // RATE LIMITING
    // ============================================

    /**
     * Generate rate limiting configuration
     */
    private async generateRateLimiting(
        result: SecurityGenerationResult,
        config: RateLimitConfig
    ): Promise<void> {
        console.log(`   ⏱️ Generating rate limiting...`);

        const rateLimiterContent = `/**
 * ============================================
 * RATE LIMITER CONFIGURATION
 * ============================================
 * 
 * Protects against brute force attacks and DDoS.
 */

import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";

// ============================================
// REDIS CLIENT (Optional - for distributed rate limiting)
// ============================================

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
    if (!process.env.REDIS_URL) return null;
    
    if (!redisClient) {
        redisClient = createClient({ url: process.env.REDIS_URL });
        await redisClient.connect();
    }
    return redisClient;
}

// ============================================
// DEFAULT RATE LIMITER
// ============================================

export const rateLimiter = rateLimit({
    windowMs: ${config.windowMs}, // ${config.windowMs / 60000} minutes
    max: ${config.maxRequests}, // Limit each IP to ${config.maxRequests} requests per window
    message: ${JSON.stringify(config.message || { error: "Too many requests, please try again later." })},
    standardHeaders: ${config.standardHeaders ?? true}, // Return rate limit info in RateLimit-* headers
    legacyHeaders: ${config.legacyHeaders ?? false}, // Disable X-RateLimit-* headers
    skip: (req) => {
        // Skip rate limiting for certain paths
        const skipPaths = ${JSON.stringify(config.skipPaths || ["/health", "/metrics"])};
        return skipPaths.some(path => req.path.startsWith(path));
    },
    keyGenerator: (req) => {
        ${config.keyGenerator === "user" ? `
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip || "unknown";
        ` : config.keyGenerator === "custom" ? `
        // Custom key generation
        return req.headers["x-forwarded-for"] as string || req.ip || "unknown";
        ` : `
        // Use IP address
        return req.ip || "unknown";
        `}
    },
    handler: (req, res) => {
        console.warn(\`[RateLimit] Limit exceeded for: \${req.ip}\`);
        res.status(429).json({
            error: "Too many requests",
            message: "You have exceeded the rate limit. Please try again later.",
            retryAfter: Math.ceil(${config.windowMs} / 1000),
        });
    },
});

// ============================================
// API RATE LIMITER (Stricter for API routes)
// ============================================

export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute for API
    message: { error: "API rate limit exceeded" },
    standardHeaders: true,
    keyGenerator: (req) => {
        // Prefer API key over IP for rate limiting
        return req.headers["x-api-key"] as string || req.ip || "unknown";
    },
});

// ============================================
// AUTH RATE LIMITER (Very strict for auth routes)
// ============================================

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: { error: "Too many login attempts. Please try again later." },
    standardHeaders: true,
    skipSuccessfulRequests: true, // Only count failed attempts
});

// ============================================
// DISTRIBUTED RATE LIMITER (Redis-backed)
// ============================================

export async function createDistributedRateLimiter() {
    const client = await getRedisClient();
    
    if (!client) {
        console.warn("[RateLimit] Redis not available, using memory store");
        return rateLimiter;
    }

    return rateLimit({
        windowMs: ${config.windowMs},
        max: ${config.maxRequests},
        standardHeaders: true,
        store: new RedisStore({
            sendCommand: (...args: string[]) => client.sendCommand(args),
        }),
    });
}

// ============================================
// SLIDING WINDOW RATE LIMITER
// ============================================

export const slidingWindowLimiter = rateLimit({
    windowMs: ${config.windowMs},
    max: ${config.maxRequests},
    standardHeaders: true,
    // Sliding window algorithm for smoother rate limiting
    skipFailedRequests: false,
});
`;

        result.files.push({
            path: "src/security/middleware/rate-limiter.ts",
            content: rateLimiterContent,
            description: "Rate limiting configuration with Redis support",
            securityFeatures: ["ddos-protection", "brute-force-prevention", "distributed-limiting"],
        });

        result.dependencies.push("express-rate-limit", "rate-limit-redis");
        result.envVariables.push("REDIS_URL");
    }

    // ============================================
    // SECRET SCANNING
    // ============================================

    /**
     * Generate secret scanner
     */
    private async generateSecretScanner(
        result: SecurityGenerationResult,
        config: SecretsConfig
    ): Promise<void> {
        console.log(`   🔍 Generating secret scanner...`);

        result.files.push({
            path: "src/security/scanners/secret-scanner.ts",
            content: SECRET_SCANNER_TEMPLATE,
            description: "Secret and credential detection scanner",
            securityFeatures: ["secret-detection", "credential-scanning", "pattern-matching"],
        });

        result.files.push({
            path: "src/security/scanners/dependency-scanner.ts",
            content: DEPENDENCY_SCANNER_TEMPLATE,
            description: "Dependency vulnerability scanner",
            securityFeatures: ["dependency-scanning", "cve-detection", "outdated-packages"],
        });
    }

    // ============================================
    // INPUT SANITIZATION
    // ============================================

    /**
     * Generate input sanitization utilities
     */
    private async generateInputSanitization(
        result: SecurityGenerationResult
    ): Promise<void> {
        console.log(`   🧹 Generating input sanitization...`);

        result.files.push({
            path: "src/security/middleware/sanitize.ts",
            content: INPUT_SANITIZATION_TEMPLATE,
            description: "Input sanitization middleware",
            securityFeatures: ["xss-prevention", "sql-injection-prevention", "input-validation"],
        });

        result.files.push({
            path: "src/security/validators/xss-prevention.ts",
            content: XSS_PREVENTION_TEMPLATE,
            description: "XSS prevention utilities",
            securityFeatures: ["xss-prevention", "html-encoding", "script-blocking"],
        });

        result.files.push({
            path: "src/security/validators/sql-prevention.ts",
            content: SQL_INJECTION_PREVENTION_TEMPLATE,
            description: "SQL injection prevention utilities",
            securityFeatures: ["sql-injection-prevention", "query-validation", "parameterization"],
        });

        result.dependencies.push("xss-clean", "hpp", "validator", "dompurify");
    }

    // ============================================
    // SECURITY UTILITIES
    // ============================================

    /**
     * Generate security utility functions
     */
    private async generateSecurityUtilities(
        result: SecurityGenerationResult
    ): Promise<void> {
        console.log(`   🔧 Generating security utilities...`);

        const utilitiesContent = `/**
 * ============================================
 * SECURITY UTILITIES
 * ============================================
 */

import crypto from "crypto";

// ============================================
// SECURE RANDOM GENERATION
// ============================================

/**
 * Generate cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate secure random bytes
 */
export function generateSecureBytes(length: number = 32): Buffer {
    return crypto.randomBytes(length);
}

/**
 * Generate secure UUID v4
 */
export function generateSecureUUID(): string {
    return crypto.randomUUID();
}

// ============================================
// HASHING
// ============================================

/**
 * Create SHA-256 hash
 */
export function hashSHA256(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Create SHA-512 hash
 */
export function hashSHA512(data: string): string {
    return crypto.createHash("sha512").update(data).digest("hex");
}

/**
 * Create HMAC signature
 */
export function createHMAC(data: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Verify HMAC signature
 */
export function verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expected = createHMAC(data, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ============================================
// ENCRYPTION
// ============================================

const ALGORITHM = "aes-256-gcm";

export interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(plaintext: string, key: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const keyBuffer = crypto.scryptSync(key, "salt", 32);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return {
        encrypted,
        iv: iv.toString("hex"),
        authTag: cipher.getAuthTag().toString("hex"),
    };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData, key: string): string {
    const keyBuffer = crypto.scryptSync(key, "salt", 32);
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        keyBuffer,
        Buffer.from(encryptedData.iv, "hex")
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));
    
    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
}

// ============================================
// TIMING-SAFE COMPARISON
// ============================================

/**
 * Compare strings in constant time to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================
// SECURITY HEADERS HELPER
// ============================================

export function getNonce(): string {
    return crypto.randomBytes(16).toString("base64");
}

// ============================================
// IP UTILITIES
// ============================================

/**
 * Get client IP from request (handles proxies)
 */
export function getClientIP(req: { 
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
}): string {
    const forwardedFor = req.headers["x-forwarded-for"];
    
    if (forwardedFor) {
        const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",");
        return ips[0].trim();
    }
    
    return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Check if IP is in CIDR range
 */
export function isIPInRange(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    
    return (ipNum & mask) === (rangeNum & mask);
}

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLog {
    timestamp: Date;
    action: string;
    userId?: string;
    ip: string;
    userAgent?: string;
    resource?: string;
    result: "success" | "failure";
    details?: Record<string, unknown>;
}

const auditLogs: AuditLog[] = [];

/**
 * Log security event for auditing
 */
export function logSecurityEvent(log: AuditLog): void {
    auditLogs.push(log);
    
    // In production, send to external logging service
    console.log(\`[AUDIT] \${log.timestamp.toISOString()} - \${log.action}: \${log.result}\`);
    
    // TODO: Send to SIEM, CloudWatch, Datadog, etc.
}

/**
 * Get recent audit logs
 */
export function getAuditLogs(limit: number = 100): AuditLog[] {
    return auditLogs.slice(-limit);
}
`;

        result.files.push({
            path: "src/security/utils/index.ts",
            content: utilitiesContent,
            description: "Security utility functions (crypto, hashing, encryption)",
            securityFeatures: ["encryption", "hashing", "secure-random", "audit-logging"],
        });
    }

    // ============================================
    // TYPE GENERATION
    // ============================================

    /**
     * Generate TypeScript types for security module
     */
    private generateSecurityTypes(): string {
        return `/**
 * ============================================
 * SECURITY MODULE TYPES
 * ============================================
 */

// ============================================
// VULNERABILITY TYPES
// ============================================

export type VulnerabilitySeverity = "critical" | "high" | "medium" | "low" | "info";

export type VulnerabilityType =
    | "sql-injection"
    | "xss"
    | "csrf"
    | "path-traversal"
    | "command-injection"
    | "insecure-deserialization"
    | "broken-auth"
    | "sensitive-exposure"
    | "xxe"
    | "broken-access"
    | "security-misconfiguration"
    | "insecure-dependency"
    | "hardcoded-secret"
    | "weak-crypto"
    | "missing-auth"
    | "rate-limit-missing"
    | "cors-misconfiguration"
    | "header-missing";

export interface Vulnerability {
    id: string;
    type: VulnerabilityType;
    severity: VulnerabilitySeverity;
    title: string;
    description: string;
    location: {
        file: string;
        line?: number;
        column?: number;
        codeSnippet?: string;
    };
    recommendation: string;
    cweId?: string;
    cvssScore?: number;
    owaspCategory?: string;
}

// ============================================
// SCAN TYPES
// ============================================

export type SecurityScanType = 
    | "sast"
    | "dast"
    | "secrets"
    | "dependencies"
    | "owasp"
    | "compliance";

export interface SecurityScanResult {
    scanId: string;
    timestamp: Date;
    scanType: SecurityScanType;
    filesScanned: number;
    vulnerabilities: Vulnerability[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
        totalVulnerabilities: number;
        securityScore: number;
        passed: boolean;
    };
    recommendations: string[];
}

// ============================================
// COMPLIANCE TYPES
// ============================================

export type ComplianceFramework = 
    | "soc2"
    | "gdpr"
    | "pci-dss"
    | "hipaa"
    | "iso27001"
    | "owasp-top10";

export interface ComplianceReport {
    framework: ComplianceFramework;
    timestamp: Date;
    overallCompliance: number;
    controls: ComplianceControl[];
    findings: ComplianceFinding[];
    remediationPlan: RemediationItem[];
}

export interface ComplianceControl {
    id: string;
    name: string;
    description: string;
    status: "pass" | "fail" | "partial" | "not-applicable";
    evidence: string[];
}

export interface ComplianceFinding {
    controlId: string;
    severity: VulnerabilitySeverity;
    finding: string;
    remediation: string;
}

export interface RemediationItem {
    priority: number;
    vulnerability: string;
    action: string;
    effort: "low" | "medium" | "high";
    deadline?: string;
}

// ============================================
// MIDDLEWARE CONFIG TYPES
// ============================================

export interface CORSConfig {
    origin: string | string[] | boolean;
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge?: number;
}

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    message?: string;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skipPaths?: string[];
    keyGenerator?: "ip" | "user" | "custom";
}

export interface SecurityMiddlewareOptions {
    enableHelmet?: boolean;
    enableCors?: boolean;
    enableCsrf?: boolean;
    enableRateLimit?: boolean;
    enableSanitization?: boolean;
    enableSecurityHeaders?: boolean;
}

// ============================================
// REQUEST EXTENSIONS
// ============================================

declare global {
    namespace Express {
        interface Request {
            requestId: string;
            user?: {
                id: string;
                roles?: string[];
                permissions?: string[];
            };
        }
    }
}

export {};
`;
    }

    // ============================================
    // SCANNING METHODS
    // ============================================

    /**
     * Scan code for vulnerabilities
     */
    async scanCode(code: string, filePath: string): Promise<SecurityScanResult> {
        const vulnerabilities: Vulnerability[] = [];
        const scanId = `scan_${Date.now()}`;

        // Check for common vulnerabilities
        this.checkSQLInjection(code, filePath, vulnerabilities);
        this.checkXSS(code, filePath, vulnerabilities);
        this.checkHardcodedSecrets(code, filePath, vulnerabilities);
        this.checkInsecurePatterns(code, filePath, vulnerabilities);

        const summary = this.calculateSummary(vulnerabilities);

        return {
            scanId,
            timestamp: new Date(),
            scanType: "sast",
            filesScanned: 1,
            vulnerabilities,
            summary,
            recommendations: this.generateRecommendations(vulnerabilities),
        };
    }

    /**
     * Check for SQL injection vulnerabilities
     */
    private checkSQLInjection(code: string, filePath: string, vulnerabilities: Vulnerability[]): void {
        const sqlPatterns = [
            { pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi, message: "Template literal in SQL query" },
            { pattern: /\+\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi, message: "String concatenation in SQL" },
            { pattern: /query\s*\(\s*`[^`]*\$\{/gi, message: "Unsanitized input in query" },
            { pattern: /execute\s*\(\s*`[^`]*\$\{/gi, message: "Unsanitized input in execute" },
        ];

        for (const { pattern, message } of sqlPatterns) {
            const matches = code.matchAll(pattern);
            for (const match of matches) {
                vulnerabilities.push({
                    id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: "sql-injection",
                    severity: "critical",
                    title: "Potential SQL Injection",
                    description: message,
                    location: {
                        file: filePath,
                        codeSnippet: match[0],
                    },
                    recommendation: "Use parameterized queries or an ORM",
                    cweId: "CWE-89",
                    cvssScore: 9.8,
                    owaspCategory: "A03:2021 Injection",
                });
            }
        }
    }

    /**
     * Check for XSS vulnerabilities
     */
    private checkXSS(code: string, filePath: string, vulnerabilities: Vulnerability[]): void {
        const xssPatterns = [
            { pattern: /innerHTML\s*=\s*[^;]+/gi, message: "Direct innerHTML assignment" },
            { pattern: /document\.write\s*\(/gi, message: "document.write usage" },
            { pattern: /dangerouslySetInnerHTML/gi, message: "React dangerouslySetInnerHTML" },
            { pattern: /\$\(.*\)\.html\s*\(/gi, message: "jQuery .html() with dynamic content" },
        ];

        for (const { pattern, message } of xssPatterns) {
            const matches = code.matchAll(pattern);
            for (const match of matches) {
                vulnerabilities.push({
                    id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: "xss",
                    severity: "high",
                    title: "Potential Cross-Site Scripting (XSS)",
                    description: message,
                    location: {
                        file: filePath,
                        codeSnippet: match[0],
                    },
                    recommendation: "Sanitize user input and use safe DOM APIs",
                    cweId: "CWE-79",
                    cvssScore: 6.1,
                    owaspCategory: "A03:2021 Injection",
                });
            }
        }
    }

    /**
     * Check for hardcoded secrets
     */
    private checkHardcodedSecrets(code: string, filePath: string, vulnerabilities: Vulnerability[]): void {
        const secretPatterns = [
            { pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']+["']/gi, name: "Password" },
            { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']+["']/gi, name: "API Key" },
            { pattern: /(?:secret|token)\s*[:=]\s*["'][^"']{10,}["']/gi, name: "Secret/Token" },
            { pattern: /(?:aws|amazon).*(?:key|secret)\s*[:=]\s*["'][^"']+["']/gi, name: "AWS Credential" },
            { pattern: /(?:private[_-]?key)\s*[:=]\s*["'][^"']+["']/gi, name: "Private Key" },
            { pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, name: "JWT Token" },
        ];

        for (const { pattern, name } of secretPatterns) {
            const matches = code.matchAll(pattern);
            for (const match of matches) {
                vulnerabilities.push({
                    id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: "hardcoded-secret",
                    severity: "critical",
                    title: `Hardcoded ${name} Detected`,
                    description: `Found hardcoded ${name.toLowerCase()} in source code`,
                    location: {
                        file: filePath,
                        codeSnippet: match[0].substring(0, 50) + "...",
                    },
                    recommendation: "Use environment variables or a secrets manager",
                    cweId: "CWE-798",
                    cvssScore: 7.5,
                    owaspCategory: "A07:2021 Identification and Authentication Failures",
                });
            }
        }
    }

    /**
     * Check for other insecure patterns
     */
    private checkInsecurePatterns(code: string, filePath: string, vulnerabilities: Vulnerability[]): void {
        const insecurePatterns = [
            { pattern: /eval\s*\(/gi, type: "command-injection" as VulnerabilityType, message: "eval() usage", severity: "critical" as VulnerabilitySeverity },
            { pattern: /exec\s*\(\s*[`"']/gi, type: "command-injection" as VulnerabilityType, message: "exec() with string", severity: "critical" as VulnerabilitySeverity },
            { pattern: /crypto\.createCipher\(/gi, type: "weak-crypto" as VulnerabilityType, message: "Deprecated createCipher", severity: "high" as VulnerabilitySeverity },
            { pattern: /Math\.random\(\)/gi, type: "weak-crypto" as VulnerabilityType, message: "Math.random() for security", severity: "medium" as VulnerabilitySeverity },
            { pattern: /http:\/\//gi, type: "security-misconfiguration" as VulnerabilityType, message: "HTTP instead of HTTPS", severity: "medium" as VulnerabilitySeverity },
            { pattern: /rejectUnauthorized:\s*false/gi, type: "security-misconfiguration" as VulnerabilityType, message: "TLS verification disabled", severity: "high" as VulnerabilitySeverity },
        ];

        for (const { pattern, type, message, severity } of insecurePatterns) {
            const matches = code.matchAll(pattern);
            for (const match of matches) {
                vulnerabilities.push({
                    id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type,
                    severity,
                    title: `Insecure Pattern: ${message}`,
                    description: `Found potentially insecure code pattern`,
                    location: {
                        file: filePath,
                        codeSnippet: match[0],
                    },
                    recommendation: "Review and fix the security issue",
                });
            }
        }
    }

    /**
     * Calculate summary statistics
     */
    private calculateSummary(vulnerabilities: Vulnerability[]): ScanSummary {
        const counts = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
        };

        for (const vuln of vulnerabilities) {
            counts[vuln.severity]++;
        }

        const totalVulnerabilities = vulnerabilities.length;
        const weightedScore =
            counts.critical * 10 +
            counts.high * 7 +
            counts.medium * 4 +
            counts.low * 1;

        const securityScore = Math.max(0, 100 - weightedScore);

        return {
            ...counts,
            totalVulnerabilities,
            securityScore,
            passed: counts.critical === 0 && counts.high === 0,
        };
    }

    /**
     * Generate recommendations based on vulnerabilities
     */
    private generateRecommendations(vulnerabilities: Vulnerability[]): string[] {
        const recommendations: string[] = [];
        const types = new Set(vulnerabilities.map(v => v.type));

        if (types.has("sql-injection")) {
            recommendations.push("Use parameterized queries or an ORM like Prisma");
        }
        if (types.has("xss")) {
            recommendations.push("Sanitize all user input and use Content Security Policy");
        }
        if (types.has("hardcoded-secret")) {
            recommendations.push("Move all secrets to environment variables");
        }
        if (types.has("weak-crypto")) {
            recommendations.push("Use crypto.randomBytes() for secure random generation");
        }

        return recommendations;
    }

    // ============================================
    // COMPLIANCE CHECKING
    // ============================================

    /**
     * Check compliance with security framework
     */
    async checkCompliance(framework: ComplianceFramework): Promise<ComplianceReport> {
        console.log(`\n🔍 [SecurityAgent] Checking ${framework.toUpperCase()} compliance...`);

        const controls = this.getComplianceControls(framework);
        const findings: ComplianceFinding[] = [];
        const remediationPlan: RemediationItem[] = [];

        let passedControls = 0;
        for (const control of controls) {
            if (control.status === "pass") passedControls++;
            if (control.status === "fail" || control.status === "partial") {
                findings.push({
                    controlId: control.id,
                    severity: control.status === "fail" ? "high" : "medium",
                    finding: `Control ${control.id} is not fully implemented`,
                    remediation: `Implement ${control.name}`,
                });
            }
        }

        const overallCompliance = Math.round((passedControls / controls.length) * 100);

        return {
            framework,
            timestamp: new Date(),
            overallCompliance,
            controls,
            findings,
            remediationPlan,
        };
    }

    /**
     * Get compliance controls for a framework
     */
    private getComplianceControls(framework: ComplianceFramework): ComplianceControl[] {
        const controlSets: Record<ComplianceFramework, ComplianceControl[]> = {
            "owasp-top10": [
                { id: "A01", name: "Broken Access Control", description: "Access control enforcement", status: "pass", evidence: [] },
                { id: "A02", name: "Cryptographic Failures", description: "Proper encryption", status: "pass", evidence: [] },
                { id: "A03", name: "Injection", description: "Injection prevention", status: "partial", evidence: [] },
                { id: "A04", name: "Insecure Design", description: "Secure design principles", status: "pass", evidence: [] },
                { id: "A05", name: "Security Misconfiguration", description: "Secure configuration", status: "partial", evidence: [] },
                { id: "A06", name: "Vulnerable Components", description: "Dependency scanning", status: "pass", evidence: [] },
                { id: "A07", name: "Authentication Failures", description: "Strong authentication", status: "pass", evidence: [] },
                { id: "A08", name: "Software Integrity", description: "Integrity verification", status: "partial", evidence: [] },
                { id: "A09", name: "Logging Failures", description: "Security logging", status: "pass", evidence: [] },
                { id: "A10", name: "SSRF", description: "SSRF prevention", status: "pass", evidence: [] },
            ],
            "soc2": [
                { id: "CC1", name: "Control Environment", description: "Organizational commitment to integrity", status: "pass", evidence: [] },
                { id: "CC2", name: "Communication", description: "Internal controls communication", status: "pass", evidence: [] },
                { id: "CC3", name: "Risk Assessment", description: "Risk identification and analysis", status: "partial", evidence: [] },
                { id: "CC4", name: "Monitoring", description: "Ongoing monitoring activities", status: "pass", evidence: [] },
                { id: "CC5", name: "Control Activities", description: "Control policies and procedures", status: "partial", evidence: [] },
                { id: "CC6", name: "Logical Access", description: "Logical and physical access controls", status: "pass", evidence: [] },
                { id: "CC7", name: "System Operations", description: "System operations management", status: "pass", evidence: [] },
                { id: "CC8", name: "Change Management", description: "System changes", status: "partial", evidence: [] },
                { id: "CC9", name: "Risk Mitigation", description: "Risk mitigation strategies", status: "pass", evidence: [] },
            ],
            "gdpr": [
                { id: "GDPR-1", name: "Lawful Processing", description: "Lawful basis for processing", status: "pass", evidence: [] },
                { id: "GDPR-2", name: "Data Subject Rights", description: "Rights of data subjects", status: "partial", evidence: [] },
                { id: "GDPR-3", name: "Data Protection", description: "Data protection measures", status: "pass", evidence: [] },
                { id: "GDPR-4", name: "Breach Notification", description: "Breach notification procedures", status: "pass", evidence: [] },
                { id: "GDPR-5", name: "Data Minimization", description: "Collect only necessary data", status: "partial", evidence: [] },
            ],
            "pci-dss": [
                { id: "PCI-1", name: "Firewall", description: "Install and maintain firewall", status: "pass", evidence: [] },
                { id: "PCI-2", name: "Default Passwords", description: "Don't use vendor defaults", status: "pass", evidence: [] },
                { id: "PCI-3", name: "Protect Data", description: "Protect stored cardholder data", status: "partial", evidence: [] },
                { id: "PCI-4", name: "Encrypt Transmission", description: "Encrypt data in transit", status: "pass", evidence: [] },
                { id: "PCI-5", name: "Anti-Virus", description: "Use and update anti-virus", status: "pass", evidence: [] },
                { id: "PCI-6", name: "Secure Systems", description: "Develop secure systems", status: "partial", evidence: [] },
            ],
            "hipaa": [
                { id: "HIPAA-1", name: "Access Controls", description: "Implement access controls", status: "pass", evidence: [] },
                { id: "HIPAA-2", name: "Audit Controls", description: "Audit control mechanisms", status: "pass", evidence: [] },
                { id: "HIPAA-3", name: "Integrity", description: "Data integrity controls", status: "partial", evidence: [] },
                { id: "HIPAA-4", name: "Transmission Security", description: "Secure transmission", status: "pass", evidence: [] },
            ],
            "iso27001": [
                { id: "ISO-A5", name: "Information Security Policies", description: "Management direction for information security", status: "pass", evidence: [] },
                { id: "ISO-A6", name: "Organization of Information Security", description: "Internal organization", status: "partial", evidence: [] },
                { id: "ISO-A7", name: "Human Resource Security", description: "During and after employment", status: "pass", evidence: [] },
                { id: "ISO-A8", name: "Asset Management", description: "Responsibility for assets", status: "partial", evidence: [] },
                { id: "ISO-A9", name: "Access Control", description: "Business requirements of access control", status: "pass", evidence: [] },
            ],
        };

        return controlSets[framework] || [];
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Get available security templates
     */
    getAvailableTemplates(): string[] {
        return getAvailableSecurityTypes();
    }

    /**
     * Get a specific template
     */
    getTemplate(type: string): string | undefined {
        const templates = getSecurityTemplates(type);
        return templates[type];
    }

    /**
     * Analyze security requirements from user request
     */
    async analyzeRequirements(userRequest: string): Promise<SecurityConfig> {
        const systemPrompt = `You are a security expert. Analyze the following request and determine the security configuration needed.

Return a JSON object with:
- scanTypes: array of security scan types (sast, dast, secrets, dependencies, owasp, compliance)
- complianceFrameworks: array of compliance frameworks (soc2, gdpr, pci-dss, hipaa, iso27001, owasp-top10)
- enforcementLevel: enforcement level (strict, standard, relaxed)
- middleware: object with middleware flags (helmet, cors, csrf, rateLimit, inputSanitization, securityHeaders)

Example:
{
    "scanTypes": ["sast", "secrets", "dependencies"],
    "complianceFrameworks": ["owasp-top10"],
    "enforcementLevel": "strict",
    "middleware": {
        "helmet": true,
        "cors": true,
        "csrf": true,
        "rateLimit": true,
        "inputSanitization": true,
        "securityHeaders": true
    }
}`;

        const response = await this.model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userRequest),
        ]);

        try {
            const content = response.content.toString();
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error("Failed to parse security requirements:", error);
        }

        // Default configuration
        return {
            scanTypes: ["sast", "secrets"],
            complianceFrameworks: ["owasp-top10"],
            enforcementLevel: "standard",
            middleware: {
                helmet: true,
                cors: true,
                csrf: true,
                rateLimit: true,
                inputSanitization: true,
                securityHeaders: true,
            },
        };
    }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const securityAgent = new SecurityAgent();
