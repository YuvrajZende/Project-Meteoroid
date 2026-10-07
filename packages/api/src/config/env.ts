/**
 * Environment Configuration
 * Type-safe environment variable loading with Zod validation
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { API_ROOT, REPO_ROOT } from '../infrastructure/repo-root.js';

// packages/api/.env wins over the repo-root .env (dotenv never overrides already-set vars)
const envPath = path.join(REPO_ROOT, '.env');
const localEnvPath = path.join(API_ROOT, '.env');

// Try local first, then root
dotenv.config({ path: localEnvPath, quiet: true });
dotenv.config({ path: envPath, quiet: true });

// Debug: log which .env was loaded
if (process.env.NODE_ENV !== 'production') {
    console.log(`[CONFIG] Loading .env from: ${envPath}`);
}

if (!process.env.NODE_ENV) {
    console.warn([
        '',
        '[CONFIG] WARNING: NODE_ENV is not set - defaulting to "development".',
        '[CONFIG] Authentication is NOT enforced on cost-incurring routes in development.',
        '[CONFIG] Set NODE_ENV=production (or AUTH_REQUIRED=true) for any deployed instance.',
        '',
    ].join('\n'));
}

/**
 * Parse a boolean-ish env string ('true'/'false'/'1'/'0'); undefined when unset/empty.
 */
const booleanString = z
    .string()
    .optional()
    .transform((v, ctx) => {
        if (v === undefined || v.trim() === '') return undefined;
        const n = v.trim().toLowerCase();
        if (n === 'true' || n === '1') return true;
        if (n === 'false' || n === '0') return false;
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expected 'true' or 'false', got '${v}'` });
        return z.NEVER;
    });

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
    // Require authentication on cost-incurring/destructive routes.
    // Defaults to true in production, false otherwise.
    AUTH_REQUIRED: booleanString,
    CORS_ORIGINS: z.string().default('http://localhost:3001'),

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

    return {
        ...parsed.data,
        AUTH_REQUIRED: parsed.data.AUTH_REQUIRED ?? parsed.data.NODE_ENV === 'production',
    };
};

export const env = parseEnv();

/**
 * Type-safe environment configuration type
 */
export type Env = ReturnType<typeof parseEnv>;

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
