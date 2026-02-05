import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create learning context
 */
export const create = mutation({
    args: {
        projectId: v.string(),
        contextType: v.optional(v.string()),
        contextData: v.optional(v.any()),
        embeddings: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const contextId = await ctx.db.insert("learning_contexts", {
            project_id: args.projectId,
            context_type: args.contextType,
            context_data: args.contextData,
            embeddings: args.embeddings,
            created_at: now,
            updated_at: now,
        });

        return contextId;
    },
});
