/**
 * ============================================
 * RATE LIMITING TEMPLATES
 * ============================================
 * 
 * Production-ready rate limiting implementations
 * for API protection and abuse prevention.
 */

// ============================================
// REDIS-BASED RATE LIMITER TEMPLATE
// ============================================

export const REDIS_RATE_LIMITER_TEMPLATE = `/**
 * ============================================
 * REDIS-BASED RATE LIMITER
 * ============================================
 * 
 * Distributed rate limiting using Redis.
 * Supports multiple algorithms and patterns.
 */

import { createClient, RedisClientType } from "redis";
import { Request, Response, NextFunction } from "express";

// ============================================
// REDIS CLIENT
// ============================================

let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType> {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.REDIS_URL || "redis://localhost:6379",
        });
        await redisClient.connect();
        console.log("[RateLimiter] Redis connected");
    }
    return redisClient;
}

// ============================================
// RATE LIMIT CONFIGURATION
// ============================================

export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Key prefix for Redis */
    keyPrefix?: string;
    /** Message to return when rate limited */
    message?: string;
    /** Function to generate the rate limit key */
    keyGenerator?: (req: Request) => string;
    /** Skip rate limiting for certain requests */
    skip?: (req: Request) => boolean;
    /** Use sliding window algorithm */
    slidingWindow?: boolean;
    /** Enable burst allowance */
    burstAllowance?: number;
}

const defaultConfig: RateLimitConfig = {
    maxRequests: 100,
    windowSeconds: 60,
    keyPrefix: "rl",
    message: "Too many requests. Please try again later.",
    slidingWindow: true,
    burstAllowance: 0,
};

// ============================================
// RATE LIMIT RESULT
// ============================================

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter: number;
    limit: number;
}

// ============================================
// SLIDING WINDOW RATE LIMITER
// ============================================

/**
 * Sliding window rate limiter using Redis sorted sets
 * More accurate than fixed window but slightly more expensive
 */
export async function slidingWindowRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number,
    burstAllowance: number = 0
): Promise<RateLimitResult> {
    const client = await getRedisClient();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const effectiveLimit = maxRequests + burstAllowance;

    // Remove old entries and count current entries
    const pipeline = client.multi();
    pipeline.zRemRangeByScore(key, 0, windowStart);
    pipeline.zCard(key);
    pipeline.zAdd(key, { score: now, value: \`\${now}-\${Math.random()}\` });
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const currentCount = (results?.[1] as number) || 0;

    const allowed = currentCount < effectiveLimit;
    const remaining = Math.max(0, effectiveLimit - currentCount - 1);

    // Calculate reset time
    const oldestEntry = await client.zRange(key, 0, 0, { REV: false });
    let resetAt = new Date(now + windowSeconds * 1000);
    if (oldestEntry.length > 0) {
        const oldestTime = parseInt(oldestEntry[0].split("-")[0]);
        resetAt = new Date(oldestTime + windowSeconds * 1000);
    }

    return {
        allowed,
        remaining,
        resetAt,
        retryAfter: allowed ? 0 : Math.ceil((resetAt.getTime() - now) / 1000),
        limit: effectiveLimit,
    };
}

/**
 * Fixed window rate limiter using Redis INCR
 * Simpler and faster but can allow bursts at window boundaries
 */
export async function fixedWindowRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
): Promise<RateLimitResult> {
    const client = await getRedisClient();
    const now = Date.now();
    
    // Round to window boundary
    const windowKey = \`\${key}:\${Math.floor(now / (windowSeconds * 1000))}\`;

    const pipeline = client.multi();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, windowSeconds);
    
    const results = await pipeline.exec();
    const currentCount = (results?.[0] as number) || 1;

    const allowed = currentCount <= maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount);
    const resetAt = new Date(Math.ceil(now / (windowSeconds * 1000)) * windowSeconds * 1000);

    return {
        allowed,
        remaining,
        resetAt,
        retryAfter: allowed ? 0 : Math.ceil((resetAt.getTime() - now) / 1000),
        limit: maxRequests,
    };
}

// ============================================
// RATE LIMITER MIDDLEWARE
// ============================================

/**
 * Create a Redis-based rate limiter middleware
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
    const finalConfig = { ...defaultConfig, ...config };

    return async (req: Request, res: Response, next: NextFunction) => {
        // Check if should skip
        if (finalConfig.skip && finalConfig.skip(req)) {
            return next();
        }

        // Generate key
        const key = finalConfig.keyGenerator
            ? finalConfig.keyGenerator(req)
            : \`\${finalConfig.keyPrefix}:\${req.ip}\`;

        try {
            // Perform rate limit check
            const result = finalConfig.slidingWindow
                ? await slidingWindowRateLimit(
                    key,
                    finalConfig.maxRequests,
                    finalConfig.windowSeconds,
                    finalConfig.burstAllowance
                )
                : await fixedWindowRateLimit(
                    key,
                    finalConfig.maxRequests,
                    finalConfig.windowSeconds
                );

            // Set rate limit headers
            res.setHeader("X-RateLimit-Limit", result.limit);
            res.setHeader("X-RateLimit-Remaining", result.remaining);
            res.setHeader("X-RateLimit-Reset", Math.floor(result.resetAt.getTime() / 1000));

            if (!result.allowed) {
                res.setHeader("Retry-After", result.retryAfter);
                console.warn(\`[RateLimiter] Rate limit exceeded for key: \${key}\`);
                
                return res.status(429).json({
                    error: "Too Many Requests",
                    message: finalConfig.message,
                    retryAfter: result.retryAfter,
                });
            }

            next();
        } catch (error) {
            console.error("[RateLimiter] Error:", error);
            // Fail open - allow request but log error
            next();
        }
    };
}
`;

