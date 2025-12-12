/**
 * Vector Store Service
 * 
 * Phase 18: Vector Database Context Retrieval
 * 
 * This service provides:
 * - Code embeddings storage using pgvector
 * - Semantic similarity search for context retrieval
 * - Codebase indexing and updates
 * - Relevant context selection for AI prompts
 * 
 * Uses Supabase pgvector extension for efficient vector operations
 */

import { getSupabaseAdmin } from './database-client.js';

// ============================================
// TYPES
// ============================================

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

export interface IndexingResult {
    success: boolean;
    projectId: string;
    chunksCreated: number;
    chunksUpdated: number;
    chunksDeleted: number;
    errors: string[];
}

export interface SearchOptions {
    projectId?: string;
    language?: string;
    limit?: number;
    threshold?: number;
    includeContent?: boolean;
}

// ============================================
// VECTOR STORE SERVICE
// ============================================

export class VectorStoreService {
    private config: VectorStoreConfig;
    private initialized = false;
    private embeddingCache: Map<string, number[]> = new Map();

    constructor(config?: Partial<VectorStoreConfig>) {
        this.config = {
            embeddingModel: config?.embeddingModel || 'text-embedding-3-small',
            dimensions: config?.dimensions || 1536,
            chunkSize: config?.chunkSize || 1000,
            chunkOverlap: config?.chunkOverlap || 200,
            similarityThreshold: config?.similarityThreshold || 0.7,
        };

        console.log('[VECTOR-STORE] Created with config:', {
            model: this.config.embeddingModel,
            dimensions: this.config.dimensions,
            chunkSize: this.config.chunkSize,
        });
    }

