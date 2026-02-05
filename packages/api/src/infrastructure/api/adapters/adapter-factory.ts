/**
 * Adapter Factory
 * Phase 21: Service Integration Framework
 * 
 * Factory for creating and retrieving service adapters.
 */

import { BaseAdapter } from './base-adapter.js';

// Adapter registry
const adapterRegistry: Map<string, BaseAdapter> = new Map();

/**
 * Register an adapter
 */
export function registerAdapter(adapter: BaseAdapter): void {
    adapterRegistry.set(adapter.serviceId, adapter);
}

/**
 * Get an adapter by service ID
 */
export function getServiceAdapter(serviceId: string): BaseAdapter | undefined {
    return adapterRegistry.get(serviceId);
}

/**
 * Check if an adapter exists
 */
export function hasAdapter(serviceId: string): boolean {
    return adapterRegistry.has(serviceId);
}

/**
 * Get all registered adapters
 */
export function getAllAdapters(): BaseAdapter[] {
    return Array.from(adapterRegistry.values());
}

/**
 * Initialize all adapters
 */
export async function initializeAdapters(): Promise<void> {
    // Import and register adapters dynamically
    try {
        const { SupabaseAdapter } = await import('./database/supabase-adapter.js');
        registerAdapter(new SupabaseAdapter());
    } catch (e) {
        console.warn('[Adapters] Supabase adapter not available');
    }

    try {
        const { SentryAdapter } = await import('./monitoring/sentry-adapter.js');
        registerAdapter(new SentryAdapter());
    } catch (e) {
        console.warn('[Adapters] Sentry adapter not available');
    }

    console.log(`[Adapters] Initialized ${adapterRegistry.size} adapters`);
}

export { BaseAdapter };