// ============================================
// PER-ENDPOINT RATE LIMITER TEMPLATE
// ============================================

export const ENDPOINT_RATE_LIMITER_TEMPLATE = `/**
 * ============================================
 * PER-ENDPOINT RATE LIMITER
 * ============================================
 * 
 * Different rate limits for different endpoints.
 */

import { Request, Response, NextFunction } from "express";
import { createRateLimiter, RateLimitConfig } from "./redis-rate-limiter";

// ============================================
// ENDPOINT RATE LIMIT CONFIGURATION
// ============================================

export interface EndpointRateLimitConfig {
    /** Default rate limit for unspecified endpoints */
    default: Partial<RateLimitConfig>;
    /** Endpoint-specific rate limits */
    endpoints: Record<string, Partial<RateLimitConfig>>;
    /** Pattern-based rate limits */
    patterns?: Array<{
        pattern: RegExp;
        config: Partial<RateLimitConfig>;
    }>;
}

// ============================================
// PRESET CONFIGURATIONS
// ============================================

/**
 * Recommended rate limits by endpoint type
 */
export const ENDPOINT_PRESETS = {
    // Authentication - very strict
    auth: {
        maxRequests: 5,
        windowSeconds: 900, // 15 minutes
        keyPrefix: "rl:auth",
    },
    
    // Login specifically - stricter
    login: {
        maxRequests: 5,
        windowSeconds: 900,
        keyPrefix: "rl:login",
    },
    
    // Registration
    register: {
        maxRequests: 3,
        windowSeconds: 3600, // 1 hour
        keyPrefix: "rl:register",
    },
    
    // Password reset
    passwordReset: {
        maxRequests: 3,
        windowSeconds: 3600,
        keyPrefix: "rl:pwd-reset",
    },
    
    // API endpoints - moderate
    api: {
        maxRequests: 60,
        windowSeconds: 60,
        keyPrefix: "rl:api",
    },
    
    // Search/expensive operations
    search: {
        maxRequests: 20,
        windowSeconds: 60,
        keyPrefix: "rl:search",
    },
    
    // File uploads
    upload: {
        maxRequests: 10,
        windowSeconds: 300, // 5 minutes
        keyPrefix: "rl:upload",
    },
    
    // Webhooks - allow more
    webhook: {
        maxRequests: 1000,
        windowSeconds: 60,
        keyPrefix: "rl:webhook",
    },
    
    // Public endpoints - most lenient
    public: {
        maxRequests: 200,
        windowSeconds: 60,
        keyPrefix: "rl:public",
    },
};

// ============================================
// ENDPOINT RATE LIMITER FACTORY
// ============================================

/**
 * Create a rate limiter that uses different limits for different endpoints
 */
export function createEndpointRateLimiter(config: EndpointRateLimitConfig) {
    // Create cached rate limiters
    const limiters = new Map<string, ReturnType<typeof createRateLimiter>>();
    
    // Default limiter
    const defaultLimiter = createRateLimiter(config.default);
    
    // Create endpoint-specific limiters
    for (const [path, rateLimitConfig] of Object.entries(config.endpoints)) {
        limiters.set(path, createRateLimiter(rateLimitConfig));
    }

    return async (req: Request, res: Response, next: NextFunction) => {
        const path = req.path;
        
        // Check exact match first
        if (limiters.has(path)) {
            return limiters.get(path)!(req, res, next);
        }
        
        // Check pattern matches
        if (config.patterns) {
            for (const { pattern, config: patternConfig } of config.patterns) {
                if (pattern.test(path)) {
                    // Create limiter on demand for pattern matches
                    const key = pattern.source;
                    if (!limiters.has(key)) {
                        limiters.set(key, createRateLimiter(patternConfig));
                    }
                    return limiters.get(key)!(req, res, next);
                }
            }
        }
        
        // Use default limiter
        return defaultLimiter(req, res, next);
    };
}

/**
 * Example usage:
 * 
 * const rateLimiter = createEndpointRateLimiter({
 *   default: ENDPOINT_PRESETS.api,
 *   endpoints: {
 *     "/auth/login": ENDPOINT_PRESETS.login,
 *     "/auth/register": ENDPOINT_PRESETS.register,
 *     "/api/search": ENDPOINT_PRESETS.search,
 *   },
 *   patterns: [
 *     { pattern: /^\\/api\\/v\\d+\\/public/, config: ENDPOINT_PRESETS.public },
 *     { pattern: /^\\/upload/, config: ENDPOINT_PRESETS.upload },
 *   ],
 * });
 */
`;

