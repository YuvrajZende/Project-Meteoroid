import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create deployment
 */
export const create = mutation({
    args: {
        projectId: v.string(),
        userId: v.optional(v.string()),
        provider: v.string(),
        deploymentId: v.string(),
        url: v.optional(v.string()),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const deploymentId = await ctx.db.insert("deployments", {
            project_id: args.projectId,
            user_id: args.userId,
            provider: args.provider,
            deployment_id: args.deploymentId,
            url: args.url,
            status: args.status,
            created_at: now,
            updated_at: now,
        });

        return deploymentId;
    },
});
