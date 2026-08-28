import { mutation, action, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const create = mutation({
    args: {
        content: v.string(),
        embedding: v.array(v.number()),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("knowledge_embeddings", {
            content: args.content,
            embedding: args.embedding,
            metadata: args.metadata,
            created_at: new Date().toISOString(),
        });
    },
});

export const createMany = mutation({
    args: {
        items: v.array(v.object({
            content: v.string(),
            embedding: v.array(v.number()),
            metadata: v.optional(v.any()),
        }))
    },
    handler: async (ctx, args) => {
        const ids = [];
        for (const item of args.items) {
            ids.push(await ctx.db.insert("knowledge_embeddings", {
                content: item.content,
                embedding: item.embedding,
                metadata: item.metadata,
                created_at: new Date().toISOString(),
            }));
        }
        return ids;
    }
});

// Search functionality using vector search
export const search = action({
    args: {
        embedding: v.array(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const results = await ctx.vectorSearch("knowledge_embeddings", "by_embedding", {
            vector: args.embedding,
            limit: args.limit ?? 10,
        });

        // Fetch the actual documents
        const documents = await Promise.all(
            results.map(async (result) => {
                return await ctx.runQuery(internal.knowledge_embeddings.getByIdInternal, { id: result._id });
            })
        );

        return documents
            .map((doc, index) => doc ? ({ ...doc, similarity: results[index]._score }) : null)
            .filter(d => d !== null);
    },
});

export const getById = query({
    args: { id: v.id("knowledge_embeddings") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    }
});

export const getByIdInternal = internalQuery({
    args: { id: v.id("knowledge_embeddings") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    }
});

export const deleteEmbedding = mutation({
    args: { id: v.id("knowledge_embeddings") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    }
});

export const deleteByMetadata = mutation({
    args: { key: v.string(), value: v.string() },
    handler: async (ctx, args) => {
        // Warning: Full scan!
        const items = await ctx.db
            .query("knowledge_embeddings")
            // .filter(...) // Metadata is JSON, hard to filter efficiently without index or logic
            // Because metadata is 'any', we can't easily filter by key/value in Convex query object syntax 
            // without knowing the structure or using filter with custom JS logic (which is fine).
            .collect();

        // Filter in memory for deletion (slow but works for now)
        for (const item of items) {
            if (item.metadata && (item.metadata as any)[args.key] === args.value) {
                await ctx.db.delete(item._id);
            }
        }
    }
});

export const count = query({
    args: {},
    handler: async (ctx) => {
        const items = await ctx.db.query("knowledge_embeddings").collect();
        return items.length;
    }
});
