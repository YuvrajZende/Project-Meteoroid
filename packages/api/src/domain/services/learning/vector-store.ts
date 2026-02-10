/**
 * Vector Store Service
 * Operations for knowledge embeddings (Convex Vector Search)
 */

import { getConvexClient, api } from '../../../infrastructure/database/convex-client.js';

/**
 * Knowledge embedding entity
 */
export interface KnowledgeEmbedding {
    id: string;
    content: string;
    embedding: number[];
    metadata: Record<string, unknown> | null;
    created_at: string;
    _id: string;
}

/**
 * Knowledge embedding insert DTO
 */
export interface KnowledgeEmbeddingInsert {
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown> | null;
}

/**
 * Similarity search result
 */
export interface SimilarityResult {
    id: string;
    content: string;
    similarity: number;
    metadata: Record<string, unknown> | null;
    _id: string;
}

/**
 * VectorStoreService - Vector similarity search and storage
 */
export class VectorStoreService {
    private convex = getConvexClient();

    /**
     * Store a new embedding
     */
    async store(data: KnowledgeEmbeddingInsert): Promise<KnowledgeEmbedding> {
        const newId = await this.convex.mutation(api.knowledge_embeddings.create, {
            content: data.content,
            embedding: data.embedding,
            metadata: data.metadata || undefined,
        });

        return {
            id: newId,
            _id: newId,
            content: data.content,
            embedding: data.embedding,
            metadata: data.metadata || null,
            created_at: new Date().toISOString(),
        };
    }

    /**
     * Store multiple embeddings at once
     */
    async storeMany(items: KnowledgeEmbeddingInsert[]): Promise<KnowledgeEmbedding[]> {
        const ids = await this.convex.mutation(api.knowledge_embeddings.createMany, {
            items: items.map(item => ({
                content: item.content,
                embedding: item.embedding,
                metadata: item.metadata || undefined,
            }))
        });

        return ids.map((id, index) => ({
            id: id,
            _id: id,
            content: items[index].content,
            embedding: items[index].embedding,
            metadata: items[index].metadata || null,
            created_at: new Date().toISOString(),
        }));
    }

    /**
     * Search for similar content using vector similarity
     */
    async search(queryEmbedding: number[], options?: {
        matchThreshold?: number;
        matchCount?: number;
    }): Promise<SimilarityResult[]> {
        const results = await this.convex.action(api.knowledge_embeddings.search, {
            embedding: queryEmbedding,
            limit: options?.matchCount,
        });

        // Filter by threshold if provided
        let filtered = results;
        if (options?.matchThreshold) {
            filtered = results.filter(r => r.similarity >= (options.matchThreshold as number));
        }

        return filtered.map(r => ({
            id: r._id,
            _id: r._id,
            content: r.content,
            similarity: r.similarity,
            metadata: r.metadata || null,
        }));
    }

    /**
     * Delete an embedding by ID
     */
    async delete(id: string): Promise<void> {
        await this.convex.mutation(api.knowledge_embeddings.deleteEmbedding, { id: id as any });
    }

    /**
     * Delete embeddings by metadata filter
     */
    async deleteByMetadata(key: string, value: string): Promise<void> {
        await this.convex.mutation(api.knowledge_embeddings.deleteByMetadata, { key, value });
    }

    /**
     * Get embedding by ID
     */
    async getById(id: string): Promise<KnowledgeEmbedding | null> {
        const item = await this.convex.query(api.knowledge_embeddings.getById, { id: id as any });
        if (!item) return null;
        return this.mapToEntity(item);
    }

    /**
     * Count total embeddings
     */
    async count(): Promise<number> {
        return await this.convex.query(api.knowledge_embeddings.count, {});
    }

    private mapToEntity(item: any): KnowledgeEmbedding {
        return {
            id: item._id,
            _id: item._id,
            content: item.content,
            embedding: item.embedding,
            metadata: item.metadata || null,
            created_at: item.created_at || new Date().toISOString(),
        };
    }
}

// Export singleton instance
export const vectorStoreService = new VectorStoreService();

// Export legacy functions/types for backward compatibility if needed
export const getVectorStore = () => vectorStoreService;
export const createVectorStore = () => vectorStoreService;
