/**
 * ============================================
 * SECURITY AGENT TEMPLATES
 * ============================================
 * 
 * Pre-built, production-ready security code templates.
 * These provide a solid foundation that the SecurityAgent
 * can customize based on project requirements.
 */

// ============================================
// HELMET SECURITY HEADERS TEMPLATE
// ============================================

export const HELMET_SECURITY_TEMPLATE = `/**
 * ============================================
 * HELMET SECURITY CONFIGURATION
 * ============================================
 * 
 * Helmet helps secure Express apps by setting HTTP headers.
 * This configuration follows OWASP security best practices.
 */

import helmet from "helmet";
import { Express } from "express";

// ============================================
// HELMET CONFIGURATION
// ============================================

export const helmetConfig = {
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust for your needs
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", process.env.API_URL || ""],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            upgradeInsecureRequests: [],
        },
    },
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: true,
    
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: "same-origin" },
    
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: "same-origin" },
    
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    
    // Frameguard (Clickjacking protection)
    frameguard: { action: "deny" },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // HTTP Strict Transport Security
    hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
    },
    
    // IE No Open (for IE8+ compatibility)
    ieNoOpen: true,
    
    // No Sniff (prevents MIME type sniffing)
    noSniff: true,
    
    // Origin Agent Cluster
    originAgentCluster: true,
    
    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    
    // Referrer Policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    
    // XSS Filter (legacy, but good for older browsers)
    xssFilter: true,
};

// Create helmet middleware with configuration
export const helmetMiddleware = helmet(helmetConfig);

/**
 * Apply helmet to Express app
 */
export function applyHelmet(app: Express): void {
    app.use(helmetMiddleware);
    console.log("🛡️ Helmet security headers enabled");
}

/**
 * Helmet configuration for API-only servers
 */
export const helmetAPIConfig = {
    ...helmetConfig,
    contentSecurityPolicy: false, // Not needed for pure APIs
    crossOriginEmbedderPolicy: false,
};

export const helmetAPIMiddleware = helmet(helmetAPIConfig);
`;

// ============================================
// CORS CONFIGURATION TEMPLATE
// ============================================

export const CORS_CONFIG_TEMPLATE = `/**
 * ============================================
 * CORS CONFIGURATION
 * ============================================
 * 
 * Cross-Origin Resource Sharing configuration
 * for secure API access from allowed origins.
 */

import cors from "cors";
import { Request } from "express";

// ============================================
// ALLOWED ORIGINS
// ============================================

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost:3000", "http://localhost:5173"];

// Add production domains
if (process.env.NODE_ENV === "production") {
    const productionDomains = [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
    ].filter(Boolean) as string[];
    allowedOrigins.push(...productionDomains);
}

// ============================================
// CORS OPTIONS
// ============================================

export const corsOptions: cors.CorsOptions = {
    /**
     * Origin validation function
     */
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) {
            callback(null, true);
            return;
        }

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
            callback(null, true);
        } else {
            console.warn(\`[CORS] Blocked request from origin: \${origin}\`);
            callback(new Error(\`Origin \${origin} not allowed by CORS\`));
        }
    },

    /**
     * Allowed HTTP methods
     */
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    /**
     * Allowed headers
     */
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-API-Key",
        "X-Request-ID",
    ],

    /**
     * Exposed headers (headers that client can access)
     */
    exposedHeaders: [
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],

    /**
     * Allow credentials (cookies, authorization headers)
     */
    credentials: true,

    /**
     * Preflight cache duration (24 hours)
     */
    maxAge: 86400,

    /**
     * Return 204 for OPTIONS requests
     */
    optionsSuccessStatus: 204,
};

// ============================================
// CORS MIDDLEWARE
// ============================================

export const corsMiddleware = cors(corsOptions);

/**
 * CORS middleware for specific routes
 */
export function corsForRoute(origins: string[]) {
    return cors({
        ...corsOptions,
        origin: origins,
    });
}

/**
 * Strict CORS - no wildcards
 */
export const strictCorsMiddleware = cors({
    ...corsOptions,
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
});
`;

// ============================================
// CSRF PROTECTION TEMPLATE
// ============================================

