/**
 * ============================================
 * AUTH AGENT TEMPLATES
 * ============================================
 * 
 * Pre-built, production-ready authentication code templates.
 * These provide a solid foundation that the AuthAgent can
 * customize based on user requirements.
 */

// ============================================
// CLERK AUTHENTICATION TEMPLATE
// ============================================

export const CLERK_SETUP_TEMPLATE = `
// ============================================
// CLERK AUTHENTICATION SETUP
// ============================================
// Production-ready Clerk integration for Next.js/Express

import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { getAuth, clerkClient } from "@clerk/nextjs/server";

// Environment validation
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required");
}
if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required");
}

/**
 * Clerk Middleware Configuration
 * Add to middleware.ts in your Next.js project
 */
export const clerkMiddlewareConfig = {
    publicRoutes: ["/", "/api/public(.*)"],
    ignoredRoutes: ["/api/webhooks/(.*)"],
};

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(req: Request) {
    const { userId } = getAuth(req as any);
    
    if (!userId) {
        return null;
    }

    const user = await clerkClient.users.getUser(userId);
    return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
    };
}

/**
 * Require authentication middleware
 */
export function requireAuth(handler: Function) {
    return async (req: Request, res: Response) => {
        const { userId } = getAuth(req as any);
        
        if (!userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        return handler(req, res, userId);
    };
}
`;

export const CLERK_WEBHOOK_TEMPLATE = `
// ============================================
// CLERK WEBHOOK HANDLER
// ============================================
// Handles Clerk webhooks for user sync

import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";

export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        throw new Error("CLERK_WEBHOOK_SECRET is required");
    }

    const headerPayload = headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response("Missing svix headers", { status: 400 });
    }

    const payload = await req.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: WebhookEvent;

    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as WebhookEvent;
    } catch (err) {
        console.error("Webhook verification failed:", err);
        return new Response("Invalid signature", { status: 400 });
    }

    // Handle the webhook event
    switch (evt.type) {
        case "user.created":
            await handleUserCreated(evt.data);
            break;
        case "user.updated":
            await handleUserUpdated(evt.data);
            break;
        case "user.deleted":
            await handleUserDeleted(evt.data);
            break;
        default:
            console.log(\`Unhandled webhook type: \${evt.type}\`);
    }

    return new Response("OK", { status: 200 });
}

async function handleUserCreated(userData: any) {
    // Sync user to your database
    console.log("User created:", userData.id);
    // await db.user.create({ ... });
}

async function handleUserUpdated(userData: any) {
    console.log("User updated:", userData.id);
    // await db.user.update({ ... });
}

async function handleUserDeleted(userData: any) {
    console.log("User deleted:", userData.id);
    // await db.user.delete({ ... });
}
`;

// ============================================
// JWT AUTHENTICATION TEMPLATE
// ============================================

export const JWT_MIDDLEWARE_TEMPLATE = `
// ============================================
// JWT AUTHENTICATION MIDDLEWARE
// ============================================
// Production-ready JWT authentication for Express/Fastify

import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

// Types
export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

export interface AuthenticatedRequest extends Request {
    user?: JWTPayload;
}

// Configuration
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
    return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
    return jwt.sign({ userId, type: "refresh" }, JWT_SECRET!, { 
        expiresIn: JWT_REFRESH_EXPIRES_IN 
    });
}

/**
 * Verify and decode token
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET!) as JWTPayload;
    } catch (error) {
        return null;
    }
}

/**
 * JWT Authentication Middleware
 */
export function authenticateJWT(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "No authorization header" });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({ error: "Invalid authorization format" });
    }

    const token = parts[1];
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({ error: "Invalid or expired token" });
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
) {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const parts = authHeader.split(" ");
        if (parts.length === 2 && parts[0] === "Bearer") {
            const payload = verifyToken(parts[1]);
            if (payload) {
                req.user = payload;
            }
        }
    }

    next();
}

/**
 * Require specific role
 */
export function requireRole(...roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }

        next();
    };
}
`;

