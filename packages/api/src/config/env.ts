/**
 * Environment Configuration
 * Type-safe environment variable loading with Zod validation
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in project root
// When running from packages/api/, we need to go up two levels
const envPath = path.resolve(process.cwd(), '..', '..', '.env');
const localEnvPath = path.resolve(process.cwd(), '.env');

// Try local first, then root
dotenv.config({ path: localEnvPath });
dotenv.config({ path: envPath });

// Debug: log which .env was loaded
if (process.env.NODE_ENV !== 'production') {
    console.log(`📁 Loading .env from: ${envPath}`);
}

/**
 * Environment variable schema with validation rules
 */
const envSchema = z.object({
    // Server Configuration
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3000'),
    HOST: z.string().default('0.0.0.0'),

    // API Configuration
    API_VERSION: z.string().default('v1'),
    API_PREFIX: z.string().default('/api'),

    // Supabase Configuration
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    // Redis Configuration
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // AI Provider Keys (comma-separated for rotation)
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_KEYS: z.string().optional(), // Multiple keys: key1,key2,key3
    OPENAI_BASE_URL: z.string().optional(),
    ANTHROPIC_KEYS: z.string().optional(),
    ZAI_KEYS: z.string().optional(),

    // Security
    JWT_SECRET: z.string().min(32).optional(),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),

    // Rate Limiting
    RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),

    // Monitoring
    SENTRY_DSN: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

/**
 * Parsed and validated environment configuration
 */
const parseEnv = () => {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        console.error('[CONFIG] Invalid environment variables:');
        console.error(parsed.error.format());
        throw new Error('Invalid environment configuration');
    }

    return parsed.data;
};

export const env = parseEnv();

/**
 * Type-safe environment configuration type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Check if running in production
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if running in development
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if running in test mode
 */
export const isTest = env.NODE_ENV === 'test';
