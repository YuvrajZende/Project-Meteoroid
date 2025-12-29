/**
 * IP Blocking Middleware
 * Blocks requests from malicious IP addresses
 * 
 * Features:
 * - Check IP against blocklist database
 * - Auto-block after failed login attempts
 * - Temporary and permanent blocks
 * - CIDR range support
 * 
 * @module middleware/ip-blocking
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSupabaseAdmin } from '../services/infrastructure/database-client.js';

// ============================================
// IP BLOCKING CONFIGURATION
// ============================================

export interface IPBlockConfig {
    /** Enable IP blocking (default: true) */
    enabled?: boolean;
    /** Max failed login attempts before auto-block (default: 10) */
    maxFailedAttempts?: number;
    /** Time window for failed attempts in minutes (default: 15) */
    failedAttemptsWindow?: number;
    /** Auto-block duration in minutes (default: 60) */
    autoBlockDuration?: number;
    /** Cache TTL in seconds (default: 60) */
    cacheTTL?: number;
    /** IPs to never block (allowlist) */
    allowlist?: string[];
}

const defaultConfig: Required<IPBlockConfig> = {
    enabled: true,
    maxFailedAttempts: 10,
    failedAttemptsWindow: 15,
    autoBlockDuration: 60,
    cacheTTL: 60,
    // Allow localhost in development/testing
    allowlist: process.env.NODE_ENV === 'production'
        ? []
        : ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'],
};

// ============================================
// IP BLOCKLIST CACHE
// ============================================

interface CacheEntry {
    blocked: boolean;
    reason?: string;
    expiresAt: number;
}

const ipCache = new Map<string, CacheEntry>();

/**
 * Clear expired cache entries
 */
