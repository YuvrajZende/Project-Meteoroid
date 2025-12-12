/**
 * ============================================
 * AUTH AGENT - AUTHENTICATION & AUTHORIZATION
 * ============================================
 * 
 * The AuthAgent is responsible for generating all authentication
 * and authorization code for backend systems.
 * 
 * Capabilities:
 * - Clerk authentication integration
 * - JWT token management
 * - OAuth 2.1 providers (Google, GitHub, Facebook)
 * - RBAC (Role-Based Access Control)
 * - ABAC (Attribute-Based Access Control) with Cerbos
 * - MFA (Multi-Factor Authentication)
 * - Session management
 * - Rate limiting
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
    CLERK_SETUP_TEMPLATE,
    CLERK_WEBHOOK_TEMPLATE,
    JWT_MIDDLEWARE_TEMPLATE,
    JWT_AUTH_ROUTES_TEMPLATE,
    OAUTH_PROVIDER_TEMPLATE,
    RBAC_TEMPLATE,
    getAuthTemplates,
    getAvailableAuthTypes
} from "./templates";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface AuthConfig {
    provider: AuthProvider;
    features: AuthFeature[];
    oauth?: OAuthConfig;
    jwt?: JWTConfig;
    rbac?: RBACConfig;
    mfa?: MFAConfig;
    session?: SessionConfig;
}

export type AuthProvider = "clerk" | "custom" | "auth0" | "supabase";

export type AuthFeature =
    | "login"
    | "register"
    | "logout"
    | "forgot-password"
    | "reset-password"
    | "email-verification"
    | "oauth"
    | "mfa"
    | "rbac"
    | "abac"
    | "session"
    | "refresh-token"
    | "api-keys";

export interface OAuthConfig {
    providers: OAuthProvider[];
    callbackUrl: string;
}

export type OAuthProvider = "google" | "github" | "facebook" | "twitter" | "apple";

export interface JWTConfig {
    algorithm: "HS256" | "RS256";
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer?: string;
}

export interface RBACConfig {
    roles: RoleDefinition[];
    defaultRole: string;
}

export interface RoleDefinition {
    name: string;
    permissions: string[];
    inherits?: string[];
}

export interface MFAConfig {
    methods: MFAMethod[];
    required: boolean;
}

export type MFAMethod = "totp" | "sms" | "email" | "backup_codes";

export interface SessionConfig {
    duration: number;
    refreshThreshold: number;
    maxConcurrent: number;
}

export interface AuthGenerationResult {
    files: GeneratedFile[];
    dependencies: string[];
    envVariables: string[];
    instructions: string[];
}

export interface GeneratedFile {
    path: string;
    content: string;
    description: string;
}

// ============================================
// AUTH AGENT CLASS
// ============================================

export class AuthAgent {
    private model: ChatOpenAI;
    private config: AuthConfig | null = null;

    constructor() {
        this.model = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
            temperature: 0.3, // Lower for more consistent code generation
        });
    }

    // ============================================
    // MAIN GENERATION METHODS
    // ============================================

    /**
     * Generate complete authentication system based on config
     */
    async generateAuthSystem(config: AuthConfig): Promise<AuthGenerationResult> {
        this.config = config;
        const result: AuthGenerationResult = {
            files: [],
            dependencies: [],
            envVariables: [],
            instructions: [],
        };

        console.log(`\n🔐 [AuthAgent] Generating auth system with ${config.provider}...`);

        // Generate based on provider
        switch (config.provider) {
            case "clerk":
                await this.generateClerkAuth(result);
                break;
            case "custom":
                await this.generateCustomJWTAuth(result);
                break;
            default:
                await this.generateCustomJWTAuth(result);
        }

        // Add OAuth if requested
        if (config.features.includes("oauth") && config.oauth) {
            await this.generateOAuthProviders(result, config.oauth);
        }

        // Add RBAC if requested
        if (config.features.includes("rbac") && config.rbac) {
            await this.generateRBAC(result, config.rbac);
        }

        // Add MFA if requested
        if (config.features.includes("mfa") && config.mfa) {
            await this.generateMFA(result, config.mfa);
        }

        // Add session management
        if (config.features.includes("session")) {
            await this.generateSessionManagement(result, config.session);
        }

        console.log(`✅ [AuthAgent] Generated ${result.files.length} files`);
        return result;
    }

    // ============================================
    // CLERK AUTHENTICATION
    // ============================================

    /**
     * Generate Clerk authentication integration
     */
    private async generateClerkAuth(result: AuthGenerationResult): Promise<void> {
        console.log(`   📦 Generating Clerk integration...`);

        // Add Clerk setup
        result.files.push({
            path: "src/auth/clerk.config.ts",
            content: CLERK_SETUP_TEMPLATE,
            description: "Clerk SDK configuration and middleware",
        });

        // Add webhook handler
        result.files.push({
            path: "src/auth/clerk-webhook.ts",
            content: CLERK_WEBHOOK_TEMPLATE,
            description: "Clerk webhook handler for user sync",
        });

        // Add dependencies
        result.dependencies.push(
            "@clerk/nextjs",
            "@clerk/backend",
            "svix"
        );

        // Add environment variables
        result.envVariables.push(
            "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
            "CLERK_SECRET_KEY",
            "CLERK_WEBHOOK_SECRET"
        );

        // Add instructions
        result.instructions.push(
            "1. Create a Clerk account at https://clerk.com",
            "2. Create a new application in Clerk dashboard",
            "3. Copy the API keys to your .env file",
            "4. Configure webhook endpoints in Clerk dashboard",
            "5. Add Clerk middleware to your Next.js middleware.ts"
        );
    }

    // ============================================
    // CUSTOM JWT AUTHENTICATION
    // ============================================

    /**
     * Generate custom JWT authentication
     */
    private async generateCustomJWTAuth(result: AuthGenerationResult): Promise<void> {
        console.log(`   🔑 Generating JWT authentication...`);

        // Add JWT middleware
        result.files.push({
            path: "src/auth/jwt-middleware.ts",
            content: JWT_MIDDLEWARE_TEMPLATE,
            description: "JWT authentication middleware with token validation",
        });

        // Add auth routes
        result.files.push({
            path: "src/auth/auth-routes.ts",
            content: JWT_AUTH_ROUTES_TEMPLATE,
            description: "Login, register, refresh token endpoints",
        });

        // Generate auth types
        const authTypes = this.generateAuthTypes();
        result.files.push({
            path: "src/auth/auth.types.ts",
            content: authTypes,
            description: "TypeScript types for authentication",
        });

        // Add dependencies
        result.dependencies.push(
            "jsonwebtoken",
            "@types/jsonwebtoken",
            "bcryptjs",
            "@types/bcryptjs"
        );

        // Add environment variables
        result.envVariables.push(
            "JWT_SECRET",
            "JWT_EXPIRES_IN",
            "JWT_REFRESH_EXPIRES_IN"
        );

        // Add instructions
        result.instructions.push(
            "1. Generate a secure JWT secret: openssl rand -base64 64",
            "2. Add JWT_SECRET to your .env file",
            "3. Import and use authenticateJWT middleware on protected routes",
            "4. Implement user storage in your database"
        );
    }

    /**
     * Generate TypeScript types for auth
     */
    private generateAuthTypes(): string {
        return `
// ============================================
// AUTHENTICATION TYPES
// ============================================

export interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
}

export type Role = "admin" | "manager" | "user" | "guest";

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
}

export interface TokenPayload {
    userId: string;
    email: string;
    role: Role;
    iat: number;
    exp: number;
}

export interface AuthenticatedRequest extends Request {
    user?: TokenPayload;
}

export interface PasswordResetRequest {
    email: string;
}

export interface PasswordResetConfirm {
    token: string;
    newPassword: string;
}
`;
    }

    // ============================================
    // OAUTH PROVIDERS
    // ============================================

    /**
     * Generate OAuth provider integration
     */
    private async generateOAuthProviders(
        result: AuthGenerationResult,
        config: OAuthConfig
    ): Promise<void> {
        console.log(`   🌐 Generating OAuth providers: ${config.providers.join(", ")}...`);

        result.files.push({
            path: "src/auth/oauth-providers.ts",
            content: OAUTH_PROVIDER_TEMPLATE,
            description: "OAuth provider configuration (Google, GitHub)",
        });

        // Add dependencies based on providers
        result.dependencies.push("passport");

        for (const provider of config.providers) {
            switch (provider) {
                case "google":
                    result.dependencies.push("passport-google-oauth20", "@types/passport-google-oauth20");
                    result.envVariables.push("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL");
                    break;
                case "github":
                    result.dependencies.push("passport-github2", "@types/passport-github2");
                    result.envVariables.push("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_CALLBACK_URL");
                    break;
                case "facebook":
                    result.dependencies.push("passport-facebook");
                    result.envVariables.push("FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "FACEBOOK_CALLBACK_URL");
                    break;
            }
        }

        result.instructions.push(
            `Configure OAuth credentials for: ${config.providers.join(", ")}`,
            "Set up callback URLs in each provider's developer console"
        );
    }

    // ============================================
    // RBAC (ROLE-BASED ACCESS CONTROL)
    // ============================================

    /**
     * Generate RBAC system
     */
    private async generateRBAC(
        result: AuthGenerationResult,
        config: RBACConfig
    ): Promise<void> {
        console.log(`   👥 Generating RBAC system with ${config.roles.length} roles...`);

        result.files.push({
            path: "src/auth/rbac.ts",
            content: RBAC_TEMPLATE,
            description: "Role-based access control with permissions",
        });

        // Generate custom roles if defined
        if (config.roles.length > 0) {
            const customRoles = this.generateCustomRoles(config.roles);
            result.files.push({
                path: "src/auth/roles.config.ts",
                content: customRoles,
                description: "Custom role definitions",
            });
        }

        result.instructions.push(
            "Apply @Roles() decorator to protected endpoints",
            "Use requirePermission() middleware for fine-grained access"
        );
    }

    /**
     * Generate custom role definitions
     */
    private generateCustomRoles(roles: RoleDefinition[]): string {
        const roleEntries = roles.map(role =>
            `    ${role.name.toUpperCase()}: ${JSON.stringify(role.permissions, null, 4)}`
        ).join(",\n");

        return `
// ============================================
// CUSTOM ROLE DEFINITIONS
// ============================================

export const ROLES = {
${roleEntries}
} as const;

export type RoleName = keyof typeof ROLES;

export function getRolePermissions(role: RoleName): string[] {
    return ROLES[role] || [];
}

export function hasRole(userRole: string, requiredRole: RoleName): boolean {
    return userRole.toUpperCase() === requiredRole;
}
`;
    }

    // ============================================
    // MFA (MULTI-FACTOR AUTHENTICATION)
    // ============================================

    /**
     * Generate MFA implementation
     */
    private async generateMFA(
        result: AuthGenerationResult,
        config: MFAConfig
    ): Promise<void> {
        console.log(`   🔐 Generating MFA with methods: ${config.methods.join(", ")}...`);

        const mfaCode = this.generateMFACode(config);
        result.files.push({
            path: "src/auth/mfa.ts",
            content: mfaCode,
            description: "Multi-factor authentication implementation",
        });

        // Add dependencies based on methods
        if (config.methods.includes("totp")) {
            result.dependencies.push("otplib", "qrcode", "@types/qrcode");
            result.instructions.push("TOTP MFA: Users scan QR code with authenticator app");
        }

        if (config.methods.includes("sms")) {
            result.dependencies.push("twilio");
            result.envVariables.push("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER");
            result.instructions.push("SMS MFA: Configure Twilio credentials in .env");
        }
    }

    /**
     * Generate MFA code
     */
    private generateMFACode(config: MFAConfig): string {
        return `
// ============================================
// MULTI-FACTOR AUTHENTICATION
// ============================================

import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

/**
 * Generate TOTP secret for user
 */
export function generateTOTPSecret(email: string, appName: string = 'MyApp'): {
    secret: string;
    otpauthUrl: string;
} {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, appName, secret);
    
    return { secret, otpauthUrl };
}

/**
 * Generate QR code for TOTP setup
 */
export async function generateTOTPQRCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
}

/**
 * Verify TOTP token
 */
export function verifyTOTPToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        codes.push(code);
    }
    return codes;
}

/**
 * Verify backup code
 */
export function verifyBackupCode(code: string, storedCodes: string[]): boolean {
    const index = storedCodes.indexOf(code.toUpperCase());
    return index !== -1;
}

// MFA Configuration
export const MFA_CONFIG = {
    required: ${config.required},
    methods: ${JSON.stringify(config.methods)},
};
`;
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Generate session management
     */
    private async generateSessionManagement(
        result: AuthGenerationResult,
        config?: SessionConfig
    ): Promise<void> {
        console.log(`   📋 Generating session management...`);

        const sessionCode = this.generateSessionCode(config);
        result.files.push({
            path: "src/auth/session.ts",
            content: sessionCode,
            description: "Redis-based session management",
        });

        result.dependencies.push("ioredis", "@types/ioredis");
        result.envVariables.push("REDIS_URL");

        result.instructions.push(
            "Configure Redis URL in .env file",
            "Sessions are stored in Redis with automatic expiration"
        );
    }

    /**
     * Generate session management code
     */
    private generateSessionCode(config?: SessionConfig): string {
        const duration = config?.duration || 3600;
        const maxConcurrent = config?.maxConcurrent || 5;

        return `
// ============================================
// SESSION MANAGEMENT
// ============================================

import Redis from 'ioredis';
import * as crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL);

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const SESSION_DURATION = ${duration}; // seconds
const MAX_CONCURRENT_SESSIONS = ${maxConcurrent};

export interface Session {
    id: string;
    userId: string;
    createdAt: number;
    expiresAt: number;
    userAgent?: string;
    ipAddress?: string;
}

/**
 * Create a new session
 */
export async function createSession(
    userId: string,
    metadata?: { userAgent?: string; ipAddress?: string }
): Promise<Session> {
    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    const session: Session = {
        id: sessionId,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION * 1000,
        ...metadata,
    };

    // Store session
    await redis.setex(
        SESSION_PREFIX + sessionId,
        SESSION_DURATION,
        JSON.stringify(session)
    );

    // Track user sessions
    await redis.sadd(USER_SESSIONS_PREFIX + userId, sessionId);

    // Enforce max concurrent sessions
    await enforceMaxSessions(userId);

    return session;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
    const data = await redis.get(SESSION_PREFIX + sessionId);
    if (!data) return null;
    return JSON.parse(data);
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
    const session = await getSession(sessionId);
    if (session) {
        await redis.del(SESSION_PREFIX + sessionId);
        await redis.srem(USER_SESSIONS_PREFIX + session.userId, sessionId);
    }
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await redis.smembers(USER_SESSIONS_PREFIX + userId);
    
    for (const sessionId of sessionIds) {
        await redis.del(SESSION_PREFIX + sessionId);
    }
    
    await redis.del(USER_SESSIONS_PREFIX + userId);
}

/**
 * Enforce maximum concurrent sessions
 */
async function enforceMaxSessions(userId: string): Promise<void> {
    const sessionIds = await redis.smembers(USER_SESSIONS_PREFIX + userId);
    
    if (sessionIds.length > MAX_CONCURRENT_SESSIONS) {
        // Get all sessions with their creation times
        const sessions: Session[] = [];
        for (const id of sessionIds) {
            const session = await getSession(id);
            if (session) sessions.push(session);
        }
        
        // Sort by creation time (oldest first)
        sessions.sort((a, b) => a.createdAt - b.createdAt);
        
        // Delete oldest sessions
        const toDelete = sessions.slice(0, sessions.length - MAX_CONCURRENT_SESSIONS);
        for (const session of toDelete) {
            await deleteSession(session.id);
        }
    }
}

/**
 * Refresh session expiration
 */
export async function refreshSession(sessionId: string): Promise<boolean> {
    const session = await getSession(sessionId);
    if (!session) return false;

    session.expiresAt = Date.now() + SESSION_DURATION * 1000;
    
    await redis.setex(
        SESSION_PREFIX + sessionId,
        SESSION_DURATION,
        JSON.stringify(session)
    );

    return true;
}
`;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Get available authentication templates
     */
    getAvailableTemplates(): string[] {
        return getAvailableAuthTypes();
    }

    /**
     * Get a specific template
     */
    getTemplate(type: string): string | undefined {
        const templates = getAuthTemplates(type);
        if (!templates) return undefined;
        return templates.templates.map(t => t.content).join("\n\n");
    }

    /**
     * Analyze auth requirements from user request
     */
    async analyzeRequirements(userRequest: string): Promise<AuthConfig> {
        const prompt = `
Analyze this user request and determine authentication requirements.

User Request: "${userRequest}"

Respond with a JSON object matching this structure:
{
    "provider": "clerk" | "custom",
    "features": ["login", "register", "oauth", "rbac", "mfa", "session"],
    "oauth": { "providers": ["google", "github"] },
    "rbac": { "roles": [{ "name": "admin", "permissions": ["*"] }], "defaultRole": "user" }
}

Only include features that are explicitly or implicitly requested.
`;

        const response = await this.model.invoke([
            new SystemMessage("You are an authentication expert. Analyze requirements and output JSON only."),
            new HumanMessage(prompt)
        ]);

        try {
            const content = response.content.toString();
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error("Failed to parse auth requirements:", error);
        }

        // Default config
        return {
            provider: "custom",
            features: ["login", "register"],
        };
    }
}

// Export singleton instance
export const authAgent = new AuthAgent();