export const CSRF_PROTECTION_TEMPLATE = `/**
 * ============================================
 * CSRF PROTECTION
 * ============================================
 * 
 * Cross-Site Request Forgery protection using
 * the double-submit cookie pattern.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ============================================
// CSRF TOKEN CONFIGURATION
// ============================================

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: "/",
};

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCSRFToken(): string {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Hash token for storage
 */
function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

// ============================================
// CSRF MIDDLEWARE
// ============================================

/**
 * CSRF Protection Middleware
 * 
 * - Skips safe methods (GET, HEAD, OPTIONS)
 * - Validates token on unsafe methods (POST, PUT, DELETE, PATCH)
 * - Sets new token in response cookie
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF for safe methods
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (safeMethods.includes(req.method)) {
        // Still generate token for forms
        setCSRFCookie(res);
        next();
        return;
    }

    // Skip CSRF for API routes with API key authentication
    if (req.headers["x-api-key"]) {
        next();
        return;
    }

    // Get token from cookie and header
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME] as string;

    // Validate tokens
    if (!cookieToken || !headerToken) {
        res.status(403).json({
            error: "CSRF validation failed",
            message: "Missing CSRF token",
        });
        return;
    }

    // Compare tokens (using timing-safe comparison)
    const cookieHash = hashToken(cookieToken);
    const headerHash = hashToken(headerToken);

    if (!crypto.timingSafeEqual(Buffer.from(cookieHash), Buffer.from(headerHash))) {
        res.status(403).json({
            error: "CSRF validation failed",
            message: "Invalid CSRF token",
        });
        return;
    }

    // Generate new token after successful validation (token rotation)
    setCSRFCookie(res);
    next();
}

/**
 * Set CSRF cookie in response
 */
function setCSRFCookie(res: Response): void {
    const token = generateCSRFToken();
    res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
}

// ============================================
// CSRF ROUTE HELPERS
// ============================================

/**
 * Route to get a new CSRF token
 */
export function csrfTokenRoute(req: Request, res: Response): void {
    const token = generateCSRFToken();
    res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
    res.json({ csrfToken: token });
}

/**
 * Middleware to skip CSRF for specific routes
 */
export function skipCSRFFor(paths: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (paths.some(path => req.path.startsWith(path))) {
            next();
            return;
        }
        csrfMiddleware(req, res, next);
    };
}

// For cookie-parser compatibility
declare module "express" {
    interface Request {
        cookies?: Record<string, string>;
    }
}
`;

// ============================================
// RATE LIMITER TEMPLATE
// ============================================

export const RATE_LIMITER_TEMPLATE = `/**
 * ============================================
 * RATE LIMITER CONFIGURATION
 * ============================================
 * 
 * Protects against brute force attacks, DDoS,
 * and API abuse through request rate limiting.
 */

import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100; // 100 requests per window

// ============================================
// GENERAL RATE LIMITER
// ============================================

export const rateLimiter = rateLimit({
    windowMs: DEFAULT_WINDOW_MS,
    max: DEFAULT_MAX_REQUESTS,
    message: {
        error: "Too many requests",
        message: "You have exceeded the rate limit. Please try again later.",
        retryAfter: DEFAULT_WINDOW_MS / 1000,
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === "/health" || req.path === "/metrics";
    },
    keyGenerator: (req) => {
        // Use X-Forwarded-For if behind proxy, otherwise use IP
        return (req.headers["x-forwarded-for"] as string)?.split(",")[0] || 
               req.ip || 
               "unknown";
    },
    handler: (req, res) => {
        console.warn(\`[RateLimit] Limit exceeded for IP: \${req.ip}\`);
        res.status(429).json({
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: DEFAULT_WINDOW_MS / 1000,
        });
    },
});

// ============================================
// API RATE LIMITER (Stricter)
// ============================================

export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: { error: "API rate limit exceeded" },
    standardHeaders: true,
    keyGenerator: (req) => {
        return req.headers["x-api-key"] as string || req.ip || "unknown";
    },
});

// ============================================
// AUTH RATE LIMITER (Very Strict)
// ============================================

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: {
        error: "Too many authentication attempts",
        message: "Please try again in 15 minutes.",
    },
    standardHeaders: true,
    skipSuccessfulRequests: true, // Only count failed attempts
});

// ============================================
// DYNAMIC RATE LIMITER
// ============================================

/**
 * Create a custom rate limiter with specific settings
 */
export function createRateLimiter(options: {
    windowMs?: number;
    max?: number;
    message?: string;
    keyGenerator?: (req: Request) => string;
}) {
    return rateLimit({
        windowMs: options.windowMs || DEFAULT_WINDOW_MS,
        max: options.max || DEFAULT_MAX_REQUESTS,
        message: { error: options.message || "Rate limit exceeded" },
        standardHeaders: true,
        keyGenerator: options.keyGenerator || ((req) => req.ip || "unknown"),
    });
}

// ============================================
// SLIDING WINDOW LIMITER
// ============================================

const requestCounts = new Map<string, { count: number; timestamp: number }>();

export function slidingWindowLimiter(
    windowMs: number = 60000,
    maxRequests: number = 100
) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const key = req.ip || "unknown";
        const now = Date.now();
        const record = requestCounts.get(key);

        if (!record || now - record.timestamp > windowMs) {
            requestCounts.set(key, { count: 1, timestamp: now });
            next();
            return;
        }

        if (record.count >= maxRequests) {
            res.status(429).json({
                error: "Rate limit exceeded",
                retryAfter: Math.ceil((record.timestamp + windowMs - now) / 1000),
            });
            return;
        }

        record.count++;
        next();
    };
}
`;

// ============================================
// INPUT SANITIZATION TEMPLATE
// ============================================

