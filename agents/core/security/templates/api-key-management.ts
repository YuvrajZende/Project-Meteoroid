/**
 * ============================================
 * API KEY MANAGEMENT TEMPLATES
 * ============================================
 * 
 * Complete API key lifecycle management including
 * generation, validation, rotation, scoping, and analytics.
 */

// ============================================
// API KEY MANAGER TEMPLATE
// ============================================

export const API_KEY_MANAGER_TEMPLATE = `/**
 * ============================================
 * API KEY MANAGER
 * ============================================
 * 
 * Secure API key management with:
 * - Key generation and hashing
 * - Scope-based permissions
 * - Rate limiting per key
 * - Usage analytics
 */

import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

// ============================================
// TYPES
// ============================================

export interface APIKey {
    id: string;
    name: string;
    keyHash: string;           // Hashed key (stored)
    keyPrefix: string;         // First 8 chars for identification
    ownerId: string;           // User/org that owns this key
    scopes: string[];          // Allowed operations
    rateLimit: RateLimitConfig;
    metadata: Record<string, unknown>;
    expiresAt?: Date;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
}

export interface RateLimitConfig {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
}

export interface APIKeyCreateInput {
    name: string;
    ownerId: string;
    scopes?: string[];
    rateLimit?: Partial<RateLimitConfig>;
    expiresIn?: number; // Days until expiration
    metadata?: Record<string, unknown>;
}

export interface APIKeyValidation {
    isValid: boolean;
    key?: APIKey;
    error?: string;
    remainingRequests?: {
        minute: number;
        hour: number;
        day: number;
    };
}

// ============================================
// CONFIGURATION
// ============================================

const KEY_PREFIX = process.env.API_KEY_PREFIX || "sk";
const KEY_LENGTH = 32;
const HASH_ALGORITHM = "sha256";

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
};

const DEFAULT_SCOPES = ["read"];

// ============================================
// KEY STORAGE (Replace with database in production)
// ============================================

const keyStore = new Map<string, APIKey>();
const usageStore = new Map<string, { minute: number; hour: number; day: number; timestamps: number[] }>();

// ============================================
// KEY GENERATION
// ============================================

/**
 * Generate a secure API key
 * Returns the full key (show once) and the key record
 */
export function generateAPIKey(input: APIKeyCreateInput): { key: string; record: APIKey } {
    // Generate random key
    const randomBytes = crypto.randomBytes(KEY_LENGTH);
    const keyValue = randomBytes.toString("base64url");
    const fullKey = \`\${KEY_PREFIX}_\${keyValue}\`;
    
    // Hash the key for storage
    const keyHash = hashKey(fullKey);
    const keyPrefix = fullKey.substring(0, 8);
    
    // Create expiration if specified
    let expiresAt: Date | undefined;
    if (input.expiresIn) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + input.expiresIn);
    }

    // Create record
    const record: APIKey = {
        id: crypto.randomUUID(),
        name: input.name,
        keyHash,
        keyPrefix,
        ownerId: input.ownerId,
        scopes: input.scopes || DEFAULT_SCOPES,
        rateLimit: { ...DEFAULT_RATE_LIMIT, ...input.rateLimit },
        metadata: input.metadata || {},
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
    };

    // Store (in production, save to database)
    keyStore.set(keyHash, record);

    return { key: fullKey, record };
}

/**
 * Hash an API key for secure storage
 */
function hashKey(key: string): string {
    return crypto.createHash(HASH_ALGORITHM).update(key).digest("hex");
}

// ============================================
// KEY VALIDATION
// ============================================

/**
 * Validate an API key
 */
export async function validateAPIKey(key: string): Promise<APIKeyValidation> {
    // Check format
    if (!key.startsWith(\`\${KEY_PREFIX}_\`)) {
        return { isValid: false, error: "Invalid key format" };
    }

    // Hash and lookup
    const keyHash = hashKey(key);
    const record = keyStore.get(keyHash);

    if (!record) {
        return { isValid: false, error: "Invalid API key" };
    }

    // Check if active
    if (!record.isActive) {
        return { isValid: false, error: "API key is deactivated" };
    }

    // Check expiration
    if (record.expiresAt && new Date() > record.expiresAt) {
        return { isValid: false, error: "API key has expired" };
    }

    // Check rate limits
    const usage = getUsage(keyHash);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    // Clean old timestamps
    usage.timestamps = usage.timestamps.filter(t => t > oneDayAgo);

    // Count requests in each window
    const minuteCount = usage.timestamps.filter(t => t > oneMinuteAgo).length;
    const hourCount = usage.timestamps.filter(t => t > oneHourAgo).length;
    const dayCount = usage.timestamps.length;

    // Check limits
    if (minuteCount >= record.rateLimit.requestsPerMinute) {
        return { 
            isValid: false, 
            error: "Rate limit exceeded (per minute)",
            remainingRequests: {
                minute: 0,
                hour: record.rateLimit.requestsPerHour - hourCount,
                day: record.rateLimit.requestsPerDay - dayCount,
            },
        };
    }
    if (hourCount >= record.rateLimit.requestsPerHour) {
        return { 
            isValid: false, 
            error: "Rate limit exceeded (per hour)",
            remainingRequests: {
                minute: 0,
                hour: 0,
                day: record.rateLimit.requestsPerDay - dayCount,
            },
        };
    }
    if (dayCount >= record.rateLimit.requestsPerDay) {
        return { 
            isValid: false, 
            error: "Rate limit exceeded (per day)",
            remainingRequests: { minute: 0, hour: 0, day: 0 },
        };
    }

    // Record usage
    usage.timestamps.push(now);
    usageStore.set(keyHash, usage);

    // Update last used
    record.lastUsedAt = new Date();
    keyStore.set(keyHash, record);

    return {
        isValid: true,
        key: record,
        remainingRequests: {
            minute: record.rateLimit.requestsPerMinute - minuteCount - 1,
            hour: record.rateLimit.requestsPerHour - hourCount - 1,
            day: record.rateLimit.requestsPerDay - dayCount - 1,
        },
    };
}

function getUsage(keyHash: string): { minute: number; hour: number; day: number; timestamps: number[] } {
    return usageStore.get(keyHash) || { minute: 0, hour: 0, day: 0, timestamps: [] };
}

// ============================================
// KEY MANAGEMENT
// ============================================

/**
 * Revoke an API key
 */
export function revokeKey(keyId: string): boolean {
    for (const [hash, record] of keyStore.entries()) {
        if (record.id === keyId) {
            record.isActive = false;
            record.updatedAt = new Date();
            keyStore.set(hash, record);
            return true;
        }
    }
    return false;
}

/**
 * List keys for an owner
 */
export function listKeys(ownerId: string): Omit<APIKey, "keyHash">[] {
    const keys: Omit<APIKey, "keyHash">[] = [];
    for (const record of keyStore.values()) {
        if (record.ownerId === ownerId) {
            const { keyHash, ...rest } = record;
            keys.push(rest);
        }
    }
    return keys;
}

/**
 * Update key scopes
 */
export function updateKeyScopes(keyId: string, scopes: string[]): boolean {
    for (const [hash, record] of keyStore.entries()) {
        if (record.id === keyId) {
            record.scopes = scopes;
            record.updatedAt = new Date();
            keyStore.set(hash, record);
            return true;
        }
    }
    return false;
}

/**
 * Update rate limits
 */
export function updateKeyRateLimit(keyId: string, rateLimit: Partial<RateLimitConfig>): boolean {
    for (const [hash, record] of keyStore.entries()) {
        if (record.id === keyId) {
            record.rateLimit = { ...record.rateLimit, ...rateLimit };
            record.updatedAt = new Date();
            keyStore.set(hash, record);
            return true;
        }
    }
    return false;
}
`;

