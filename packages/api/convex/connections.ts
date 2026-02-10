import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
    args: {
        userId: v.string(),
        provider: v.string(),
        credentials: v.optional(v.any()),
        accessToken: v.optional(v.string()),
        refreshToken: v.optional(v.string()),
        expiresIn: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("connections")
            .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
            .unique();

        const timestamp = new Date().toISOString();

        if (existing) {
            await ctx.db.patch(existing._id, {
                ...args,
                updated_at: timestamp
            });
            return existing._id;
        } else {
            return await ctx.db.insert("connections", {
                ...args,
                created_at: timestamp,
                updated_at: timestamp
            });
        }
    },
});

export const get = query({
    args: { userId: v.string(), provider: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("connections")
            .withIndex("by_user_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
            .unique();
    }
});
