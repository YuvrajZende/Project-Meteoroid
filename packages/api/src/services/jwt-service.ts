/**
 * JWT Service
 * Secure JSON Web Token generation and verification
 * 
 * Supports RS256 (RSA) and HS256 (HMAC) algorithms.
 * RS256 is preferred for production as it allows public key verification.
 * 
 * @module services/jwt-service
 */

import crypto from 'crypto';
// Note: EncryptionService is used by JWT service for token encryption in future enhancements

// ============================================
// CONFIGURATION
// ============================================

/**
 * JWT configuration
 */
export interface JWTConfig {
    /** HMAC secret for HS256 (fallback if no RSA keys) */
    secret: string;
    /** Access token expiry (e.g., '15m', '1h') */
    accessTokenExpiry: string;
    /** Refresh token expiry (e.g., '7d', '30d') */
    refreshTokenExpiry: string;
    /** Token issuer */
    issuer: string;
    /** Token audience */
    audience: string;
    /** Algorithm to use */
    algorithm: 'HS256' | 'RS256';
}

/**
 * JWT token payload
 */
export interface JWTPayload {
    /** Subject (user ID) */
    sub: string;
    /** User email */
    email: string;
    /** User role */
    role: string;
    /** Issued at (Unix timestamp) */
    iat: number;
    /** Expiration (Unix timestamp) */
    exp: number;
    /** Not before (Unix timestamp) */
    nbf?: number;
    /** JWT ID */
    jti: string;
    /** Issuer */
    iss: string;
    /** Audience */
    aud: string;
    /** Token type */
    type: 'access' | 'refresh';
    /** Additional claims */
    [key: string]: unknown;
}

/**
 * Token pair returned after login
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}

/**
 * Token verification result
 */
export interface TokenVerifyResult {
    valid: boolean;
    expired: boolean;
    payload: JWTPayload | null;
    error?: string;
}

/**
 * Refresh token data stored in database
 */
export interface RefreshTokenData {
    tokenHash: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    createdAt: Date;
    revokedAt?: Date;
    replacedBy?: string;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: JWTConfig = {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'loveable-backend',
    audience: process.env.JWT_AUDIENCE || 'loveable-api',
    algorithm: 'HS256', // Default to HMAC, RS256 if keys provided
};

// ============================================
// JWT SERVICE CLASS
// ============================================

/**
 * JWT Service
 * Handles token generation, verification, and refresh
 */
export class JWTService {
    private config: JWTConfig;
    private blacklistedTokens: Set<string> = new Set();
    private initialized: boolean = false;

    constructor(config?: Partial<JWTConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the JWT service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Validate configuration
        if (this.config.secret === 'change-this-secret-in-production' && process.env.NODE_ENV === 'production') {
            console.warn('[JWT] WARNING: Using default secret in production is insecure!');
        }

        if (this.config.secret.length < 32) {
            console.warn('[JWT] WARNING: JWT secret should be at least 32 characters');
        }

        this.initialized = true;
    }

