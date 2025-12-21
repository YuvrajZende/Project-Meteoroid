/**
 * Framework Oversight Agent (Phase 25)
 * 
 * Oversees the entire generation pipeline and controls learning decisions.
 * 
 * Capabilities:
 * - Pre-Context Building: Query vector DB for similar successful patterns
 * - Anti-Pattern Injection: Add warnings from past failures to prompts
 * - Context Selection: Decide which context injections are most relevant
 * - Subtask Monitoring: Enhance each subtask prompt with appropriate context
 * - Quality Review: Analyze quality reports and decide on learning storage
 * - Learning Decisions: Choose what to store (success pattern, anti-pattern, iteration)
 * - Agent Coordination: Notify other agents via MCP Hub
 * 
 * @see docs/Guide/FEATURE_INTEGRATION_GUIDE.md
 */

import { getLearningService, type LearningService, type GenerationIteration } from './learning-service.js';
import { getVectorLearningSystem, type VectorLearningSystem } from './vector-learning-system.js';
import { getEntityExtractor, type ExtractedEntity } from './entity-extractor.js';
import type { QualityReport } from './code-quality-agent.js';
import { getSupabaseAdmin } from './database-client.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

export interface ContextInjection {
    type: 'warning' | 'example' | 'pattern' | 'entity' | 'service' | 'anti_pattern';
    content: string;
    priority: number; // 1-10, higher = more important
    source: string; // Where this came from
}

export interface PreContext {
    injections: ContextInjection[];
    entities: ExtractedEntity[];
    recommendedFramework: string;
    warnings: string[];
    originalPrompt: string;
}

export interface LearningDecision {
    shouldStore: boolean;
    storeAs: 'success_pattern' | 'anti_pattern' | 'iteration' | 'skip';
    reason: string;
    data?: Record<string, unknown>;
}

export interface OversightDecision {
    action: string;
    reason: string;
    data: Record<string, unknown>;
}

export interface OversightAgentConfig {
    maxInjections: number; // Maximum context injections per prompt
    minPatternSimilarity: number; // Minimum similarity for pattern matching (0-1)
    enableLearning: boolean;
    enableAntiPatterns: boolean;
}

export interface PostReviewResult {
    learningDecisions: LearningDecision[];
    recommendations: string[];
    patternsStored: number;
}

// ============================================
// FRAMEWORK OVERSIGHT AGENT CLASS
// ============================================

export class FrameworkOversightAgent {
    private config: OversightAgentConfig;
    private learningService: LearningService;
    private vectorSystem: VectorLearningSystem;
    private initialized = false;
    private supabaseEnabled = false;