// ============================================
// USER-BASED RATE LIMITER TEMPLATE
// ============================================

export const USER_RATE_LIMITER_TEMPLATE = `/**
 * ============================================
 * USER-BASED RATE LIMITER
 * ============================================
 * 
 * Rate limiting based on authenticated user.
 * Supports tiered limits for different user types.
 */

import { Request, Response, NextFunction } from "express";
import { createRateLimiter, RateLimitConfig } from "./redis-rate-limiter";

// ============================================
// USER TIER CONFIGURATION
// ============================================

export interface UserTierLimits {
    free: Partial<RateLimitConfig>;
    basic: Partial<RateLimitConfig>;
    premium: Partial<RateLimitConfig>;
    enterprise: Partial<RateLimitConfig>;
    unlimited: Partial<RateLimitConfig>;
}

export const DEFAULT_USER_TIERS: UserTierLimits = {
    free: {
        maxRequests: 100,
        windowSeconds: 3600, // 100 per hour
        keyPrefix: "rl:user:free",
    },
    basic: {
        maxRequests: 500,
        windowSeconds: 3600, // 500 per hour
        keyPrefix: "rl:user:basic",
    },
    premium: {
        maxRequests: 2000,
        windowSeconds: 3600, // 2000 per hour
        keyPrefix: "rl:user:premium",
    },
    enterprise: {
        maxRequests: 10000,
        windowSeconds: 3600, // 10000 per hour
        keyPrefix: "rl:user:enterprise",
    },
    unlimited: {
        maxRequests: 1000000,
        windowSeconds: 3600, // Effectively unlimited
        keyPrefix: "rl:user:unlimited",
    },
};

// ============================================
// USER RATE LIMITER
// ============================================

export interface UserRateLimiterOptions {
    tiers: Partial<UserTierLimits>;
    defaultTier: keyof UserTierLimits;
    /** Function to get user ID from request */
    getUserId: (req: Request) => string | null;
    /** Function to get user tier from request */
    getUserTier: (req: Request) => keyof UserTierLimits | null;
    /** Fallback to IP if user not authenticated */
    fallbackToIP?: boolean;
    /** IP rate limit config for unauthenticated requests */
    ipConfig?: Partial<RateLimitConfig>;
}

/**
 * Create a user-based rate limiter with tiered limits
 */
export function createUserRateLimiter(options: UserRateLimiterOptions) {
    const tiers = { ...DEFAULT_USER_TIERS, ...options.tiers };
    const ipLimiter = options.ipConfig 
        ? createRateLimiter(options.ipConfig)
        : createRateLimiter({ maxRequests: 60, windowSeconds: 60 });
    
    // Create tier-specific limiters
    const tierLimiters = new Map<keyof UserTierLimits, ReturnType<typeof createRateLimiter>>();
    for (const [tier, config] of Object.entries(tiers)) {
        tierLimiters.set(tier as keyof UserTierLimits, createRateLimiter({
            ...config,
            keyGenerator: (req) => {
                const userId = options.getUserId(req);
                return \`\${config.keyPrefix}:\${userId || req.ip}\`;
            },
        }));
    }

    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = options.getUserId(req);
        
        // If no user, fall back to IP rate limiting
        if (!userId) {
            if (options.fallbackToIP) {
                return ipLimiter(req, res, next);
            }
            return next();
        }

        // Get user's tier
        const tier = options.getUserTier(req) || options.defaultTier;
        const limiter = tierLimiters.get(tier);

        if (!limiter) {
            console.warn(\`[RateLimiter] Unknown tier: \${tier}\`);
            return next();
        }

        // Add tier info to response headers
        res.setHeader("X-RateLimit-Tier", tier);
        
        return limiter(req, res, next);
    };
}

/**
 * Example usage:
 * 
 * const userRateLimiter = createUserRateLimiter({
 *   tiers: DEFAULT_USER_TIERS,
 *   defaultTier: "free",
 *   getUserId: (req) => req.user?.id || null,
 *   getUserTier: (req) => req.user?.subscriptionTier || "free",
 *   fallbackToIP: true,
 * });
 */
`;