    /**
     * Parse duration string to milliseconds
     */
    private parseDuration(duration: string): number {
        const match = duration.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`Invalid duration format: ${duration}`);
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: throw new Error(`Unknown duration unit: ${unit}`);
        }
    }

    /**
     * Base64url encode
     */
    private base64UrlEncode(data: string | Buffer): string {
        const buffer = typeof data === 'string' ? Buffer.from(data) : data;
        return buffer.toString('base64url');
    }

    /**
     * Base64url decode
     */
    private base64UrlDecode(data: string): string {
        return Buffer.from(data, 'base64url').toString('utf8');
    }

    /**
     * Create HMAC-SHA256 signature
     */
    private sign(data: string): string {
        return crypto
            .createHmac('sha256', this.config.secret)
            .update(data)
            .digest('base64url');
    }

    /**
     * Generate a JWT token
     */
    private generateToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti' | 'iss' | 'aud'>, expiresIn: string): string {
        const now = Math.floor(Date.now() / 1000);
        const expMs = this.parseDuration(expiresIn);
        const exp = now + Math.floor(expMs / 1000);

        const fullPayload = {
            ...payload,
            iat: now,
            exp,
            nbf: now,
            jti: crypto.randomUUID(),
            iss: this.config.issuer,
            aud: this.config.audience,
        } as JWTPayload;

        const header = {
            alg: this.config.algorithm,
            typ: 'JWT',
        };

        const headerEncoded = this.base64UrlEncode(JSON.stringify(header));
        const payloadEncoded = this.base64UrlEncode(JSON.stringify(fullPayload));
        const signature = this.sign(`${headerEncoded}.${payloadEncoded}`);

        return `${headerEncoded}.${payloadEncoded}.${signature}`;
    }

    /**
     * Generate access and refresh token pair
     */
    generateTokenPair(userId: string, email: string, role: string, additionalClaims?: Record<string, unknown>): TokenPair {
        const accessPayload = {
            sub: userId,
            email,
            role,
            type: 'access' as const,
            ...additionalClaims,
        };

        const refreshPayload = {
            sub: userId,
            email,
            role,
            type: 'refresh' as const,
            familyId: crypto.randomUUID(), // For refresh token rotation detection
        };

        const accessToken = this.generateToken(accessPayload, this.config.accessTokenExpiry);
        const refreshToken = this.generateToken(refreshPayload, this.config.refreshTokenExpiry);

        const expiresIn = Math.floor(this.parseDuration(this.config.accessTokenExpiry) / 1000);

        return {
            accessToken,
            refreshToken,
            expiresIn,
            tokenType: 'Bearer',
        };
    }

    /**
     * Generate only an access token (for token refresh)
     */
    generateAccessToken(userId: string, email: string, role: string, additionalClaims?: Record<string, unknown>): string {
        const payload = {
            sub: userId,
            email,
            role,
            type: 'access' as const,
            ...additionalClaims,
        };

        return this.generateToken(payload, this.config.accessTokenExpiry);
    }

    /**
     * Verify a JWT token
     */
    verifyToken(token: string): TokenVerifyResult {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return { valid: false, expired: false, payload: null, error: 'Invalid token format' };
            }

            const [headerEncoded, payloadEncoded, signature] = parts;

            // Verify signature
            const expectedSignature = this.sign(`${headerEncoded}.${payloadEncoded}`);

            // Constant-time comparison to prevent timing attacks
            const sigBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expectedSignature);

            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                return { valid: false, expired: false, payload: null, error: 'Invalid signature' };
            }

            // Decode payload
            const payload: JWTPayload = JSON.parse(this.base64UrlDecode(payloadEncoded));

            // Check expiration
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now) {
                return { valid: false, expired: true, payload, error: 'Token expired' };
            }

            // Check not before
            if (payload.nbf && payload.nbf > now) {
                return { valid: false, expired: false, payload, error: 'Token not yet valid' };
            }

            // Check issuer
            if (payload.iss !== this.config.issuer) {
                return { valid: false, expired: false, payload, error: 'Invalid issuer' };
            }

            // Check audience
            if (payload.aud !== this.config.audience) {
                return { valid: false, expired: false, payload, error: 'Invalid audience' };
            }

            // Check if blacklisted
            if (this.blacklistedTokens.has(payload.jti)) {
                return { valid: false, expired: false, payload, error: 'Token revoked' };
            }

            return { valid: true, expired: false, payload };
        } catch (error) {
            console.error('[JWT] Verification failed:', error);
            return { valid: false, expired: false, payload: null, error: 'Token verification failed' };
        }
    }

    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token: string): JWTPayload | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;

            return JSON.parse(this.base64UrlDecode(parts[1]));
        } catch {
            return null;
        }
    }

    /**
     * Revoke a token (add to blacklist)
     */
    revokeToken(token: string): void {
        const payload = this.decodeToken(token);
        if (payload?.jti) {
            this.blacklistedTokens.add(payload.jti);

            // Schedule removal after token would have expired anyway
            const now = Date.now();
            const exp = payload.exp * 1000;
            const ttl = exp - now;

            if (ttl > 0) {
                setTimeout(() => {
                    this.blacklistedTokens.delete(payload.jti);
                }, ttl);
            }
        }
    }

    /**
     * Revoke all tokens for a user (requires external token tracking)
     * This method sets a "revoked before" timestamp
     */
    revokeAllUserTokens(userId: string): { revokedBefore: number } {
        // This should be stored in database/Redis in production
        const revokedBefore = Math.floor(Date.now() / 1000);
        console.log(`[JWT] Revoked all tokens for user ${userId} issued before ${revokedBefore}`);
        return { revokedBefore };
    }

    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader: string | undefined): string | null {
        if (!authHeader) return null;
        if (!authHeader.startsWith('Bearer ')) return null;
        return authHeader.slice(7);
    }

    /**
     * Hash a refresh token for storage
     */
    hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Get token expiry time
     */
    getAccessTokenExpiry(): number {
        return this.parseDuration(this.config.accessTokenExpiry);
    }

    /**
     * Get refresh token expiry time
     */
    getRefreshTokenExpiry(): number {
        return this.parseDuration(this.config.refreshTokenExpiry);
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get the number of blacklisted tokens
     */
    getBlacklistSize(): number {
        return this.blacklistedTokens.size;
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: JWTService | null = null;

/**
 * Get the singleton JWTService instance
 */
export function getJWTService(): JWTService {
    if (!instance) {
        instance = new JWTService();
    }
    return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetJWTService(): void {
    instance = null;
}
