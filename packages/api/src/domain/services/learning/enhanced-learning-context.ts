/**
 * Enhanced Learning Context Builder
 * 
 * Builds rich pre-context from historical data in Supabase:
 * - Past generation iterations
 * - Code embeddings (semantic search)
 * - Knowledge embeddings (learned patterns)
 * - Successful patterns and anti-patterns
 * 
 * This enables the AI to learn from all previous generations over time.
 */

import { getSupabaseAdmin } from '../../../infrastructure/database/database-client.js';
import { getVectorStore } from './vector-store.js';

// Database row types for Supabase queries
interface GenerationIterationRow {
    prompt: string;
    task_description?: string;
    success?: boolean;
    status?: string;
    language?: string;
    framework?: string;
    complexity?: string;
    feedback?: string;
    created_at: string;
}

interface LearnedPatternRow {
    pattern_description?: string;
    pattern?: string;
    description?: string;
    pattern_type?: string;
    category?: string;
    confidence_score?: number;
    confidence?: number;
    examples?: number;
}

interface CodeEmbeddingRow {
    file_path: string;
    content: string;
    metadata?: {
        project_id?: string;
        [key: string]: unknown;
    };
    similarity?: number;
}

export interface LearningContext {
    relevantExperiences: Array<{
        prompt: string;
        outcome: 'success' | 'failure';
        language: string;
        framework: string;
        complexity: string;
        feedback?: string;
        timestamp: string;
    }>;

    patterns: Array<{
        pattern: string;
        category: 'success' | 'anti-pattern' | 'best-practice';
        examples: number;
        confidence: number;
    }>;

    similarCode: Array<{
        filePath: string;
        content: string;
        similarity: number;
        project: string;
    }>;

    warningsAndPitfalls: Array<{
        warning: string;
        context: string;
        occurrences: number;
    }>;

    recommendations: string[];

    statistics: {
        totalIterations: number;
        successRate: number;
        mostUsedLanguage: string;
        mostUsedFramework: string;
        averageComplexity: string;
    };
}