export const INPUT_SANITIZATION_TEMPLATE = `/**
 * ============================================
 * INPUT SANITIZATION MIDDLEWARE
 * ============================================
 * 
 * Sanitizes and validates user input to prevent
 * XSS, SQL injection, and other injection attacks.
 */

import { Request, Response, NextFunction } from "express";
import validator from "validator";

// ============================================
// SANITIZATION OPTIONS
// ============================================

interface SanitizeOptions {
    trimStrings: boolean;
    escapeHtml: boolean;
    removeNulls: boolean;
    maxStringLength: number;
    maxArrayLength: number;
    maxDepth: number;
}

const defaultOptions: SanitizeOptions = {
    trimStrings: true,
    escapeHtml: true,
    removeNulls: false,
    maxStringLength: 10000,
    maxArrayLength: 1000,
    maxDepth: 10,
};

// ============================================
// SANITIZATION FUNCTIONS
// ============================================

/**
 * Sanitize a string value
 */
function sanitizeString(value: string, options: SanitizeOptions): string {
    let sanitized = value;

    // Trim whitespace
    if (options.trimStrings) {
        sanitized = sanitized.trim();
    }

    // Truncate if too long
    if (sanitized.length > options.maxStringLength) {
        sanitized = sanitized.substring(0, options.maxStringLength);
    }

    // Escape HTML entities
    if (options.escapeHtml) {
        sanitized = validator.escape(sanitized);
    }

    return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeValue(value: unknown, options: SanitizeOptions, depth: number = 0): unknown {
    // Prevent deep recursion
    if (depth > options.maxDepth) {
        return null;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
        return options.removeNulls ? undefined : value;
    }

    // Handle strings
    if (typeof value === "string") {
        return sanitizeString(value, options);
    }

    // Handle numbers
    if (typeof value === "number") {
        return isNaN(value) || !isFinite(value) ? 0 : value;
    }

    // Handle booleans
    if (typeof value === "boolean") {
        return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        const sanitizedArray = value
            .slice(0, options.maxArrayLength)
            .map(item => sanitizeValue(item, options, depth + 1))
            .filter(item => item !== undefined);
        return sanitizedArray;
    }

    // Handle objects
    if (typeof value === "object") {
        const sanitizedObject: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            // Sanitize key as well
            const sanitizedKey = sanitizeString(key, { ...options, escapeHtml: false });
            const sanitizedVal = sanitizeValue(val, options, depth + 1);
            if (sanitizedVal !== undefined) {
                sanitizedObject[sanitizedKey] = sanitizedVal;
            }
        }
        return sanitizedObject;
    }

    return value;
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Sanitize input middleware
 */
export function sanitizeInput(
    optionsOverride: Partial<SanitizeOptions> = {}
) {
    const options = { ...defaultOptions, ...optionsOverride };

    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Sanitize body
            if (req.body) {
                req.body = sanitizeValue(req.body, options) as typeof req.body;
            }

            // Sanitize query parameters
            if (req.query) {
                req.query = sanitizeValue(req.query, options) as typeof req.query;
            }

            // Sanitize URL parameters
            if (req.params) {
                req.params = sanitizeValue(req.params, options) as typeof req.params;
            }

            next();
        } catch (error) {
            console.error("[Sanitize] Error sanitizing input:", error);
            res.status(400).json({
                error: "Invalid input",
                message: "Request contains invalid data",
            });
        }
    };
}

// Default export for convenience
export default sanitizeInput();
`;

// ============================================
// SQL INJECTION PREVENTION TEMPLATE
// ============================================

