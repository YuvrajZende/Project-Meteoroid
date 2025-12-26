/**
 * Multi-Factor Authentication (MFA) Service
 * Implements TOTP (Time-based One-Time Password) for 2FA
 * 
 * Features:
 * - TOTP secret generation (RFC 6238)
 * - QR code URL generation for authenticator apps
 * - TOTP verification with time window tolerance
 * - Backup codes generation and verification
 * - Database integration with user_mfa table
 * 
 * @module services/mfa-service
 */

import crypto from 'crypto';
import { getSupabaseAdmin } from '../infrastructure/database-client.js';

// ============================================
// TOTP CONFIGURATION
// ============================================

const TOTP_CONFIG = {
    /** Algorithm for HMAC */
    algorithm: 'SHA1' as const,
    /** Number of digits in TOTP code */
    digits: 6,
    /** Time step in seconds (standard is 30) */
    period: 30,
    /** Time window tolerance (allows codes from ±1 period) */
    window: 1,
    /** Issuer name for authenticator apps */
    issuer: 'Loveable Backend',
    /** Secret length in bytes */
    secretLength: 20,
};

const BACKUP_CODES_CONFIG = {
    /** Number of backup codes to generate */
    count: 10,
    /** Length of each backup code */
    length: 8,
};

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface MFASetupResult {
    success: boolean;
    secret?: string;
    qrCodeUrl?: string;
    backupCodes?: string[];
    error?: string;
}

export interface MFAVerifyResult {
    valid: boolean;
    usedBackupCode?: boolean;
    error?: string;
}

export interface MFAStatus {
    enabled: boolean;
    verifiedAt?: Date;
    backupCodesRemaining?: number;
}

// ============================================
// TOTP IMPLEMENTATION (RFC 6238)
// ============================================

/**
 * Generate a cryptographically secure random secret for TOTP
 */
function generateSecret(length: number = TOTP_CONFIG.secretLength): string {
    const buffer = crypto.randomBytes(length);
    return base32Encode(buffer);
}

/**
 * Base32 encoding (RFC 4648)
 */
function base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
}

/**
 * Base32 decoding (RFC 4648)
 */
function base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');

    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const char of cleanedInput) {
        const index = alphabet.indexOf(char);
        if (index === -1) continue;

        value = (value << 5) | index;
        bits += 5;

        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Buffer.from(output);
}

/**
 * Generate TOTP code for a given time
 */
function generateTOTP(secret: string, time: number = Date.now()): string {
    const secretBuffer = base32Decode(secret);
    const counter = Math.floor(time / 1000 / TOTP_CONFIG.period);

    // Convert counter to 8-byte buffer (big-endian)
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    // Generate HMAC
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const hash = hmac.digest();

    // Dynamic truncation (RFC 4226)
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    // Generate OTP
    const otp = binary % Math.pow(10, TOTP_CONFIG.digits);
    return otp.toString().padStart(TOTP_CONFIG.digits, '0');
}

/**
 * Verify TOTP code with time window tolerance
 */
function verifyTOTP(secret: string, code: string, window: number = TOTP_CONFIG.window): boolean {
    const now = Date.now();

    // Check current and adjacent time windows
    for (let i = -window; i <= window; i++) {
        const time = now + (i * TOTP_CONFIG.period * 1000);
        const expectedCode = generateTOTP(secret, time);

        // Constant-time comparison to prevent timing attacks
        if (crypto.timingSafeEqual(
            Buffer.from(code.padStart(TOTP_CONFIG.digits, '0')),
            Buffer.from(expectedCode)
        )) {
            return true;
        }
    }

    return false;
}

/**
 * Generate QR code URL for authenticator apps
 */