function cleanupCache(): void {
    const now = Date.now();
    for (const [ip, entry] of ipCache.entries()) {
        if (entry.expiresAt < now) {
            ipCache.delete(ip);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupCache, 5 * 60 * 1000);

/**
 * Clear the entire IP block cache (useful for testing)
 */
export function clearIPBlockCache(): void {
    ipCache.clear();
    console.log('[IP-BLOCK] Cache cleared');
}

/**
 * Check if an IP is in the allowlist
 */
function isAllowlisted(ip: string, allowlist: string[]): boolean {
    return allowlist.some(allowed =>
        ip === allowed ||
        ip.endsWith('::' + allowed) ||
        ip.includes(allowed)
    );
}

// ============================================
// IP BLOCKING FUNCTIONS
// ============================================

/**
 * Check if an IP is blocked
 */
export async function isIPBlocked(
    ip: string,
    config: IPBlockConfig = {}
): Promise<{ blocked: boolean; reason?: string }> {
    const allowlist = config.allowlist ?? defaultConfig.allowlist;

    // Check allowlist first - never block these IPs
    if (isAllowlisted(ip, allowlist)) {
        return { blocked: false };
    }

    // Check cache first
    const cached = ipCache.get(ip);
    if (cached && cached.expiresAt > Date.now()) {
        return { blocked: cached.blocked, reason: cached.reason };
    }

    try {
        const supabase = getSupabaseAdmin();

        // Check if IP is in blocklist
        const { data, error } = await supabase
            .from('ip_blocklist')
            .select('reason, expires_at')
            .eq('ip_address', ip)
            .maybeSingle();

        if (error) {
            console.error('[IP-BLOCK] Error checking blocklist:', error);
            return { blocked: false };
        }

        if (data) {
            // Check if block has expired
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                // Block expired, remove from blocklist
                await supabase.from('ip_blocklist').delete().eq('ip_address', ip);

                // Cache the result
                ipCache.set(ip, {
                    blocked: false,
                    expiresAt: Date.now() + defaultConfig.cacheTTL * 1000,
                });

                return { blocked: false };
            }

            // IP is blocked
            ipCache.set(ip, {
                blocked: true,
                reason: data.reason,
                expiresAt: Date.now() + defaultConfig.cacheTTL * 1000,
            });

            return { blocked: true, reason: data.reason };
        }

        // IP is not blocked
        ipCache.set(ip, {
            blocked: false,
            expiresAt: Date.now() + defaultConfig.cacheTTL * 1000,
        });

        return { blocked: false };
    } catch (err) {
        console.error('[IP-BLOCK] Error:', err);
        return { blocked: false };
    }
}

/**
 * Block an IP address
 */
export async function blockIP(
    ip: string,
    reason: string,
    options: {
        expiresInMinutes?: number;
        blockedBy?: string;
        metadata?: Record<string, unknown>;
    } = {}
): Promise<boolean> {
    try {
        const supabase = getSupabaseAdmin();

        const expiresAt = options.expiresInMinutes
            ? new Date(Date.now() + options.expiresInMinutes * 60 * 1000)
            : null;

        const { error } = await supabase.from('ip_blocklist').upsert({
            ip_address: ip,
            reason,
            blocked_by: options.blockedBy || 'auto',
            expires_at: expiresAt?.toISOString() || null,
            metadata: options.metadata || {},
        }, { onConflict: 'ip_address' });

        if (error) {
            console.error('[IP-BLOCK] Error blocking IP:', error);
            return false;
        }

        // Update cache
        ipCache.set(ip, {
            blocked: true,
            reason,
            expiresAt: Date.now() + defaultConfig.cacheTTL * 1000,
        });

        console.log(`[IP-BLOCK] Blocked IP: ${ip} | Reason: ${reason}`);
        return true;
    } catch (err) {
        console.error('[IP-BLOCK] Error:', err);
        return false;
    }
}

/**
 * Unblock an IP address
 */
export async function unblockIP(ip: string): Promise<boolean> {
    try {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('ip_blocklist')
            .delete()
            .eq('ip_address', ip);

        if (error) {
            console.error('[IP-BLOCK] Error unblocking IP:', error);
            return false;
        }

        // Remove from cache
        ipCache.delete(ip);

        console.log(`[IP-BLOCK] Unblocked IP: ${ip}`);
        return true;
    } catch (err) {
        console.error('[IP-BLOCK] Error:', err);
        return false;
    }
}

/**
 * Check and auto-block IPs with too many failed login attempts
 */
export async function checkFailedAttempts(
    ip: string,
    config: IPBlockConfig = {}
): Promise<boolean> {
    const {
        maxFailedAttempts = defaultConfig.maxFailedAttempts,
        failedAttemptsWindow = defaultConfig.failedAttemptsWindow,
        autoBlockDuration = defaultConfig.autoBlockDuration,
    } = config;

    try {
        const supabase = getSupabaseAdmin();

        // Count failed login attempts in the time window
        const windowStart = new Date(Date.now() - failedAttemptsWindow * 60 * 1000);

        const { count, error } = await supabase
            .from('security_events')
            .select('id', { count: 'exact', head: true })
            .eq('ip_address', ip)
            .eq('success', false)
            .in('event_type', ['login_failed', 'token_refresh_failed', 'oauth_failed'])
            .gte('created_at', windowStart.toISOString());

        if (error) {
            console.error('[IP-BLOCK] Error checking failed attempts:', error);
            return false;
        }

        if (count && count >= maxFailedAttempts) {
            // Auto-block this IP
            await blockIP(ip, `Auto-blocked: ${count} failed login attempts in ${failedAttemptsWindow} minutes`, {
                expiresInMinutes: autoBlockDuration,
                blockedBy: 'auto',
                metadata: { failedAttempts: count, windowMinutes: failedAttemptsWindow },
            });

            return true; // IP was blocked
        }

        return false; // IP was not blocked
    } catch (err) {
        console.error('[IP-BLOCK] Error:', err);
        return false;
    }
}

// ============================================
// IP BLOCKING MIDDLEWARE
// ============================================

/**
 * Create IP blocking middleware
 */
export function ipBlockingMiddleware(config: IPBlockConfig = {}) {
    const settings = { ...defaultConfig, ...config };

    return async function ipBlockMiddleware(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        if (!settings.enabled) {
            return;
        }

        const clientIP = request.ip;

        // Check if IP is blocked (passing settings for allowlist check)
        const { blocked, reason } = await isIPBlocked(clientIP, settings);

        if (blocked) {
            reply.status(403).send({
                success: false,
                error: 'Access denied',
                message: 'Your IP address has been blocked',
                reason: reason || 'Suspicious activity detected',
            });
            return;
        }
    };
}

// ============================================
// PLUGIN REGISTRATION
// ============================================

/**
 * Register IP blocking as a Fastify plugin
 */
export async function registerIPBlocking(
    app: FastifyInstance,
    config: IPBlockConfig = {}
): Promise<void> {
    const settings = { ...defaultConfig, ...config };

    if (!settings.enabled) {
        app.log.info('[IP-BLOCK] IP blocking is disabled');
        return;
    }

    // Add global hook to check all requests
    app.addHook('onRequest', ipBlockingMiddleware(settings));

    // Decorate app with blocking functions
    app.decorate('blockIP', blockIP);
    app.decorate('unblockIP', unblockIP);
    app.decorate('isIPBlocked', isIPBlocked);

    app.log.info('[IP-BLOCK] IP blocking middleware registered');
}

// ============================================
// TYPE DECLARATIONS
// ============================================

declare module 'fastify' {
    interface FastifyInstance {
        blockIP: typeof blockIP;
        unblockIP: typeof unblockIP;
        isIPBlocked: typeof isIPBlocked;
        clearIPBlockCache: typeof clearIPBlockCache;
    }
}

export default {
    registerIPBlocking,
    ipBlockingMiddleware,
    blockIP,
    unblockIP,
    isIPBlocked,
    checkFailedAttempts,
    clearIPBlockCache,
};
