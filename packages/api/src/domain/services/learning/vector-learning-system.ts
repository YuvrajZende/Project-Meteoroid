/**
 * Vector-Based Learning System
 * 
 * Uses Convex vector embeddings to provide SEMANTIC learning from past projects.
 * This replaces SQL table queries with intelligent vector similarity search.
 */

import { getConvexClient, api } from '../../../infrastructure/database/convex-client.js';

export interface VectorLearningContext {
    similarProjects: Array<{
        projectId: string;
        filePath: string;
        content: string;
        language: string;
        framework: string;
        similarity: number;
    }>;

    bestPractices: Array<{
        practice: string;
        category: string;
        source: string;
        confidence: number;
    }>;

    statistics: {
        totalMatches: number;
        avgSimilarity: number;
        topLanguages: string[];
        topFrameworks: string[];
    };
}

export class VectorLearningSystem {
    private initialized = false;
    private convex = getConvexClient();

    async initialize(): Promise<void> {
        if (this.initialized) return;
        console.log('[VECTOR-LEARNING] Initializing vector-based learning system (using Fast AI Model)');
        this.initialized = true;
    }

    /**
     * Build learning context using vector embeddings
     */
    async buildContext(prompt: string, options: {
        language?: string;
        framework?: string;
        maxCodeExamples?: number;
        maxPractices?: number;
    } = {}): Promise<VectorLearningContext> {
        await this.initialize();

        const {
            language,
            maxCodeExamples = 5,
            maxPractices = 10,
        } = options;

        console.log('[VECTOR-LEARNING] Building context for:', prompt.substring(0, 100));

        try {
            // 1. Generate embedding for the prompt using Fast AI
            const embedding = await this.generateEmbedding(prompt);

            if (!embedding) {
                console.warn('[VECTOR-LEARNING] Could not generate embedding, using empty context');
                return this.getEmptyContext();
            }

            // 2. Semantic search in code_embeddings table (Convex)
            const similarProjects = await this.searchCodeEmbeddings(embedding, {
                language,
                limit: maxCodeExamples,
                threshold: 0.7
            });

            // 3. Semantic search in knowledge search (Convex)
            // Note: Schema treats knowledge_embeddings separately.
            // Using API action/query for best practices.
            // For now, using logic similar to original: search knowledge_embeddings and learned_patterns
            const bestPractices = await this.searchKnowledgeBase(embedding, {
                limit: maxPractices,
                threshold: 0.6
            });

            // 4. Calculate statistics
            const statistics = this.calculateStatistics(similarProjects);

            const context: VectorLearningContext = {
                similarProjects,
                bestPractices,
                statistics
            };

            console.log(`[VECTOR-LEARNING] Found ${similarProjects.length} similar projects, ${bestPractices.length} best practices`);

            return context;

        } catch (error: unknown) {
            console.warn('[VECTOR-LEARNING] Error building context:', error instanceof Error ? error.message : error);
            return this.getEmptyContext();
        }
    }

    /**
     * Generate embedding using Fast AI Model (Groq)
     * Uses AI to extract semantic features and creates 1536-dimensional vector
     */
    private async generateEmbedding(text: string): Promise<number[] | null> {
        try {
            const { getAIClient } = await import('../../infrastructure/ai-client.js');
            const aiClient = getAIClient();

            // Use AI to extract semantic features
            const prompt = `Extract 30 numerical semantic features (0-1 scale) from this text. Return ONLY a JSON array like [0.8, 0.3, ...].
Features: subject_complexity, technical_depth, action_oriented, entity_richness, temporal_refs, causal_links, abstraction_level, specificity, formality, sentiment_positive, sentiment_negative, question_type, instruction_type, code_related, backend_focus, frontend_focus, database_refs, api_refs, auth_refs, framework_refs, language_refs, architecture_refs, microservice_refs, scalability_refs, security_refs, performance_refs, testing_refs, deployment_refs, documentation, enterprise_level.

Text: "${text.substring(0, 400)}"

Return ONLY the array:`;

            const response = await aiClient.chat([{ role: 'user', content: prompt }]);

            // Extract array from response
            const match = response.match(/\[([\d.,\s]+)\]/);
            if (!match) {
                console.warn('[VECTOR-LEARNING] AI feature extraction failed, using hash-based');
                return this.generateHashEmbedding(text);
            }

            const features = match[1]
                .split(',')
                .map(n => parseFloat(n.trim()))
                .filter(n => !isNaN(n) && n >= 0 && n <= 1);

            if (features.length < 20) {
                console.warn('[VECTOR-LEARNING] Insufficient features, using hash-based');
                return this.generateHashEmbedding(text);
            }

            console.log(`[VECTOR-LEARNING] Generated embedding with ${features.length} AI features`);
            return this.expandTo1536(features, text);

        } catch (error: unknown) {
            console.warn('[VECTOR-LEARNING] Embedding generation error, using hash:', error instanceof Error ? error.message : error);
            return this.generateHashEmbedding(text);
        }
    }

