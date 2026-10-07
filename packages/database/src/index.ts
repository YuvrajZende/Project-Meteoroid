/**
 * @meteoroid/database
 * Database integration for Meteoroid Backend
 *
 * Uses Supabase as the primary database.
 * This package provides Supabase client and service exports.
 */

// Client exports (Supabase)
export {
    createSupabaseClient,
    createSupabaseAdmin,
    getSupabase,
    getSupabaseAdmin,
    testConnection,
} from './client.js';

// Service exports
export * from './services/index.js';
