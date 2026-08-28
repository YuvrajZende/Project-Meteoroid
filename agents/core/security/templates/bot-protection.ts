/**
 * ============================================
 * BOT PROTECTION TEMPLATES
 * ============================================
 * 
 * Comprehensive bot protection including CAPTCHA,
 * honeypots, fingerprinting, and behavioral analysis.
 */

// ============================================
// CAPTCHA INTEGRATION TEMPLATE
// ============================================

export const CAPTCHA_TEMPLATE = `/**
 * ============================================
 * CAPTCHA INTEGRATION
 * ============================================
 * 
 * Supports multiple CAPTCHA providers:
 * - reCAPTCHA v2/v3
 * - hCaptcha
 * - Cloudflare Turnstile
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// CONFIGURATION
// ============================================

export interface CaptchaConfig {
    provider: "recaptcha-v2" | "recaptcha-v3" | "hcaptcha" | "turnstile";
    siteKey: string;
    secretKey: string;
    minScore?: number; // For reCAPTCHA v3 (0.0 - 1.0)
    action?: string;   // For reCAPTCHA v3
}

const config: CaptchaConfig = {
    provider: (process.env.CAPTCHA_PROVIDER as CaptchaConfig["provider"]) || "recaptcha-v3",
    siteKey: process.env.CAPTCHA_SITE_KEY || "",
    secretKey: process.env.CAPTCHA_SECRET_KEY || "",
    minScore: parseFloat(process.env.CAPTCHA_MIN_SCORE || "0.5"),
    action: process.env.CAPTCHA_ACTION || "submit",
};

// ============================================
// VERIFICATION ENDPOINTS
// ============================================

const VERIFY_URLS = {
    "recaptcha-v2": "https://www.google.com/recaptcha/api/siteverify",
    "recaptcha-v3": "https://www.google.com/recaptcha/api/siteverify",
    "hcaptcha": "https://hcaptcha.com/siteverify",
    "turnstile": "https://challenges.cloudflare.com/turnstile/v0/siteverify",
};

// ============================================
// VERIFICATION FUNCTION
// ============================================

export interface CaptchaResult {
    success: boolean;
    score?: number;
    action?: string;
    errorCodes?: string[];
    hostname?: string;
    timestamp?: string;
}

/**
 * Verify CAPTCHA token with provider
 */
export async function verifyCaptcha(
    token: string,
    remoteIP?: string
): Promise<CaptchaResult> {
    const url = VERIFY_URLS[config.provider];
    
    const formData = new URLSearchParams();
    formData.append("secret", config.secretKey);
    formData.append("response", token);
    if (remoteIP) {
        formData.append("remoteip", remoteIP);
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
        });

        const data = await response.json();

        // Normalize response format
        const result: CaptchaResult = {
            success: data.success || false,
            score: data.score,
            action: data.action,
            errorCodes: data["error-codes"],
            hostname: data.hostname,
            timestamp: data.challenge_ts,
        };

        // For reCAPTCHA v3, also check score
        if (config.provider === "recaptcha-v3" && result.success) {
            if (result.score !== undefined && result.score < (config.minScore || 0.5)) {
                result.success = false;
                result.errorCodes = ["low-score"];
            }
            if (config.action && result.action !== config.action) {
                result.success = false;
                result.errorCodes = ["action-mismatch"];
            }
        }

        return result;
    } catch (error) {
        console.error("[Captcha] Verification error:", error);
        return {
            success: false,
            errorCodes: ["verification-failed"],
        };
    }
}

// ============================================
// MIDDLEWARE
// ============================================

export interface CaptchaMiddlewareOptions {
    /** Header or body field containing the CAPTCHA token */
    tokenField?: string;
    /** Skip CAPTCHA for certain paths */
    skipPaths?: string[];
    /** Custom error handler */
    onError?: (req: Request, res: Response, result: CaptchaResult) => void;
}

/**
 * CAPTCHA verification middleware
 */
export function captchaMiddleware(options: CaptchaMiddlewareOptions = {}) {
    const tokenField = options.tokenField || "captcha-token";

    return async (req: Request, res: Response, next: NextFunction) => {
        // Skip for certain paths
        if (options.skipPaths?.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Get token from header or body
        const token = 
            req.headers[tokenField] as string ||
            req.headers["x-captcha-token"] as string ||
            req.body?.[tokenField] ||
            req.body?.captchaToken;

        if (!token) {
            return res.status(400).json({
                error: "CAPTCHA required",
                message: "Please complete the CAPTCHA challenge",
            });
        }

        // Get client IP
        const clientIP = 
            req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
            req.ip;

        // Verify CAPTCHA
        const result = await verifyCaptcha(token, clientIP);

        if (!result.success) {
            console.warn(\`[Captcha] Failed verification from \${clientIP}\`);
            
            if (options.onError) {
                return options.onError(req, res, result);
            }

            return res.status(403).json({
                error: "CAPTCHA failed",
                message: "CAPTCHA verification failed. Please try again.",
                codes: result.errorCodes,
            });
        }

        // Attach result to request for logging
        (req as any).captchaResult = result;
        next();
    };
}

// ============================================
// FRONTEND SNIPPET GENERATOR
// ============================================

export function generateFrontendSnippet(): string {
    switch (config.provider) {
        case "recaptcha-v3":
            return \`
<!-- reCAPTCHA v3 -->
<script src="https://www.google.com/recaptcha/api.js?render=\${config.siteKey}"></script>
<script>
async function getCaptchaToken(action = 'submit') {
    return await grecaptcha.execute('\${config.siteKey}', { action });
}
</script>
\`;
        case "recaptcha-v2":
            return \`
<!-- reCAPTCHA v2 -->
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<div class="g-recaptcha" data-sitekey="\${config.siteKey}"></div>
\`;
        case "hcaptcha":
            return \`
<!-- hCaptcha -->
<script src="https://js.hcaptcha.com/1/api.js" async defer></script>
<div class="h-captcha" data-sitekey="\${config.siteKey}"></div>
\`;
        case "turnstile":
            return \`
<!-- Cloudflare Turnstile -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<div class="cf-turnstile" data-sitekey="\${config.siteKey}"></div>
\`;
        default:
            return "";
    }
}
`;

