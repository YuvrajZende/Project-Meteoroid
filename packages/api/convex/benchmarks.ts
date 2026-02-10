import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        projectId: v.optional(v.id("projects")),
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
        return await ctx.db.insert("benchmarks", {
            ...args,
            created_at: new Date().toISOString()
        });
    },
});

export const getStatsByModel = query({
    args: { model: v.string() },
    handler: async (ctx, args) => {
        const benchmarks = await ctx.db
            .query("benchmarks")
            .withIndex("by_model", q => q.eq("model", args.model))
            .collect();

        // Calculate basic stats
        const count = benchmarks.length;
        const avgDuration = count > 0 ? benchmarks.reduce((acc, b) => acc + (b.durationMs || 0), 0) / count : 0;
        const totalCost = benchmarks.reduce((acc, b) => acc + (b.cost || 0), 0);

        return {
            model: args.model,
            count,
            avgDuration,
            totalCost
        };
    }
});
