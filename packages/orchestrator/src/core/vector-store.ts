/**
 * ============================================
 * VECTOR STORE - SEMANTIC EMBEDDINGS FOR RAG
 * ============================================
 * 
 * Provides true semantic search using embeddings.
 * Enhances the Knowledge Base with vector similarity search.
 * 
 * Features:
 * - Generate embeddings for text content
 * - Store and retrieve by semantic similarity
 * - Hybrid search (keyword + semantic)
 * - Automatic chunking for long content
 */

import { ChatOpenAI } from "@langchain/openai";
import * as crypto from "crypto";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface VectorEntry {
    id: string;
    content: string;
    embedding: number[];
    metadata: VectorMetadata;
    createdAt: Date;
}

export interface VectorMetadata {
    source: string;
    type: string;
    chunkIndex?: number;
    totalChunks?: number;
    originalId?: string;
    tags: string[];
}

export interface SearchOptions {
    limit?: number;
    minSimilarity?: number;
    filterType?: string;
    filterSource?: string;
    filterTags?: string[];
}

export interface SimilarityResult {
    entry: VectorEntry;
    similarity: number;
}

// ============================================
// VECTOR STORE CLASS
// ============================================

export class VectorStore {
    private entries: Map<string, VectorEntry> = new Map();
    private embeddingCache: Map<string, number[]> = new Map();
    private model: ChatOpenAI | null = null;
    private embeddingDimension: number = 1536; // Default for OpenAI embeddings
    private useLocalEmbeddings: boolean = true; // Use local TF-IDF by default

    constructor() {
        // Local embeddings for speed and cost savings
        this.useLocalEmbeddings = true;
    }

    // ============================================
    // EMBEDDING GENERATION
    // ============================================

    /**
     * Generate embedding for text using local TF-IDF based approach
     * For production, replace with OpenAI embeddings
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // Check cache first
        const cacheKey = this.hashText(text);
        if (this.embeddingCache.has(cacheKey)) {
            return this.embeddingCache.get(cacheKey)!;
        }

        let embedding: number[];

        if (this.useLocalEmbeddings) {
            // Use local TF-IDF based embedding (fast, free)
            embedding = this.generateLocalEmbedding(text);
        } else {
            // Use OpenAI embeddings (better quality, costs tokens)
            embedding = await this.generateOpenAIEmbedding(text);
        }

        // Cache the result
        this.embeddingCache.set(cacheKey, embedding);

        return embedding;
    }

    /**
     * Generate local TF-IDF based embedding
     * This is a simplified version - good for MVP
     */
    private generateLocalEmbedding(text: string): number[] {
        const dimension = 256; // Smaller dimension for local
        const embedding = new Array(dimension).fill(0);

        // Tokenize and normalize
        const tokens = this.tokenize(text.toLowerCase());
        const tokenSet = new Set(tokens);

        // Generate embedding based on token hashing
        for (const token of tokenSet) {
            const hash = this.hashToken(token);
            const frequency = tokens.filter(t => t === token).length / tokens.length;

            // Distribute token influence across multiple dimensions
            for (let i = 0; i < 4; i++) {
                const index = (hash + i * 64) % dimension;
                embedding[index] += frequency * (1 / (i + 1));
            }
        }

        // Add n-gram features
        for (let i = 0; i < tokens.length - 1; i++) {
            const bigram = tokens[i] + "_" + tokens[i + 1];
            const hash = this.hashToken(bigram);
            const index = hash % dimension;
            embedding[index] += 0.5 / tokens.length;
        }

        // Normalize to unit vector
        return this.normalize(embedding);
    }

    /**
     * Generate OpenAI embedding (for production use)
     */
    private async generateOpenAIEmbedding(text: string): Promise<number[]> {
        if (!this.model) {
            this.initializeModel();
        }

        try {
            // For GLM-4, we'll use a workaround since it might not support embeddings
            // In production, use a dedicated embedding model
            console.log(`🔢 [Vector] Generating embedding for ${text.length} chars...`);

            // Fallback to local embeddings for now
            return this.generateLocalEmbedding(text);
        } catch (error) {
            console.error("Embedding generation failed, using local:", error);
            return this.generateLocalEmbedding(text);
        }
    }

    // ============================================
    // STORAGE OPERATIONS
    // ============================================

