import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get connection by user ID and provider
 */
export const getByUserAndProvider = query({
    args: {
        userId: v.string(),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const connection = await ctx.db
            .query("connections")
            .withIndex("by_user_provider", (q) =>
                q.eq("user_id", args.userId).eq("provider", args.provider)
            )
            .first();

        return connection;
    },
});

/**
 * Get all connections by user ID
 */
export const getByUserId = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const connections = await ctx.db
            .query("connections")
            .withIndex("by_user", (q) => q.eq("user_id", args.userId))
            .collect();

        return connections;
    },
});

/**
 * Create or update connection
 */
export const upsert = mutation({
    args: {
        userId: v.string(),
        provider: v.string(),
        credentials: v.optional(v.string()),
        accessToken: v.optional(v.string()),
        refreshToken: v.optional(v.string()),
        expiresIn: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Check if connection exists
        const existing = await ctx.db
            .query("connections")
            .withIndex("by_user_provider", (q) =>
                q.eq("user_id", args.userId).eq("provider", args.provider)
            )
            .first();

        const now = new Date().toISOString();
        const expiresAt = args.expiresIn
            ? new Date(Date.now() + args.expiresIn * 1000).toISOString()
            : undefined;

        if (existing) {
            // Update existing connection
            await ctx.db.patch(existing._id, {
                credentials: args.credentials,
                access_token: args.accessToken,
                refresh_token: args.refreshToken,
                expires_at: expiresAt,
                updated_at: now,
            });
            return existing._id;
        } else {
            // Create new connection
            const connectionId = await ctx.db.insert("connections", {
                user_id: args.userId,
                provider: args.provider,
                credentials: args.credentials,
                access_token: args.accessToken,
                refresh_token: args.refreshToken,
                expires_at: expiresAt,
                created_at: now,
                updated_at: now,
            });
            return connectionId;
        }
    },
});

/**
 * Delete connection
 */
export const remove = mutation({
    args: {
        userId: v.string(),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const connection = await ctx.db
            .query("connections")
            .withIndex("by_user_provider", (q) =>
                q.eq("user_id", args.userId).eq("provider", args.provider)
            )
            .first();

        if (connection) {
            await ctx.db.delete(connection._id);
        }
    },
});

/**
 * Check if connection is expired
 */
export const isExpired = query({
    args: {
        userId: v.string(),
        provider: v.string(),
    },
    handler: async (ctx, args) => {
        const connection = await ctx.db
            .query("connections")
            .withIndex("by_user_provider", (q) =>
                q.eq("user_id", args.userId).eq("provider", args.provider)
            )
            .first();

        if (!connection || !connection.expires_at) {
            return false;
        }

        const expiryTime = new Date(connection.expires_at).getTime();
        return Date.now() > expiryTime;
    },
});
