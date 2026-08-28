import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        projectId: v.id("projects"),
        userId: v.optional(v.string()),
        provider: v.string(),
        deploymentId: v.string(),
        url: v.optional(v.string()),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const timestamp = new Date().toISOString();
        return await ctx.db.insert("deployments", {
            ...args,
            created_at: timestamp,
            updated_at: timestamp
        });
    },
});

export const listByProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("deployments")
            .withIndex("by_project", q => q.eq("projectId", args.projectId))
            .collect();
    }
});
