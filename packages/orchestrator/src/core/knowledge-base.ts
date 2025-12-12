/**
 * ============================================
 * KNOWLEDGE BASE - SEMANTIC MEMORY SYSTEM
 * ============================================
 * 
 * Implements a RAG (Retrieval-Augmented Generation) system for:
 * - Storing code artifacts, decisions, and agent outputs
 * - Semantic search across all stored knowledge
 * - Relevance filtering for agent context
 * 
 * This allows agents to "remember" specific details from
 * much earlier in the execution, not just recent messages.
 */

import { ChatOpenAI } from "@langchain/openai";
import * as crypto from "crypto";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface KnowledgeEntry {
    id: string;
    type: KnowledgeType;
    content: string;
    embedding?: number[];
    metadata: KnowledgeMetadata;
    createdAt: Date;
    accessCount: number;
    lastAccessedAt: Date | null;
}

export interface KnowledgeMetadata {
    source: string;           // Which agent or system created this
    taskId?: string;          // Associated task
    tags: string[];           // Searchable tags
    codeLanguage?: string;    // For code snippets
    importance: number;       // 1-10 importance score
    relatedEntries?: string[]; // Links to related entries
}

export type KnowledgeType =
    | "code"              // Generated code snippets
    | "schema"            // Database schemas
    | "config"            // Configuration files
    | "decision"          // Architectural decisions
    | "requirement"       // User requirements
    | "artifact"          // Generated artifacts
    | "error"             // Error logs for learning
    | "correction"        // Corrections applied
    | "summary";          // Conversation summaries

export interface SearchResult {
    entry: KnowledgeEntry;
    relevanceScore: number;
    matchedKeywords: string[];
}

export interface KnowledgeQuery {
    query: string;
    types?: KnowledgeType[];
    sources?: string[];
    minImportance?: number;
    limit?: number;
    tags?: string[];
}

// ============================================
// KNOWLEDGE BASE CLASS
// ============================================

export class KnowledgeBase {
    private entries: Map<string, KnowledgeEntry> = new Map();
    private tagIndex: Map<string, Set<string>> = new Map(); // tag -> entry IDs
    private typeIndex: Map<KnowledgeType, Set<string>> = new Map(); // type -> entry IDs
    private sourceIndex: Map<string, Set<string>> = new Map(); // source -> entry IDs
    private model: ChatOpenAI | null = null;

    constructor() {
        // Initialize type indexes
        const types: KnowledgeType[] = [
            "code", "schema", "config", "decision",
            "requirement", "artifact", "error", "correction", "summary"
        ];
        types.forEach(t => this.typeIndex.set(t, new Set()));
    }

    // ============================================
    // STORAGE OPERATIONS
    // ============================================

    /**
     * Store a new knowledge entry
     */
    store(
        type: KnowledgeType,
        content: string,
        metadata: Partial<KnowledgeMetadata>
    ): string {
        const id = this.generateId(type, content);

        // Check for duplicates
        if (this.entries.has(id)) {
            console.log(`📚 [Knowledge] Entry already exists: ${id.substring(0, 20)}...`);
            return id;
        }

        const entry: KnowledgeEntry = {
            id,
            type,
            content,
            metadata: {
                source: metadata.source || "unknown",
                tags: metadata.tags || this.extractTags(content, type),
                importance: metadata.importance || this.calculateImportance(type, content),
                taskId: metadata.taskId,
                codeLanguage: metadata.codeLanguage || this.detectLanguage(content),
                relatedEntries: metadata.relatedEntries || []
            },
            createdAt: new Date(),
            accessCount: 0,
            lastAccessedAt: null
        };

        // Store entry
        this.entries.set(id, entry);

        // Update indexes
        this.typeIndex.get(type)?.add(id);

        if (!this.sourceIndex.has(entry.metadata.source)) {
            this.sourceIndex.set(entry.metadata.source, new Set());
        }
        this.sourceIndex.get(entry.metadata.source)?.add(id);

        for (const tag of entry.metadata.tags) {
            if (!this.tagIndex.has(tag)) {
                this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag)?.add(id);
        }

        console.log(`📚 [Knowledge] Stored ${type}: ${id.substring(0, 20)}... (${entry.metadata.tags.length} tags)`);

        return id;
    }

