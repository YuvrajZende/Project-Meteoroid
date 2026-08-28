/**
 * Vector Store Interface
 *
 * Defines the contract for vector database operations including
 * embeddings, similarity search, and code indexing.
 */

export interface VectorStoreConfig {
    /** Embedding model to use */
    embeddingModel: 'text-embedding-3-small' | 'text-embedding-ada-002';
    /** Embedding dimensions */
    dimensions: 1536 | 3072;
    /** Maximum tokens per chunk */
    chunkSize: number;
    /** Overlap between chunks */
    chunkOverlap: number;
    /** Similarity threshold for searches */
    similarityThreshold: number;
}

export interface CodeChunk {
    id?: string;
    projectId: string;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    language: string;
    metadata?: Record<string, unknown>;
}

export interface EmbeddedChunk extends CodeChunk {
    embedding: number[];
    embeddingModel: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface SimilarityResult {
    chunk: EmbeddedChunk;
    similarity: number;
    relevanceScore: number;
}

export interface SearchOptions {
    projectId?: string;
    language?: string;
    limit?: number;
    threshold?: number;
    includeContent?: boolean;
}

export interface IndexingResult {
    success: boolean;
    projectId: string;
    chunksCreated: number;
    chunksUpdated: number;
    chunksDeleted: number;
    errors: string[];
}

/**
 * Vector Store interface
 * Provides vector database operations for semantic search and context retrieval
 */
export interface IVectorStore {
    /**
     * Initialize the vector store
     */
    initialize(): Promise<void>;

    /**
     * Generate embedding for text
     */
    generateEmbedding(text: string): Promise<number[]>;

    /**
     * Index a single file
     */
    indexFile(projectId: string, filePath: string, content: string): Promise<{
        success: boolean;
        chunksCreated: number;
        error?: string;
    }>;

    /**
     * Index an entire project
     */
    indexProject(projectId: string, files: Array<{ path: string; content: string }>): Promise<IndexingResult>;

    /**
     * Search for similar code chunks
     */
    search(query: string, options?: SearchOptions): Promise<SimilarityResult[]>;

    /**
     * Get relevant context for a prompt
     */
    getRelevantContext(
        prompt: string,
        projectId: string,
        options?: {
            maxChunks?: number;
            maxTokens?: number;
            includeImports?: boolean;
        }
    ): Promise<{
        context: string;
        files: Array<{ path: string; startLine: number; endLine: number; relevance: number }>;
        tokenEstimate: number;
    }>;

    /**
     * Delete all embeddings for a project
     */
    deleteProject(projectId: string): Promise<boolean>;

    /**
     * Clear embedding cache
     */
    clearCache(): void;
}
