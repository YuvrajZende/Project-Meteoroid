/**
 * Authentication Middleware
 * Uses Supabase for JWT verification and authentication
 * 
 * This middleware provides:
 * - JWT token verification via Supabase
 * - Role-based access control
 * - API key authentication
 * - Request user decoration
 * 
 * @module middleware/auth-middleware
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSupabaseAdmin } from '../infrastructure/database/database-client.js';
import crypto from 'crypto';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
    id: string;
    email: string;
    role: string;
    tokenType: 'access' | 'refresh' | 'api_key';
    claims: Record<string, unknown>;
}

/**
 * API Key validation result
 */
export interface APIKeyValidation {
    valid: boolean;
    userId: string;
    scopes: string[];
    name: string;
}

/**
 * Authentication options
 */
export interface AuthOptions {
    /** Require authentication (default: true) */
    required?: boolean;
    /** Allowed roles (if specified, user must have one of these) */
    roles?: string[];
    /** Required scopes for API key auth */
    scopes?: string[];
    /** Allow API key authentication */
    allowApiKey?: boolean;
    /** Allow refresh token (for refresh endpoint) */
    allowRefreshToken?: boolean;
}

// ============================================
// EXTEND FASTIFY TYPES
// ============================================

declare module 'fastify' {
    interface FastifyRequest {
        authUser?: AuthenticatedUser | null;
        isAuthenticated?: boolean;
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
    }
    return null;
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Create authentication middleware with options
 * Uses Supabase for JWT verification
 */
export function authenticate(options: AuthOptions = {}) {
    const {
        required = true,
        roles = [],
        scopes = [],
        allowApiKey = true,
        // Note: allowRefreshToken is not used with Supabase - the SDK handles refresh tokens
    } = options;

    return async function authMiddleware(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        const supabase = getSupabaseAdmin();
        let authUser: AuthenticatedUser | null = null;

        // Try Bearer token first - use Supabase to verify
        const authHeader = request.headers.authorization;
        const bearerToken = extractBearerToken(authHeader);

        if (bearerToken) {
            try {
                // Use Supabase's getUser to verify the JWT
                const { data: { user }, error } = await supabase.auth.getUser(bearerToken);

                if (user && !error) {
                    // Get user metadata for role
                    const role = (user.app_metadata?.role as string) ||
                        (user.user_metadata?.role as string) ||
                        'user';

                    authUser = {
                        id: user.id,
                        email: user.email || '',
                        role: role,
                        tokenType: 'access',
                        claims: {
                            ...user.user_metadata,
                            ...user.app_metadata,
                            email_confirmed: user.email_confirmed_at !== null,
                        },
                    };
                } else if (required) {
                    reply.status(401).send({
                        success: false,
                        error: 'Authentication failed',
                        message: error?.message || 'Invalid token',
                    });
                    return;
                }
            } catch (err) {
                if (required) {
                    reply.status(401).send({
                        success: false,
                        error: 'Authentication failed',
                        message: err instanceof Error ? err.message : 'Token verification failed',
                    });
                    return;
                }
            }
        }

        // Try API key if Bearer token not present and allowed
        if (!authUser && allowApiKey) {
            const apiKey = request.headers['x-api-key'] as string | undefined;

            if (apiKey) {
                const validation = await validateAPIKey(apiKey);

                if (validation.valid) {
                    // Check scopes
                    if (scopes.length > 0) {
                        const hasScope = scopes.some(s => validation.scopes.includes(s));
                        if (!hasScope) {
                            reply.status(403).send({
                                success: false,
                                error: 'Insufficient scope',
                                message: `Required scopes: ${scopes.join(', ')}`,
                            });
                            return;
                        }
                    }

                    authUser = {
                        id: validation.userId,
                        email: '', // API keys don't have email
                        role: 'api_key',
                        tokenType: 'api_key',
                        claims: { scopes: validation.scopes, name: validation.name },
                    };
                } else if (required && !bearerToken) {
                    reply.status(401).send({
                        success: false,
                        error: 'Invalid API key',
                        message: 'The provided API key is invalid or expired',
                    });
                    return;
                }
            }
        }

        // Check if authentication is required
        if (required && !authUser) {
            reply.status(401).send({
                success: false,
                error: 'Authentication required',
                message: 'Please provide a valid Bearer token or API key',
            });
            return;
        }

        // Check roles
        if (authUser && roles.length > 0) {
            if (!roles.includes(authUser.role)) {
                reply.status(403).send({
                    success: false,
                    error: 'Insufficient permissions',
                    message: `Required role: ${roles.join(' or ')}`,
                    currentRole: authUser.role,
                });
                return;
            }
        }

        // Attach user to request
        request.authUser = authUser;
        request.isAuthenticated = authUser !== null;
    };
}

/**
 * Validate API key against database
 */
async function validateAPIKey(apiKey: string): Promise<APIKeyValidation> {
    // Format: prefix_hash (e.g., "lvb_xxxx...")
    if (!apiKey.startsWith('lvb_')) {
        return { valid: false, userId: '', scopes: [], name: '' };
    }

    try {
        // Hash the API key to match against stored hash
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const supabase = getSupabaseAdmin();

        // Look up the API key in database
        const { data, error } = await supabase
            .from('api_keys')
            .select('id, user_id, name, scopes, is_active, expires_at, revoked_at')
            .eq('key_hash', keyHash)
            .single();

        if (error || !data) {
            return { valid: false, userId: '', scopes: [], name: '' };
        }

        // Check if key is active
        if (!data.is_active) {
            return { valid: false, userId: '', scopes: [], name: '' };
        }

        // Check if key is revoked
        if (data.revoked_at) {
            return { valid: false, userId: '', scopes: [], name: '' };
        }

        // Check if key is expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
            return { valid: false, userId: '', scopes: [], name: '' };
        }

        // Update last used timestamp (fire and forget)
        void (async () => {
            try {
                await supabase
                    .from('api_keys')
                    .update({
                        last_used_at: new Date().toISOString(),
                    })
                    .eq('id', data.id);
            } catch {
                // Ignore update errors
            }
        })();

        return {
            valid: true,
            userId: data.user_id,
            scopes: data.scopes || ['read'],
            name: data.name,
        };
    } catch (err) {
        console.error('[AUTH] API key validation error:', err);
        return { valid: false, userId: '', scopes: [], name: '' };
    }
}