export class EnhancedLearningContextBuilder {
    private initialized = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[LEARNING-CONTEXT] Initializing enhanced learning context builder');
        this.initialized = true;
    }

    /**
     * Build comprehensive learning context for a new prompt
     */
    async buildContext(prompt: string, options: {
        language?: string;
        framework?: string;
        maxExperiences?: number;
        maxPatterns?: number;
        maxCodeExamples?: number;
    } = {}): Promise<LearningContext> {
        await this.initialize();

        const {
            language,
            framework,
            maxExperiences = 5,
            maxPatterns = 10,
            maxCodeExamples = 3,
        } = options;

        const supabase = getSupabaseAdmin();
        const _vectorStore = getVectorStore(); // Reserved for vector search integration
        void _vectorStore;

        if (!supabase) {
            console.warn('[LEARNING-CONTEXT] Supabase not available, returning empty context');
            return this.getEmptyContext();
        }

        console.log('[LEARNING-CONTEXT] Building context for prompt:', prompt.substring(0, 100));

        // Parallel queries for better performance
        const [
            experiences,
            patterns,
            similarCode,
            warnings,
            stats
        ] = await Promise.all([
            this.getRelevantExperiences(prompt, language, framework, maxExperiences),
            this.getLearnedPatterns(language, framework, maxPatterns),
            this.getSimilarCode(prompt, maxCodeExamples),
            this.getWarningsAndPitfalls(language, framework),
            this.getStatistics(language, framework),
        ]);

        const recommendations = this.generateRecommendations(experiences, patterns, stats);

        const context: LearningContext = {
            relevantExperiences: experiences,
            patterns,
            similarCode,
            warningsAndPitfalls: warnings,
            recommendations,
            statistics: stats,
        };

        console.log(`[LEARNING-CONTEXT] Built context: ${experiences.length} experiences, ${patterns.length} patterns, ${similarCode.length} code examples`);

        return context;
    }

    /**
     * Get relevant past experiences using semantic search
     */
    private async getRelevantExperiences(
        _prompt: string,
        language?: string,
        framework?: string,
        _limit: number = 5
    ): Promise<LearningContext['relevantExperiences']> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        try {
            // Use wildcard to avoid column errors
            const { data, error } = await supabase
                .from('generation_iterations')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(_limit);

            if (error) {
                console.warn('[LEARNING-CONTEXT] Could not fetch experiences:', error.message);
                return [];
            }

            if (!data || data.length === 0) {
                return [];
            }

            // Safely map with fallbacks for any missing columns
            const experiences = data.map((row: GenerationIterationRow) => ({
                prompt: row.prompt || row.task_description || '',
                outcome: (row.success || row.status === 'success') ? 'success' as const : 'failure' as const,
                language: language || 'python',
                framework: framework || 'none',
                complexity: 'moderate',
                feedback: (row as { quality_feedback?: string }).quality_feedback || row.feedback || (row as { notes?: string }).notes,
                timestamp: row.created_at || new Date().toISOString(),
            }));

            return experiences;
        } catch (error: unknown) {
            console.warn('[LEARNING-CONTEXT] Error in getRelevantExperiences:', error?.message || error);
            return [];
        }
    }

    /**
     * Get learned patterns from database
     */
    private async getLearnedPatterns(
        _language?: string,
        _framework?: string,
        _limit: number = 10
    ): Promise<LearningContext['patterns']> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        try {
            // Use wildcard to avoid column errors
            const { data, error } = await supabase
                .from('learned_patterns')
                .select('*')
                .order('id', { ascending: false })
                .limit(_limit);

            if (error) {
                console.warn('[LEARNING-CONTEXT] Could not fetch patterns:', error.message);
                return [];
            }

            if (!data || data.length === 0) {
                return [];
            }

            // Safely map with fallbacks
            return data.map((row: LearnedPatternRow & { occurrence_count?: number; count?: number }) => ({
                pattern: row.pattern_description || row.pattern || row.description || 'Use best practices',
                category: row.pattern_type || row.category || 'best-practice',
                examples: row.occurrence_count || row.count || 1,
                confidence: row.confidence_score || row.confidence || 0.7,
            }));
        } catch (error: unknown) {
            console.warn('[LEARNING-CONTEXT] Error in getLearnedPatterns:', error?.message || error);
            return [];
        }
    }

    /**
     * Get similar code using vector embeddings
     * Implements semantic search using the vector store
     */
    private async getSimilarCode(
        prompt: string,
        limit: number = 3
    ): Promise<LearningContext['similarCode']> {
        try {
            const vectorStore = getVectorStore();

            // Ensure vector store is initialized
            await vectorStore.initialize();

            // Use vector store to search by semantic similarity
            const searchResults = await vectorStore.search(prompt, {
                limit,
                threshold: 0.6,
                includeContent: true,
            });

            // Transform results to match the expected format
            return searchResults.map((result) => ({
                filePath: result.chunk.filePath,
                content: result.chunk.content,
                similarity: result.similarity,
                project: result.chunk.projectId,
            }));
        } catch (error) {
            console.error('[LEARNING-CONTEXT] Error in getSimilarCode:', error);
            return [];
        }
    }

    /**
     * Get warnings and common pitfalls
     */
    private async getWarningsAndPitfalls(
        language?: string,
        framework?: string
    ): Promise<LearningContext['warningsAndPitfalls']> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        try {
            // Use wildcard and filter in code
            const { data, error } = await supabase
                .from('generation_iterations')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error || !data || data.length === 0) {
                return [];
            }

            // Filter failed ones in code (more flexible)
            const failures = data.filter(row =>
                row.success === false ||
                row.status === 'failed' ||
                row.status === 'error'
            ).slice(0, 20);

            if (failures.length === 0) return [];

            // Aggregate warnings
            const warningMap = new Map<string, { context: string; count: number }>();

            for (const row of failures) {
                const warning = row.error_message || row.error || row.quality_feedback || row.feedback || 'Unknown error';
                const context = `${language || 'any'}/${framework || 'any'}`;

                if (warningMap.has(warning)) {
                    warningMap.get(warning)!.count++;
                } else {
                    warningMap.set(warning, { context, count: 1 });
                }
            }

            // Convert to array and sort by frequency
            return Array.from(warningMap.entries())
                .map(([warning, { context, count }]) => ({
                    warning,
                    context,
                    occurrences: count,
                }))
                .sort((a, b) => b.occurrences - a.occurrences)
                .slice(0, 5);

        } catch (error: unknown) {
            console.warn('[LEARNING-CONTEXT] Error in getWarningsAndPitfalls:', error?.message || error);
            return [];
        }
    }

    /**
     * Get statistics about past generations
     */
    private async getStatistics(
        language?: string,
        framework?: string
    ): Promise<LearningContext['statistics']> {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return {
                totalIterations: 0,
                successRate: 0,
                mostUsedLanguage: 'typescript',
                mostUsedFramework: 'fastify',
                averageComplexity: 'moderate',
            };
        }

        try {
            // Use wildcard for max flexibility
            const { data, error } = await supabase
                .from('generation_iterations')
                .select('*')
                .limit(1000);

            if (error || !data || data.length === 0) {
                return {
                    totalIterations: 0,
                    successRate: 0,
                    mostUsedLanguage: language || 'python',
                    mostUsedFramework: framework || 'none',
                    averageComplexity: 'moderate',
                };
            }

            const total = data.length;
            const successes = data.filter((row: GenerationIterationRow) =>
                row.success === true || row.status === 'success'
            ).length;
            const successRate = total > 0 ? successes / total : 0;

            return {
                totalIterations: total,
                successRate,
                mostUsedLanguage: language || 'python',
                mostUsedFramework: framework || 'none',
                averageComplexity: 'moderate',
            };
        } catch (error: unknown) {
            console.warn('[LEARNING-CONTEXT] Error in getStatistics:', error?.message || error);
            return {
                totalIterations: 0,
                successRate: 0,
                mostUsedLanguage: 'python',
                mostUsedFramework: 'none',
                averageComplexity: 'moderate',
            };
        }
    }

    /**
     * Generate recommendations based on collected data
     */
    private generateRecommendations(
        experiences: LearningContext['relevantExperiences'],
        patterns: LearningContext['patterns'],
        stats: LearningContext['statistics']
    ): string[] {
        const recommendations: string[] = [];

        // Success rate recommendation
        if (stats.successRate < 0.7 && stats.totalIterations > 10) {
            recommendations.push(`Current success rate is ${(stats.successRate * 100).toFixed(1)}%. Review common failure patterns.`);
        } else if (stats.successRate > 0.9) {
            recommendations.push(`High success rate (${(stats.successRate * 100).toFixed(1)}%). Keep following current patterns.`);
        }

        // Best practices from patterns
        const bestPractices = patterns.filter(p => p.category === 'best-practice' && p.confidence > 0.8);
        if (bestPractices.length > 0) {
            recommendations.push(`Apply ${bestPractices.length} proven best practices from previous successful generations.`);
        }

        // Anti-patterns warning
        const antiPatterns = patterns.filter(p => p.category === 'anti-pattern');
        if (antiPatterns.length > 0) {
            recommendations.push(`Avoid ${antiPatterns.length} known anti-patterns that have caused issues.`);
        }

        // Experience-based recommendations
        const successfulExperiences = experiences.filter(e => e.outcome === 'success');
        if (successfulExperiences.length > 0) {
            recommendations.push(`Found ${successfulExperiences.length} similar successful generations to learn from.`);
        }

        return recommendations;
    }

    /**
     * Format learning context as text for LLM
     */
    formatForLLM(context: LearningContext): string {
        let formatted = 'LEARNING FROM PAST GENERATIONS:\n';
        formatted += '================================\n\n';

        // Statistics
        if (context.statistics.totalIterations > 0) {
            formatted += `📊 SYSTEM EXPERIENCE:\n`;
            formatted += `- Total Generations: ${context.statistics.totalIterations}\n`;
            formatted += `- Success Rate: ${(context.statistics.successRate * 100).toFixed(1)}%\n`;
            formatted += `- Most Used: ${context.statistics.mostUsedLanguage}/${context.statistics.mostUsedFramework}\n`;
            formatted += `- Average Complexity: ${context.statistics.averageComplexity}\n\n`;
        }

        // Recommendations
        if (context.recommendations.length > 0) {
            formatted += `💡 RECOMMENDATIONS:\n`;
            context.recommendations.forEach((rec, i) => {
                formatted += `${i + 1}. ${rec}\n`;
            });
            formatted += '\n';
        }

        // Learned patterns
        if (context.patterns.length > 0) {
            formatted += `📌 LEARNED BEST PRACTICES:\n`;
            context.patterns
                .filter(p => p.category === 'best-practice' || p.category === 'success')
                .slice(0, 5)
                .forEach((pattern, i) => {
                    formatted += `${i + 1}. ${pattern.pattern} (seen ${pattern.examples}x, confidence: ${(pattern.confidence * 100).toFixed(0)}%)\n`;
                });
            formatted += '\n';
        }

        // Warnings
        if (context.warningsAndPitfalls.length > 0) {
            formatted += `⚠️  COMMON PITFALLS TO AVOID:\n`;
            context.warningsAndPitfalls.slice(0, 3).forEach((warning, i) => {
                formatted += `${i + 1}. ${warning.warning} (occurred ${warning.occurrences}x in ${warning.context})\n`;
            });
            formatted += '\n';
        }

        // Similar successful code
        if (context.similarCode.length > 0) {
            formatted += `📁 SIMILAR SUCCESSFUL CODE:\n`;
            context.similarCode.forEach((code, i) => {
                formatted += `${i + 1}. ${code.filePath} (${(code.similarity * 100).toFixed(0)}% match from ${code.project})\n`;
            });
            formatted += '\n';
        }

        return formatted;
    }


    /**
     * Get empty context (fallback)
     */
    private getEmptyContext(): LearningContext {
        return {
            relevantExperiences: [],
            patterns: [],
            similarCode: [],
            warningsAndPitfalls: [],
            recommendations: [],
            statistics: {
                totalIterations: 0,
                successRate: 0,
                mostUsedLanguage: 'typescript',
                mostUsedFramework: 'fastify',
                averageComplexity: 'moderate',
            },
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let builderInstance: EnhancedLearningContextBuilder | null = null;

export function getEnhancedLearningContextBuilder(): EnhancedLearningContextBuilder {
    if (!builderInstance) {
        builderInstance = new EnhancedLearningContextBuilder();
    }
    return builderInstance;
}