export const SQL_INJECTION_PREVENTION_TEMPLATE = `/**
 * ============================================
 * SQL INJECTION PREVENTION
 * ============================================
 * 
 * Utilities for preventing SQL injection attacks.
 * Always use parameterized queries with your ORM!
 */

// ============================================
// SQL INJECTION PATTERNS
// ============================================

const sqlInjectionPatterns = [
    /('|"|--).*?(;|\\\\|\\/).*?(drop|delete|truncate|insert|update|select|union|exec|execute)/gi,
    /(\\\\x27|\\\\x22)/gi, // Hex-encoded quotes
    /\\b(union\\s+select|select\\s+\\*|drop\\s+table|insert\\s+into)\\b/gi,
    /(\\\\r|\\\\n)/gi, // Carriage return/newline
    /[\\x00-\\x1f]/g, // Control characters
];

/**
 * Check if input contains SQL injection patterns
 */
export function containsSQLInjection(input: string): boolean {
    if (typeof input !== "string") return false;
    
    return sqlInjectionPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize input to prevent SQL injection
 * NOTE: This is a last resort! Always use parameterized queries.
 */
export function sanitizeSQLInput(input: string): string {
    if (typeof input !== "string") return input;

    let sanitized = input;

    // Remove null bytes
    sanitized = sanitized.replace(/\\x00/g, "");

    // Escape single quotes
    sanitized = sanitized.replace(/'/g, "''");

    // Remove SQL comments
    sanitized = sanitized.replace(/--.*$/gm, "");
    sanitized = sanitized.replace(/\\/\\*[\\s\\S]*?\\*\\//g, "");

    return sanitized;
}

// ============================================
// PARAMETERIZED QUERY HELPER
// ============================================

/**
 * Create parameterized query (example for direct SQL usage)
 */
export function createParameterizedQuery(
    template: string,
    params: Record<string, unknown>
): { query: string; values: unknown[] } {
    const values: unknown[] = [];
    let paramIndex = 1;

    const query = template.replace(/:([a-zA-Z_]+)/g, (_, paramName) => {
        if (!(paramName in params)) {
            throw new Error(\`Missing parameter: \${paramName}\`);
        }
        values.push(params[paramName]);
        return \`$\${paramIndex++}\`;
    });

    return { query, values };
}

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from "express";

/**
 * Middleware to check for SQL injection in request
 */
export function sqlInjectionGuard(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const checkValue = (value: unknown): boolean => {
        if (typeof value === "string") {
            return containsSQLInjection(value);
        }
        if (Array.isArray(value)) {
            return value.some(checkValue);
        }
        if (typeof value === "object" && value !== null) {
            return Object.values(value).some(checkValue);
        }
        return false;
    };

    const hasInjection = 
        checkValue(req.body) ||
        checkValue(req.query) ||
        checkValue(req.params);

    if (hasInjection) {
        console.warn(\`[Security] SQL injection attempt from IP: \${req.ip}\`);
        res.status(400).json({
            error: "Invalid input",
            message: "Request blocked for security reasons",
        });
        return;
    }

    next();
}
`;

// ============================================
// XSS PREVENTION TEMPLATE
// ============================================

export const XSS_PREVENTION_TEMPLATE = `/**
 * ============================================
 * XSS PREVENTION UTILITIES
 * ============================================
 * 
 * Utilities for preventing Cross-Site Scripting attacks.
 */

// ============================================
// HTML ENTITY ENCODING
// ============================================

const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "\`": "&#x60;",
    "=": "&#x3D;",
};

/**
 * Encode HTML entities to prevent XSS
 */
export function encodeHTML(str: string): string {
    if (typeof str !== "string") return str;
    
    return str.replace(/[&<>"'\`=\\/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Decode HTML entities
 */
export function decodeHTML(str: string): string {
    if (typeof str !== "string") return str;

    const textarea = {
        innerHTML: str
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, "/")
            .replace(/&#x60;/g, "\`")
            .replace(/&#x3D;/g, "="),
    };
    return textarea.innerHTML;
}

// ============================================
// XSS PATTERNS
// ============================================

const xssPatterns = [
    /<script[^>]*>[\\s\\S]*?<\\/script>/gi,
    /<iframe[^>]*>[\\s\\S]*?<\\/iframe>/gi,
    /<object[^>]*>[\\s\\S]*?<\\/object>/gi,
    /<embed[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\\w+\\s*=/gi, // Event handlers
    /data:[^,]*base64/gi,
];

/**
 * Check if input contains XSS patterns
 */
export function containsXSS(input: string): boolean {
    if (typeof input !== "string") return false;
    
    return xssPatterns.some(pattern => pattern.test(input));
}

// ============================================
// SANITIZATION
// ============================================

/**
 * Remove all HTML tags from string
 */
export function stripTags(str: string): string {
    if (typeof str !== "string") return str;
    
    return str.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize HTML - remove dangerous elements
 */
export function sanitizeHTML(html: string): string {
    if (typeof html !== "string") return html;

    let sanitized = html;

    // Remove script tags
    sanitized = sanitized.replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, "");
    
    // Remove style tags
    sanitized = sanitized.replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, "");
    
    // Remove event handlers
    sanitized = sanitized.replace(/\\s*on\\w+\\s*=\\s*"[^"]*"/gi, "");
    sanitized = sanitized.replace(/\\s*on\\w+\\s*=\\s*'[^']*'/gi, "");
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, "");
    sanitized = sanitized.replace(/vbscript:/gi, "");
    
    // Remove data: URLs with potential code
    sanitized = sanitized.replace(/data:[^,]*base64[^"']*/gi, "");

    return sanitized;
}

/**
 * Sanitize URL to prevent javascript: and data: protocols
 */
export function sanitizeURL(url: string): string {
    if (typeof url !== "string") return "";

    const trimmed = url.trim().toLowerCase();
    
    // Block dangerous protocols
    if (trimmed.startsWith("javascript:") || 
        trimmed.startsWith("vbscript:") ||
        trimmed.startsWith("data:")) {
        return "";
    }

    return url;
}

// ============================================
// MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from "express";

/**
 * Middleware to check for XSS in request
 */
export function xssGuard(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const checkValue = (value: unknown): boolean => {
        if (typeof value === "string") {
            return containsXSS(value);
        }
        if (Array.isArray(value)) {
            return value.some(checkValue);
        }
        if (typeof value === "object" && value !== null) {
            return Object.values(value).some(checkValue);
        }
        return false;
    };

    const hasXSS = 
        checkValue(req.body) ||
        checkValue(req.query) ||
        checkValue(req.params);

    if (hasXSS) {
        console.warn(\`[Security] XSS attempt from IP: \${req.ip}\`);
        res.status(400).json({
            error: "Invalid input",
            message: "Request blocked for security reasons",
        });
        return;
    }

    next();
}
`;