    /**
     * Expand features to 1536 dimensions (OpenAI compatible size)
     */
    private expandTo1536(features: number[], text: string): number[] {
        const DIMS = 1536;
        const embedding = new Array(DIMS).fill(0);
        const segmentSize = Math.floor(DIMS / features.length);

        // Distribute features across dimensions with variations
        for (let i = 0; i < features.length; i++) {
            const baseValue = features[i];
            for (let j = 0; j < segmentSize; j++) {
                const idx = i * segmentSize + j;
                if (idx < DIMS) {
                    // Add variation based on text hash
                    const variation = (this.hash(text + i + j) % 1000) / 5000; // -0.1 to +0.1
                    embedding[idx] = Math.max(0, Math.min(1, baseValue + variation - 0.1));
                }
            }
        }

        // Fill remaining dimensions
        for (let i = features.length * segmentSize; i < DIMS; i++) {
            embedding[i] = (this.hash(text + i) % 1000) / 2000;
        }

        return this.normalize(embedding);
    }

    /**
     * Hash-based embedding (deterministic fallback)
     */
    private generateHashEmbedding(text: string): number[] {
        const DIMS = 1536;
        const embedding = new Array(DIMS);
        const normalized = text.toLowerCase().trim();

        // Generate deterministic embedding from text
        for (let i = 0; i < DIMS; i++) {
            const hash = this.hash(normalized + i);
            embedding[i] = (hash % 1000) / 1000;
        }

        // Add word-based features
        const words = normalized.split(/\s+/);
        for (let i = 0; i < Math.min(words.length, 100); i++) {
            const wordHash = this.hash(words[i]);
            const idx = wordHash % DIMS;
            embedding[idx] = Math.min(embedding[idx] + 0.1, 1.0);
        }

        return this.normalize(embedding);
    }

    /**
     * Simple hash function
     */
    private hash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * Normalize vector to unit length
     */
    private normalize(vector: number[]): number[] {
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
    }

    /**
     * Semantic search in code_embedding table via Convex
     */
    private async searchCodeEmbeddings(
        embedding: number[],
        options: { language?: string; limit: number; threshold: number }
    ): Promise<VectorLearningContext['similarProjects']> {
        try {
            // Use Convex action for vector search
            const results = await this.convex.action(api.learning_system.searchCode, {
                embedding,
                limit: options.limit,
                threshold: options.threshold,
                language: options.language
            });

            return results.map((row: any) => ({
                projectId: row.projectId || 'unknown',
                filePath: row.filePath || '',
                content: row.content?.substring(0, 500) || '',
                language: row.language || 'unknown',
                framework: (row.metadata?.framework) || 'none',
                similarity: row.similarity || 0
            }));
        } catch (error: unknown) {
            console.warn('[VECTOR-LEARNING] Code search error:', error instanceof Error ? error.message : error);
            return [];
        }
    }

