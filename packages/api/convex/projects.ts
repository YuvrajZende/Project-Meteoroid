import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
    args: { id: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

export const listByUser = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
    },
});

export const create = mutation({
    args: {
        userId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        framework: v.optional(v.string()),
        language: v.optional(v.string()),
        githubUrl: v.optional(v.string()),
        status: v.optional(v.union(
            v.literal("pending"),
            v.literal("generating"),
            v.literal("active"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("archived")
        )),
        config: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const timestamp = new Date().toISOString();
        return await ctx.db.insert("projects", {
            userId: args.userId,
            name: args.name,
            description: args.description,
            framework: args.framework,
            language: args.language,
            githubUrl: args.githubUrl,
            status: args.status || "active",
            config: args.config,
            created_at: timestamp,
            updated_at: timestamp,
        });
    },
});

export const update = mutation({
    args: {
        id: v.id("projects"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.union(
            v.literal("pending"),
            v.literal("generating"),
            v.literal("active"),
            v.literal("completed"),
            v.literal("failed"),
            v.literal("archived")
        )),
        config: v.optional(v.any()), // JSONB
    },
    handler: async (ctx, args) => {
        const timestamp = new Date().toISOString();
        await ctx.db.patch(args.id, {
            ...(args.name && { name: args.name }),
            ...(args.description && { description: args.description }),
            ...(args.status && { status: args.status }),
            ...(args.config && { config: args.config }),
            updated_at: timestamp,
        });
    },
});

export const deleteProject = mutation({
    args: { id: v.id("projects") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});