// ============================================
// SECURITY HEADERS TEMPLATE
// ============================================

export const SECURITY_HEADERS_TEMPLATE = `/**
 * ============================================
 * CUSTOM SECURITY HEADERS
 * ============================================
 * 
 * Additional security headers beyond Helmet.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ============================================
// SECURITY HEADERS CONFIGURATION
// ============================================

interface SecurityHeadersConfig {
    enableCSP: boolean;
    enableHSTS: boolean;
    enableXFrame: boolean;
    enableXSSProtection: boolean;
    enableNoSniff: boolean;
    enableReferrerPolicy: boolean;
    enablePermissionsPolicy: boolean;
    nonceBased: boolean;
    reportOnly: boolean;
    reportUri?: string;
}

const defaultConfig: SecurityHeadersConfig = {
    enableCSP: true,
    enableHSTS: true,
    enableXFrame: true,
    enableXSSProtection: true,
    enableNoSniff: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true,
    nonceBased: false,
    reportOnly: false,
};

// ============================================
// NONCE GENERATION
// ============================================

export function generateNonce(): string {
    return crypto.randomBytes(16).toString("base64");
}

// ============================================
// SECURITY HEADERS MIDDLEWARE
// ============================================

export function securityHeaders(config: Partial<SecurityHeadersConfig> = {}) {
    const options = { ...defaultConfig, ...config };

    return (req: Request, res: Response, next: NextFunction): void => {
        // Generate nonce for CSP
        const nonce = options.nonceBased ? generateNonce() : null;
        if (nonce) {
            res.locals.cspNonce = nonce;
        }

        // Content Security Policy
        if (options.enableCSP) {
            const cspDirectives = [
                "default-src 'self'",
                nonce 
                    ? \`script-src 'self' 'nonce-\${nonce}'\`
                    : "script-src 'self'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: https:",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
            ];

            if (options.reportUri) {
                cspDirectives.push(\`report-uri \${options.reportUri}\`);
            }

            const headerName = options.reportOnly 
                ? "Content-Security-Policy-Report-Only"
                : "Content-Security-Policy";
            res.setHeader(headerName, cspDirectives.join("; "));
        }

        // HSTS
        if (options.enableHSTS) {
            res.setHeader(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains; preload"
            );
        }

        // X-Frame-Options
        if (options.enableXFrame) {
            res.setHeader("X-Frame-Options", "DENY");
        }

        // X-XSS-Protection (legacy but still useful)
        if (options.enableXSSProtection) {
            res.setHeader("X-XSS-Protection", "1; mode=block");
        }

        // X-Content-Type-Options
        if (options.enableNoSniff) {
            res.setHeader("X-Content-Type-Options", "nosniff");
        }

        // Referrer Policy
        if (options.enableReferrerPolicy) {
            res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        }

        // Permissions Policy
        if (options.enablePermissionsPolicy) {
            res.setHeader(
                "Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), interest-cohort=()"
            );
        }

        // Additional security headers
        res.setHeader("X-Download-Options", "noopen");
        res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

        next();
    };
}

// Default export
export default securityHeaders();
`;

// ============================================
// SECRET SCANNER TEMPLATE
// ============================================

