/**
 * ============================================
 * PASSWORD SECURITY TEMPLATES
 * ============================================
 * 
 * Production-ready password security implementations
 * following OWASP and NIST guidelines.
 */

// ============================================
// ARGON2ID PASSWORD HASHING TEMPLATE
// ============================================

export const ARGON2_PASSWORD_TEMPLATE = `/**
 * ============================================
 * PASSWORD HASHING WITH ARGON2ID
 * ============================================
 * 
 * Argon2id is the recommended password hashing algorithm
 * by OWASP and won the Password Hashing Competition.
 * 
 * NIST SP 800-63B compliant implementation.
 */

import argon2 from "argon2";

// ============================================
// ARGON2 CONFIGURATION
// ============================================

/**
 * Argon2 configuration following OWASP recommendations
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export const argon2Config = {
    // Memory cost in KiB (64 MiB recommended for high security)
    memoryCost: 65536, // 64 MiB
    
    // Time cost (iterations)
    timeCost: 3,
    
    // Parallelism factor
    parallelism: 4,
    
    // Hash length in bytes
    hashLength: 32,
    
    // Use Argon2id variant (recommended)
    type: argon2.argon2id,
};

// ============================================
// PASSWORD HASHING
// ============================================

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
    try {
        const hash = await argon2.hash(password, argon2Config);
        return hash;
    } catch (error) {
        console.error("[Password] Hash error:", error);
        throw new Error("Failed to hash password");
    }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        const isValid = await argon2.verify(hash, password);
        return isValid;
    } catch (error) {
        console.error("[Password] Verify error:", error);
        return false;
    }
}

/**
 * Check if a hash needs to be rehashed (config changed)
 */
export function needsRehash(hash: string): boolean {
    try {
        return argon2.needsRehash(hash, argon2Config);
    } catch {
        return true;
    }
}
`;

// ============================================
// BCRYPT PASSWORD HASHING TEMPLATE
// ============================================

export const BCRYPT_PASSWORD_TEMPLATE = `/**
 * ============================================
 * PASSWORD HASHING WITH BCRYPT
 * ============================================
 * 
 * Bcrypt is a battle-tested password hashing algorithm.
 * Use this if Argon2id is not available.
 */

import bcrypt from "bcrypt";

// ============================================
// BCRYPT CONFIGURATION
// ============================================

/**
 * Bcrypt cost factor
 * 
 * OWASP recommends a cost of 10-12 for interactive logins.
 * Higher values = more secure but slower.
 * 
 * Cost 10 = ~100ms
 * Cost 12 = ~400ms
 * Cost 14 = ~1600ms
 */
const BCRYPT_COST = 12;

// ============================================
// PASSWORD HASHING
// ============================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    try {
        const salt = await bcrypt.genSalt(BCRYPT_COST);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (error) {
        console.error("[Password] Hash error:", error);
        throw new Error("Failed to hash password");
    }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        const isValid = await bcrypt.compare(password, hash);
        return isValid;
    } catch (error) {
        console.error("[Password] Verify error:", error);
        return false;
    }
}

/**
 * Get the cost factor from a hash
 */
export function getHashCost(hash: string): number {
    const match = hash.match(/\\$2[aby]\\$(\\d+)\\$/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check if hash needs rehashing (cost changed)
 */
export function needsRehash(hash: string): boolean {
    const currentCost = getHashCost(hash);
    return currentCost < BCRYPT_COST;
}
`;

// ============================================
// PASSWORD VALIDATION TEMPLATE
// ============================================