function generateQRCodeUrl(secret: string, email: string): string {
    const issuer = encodeURIComponent(TOTP_CONFIG.issuer);
    const account = encodeURIComponent(email);

    // otpauth://totp/Issuer:account?secret=XXX&issuer=Issuer&algorithm=SHA1&digits=6&period=30
    return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=${TOTP_CONFIG.algorithm}&digits=${TOTP_CONFIG.digits}&period=${TOTP_CONFIG.period}`;
}

// ============================================
// BACKUP CODES
// ============================================

/**
 * Generate backup codes
 */
function generateBackupCodes(): string[] {
    const codes: string[] = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars

    for (let i = 0; i < BACKUP_CODES_CONFIG.count; i++) {
        let code = '';
        for (let j = 0; j < BACKUP_CODES_CONFIG.length; j++) {
            code += chars[crypto.randomInt(chars.length)];
        }
        // Format: XXXX-XXXX
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    return codes;
}

/**
 * Hash backup codes for storage
 */
async function hashBackupCodes(codes: string[]): Promise<string[]> {
    const hashed: string[] = [];
    for (const code of codes) {
        // Simple SHA-256 hash for backup codes (they're single-use)
        const hash = crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
        hashed.push(hash);
    }
    return hashed;
}

/**
 * Verify backup code
 */
function verifyBackupCode(code: string, hashedCodes: string[]): number {
    const cleanCode = code.replace('-', '').toUpperCase();
    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

    for (let i = 0; i < hashedCodes.length; i++) {
        if (crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hashedCodes[i]))) {
            return i; // Return index of matched code
        }
    }

    return -1; // Not found
}

/**
 * Simple encryption for TOTP secret storage
 * Uses AES-256-GCM with a key derived from environment variable
 */
function encryptSecret(secret: string): string {
    const key = crypto.createHash('sha256')
        .update(process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'mfa-default-key')
        .digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt TOTP secret
 */
function decryptSecret(encryptedData: string): string {
    const key = crypto.createHash('sha256')
        .update(process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'mfa-default-key')
        .digest();

    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

// ============================================
// MFA SERVICE CLASS
// ============================================

export class MFAService {
    private initialized = false;

    constructor() {
        this.initialized = true;
    }

    /**
     * Check if MFA service is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Setup MFA for a user (generate secret and backup codes)
     */
    async setupMFA(userId: string, email: string): Promise<MFASetupResult> {
        try {
            const supabase = getSupabaseAdmin();

            // Check if user already has MFA
            const { data: existing } = await supabase
                .from('user_mfa')
                .select('id, mfa_enabled')
                .eq('user_id', userId)
                .single();

            if (existing?.mfa_enabled) {
                return {
                    success: false,
                    error: 'MFA is already enabled for this user',
                };
            }

            // Generate TOTP secret
            const secret = generateSecret();

            // Generate QR code URL
            const qrCodeUrl = generateQRCodeUrl(secret, email);

            // Generate backup codes
            const backupCodes = generateBackupCodes();
            const hashedBackupCodes = await hashBackupCodes(backupCodes);

            // Encrypt the secret for storage (not hash - we need to recover it)
            const encryptedSecret = encryptSecret(secret);

            // Store in database (upsert)
            const { error } = await supabase.from('user_mfa').upsert({
                user_id: userId,
                mfa_enabled: false, // Not enabled until verified
                totp_secret_encrypted: encryptedSecret,
                backup_codes_hashed: hashedBackupCodes,
                recovery_email: email,
            }, { onConflict: 'user_id' });

            if (error) {
                throw error;
            }

            return {
                success: true,
                secret, // Return plain secret for QR code display
                qrCodeUrl,
                backupCodes, // Return plain backup codes (show once)
            };
        } catch (err) {
            console.error('[MFA] Setup error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : 'MFA setup failed',
            };
        }
    }

    /**
     * Verify and enable MFA (called after user confirms with TOTP code)
     */
    async enableMFA(userId: string, totpCode: string): Promise<MFAVerifyResult> {
        try {
            const supabase = getSupabaseAdmin();

            // Get user's MFA record
            const { data, error } = await supabase
                .from('user_mfa')
                .select('totp_secret_encrypted, mfa_enabled')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return {
                    valid: false,
                    error: 'MFA not set up for this user',
                };
            }

            if (data.mfa_enabled) {
                return {
                    valid: false,
                    error: 'MFA is already enabled',
                };
            }

            // Decrypt the stored TOTP secret
            const secret = decryptSecret(data.totp_secret_encrypted);

            // Verify the provided TOTP code
            const isValid = verifyTOTP(secret, totpCode);

            if (!isValid) {
                return {
                    valid: false,
                    error: 'Invalid TOTP code. Please try again.',
                };
            }

            // Enable MFA for the user
            const { error: updateError } = await supabase
                .from('user_mfa')
                .update({
                    mfa_enabled: true,
                    verified_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

            if (updateError) {
                throw updateError;
            }

            return {
                valid: true,
            };
        } catch (err) {
            console.error('[MFA] Enable error:', err);
            return {
                valid: false,
                error: err instanceof Error ? err.message : 'MFA enable failed',
            };
        }
    }

    /**
     * Verify TOTP code during login
     */
    async verifyMFA(userId: string, code: string): Promise<MFAVerifyResult> {
        try {
            const supabase = getSupabaseAdmin();

            // Get user's MFA record
            const { data, error } = await supabase
                .from('user_mfa')
                .select('totp_secret_encrypted, backup_codes_hashed, mfa_enabled')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return {
                    valid: false,
                    error: 'MFA not configured for this user',
                };
            }

            if (!data.mfa_enabled) {
                return {
                    valid: true, // MFA not enabled, allow through
                };
            }

            // Check if it's a backup code (format: XXXX-XXXX)
            if (code.includes('-') && code.length === 9) {
                const index = verifyBackupCode(code, data.backup_codes_hashed || []);

                if (index >= 0) {
                    // Remove used backup code
                    const updatedCodes = [...(data.backup_codes_hashed || [])];
                    updatedCodes.splice(index, 1);

                    await supabase
                        .from('user_mfa')
                        .update({ backup_codes_hashed: updatedCodes })
                        .eq('user_id', userId);

                    return {
                        valid: true,
                        usedBackupCode: true,
                    };
                }
            }

            // Verify TOTP code - decrypt secret and verify
            try {
                const secret = decryptSecret(data.totp_secret_encrypted);
                const isValid = verifyTOTP(secret, code);

                if (isValid) {
                    return { valid: true };
                }
            } catch (decryptError) {
                console.error('[MFA] Decryption error:', decryptError);
            }

            return {
                valid: false,
                error: 'Invalid verification code',
            };
        } catch (err) {
            console.error('[MFA] Verify error:', err);
            return {
                valid: false,
                error: err instanceof Error ? err.message : 'MFA verification failed',
            };
        }
    }

    /**
     * Disable MFA for a user
     */
    async disableMFA(userId: string, totpCode: string): Promise<{ success: boolean; error?: string }> {
        try {
            // First verify the TOTP code
            const verification = await this.verifyMFA(userId, totpCode);

            if (!verification.valid) {
                return {
                    success: false,
                    error: 'Invalid verification code',
                };
            }

            const supabase = getSupabaseAdmin();

            const { error } = await supabase
                .from('user_mfa')
                .update({
                    mfa_enabled: false,
                    totp_secret_encrypted: null,
                    backup_codes_hashed: null,
                    verified_at: null,
                })
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (err) {
            console.error('[MFA] Disable error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : 'MFA disable failed',
            };
        }
    }

    /**
     * Get MFA status for a user
     */
    async getMFAStatus(userId: string): Promise<MFAStatus> {
        try {
            const supabase = getSupabaseAdmin();

            const { data, error } = await supabase
                .from('user_mfa')
                .select('mfa_enabled, verified_at, backup_codes_hashed')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return { enabled: false };
            }

            return {
                enabled: data.mfa_enabled || false,
                verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
                backupCodesRemaining: data.backup_codes_hashed?.length || 0,
            };
        } catch (err) {
            console.error('[MFA] Status error:', err);
            return { enabled: false };
        }
    }

    /**
     * Regenerate backup codes
     */
    async regenerateBackupCodes(userId: string, totpCode: string): Promise<{
        success: boolean;
        backupCodes?: string[];
        error?: string;
    }> {
        try {
            // Verify TOTP first
            const verification = await this.verifyMFA(userId, totpCode);

            if (!verification.valid && !verification.usedBackupCode) {
                return {
                    success: false,
                    error: 'Invalid verification code',
                };
            }

            const supabase = getSupabaseAdmin();

            // Generate new backup codes
            const backupCodes = generateBackupCodes();
            const hashedBackupCodes = await hashBackupCodes(backupCodes);

            const { error } = await supabase
                .from('user_mfa')
                .update({ backup_codes_hashed: hashedBackupCodes })
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            return {
                success: true,
                backupCodes,
            };
        } catch (err) {
            console.error('[MFA] Regenerate backup codes error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to regenerate backup codes',
            };
        }
    }

    /**
     * Check if user requires MFA verification
     */
    async requiresMFA(userId: string): Promise<boolean> {
        const status = await this.getMFAStatus(userId);
        return status.enabled;
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let mfaServiceInstance: MFAService | null = null;

export function getMFAService(): MFAService {
    if (!mfaServiceInstance) {
        mfaServiceInstance = new MFAService();
    }
    return mfaServiceInstance;
}

export default {
    MFAService,
    getMFAService,
    generateTOTP,
    verifyTOTP,
    generateSecret,
    generateQRCodeUrl,
};
