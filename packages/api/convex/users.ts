import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get user by email
 */
export const getByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .first();

        return user;
    },
});

/**
 * Get user by ID
 */
export const getById = query({
    args: { id: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

/**
 * Create or update user
 */
export const upsert = mutation({
    args: {
        email: v.string(),
        name: v.optional(v.string()),
        avatar_url: v.optional(v.string()),
        tier: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if user exists
        const existing = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .first();

        const now = new Date().toISOString();

        if (existing) {
            // Update existing user - map camelCase to snake_case
            await ctx.db.patch(existing._id, {
                email: args.email,
                name: args.name,
                avatar_url: args.avatar_url,
                tier: args.tier,
                updated_at: now,
            });
            return existing._id;
        } else {
            // Create new user
            const userId = await ctx.db.insert("users", {
                email: args.email,
                name: args.name,
                avatar_url: args.avatar_url,
                tier: args.tier,
                created_at: now,
                updated_at: now,
            });
            return userId;
        }
    },
});

/**
 * Update user tier
 */
export const updateTier = mutation({
    args: {
        userId: v.id("users"),
        tier: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.userId, {
            tier: args.tier,
            updated_at: new Date().toISOString(),
        });
    },
});

/**
 * Delete user
 */
export const remove = mutation({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.userId);
    },
});