export const JWT_AUTH_ROUTES_TEMPLATE = `
// ============================================
// JWT AUTH ROUTES
// ============================================
// Login, register, refresh token endpoints

import { Router } from "express";
import bcrypt from "bcryptjs";
import { generateAccessToken, generateRefreshToken, verifyToken } from "./jwt-middleware";

const router = Router();

// Types
interface LoginRequest {
    email: string;
    password: string;
}

interface RegisterRequest {
    email: string;
    password: string;
    name: string;
}

/**
 * POST /auth/register
 * Register a new user
 */
router.post("/register", async (req, res) => {
    try {
        const { email, password, name }: RegisterRequest = req.body;

        // Validate input
        if (!email || !password || !name) {
            return res.status(400).json({ error: "All fields are required" });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }

        // Check if user exists (replace with your DB call)
        // const existingUser = await db.user.findUnique({ where: { email } });
        // if (existingUser) {
        //     return res.status(409).json({ error: "Email already registered" });
        // }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user (replace with your DB call)
        const user = {
            id: "user_" + Date.now(),
            email,
            name,
            role: "user",
            // password: hashedPassword
        };

        // Generate tokens
        const accessToken = generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = generateRefreshToken(user.id);

        res.status(201).json({
            user: { id: user.id, email: user.email, name: user.name },
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password }: LoginRequest = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // Find user (replace with your DB call)
        // const user = await db.user.findUnique({ where: { email } });
        const user = null; // Replace with actual DB lookup

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Verify password
        // const validPassword = await bcrypt.compare(password, user.password);
        // if (!validPassword) {
        //     return res.status(401).json({ error: "Invalid credentials" });
        // }

        // Generate tokens
        // const accessToken = generateAccessToken({
        //     userId: user.id,
        //     email: user.email,
        //     role: user.role,
        // });
        // const refreshToken = generateRefreshToken(user.id);

        res.json({
            // user: { id: user.id, email: user.email, name: user.name },
            // accessToken,
            // refreshToken,
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token required" });
        }

        const payload = verifyToken(refreshToken);
        if (!payload || (payload as any).type !== "refresh") {
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        // Get user (replace with your DB call)
        // const user = await db.user.findUnique({ where: { id: payload.userId } });

        // Generate new access token
        // const newAccessToken = generateAccessToken({
        //     userId: user.id,
        //     email: user.email,
        //     role: user.role,
        // });

        res.json({
            // accessToken: newAccessToken,
        });
    } catch (error) {
        console.error("Token refresh error:", error);
        res.status(500).json({ error: "Token refresh failed" });
    }
});

/**
 * POST /auth/logout
 * Invalidate refresh token (if using token blocklist)
 */
router.post("/logout", async (req, res) => {
    // Add refresh token to blocklist if needed
    res.json({ message: "Logged out successfully" });
});

export default router;
`;

// ============================================
// OAUTH TEMPLATE
// ============================================

export const OAUTH_PROVIDER_TEMPLATE = `
// ============================================
// OAUTH PROVIDER SETUP
// ============================================
// Google, GitHub, Facebook OAuth integration

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";

// ============================================
// GOOGLE OAUTH
// ============================================

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Find or create user
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(new Error("No email from Google"), null);
                }

                // Replace with your DB logic
                const user = {
                    id: profile.id,
                    email,
                    name: profile.displayName,
                    avatar: profile.photos?.[0]?.value,
                    provider: "google",
                };

                return done(null, user);
            } catch (error) {
                return done(error as Error, null);
            }
        }
    )
);

// ============================================
// GITHUB OAUTH
// ============================================

passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            callbackURL: process.env.GITHUB_CALLBACK_URL || "/auth/github/callback",
            scope: ["user:email"],
        },
        async (accessToken: string, refreshToken: string, profile: any, done: Function) => {
            try {
                const email = profile.emails?.[0]?.value;

                const user = {
                    id: profile.id,
                    email,
                    name: profile.displayName || profile.username,
                    avatar: profile.photos?.[0]?.value,
                    provider: "github",
                };

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

// ============================================
// SERIALIZATION
// ============================================

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        // Fetch user from DB
        // const user = await db.user.findUnique({ where: { id } });
        done(null, { id }); // Replace with actual user
    } catch (error) {
        done(error, null);
    }
});

export default passport;
`;

// ============================================
// RBAC (ROLE-BASED ACCESS CONTROL) TEMPLATE
// ============================================