// ============================================
// IP-BASED RATE LIMITER TEMPLATE
// ============================================

export const IP_RATE_LIMITER_TEMPLATE = `/**
 * ============================================
 * IP-BASED RATE LIMITER
 * ============================================
 * 
 * Rate limiting based on client IP address.
 * Handles proxies and load balancers correctly.
 */

import { Request, Response, NextFunction } from "express";
import { createRateLimiter, RateLimitConfig } from "./redis-rate-limiter";

// ============================================
// IP EXTRACTION
// ============================================

/**
 * Get client IP address, handling proxies
 */
export function getClientIP(req: Request): string {
    // Check for X-Forwarded-For header (behind proxy)
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
        const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",");
        return ips[0].trim();
    }

    // Check for X-Real-IP header (nginx)
    const realIP = req.headers["x-real-ip"];
    if (realIP) {
        return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    // Check for CF-Connecting-IP (Cloudflare)
    const cfIP = req.headers["cf-connecting-ip"];
    if (cfIP) {
        return Array.isArray(cfIP) ? cfIP[0] : cfIP;
    }

    // Fall back to req.ip or socket
    return req.ip || req.socket?.remoteAddress || "unknown";
}

// ============================================
// IP WHITELIST/BLACKLIST
// ============================================

export interface IPConfig {
    /** IPs to whitelist (bypass rate limiting) */
    whitelist: string[];
    /** IPs to blacklist (always block) */
    blacklist: string[];
    /** CIDR ranges to whitelist */
    whitelistCIDR: string[];
    /** CIDR ranges to blacklist */
    blacklistCIDR: string[];
}

const defaultIPConfig: IPConfig = {
    whitelist: ["127.0.0.1", "::1"],
    blacklist: [],
    whitelistCIDR: [],
    blacklistCIDR: [],
};

/**
 * Check if IP is in a CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split("/");
    if (!bits) return ip === range;

    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    
    return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if IP is whitelisted
 */
export function isWhitelisted(ip: string, config: IPConfig = defaultIPConfig): boolean {
    if (config.whitelist.includes(ip)) return true;
    return config.whitelistCIDR.some(cidr => isIPInCIDR(ip, cidr));
}

/**
 * Check if IP is blacklisted
 */
export function isBlacklisted(ip: string, config: IPConfig = defaultIPConfig): boolean {
    if (config.blacklist.includes(ip)) return true;
    return config.blacklistCIDR.some(cidr => isIPInCIDR(ip, cidr));
}

// ============================================
// IP RATE LIMITER
// ============================================

export interface IPRateLimiterOptions extends Partial<RateLimitConfig> {
    ipConfig?: Partial<IPConfig>;
    /** Trust proxy headers */
    trustProxy?: boolean;
    /** Block blacklisted IPs */
    enforceBlacklist?: boolean;
    /** Skip whitelisted IPs */
    skipWhitelist?: boolean;
}

/**
 * Create an IP-based rate limiter
 */
export function createIPRateLimiter(options: IPRateLimiterOptions = {}) {
    const ipConfig = { ...defaultIPConfig, ...options.ipConfig };
    
    const rateLimiter = createRateLimiter({
        ...options,
        keyPrefix: options.keyPrefix || "rl:ip",
        keyGenerator: (req) => {
            const ip = getClientIP(req);
            return \`\${options.keyPrefix || "rl:ip"}:\${ip}\`;
        },
    });

    return async (req: Request, res: Response, next: NextFunction) => {
        const ip = getClientIP(req);

        // Check blacklist
        if (options.enforceBlacklist !== false && isBlacklisted(ip, ipConfig)) {
            console.warn(\`[RateLimiter] Blacklisted IP blocked: \${ip}\`);
            return res.status(403).json({
                error: "Forbidden",
                message: "Access denied",
            });
        }

        // Check whitelist
        if (options.skipWhitelist !== false && isWhitelisted(ip, ipConfig)) {
            return next();
        }

        // Apply rate limiting
        return rateLimiter(req, res, next);
    };
}

/**
 * Middleware to log and track IP addresses
 */
export function ipTracker() {
    return (req: Request, res: Response, next: NextFunction) => {
        const ip = getClientIP(req);
        
        // Add IP to request for downstream use
        (req as any).clientIP = ip;
        
        // Log for monitoring
        console.log(\`[IP] \${req.method} \${req.path} from \${ip}\`);
        
        next();
    };
}
`;

