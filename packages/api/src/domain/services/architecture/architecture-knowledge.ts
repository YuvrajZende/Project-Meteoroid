/**
 * Architecture Knowledge Service
 *
 * Stores and retrieves architecture blueprints/diagrams for cross-referencing.
 * When a similar request comes in, the system can look up past successful
 * architectures to improve generation quality.
 */

import { injectable } from 'inversify';
import { getSupabaseAdmin } from '../../../infrastructure/database/database-client.js';
import { getVectorStore } from '../learning/vector-store.js';
import type { ArchitectureBlueprint } from './architecture-blueprint.js';

// ============================================
// TYPES
// ============================================

export interface StoredArchitecture {
    id: string;
    projectId: string;
    prompt: string;
    language: string;
    framework: string;
    features: string[];
    blueprint: ArchitectureBlueprint;
    asciiDiagram: string;
    qualityScore?: number;
    generatedFiles: string[];
    success: boolean;
    createdAt: Date;
}

export interface ArchitectureMatch {
    architecture: StoredArchitecture;
    similarity: number;
    relevantParts: string[];
}

// ============================================
// ARCHITECTURE KNOWLEDGE SERVICE
// ============================================

@injectable()
export class ArchitectureKnowledgeService {
    private initialized: boolean = false;
    private vectorStore = getVectorStore();

    async initialize(): Promise<void> {
        if (this.initialized) return;
        await this.vectorStore.initialize();
        console.log('[ARCH-KNOWLEDGE] Architecture Knowledge Service initialized');
        this.initialized = true;
    }

    /**
     * Store a successful architecture for future reference
     */
    async storeArchitecture(
        projectId: string,
        prompt: string,
        language: string,
        framework: string,
        features: string[],
        blueprint: ArchitectureBlueprint,
        generatedFiles: string[],
        qualityScore?: number
    ): Promise<string | null> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return null;

