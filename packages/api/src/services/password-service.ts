/**
 * Password Service
 * Secure password hashing and verification using Argon2id
 * 
 * Argon2id is the recommended algorithm for password hashing as of 2024.
 * It combines Argon2i (data-independent, side-channel resistant) and 
 * Argon2d (data-dependent, GPU resistant) to provide robust security.
 * 
 * @module services/password-service
 */

import argon2 from 'argon2';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Argon2id configuration following OWASP recommendations
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export interface PasswordHashConfig {
    /** Memory cost in KiB (default: 65536 = 64 MB) */
    memoryCost: number;
    /** Time cost / iterations (default: 3) */
    timeCost: number;
    /** Parallelism / threads (default: 4) */
    parallelism: number;
    /** Hash length in bytes (default: 32) */
    hashLength: number;
}

/**
 * Password strength requirements
 */
export interface PasswordRequirements {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    specialChars: string;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
    strength: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong';
    score: number;
}

/**
 * Password comparison result
 */
export interface PasswordVerifyResult {
    valid: boolean;
    needsRehash: boolean;
}

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

/**
 * Default Argon2id configuration
 * These settings provide a good balance between security and performance
 */
const DEFAULT_HASH_CONFIG: PasswordHashConfig = {
    memoryCost: 65536,    // 64 MB - recommended minimum
    timeCost: 3,          // 3 iterations
    parallelism: 4,       // 4 parallel threads
    hashLength: 32,       // 256-bit hash
};

/**
 * Default password requirements
 */
const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

// ============================================
// PASSWORD SERVICE CLASS
// ============================================

/**
 * Password Service
 * Handles secure password hashing, verification, and validation
 */
export class PasswordService {
    private hashConfig: PasswordHashConfig;
    private requirements: PasswordRequirements;
    private initialized: boolean = false;

    constructor(
        hashConfig?: Partial<PasswordHashConfig>,
        requirements?: Partial<PasswordRequirements>
    ) {
        this.hashConfig = {
            ...DEFAULT_HASH_CONFIG,
            ...hashConfig,
        };

        this.requirements = {
            ...DEFAULT_PASSWORD_REQUIREMENTS,
            ...requirements,
        };
    }

    /**
     * Initialize the password service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Validate argon2 is working by doing a test hash
        try {
            const testHash = await argon2.hash('test', {
                type: argon2.argon2id,
                memoryCost: 1024, // Low memory for quick test
                timeCost: 1,
                parallelism: 1,
            });
            
            if (!testHash.startsWith('$argon2id$')) {
                throw new Error('Argon2id not configured correctly');
            }
            
            this.initialized = true;
        } catch (error) {
            console.error('[PASSWORD] Initialization failed:', error);
            throw new Error('Password service initialization failed');
        }
    }

    /**
     * Hash a password using Argon2id
     * @param password - Plain text password
     * @returns Hashed password string
     */
    async hashPassword(password: string): Promise<string> {
        // Validate password meets requirements first
        const validation = this.validatePassword(password);
        if (!validation.valid) {
            throw new Error(`Password does not meet requirements: ${validation.errors.join(', ')}`);
        }

        try {
            const hash = await argon2.hash(password, {
                type: argon2.argon2id,
                memoryCost: this.hashConfig.memoryCost,
                timeCost: this.hashConfig.timeCost,
                parallelism: this.hashConfig.parallelism,
                hashLength: this.hashConfig.hashLength,
            });

            return hash;
        } catch (error) {
            console.error('[PASSWORD] Hash error:', error);
            throw new Error('Failed to hash password');
        }
    }

    /**
     * Verify a password against a hash
     * @param hash - Stored password hash
     * @param password - Plain text password to verify
     * @returns Verification result with rehash recommendation
     */
    async verifyPassword(hash: string, password: string): Promise<PasswordVerifyResult> {
        try {
            const valid = await argon2.verify(hash, password);

            // Check if password needs to be rehashed (e.g., config changed)
            let needsRehash = false;
            if (valid) {
                needsRehash = argon2.needsRehash(hash, {
                    memoryCost: this.hashConfig.memoryCost,
                    timeCost: this.hashConfig.timeCost,
                    parallelism: this.hashConfig.parallelism,
                });
            }

            return { valid, needsRehash };
        } catch (error) {
            // If hash is invalid format, verification fails
            console.error('[PASSWORD] Verify error:', error);
            return { valid: false, needsRehash: false };
        }
    }