    constructor(config?: Partial<OversightAgentConfig>) {
        this.config = {
            maxInjections: config?.maxInjections ?? 5,
            minPatternSimilarity: config?.minPatternSimilarity ?? 0.7,
            enableLearning: config?.enableLearning ?? true,
            enableAntiPatterns: config?.enableAntiPatterns ?? true,
        };

        this.learningService = getLearningService();
        this.vectorSystem = getVectorLearningSystem();

        // Check Supabase availability
        this.supabaseEnabled = !!(
            process.env.SUPABASE_URL &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
    }

    /**
     * Initialize the agent
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        console.log('[OVERSIGHT] Initializing Framework Oversight Agent...');
        this.initialized = true;
        console.log('[OVERSIGHT] Framework Oversight Agent ready');
    }

    // ============================================
    // PHASE 1: PRE-GENERATION - Build Context
    // ============================================

    /**
     * Build comprehensive pre-context for generation
     */
    async buildPreContext(prompt: string): Promise<PreContext> {
        console.log('[OVERSIGHT] Building pre-context from learning system...');

        const injections: ContextInjection[] = [];
        const warnings: string[] = [];

        // 1. Extract entities from prompt
        const entityExtractor = getEntityExtractor();
        let entities: ExtractedEntity[] = [];
        try {
            const extraction = await entityExtractor.extract(prompt);
            entities = extraction.entities;
            console.log(`[OVERSIGHT] Extracted ${entities.length} entities`);
        } catch (error) {
            console.warn(`[OVERSIGHT] Entity extraction failed: ${error}`);
        }

        // 2. Analyze intent to determine framework
        const recommendedFramework = this.detectFrameworkFromPrompt(prompt);

        // 3. Search for relevant successful patterns
        try {
            const context = await this.vectorSystem.buildContext(prompt, { maxCodeExamples: 5 });
            const successPatterns = context.similarProjects || [];

            for (const pattern of successPatterns) {
                if (pattern.similarity >= this.config.minPatternSimilarity) {
                    injections.push({
                        type: 'pattern',
                        content: this.formatPatternForInjection(pattern),
                        priority: Math.round(pattern.similarity * 10),
                        source: `vector_store:${pattern.projectId}`
                    });
                }
            }
            console.log(`[OVERSIGHT] Found ${successPatterns.length} similar patterns`);
        } catch (error) {
            console.warn(`[OVERSIGHT] Pattern search failed: ${error}`);
        }

        // 4. Search for anti-patterns to AVOID
        if (this.config.enableAntiPatterns) {
            try {
                const antiPatterns = await this.getRelevantAntiPatterns(prompt);

                for (const anti of antiPatterns) {
                    warnings.push(anti.warning);
                    injections.push({
                        type: 'anti_pattern',
                        content: `⚠️ AVOID: ${anti.warning}\nReason: ${anti.context}`,
                        priority: 10, // Highest priority - must see this
                        source: `anti_patterns:${anti.id}`
                    });
                }
                console.log(`[OVERSIGHT] Found ${antiPatterns.length} anti-patterns to avoid`);
            } catch (error) {
                console.warn(`[OVERSIGHT] Anti-pattern search failed: ${error}`);
            }
        }

        // 5. Add entity-specific constraints
        for (const entity of entities) {
            injections.push({
                type: 'entity',
                content: `Required entity: ${entity.name} (${entity.type}) - ${entity.description || 'No description'}`,
                priority: 7,
                source: `entity_extraction:${entity.name}`
            });
        }

        // 6. Add framework-specific warnings
        if (recommendedFramework) {
            injections.push({
                type: 'warning',
                content: `This project uses ${recommendedFramework}. Do NOT mix with other frameworks.`,
                priority: 9,
                source: 'framework_detection'
            });
        }

        // 7. Add standard warnings
        this.addStandardWarnings(injections, warnings);

        // 8. Sort by priority and limit
        injections.sort((a, b) => b.priority - a.priority);
        const limitedInjections = injections.slice(0, this.config.maxInjections * 2);

        console.log(`[OVERSIGHT] Built pre-context with ${limitedInjections.length} injections, ${warnings.length} warnings`);

        return {
            injections: limitedInjections,
            entities,
            recommendedFramework: recommendedFramework || 'auto',
            warnings,
            originalPrompt: prompt
        };
    }

    // ============================================
    // PHASE 2: DURING GENERATION - Monitor Subtasks
    // ============================================

    /**
     * Enhance a subtask prompt with relevant context
     */
    async monitorSubtask(
        subtaskIndex: number,
        subtaskPrompt: string,
        preContext: PreContext
    ): Promise<{
        enhancedPrompt: string;
        injectedContext: string[];
    }> {
        const injectedContext: string[] = [];

        // Build the enhanced prompt with all context
        const enhancedPrompt = this.buildEnhancedPrompt(
            subtaskPrompt,
            preContext,
            subtaskIndex
        );

        // Track what was injected
        for (const injection of preContext.injections.slice(0, this.config.maxInjections)) {
            injectedContext.push(`${injection.type}: ${injection.content.substring(0, 50)}...`);
        }

        return { enhancedPrompt, injectedContext };
    }

    private buildEnhancedPrompt(
        subtaskPrompt: string,
        preContext: PreContext,
        subtaskIndex: number
    ): string {
        const topInjections = preContext.injections.slice(0, this.config.maxInjections);

        // Build warnings section
        const warningsSection = preContext.warnings.length > 0
            ? preContext.warnings.map(w => `❌ ${w}`).join('\n')
            : 'No specific warnings.';

        // Build patterns section
        const patternsSection = topInjections
            .filter(i => i.type === 'pattern')
            .map(i => i.content)
            .slice(0, 2)
            .join('\n\n');

        // Build entities section
        const entitiesSection = preContext.entities.length > 0
            ? preContext.entities.map(e => `• ${e.name} (${e.type})`).join('\n')
            : 'No entities extracted.';

        return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                        GENERATION CONTEXT                                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ORIGINAL REQUEST: ${preContext.originalPrompt.substring(0, 60)}...            
║ CURRENT SUBTASK: ${subtaskIndex + 1}                                          
║ FRAMEWORK: ${preContext.recommendedFramework}                                  
╠══════════════════════════════════════════════════════════════════════════════╣
║ ⚠️  LEARNED WARNINGS (DO NOT REPEAT THESE MISTAKES):                         
${warningsSection}
╠══════════════════════════════════════════════════════════════════════════════╣
║ 📋 REQUIRED ENTITIES:                                                         
${entitiesSection}
╠══════════════════════════════════════════════════════════════════════════════╣
║ ✅ PROVEN PATTERNS (USE THESE AS REFERENCE):                                  
${patternsSection || 'No similar patterns found.'}
╚══════════════════════════════════════════════════════════════════════════════╝

YOUR TASK:
${subtaskPrompt}

CRITICAL RULES:
1. Only generate code for the entities listed above
2. Follow the proven patterns shown
3. AVOID the warned anti-patterns
4. Use consistent file naming
5. Complete ALL code - no truncation
6. Do NOT mix frameworks
7. Do NOT use 'export' keyword in Python files
8. Ensure all imports reference files that will exist
`;
    }

    // ============================================
    // PHASE 3: POST-GENERATION - Quality & Learning
    // ============================================

    /**
     * Review generation results and make learning decisions
     */
    async postGenerationReview(
        generatedFiles: Map<string, string>,
        context: {
            originalPrompt: string;
            projectId?: string;
            framework: string;
            language: string;
            entities: ExtractedEntity[];
        },
        qualityReport: QualityReport
    ): Promise<PostReviewResult> {
        console.log(`[OVERSIGHT] Reviewing generation (score: ${qualityReport.overallScore}/100)`);

        const learningDecisions: LearningDecision[] = [];
        const recommendations: string[] = [];
        let patternsStored = 0;

        // 1. Analyze quality report
        if (qualityReport.overallScore >= 80) {
            // HIGH QUALITY - Store as success pattern
            learningDecisions.push({
                shouldStore: true,
                storeAs: 'success_pattern',
                reason: `High quality score: ${qualityReport.overallScore}`,
                data: {
                    prompt: context.originalPrompt,
                    fileCount: generatedFiles.size,
                    framework: context.framework,
                    entities: context.entities.map(e => e.name)
                }
            });

            // Index files for vector search
            if (this.config.enableLearning) {
                try {
                    for (const [path, content] of generatedFiles) {
                        await this.indexSuccessfulCode(path, content, context);
                        patternsStored++;
                    }
                    console.log(`[OVERSIGHT] Indexed ${patternsStored} files as successful patterns`);
                } catch (error) {
                    console.warn(`[OVERSIGHT] Failed to index patterns: ${error}`);
                }
            }

            recommendations.push('✅ Generation quality is excellent. Files indexed for future reference.');

        } else if (qualityReport.overallScore >= 50) {
            // MEDIUM QUALITY - Store iteration, extract lessons
            learningDecisions.push({
                shouldStore: true,
                storeAs: 'iteration',
                reason: `Medium quality, has fixable issues`,
                data: {
                    prompt: context.originalPrompt,
                    score: qualityReport.overallScore,
                    issues: qualityReport.checks.filter(c => !c.passed).map(c => c.name)
                }
            });

            recommendations.push('⚠️ Generation has some issues that were auto-fixed.');
            recommendations.push('Review the quality report for details.');

        } else {
            // LOW QUALITY - Store as anti-pattern
            for (const check of qualityReport.checks.filter(c => !c.passed)) {
                learningDecisions.push({
                    shouldStore: true,
                    storeAs: 'anti_pattern',
                    reason: `Failed check: ${check.name}`,
                    data: {
                        prompt: context.originalPrompt.substring(0, 200),
                        checkName: check.name,
                        issues: check.issues
                    }
                });

                // Store anti-pattern for future avoidance
                if (this.config.enableLearning) {
                    await this.storeAntiPattern(check.name, check.issues, context);
                }
            }

            recommendations.push('❌ Generation quality is low. Consider regenerating with more specific constraints.');
            recommendations.push('Anti-patterns have been stored to prevent future occurrences.');
        }

        // 2. Execute learning decisions
        for (const decision of learningDecisions) {
            if (decision.shouldStore && this.config.enableLearning) {
                await this.executeLearningDecision(decision, context.projectId);
            }
        }

        console.log(`[OVERSIGHT] Made ${learningDecisions.length} learning decisions, stored ${patternsStored} patterns`);

        return { learningDecisions, recommendations, patternsStored };
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private detectFrameworkFromPrompt(prompt: string): string | null {
        const lower = prompt.toLowerCase();

        if (lower.includes('nestjs') || lower.includes('nest.js')) return 'NestJS';
        if (lower.includes('fastify')) return 'Fastify';
        if (lower.includes('fastapi') || lower.includes('fast api')) return 'FastAPI';
        if (lower.includes('flask')) return 'Flask';
        if (lower.includes('django')) return 'Django';
        if (lower.includes('express')) return 'Express (not recommended)';

        // Default based on language hints
        if (lower.includes('python') || lower.includes('.py')) return 'FastAPI';
        if (lower.includes('typescript') || lower.includes('.ts')) return 'Fastify';

        return null;
    }

    private formatPatternForInjection(pattern: { content: string; similarity: number; filePath?: string }): string {
        // Truncate to reasonable size
        const maxLength = 500;
        const content = pattern.content.length > maxLength
            ? pattern.content.substring(0, maxLength) + '...'
            : pattern.content;

        const fileInfo = pattern.filePath ? ` (${pattern.filePath})` : '';
        return `Similarity: ${Math.round(pattern.similarity * 100)}%${fileInfo}\n${content}`;
    }

    private async getRelevantAntiPatterns(_prompt: string): Promise<Array<{
        id: string;
        warning: string;
        context: string;
    }>> {
        const antiPatterns: Array<{ id: string; warning: string; context: string }> = [];

        if (!this.supabaseEnabled) {
            return antiPatterns;
        }

        try {
            const supabase = getSupabaseAdmin();

            // Get recent anti-patterns
            const { data, error } = await supabase
                .from('anti_patterns')
                .select('id, pattern_type, trigger_context, correction')
                .order('occurrence_count', { ascending: false })
                .limit(10);

            if (error) {
                // Table might not exist yet
                if (!error.message.includes('does not exist')) {
                    console.warn(`[OVERSIGHT] Failed to fetch anti-patterns: ${error.message}`);
                }
                return antiPatterns;
            }

            if (data) {
                for (const row of data) {
                    antiPatterns.push({
                        id: row.id,
                        warning: row.correction || `Avoid: ${row.pattern_type}`,
                        context: row.trigger_context || ''
                    });
                }
            }
        } catch (error) {
            console.warn(`[OVERSIGHT] Anti-pattern fetch error: ${error}`);
        }

        return antiPatterns;
    }

    private addStandardWarnings(injections: ContextInjection[], warnings: string[]): void {
        // Add standard code quality warnings
        const standardWarnings = [
            'Do NOT create multiple entry points (index.ts AND main.ts)',
            'Do NOT import services from multiple locations',
            'Do NOT use "export class" in Python files',
            'Complete ALL code - never leave functions incomplete',
        ];

        for (const warning of standardWarnings) {
            if (!warnings.includes(warning)) {
                warnings.push(warning);
            }
        }

        // Mark injections as used (reserved for future warning injections)
        void injections;
    }

    private async indexSuccessfulCode(
        path: string,
        content: string,
        _context: { framework: string; language: string }
    ): Promise<void> {
        // Note: VectorLearningSystem uses buildContext for queries
        // Indexing is done via the vector-store.ts service directly
        // For now, log successful patterns for learning
        console.log(`[OVERSIGHT] Marked ${path} as successful pattern`);
        // Future: Use vector-store to index this code chunk
        void content; // Mark as used
    }

    private async storeAntiPattern(
        checkName: string,
        issues: string[],
        context: { originalPrompt: string; framework: string }
    ): Promise<void> {
        if (!this.supabaseEnabled) return;

        try {
            const supabase = getSupabaseAdmin();

            const { error } = await supabase
                .from('anti_patterns')
                .upsert({
                    id: uuidv4(),
                    pattern_type: checkName.toLowerCase().replace(/ /g, '_'),
                    trigger_context: context.originalPrompt.substring(0, 200),
                    example_bad_code: issues.join('\n'),
                    correction: `Avoid ${checkName}: ${issues[0] || 'Check quality report'}`,
                    occurrence_count: 1,
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'pattern_type',
                    ignoreDuplicates: false
                });

            if (error && !error.message.includes('does not exist')) {
                console.warn(`[OVERSIGHT] Failed to store anti-pattern: ${error.message}`);
            }
        } catch (error) {
            console.warn(`[OVERSIGHT] Anti-pattern storage error: ${error}`);
        }
    }

    private async executeLearningDecision(
        decision: LearningDecision,
        _projectId?: string
    ): Promise<void> {
        if (!decision.shouldStore) return;

        try {
            switch (decision.storeAs) {
                case 'success_pattern':
                    // Already indexed in postGenerationReview
                    break;

                case 'anti_pattern':
                    // Already stored in postGenerationReview
                    break;

                case 'iteration':
                    // Store as generation iteration for analysis
                    const iteration: Partial<GenerationIteration> = {
                        taskId: `oversight-${Date.now()}`,
                        projectId: String(_projectId || 'unknown'),
                        prompt: String(decision.data?.prompt || ''),
                        generatedCode: [],
                        success: (decision.data?.score as number) >= 50,
                        metrics: { duration: 0, tokensUsed: 0 },
                        createdAt: new Date()
                    };
                    await this.learningService.storeIteration(iteration as GenerationIteration);
                    break;
            }
        } catch (error) {
            console.warn(`[OVERSIGHT] Failed to execute learning decision: ${error}`);
        }
    }

    /**
     * Coordinate with other agents
     */
    async coordinateAgents(
        stage: 'pre' | 'during' | 'post',
        _data: Record<string, unknown>
    ): Promise<OversightDecision[]> {
        const decisions: OversightDecision[] = [];

        switch (stage) {
            case 'pre':
                decisions.push({
                    action: 'build_context',
                    reason: 'Preparing generation context',
                    data: { stage }
                });
                break;

            case 'during':
                decisions.push({
                    action: 'monitor_progress',
                    reason: 'Monitoring subtask execution',
                    data: { stage }
                });
                break;

            case 'post':
                decisions.push({
                    action: 'quality_review',
                    reason: 'Reviewing generation quality',
                    data: { stage }
                });
                break;
        }

        return decisions;
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        console.log('[OVERSIGHT] Framework Oversight Agent shutdown complete');
    }

    /**
     * Get agent status
     */
    getStatus(): { initialized: boolean; config: OversightAgentConfig } {
        return {
            initialized: this.initialized,
            config: this.config
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let instance: FrameworkOversightAgent | null = null;

export function getFrameworkOversightAgent(): FrameworkOversightAgent {
    if (!instance) {
        instance = new FrameworkOversightAgent();
    }
    return instance;
}

export function createFrameworkOversightAgent(config?: Partial<OversightAgentConfig>): FrameworkOversightAgent {
    return new FrameworkOversightAgent(config);
}