// ============================================
// RATE LIMIT HEADERS TEMPLATE
// ============================================

export const RATE_LIMIT_HEADERS_TEMPLATE = `/**
 * ============================================
 * RATE LIMIT HEADERS
 * ============================================
 * 
 * Standardized rate limit response headers
 * following RFC 6585 and draft-ietf-httpapi-ratelimit-headers.
 */

import { Response } from "express";

// ============================================
// HEADER NAMES
// ============================================

export const RATE_LIMIT_HEADERS = {
    // Standard headers (draft-ietf-httpapi-ratelimit-headers)
    LIMIT: "RateLimit-Limit",
    REMAINING: "RateLimit-Remaining",
    RESET: "RateLimit-Reset",
    POLICY: "RateLimit-Policy",

    // Legacy headers (still widely used)
    X_LIMIT: "X-RateLimit-Limit",
    X_REMAINING: "X-RateLimit-Remaining",
    X_RESET: "X-RateLimit-Reset",

    // Retry header (RFC 6585)
    RETRY_AFTER: "Retry-After",
} as const;

// ============================================
// HEADER HELPERS
// ============================================

export interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetAt: Date | number;
    window?: number;
    policy?: string;
}

/**
 * Set standard rate limit headers on response
 */
export function setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
    const resetTimestamp = info.resetAt instanceof Date
        ? Math.floor(info.resetAt.getTime() / 1000)
        : info.resetAt;

    // Standard headers
    res.setHeader(RATE_LIMIT_HEADERS.LIMIT, info.limit);
    res.setHeader(RATE_LIMIT_HEADERS.REMAINING, info.remaining);
    res.setHeader(RATE_LIMIT_HEADERS.RESET, resetTimestamp);

    // Legacy X- headers for compatibility
    res.setHeader(RATE_LIMIT_HEADERS.X_LIMIT, info.limit);
    res.setHeader(RATE_LIMIT_HEADERS.X_REMAINING, info.remaining);
    res.setHeader(RATE_LIMIT_HEADERS.X_RESET, resetTimestamp);

    // Policy header if window is provided
    if (info.window) {
        const policy = \`\${info.limit};w=\${info.window}\`;
        res.setHeader(RATE_LIMIT_HEADERS.POLICY, policy);
    }
}

/**
 * Set retry-after header for 429 responses
 */
export function setRetryAfterHeader(res: Response, seconds: number): void {
    res.setHeader(RATE_LIMIT_HEADERS.RETRY_AFTER, seconds);
}

/**
 * Build a rate limit policy string
 * Format: {limit};w={window}[;burst={burst}][;comment="{comment}"]
 */
export function buildPolicyString(options: {
    limit: number;
    window: number;
    burst?: number;
    comment?: string;
}): string {
    let policy = \`\${options.limit};w=\${options.window}\`;
    
    if (options.burst) {
        policy += \`;burst=\${options.burst}\`;
    }
    
    if (options.comment) {
        policy += \`;comment="\${options.comment}"\`;
    }
    
    return policy;
}

/**
 * Parse rate limit headers from a response
 */
export function parseRateLimitHeaders(headers: Record<string, string | undefined>): RateLimitInfo | null {
    const limit = parseInt(headers[RATE_LIMIT_HEADERS.LIMIT] || headers[RATE_LIMIT_HEADERS.X_LIMIT] || "0");
    const remaining = parseInt(headers[RATE_LIMIT_HEADERS.REMAINING] || headers[RATE_LIMIT_HEADERS.X_REMAINING] || "0");
    const reset = parseInt(headers[RATE_LIMIT_HEADERS.RESET] || headers[RATE_LIMIT_HEADERS.X_RESET] || "0");

    if (limit === 0) {
        return null;
    }

    return {
        limit,
        remaining,
        resetAt: new Date(reset * 1000),
    };
}

/**
 * Calculate optimal retry time
 */
export function calculateRetryTime(resetAt: Date | number, jitter: boolean = true): number {
    const resetTime = resetAt instanceof Date ? resetAt.getTime() : resetAt * 1000;
    const now = Date.now();
    const baseDelay = Math.max(0, resetTime - now);

    if (jitter) {
        // Add 0-10% jitter to prevent thundering herd
        const jitterAmount = baseDelay * Math.random() * 0.1;
        return Math.ceil((baseDelay + jitterAmount) / 1000);
    }

    return Math.ceil(baseDelay / 1000);
}

// ============================================
// MIDDLEWARE HELPERS
// ============================================

/**
 * Middleware to ensure rate limit headers are always set
 */
export function ensureRateLimitHeaders(defaultLimit: number = 1000) {
    return (req: any, res: any, next: any) => {
        // Set default headers if not already set
        const originalEnd = res.end.bind(res);
        
        res.end = function(...args: any[]) {
            if (!res.getHeader(RATE_LIMIT_HEADERS.LIMIT)) {
                setRateLimitHeaders(res, {
                    limit: defaultLimit,
                    remaining: defaultLimit,
                    resetAt: Date.now() + 60000,
                    window: 60,
                });
            }
            return originalEnd(...args);
        };
        
        next();
    };
}
`;

