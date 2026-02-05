import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get projects by user ID
 */
export const getByUserId = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_user", (q) => q.eq("user_id", args.userId))
            .collect();

        return projects;
    },
});

/**
 * Get project by ID
 */
export const getById = query({
    args: { id: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

/**
 * Create project
 */
export const create = mutation({
    args: {
        userId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        framework: v.optional(v.string()),
        language: v.optional(v.string()),
        status: v.optional(v.string()),
        githubUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const projectId = await ctx.db.insert("projects", {
            user_id: args.userId,
            name: args.name,
            description: args.description,
            framework: args.framework,
            language: args.language,
            status: args.status || "active",
            github_url: args.githubUrl,
            created_at: now,
            updated_at: now,
        });

        return projectId;
    },
});

/**
 * Update project
 */
export const update = mutation({
    args: {
        projectId: v.id("projects"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        framework: v.optional(v.string()),
        language: v.optional(v.string()),
        status: v.optional(v.string()),
        githubUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { projectId, ...updates } = args;

        await ctx.db.patch(projectId, {
            ...updates,
            updated_at: new Date().toISOString(),
        });
    },
});

/**
 * Delete project
 */
export const remove = mutation({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.projectId);
    },
});

/**
 * Get projects by status
 */
export const getByStatus = query({
    args: { status: v.string() },
    handler: async (ctx, args) => {
        const projects = await ctx.db
            .query("projects")
            .withIndex("by_status", (q) => q.eq("status", args.status))
            .collect();

        return projects;
    },
});
