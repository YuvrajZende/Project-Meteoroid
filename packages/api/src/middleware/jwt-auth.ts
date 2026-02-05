/**
 * JWT Authentication Middleware
 * Verifies Supabase JWT tokens and extracts user information
 * 
 * Supabase handles JWT generation - we just need to verify and extract claims
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { getSupabaseAdmin } from '../infrastructure/database/database-client.js';

// User payload extracted from JWT
export interface JWTUser {
    id: string;
    email: string;
    role: string;
    aud: string;
    exp: number;
    iat: number;
    sub: string;
    app_metadata?: {
        provider?: string;
        providers?: string[];
    };
    user_metadata?: {
        name?: string;
        full_name?: string;
        avatar_url?: string;
    };
}

// Extend FastifyRequest to include user
declare module 'fastify' {
    interface FastifyRequest {
        user?: JWTUser;
        userId?: string;
    }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
}

/**
 * Verify Supabase JWT token
 * Uses Supabase Admin client to verify the token
 */
async function verifySupabaseToken(token: string): Promise<JWTUser | null> {
    try {
        const supabase = getSupabaseAdmin();

        // Use Supabase to get the user from the token
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return null;
        }

        // Convert Supabase user to our JWTUser format
        return {
            id: user.id,
            email: user.email || '',
            role: user.role || 'authenticated',
            aud: user.aud || 'authenticated',
            exp: 0, // Supabase handles expiry internally
            iat: 0,
            sub: user.id,
            app_metadata: user.app_metadata,
            user_metadata: user.user_metadata,
        };
    } catch (error) {
        console.error('[JWT] Token verification failed:', error);
        return null;
    }
}

/**
 * JWT Authentication Hook
 * Attaches user to request if valid token present
 * Does NOT block request if no token (use requireAuth for that)
 */
export async function jwtAuthHook(
    request: FastifyRequest,
    _reply: FastifyReply,
    done: HookHandlerDoneFunction
): Promise<void> {
    const authHeader = request.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (token) {
        const user = await verifySupabaseToken(token);
        if (user) {
            request.user = user;
            request.userId = user.id;
        }
    }

    done();
}

/**
 * Require Authentication Middleware
 * Blocks request if no valid JWT token is present
 */
export function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
): void {
    if (!request.user) {
        reply.status(401).send({
            success: false,
            error: 'Authentication required',
            message: 'Please provide a valid Bearer token in the Authorization header',
        });
        return;
    }
    done();
}

/**
 * Require specific role(s)
 * Must be used after requireAuth
 */
export function requireRole(...allowedRoles: string[]) {
    return function (
        request: FastifyRequest,
        reply: FastifyReply,
        done: HookHandlerDoneFunction
    ): void {
        if (!request.user) {
            reply.status(401).send({
                success: false,
                error: 'Authentication required',
            });
            return;
        }

        if (!allowedRoles.includes(request.user.role)) {
            reply.status(403).send({
                success: false,
                error: 'Insufficient permissions',
                message: `Required role: ${allowedRoles.join(' or ')}`,
                currentRole: request.user.role,
            });
            return;
        }

        done();
    };
}

/**
 * Optional Authentication Middleware
 * Similar to jwtAuthHook but as a preHandler
 * Useful when you want to know if user is authenticated but don't require it
 */
export async function optionalAuth(
    request: FastifyRequest,
    _reply: FastifyReply
): Promise<void> {
    const authHeader = request.headers.authorization;
    const token = extractBearerToken(authHeader);

    if (token) {
        const user = await verifySupabaseToken(token);
        if (user) {
            request.user = user;
            request.userId = user.id;
        }
    }
}

/**
 * Register JWT authentication plugin
 * Adds the authentication hook to all routes
 */
export async function registerJWTAuth(app: FastifyInstance): Promise<void> {
    // Add hook to extract user from all requests
    app.addHook('preHandler', async (request, reply) => {
        await jwtAuthHook(request, reply, () => { });
    });

    // Add decorators for request (undefined as initial value matches the optional types)
    app.decorateRequest('user', undefined);
    app.decorateRequest('userId', undefined);

    app.log.info('[JWT] Authentication middleware registered');
}

/**
 * Get user from request or throw
 * Utility function for route handlers
 */
export function getUserFromRequest(request: FastifyRequest): JWTUser {
    if (!request.user) {
        throw new Error('User not authenticated');
    }
    return request.user;
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(request: FastifyRequest): boolean {
    return !!request.user;
}