// ============================================
// KEY ROTATION TEMPLATE
// ============================================

export const KEY_ROTATION_TEMPLATE = `/**
 * ============================================
 * API KEY ROTATION
 * ============================================
 * 
 * Secure key rotation with grace period
 * for seamless key transitions.
 */

import { generateAPIKey, APIKey, APIKeyCreateInput } from "./api-key-manager";

// ============================================
// TYPES
// ============================================

export interface RotationResult {
    newKey: string;
    newKeyRecord: APIKey;
    oldKeyExpiresAt: Date;
}

export interface RotationPolicy {
    /** Days between automatic rotations */
    rotationIntervalDays: number;
    /** Grace period for old key after rotation */
    gracePeriodDays: number;
    /** Notify before rotation (days) */
    notifyBeforeDays: number;
    /** Auto-rotate expired keys */
    autoRotate: boolean;
}

const defaultPolicy: RotationPolicy = {
    rotationIntervalDays: 90,
    gracePeriodDays: 7,
    notifyBeforeDays: 14,
    autoRotate: false,
};

// ============================================
// ROTATION TRACKING
// ============================================

interface RotationRecord {
    keyId: string;
    previousKeyId?: string;
    rotatedAt: Date;
    expiresAt: Date;
    reason: "scheduled" | "manual" | "compromised";
}

const rotationHistory: RotationRecord[] = [];

// ============================================
// ROTATION FUNCTIONS
// ============================================

/**
 * Rotate an API key
 */
export function rotateKey(
    currentKeyId: string,
    input: APIKeyCreateInput,
    gracePeriodDays: number = 7,
    reason: RotationRecord["reason"] = "manual"
): RotationResult | null {
    // Generate new key with same properties
    const { key: newKey, record: newKeyRecord } = generateAPIKey(input);

    // Set old key expiration
    const oldKeyExpiresAt = new Date();
    oldKeyExpiresAt.setDate(oldKeyExpiresAt.getDate() + gracePeriodDays);

    // Record rotation
    rotationHistory.push({
        keyId: newKeyRecord.id,
        previousKeyId: currentKeyId,
        rotatedAt: new Date(),
        expiresAt: oldKeyExpiresAt,
        reason,
    });

    console.log(\`[KeyRotation] Rotated key \${currentKeyId} -> \${newKeyRecord.id}, old key expires in \${gracePeriodDays} days\`);

    return {
        newKey,
        newKeyRecord,
        oldKeyExpiresAt,
    };
}

/**
 * Emergency rotation (immediate revocation)
 */
export function emergencyRotate(
    currentKeyId: string,
    input: APIKeyCreateInput
): RotationResult | null {
    // Immediately revoke old key
    // revokeKey(currentKeyId); // Import from api-key-manager

    // Generate new key
    const { key: newKey, record: newKeyRecord } = generateAPIKey(input);

    // Record rotation
    rotationHistory.push({
        keyId: newKeyRecord.id,
        previousKeyId: currentKeyId,
        rotatedAt: new Date(),
        expiresAt: new Date(), // Immediate
        reason: "compromised",
    });

    console.warn(\`[KeyRotation] EMERGENCY rotation for key \${currentKeyId}\`);

    return {
        newKey,
        newKeyRecord,
        oldKeyExpiresAt: new Date(),
    };
}

/**
 * Check if key needs rotation
 */
export function needsRotation(
    createdAt: Date,
    policy: RotationPolicy = defaultPolicy
): { needsRotation: boolean; daysUntilRotation: number } {
    const ageMs = Date.now() - createdAt.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    const daysUntilRotation = policy.rotationIntervalDays - ageDays;

    return {
        needsRotation: daysUntilRotation <= 0,
        daysUntilRotation: Math.max(0, Math.floor(daysUntilRotation)),
    };
}

/**
 * Get keys approaching rotation
 */
export function getKeysNeedingRotation(
    keys: APIKey[],
    policy: RotationPolicy = defaultPolicy
): { key: APIKey; daysUntilRotation: number }[] {
    return keys
        .map(key => ({
            key,
            ...needsRotation(key.createdAt, policy),
        }))
        .filter(r => r.daysUntilRotation <= policy.notifyBeforeDays)
        .sort((a, b) => a.daysUntilRotation - b.daysUntilRotation);
}

/**
 * Get rotation history
 */
export function getRotationHistory(keyId?: string): RotationRecord[] {
    if (keyId) {
        return rotationHistory.filter(
            r => r.keyId === keyId || r.previousKeyId === keyId
        );
    }
    return rotationHistory;
}
`;