export const SECRET_SCANNER_TEMPLATE = `/**
 * ============================================
 * SECRET SCANNER
 * ============================================
 * 
 * Scans code for hardcoded secrets and credentials.
 */

import * as fs from "fs";
import * as path from "path";

// ============================================
// SECRET PATTERNS
// ============================================

interface SecretPattern {
    name: string;
    pattern: RegExp;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
}

const secretPatterns: SecretPattern[] = [
    // API Keys
    {
        name: "Generic API Key",
        pattern: /(?:api[_-]?key|apikey)\\s*[:=]\\s*["']([^"']{20,})["']/gi,
        severity: "high",
        description: "Possible API key detected",
    },
    
    // AWS
    {
        name: "AWS Access Key",
        pattern: /AKIA[0-9A-Z]{16}/g,
        severity: "critical",
        description: "AWS Access Key ID",
    },
    {
        name: "AWS Secret Key",
        pattern: /(?:aws)?[_-]?secret[_-]?(?:access)?[_-]?key\\s*[:=]\\s*["']([A-Za-z0-9/+=]{40})["']/gi,
        severity: "critical",
        description: "AWS Secret Access Key",
    },

    // Passwords
    {
        name: "Password",
        pattern: /(?:password|passwd|pwd)\\s*[:=]\\s*["']([^"']{8,})["']/gi,
        severity: "high",
        description: "Hardcoded password",
    },

    // Tokens
    {
        name: "JWT Token",
        pattern: /eyJ[A-Za-z0-9-_]+\\.eyJ[A-Za-z0-9-_]+\\.[A-Za-z0-9-_.+/=]*/g,
        severity: "high",
        description: "JWT token detected",
    },
    {
        name: "GitHub Token",
        pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
        severity: "critical",
        description: "GitHub personal access token",
    },

    // Private Keys
    {
        name: "Private Key",
        pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
        severity: "critical",
        description: "Private key file content",
    },

    // Database Connection Strings
    {
        name: "Database URL",
        pattern: /(?:postgres|mysql|mongodb):\\/\\/[^:]+:[^@]+@[^/]+/gi,
        severity: "critical",
        description: "Database connection string with credentials",
    },

    // Slack
    {
        name: "Slack Token",
        pattern: /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
        severity: "high",
        description: "Slack token",
    },

    // Stripe
    {
        name: "Stripe Key",
        pattern: /(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}/g,
        severity: "critical",
        description: "Stripe API key",
    },
];

// ============================================
// SCANNER INTERFACE
// ============================================

interface ScanFinding {
    file: string;
    line: number;
    pattern: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    snippet: string;
}

interface ScanResult {
    findings: ScanFinding[];
    filesScanned: number;
    timestamp: Date;
}

// ============================================
// SCANNER FUNCTIONS
// ============================================

/**
 * Scan a file for secrets
 */
export function scanFile(filePath: string): ScanFinding[] {
    const findings: ScanFinding[] = [];
    
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (const pattern of secretPatterns) {
                pattern.pattern.lastIndex = 0; // Reset regex
                
                if (pattern.pattern.test(line)) {
                    findings.push({
                        file: filePath,
                        line: i + 1,
                        pattern: pattern.name,
                        severity: pattern.severity,
                        description: pattern.description,
                        snippet: maskSecret(line.trim().substring(0, 100)),
                    });
                }
            }
        }
    } catch (error) {
        console.error(\`Error scanning file \${filePath}:\`, error);
    }

    return findings;
}

/**
 * Scan directory recursively
 */
export function scanDirectory(
    dirPath: string,
    excludePaths: string[] = ["node_modules", ".git", "dist", "build"]
): ScanResult {
    const findings: ScanFinding[] = [];
    let filesScanned = 0;

    function scan(dir: string): void {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            
            // Skip excluded paths
            if (excludePaths.some(excluded => fullPath.includes(excluded))) {
                continue;
            }

            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scan(fullPath);
            } else if (stat.isFile() && shouldScanFile(item)) {
                findings.push(...scanFile(fullPath));
                filesScanned++;
            }
        }
    }

    scan(dirPath);

    return {
        findings,
        filesScanned,
        timestamp: new Date(),
    };
}

/**
 * Check if file should be scanned
 */
function shouldScanFile(filename: string): boolean {
    const scanExtensions = [
        ".ts", ".tsx", ".js", ".jsx",
        ".json", ".yaml", ".yml",
        ".env", ".config", ".conf",
        ".sh", ".bash", ".zsh",
        ".py", ".rb", ".php",
    ];
    
    return scanExtensions.some(ext => filename.endsWith(ext));
}

/**
 * Mask sensitive data in snippet
 */
function maskSecret(snippet: string): string {
    // Mask anything that looks like a key/password value
    return snippet.replace(
        /[:=]\\s*["']?([^"'\\s]{8,})["']?/g,
        ":***REDACTED***"
    );
}

// ============================================
// REPORT GENERATION
// ============================================

/**
 * Generate scan report
 */
export function generateReport(result: ScanResult): string {
    const lines: string[] = [
        "# Secret Scan Report",
        "",
        \`Scan Date: \${result.timestamp.toISOString()}\`,
        \`Files Scanned: \${result.filesScanned}\`,
        \`Findings: \${result.findings.length}\`,
        "",
    ];

    if (result.findings.length === 0) {
        lines.push("✅ No secrets detected!");
    } else {
        lines.push("## Findings", "");

        const bySeverity = {
            critical: result.findings.filter(f => f.severity === "critical"),
            high: result.findings.filter(f => f.severity === "high"),
            medium: result.findings.filter(f => f.severity === "medium"),
            low: result.findings.filter(f => f.severity === "low"),
        };

        for (const [severity, findings] of Object.entries(bySeverity)) {
            if (findings.length > 0) {
                lines.push(\`### \${severity.toUpperCase()} (\${findings.length})\`, "");
                
                for (const finding of findings) {
                    lines.push(
                        \`- **\${finding.pattern}** in \${finding.file}:\${finding.line}\`,
                        \`  \${finding.description}\`,
                        ""
                    );
                }
            }
        }
    }

    return lines.join("\\n");
}
`;

// ============================================
// DEPENDENCY SCANNER TEMPLATE
// ============================================