// ============================================
// EXPORTS
// ============================================

export const RATE_LIMIT_TEMPLATE_SETS = {
    redis: {
        name: "Redis Rate Limiter",
        template: REDIS_RATE_LIMITER_TEMPLATE,
        description: "Distributed rate limiting with Redis",
    },
    endpoint: {
        name: "Per-Endpoint Rate Limiter",
        template: ENDPOINT_RATE_LIMITER_TEMPLATE,
        description: "Different limits for different endpoints",
    },
    user: {
        name: "User-Based Rate Limiter",
        template: USER_RATE_LIMITER_TEMPLATE,
        description: "Tiered rate limiting based on user subscription",
    },
    ip: {
        name: "IP-Based Rate Limiter",
        template: IP_RATE_LIMITER_TEMPLATE,
        description: "Rate limiting based on client IP with whitelist/blacklist",
    },
    headers: {
        name: "Rate Limit Headers",
        template: RATE_LIMIT_HEADERS_TEMPLATE,
        description: "Standardized rate limit response headers",
    },
};

export function getRateLimitTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        redis: REDIS_RATE_LIMITER_TEMPLATE,
        endpoint: ENDPOINT_RATE_LIMITER_TEMPLATE,
        user: USER_RATE_LIMITER_TEMPLATE,
        ip: IP_RATE_LIMITER_TEMPLATE,
        headers: RATE_LIMIT_HEADERS_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableRateLimitTypes(): string[] {
    return ["redis", "endpoint", "user", "ip", "headers"];
}
