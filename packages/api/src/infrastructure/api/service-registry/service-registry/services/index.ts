/**
 * Default Service Definitions
 * Phase 21: Service Integration Framework
 * 
 * Exports all pre-configured service definitions.
 * Start with the 5 essential services:
 * 1. Supabase (Database + Auth)
 * 2. Sentry (Monitoring)
 * 3. GitHub Actions (CI/CD)
 * 4. Resend (Email)
 * 5. Stripe (Payments)
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
        supabaseService,
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
