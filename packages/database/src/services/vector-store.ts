/**
 * Vector Store Service
 * Operations for knowledge embeddings (pgvector)
 */

import { getSupabaseAdmin } from '../client.js';

/**
 * Knowledge embedding entity
 */
export interface KnowledgeEmbedding {
    id: string;
    content: string;
    embedding: number[];
    metadata: Record<string, unknown> | null;
    created_at: string;
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
}

/**
 * VectorStoreService - Vector similarity search and storage
 */
export class VectorStoreService {
    private supabase = getSupabaseAdmin();

    /**
     * Store a new embedding
     */
    async store(data: KnowledgeEmbeddingInsert): Promise<KnowledgeEmbedding> {
        const { data: result, error } = await this.supabase
            .from('knowledge_embeddings')
            .insert({
                content: data.content,
                embedding: data.embedding,
                metadata: data.metadata || null,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to store embedding: ${error.message}`);
        }

        return result as KnowledgeEmbedding;
    }

    /**
     * Store multiple embeddings at once
     */
    async storeMany(items: KnowledgeEmbeddingInsert[]): Promise<KnowledgeEmbedding[]> {
        const { data, error } = await this.supabase
            .from('knowledge_embeddings')
            .insert(items.map(item => ({
                content: item.content,
                embedding: item.embedding,
                metadata: item.metadata || null,
            })))
            .select();

        if (error) {
            throw new Error(`Failed to store embeddings: ${error.message}`);
        }

        return (data || []) as KnowledgeEmbedding[];
    }

    /**
     * Search for similar content using vector similarity
     * Requires the match_embeddings function to be created in Supabase
     */
    async search(queryEmbedding: number[], options?: {
        matchThreshold?: number;
        matchCount?: number;
    }): Promise<SimilarityResult[]> {
        const threshold = options?.matchThreshold ?? 0.7;
        const count = options?.matchCount ?? 10;

        const { data, error } = await this.supabase.rpc('match_embeddings', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: count,
        });

        if (error) {
            throw new Error(`Failed to search embeddings: ${error.message}`);
        }

        return (data || []) as SimilarityResult[];
    }

    /**
     * Delete an embedding by ID
     */
    async delete(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('knowledge_embeddings')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete embedding: ${error.message}`);
        }
    }

    /**
     * Delete embeddings by metadata filter
     */
    async deleteByMetadata(key: string, value: string): Promise<void> {
        const { error } = await this.supabase
            .from('knowledge_embeddings')
            .delete()
            .eq(`metadata->>${key}`, value);

        if (error) {
            throw new Error(`Failed to delete embeddings: ${error.message}`);
        }
    }

    /**
     * Get embedding by ID
     */
    async getById(id: string): Promise<KnowledgeEmbedding | null> {
        const { data, error } = await this.supabase
            .from('knowledge_embeddings')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to get embedding: ${error.message}`);
        }

        return data as KnowledgeEmbedding;
    }

    /**
     * Count total embeddings
     */
    async count(): Promise<number> {
        const { count, error } = await this.supabase
            .from('knowledge_embeddings')
            .select('*', { count: 'exact', head: true });

        if (error) {
            throw new Error(`Failed to count embeddings: ${error.message}`);
        }

        return count || 0;
    }
}

// Export singleton instance
export const vectorStoreService = new VectorStoreService();
