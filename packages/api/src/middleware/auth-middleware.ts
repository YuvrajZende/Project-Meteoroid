/**
 * Authentication Middleware
 * Secure authentication using our JWT Service
 * 
 * This middleware provides:
 * - JWT token verification
 * - Role-based access control
 * - API key authentication
 * - Request user decoration
 * 
 * @module middleware/auth-middleware
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getJWTService } from '../services/jwt-service.js';

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
        authUser: AuthenticatedUser | null;
        isAuthenticated: boolean;
    }
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Create authentication middleware with options
 */
export function authenticate(options: AuthOptions = {}) {
    const {
        required = true,
        roles = [],
        scopes = [],
        allowApiKey = true,
        allowRefreshToken = false,
    } = options;

    return async function authMiddleware(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        const jwtService = getJWTService();
        let authUser: AuthenticatedUser | null = null;

        // Try Bearer token first
        const authHeader = request.headers.authorization;
        const bearerToken = jwtService.extractTokenFromHeader(authHeader);

        if (bearerToken) {
            const result = jwtService.verifyToken(bearerToken);

            if (result.valid && result.payload) {
                // Check token type
                if (result.payload.type === 'refresh' && !allowRefreshToken) {
                    if (required) {
                        reply.status(401).send({
                            success: false,
                            error: 'Invalid token type',
                            message: 'Refresh tokens cannot be used for this endpoint',
                        });
                        return;
                    }
                } else {
                    authUser = {
                        id: result.payload.sub,
                        email: result.payload.email,
                        role: result.payload.role,
                        tokenType: result.payload.type,
                        claims: result.payload,
                    };
                }
            } else if (required) {
                reply.status(401).send({
                    success: false,
                    error: 'Authentication failed',
                    message: result.error || 'Invalid token',
                    expired: result.expired,
                });
                return;
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
 * Validate API key (placeholder - should be database lookup)
 */
async function validateAPIKey(apiKey: string): Promise<APIKeyValidation> {
    // TODO: Implement actual API key validation against database
    // This is a placeholder that should be replaced with actual logic

    // Format: prefix_hash (e.g., "lvb_xxxx...")
    if (!apiKey.startsWith('lvb_')) {
        return { valid: false, userId: '', scopes: [], name: '' };
    }

    // In production, look up the API key hash in database
    // For now, return invalid
    return { valid: false, userId: '', scopes: [], name: '' };
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

    app.log.info('[AUTH] Authentication middleware registered');
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