// ============================================
// CONVENIENCE MIDDLEWARE FACTORIES
// ============================================

/**
 * Require authentication (any valid token)
 */
export const requireAuth = authenticate({ required: true });

/**
 * Optional authentication (extract user if present)
 */
export const optionalAuth = authenticate({ required: false });

/**
 * Require admin role
 */
export const requireAdmin = authenticate({ required: true, roles: ['admin', 'service_role'] });

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
    return authenticate({ required: true, roles });
}

/**
 * Require specific scope(s) for API key
 */
export function requireScope(...scopes: string[]) {
    return authenticate({ required: true, scopes, allowApiKey: true });
}

/**
 * Allow only refresh tokens (for refresh endpoint)
 * Note: With Supabase, refresh is handled by the SDK
 */
export const requireRefreshToken = authenticate({
    required: true,
    allowRefreshToken: true,
    allowApiKey: false
});

// ============================================
// REGISTRATION FUNCTION
// ============================================

/**
 * Register authentication decorators on Fastify instance
 */
export async function registerAuthMiddleware(app: FastifyInstance): Promise<void> {
    // Add decorators
    app.decorateRequest('authUser', null);
    app.decorateRequest('isAuthenticated', false);

    app.log.info('[AUTH] Authentication middleware registered (Supabase-based)');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get authenticated user from request or throw
 */
export function getAuthUser(request: FastifyRequest): AuthenticatedUser {
    if (!request.authUser) {
        throw new Error('User not authenticated');
    }
    return request.authUser;
}

/**
 * Check if user has a specific role
 */
export function hasRole(request: FastifyRequest, role: string): boolean {
    return request.authUser?.role === role;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(request: FastifyRequest, roles: string[]): boolean {
    if (!request.authUser) return false;
    return roles.includes(request.authUser.role);
}
