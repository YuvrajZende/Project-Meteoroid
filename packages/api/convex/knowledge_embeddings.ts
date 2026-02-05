import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create knowledge embedding (vector storage for AI semantic search)
 */
export const create = mutation({
    args: {
        content: v.string(),
        embedding: v.optional(v.any()),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const embeddingId = await ctx.db.insert("knowledge_embeddings", {
            content: args.content,
            embedding: args.embedding,
            metadata: args.metadata ?? {},
            created_at: now,
        });

        return embeddingId;
    },
});

/**
 * Search knowledge embeddings by content
 */
export const search = mutation({
    args: {
        query: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Simple text search - Convex doesn't have native vector search yet
        // For full vector search, consider using a dedicated vector DB
        const results = await ctx.db
            .query("knowledge_embeddings")
            .filter((q) =>
                q.contains(q.field("content"), args.query)
            )
            .take(args.limit ?? 10);

        return results;
    },
});