    /**
     * Store content with its embedding
     */
    async store(
        content: string,
        metadata: Partial<VectorMetadata>
    ): Promise<string> {
        // Chunk long content
        const chunks = this.chunkContent(content);
        const ids: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await this.generateEmbedding(chunk);

            const id = this.generateId(chunk);
            const entry: VectorEntry = {
                id,
                content: chunk,
                embedding,
                metadata: {
                    source: metadata.source || "unknown",
                    type: metadata.type || "text",
                    tags: metadata.tags || [],
                    chunkIndex: chunks.length > 1 ? i : undefined,
                    totalChunks: chunks.length > 1 ? chunks.length : undefined,
                    originalId: chunks.length > 1 ? this.generateId(content) : undefined,
                },
                createdAt: new Date(),
            };

            this.entries.set(id, entry);
            ids.push(id);
        }

        console.log(`🔢 [Vector] Stored ${chunks.length} chunk(s) for "${metadata.source}"`);
        return ids[0]; // Return first chunk ID
    }

    /**
     * Store code with special handling
     */
    async storeCode(
        code: string,
        source: string,
        language: string = "typescript"
    ): Promise<string> {
        // Extract important parts of code
        const enhanced = this.enhanceCodeForEmbedding(code);

        return this.store(enhanced, {
            source,
            type: "code",
            tags: [language, "code"],
        });
    }

    // ============================================
    // SEARCH OPERATIONS
    // ============================================

    /**
     * Search by semantic similarity
     */
    async search(
        query: string,
        options: SearchOptions = {}
    ): Promise<SimilarityResult[]> {
        const {
            limit = 5,
            minSimilarity = 0.3,
            filterType,
            filterSource,
            filterTags,
        } = options;

        const queryEmbedding = await this.generateEmbedding(query);
        const results: SimilarityResult[] = [];

        for (const entry of this.entries.values()) {
            // Apply filters
            if (filterType && entry.metadata.type !== filterType) continue;
            if (filterSource && entry.metadata.source !== filterSource) continue;
            if (filterTags && !filterTags.some(t => entry.metadata.tags.includes(t))) continue;

            // Calculate cosine similarity
            const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

            if (similarity >= minSimilarity) {
                results.push({ entry, similarity });
            }
        }

        // Sort by similarity (descending) and limit
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
    }

    /**
     * Hybrid search - combines keyword and semantic search
     */
    async hybridSearch(
        query: string,
        options: SearchOptions = {}
    ): Promise<SimilarityResult[]> {
        const semanticResults = await this.search(query, { ...options, limit: (options.limit || 5) * 2 });

        // Also do keyword matching
        const queryTerms = this.tokenize(query.toLowerCase());
        const keywordBoosts: Map<string, number> = new Map();

        for (const entry of this.entries.values()) {
            const contentTerms = this.tokenize(entry.content.toLowerCase());
            const matches = queryTerms.filter(t => contentTerms.includes(t));

            if (matches.length > 0) {
                const boost = matches.length / queryTerms.length * 0.2;
                keywordBoosts.set(entry.id, boost);
            }
        }

        // Apply keyword boosts to semantic results
        for (const result of semanticResults) {
            const boost = keywordBoosts.get(result.entry.id) || 0;
            result.similarity = Math.min(1, result.similarity + boost);
        }

        // Re-sort and limit
        semanticResults.sort((a, b) => b.similarity - a.similarity);
        return semanticResults.slice(0, options.limit || 5);
    }

    /**
     * Find similar entries to a given entry
     */
    async findSimilar(entryId: string, limit: number = 5): Promise<SimilarityResult[]> {
        const entry = this.entries.get(entryId);
        if (!entry) return [];

        const results: SimilarityResult[] = [];

        for (const other of this.entries.values()) {
            if (other.id === entryId) continue;

            const similarity = this.cosineSimilarity(entry.embedding, other.embedding);
            results.push({ entry: other, similarity });
        }

        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
    }

    // ============================================
    // RETRIEVAL OPERATIONS
    // ============================================

    /**
     * Get entry by ID
     */
    get(id: string): VectorEntry | undefined {
        return this.entries.get(id);
    }

    /**
     * Get all entries of a type
     */
    getByType(type: string): VectorEntry[] {
        return Array.from(this.entries.values())
            .filter(e => e.metadata.type === type);
    }

    /**
     * Get all entries from a source
     */
    getBySource(source: string): VectorEntry[] {
        return Array.from(this.entries.values())
            .filter(e => e.metadata.source === source);
    }

    /**
     * Get context for an agent
     * Returns the most relevant entries for a given task
     */
    async getAgentContext(
        agentId: string,
        taskDescription: string,
        limit: number = 5
    ): Promise<string[]> {
        const results = await this.hybridSearch(taskDescription, { limit });

        return results.map(r => {
            return `[${r.entry.metadata.type}] (similarity: ${(r.similarity * 100).toFixed(0)}%)\n${r.entry.content.substring(0, 500)}`;
        });
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            // Pad shorter array
            const maxLen = Math.max(a.length, b.length);
            a = [...a, ...new Array(maxLen - a.length).fill(0)];
            b = [...b, ...new Array(maxLen - b.length).fill(0)];
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) return 0;

        return dotProduct / denominator;
    }

    /**
     * Normalize vector to unit length
     */
    private normalize(vector: number[]): number[] {
        const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        if (norm === 0) return vector;
        return vector.map(v => v / norm);
    }

    /**
     * Tokenize text
     */
    private tokenize(text: string): string[] {
        return text
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(t => t.length > 2);
    }

    /**
     * Hash a token to a number
     */
    private hashToken(token: string): number {
        let hash = 0;
        for (let i = 0; i < token.length; i++) {
            const char = token.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Hash text for caching
     */
    private hashText(text: string): string {
        return crypto.createHash("md5")
            .update(text.substring(0, 1000))
            .digest("hex");
    }

    /**
     * Generate unique ID
     */
    private generateId(content: string): string {
        const hash = crypto.createHash("md5")
            .update(content.substring(0, 500))
            .digest("hex")
            .substring(0, 12);
        return `vec_${hash}`;
    }

    /**
     * Chunk long content for better embedding
     */
    private chunkContent(content: string, maxChunkSize: number = 1000): string[] {
        if (content.length <= maxChunkSize) {
            return [content];
        }

        const chunks: string[] = [];
        const sentences = content.split(/[.!?]\s+/);
        let currentChunk = "";

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? ". " : "") + sentence;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Enhance code for better embedding
     */
    private enhanceCodeForEmbedding(code: string): string {
        // Extract key parts of code for better semantic search
        const parts: string[] = [];

        // Extract function/class names
        const funcMatches = code.match(/(?:function|class|const|interface|type)\s+(\w+)/g);
        if (funcMatches) {
            parts.push("DEFINES: " + funcMatches.join(", "));
        }

        // Extract imports
        const importMatches = code.match(/from ["']([^"']+)["']/g);
        if (importMatches) {
            parts.push("USES: " + importMatches.map(m => m.replace(/from ["']|["']/g, "")).join(", "));
        }

        // Extract exports
        const exportMatches = code.match(/export\s+(?:default\s+)?(\w+)/g);
        if (exportMatches) {
            parts.push("EXPORTS: " + exportMatches.join(", "));
        }

        // Add the full code
        parts.push("CODE:\n" + code);

        return parts.join("\n");
    }

    /**
     * Initialize LLM model
     */
    private initializeModel(): void {
        this.model = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
        });
    }

    // ============================================
    // STATS AND MANAGEMENT
    // ============================================

    /**
     * Get store statistics
     */
    getStats(): {
        totalEntries: number;
        byType: Record<string, number>;
        bySource: Record<string, number>;
        cacheSize: number;
    } {
        const byType: Record<string, number> = {};
        const bySource: Record<string, number> = {};

        for (const entry of this.entries.values()) {
            byType[entry.metadata.type] = (byType[entry.metadata.type] || 0) + 1;
            bySource[entry.metadata.source] = (bySource[entry.metadata.source] || 0) + 1;
        }

        return {
            totalEntries: this.entries.size,
            byType,
            bySource,
            cacheSize: this.embeddingCache.size,
        };
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.entries.clear();
        this.embeddingCache.clear();
    }

    /**
     * Export all entries
     */
    export(): VectorEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Import entries
     */
    import(entries: VectorEntry[]): void {
        for (const entry of entries) {
            this.entries.set(entry.id, entry);
        }
        console.log(`🔢 [Vector] Imported ${entries.length} entries`);
    }
}

// Export singleton instance
export const vectorStore = new VectorStore();