// ============================================
// SCOPE MANAGEMENT TEMPLATE
// ============================================

export const SCOPE_MANAGEMENT_TEMPLATE = `/**
 * ============================================
 * API KEY SCOPE MANAGEMENT
 * ============================================
 * 
 * Fine-grained permission control using scopes.
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// SCOPE DEFINITIONS
// ============================================

export interface ScopeDefinition {
    name: string;
    description: string;
    resources: string[];
    actions: string[];
    parent?: string; // Parent scope (inherits permissions)
}

/**
 * Standard API scopes
 */
export const STANDARD_SCOPES: ScopeDefinition[] = [
    // Read scopes
    {
        name: "read",
        description: "Read access to all resources",
        resources: ["*"],
        actions: ["read", "list"],
    },
    {
        name: "read:users",
        description: "Read user data",
        resources: ["users"],
        actions: ["read", "list"],
    },
    {
        name: "read:documents",
        description: "Read documents",
        resources: ["documents"],
        actions: ["read", "list"],
    },

    // Write scopes
    {
        name: "write",
        description: "Write access to all resources",
        resources: ["*"],
        actions: ["create", "update"],
        parent: "read",
    },
    {
        name: "write:users",
        description: "Create and update users",
        resources: ["users"],
        actions: ["create", "update"],
        parent: "read:users",
    },
    {
        name: "write:documents",
        description: "Create and update documents",
        resources: ["documents"],
        actions: ["create", "update"],
        parent: "read:documents",
    },

    // Delete scopes
    {
        name: "delete",
        description: "Delete access to all resources",
        resources: ["*"],
        actions: ["delete"],
        parent: "write",
    },
    {
        name: "delete:users",
        description: "Delete users",
        resources: ["users"],
        actions: ["delete"],
        parent: "write:users",
    },

    // Admin scopes
    {
        name: "admin",
        description: "Full administrative access",
        resources: ["*"],
        actions: ["*"],
    },
    {
        name: "admin:keys",
        description: "Manage API keys",
        resources: ["api-keys"],
        actions: ["*"],
    },
];

// Create scope lookup map
const scopeMap = new Map<string, ScopeDefinition>();
for (const scope of STANDARD_SCOPES) {
    scopeMap.set(scope.name, scope);
}

// ============================================
// SCOPE RESOLUTION
// ============================================

/**
 * Get all effective scopes including inherited
 */
export function resolveScopes(scopes: string[]): Set<string> {
    const resolved = new Set<string>();

    function addScope(scopeName: string): void {
        if (resolved.has(scopeName)) return;
        
        resolved.add(scopeName);
        
        const scope = scopeMap.get(scopeName);
        if (scope?.parent) {
            addScope(scope.parent);
        }
    }

    for (const scope of scopes) {
        addScope(scope);
    }

    return resolved;
}

/**
 * Check if scopes allow an action on a resource
 */
export function hasPermission(
    scopes: string[],
    resource: string,
    action: string
): boolean {
    const resolved = resolveScopes(scopes);

    for (const scopeName of resolved) {
        const scope = scopeMap.get(scopeName);
        if (!scope) continue;

        const resourceMatch = 
            scope.resources.includes("*") || 
            scope.resources.includes(resource);

        const actionMatch = 
            scope.actions.includes("*") || 
            scope.actions.includes(action);

        if (resourceMatch && actionMatch) {
            return true;
        }
    }

    return false;
}

/**
 * Get all permissions for a set of scopes
 */
export function getAllPermissions(scopes: string[]): { resource: string; action: string }[] {
    const resolved = resolveScopes(scopes);
    const permissions: { resource: string; action: string }[] = [];

    for (const scopeName of resolved) {
        const scope = scopeMap.get(scopeName);
        if (!scope) continue;

        for (const resource of scope.resources) {
            for (const action of scope.actions) {
                permissions.push({ resource, action });
            }
        }
    }

    return permissions;
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Require scope middleware
 */
export function requireScope(requiredScope: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const apiKey = (req as any).apiKey;
        
        if (!apiKey) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "API key required",
            });
        }

        const hasScope = resolveScopes(apiKey.scopes).has(requiredScope);
        
        if (!hasScope) {
            return res.status(403).json({
                error: "Forbidden",
                message: \`Required scope: \${requiredScope}\`,
                yourScopes: apiKey.scopes,
            });
        }

        next();
    };
}

/**
 * Require permission middleware
 */
export function requirePermission(resource: string, action: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const apiKey = (req as any).apiKey;
        
        if (!apiKey) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "API key required",
            });
        }

        if (!hasPermission(apiKey.scopes, resource, action)) {
            return res.status(403).json({
                error: "Forbidden",
                message: \`Required permission: \${action} on \${resource}\`,
                yourScopes: apiKey.scopes,
            });
        }

        next();
    };
}
`;

