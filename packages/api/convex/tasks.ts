import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

export const listByProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();
    },
});

export const create = mutation({
    args: {
        projectId: v.optional(v.id("projects")),
        userId: v.optional(v.string()),
        prompt: v.string(),
        status: v.optional(v.union(
            v.literal("queued"),
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        )),
        result: v.optional(v.any()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const timestamp = new Date().toISOString();
        return await ctx.db.insert("tasks", {
            projectId: args.projectId,
            userId: args.userId,
            prompt: args.prompt,
            status: args.status || "pending",
            progress: 0,
            result: args.result,
            error: args.error,
            created_at: timestamp,
        });
    },
});

export const updateStatus = mutation({
    args: {
        id: v.id("tasks"),
        status: v.union(
            v.literal("queued"),
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        ),
        progress: v.optional(v.number()),
        result: v.optional(v.any()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const changes: any = { status: args.status };
        if (args.progress !== undefined) changes.progress = args.progress;
        if (args.result !== undefined) changes.result = args.result;
        if (args.error !== undefined) changes.error = args.error;

        if (args.status === 'processing') changes.started_at = new Date().toISOString();
        if (args.status === 'completed' || args.status === 'failed') changes.completed_at = new Date().toISOString();

        await ctx.db.patch(args.id, changes);
    },
});

export const update = mutation({
    args: {
        id: v.id("tasks"),
        status: v.optional(v.union(
            v.literal("queued"),
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        )),
        progress: v.optional(v.number()),
        result: v.optional(v.any()),
        error: v.optional(v.string()),
        agents_used: v.optional(v.array(v.string())),
        prompt: v.optional(v.string()),
        started_at: v.optional(v.string()),
        completed_at: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const changes: any = {};
        if (args.status !== undefined) changes.status = args.status;
        if (args.progress !== undefined) changes.progress = args.progress;
        if (args.result !== undefined) changes.result = args.result;
        if (args.error !== undefined) changes.error = args.error;
        if (args.agents_used !== undefined) changes.agents_used = args.agents_used;
        if (args.prompt !== undefined) changes.prompt = args.prompt;
        if (args.started_at !== undefined) changes.started_at = args.started_at;
        if (args.completed_at !== undefined) changes.completed_at = args.completed_at;

        // Auto-timestamp logic
        if (args.status === 'processing' && !args.started_at) changes.started_at = new Date().toISOString();
        if ((args.status === 'completed' || args.status === 'failed') && !args.completed_at) changes.completed_at = new Date().toISOString();

        await ctx.db.patch(args.id, changes);
    },
});

export const deleteTask = mutation({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

export const listByUser = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();
    },
});