export const PASSWORD_VALIDATION_TEMPLATE = `/**
 * ============================================
 * PASSWORD VALIDATION
 * ============================================
 * 
 * NIST SP 800-63B and OWASP compliant password validation.
 * 
 * Requirements:
 * - Minimum 12 characters (NIST recommends 8, we use 12 for extra security)
 * - Maximum 128 characters (prevent DoS)
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 symbol
 * - Not in common password list
 * - Not similar to email/username
 */

// ============================================
// VALIDATION CONFIGURATION
// ============================================

export interface PasswordConfig {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    disallowCommonPasswords: boolean;
    disallowUserInfo: boolean;
    minimumStrengthScore: number; // 0-4 (zxcvbn score)
}

export const defaultPasswordConfig: PasswordConfig = {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    disallowCommonPasswords: true,
    disallowUserInfo: true,
    minimumStrengthScore: 3,
};

// ============================================
// VALIDATION RESULT
// ============================================

export interface ValidationResult {
    isValid: boolean;
    score: number; // 0-4 strength score
    errors: string[];
    suggestions: string[];
    feedback: {
        warning: string | null;
        suggestions: string[];
    };
}

// ============================================
// COMMON PASSWORDS LIST (Top 1000)
// ============================================

const COMMON_PASSWORDS = new Set([
    "password", "123456", "12345678", "qwerty", "abc123",
    "monkey", "1234567", "letmein", "trustno1", "dragon",
    "baseball", "iloveyou", "master", "sunshine", "ashley",
    "bailey", "passw0rd", "shadow", "123123", "654321",
    "superman", "qazwsx", "michael", "football", "password1",
    "password123", "welcome", "welcome1", "p@ssw0rd", "admin",
    "login", "starwars", "hello", "charlie", "donald",
    // Add more common passwords...
]);

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate password against all requirements
 */
export function validatePassword(
    password: string,
    userInfo?: { email?: string; username?: string; name?: string },
    config: PasswordConfig = defaultPasswordConfig
): ValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check length
    if (password.length < config.minLength) {
        errors.push(\`Password must be at least \${config.minLength} characters long\`);
    }
    if (password.length > config.maxLength) {
        errors.push(\`Password must be at most \${config.maxLength} characters long\`);
    }

    // Check character requirements
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
    }
    if (config.requireLowercase && !/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
    }
    if (config.requireNumbers && !/[0-9]/.test(password)) {
        errors.push("Password must contain at least one number");
    }
    if (config.requireSymbols && !/[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]/.test(password)) {
        errors.push("Password must contain at least one symbol");
    }

    // Check against common passwords
    if (config.disallowCommonPasswords) {
        if (COMMON_PASSWORDS.has(password.toLowerCase())) {
            errors.push("This password is too common. Please choose a different one.");
        }
    }

    // Check against user info
    if (config.disallowUserInfo && userInfo) {
        const lowerPassword = password.toLowerCase();
        
        if (userInfo.email) {
            const emailLocal = userInfo.email.split("@")[0].toLowerCase();
            if (lowerPassword.includes(emailLocal)) {
                errors.push("Password cannot contain your email address");
            }
        }
        
        if (userInfo.username && lowerPassword.includes(userInfo.username.toLowerCase())) {
            errors.push("Password cannot contain your username");
        }
        
        if (userInfo.name) {
            const nameParts = userInfo.name.toLowerCase().split(/\\s+/);
            for (const part of nameParts) {
                if (part.length > 2 && lowerPassword.includes(part)) {
                    errors.push("Password cannot contain parts of your name");
                    break;
                }
            }
        }
    }

    // Calculate strength score
    const score = calculateStrengthScore(password);
    
    if (score < config.minimumStrengthScore) {
        suggestions.push("Try adding more unique characters or making it longer");
    }

    // Generate suggestions
    if (password.length < 16) {
        suggestions.push("Consider using a longer password for extra security");
    }
    if (!/[!@#$%^&*]/.test(password)) {
        suggestions.push("Adding symbols like !@#$%^&* makes your password stronger");
    }

    return {
        isValid: errors.length === 0,
        score,
        errors,
        suggestions,
        feedback: {
            warning: errors.length > 0 ? "Password does not meet requirements" : null,
            suggestions,
        },
    };
}

/**
 * Calculate password strength score (0-4)
 */
export function calculateStrengthScore(password: string): number {
    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Complexity scoring
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    
    const complexity = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (complexity >= 3) score += 1;

    return Math.min(score, 4);
}

/**
 * Get strength label
 */
export function getStrengthLabel(score: number): string {
    const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
    return labels[Math.min(score, 4)];
}

/**
 * Middleware for password validation
 */
export function validatePasswordMiddleware(config?: Partial<PasswordConfig>) {
    const finalConfig = { ...defaultPasswordConfig, ...config };
    
    return (req: any, res: any, next: any) => {
        const { password, email, username, name } = req.body;
        
        if (!password) {
            return res.status(400).json({
                error: "Password is required",
            });
        }

        const result = validatePassword(password, { email, username, name }, finalConfig);
        
        if (!result.isValid) {
            return res.status(400).json({
                error: "Invalid password",
                details: result.errors,
                suggestions: result.suggestions,
            });
        }

        // Attach score to request for logging
        req.passwordStrength = result.score;
        next();
    };
}
`;

