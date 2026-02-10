import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        projectId: v.id("projects"),
        contextType: v.optional(v.string()),
        contextData: v.optional(v.any()),
        embeddings: v.optional(v.array(v.number()))
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("learning_contexts", {
            ...args,
            created_at: new Date().toISOString()
        });
    },
});

export const listByProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("learning_contexts")
            .withIndex("by_project", q => q.eq("projectId", args.projectId))
            .collect();
    }
});