    /**
     * Store code artifact with automatic parsing
     */
    storeCode(
        code: string,
        source: string,
        language?: string,
        taskId?: string
    ): string {
        return this.store("code", code, {
            source,
            codeLanguage: language || this.detectLanguage(code),
            taskId,
            importance: 8 // Code is generally important
        });
    }

    /**
     * Store a decision with reasoning
     */
    storeDecision(
        decision: string,
        reasoning: string,
        source: string
    ): string {
        const content = `DECISION: ${decision}\nREASONING: ${reasoning}`;
        return this.store("decision", content, {
            source,
            importance: 9, // Decisions are very important
            tags: ["decision", "architecture"]
        });
    }

    /**
     * Store an error for learning
     */
    storeError(
        error: string,
        context: string,
        source: string
    ): string {
        const content = `ERROR: ${error}\nCONTEXT: ${context}`;
        return this.store("error", content, {
            source,
            importance: 7,
            tags: ["error", "debug"]
        });
    }

    // ============================================
    // SEARCH OPERATIONS
    // ============================================

    /**
     * Search knowledge base with a query
     */
    search(query: KnowledgeQuery): SearchResult[] {
        const results: SearchResult[] = [];
        const queryTerms = this.tokenize(query.query.toLowerCase());

        // Get candidate entries based on filters
        let candidateIds = new Set<string>(this.entries.keys());

        // Filter by type
        if (query.types && query.types.length > 0) {
            const typeMatches = new Set<string>();
            for (const type of query.types) {
                const typeIds = this.typeIndex.get(type);
                if (typeIds) {
                    typeIds.forEach(id => typeMatches.add(id));
                }
            }
            candidateIds = this.intersect(candidateIds, typeMatches);
        }

        // Filter by source
        if (query.sources && query.sources.length > 0) {
            const sourceMatches = new Set<string>();
            for (const source of query.sources) {
                const sourceIds = this.sourceIndex.get(source);
                if (sourceIds) {
                    sourceIds.forEach(id => sourceMatches.add(id));
                }
            }
            candidateIds = this.intersect(candidateIds, sourceMatches);
        }

        // Filter by tags
        if (query.tags && query.tags.length > 0) {
            for (const tag of query.tags) {
                const tagIds = this.tagIndex.get(tag);
                if (tagIds) {
                    candidateIds = this.intersect(candidateIds, tagIds);
                }
            }
        }

        // Score and filter candidates
        for (const id of candidateIds) {
            const entry = this.entries.get(id);
            if (!entry) continue;

            // Filter by importance
            if (query.minImportance && entry.metadata.importance < query.minImportance) {
                continue;
            }

            // Calculate relevance score
            const { score, matchedKeywords } = this.calculateRelevance(entry, queryTerms);

            if (score > 0) {
                results.push({
                    entry,
                    relevanceScore: score,
                    matchedKeywords
                });

                // Update access tracking
                entry.accessCount++;
                entry.lastAccessedAt = new Date();
            }
        }

        // Sort by relevance and limit
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        const limit = query.limit || 10;
        return results.slice(0, limit);
    }

    /**
     * Find knowledge relevant to an agent's current task
     */
    findRelevantForAgent(
        agentId: string,
        currentTask: string,
        limit: number = 5
    ): KnowledgeEntry[] {
        // Search for task-related knowledge
        const taskResults = this.search({
            query: currentTask,
            limit: limit * 2
        });

        // Also get recent entries from this agent
        const agentEntries = Array.from(this.sourceIndex.get(agentId) || [])
            .map(id => this.entries.get(id))
            .filter(Boolean) as KnowledgeEntry[];

        // Combine and deduplicate
        const combined = new Map<string, KnowledgeEntry>();

        taskResults.forEach(r => combined.set(r.entry.id, r.entry));
        agentEntries.slice(-3).forEach(e => combined.set(e.id, e));

        return Array.from(combined.values()).slice(0, limit);
    }

