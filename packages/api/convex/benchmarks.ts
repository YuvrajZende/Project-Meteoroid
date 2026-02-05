import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create benchmark
 */
export const create = mutation({
    args: {
        projectId: v.optional(v.string()),
        userId: v.optional(v.string()),
        taskType: v.optional(v.string()),
        model: v.string(),
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        cost: v.optional(v.number()),
        durationMs: v.optional(v.number()),
        qualityScore: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const benchmarkId = await ctx.db.insert("benchmarks", {
            project_id: args.projectId,
            user_id: args.userId,
            task_type: args.taskType,
            model: args.model,
            prompt_tokens: args.promptTokens,
            completion_tokens: args.completionTokens,
            total_tokens: args.totalTokens,
            cost: args.cost,
            duration_ms: args.durationMs,
            quality_score: args.qualityScore,
            created_at: now,
        });

        return benchmarkId;
    },
});