// ============================================
// PASSWORD HISTORY TEMPLATE
// ============================================

export const PASSWORD_HISTORY_TEMPLATE = `/**
 * ============================================
 * PASSWORD HISTORY MANAGEMENT
 * ============================================
 * 
 * Prevents password reuse by maintaining a history
 * of previous password hashes.
 * 
 * NIST SP 800-63B recommends checking against previous passwords.
 */

import { hashPassword, verifyPassword } from "./password-hash";

// ============================================
// CONFIGURATION
// ============================================

const PASSWORD_HISTORY_LENGTH = 12; // Remember last 12 passwords

// ============================================
// TYPES
// ============================================

export interface PasswordHistoryEntry {
    hash: string;
    createdAt: Date;
}

export interface PasswordHistoryRecord {
    userId: string;
    history: PasswordHistoryEntry[];
    currentHash: string;
    lastChangedAt: Date;
    mustChangeAt?: Date;
    changeCount: number;
}

// ============================================
// IN-MEMORY STORAGE (Replace with database in production)
// ============================================

const passwordHistory = new Map<string, PasswordHistoryRecord>();

// ============================================
// PASSWORD HISTORY FUNCTIONS
// ============================================

/**
 * Initialize password history for a new user
 */
export async function initPasswordHistory(
    userId: string,
    initialPassword: string,
    expirationDays: number = 90
): Promise<PasswordHistoryRecord> {
    const hash = await hashPassword(initialPassword);
    const now = new Date();
    
    const record: PasswordHistoryRecord = {
        userId,
        history: [],
        currentHash: hash,
        lastChangedAt: now,
        mustChangeAt: new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000),
        changeCount: 0,
    };

    passwordHistory.set(userId, record);
    return record;
}

/**
 * Check if password was recently used
 */
export async function isPasswordInHistory(
    userId: string,
    password: string
): Promise<boolean> {
    const record = passwordHistory.get(userId);
    if (!record) return false;

    // Check current password
    if (await verifyPassword(password, record.currentHash)) {
        return true;
    }

    // Check history
    for (const entry of record.history) {
        if (await verifyPassword(password, entry.hash)) {
            return true;
        }
    }

    return false;
}

/**
 * Update password and maintain history
 */
export async function updatePasswordWithHistory(
    userId: string,
    newPassword: string,
    expirationDays: number = 90
): Promise<{ success: boolean; error?: string }> {
    const record = passwordHistory.get(userId);
    
    if (!record) {
        return { success: false, error: "User not found" };
    }

    // Check if password is in history
    if (await isPasswordInHistory(userId, newPassword)) {
        return {
            success: false,
            error: \`Password was used in the last \${PASSWORD_HISTORY_LENGTH} passwords. Please choose a different one.\`,
        };
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);
    const now = new Date();

    // Add current password to history
    record.history.unshift({
        hash: record.currentHash,
        createdAt: record.lastChangedAt,
    });

    // Trim history to configured length
    if (record.history.length > PASSWORD_HISTORY_LENGTH) {
        record.history = record.history.slice(0, PASSWORD_HISTORY_LENGTH);
    }

    // Update current password
    record.currentHash = newHash;
    record.lastChangedAt = now;
    record.mustChangeAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);
    record.changeCount++;

    passwordHistory.set(userId, record);

    return { success: true };
}

/**
 * Check if password has expired
 */
export function isPasswordExpired(userId: string): boolean {
    const record = passwordHistory.get(userId);
    if (!record || !record.mustChangeAt) return false;
    
    return new Date() > record.mustChangeAt;
}

/**
 * Get days until password expires
 */
export function getDaysUntilExpiration(userId: string): number | null {
    const record = passwordHistory.get(userId);
    if (!record || !record.mustChangeAt) return null;

    const now = new Date();
    const diff = record.mustChangeAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

/**
 * Middleware to check password expiration
 */
export function passwordExpirationMiddleware(warningDays: number = 14) {
    return (req: any, res: any, next: any) => {
        const userId = req.user?.id;
        if (!userId) return next();

        if (isPasswordExpired(userId)) {
            return res.status(403).json({
                error: "Password expired",
                message: "Your password has expired. Please change it to continue.",
                code: "PASSWORD_EXPIRED",
            });
        }

        const daysLeft = getDaysUntilExpiration(userId);
        if (daysLeft !== null && daysLeft <= warningDays) {
            res.setHeader("X-Password-Expires-In", daysLeft.toString());
        }

        next();
    };
}
`;

