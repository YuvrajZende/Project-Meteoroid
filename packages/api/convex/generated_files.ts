import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create generated file
 */
export const create = mutation({
    args: {
        taskId: v.string(),
        projectId: v.optional(v.string()),
        path: v.string(),
        content: v.string(),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const fileId = await ctx.db.insert("generated_files", {
            task_id: args.taskId,
            project_id: args.projectId,
            path: args.path,
            content: args.content,
            language: args.language,
            created_at: now,
        });

        return fileId;
    },
});