export const DEPENDENCY_SCANNER_TEMPLATE = `/**
 * ============================================
 * DEPENDENCY VULNERABILITY SCANNER
 * ============================================
 * 
 * Scans project dependencies for known vulnerabilities.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ============================================
// TYPES
// ============================================

interface Vulnerability {
    package: string;
    severity: "critical" | "high" | "moderate" | "low";
    title: string;
    url: string;
    fixAvailable: boolean;
    fixedIn?: string;
}

interface DependencyInfo {
    name: string;
    version: string;
    latest?: string;
    outdated: boolean;
}

interface ScanResult {
    vulnerabilities: Vulnerability[];
    dependencies: DependencyInfo[];
    timestamp: Date;
    hasIssues: boolean;
}

// ============================================
// SCANNER FUNCTIONS
// ============================================

/**
 * Run npm audit and parse results
 */
export function runNpmAudit(projectPath: string): ScanResult {
    const result: ScanResult = {
        vulnerabilities: [],
        dependencies: [],
        timestamp: new Date(),
        hasIssues: false,
    };

    try {
        // Run npm audit
        const auditOutput = execSync("npm audit --json", {
            cwd: projectPath,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });

        const auditData = JSON.parse(auditOutput);
        
        // Parse vulnerabilities
        if (auditData.vulnerabilities) {
            for (const [name, data] of Object.entries(auditData.vulnerabilities)) {
                const vuln = data as any;
                result.vulnerabilities.push({
                    package: name,
                    severity: vuln.severity,
                    title: vuln.via?.[0]?.title || "Unknown vulnerability",
                    url: vuln.via?.[0]?.url || "",
                    fixAvailable: vuln.fixAvailable || false,
                    fixedIn: vuln.fixAvailable?.version,
                });
            }
        }

        result.hasIssues = result.vulnerabilities.length > 0;

    } catch (error: any) {
        // npm audit returns non-zero when vulnerabilities found
        try {
            const auditData = JSON.parse(error.stdout || "{}");
            if (auditData.vulnerabilities) {
                for (const [name, data] of Object.entries(auditData.vulnerabilities)) {
                    const vuln = data as any;
                    result.vulnerabilities.push({
                        package: name,
                        severity: vuln.severity,
                        title: vuln.via?.[0]?.title || "Unknown vulnerability",
                        url: vuln.via?.[0]?.url || "",
                        fixAvailable: !!vuln.fixAvailable,
                        fixedIn: vuln.fixAvailable?.version,
                    });
                }
            }
            result.hasIssues = true;
        } catch {
            console.error("Failed to parse npm audit output");
        }
    }

    // Get dependency info
    result.dependencies = getDependencyInfo(projectPath);

    return result;
}

/**
 * Get dependency information from package.json
 */
function getDependencyInfo(projectPath: string): DependencyInfo[] {
    const deps: DependencyInfo[] = [];

    try {
        const packageJsonPath = path.join(projectPath, "package.json");
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

        const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        for (const [name, version] of Object.entries(allDeps)) {
            deps.push({
                name,
                version: version as string,
                outdated: false, // Would need npm outdated to check
            });
        }
    } catch (error) {
        console.error("Failed to read package.json:", error);
    }

    return deps;
}

/**
 * Check for outdated packages
 */
export function checkOutdated(projectPath: string): DependencyInfo[] {
    const outdated: DependencyInfo[] = [];

    try {
        const output = execSync("npm outdated --json", {
            cwd: projectPath,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });

        const data = JSON.parse(output || "{}");
        
        for (const [name, info] of Object.entries(data)) {
            const pkg = info as any;
            outdated.push({
                name,
                version: pkg.current,
                latest: pkg.latest,
                outdated: true,
            });
        }
    } catch (error: any) {
        // npm outdated returns non-zero when outdated packages found
        try {
            const data = JSON.parse(error.stdout || "{}");
            for (const [name, info] of Object.entries(data)) {
                const pkg = info as any;
                outdated.push({
                    name,
                    version: pkg.current,
                    latest: pkg.latest,
                    outdated: true,
                });
            }
        } catch {
            // No outdated packages or error
        }
    }

    return outdated;
}

// ============================================
// REPORT GENERATION
// ============================================

/**
 * Generate security report
 */
export function generateSecurityReport(result: ScanResult): string {
    const lines: string[] = [
        "# Dependency Security Report",
        "",
        \`Scan Date: \${result.timestamp.toISOString()}\`,
        \`Total Dependencies: \${result.dependencies.length}\`,
        \`Vulnerabilities Found: \${result.vulnerabilities.length}\`,
        "",
    ];

    if (result.vulnerabilities.length === 0) {
        lines.push("✅ No vulnerabilities detected!");
    } else {
        lines.push("## Vulnerabilities", "");

        const bySeverity = {
            critical: result.vulnerabilities.filter(v => v.severity === "critical"),
            high: result.vulnerabilities.filter(v => v.severity === "high"),
            moderate: result.vulnerabilities.filter(v => v.severity === "moderate"),
            low: result.vulnerabilities.filter(v => v.severity === "low"),
        };

        for (const [severity, vulns] of Object.entries(bySeverity)) {
            if (vulns.length > 0) {
                lines.push(\`### \${severity.toUpperCase()} (\${vulns.length})\`, "");
                
                for (const vuln of vulns) {
                    lines.push(
                        \`- **\${vuln.package}**: \${vuln.title}\`,
                        \`  Fix: \${vuln.fixAvailable ? \`Update to \${vuln.fixedIn}\` : "No fix available"}\`,
                        ""
                    );
                }
            }
        }
    }

    return lines.join("\\n");
}
`;