    /**
     * Get all code for a specific language
     */
    getCodeByLanguage(language: string): KnowledgeEntry[] {
        const codeIds = this.typeIndex.get("code") || new Set();
        return Array.from(codeIds)
            .map(id => this.entries.get(id))
            .filter(e => e && e.metadata.codeLanguage === language) as KnowledgeEntry[];
    }

    /**
     * Get recent decisions
     */
    getRecentDecisions(limit: number = 5): KnowledgeEntry[] {
        const decisionIds = this.typeIndex.get("decision") || new Set();
        return Array.from(decisionIds)
            .map(id => this.entries.get(id))
            .filter(Boolean)
            .sort((a, b) => (b as KnowledgeEntry).createdAt.getTime() - (a as KnowledgeEntry).createdAt.getTime())
            .slice(0, limit) as KnowledgeEntry[];
    }

    // ============================================
    // RELATIONSHIP OPERATIONS
    // ============================================

    /**
     * Link two related entries
     */
    linkEntries(id1: string, id2: string): void {
        const entry1 = this.entries.get(id1);
        const entry2 = this.entries.get(id2);

        if (entry1 && entry2) {
            if (!entry1.metadata.relatedEntries?.includes(id2)) {
                entry1.metadata.relatedEntries = [...(entry1.metadata.relatedEntries || []), id2];
            }
            if (!entry2.metadata.relatedEntries?.includes(id1)) {
                entry2.metadata.relatedEntries = [...(entry2.metadata.relatedEntries || []), id1];
            }
        }
    }

    /**
     * Get related entries
     */
    getRelated(id: string): KnowledgeEntry[] {
        const entry = this.entries.get(id);
        if (!entry || !entry.metadata.relatedEntries) return [];

        return entry.metadata.relatedEntries
            .map(relId => this.entries.get(relId))
            .filter(Boolean) as KnowledgeEntry[];
    }

    // ============================================
    // STATS AND MANAGEMENT
    // ============================================