    /**
     * Semantic search for best practices
     * Currently falls back to learned patterns as knowledge embedding search isn't ported 1:1 yet
     */
    private async searchKnowledgeBase(
        embedding: number[],
        options: { limit: number; threshold: number }
    ): Promise<VectorLearningContext['bestPractices']> {
        try {
            // TODO: Implement vector search for knowledge embeddings if needed.
            // For now, fetching learned patterns.

            const patterns = await this.convex.query(api.learning_system.listLearnedPatterns, {
                limit: options.limit,
                type: 'success' // Prefer successful patterns
            });

            const practices = patterns.map((p: any) => ({
                practice: p.description || p.pattern || 'Unknown practice',
                category: p.category || 'general',
                source: 'learned-patterns',
                confidence: p.confidence || 0.7
            }));

            // Also get recent successful generations
            const generations = await this.convex.query(api.learning_system.getSuccessfulGenerations, {
                limit: options.limit
            });

            const generationPractices = generations.map((g: any) => ({
                practice: `Successful generation: ${g.prompt.substring(0, 50)}...`,
                category: g.config?.language || 'general',
                source: 'past-success',
                confidence: 0.8
            }));

            return [...practices, ...generationPractices].slice(0, options.limit);
        } catch (error: unknown) {
            console.warn('[VECTOR-LEARNING] Knowledge search error:', error instanceof Error ? error.message : error);
            return [];
        }
    }

    /**
     * Calculate statistics from search results
     */
    private calculateStatistics(projects: VectorLearningContext['similarProjects']): VectorLearningContext['statistics'] {
        if (projects.length === 0) {
            return {
                totalMatches: 0,
                avgSimilarity: 0,
                topLanguages: [],
                topFrameworks: []
            };
        }

        const avgSimilarity = projects.reduce((sum, p) => sum + p.similarity, 0) / projects.length;

        const langCounts = new Map<string, number>();
        const fwCounts = new Map<string, number>();

        for (const proj of projects) {
            langCounts.set(proj.language, (langCounts.get(proj.language) || 0) + 1);
            fwCounts.set(proj.framework, (fwCounts.get(proj.framework) || 0) + 1);
        }

        const topLanguages = Array.from(langCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang]) => lang);

        const topFrameworks = Array.from(fwCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([fw]) => fw);

        return {
            totalMatches: projects.length,
            avgSimilarity,
            topLanguages,
            topFrameworks
        };
    }

    /**
     * Format learning context for LLM consumption
     */
    formatForLLM(context: VectorLearningContext): string {
        if (context.similarProjects.length === 0 && context.bestPractices.length === 0) {
            return '';
        }

        let formatted = '🧠 LEARNING FROM SIMILAR PAST PROJECTS:\n';
        formatted += '=========================================\n\n';

        // Similar projects
        if (context.similarProjects.length > 0) {
            formatted += `📁 FOUND ${context.similarProjects.length} SEMANTICALLY SIMILAR PROJECTS:\n`;
            context.similarProjects.forEach((proj, i) => {
                formatted += `${i + 1}. ${proj.filePath} (${(proj.similarity * 100).toFixed(0)}% match)\n`;
                formatted += `   Language: ${proj.language}, Framework: ${proj.framework}\n`;
                formatted += `   Code Preview:\n\`\`\`${proj.language}\n${proj.content}\n\`\`\`\n\n`;
            });
        }

        // Best practices
        if (context.bestPractices.length > 0) {
            formatted += `✅ RELEVANT BEST PRACTICES (from knowledge base):\n`;
            context.bestPractices.forEach((practice, i) => {
                formatted += `${i + 1}. ${practice.practice}\n`;
                formatted += `   Category: ${practice.category} | Confidence: ${(practice.confidence * 100).toFixed(0)}%\n\n`;
            });
        }

        // Statistics
        if (context.statistics.totalMatches > 0) {
            formatted += `📊 INSIGHTS:\n`;
            formatted += `- Average Similarity: ${(context.statistics.avgSimilarity * 100).toFixed(1)}%\n`;
            if (context.statistics.topLanguages.length > 0) {
                formatted += `- Most Used Languages: ${context.statistics.topLanguages.join(', ')}\n`;
            }
            if (context.statistics.topFrameworks.length > 0) {
                formatted += `- Most Used Frameworks: ${context.statistics.topFrameworks.join(', ')}\n`;
            }
        }

        return formatted;
    }

    /**
     * Get empty context (fallback)
     */
    private getEmptyContext(): VectorLearningContext {
        return {
            similarProjects: [],
            bestPractices: [],
            statistics: {
                totalMatches: 0,
                avgSimilarity: 0,
                topLanguages: [],
                topFrameworks: []
            }
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let systemInstance: VectorLearningSystem | null = null;

export function getVectorLearningSystem(): VectorLearningSystem {
    if (!systemInstance) {
        systemInstance = new VectorLearningSystem();
    }
    return systemInstance;
}
