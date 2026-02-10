import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        taskId: v.id("tasks"),
        projectId: v.optional(v.id("projects")),
        path: v.string(),
        content: v.string(),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("generated_files", {
            ...args,
            created_at: new Date().toISOString(),
        });
    },
});

export const listByProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("generated_files")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect();
    },
});

export const listByTask = query({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("generated_files")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .collect();
    },
});
