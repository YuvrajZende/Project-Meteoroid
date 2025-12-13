/**
 * Encryption Service
 * AES-256-GCM encryption for sensitive data at rest
 * 
 * Uses Galois/Counter Mode (GCM) which provides both 
 * confidentiality and authenticity (AEAD - Authenticated Encryption with Associated Data).
 * 
 * @module services/encryption-service
 */

import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
    /** Master encryption key (32 bytes for AES-256) */
    masterKey: string;
    /** Salt for key derivation */
    salt: string;
    /** Algorithm to use */
    algorithm: 'aes-256-gcm' | 'aes-256-cbc';
    /** Key derivation iterations */
    keyDerivationIterations: number;
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
    /** Initialization vector (hex) */
    iv: string;
    /** Authentication tag (hex) - only for GCM */
    authTag: string;
    /** Encrypted content (hex) */
    content: string;
    /** Algorithm used */
    algorithm: string;
    /** Version for future compatibility */
    version: number;
}

/**
 * Key rotation information
 */
export interface KeyInfo {
    /** Key ID */
    keyId: string;
    /** When the key was created */
    createdAt: Date;
    /** Whether this is the current active key */
    active: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const _AUTH_TAG_LENGTH = 16; // 128 bits - reserved for future validation
const KEY_LENGTH = 32; // 256 bits
const CURRENT_VERSION = 1;

// ============================================
// ENCRYPTION SERVICE CLASS
// ============================================

/**
 * Encryption Service
 * Handles AES-256-GCM encryption/decryption of sensitive data
 */
export class EncryptionService {
    private masterKey: Buffer | null = null;
    private salt: string;
    private keyDerivationIterations: number;
    private initialized: boolean = false;
    private keyCache: Map<string, Buffer> = new Map();

    constructor(config?: Partial<EncryptionConfig>) {
        this.salt = config?.salt || process.env.ENCRYPTION_SALT || 'default-salt-change-in-production';
        this.keyDerivationIterations = config?.keyDerivationIterations || 100000;

        // Initialize with master key from config or env
        const masterKeySource = config?.masterKey || process.env.ENCRYPTION_KEY;

        if (masterKeySource) {
            this.deriveKey(masterKeySource);
        }
    }

    /**
     * Initialize the encryption service
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        if (!this.masterKey) {
            const envKey = process.env.ENCRYPTION_KEY;
            if (!envKey) {
                console.warn('[ENCRYPTION] No ENCRYPTION_KEY found in environment. Encryption disabled.');
                return;
            }
            this.deriveKey(envKey);
        }

        // Validate encryption is working
        try {
            const testData = 'encryption-test';
            const encrypted = this.encrypt(testData);
            const decrypted = this.decrypt(encrypted);

            if (decrypted !== testData) {
                throw new Error('Encryption round-trip failed');
            }

            this.initialized = true;
        } catch (error) {
            console.error('[ENCRYPTION] Initialization failed:', error);
            throw new Error('Encryption service initialization failed');
        }
    }

    /**
     * Derive encryption key from master key using PBKDF2
     */
    private deriveKey(masterKeySource: string): void {
        this.masterKey = crypto.pbkdf2Sync(
            masterKeySource,
            this.salt,
            this.keyDerivationIterations,
            KEY_LENGTH,
            'sha512'
        );
    }

    /**
     * Derive a field-specific key for additional security
     * Each field can have its own derived key
     */
    private deriveFieldKey(fieldName: string): Buffer {
        if (!this.masterKey) {
            throw new Error('Encryption not initialized');
        }

        // Check cache first
        const cached = this.keyCache.get(fieldName);
        if (cached) return cached;

        // Derive field-specific key
        const fieldKey = crypto.pbkdf2Sync(
            this.masterKey,
            `${this.salt}:${fieldName}`,
            1000, // Fewer iterations since master key is already secure
            KEY_LENGTH,
            'sha256'
        );

        this.keyCache.set(fieldName, fieldKey);
        return fieldKey;
    }

    /**
     * Encrypt plaintext data
     * @param plaintext - Data to encrypt
     * @param fieldName - Optional field name for field-specific key derivation
     * @returns Encrypted data as string (can be stored in database)
     */
    encrypt(plaintext: string, fieldName?: string): string {
        if (!this.masterKey) {
            throw new Error('Encryption not initialized. Set ENCRYPTION_KEY in environment.');
        }

        const key = fieldName ? this.deriveFieldKey(fieldName) : this.masterKey;
        const iv = crypto.randomBytes(IV_LENGTH);

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        const encryptedData: EncryptedData = {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            content: encrypted,
            algorithm: ALGORITHM,
            version: CURRENT_VERSION,
        };

        // Return as base64-encoded JSON for storage
        return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
    }

