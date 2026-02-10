import { mutation, action, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Code Embeddings
export const createCodeEmbedding = mutation({
    args: {
        projectId: v.optional(v.string()),
        filePath: v.string(),
        content: v.string(),
        language: v.string(),
        embedding: v.array(v.number()),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("code_embeddings", {
            projectId: args.projectId,
            filePath: args.filePath,
            content: args.content,
            language: args.language,
            embedding: args.embedding,
            metadata: args.metadata,
            created_at: new Date().toISOString(),
        });
    },
});

export const searchCode = action({
    args: {
        embedding: v.array(v.number()),
        limit: v.number(),
        threshold: v.optional(v.number()),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const results = await ctx.vectorSearch("code_embeddings", "by_embedding", {
            vector: args.embedding,
            limit: args.limit,
            filter: args.language ? (q) => q.eq("language", args.language) : undefined,
        });

        // Fetch content (this is an action, need to query DB via runQuery if we need content, 
        // but vectorSearch returns _id and score. We need to fetch the docs.)
        // Actually, vectorSearch in Convex returns items directly? No, returns { _id, _score }.
        // We need to fetch the docs.

        // Since we are in an action, we can call a query to fetch docs by IDs.
        const ids = results.map(r => r._id);
        const docs = await ctx.runQuery(api.learning_system.getDocsByIds, { ids });

        // Merge scores
        return docs.map((doc, i) => ({
            ...doc,
            similarity: results[i]._score
        })).filter(d => !args.threshold || d.similarity >= args.threshold);
    },
});

export const getDocsByIds = query({
    args: { ids: v.array(v.id("code_embeddings")) },
    handler: async (ctx, args) => {
        const tasks = args.ids.map(id => ctx.db.get(id));
        return (await Promise.all(tasks)).filter(d => d !== null);
    },
});

// Knowledge Base (Learned Patterns)
export const createLearnedPattern = mutation({
    args: {
        pattern: v.optional(v.string()),
        description: v.optional(v.string()),
        pattern_type: v.optional(v.string()),
        category: v.optional(v.string()),
        context: v.optional(v.string()),
        confidence: v.optional(v.number()),
        frequency: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("learned_patterns", {
            pattern: args.pattern,
            description: args.description,
            pattern_type: args.pattern_type,
            category: args.category,
            context: args.context,
            confidence: args.confidence,
            frequency: args.frequency,
            created_at: new Date().toISOString(),
        });
    },
});

export const listLearnedPatterns = query({
    args: {
        limit: v.number(),
        type: v.optional(v.string()), // success, failure
    },
    handler: async (ctx, args) => {
        if (args.type) {
            return await ctx.db
                .query("learned_patterns")
                .withIndex("by_type", (q) => q.eq("pattern_type", args.type))
                .order("desc")
                .take(args.limit);
        } else {
            return await ctx.db
                .query("learned_patterns")
                .order("desc")
                .take(args.limit);
        }
    },
});

// Generation Iterations
export const logGeneration = mutation({
    args: {
        projectId: v.optional(v.string()),
        taskId: v.optional(v.string()),
        prompt: v.string(),
        success: v.boolean(),
        generated_code: v.optional(v.string()),
        config: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("generation_iterations", {
            projectId: args.projectId,
            taskId: args.taskId,
            prompt: args.prompt,
            success: args.success,
            generated_code: args.generated_code,
            config: args.config,
            created_at: new Date().toISOString(),
        });
    },
});

export const getSuccessfulGenerations = query({
    args: { limit: v.number() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("generation_iterations")
            .withIndex("by_success", (q) => q.eq("success", true))
            .order("desc")
            .take(args.limit);
    },
});