    /**
     * Validate password strength and requirements
     * @param password - Password to validate
     * @returns Validation result with strength assessment
     */
    validatePassword(password: string): PasswordValidationResult {
        const errors: string[] = [];
        let score = 0;

        // Length checks
        if (password.length < this.requirements.minLength) {
            errors.push(`Password must be at least ${this.requirements.minLength} characters`);
        } else {
            score += 20;
        }

        if (password.length > this.requirements.maxLength) {
            errors.push(`Password must be at most ${this.requirements.maxLength} characters`);
        }

        // Bonus for length
        if (password.length >= 12) score += 10;
        if (password.length >= 16) score += 10;

        // Uppercase check
        if (this.requirements.requireUppercase) {
            if (!/[A-Z]/.test(password)) {
                errors.push('Password must contain at least one uppercase letter');
            } else {
                score += 15;
            }
        }

        // Lowercase check
        if (this.requirements.requireLowercase) {
            if (!/[a-z]/.test(password)) {
                errors.push('Password must contain at least one lowercase letter');
            } else {
                score += 15;
            }
        }

        // Number check
        if (this.requirements.requireNumbers) {
            if (!/[0-9]/.test(password)) {
                errors.push('Password must contain at least one number');
            } else {
                score += 15;
            }
        }

        // Special character check
        if (this.requirements.requireSpecialChars) {
            const specialCharsRegex = new RegExp(`[${this.escapeRegex(this.requirements.specialChars)}]`);
            if (!specialCharsRegex.test(password)) {
                errors.push('Password must contain at least one special character');
            } else {
                score += 15;
            }
        }

        // Bonus for variety
        const uniqueChars = new Set(password).size;
        if (uniqueChars >= password.length * 0.7) score += 10;

        // Check for common patterns (penalty)
        if (this.hasCommonPatterns(password)) {
            score = Math.max(0, score - 20);
        }

        // Determine strength
        let strength: PasswordValidationResult['strength'];
        if (score >= 90) strength = 'very_strong';
        else if (score >= 70) strength = 'strong';
        else if (score >= 50) strength = 'good';
        else if (score >= 30) strength = 'fair';
        else strength = 'weak';

        return {
            valid: errors.length === 0,
            errors,
            strength,
            score: Math.min(100, score),
        };
    }

    /**
     * Check for common password patterns
     */
    private hasCommonPatterns(password: string): boolean {
        const lowercased = password.toLowerCase();
        
        const commonPatterns = [
            'password', 'qwerty', '123456', 'abc123',
            'letmein', 'welcome', 'admin', 'login',
            'master', 'dragon', 'monkey', 'shadow',
        ];

        for (const pattern of commonPatterns) {
            if (lowercased.includes(pattern)) {
                return true;
            }
        }

        // Check for sequential patterns
        if (/(.)\1{2,}/.test(password)) {
            return true; // 3+ repeated characters
        }

        if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
            return true; // Sequential letters
        }

        if (/(?:012|123|234|345|456|567|678|789|890)/.test(password)) {
            return true; // Sequential numbers
        }

        return false;
    }

    /**
     * Escape special regex characters
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get password requirements for display
     */
    getRequirements(): PasswordRequirements {
        return { ...this.requirements };
    }

    /**
     * Get hash configuration (without sensitive data)
     */
    getConfig(): PasswordHashConfig {
        return { ...this.hashConfig };
    }

    /**
     * Generate a secure random password
     * @param length - Password length (default: 16)
     * @returns Generated password
     */
    generateSecurePassword(length: number = 16): string {
        const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
        const numberChars = '0123456789';
        const specialChars = this.requirements.specialChars;
        
        const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
        
        // Ensure at least one of each required type
        let password = '';
        if (this.requirements.requireUppercase) {
            password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
        }
        if (this.requirements.requireLowercase) {
            password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
        }
        if (this.requirements.requireNumbers) {
            password += numberChars[Math.floor(Math.random() * numberChars.length)];
        }
        if (this.requirements.requireSpecialChars) {
            password += specialChars[Math.floor(Math.random() * specialChars.length)];
        }

        // Fill remaining length with random characters
        while (password.length < length) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }

        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: PasswordService | null = null;

/**
 * Get the singleton PasswordService instance
 */
export function getPasswordService(): PasswordService {
    if (!instance) {
        instance = new PasswordService();
    }
    return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetPasswordService(): void {
    instance = null;
}