// ============================================
// API KEY ANALYTICS TEMPLATE
// ============================================

export const API_KEY_ANALYTICS_TEMPLATE = `/**
 * ============================================
 * API KEY ANALYTICS
 * ============================================
 * 
 * Track and analyze API key usage patterns.
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// TYPES
// ============================================

export interface APIKeyUsageEvent {
    keyId: string;
    timestamp: Date;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    requestSize: number;
    responseSize: number;
    userAgent?: string;
    ip?: string;
}

export interface APIKeyStats {
    keyId: string;
    period: "hour" | "day" | "week" | "month";
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    topEndpoints: { endpoint: string; count: number }[];
    errorRate: number;
    bandwidthIn: number;
    bandwidthOut: number;
}

export interface APIKeyHealthScore {
    keyId: string;
    score: number; // 0-100
    factors: {
        errorRate: number;
        latency: number;
        rateLimit: number;
        usage: number;
    };
    recommendations: string[];
}

// ============================================
// ANALYTICS STORAGE
// ============================================

const usageEvents: APIKeyUsageEvent[] = [];
const MAX_EVENTS = 100000;

// ============================================
// EVENT COLLECTION
// ============================================

/**
 * Record an API key usage event
 */
export function recordUsage(event: APIKeyUsageEvent): void {
    usageEvents.push(event);
    
    // Trim old events
    if (usageEvents.length > MAX_EVENTS) {
        usageEvents.splice(0, usageEvents.length - MAX_EVENTS);
    }
}

/**
 * Analytics middleware
 */
export function analyticsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();
        const apiKey = (req as any).apiKey;
        
        if (!apiKey) {
            return next();
        }

        const requestSize = parseInt(req.headers["content-length"] || "0");

        // Capture response
        const originalEnd = res.end.bind(res);
        let responseSize = 0;

        res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
            if (chunk) {
                responseSize = Buffer.byteLength(chunk);
            }

            // Record event
            recordUsage({
                keyId: apiKey.id,
                timestamp: new Date(),
                endpoint: req.path,
                method: req.method,
                statusCode: res.statusCode,
                latencyMs: Date.now() - startTime,
                requestSize,
                responseSize,
                userAgent: req.headers["user-agent"],
                ip: req.ip,
            });

            return originalEnd(chunk, encoding, callback);
        };

        next();
    };
}

// ============================================
// ANALYTICS QUERIES
// ============================================

/**
 * Get usage statistics for a key
 */
export function getKeyStats(
    keyId: string,
    period: APIKeyStats["period"] = "day"
): APIKeyStats {
    const now = Date.now();
    const periodMs = {
        hour: 3600000,
        day: 86400000,
        week: 604800000,
        month: 2592000000,
    };

    const cutoff = now - periodMs[period];
    const events = usageEvents.filter(
        e => e.keyId === keyId && e.timestamp.getTime() >= cutoff
    );

    const totalRequests = events.length;
    const successfulRequests = events.filter(e => e.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const latencies = events.map(e => e.latencyMs).sort((a, b) => a - b);
    const averageLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)] || 0;

    // Top endpoints
    const endpointCounts = new Map<string, number>();
    for (const event of events) {
        endpointCounts.set(
            event.endpoint,
            (endpointCounts.get(event.endpoint) || 0) + 1
        );
    }
    const topEndpoints = [...endpointCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count }));

    // Bandwidth
    const bandwidthIn = events.reduce((sum, e) => sum + e.requestSize, 0);
    const bandwidthOut = events.reduce((sum, e) => sum + e.responseSize, 0);

    return {
        keyId,
        period,
        totalRequests,
        successfulRequests,
        failedRequests,
        averageLatency,
        p95Latency,
        p99Latency,
        topEndpoints,
        errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0,
        bandwidthIn,
        bandwidthOut,
    };
}

/**
 * Calculate health score for a key
 */
export function getKeyHealthScore(keyId: string): APIKeyHealthScore {
    const stats = getKeyStats(keyId, "day");
    const recommendations: string[] = [];

    // Error rate factor (lower is better)
    const errorRateFactor = Math.max(0, 100 - stats.errorRate * 200);
    if (stats.errorRate > 0.1) {
        recommendations.push("High error rate detected. Review error responses.");
    }

    // Latency factor
    const latencyFactor = stats.averageLatency < 100 
        ? 100 
        : stats.averageLatency < 500 
            ? 80 
            : stats.averageLatency < 1000 
                ? 60 
                : 40;
    if (stats.averageLatency > 500) {
        recommendations.push("High latency detected. Consider caching or optimization.");
    }

    // Rate limit factor (based on remaining capacity)
    const rateLimitFactor = 80; // Would need actual rate limit data

    // Usage factor (regular usage is healthy)
    const usageFactor = stats.totalRequests > 0 ? 100 : 50;
    if (stats.totalRequests === 0) {
        recommendations.push("No recent usage. Verify key is still needed.");
    }

    // Calculate overall score
    const score = Math.round(
        (errorRateFactor * 0.35) +
        (latencyFactor * 0.25) +
        (rateLimitFactor * 0.2) +
        (usageFactor * 0.2)
    );

    return {
        keyId,
        score,
        factors: {
            errorRate: errorRateFactor,
            latency: latencyFactor,
            rateLimit: rateLimitFactor,
            usage: usageFactor,
        },
        recommendations,
    };
}

/**
 * Get usage timeline
 */
export function getUsageTimeline(
    keyId: string,
    bucketMinutes: number = 60,
    hours: number = 24
): { time: Date; requests: number; errors: number }[] {
    const now = Date.now();
    const cutoff = now - hours * 3600000;
    const bucketMs = bucketMinutes * 60000;

    const events = usageEvents.filter(
        e => e.keyId === keyId && e.timestamp.getTime() >= cutoff
    );

    const buckets = new Map<number, { requests: number; errors: number }>();

    for (const event of events) {
        const bucketKey = Math.floor(event.timestamp.getTime() / bucketMs) * bucketMs;
        const bucket = buckets.get(bucketKey) || { requests: 0, errors: 0 };
        bucket.requests++;
        if (event.statusCode >= 400) {
            bucket.errors++;
        }
        buckets.set(bucketKey, bucket);
    }

    return [...buckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([time, data]) => ({
            time: new Date(time),
            requests: data.requests,
            errors: data.errors,
        }));
}

/**
 * Get top users by API key
 */
export function getTopKeys(
    period: APIKeyStats["period"] = "day",
    limit: number = 10
): { keyId: string; requests: number; errorRate: number }[] {
    const now = Date.now();
    const periodMs = {
        hour: 3600000,
        day: 86400000,
        week: 604800000,
        month: 2592000000,
    };

    const cutoff = now - periodMs[period];
    
    const keyStats = new Map<string, { requests: number; errors: number }>();
    
    for (const event of usageEvents) {
        if (event.timestamp.getTime() < cutoff) continue;
        
        const stats = keyStats.get(event.keyId) || { requests: 0, errors: 0 };
        stats.requests++;
        if (event.statusCode >= 400) {
            stats.errors++;
        }
        keyStats.set(event.keyId, stats);
    }

    return [...keyStats.entries()]
        .map(([keyId, stats]) => ({
            keyId,
            requests: stats.requests,
            errorRate: stats.requests > 0 ? stats.errors / stats.requests : 0,
        }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, limit);
}
`;

// ============================================
// EXPORTS
// ============================================

export const API_KEY_TEMPLATE_SETS = {
    manager: {
        name: "API Key Manager",
        template: API_KEY_MANAGER_TEMPLATE,
        description: "Core API key management functionality",
    },
    rotation: {
        name: "Key Rotation",
        template: KEY_ROTATION_TEMPLATE,
        description: "Secure key rotation with grace periods",
    },
    scopes: {
        name: "Scope Management",
        template: SCOPE_MANAGEMENT_TEMPLATE,
        description: "Fine-grained permission control",
    },
    analytics: {
        name: "API Key Analytics",
        template: API_KEY_ANALYTICS_TEMPLATE,
        description: "Usage tracking and analytics",
    },
};

export function getAPIKeyTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        manager: API_KEY_MANAGER_TEMPLATE,
        rotation: KEY_ROTATION_TEMPLATE,
        scopes: SCOPE_MANAGEMENT_TEMPLATE,
        analytics: API_KEY_ANALYTICS_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableAPIKeyTypes(): string[] {
    return ["manager", "rotation", "scopes", "analytics"];
}
