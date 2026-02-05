import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get tasks by project ID
 */
export const getByProjectId = query({
    args: { projectId: v.string() },
    handler: async (ctx, args) => {
        const tasks = await ctx.db
            .query("tasks")
            .withIndex("by_project", (q) => q.eq("project_id", args.projectId))
            .collect();

        return tasks;
    },
});

/**
 * Get task by ID
 */
export const getById = query({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

/**
 * Create task
 */
export const create = mutation({
    args: {
        projectId: v.string(),
        userId: v.optional(v.string()),
        prompt: v.string(),
        status: v.optional(v.string()),
        result: v.optional(v.any()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const taskId = await ctx.db.insert("tasks", {
            project_id: args.projectId,
            user_id: args.userId,
            prompt: args.prompt,
            status: args.status || "pending",
            result: args.result,
            error: args.error,
            created_at: now,
            updated_at: now,
        });

        return taskId;
    },
});

/**
 * Update task
 */
export const update = mutation({
    args: {
        taskId: v.id("tasks"),
        status: v.optional(v.string()),
        result: v.optional(v.any()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { taskId, ...updates } = args;

        await ctx.db.patch(taskId, {
            ...updates,
            updated_at: new Date().toISOString(),
        });
    },
});

/**
 * Delete task
 */
export const remove = mutation({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.taskId);
    },
});

/**
 * Get tasks by user ID
 */
export const getByUserId = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const tasks = await ctx.db
            .query("tasks")
            .withIndex("by_user", (q) => q.eq("user_id", args.userId))
            .collect();

        return tasks;
    },
});

/**
 * Get tasks by status
 */
export const getByStatus = query({
    args: { status: v.string() },
    handler: async (ctx, args) => {
        const tasks = await ctx.db
            .query("tasks")
            .withIndex("by_status", (q) => q.eq("status", args.status))
            .collect();

        return tasks;
    },
});