        try {
            // Create a summary for embedding
            const summary = this.createArchitectureSummary(prompt, language, framework, features, blueprint);

            // Generate embedding for the architecture
            const embedding = await this.vectorStore.generateEmbedding(summary);

            const { data, error } = await supabase
                .from('architecture_knowledge')
                .insert({
                    project_id: projectId,
                    prompt: prompt.slice(0, 2000),
                    language,
                    framework,
                    features,
                    blueprint: JSON.stringify(blueprint),
                    ascii_diagram: blueprint.asciiDiagram || '',
                    quality_score: qualityScore,
                    generated_files: generatedFiles,
                    success: true,
                    embedding,
                })
                .select('id')
                .single();

            if (error) {
                console.error('[ARCH-KNOWLEDGE] Failed to store architecture:', error);
                return null;
            }

            console.log(`[ARCH-KNOWLEDGE] Stored architecture for ${projectId}`);
            return data?.id || null;
        } catch (error) {
            console.error('[ARCH-KNOWLEDGE] Error storing architecture:', error);
            return null;
        }
    }

    /**
     * Find similar architectures for a given prompt
     */
    async findSimilarArchitectures(
        prompt: string,
        language?: string,
        framework?: string,
        limit: number = 3
    ): Promise<ArchitectureMatch[]> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        try {
            // Generate embedding for the prompt
            const embedding = await this.vectorStore.generateEmbedding(prompt);

            // Search for similar architectures
            const { data, error } = await supabase.rpc('match_architecture_knowledge', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: limit,
                p_language: language || null,
                p_framework: framework || null,
            });

            if (error) {
                console.warn('[ARCH-KNOWLEDGE] RPC not available, using fallback');
                return await this.fallbackSearch(prompt, language, framework, limit);
            }

            return (data || []).map((row: Record<string, unknown>) => ({
                architecture: {
                    id: row.id as string,
                    projectId: row.project_id as string,
                    prompt: row.prompt as string,
                    language: row.language as string,
                    framework: row.framework as string,
                    features: (row.features as string[]) || [],
                    blueprint: JSON.parse(row.blueprint as string || '{}'),
                    asciiDiagram: row.ascii_diagram as string || '',
                    qualityScore: row.quality_score as number | undefined,
                    generatedFiles: (row.generated_files as string[]) || [],
                    success: row.success as boolean,
                    createdAt: new Date(row.created_at as string),
                },
                similarity: row.similarity as number,
                relevantParts: this.extractRelevantParts(prompt, row),
            }));
        } catch (error) {
            console.error('[ARCH-KNOWLEDGE] Error finding similar architectures:', error);
            return [];
        }
    }

    /**
     * Get architecture context for a new generation
     */
    async getArchitectureContext(
        prompt: string,
        language: string,
        framework: string
    ): Promise<string> {
        const matches = await this.findSimilarArchitectures(prompt, language, framework, 2);

        if (matches.length === 0) {
            return '';
        }

        let context = '\n\nPAST SUCCESSFUL ARCHITECTURES (use as reference):\n';
        context += '================================================\n';

        for (const match of matches) {
            const arch = match.architecture;
            context += `\n📐 Similar Project (${(match.similarity * 100).toFixed(0)}% match):\n`;
            context += `   Language: ${arch.language}, Framework: ${arch.framework}\n`;
            context += `   Features: ${arch.features.join(', ')}\n`;
            context += `   Files Generated: ${arch.generatedFiles.length}\n`;

            if (arch.asciiDiagram) {
                context += `\n   Architecture:\n${arch.asciiDiagram.split('\n').map(l => '   ' + l).join('\n')}\n`;
            }

            // Include route structure
            if (arch.blueprint.routes && arch.blueprint.routes.length > 0) {
                context += `\n   Routes:\n`;
                for (const route of arch.blueprint.routes.slice(0, 5)) {
                    context += `   - ${route.method} ${route.path}: ${route.description}\n`;
                }
            }

            // Include database tables
            if (arch.blueprint.database?.tables && arch.blueprint.database.tables.length > 0) {
                context += `\n   Database Tables:\n`;
                for (const table of arch.blueprint.database.tables.slice(0, 3)) {
                    context += `   - ${table.name}: ${table.columns.map(c => c.name).join(', ')}\n`;
                }
            }
        }

        context += '\n================================================\n';
        context += 'Use the above as reference for similar structure and patterns.\n';

        return context;
    }

    /**
     * Create a summary string for embedding
     */
    private createArchitectureSummary(
        prompt: string,
        language: string,
        framework: string,
        features: string[],
        blueprint: ArchitectureBlueprint
    ): string {
        const parts = [
            prompt,
            `Language: ${language}`,
            `Framework: ${framework}`,
            `Features: ${features.join(', ')}`,
            `Routes: ${blueprint.routes.map(r => `${r.method} ${r.path}`).join(', ')}`,
            `Tables: ${blueprint.database.tables.map(t => t.name).join(', ')}`,
            `Services: ${blueprint.services.map(s => s.name).join(', ')}`,
        ];

        return parts.join('\n');
    }

    /**
     * Extract relevant parts from a matched architecture
     */
    private extractRelevantParts(prompt: string, row: Record<string, unknown>): string[] {
        const parts: string[] = [];
        const promptLower = prompt.toLowerCase();

        // Check for matching features
        const features = (row.features as string[]) || [];
        for (const feature of features) {
            if (promptLower.includes(feature.toLowerCase())) {
                parts.push(`Feature: ${feature}`);
            }
        }

        // Check for matching keywords
        const keywords = ['auth', 'database', 'api', 'crud', 'user', 'jwt', 'rest'];
        for (const keyword of keywords) {
            if (promptLower.includes(keyword) && (row.prompt as string).toLowerCase().includes(keyword)) {
                parts.push(`Keyword: ${keyword}`);
            }
        }

        return parts;
    }

    /**
     * Fallback search when RPC is not available
     */
    private async fallbackSearch(
        prompt: string,
        language?: string,
        framework?: string,
        limit: number = 3
    ): Promise<ArchitectureMatch[]> {
        const supabase = getSupabaseAdmin();
        if (!supabase) return [];

        try {
            let query = supabase
                .from('architecture_knowledge')
                .select('*')
                .eq('success', true)
                .order('quality_score', { ascending: false })
                .limit(limit);

            if (language) {
                query = query.eq('language', language);
            }

            if (framework) {
                query = query.eq('framework', framework);
            }

            const { data, error } = await query;

            if (error || !data) return [];

            return data.map((row: Record<string, unknown>) => ({
                architecture: {
                    id: row.id as string,
                    projectId: row.project_id as string,
                    prompt: row.prompt as string,
                    language: row.language as string,
                    framework: row.framework as string,
                    features: (row.features as string[]) || [],
                    blueprint: JSON.parse(row.blueprint as string || '{}'),
                    asciiDiagram: row.ascii_diagram as string || '',
                    qualityScore: row.quality_score as number | undefined,
                    generatedFiles: (row.generated_files as string[]) || [],
                    success: row.success as boolean,
                    createdAt: new Date(row.created_at as string),
                },
                similarity: 0.5, // Default for fallback
                relevantParts: this.extractRelevantParts(prompt, row),
            }));
        } catch {
            return [];
        }
    }
}

// ============================================
// SINGLETON
// ============================================

let architectureKnowledgeInstance: ArchitectureKnowledgeService | null = null;

export function getArchitectureKnowledge(): ArchitectureKnowledgeService {
    if (!architectureKnowledgeInstance) {
        architectureKnowledgeInstance = new ArchitectureKnowledgeService();
    }
    return architectureKnowledgeInstance;
}