// ============================================
// TEMPLATE SETS AND HELPERS
// ============================================

export interface SecurityTemplateSet {
    name: string;
    templates: string[];
    description: string;
}

export const SECURITY_TEMPLATE_SETS: Record<string, SecurityTemplateSet> = {
    basic: {
        name: "Basic Security",
        templates: ["helmet", "cors", "rate-limiter"],
        description: "Essential security middleware",
    },
    full: {
        name: "Full Security",
        templates: ["helmet", "cors", "csrf", "rate-limiter", "sanitize", "headers"],
        description: "Complete security middleware stack",
    },
    api: {
        name: "API Security",
        templates: ["helmet", "cors", "rate-limiter", "sanitize"],
        description: "Security for API-only applications",
    },
    scanning: {
        name: "Security Scanning",
        templates: ["secret-scanner", "dependency-scanner"],
        description: "Code and dependency scanning",
    },
};

/**
 * Get templates for a security type
 */
export function getSecurityTemplates(type: string): Record<string, string> {
    const templates: Record<string, string> = {
        helmet: HELMET_SECURITY_TEMPLATE,
        cors: CORS_CONFIG_TEMPLATE,
        csrf: CSRF_PROTECTION_TEMPLATE,
        "rate-limiter": RATE_LIMITER_TEMPLATE,
        sanitize: INPUT_SANITIZATION_TEMPLATE,
        "sql-prevention": SQL_INJECTION_PREVENTION_TEMPLATE,
        "xss-prevention": XSS_PREVENTION_TEMPLATE,
        headers: SECURITY_HEADERS_TEMPLATE,
        "secret-scanner": SECRET_SCANNER_TEMPLATE,
        "dependency-scanner": DEPENDENCY_SCANNER_TEMPLATE,
    };

    if (type in templates) {
        return { [type]: templates[type] };
    }

    return templates;
}

/**
 * Get available security template types
 */
export function getAvailableSecurityTypes(): string[] {
    return [
        "helmet",
        "cors",
        "csrf",
        "rate-limiter",
        "sanitize",
        "sql-prevention",
        "xss-prevention",
        "headers",
        "secret-scanner",
        "dependency-scanner",
    ];
}

// ============================================
// RE-EXPORT NEW TEMPLATE MODULES
// ============================================

// Bot Protection Templates
export {
    CAPTCHA_TEMPLATE,
    HONEYPOT_TEMPLATE,
    FINGERPRINTING_TEMPLATE,
    BEHAVIORAL_ANALYSIS_TEMPLATE,
    BOT_PROTECTION_TEMPLATE_SETS,
    getBotProtectionTemplates,
    getAvailableBotProtectionTypes,
} from "./bot-protection.js";

// WAF Rules Templates
export {
    WAF_RULE_ENGINE_TEMPLATE,
    OWASP_RULES_TEMPLATE,
    CUSTOM_RULES_TEMPLATE,
    WAF_TEMPLATE_SETS,
    getWAFTemplates,
    getAvailableWAFTypes,
} from "./waf-rules.js";

// Threat Detection Templates
export {
    ANOMALY_DETECTION_TEMPLATE,
    INTRUSION_DETECTION_TEMPLATE,
    THREAT_INTELLIGENCE_TEMPLATE,
    THREAT_DETECTION_TEMPLATE_SETS,
    getThreatDetectionTemplates,
    getAvailableThreatDetectionTypes,
} from "./threat-detection.js";

// API Key Management Templates
export {
    API_KEY_MANAGER_TEMPLATE,
    KEY_ROTATION_TEMPLATE,
    SCOPE_MANAGEMENT_TEMPLATE,
    API_KEY_ANALYTICS_TEMPLATE,
    API_KEY_TEMPLATE_SETS,
    getAPIKeyTemplates,
    getAvailableAPIKeyTypes,
} from "./api-key-management.js";

// Security Testing Templates
export {
    PENTEST_SCRIPTS_TEMPLATE,
    FUZZING_TEMPLATE,
    VULNERABILITY_SCANNER_TEMPLATE,
    SECURITY_TESTING_TEMPLATE_SETS,
    getSecurityTestingTemplates,
    getAvailableSecurityTestingTypes,
} from "./security-testing.js";

