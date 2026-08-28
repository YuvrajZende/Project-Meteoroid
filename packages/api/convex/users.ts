import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get user by ID (Supabase Auth ID)
export const get = query({
    args: { id: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("id", args.id))
            .unique();
        return user;
    },
});

// Get user by Email
export const getByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .unique();
        return user;
    },
});

// Create or Update User (Upsert)
export const upsert = mutation({
    args: {
        id: v.string(), // Supabase Auth ID
        email: v.string(),
        name: v.optional(v.string()),
        tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
        avatar_url: v.optional(v.string()),
        api_quota_used: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("id", args.id))
            .unique();

        const timestamp = new Date().toISOString();

        if (existingUser) {
            await ctx.db.patch(existingUser._id, {
                email: args.email,
                name: args.name ?? existingUser.name,
                tier: args.tier ?? existingUser.tier,
                avatar_url: args.avatar_url ?? existingUser.avatar_url,
                api_quota_used: args.api_quota_used ?? existingUser.api_quota_used,
                updated_at: timestamp,
            });
            return existingUser._id;
        } else {
            const newId = await ctx.db.insert("users", {
                id: args.id,
                email: args.email,
                name: args.name,
                tier: args.tier,
                avatar_url: args.avatar_url,
                api_quota_used: args.api_quota_used ?? 0,
                created_at: timestamp,
                updated_at: timestamp,
            });
            return newId;
        }
    },
});

// Increment API Quota
export const incrementQuota = mutation({
    args: {
        id: v.string(),
        amount: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("id", args.id))
            .unique();

        if (user) {
            await ctx.db.patch(user._id, {
                api_quota_used: (user.api_quota_used || 0) + args.amount,
                updated_at: new Date().toISOString(),
            });
        }
    },
});

export const deleteUser = mutation({
    args: { id: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_external_id", (q) => q.eq("id", args.id))
            .unique();

        if (user) {
            await ctx.db.delete(user._id);
        }
    },
});