    /**
     * Get knowledge base statistics
     */
    getStats(): {
        totalEntries: number;
        byType: Record<string, number>;
        bySource: Record<string, number>;
        topTags: [string, number][];
    } {
        const byType: Record<string, number> = {};
        const bySource: Record<string, number> = {};

        for (const [type, ids] of this.typeIndex) {
            byType[type] = ids.size;
        }

        for (const [source, ids] of this.sourceIndex) {
            bySource[source] = ids.size;
        }

        const topTags = Array.from(this.tagIndex.entries())
            .map(([tag, ids]) => [tag, ids.size] as [string, number])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            totalEntries: this.entries.size,
            byType,
            bySource,
            topTags
        };
    }

    /**
     * Export all knowledge for persistence
     */
    export(): KnowledgeEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * Import knowledge from persistence
     */
    import(entries: KnowledgeEntry[]): void {
        for (const entry of entries) {
            this.entries.set(entry.id, entry);

            // Rebuild indexes
            this.typeIndex.get(entry.type)?.add(entry.id);

            if (!this.sourceIndex.has(entry.metadata.source)) {
                this.sourceIndex.set(entry.metadata.source, new Set());
            }
            this.sourceIndex.get(entry.metadata.source)?.add(entry.id);

            for (const tag of entry.metadata.tags) {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                this.tagIndex.get(tag)?.add(entry.id);
            }
        }

        console.log(`📚 [Knowledge] Imported ${entries.length} entries`);
    }

    /**
     * Clear all knowledge
     */
    clear(): void {
        this.entries.clear();
        this.tagIndex.clear();
        this.typeIndex.forEach(set => set.clear());
        this.sourceIndex.clear();
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private generateId(type: KnowledgeType, content: string): string {
        const hash = crypto.createHash("md5")
            .update(content.substring(0, 500))
            .digest("hex")
            .substring(0, 12);
        return `${type}_${hash}`;
    }

    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(t => t.length > 2);
    }

    private extractTags(content: string, type: KnowledgeType): string[] {
        const tags: string[] = [type];
        const lower = content.toLowerCase();

        // Technology tags
        const techPatterns: [RegExp, string][] = [
            [/typescript|\.ts\b/i, "typescript"],
            [/javascript|\.js\b/i, "javascript"],
            [/prisma/i, "prisma"],
            [/drizzle/i, "drizzle"],
            [/postgres|postgresql/i, "postgresql"],
            [/mongodb/i, "mongodb"],
            [/redis/i, "redis"],
            [/express/i, "express"],
            [/fastify/i, "fastify"],
            [/jwt|jsonwebtoken/i, "jwt"],
            [/clerk/i, "clerk"],
            [/oauth/i, "oauth"],
            [/docker/i, "docker"],
            [/kubernetes|k8s/i, "kubernetes"],
            [/github.actions/i, "github-actions"],
            [/api|endpoint/i, "api"],
            [/auth|authentication/i, "auth"],
            [/database|schema/i, "database"],
            [/test|jest|vitest/i, "testing"],
            [/security|vulnerability/i, "security"],
        ];

        for (const [pattern, tag] of techPatterns) {
            if (pattern.test(lower)) {
                tags.push(tag);
            }
        }

        return [...new Set(tags)];
    }

    private detectLanguage(content: string): string {
        if (content.includes("interface ") || content.includes(": string")) return "typescript";
        if (content.includes("function ") || content.includes("const ")) return "javascript";
        if (content.includes("model ") && content.includes("@@")) return "prisma";
        if (content.includes("CREATE TABLE")) return "sql";
        if (content.includes("apiVersion:")) return "yaml";
        if (content.includes("FROM ") && content.includes("RUN ")) return "dockerfile";
        return "text";
    }

    private calculateImportance(type: KnowledgeType, content: string): number {
        let score = 5; // Base score

        // Type-based scoring
        const typeScores: Record<KnowledgeType, number> = {
            decision: 9,
            schema: 8,
            code: 7,
            config: 7,
            requirement: 8,
            artifact: 6,
            error: 5,
            correction: 6,
            summary: 4
        };
        score = typeScores[type] || score;

        // Content-based adjustments
        if (content.length > 1000) score += 1; // Substantial content
        if (content.includes("export ")) score += 1; // Exports are important
        if (content.includes("TODO") || content.includes("FIXME")) score -= 1;

        return Math.min(10, Math.max(1, score));
    }

    private calculateRelevance(
        entry: KnowledgeEntry,
        queryTerms: string[]
    ): { score: number; matchedKeywords: string[] } {
        let score = 0;
        const matchedKeywords: string[] = [];
        const contentLower = entry.content.toLowerCase();
        const tagsLower = entry.metadata.tags.map(t => t.toLowerCase());

        for (const term of queryTerms) {
            // Content match
            if (contentLower.includes(term)) {
                score += 1;
                matchedKeywords.push(term);
            }

            // Tag match (higher weight)
            if (tagsLower.includes(term)) {
                score += 3;
                if (!matchedKeywords.includes(term)) {
                    matchedKeywords.push(term);
                }
            }
        }

        // Importance boost
        score *= (entry.metadata.importance / 5);

        // Recency boost (entries from last hour get 20% boost)
        const hourAgo = Date.now() - 3600000;
        if (entry.createdAt.getTime() > hourAgo) {
            score *= 1.2;
        }

        return { score, matchedKeywords };
    }

    private intersect(set1: Set<string>, set2: Set<string>): Set<string> {
        return new Set([...set1].filter(x => set2.has(x)));
    }
}

// Export singleton instance
export const knowledgeBase = new KnowledgeBase();