export const RBAC_TEMPLATE = `
// ============================================
// ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================
// Flexible permission system for your application

// Types
export type Role = "admin" | "manager" | "user" | "guest";

export type Permission = 
    | "users:read" | "users:write" | "users:delete"
    | "posts:read" | "posts:write" | "posts:delete"
    | "settings:read" | "settings:write"
    | "admin:access";

export interface RolePermissions {
    role: Role;
    permissions: Permission[];
}

// ============================================
// PERMISSION DEFINITIONS
// ============================================

const ROLE_PERMISSIONS: RolePermissions[] = [
    {
        role: "admin",
        permissions: [
            "users:read", "users:write", "users:delete",
            "posts:read", "posts:write", "posts:delete",
            "settings:read", "settings:write",
            "admin:access",
        ],
    },
    {
        role: "manager",
        permissions: [
            "users:read", "users:write",
            "posts:read", "posts:write", "posts:delete",
            "settings:read",
        ],
    },
    {
        role: "user",
        permissions: [
            "users:read",
            "posts:read", "posts:write",
        ],
    },
    {
        role: "guest",
        permissions: [
            "posts:read",
        ],
    },
];

// ============================================
// RBAC FUNCTIONS
// ============================================

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role): Permission[] {
    const roleConfig = ROLE_PERMISSIONS.find(r => r.role === role);
    return roleConfig?.permissions || [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
    const permissions = getPermissions(role);
    return permissions.includes(permission);
}

/**
 * Check if a role has all specified permissions
 */
export function hasAllPermissions(role: Role, requiredPermissions: Permission[]): boolean {
    const permissions = getPermissions(role);
    return requiredPermissions.every(p => permissions.includes(p));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, requiredPermissions: Permission[]): boolean {
    const permissions = getPermissions(role);
    return requiredPermissions.some(p => permissions.includes(p));
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
    user?: { role: Role; [key: string]: any };
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...requiredPermissions: Permission[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const userRole = req.user.role as Role;
        
        if (!hasAllPermissions(userRole, requiredPermissions)) {
            return res.status(403).json({ 
                error: "Insufficient permissions",
                required: requiredPermissions,
                userRole,
            });
        }

        next();
    };
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const userRole = req.user.role as Role;
        
        if (!hasAnyPermission(userRole, permissions)) {
            return res.status(403).json({ 
                error: "Insufficient permissions",
                requiredAny: permissions,
                userRole,
            });
        }

        next();
    };
}

/**
 * Usage example:
 * 
 * router.get("/users", requirePermission("users:read"), getUsers);
 * router.delete("/users/:id", requirePermission("users:delete"), deleteUser);
 * router.get("/admin", requirePermission("admin:access"), adminDashboard);
 */
`;

// ============================================
// TEMPLATE SELECTION
// ============================================

export interface AuthTemplateSet {
    name: string;
    description: string;
    templates: {
        file: string;
        content: string;
    }[];
}

export const AUTH_TEMPLATE_SETS: AuthTemplateSet[] = [
    {
        name: "clerk",
        description: "Clerk authentication with webhooks",
        templates: [
            { file: "clerk-setup.ts", content: CLERK_SETUP_TEMPLATE },
            { file: "clerk-webhook.ts", content: CLERK_WEBHOOK_TEMPLATE },
        ],
    },
    {
        name: "jwt",
        description: "JWT authentication with refresh tokens",
        templates: [
            { file: "jwt-middleware.ts", content: JWT_MIDDLEWARE_TEMPLATE },
            { file: "auth-routes.ts", content: JWT_AUTH_ROUTES_TEMPLATE },
        ],
    },
    {
        name: "oauth",
        description: "OAuth with Google and GitHub",
        templates: [
            { file: "oauth-providers.ts", content: OAUTH_PROVIDER_TEMPLATE },
        ],
    },
    {
        name: "rbac",
        description: "Role-based access control system",
        templates: [
            { file: "rbac.ts", content: RBAC_TEMPLATE },
        ],
    },
];

/**
 * Get templates for a specific auth type
 */
export function getAuthTemplates(authType: string): AuthTemplateSet | undefined {
    return AUTH_TEMPLATE_SETS.find(set => set.name === authType.toLowerCase());
}

/**
 * Get all available auth template names
 */
export function getAvailableAuthTypes(): string[] {
    return AUTH_TEMPLATE_SETS.map(set => set.name);
}

// ============================================
// RE-EXPORT NEW TEMPLATE MODULES
// ============================================

// Password Security Templates
export {
    ARGON2_PASSWORD_TEMPLATE,
    BCRYPT_PASSWORD_TEMPLATE,
    PASSWORD_VALIDATION_TEMPLATE,
    PASSWORD_HISTORY_TEMPLATE,
    PASSWORD_EXPIRATION_TEMPLATE,
    PASSWORD_TEMPLATE_SETS,
    getPasswordTemplates,
    getAvailablePasswordTypes,
} from "./password.js";

// ABAC with Cerbos Templates
export {
    CERBOS_CLIENT_TEMPLATE,
    CERBOS_POLICY_TEMPLATE,
    CERBOS_GUARD_TEMPLATE,
    PERMISSIONS_DECORATOR_TEMPLATE,
    POLICY_VALIDATION_TEMPLATE,
    CERBOS_TEMPLATE_SETS,
    getCerbosTemplates,
    getAvailableCerbosTypes,
} from "./cerbos.js";

// Rate Limiting Templates
export {
    REDIS_RATE_LIMITER_TEMPLATE,
    ENDPOINT_RATE_LIMITER_TEMPLATE,
    USER_RATE_LIMITER_TEMPLATE,
    IP_RATE_LIMITER_TEMPLATE,
    RATE_LIMIT_HEADERS_TEMPLATE,
    RATE_LIMIT_TEMPLATE_SETS,
    getRateLimitTemplates,
    getAvailableRateLimitTypes,
} from "./rate-limit.js";