// ============================================
// HONEYPOT TEMPLATE
// ============================================

export const HONEYPOT_TEMPLATE = `/**
 * ============================================
 * HONEYPOT BOT DETECTION
 * ============================================
 * 
 * Hidden fields that catch automated bots.
 * Legitimate users won't see or fill these fields.
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// CONFIGURATION
// ============================================

export interface HoneypotConfig {
    /** Field names for honeypot fields */
    fields: string[];
    /** Minimum time (ms) before form submission is valid */
    minTime?: number;
    /** Maximum time (ms) before form submission is suspicious */
    maxTime?: number;
    /** Log honeypot triggers */
    enableLogging?: boolean;
}

const defaultConfig: HoneypotConfig = {
    fields: ["website", "url", "email2", "address2", "phone2", "fax"],
    minTime: 2000,  // 2 seconds minimum
    maxTime: 3600000, // 1 hour maximum
    enableLogging: true,
};

// ============================================
// HONEYPOT MIDDLEWARE
// ============================================

/**
 * Check for honeypot field values
 */
export function honeypotMiddleware(config: HoneypotConfig = defaultConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
        const body = req.body || {};
        
        // Check each honeypot field
        for (const field of config.fields) {
            if (body[field] && body[field].trim() !== "") {
                if (config.enableLogging) {
                    console.warn(\`[Honeypot] Bot detected - filled field: \${field}\`, {
                        ip: req.ip,
                        path: req.path,
                        userAgent: req.headers["user-agent"],
                    });
                }
                
                // Return fake success to confuse bots
                return res.status(200).json({
                    success: true,
                    message: "Form submitted successfully",
                });
            }
        }

        // Check submission timing
        const startTime = body._formStartTime || body.formStartTime;
        if (startTime && config.minTime) {
            const elapsed = Date.now() - parseInt(startTime);
            
            if (elapsed < config.minTime) {
                if (config.enableLogging) {
                    console.warn(\`[Honeypot] Bot detected - too fast: \${elapsed}ms\`, {
                        ip: req.ip,
                    });
                }
                return res.status(200).json({
                    success: true,
                    message: "Form submitted successfully",
                });
            }

            if (config.maxTime && elapsed > config.maxTime) {
                if (config.enableLogging) {
                    console.warn(\`[Honeypot] Suspicious - too slow: \${elapsed}ms\`, {
                        ip: req.ip,
                    });
                }
                // Allow but log for review
            }
        }

        next();
    };
}

// ============================================
// HTML GENERATOR
// ============================================

/**
 * Generate hidden honeypot fields for HTML forms
 */
export function generateHoneypotFields(config: HoneypotConfig = defaultConfig): string {
    const fields = config.fields.map(field => \`
        <div style="position: absolute; left: -9999px; opacity: 0; height: 0; overflow: hidden;" aria-hidden="true">
            <label for="\${field}">Leave empty</label>
            <input type="text" name="\${field}" id="\${field}" tabindex="-1" autocomplete="off" />
        </div>
    \`).join("");

    return \`
        \${fields}
        <input type="hidden" name="_formStartTime" value="" id="formStartTime" />
        <script>
            document.getElementById('formStartTime').value = Date.now();
        </script>
    \`;
}

/**
 * React component for honeypot fields
 */
export const HONEYPOT_REACT_COMPONENT = \`
import React, { useEffect, useState } from 'react';

interface HoneypotFieldsProps {
    fields?: string[];
}

export function HoneypotFields({ 
    fields = ['website', 'url', 'email2'] 
}: HoneypotFieldsProps) {
    const [startTime, setStartTime] = useState<number>(0);

    useEffect(() => {
        setStartTime(Date.now());
    }, []);

    return (
        <>
            {fields.map(field => (
                <div 
                    key={field}
                    style={{ 
                        position: 'absolute', 
                        left: '-9999px', 
                        opacity: 0,
                        height: 0,
                        overflow: 'hidden'
                    }}
                    aria-hidden="true"
                >
                    <label htmlFor={field}>Leave empty</label>
                    <input 
                        type="text" 
                        name={field} 
                        id={field}
                        tabIndex={-1}
                        autoComplete="off"
                    />
                </div>
            ))}
            <input type="hidden" name="_formStartTime" value={startTime} />
        </>
    );
}
\`;
`;

