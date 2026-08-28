/**
 * @loveable/database
 * Supabase database integration for Loveable Backend
 */

// Client exports
export {
    createSupabaseClient,
    createSupabaseAdmin,
    getSupabase,
    getSupabaseAdmin,
    testConnection,
} from './client.js';

// Service exports
export * from './services/index.js';
