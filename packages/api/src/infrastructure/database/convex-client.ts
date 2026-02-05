/**
 * Convex Database Client
 * Replaces Supabase client with Convex
 */

import { ConvexClient } from "convex/browser";

let convexClient: ConvexClient | null = null;

/**
 * Get or create the Convex client singleton
 */
export function getConvexClient(): ConvexClient {
    if (!convexClient) {
        const convexUrl = process.env.CONVEX_URL;
        if (!convexUrl) {
            throw new Error("CONVEX_URL environment variable is not set");
        }

        convexClient = new ConvexClient(convexUrl, {
            unsavedChangesWarning: false,
        });
    }

    return convexClient;
}

/**
 * Close the Convex client (for graceful shutdown)
 */
export async function closeConvexClient(): Promise<void> {
    if (convexClient) {
        // Convex client doesn't have an explicit close method in browser context
        // But we can clear the reference
        convexClient = null;
    }
}

/**
 * Execute a Convex query
 * Note: Simplified types to avoid complex generic constraints
 */
export async function convexQuery<T = unknown>(
    query: any,
    args?: Record<string, unknown>
): Promise<T | null> {
    try {
        const client = getConvexClient();
        const result = await client.query(query, args);
        return result as T;
    } catch (error) {
        console.error("[CONVEX] Query error:", error);
        return null;
    }
}

/**
 * Execute a Convex mutation
 * Note: Simplified types to avoid complex generic constraints
 */
export async function convexMutation<T = unknown>(
    mutation: any,
    args?: Record<string, unknown>
): Promise<T | null> {
    try {
        const client = getConvexClient();
        const result = await client.mutation(mutation, args);
        return result as T;
    } catch (error) {
        console.error("[CONVEX] Mutation error:", error);
        return null;
    }
}

/**
 * Type-safe Convex repository base class
 */
export abstract class ConvexRepository<T extends Record<string, unknown>> {
    protected abstract tableName: string;

    /**
     * Find a single record by ID
     */
    async findById(id: string): Promise<T | null> {
        // Implementation will use Convex query functions
        return null;
    }

    /**
     * Find multiple records by filter
     */
    async findMany(filter: Partial<T>): Promise<T[]> {
        // Implementation will use Convex query functions
        return [];
    }

    /**
     * Insert a new record
     */
    async insert(data: T): Promise<string> {
        // Implementation will use Convex mutation functions
        return "";
    }

    /**
     * Update a record by ID
     */
    async update(id: string, data: Partial<T>): Promise<boolean> {
        // Implementation will use Convex mutation functions
        return false;
    }

    /**
     * Delete a record by ID
     */
    async delete(id: string): Promise<boolean> {
        // Implementation will use Convex mutation functions
        return false;
    }
}
