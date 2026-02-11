/**
 * Default Service Definitions
 * Phase 21: Service Integration Framework
 *
 * Exports all pre-configured service definitions.
 * Primary services:
 * 1. Supabase (Vector Database + Auth) - pgvector for embeddings, authentication
 * 2. Local PostgreSQL (via MCP) - Relational data for users, projects, tasks, etc.
 * 3. Sentry (Monitoring)
 * 4. GitHub Actions (CI/CD)
 * 5. Resend (Email)
 * 6. Stripe (Payments)
 */

import { ServiceDefinition } from '../types.js';
import { supabaseService } from './supabase.js';
import { sentryService } from './sentry.js';
import { githubActionsService } from './github-actions.js';
import { resendService } from './resend.js';
import { stripeService } from './stripe.js';

/**
 * Get all default service definitions
 */
export function getDefaultServices(): ServiceDefinition[] {
    return [
        supabaseService, // Vector operations + Auth
        sentryService,
        githubActionsService,
        resendService,
        stripeService
    ];
}

// Re-export individual services for direct imports
export { supabaseService } from './supabase.js';
export { sentryService } from './sentry.js';
export { githubActionsService } from './github-actions.js';
export { resendService } from './resend.js';
export { stripeService } from './stripe.js';