    /**
     * Decrypt encrypted data
     * @param encryptedString - Encrypted data string
     * @param fieldName - Optional field name for field-specific key derivation
     * @returns Decrypted plaintext
     */
    decrypt(encryptedString: string, fieldName?: string): string {
        if (!this.masterKey) {
            throw new Error('Encryption not initialized. Set ENCRYPTION_KEY in environment.');
        }

        try {
            // Parse the encrypted data
            const jsonString = Buffer.from(encryptedString, 'base64').toString('utf8');
            const encryptedData: EncryptedData = JSON.parse(jsonString);

            // Validate version
            if (encryptedData.version !== CURRENT_VERSION) {
                throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
            }

            const key = fieldName ? this.deriveFieldKey(fieldName) : this.masterKey;
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');
            const encrypted = Buffer.from(encryptedData.content, 'hex');

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted.toString('utf8');
        } catch (error) {
            if (error instanceof Error && error.message.includes('Unsupported')) {
                throw error;
            }
            console.error('[ENCRYPTION] Decryption failed:', error);
            throw new Error('Decryption failed - data may be corrupted or key mismatch');
        }
    }

    /**
     * Encrypt an object (JSON serializable)
     */
    encryptObject<T extends object>(obj: T, fieldName?: string): string {
        const jsonString = JSON.stringify(obj);
        return this.encrypt(jsonString, fieldName);
    }

    /**
     * Decrypt to an object
     */
    decryptObject<T extends object>(encryptedString: string, fieldName?: string): T {
        const jsonString = this.decrypt(encryptedString, fieldName);
        return JSON.parse(jsonString) as T;
    }

    /**
     * Hash a value (one-way, for indexing)
     * Use this when you need to search encrypted data
     */
    hash(value: string): string {
        if (!this.masterKey) {
            throw new Error('Encryption not initialized');
        }

        return crypto
            .createHmac('sha256', this.masterKey)
            .update(value)
            .digest('hex');
    }

    /**
     * Generate a secure random token
     * @param length - Number of bytes (output will be hex, so 2x length)
     */
    generateToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Generate a URL-safe random token
     */
    generateUrlSafeToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('base64url');
    }

    /**
     * Constant-time string comparison to prevent timing attacks
     */
    secureCompare(a: string, b: string): boolean {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);

        if (bufA.length !== bufB.length) {
            return false;
        }

        return crypto.timingSafeEqual(bufA, bufB);
    }

    /**
     * Check if encryption is available
     */
    isEnabled(): boolean {
        return this.masterKey !== null;
    }

    /**
     * Check if service is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Rotate to a new encryption key
     * Returns a migration function to re-encrypt data
     */
    async rotateKey(newMasterKey: string): Promise<{
        reencrypt: (encryptedData: string, fieldName?: string) => string;
    }> {
        // Store old key
        const oldKey = this.masterKey;
        const oldKeyCache = new Map(this.keyCache);

        // Create new key
        const newKey = crypto.pbkdf2Sync(
            newMasterKey,
            this.salt,
            this.keyDerivationIterations,
            KEY_LENGTH,
            'sha512'
        );

        // Return re-encryption function
        return {
            reencrypt: (encryptedData: string, fieldName?: string): string => {
                // Temporarily use old key to decrypt
                this.masterKey = oldKey;
                this.keyCache = oldKeyCache;
                const plaintext = this.decrypt(encryptedData, fieldName);

                // Switch to new key and encrypt
                this.masterKey = newKey;
                this.keyCache.clear();
                return this.encrypt(plaintext, fieldName);
            }
        };
    }

    /**
     * Complete key rotation
     * Call this after all data has been re-encrypted
     */
    completeKeyRotation(newMasterKey: string): void {
        this.deriveKey(newMasterKey);
        this.keyCache.clear();
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: EncryptionService | null = null;

/**
 * Get the singleton EncryptionService instance
 */
export function getEncryptionService(): EncryptionService {
    if (!instance) {
        instance = new EncryptionService();
    }
    return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetEncryptionService(): void {
    instance = null;
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick encrypt function
 */
export function encrypt(plaintext: string, fieldName?: string): string {
    return getEncryptionService().encrypt(plaintext, fieldName);
}

/**
 * Quick decrypt function
 */
export function decrypt(encryptedData: string, fieldName?: string): string {
    return getEncryptionService().decrypt(encryptedData, fieldName);
}

/**
 * Generate a secure token
 */
export function generateSecureToken(length: number = 32): string {
    return getEncryptionService().generateToken(length);
}