// ============================================
// FINGERPRINTING TEMPLATE
// ============================================

export const FINGERPRINTING_TEMPLATE = `/**
 * ============================================
 * BROWSER FINGERPRINTING
 * ============================================
 * 
 * Collect browser/device fingerprints for bot detection
 * and device recognition. Privacy-aware implementation.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ============================================
// FINGERPRINT DATA TYPES
// ============================================

export interface BrowserFingerprint {
    id: string;
    userAgent: string;
    acceptLanguage: string;
    acceptEncoding: string;
    screenResolution?: string;
    timezone?: string;
    platform?: string;
    plugins?: string[];
    canvas?: string;
    webgl?: string;
    fonts?: string[];
    cookiesEnabled?: boolean;
    doNotTrack?: boolean;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    touchSupport?: boolean;
    colorDepth?: number;
}

export interface FingerprintResult {
    fingerprintId: string;
    confidence: number;
    isBot: boolean;
    isSuspicious: boolean;
    reasons: string[];
    rawFingerprint: Partial<BrowserFingerprint>;
}

// ============================================
// SERVER-SIDE FINGERPRINT EXTRACTION
// ============================================

/**
 * Extract fingerprint data from request headers
 */
export function extractServerFingerprint(req: Request): Partial<BrowserFingerprint> {
    const headers = req.headers;

    return {
        userAgent: headers["user-agent"] || "",
        acceptLanguage: headers["accept-language"] || "",
        acceptEncoding: headers["accept-encoding"] || "",
    };
}

/**
 * Generate fingerprint ID from data
 */
export function generateFingerprintId(data: Partial<BrowserFingerprint>): string {
    const components = [
        data.userAgent,
        data.acceptLanguage,
        data.screenResolution,
        data.timezone,
        data.platform,
        data.canvas,
        data.webgl,
    ].filter(Boolean).join("|");

    return crypto.createHash("sha256").update(components).digest("hex").substring(0, 32);
}

// ============================================
// BOT DETECTION RULES
// ============================================

const BOT_USER_AGENTS = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /java/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
    /playwright/i, /cypress/i,
];

const SUSPICIOUS_PATTERNS = [
    { check: (fp: Partial<BrowserFingerprint>) => !fp.userAgent, reason: "Missing user agent" },
    { check: (fp: Partial<BrowserFingerprint>) => !fp.acceptLanguage, reason: "Missing accept-language" },
    { check: (fp: Partial<BrowserFingerprint>) => fp.hardwareConcurrency === 0, reason: "Zero hardware concurrency" },
    { check: (fp: Partial<BrowserFingerprint>) => fp.deviceMemory === 0, reason: "Zero device memory" },
    { check: (fp: Partial<BrowserFingerprint>) => fp.colorDepth === 0, reason: "Zero color depth" },
];

/**
 * Analyze fingerprint for bot behavior
 */
export function analyzeFingerprint(data: Partial<BrowserFingerprint>): FingerprintResult {
    const reasons: string[] = [];
    let isBot = false;
    let isSuspicious = false;

    // Check for known bot user agents
    if (data.userAgent) {
        for (const pattern of BOT_USER_AGENTS) {
            if (pattern.test(data.userAgent)) {
                isBot = true;
                reasons.push(\`Bot user agent detected: \${pattern.source}\`);
                break;
            }
        }
    }

    // Check suspicious patterns
    for (const { check, reason } of SUSPICIOUS_PATTERNS) {
        if (check(data)) {
            isSuspicious = true;
            reasons.push(reason);
        }
    }

    // Calculate confidence score
    const confidence = calculateConfidence(data, reasons.length);

    return {
        fingerprintId: generateFingerprintId(data),
        confidence,
        isBot,
        isSuspicious: isSuspicious || confidence < 0.5,
        reasons,
        rawFingerprint: data,
    };
}

function calculateConfidence(data: Partial<BrowserFingerprint>, issueCount: number): number {
    let score = 1.0;
    
    // Reduce score for missing data
    const expectedFields = ["userAgent", "acceptLanguage", "screenResolution", "timezone"];
    const presentFields = expectedFields.filter(f => data[f as keyof BrowserFingerprint]);
    score *= presentFields.length / expectedFields.length;

    // Reduce score for issues found
    score -= issueCount * 0.1;

    return Math.max(0, Math.min(1, score));
}

// ============================================
// MIDDLEWARE
// ============================================

export interface FingerprintMiddlewareOptions {
    /** Require fingerprint data in request */
    requireFingerprint?: boolean;
    /** Block detected bots */
    blockBots?: boolean;
    /** Block suspicious requests */
    blockSuspicious?: boolean;
    /** Minimum confidence threshold */
    minConfidence?: number;
}

/**
 * Fingerprint analysis middleware
 */
export function fingerprintMiddleware(options: FingerprintMiddlewareOptions = {}) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Extract server-side fingerprint
        const serverFp = extractServerFingerprint(req);
        
        // Get client-side fingerprint from header/body
        const clientFp = req.headers["x-fingerprint"] 
            ? JSON.parse(req.headers["x-fingerprint"] as string)
            : req.body?.fingerprint || {};

        // Merge fingerprints
        const fingerprint = { ...serverFp, ...clientFp };

        // Analyze
        const result = analyzeFingerprint(fingerprint);

        // Attach to request
        (req as any).fingerprint = result;

        // Log
        console.log(\`[Fingerprint] ID: \${result.fingerprintId}, Bot: \${result.isBot}, Confidence: \${result.confidence.toFixed(2)}\`);

        // Block if configured
        if (options.blockBots && result.isBot) {
            return res.status(403).json({
                error: "Access denied",
                message: "Automated access is not allowed",
            });
        }

        if (options.blockSuspicious && result.isSuspicious) {
            return res.status(403).json({
                error: "Access denied",
                message: "Request blocked for security reasons",
            });
        }

        if (options.minConfidence && result.confidence < options.minConfidence) {
            return res.status(403).json({
                error: "Access denied",
                message: "Unable to verify request authenticity",
            });
        }

        next();
    };
}

// ============================================
// CLIENT-SIDE FINGERPRINT COLLECTOR
// ============================================

export const CLIENT_FINGERPRINT_SCRIPT = \`
/**
 * Client-side fingerprint collector
 * Include this script in your frontend
 */

async function collectFingerprint() {
    const fp = {
        screenResolution: \\\`\\\${window.screen.width}x\\\${window.screen.height}\\\`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack === "1",
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: (navigator as any).deviceMemory || 0,
        colorDepth: screen.colorDepth,
        touchSupport: 'ontouchstart' in window,
        plugins: Array.from(navigator.plugins || []).map(p => p.name),
    };

    // Canvas fingerprint
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Hello, World!', 2, 15);
            fp.canvas = canvas.toDataURL();
        }
    } catch (e) {}

    return fp;
}

// Usage:
// const fingerprint = await collectFingerprint();
// fetch('/api/endpoint', {
//     headers: { 'X-Fingerprint': JSON.stringify(fingerprint) }
// });
\`;
`;