    /**
     * Initialize the vector store (create tables if needed)
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[VECTOR-STORE] Initializing...');

        try {
            const supabase = getSupabaseAdmin();
            if (!supabase) {
                console.warn('[VECTOR-STORE] Supabase not available, running in memory-only mode');
                this.initialized = true;
                return;
            }

            // Check if the code_embeddings table exists
            const { error } = await supabase
                .from('code_embeddings')
                .select('id')
                .limit(1);

            if (error && error.code === '42P01') {
                console.warn('[VECTOR-STORE] code_embeddings table not found. Run the migration first.');
            }

            this.initialized = true;
            console.log('[VECTOR-STORE] Initialized successfully');
        } catch (error) {
            console.warn('[VECTOR-STORE] Initialization warning:', error);
            this.initialized = true; // Continue in memory-only mode
        }
    }

    // ============================================
    // EMBEDDING GENERATION
    // ============================================

    /**
     * Generate embedding for text using OpenAI API
     */
    async generateEmbedding(text: string): Promise<number[]> {
        // Check cache first
        const cacheKey = this.hashText(text);
        const cached = this.embeddingCache.get(cacheKey);
        if (cached) return cached;

        try {
            const apiKey = process.env.OPENAI_API_KEY;
            const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

            if (!apiKey) {
                // Return mock embedding for development
                console.warn('[VECTOR-STORE] No OpenAI key, generating mock embedding');
                return this.generateMockEmbedding();
            }

            const response = await fetch(`${baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.embeddingModel,
                    input: text.slice(0, 8000), // Limit input size
                }),
            });

            if (!response.ok) {
                throw new Error(`Embedding API error: ${response.status}`);
            }

            const data = await response.json() as { data: Array<{ embedding: number[] }> };
            const embedding = data.data[0].embedding;

            // Cache the result
            this.embeddingCache.set(cacheKey, embedding);

            return embedding;
        } catch (error) {
            console.error('[VECTOR-STORE] Embedding generation failed:', error);
            return this.generateMockEmbedding();
        }
    }

    /**
     * Generate mock embedding for development/testing
     */
    private generateMockEmbedding(): number[] {
        const embedding: number[] = [];
        for (let i = 0; i < this.config.dimensions; i++) {
            embedding.push((Math.random() - 0.5) * 2);
        }
        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
        return embedding.map(x => x / magnitude);
    }

    /**
     * Simple hash for caching
     */
    private hashText(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    // ============================================
    // CHUNK OPERATIONS
    // ============================================

    /**
     * Split content into chunks for embedding
     */
    chunkContent(content: string, filePath: string): Array<{
        content: string;
        startLine: number;
        endLine: number;
    }> {
        const lines = content.split('\n');
        const chunks: Array<{ content: string; startLine: number; endLine: number }> = [];

        let currentChunk = '';
        let startLine = 1;
        let lineCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const newChunk = currentChunk + (currentChunk ? '\n' : '') + line;

            if (newChunk.length > this.config.chunkSize && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    content: currentChunk,
                    startLine,
                    endLine: startLine + lineCount - 1,
                });

                // Start new chunk with overlap
                const overlapLines = Math.floor(this.config.chunkOverlap / 50);
                const overlapStart = Math.max(0, i - overlapLines);
                currentChunk = lines.slice(overlapStart, i + 1).join('\n');
                startLine = overlapStart + 1;
                lineCount = i - overlapStart + 1;
            } else {
                currentChunk = newChunk;
                lineCount++;
            }
        }

        // Don't forget the last chunk
        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk,
                startLine,
                endLine: lines.length,
            });
        }

        return chunks;
    }

    /**
     * Detect language from file path
     */
    private detectLanguage(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const languageMap: Record<string, string> = {
            ts: 'typescript',
            tsx: 'typescript',
            js: 'javascript',
            jsx: 'javascript',
            py: 'python',
            go: 'go',
            rs: 'rust',
            java: 'java',
            json: 'json',
            yaml: 'yaml',
            yml: 'yaml',
            md: 'markdown',
            sql: 'sql',
        };
        return languageMap[ext] || 'text';
    }

    // ============================================
    // INDEX OPERATIONS
    // ============================================

    /**
     * Index a single file
     */
    async indexFile(projectId: string, filePath: string, content: string): Promise<{
        success: boolean;
        chunksCreated: number;
        error?: string;
    }> {
        try {
            const supabase = getSupabaseAdmin();

            // Delete existing chunks for this file
            if (supabase) {
                await supabase
                    .from('code_embeddings')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('file_path', filePath);
            }

            // Split into chunks
            const chunks = this.chunkContent(content, filePath);
            const language = this.detectLanguage(filePath);
            const insertedChunks: EmbeddedChunk[] = [];

            // Generate embeddings and store
            for (const chunk of chunks) {
                const embedding = await this.generateEmbedding(chunk.content);

                const embeddedChunk: EmbeddedChunk = {
                    projectId,
                    filePath,
                    content: chunk.content,
                    startLine: chunk.startLine,
                    endLine: chunk.endLine,
                    language,
                    embedding,
                    embeddingModel: this.config.embeddingModel,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                if (supabase) {
                    const { error } = await supabase
                        .from('code_embeddings')
                        .insert({
                            project_id: projectId,
                            file_path: filePath,
                            content: chunk.content,
                            start_line: chunk.startLine,
                            end_line: chunk.endLine,
                            language,
                            embedding: `[${embedding.join(',')}]`,
                            embedding_model: this.config.embeddingModel,
                        });

                    if (error) {
                        console.error('[VECTOR-STORE] Insert error:', error);
                    }
                }

                insertedChunks.push(embeddedChunk);
            }

            console.log(`[VECTOR-STORE] Indexed ${filePath}: ${insertedChunks.length} chunks`);

            return {
                success: true,
                chunksCreated: insertedChunks.length,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                chunksCreated: 0,
                error: errorMsg,
            };
        }
    }

    /**
     * Index an entire project (multiple files)
     */
    async indexProject(projectId: string, files: Array<{ path: string; content: string }>): Promise<IndexingResult> {
        console.log(`[VECTOR-STORE] Indexing project ${projectId} with ${files.length} files`);

        const result: IndexingResult = {
            success: true,
            projectId,
            chunksCreated: 0,
            chunksUpdated: 0,
            chunksDeleted: 0,
            errors: [],
        };

        for (const file of files) {
            const fileResult = await this.indexFile(projectId, file.path, file.content);

            if (fileResult.success) {
                result.chunksCreated += fileResult.chunksCreated;
            } else {
                result.errors.push(`${file.path}: ${fileResult.error}`);
            }
        }

        result.success = result.errors.length === 0;
        console.log(`[VECTOR-STORE] Project indexing complete: ${result.chunksCreated} chunks`);

        return result;
    }

    // ============================================
    // SEARCH OPERATIONS
    // ============================================

    /**
     * Search for similar code chunks using vector similarity
     */
    async search(query: string, options: SearchOptions = {}): Promise<SimilarityResult[]> {
        const {
            projectId,
            language,
            limit = 10,
            threshold = this.config.similarityThreshold,
            includeContent = true,
        } = options;

        try {
            // Generate embedding for query
            const queryEmbedding = await this.generateEmbedding(query);
            const supabase = getSupabaseAdmin();

            if (!supabase) {
                console.warn('[VECTOR-STORE] Search unavailable: Supabase not configured');
                return [];
            }

            // Use Supabase's vector similarity search
            // This requires the match_code_embeddings RPC function
            const { data, error } = await supabase.rpc('match_code_embeddings', {
                query_embedding: queryEmbedding,
                match_threshold: threshold,
                match_count: limit,
                filter_project_id: projectId || null,
                filter_language: language || null,
            });

            if (error) {
                // If RPC doesn't exist, fall back to manual search
                console.warn('[VECTOR-STORE] RPC not available, using fallback search');
                return this.fallbackSearch(queryEmbedding, options);
            }

            return (data || []).map((row: Record<string, unknown>) => ({
                chunk: {
                    id: row.id as string,
                    projectId: row.project_id as string,
                    filePath: row.file_path as string,
                    content: includeContent ? row.content as string : '',
                    startLine: row.start_line as number,
                    endLine: row.end_line as number,
                    language: row.language as string,
                    embedding: [],
                    embeddingModel: row.embedding_model as string,
                    createdAt: new Date(row.created_at as string),
                    updatedAt: new Date(row.updated_at as string),
                },
                similarity: row.similarity as number,
                relevanceScore: (row.similarity as number) * 100,
            }));
        } catch (error) {
            console.error('[VECTOR-STORE] Search error:', error);
            return [];
        }
    }

    /**
     * Fallback search when RPC is not available
     */
    private async fallbackSearch(
        queryEmbedding: number[],
        options: SearchOptions
    ): Promise<SimilarityResult[]> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        let query = supabase
            .from('code_embeddings')
            .select('*')
            .limit(options.limit || 100);

        if (options.projectId) {
            query = query.eq('project_id', options.projectId);
        }
        if (options.language) {
            query = query.eq('language', options.language);
        }

        const { data, error } = await query;
        if (error || !data) return [];

        // Calculate similarities manually
        const results: SimilarityResult[] = data
            .map((row: Record<string, unknown>) => {
                // Parse embedding from string
                let embedding: number[] = [];
                const embeddingStr = row.embedding as string;
                if (embeddingStr) {
                    try {
                        embedding = JSON.parse(embeddingStr);
                    } catch {
                        embedding = [];
                    }
                }

                const similarity = this.cosineSimilarity(queryEmbedding, embedding);

                return {
                    chunk: {
                        id: row.id as string,
                        projectId: row.project_id as string,
                        filePath: row.file_path as string,
                        content: options.includeContent ? row.content as string : '',
                        startLine: row.start_line as number,
                        endLine: row.end_line as number,
                        language: row.language as string,
                        embedding: [],
                        embeddingModel: row.embedding_model as string,
                        createdAt: new Date(row.created_at as string),
                        updatedAt: new Date(row.updated_at as string),
                    },
                    similarity,
                    relevanceScore: similarity * 100,
                };
            })
            .filter(r => r.similarity >= (options.threshold || this.config.similarityThreshold))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, options.limit || 10);

        return results;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length || a.length === 0) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    // ============================================
    // CONTEXT RETRIEVAL
    // ============================================

    /**
     * Get relevant context for a user prompt
     * This is the main method for context retrieval in code generation
     */
    async getRelevantContext(
        prompt: string,
        projectId: string,
        options: {
            maxChunks?: number;
            maxTokens?: number;
            includeImports?: boolean;
        } = {}
    ): Promise<{
        context: string;
        files: Array<{ path: string; startLine: number; endLine: number; relevance: number }>;
        tokenEstimate: number;
    }> {
        const { maxChunks = 5, maxTokens = 2000, includeImports = true } = options;

        // Search for relevant chunks
        const results = await this.search(prompt, {
            projectId,
            limit: maxChunks * 2, // Get extra to filter
            threshold: 0.6,
            includeContent: true,
        });

        // Collect context
        let context = '';
        let tokenEstimate = 0;
        const files: Array<{ path: string; startLine: number; endLine: number; relevance: number }> = [];

        for (const result of results) {
            const chunkTokens = Math.ceil(result.chunk.content.length / 4);

            if (tokenEstimate + chunkTokens > maxTokens) break;
            if (files.length >= maxChunks) break;

            // Add file header
            context += `\n// File: ${result.chunk.filePath} (lines ${result.chunk.startLine}-${result.chunk.endLine})\n`;
            context += result.chunk.content + '\n';

            tokenEstimate += chunkTokens;
            files.push({
                path: result.chunk.filePath,
                startLine: result.chunk.startLine,
                endLine: result.chunk.endLine,
                relevance: result.relevanceScore,
            });
        }

        return {
            context: context.trim(),
            files,
            tokenEstimate,
        };
    }

    // ============================================
    // CLEANUP
    // ============================================

    /**
     * Delete all embeddings for a project
     */
    async deleteProject(projectId: string): Promise<boolean> {
        try {
            const supabase = getSupabaseAdmin();
            if (!supabase) return true;

            const { error } = await supabase
                .from('code_embeddings')
                .delete()
                .eq('project_id', projectId);

            if (error) {
                console.error('[VECTOR-STORE] Delete error:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[VECTOR-STORE] Delete error:', error);
            return false;
        }
    }

    /**
     * Clear embedding cache
     */
    clearCache(): void {
        this.embeddingCache.clear();
        console.log('[VECTOR-STORE] Cache cleared');
    }
}

// ============================================
// SINGLETON
// ============================================

let vectorStoreInstance: VectorStoreService | null = null;

export function getVectorStore(): VectorStoreService {
    if (!vectorStoreInstance) {
        vectorStoreInstance = new VectorStoreService();
    }
    return vectorStoreInstance;
}

export function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStoreService {
    vectorStoreInstance = new VectorStoreService(config);
    return vectorStoreInstance;
}