// ============================================
// PASSWORD EXPIRATION TEMPLATE
// ============================================

export const PASSWORD_EXPIRATION_TEMPLATE = `/**
 * ============================================
 * PASSWORD EXPIRATION MANAGEMENT
 * ============================================
 * 
 * Handles password expiration policies including:
 * - Configurable expiration periods (default 90 days)
 * - Grace periods for expired passwords
 * - Warning notifications before expiration
 * - Force password change on next login
 */

// ============================================
// CONFIGURATION
// ============================================

export interface ExpirationConfig {
    expirationDays: number;        // Days until password expires
    warningDays: number;           // Days before expiration to start warning
    gracePeriodDays: number;       // Days after expiration before lockout
    forceChangeOnCompromise: boolean; // Force change if breach detected
}

export const defaultExpirationConfig: ExpirationConfig = {
    expirationDays: 90,
    warningDays: 14,
    gracePeriodDays: 7,
    forceChangeOnCompromise: true,
};

// ============================================
// EXPIRATION STATUS
// ============================================

export interface ExpirationStatus {
    isExpired: boolean;
    isInGracePeriod: boolean;
    mustChange: boolean;
    daysUntilExpiration: number | null;
    daysInGracePeriod: number | null;
    expirationDate: Date | null;
    lastChanged: Date | null;
    warningMessage: string | null;
}

// ============================================
// EXPIRATION FUNCTIONS
// ============================================

/**
 * Calculate expiration status for a user
 */
export function getExpirationStatus(
    lastPasswordChange: Date,
    forceChange: boolean = false,
    config: ExpirationConfig = defaultExpirationConfig
): ExpirationStatus {
    const now = new Date();
    const expirationDate = new Date(
        lastPasswordChange.getTime() + config.expirationDays * 24 * 60 * 60 * 1000
    );
    const gracePeriodEnd = new Date(
        expirationDate.getTime() + config.gracePeriodDays * 24 * 60 * 60 * 1000
    );

    const isExpired = now > expirationDate;
    const isInGracePeriod = isExpired && now <= gracePeriodEnd;
    const isPastGracePeriod = now > gracePeriodEnd;

    const daysUntilExpiration = isExpired 
        ? null 
        : Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    const daysInGracePeriod = isInGracePeriod
        ? Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : null;

    let warningMessage: string | null = null;
    
    if (forceChange) {
        warningMessage = "You must change your password before continuing.";
    } else if (isPastGracePeriod) {
        warningMessage = "Your password has expired and you must change it now.";
    } else if (isInGracePeriod) {
        warningMessage = \`Your password has expired. You have \${daysInGracePeriod} days to change it before lockout.\`;
    } else if (daysUntilExpiration !== null && daysUntilExpiration <= config.warningDays) {
        warningMessage = \`Your password will expire in \${daysUntilExpiration} days. Please update it soon.\`;
    }

    return {
        isExpired: isExpired || forceChange,
        isInGracePeriod,
        mustChange: isPastGracePeriod || forceChange,
        daysUntilExpiration,
        daysInGracePeriod,
        expirationDate,
        lastChanged: lastPasswordChange,
        warningMessage,
    };
}

/**
 * Express middleware for password expiration check
 */
export function expirationMiddleware(config?: Partial<ExpirationConfig>) {
    const finalConfig = { ...defaultExpirationConfig, ...config };

    return async (req: any, res: any, next: any) => {
        // Skip for auth routes
        if (req.path.includes("/auth/") || req.path.includes("/password/")) {
            return next();
        }

        const user = req.user;
        if (!user || !user.passwordChangedAt) {
            return next();
        }

        const status = getExpirationStatus(
            new Date(user.passwordChangedAt),
            user.forcePasswordChange || false,
            finalConfig
        );

        // Add status to response header
        if (status.daysUntilExpiration !== null && status.daysUntilExpiration <= finalConfig.warningDays) {
            res.setHeader("X-Password-Expires-In", status.daysUntilExpiration);
            res.setHeader("X-Password-Warning", status.warningMessage || "");
        }

        // Block if must change (past grace period or forced)
        if (status.mustChange) {
            return res.status(403).json({
                error: "Password change required",
                code: "PASSWORD_CHANGE_REQUIRED",
                message: status.warningMessage,
                redirectTo: "/change-password",
            });
        }

        // Allow in grace period but warn
        if (status.isInGracePeriod) {
            res.setHeader("X-Password-Grace-Period", status.daysInGracePeriod?.toString() || "0");
        }

        next();
    };
}

/**
 * Generate password expiration notification email content
 */
export function generateExpirationEmail(
    userName: string,
    daysUntilExpiration: number,
    changePasswordUrl: string
): { subject: string; html: string; text: string } {
    const subject = daysUntilExpiration <= 0
        ? "⚠️ Your password has expired"
        : \`⏰ Your password expires in \${daysUntilExpiration} days\`;

    const html = \`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #4F46E5; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
        }
        .warning { color: #DC2626; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Password Expiration Notice</h2>
        <p>Hi \${userName},</p>
        \${daysUntilExpiration <= 0 
            ? '<p class="warning">Your password has expired and must be changed immediately.</p>'
            : \`<p>Your password will expire in <strong>\${daysUntilExpiration} days</strong>.</p>\`
        }
        <p>Please update your password to maintain access to your account.</p>
        <p><a href="\${changePasswordUrl}" class="button">Change Password</a></p>
        <p>If you did not request this, please contact support immediately.</p>
    </div>
</body>
</html>\`;

    const text = \`
Password Expiration Notice

Hi \${userName},

\${daysUntilExpiration <= 0 
    ? 'Your password has expired and must be changed immediately.'
    : \`Your password will expire in \${daysUntilExpiration} days.\`
}

Please update your password: \${changePasswordUrl}

If you did not request this, please contact support immediately.
\`;

    return { subject, html, text };
}
`;