// ============================================
// BEHAVIORAL ANALYSIS TEMPLATE
// ============================================

export const BEHAVIORAL_ANALYSIS_TEMPLATE = `/**
 * ============================================
 * BEHAVIORAL ANALYSIS
 * ============================================
 * 
 * Detect bots through behavioral patterns:
 * - Mouse movement patterns
 * - Typing patterns
 * - Request timing
 * - Navigation patterns
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// BEHAVIOR TRACKING
// ============================================

interface BehaviorSession {
    sessionId: string;
    startTime: number;
    requestCount: number;
    requestTimes: number[];
    paths: string[];
    methods: string[];
    suspiciousScore: number;
    lastActivity: number;
}

const sessions = new Map<string, BehaviorSession>();

// ============================================
// BEHAVIORAL PATTERNS
// ============================================

interface BehaviorRule {
    name: string;
    check: (session: BehaviorSession, req: Request) => number; // Returns score increase
    threshold: number;
}

const BEHAVIOR_RULES: BehaviorRule[] = [
    {
        name: "rapid_requests",
        check: (session) => {
            const lastFive = session.requestTimes.slice(-5);
            if (lastFive.length < 5) return 0;
            const avgInterval = (lastFive[4] - lastFive[0]) / 4;
            return avgInterval < 100 ? 30 : avgInterval < 500 ? 10 : 0;
        },
        threshold: 20,
    },
    {
        name: "linear_navigation",
        check: (session) => {
            // Bots often navigate in straight lines through the site
            const uniquePaths = new Set(session.paths.slice(-10));
            if (session.paths.length >= 10 && uniquePaths.size === 10) {
                return 15; // No repeated paths = suspicious
            }
            return 0;
        },
        threshold: 15,
    },
    {
        name: "method_pattern",
        check: (session) => {
            // Unusual method usage patterns
            const methods = session.methods.slice(-20);
            const getCount = methods.filter(m => m === "GET").length;
            if (methods.length >= 20 && getCount === 20) {
                return 10; // Only GETs might indicate scraping
            }
            return 0;
        },
        threshold: 10,
    },
    {
        name: "high_volume",
        check: (session) => {
            const sessionDuration = Date.now() - session.startTime;
            const requestsPerMinute = (session.requestCount / sessionDuration) * 60000;
            return requestsPerMinute > 60 ? 25 : requestsPerMinute > 30 ? 10 : 0;
        },
        threshold: 20,
    },
];

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Behavioral analysis middleware
 */
export function behaviorMiddleware(options: { maxScore?: number } = {}) {
    const maxScore = options.maxScore || 50;

    return (req: Request, res: Response, next: NextFunction) => {
        const sessionId = req.ip || "unknown";
        const now = Date.now();

        // Get or create session
        let session = sessions.get(sessionId);
        if (!session) {
            session = {
                sessionId,
                startTime: now,
                requestCount: 0,
                requestTimes: [],
                paths: [],
                methods: [],
                suspiciousScore: 0,
                lastActivity: now,
            };
            sessions.set(sessionId, session);
        }

        // Update session
        session.requestCount++;
        session.requestTimes.push(now);
        session.paths.push(req.path);
        session.methods.push(req.method);
        session.lastActivity = now;

        // Keep arrays bounded
        if (session.requestTimes.length > 100) {
            session.requestTimes = session.requestTimes.slice(-100);
        }
        if (session.paths.length > 100) {
            session.paths = session.paths.slice(-100);
        }
        if (session.methods.length > 100) {
            session.methods = session.methods.slice(-100);
        }

        // Run behavior rules
        for (const rule of BEHAVIOR_RULES) {
            const scoreIncrease = rule.check(session, req);
            session.suspiciousScore += scoreIncrease;
            
            if (scoreIncrease > 0) {
                console.log(\`[Behavior] Rule \${rule.name} triggered: +\${scoreIncrease} (total: \${session.suspiciousScore})\`);
            }
        }

        // Decay score slowly over time
        const timeSinceStart = now - session.startTime;
        const decayFactor = Math.max(0, 1 - timeSinceStart / (30 * 60 * 1000)); // 30 min decay
        session.suspiciousScore *= decayFactor;

        // Check threshold
        if (session.suspiciousScore > maxScore) {
            console.warn(\`[Behavior] Bot detected: \${sessionId}, score: \${session.suspiciousScore}\`);
            return res.status(429).json({
                error: "Rate limited",
                message: "Unusual activity detected. Please try again later.",
            });
        }

        // Attach to request
        (req as any).behaviorScore = session.suspiciousScore;
        next();
    };
}

// ============================================
// SESSION CLEANUP
// ============================================

setInterval(() => {
    const now = Date.now();
    const expiry = 30 * 60 * 1000; // 30 minutes

    for (const [id, session] of sessions) {
        if (now - session.lastActivity > expiry) {
            sessions.delete(id);
        }
    }
}, 60 * 1000); // Run every minute
`;

// ============================================
// EXPORTS
// ============================================

export const BOT_PROTECTION_TEMPLATE_SETS = {
    captcha: {
        name: "CAPTCHA Integration",
        template: CAPTCHA_TEMPLATE,
        description: "reCAPTCHA, hCaptcha, and Turnstile integration",
    },
    honeypot: {
        name: "Honeypot Fields",
        template: HONEYPOT_TEMPLATE,
        description: "Hidden fields to catch automated bots",
    },
    fingerprinting: {
        name: "Browser Fingerprinting",
        template: FINGERPRINTING_TEMPLATE,
        description: "Client/device fingerprinting for bot detection",
    },
    behavioral: {
        name: "Behavioral Analysis",
        template: BEHAVIORAL_ANALYSIS_TEMPLATE,
        description: "Detect bots through behavioral patterns",
    },
};

export function getBotProtectionTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        captcha: CAPTCHA_TEMPLATE,
        honeypot: HONEYPOT_TEMPLATE,
        fingerprinting: FINGERPRINTING_TEMPLATE,
        behavioral: BEHAVIORAL_ANALYSIS_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableBotProtectionTypes(): string[] {
    return ["captcha", "honeypot", "fingerprinting", "behavioral"];
}
