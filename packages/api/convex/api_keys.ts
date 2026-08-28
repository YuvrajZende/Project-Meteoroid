import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        userId: v.string(),
        name: v.string(),
        keyHash: v.string(), // Hashed key for storage
        keyPrefix: v.string(), // Displayable prefix
        scopes: v.array(v.string()),
        expiresAt: v.optional(v.string()), // Nullable
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("api_keys", {
            userId: args.userId,
            name: args.name,
            keyHash: args.keyHash,
            keyPrefix: args.keyPrefix,
            scopes: args.scopes,
            expiresAt: args.expiresAt,
            created_at: new Date().toISOString(),
        });
    },
});

export const update = mutation({
    args: {
        id: v.id("api_keys"),
        name: v.optional(v.string()),
        scopes: v.optional(v.array(v.string())),
        expiresAt: v.optional(v.string()), // Nullable
    },
    handler: async (ctx, args) => {
        const changes: any = {};
        if (args.name !== undefined) changes.name = args.name;
        if (args.scopes !== undefined) changes.scopes = args.scopes;
        if (args.expiresAt !== undefined) changes.expiresAt = args.expiresAt;

        await ctx.db.patch(args.id, changes);
    }
});

export const listByUser = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("api_keys")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

export const revoke = mutation({
    args: { id: v.id("api_keys") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    }
});

// Internal query to validate key
export const validateKey = query({
    args: { keyHash: v.string() },
    handler: async (ctx, args) => {
        const key = await ctx.db
            .query("api_keys")
            .withIndex("by_key_hash", (q) => q.eq("keyHash", args.keyHash))
            .unique();

        if (!key) return null;

        // Check expiration
        if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
            return null;
        }

        return key;
    }
});

export const recordUsage = mutation({
    args: { id: v.id("api_keys") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            lastUsedAt: new Date().toISOString()
        });
    }
});