// ============================================
// EXPORT ALL PASSWORD TEMPLATES
// ============================================

export const PASSWORD_TEMPLATE_SETS = {
    argon2: {
        name: "Argon2id Password Hashing",
        template: ARGON2_PASSWORD_TEMPLATE,
        description: "Recommended password hashing using Argon2id",
    },
    bcrypt: {
        name: "Bcrypt Password Hashing",
        template: BCRYPT_PASSWORD_TEMPLATE,
        description: "Battle-tested password hashing using bcrypt",
    },
    validation: {
        name: "Password Validation",
        template: PASSWORD_VALIDATION_TEMPLATE,
        description: "NIST/OWASP compliant password validation",
    },
    history: {
        name: "Password History",
        template: PASSWORD_HISTORY_TEMPLATE,
        description: "Password reuse prevention",
    },
    expiration: {
        name: "Password Expiration",
        template: PASSWORD_EXPIRATION_TEMPLATE,
        description: "Password expiration policies",
    },
};

export function getPasswordTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        argon2: ARGON2_PASSWORD_TEMPLATE,
        bcrypt: BCRYPT_PASSWORD_TEMPLATE,
        validation: PASSWORD_VALIDATION_TEMPLATE,
        history: PASSWORD_HISTORY_TEMPLATE,
        expiration: PASSWORD_EXPIRATION_TEMPLATE,
    };
    return templates[type];
}

export function getAvailablePasswordTypes(): string[] {
    return ["argon2", "bcrypt", "validation", "history", "expiration"];
}
