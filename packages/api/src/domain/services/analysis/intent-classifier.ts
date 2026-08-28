/**
 * Intent Classifier Service
 *
 * Determines the user's intent from their prompt:
 * - FULL_BACKEND: User wants a complete production backend system
 * - SIMPLE_SCRIPT: User wants a single-file script or utility
 * - QUESTION: User is asking a question about the project/code
 * - EDIT_REQUEST: User wants to modify existing generated code
 * - CODE_REVIEW: User wants feedback on code
 */

import { injectable } from 'inversify';

export type UserIntent =
    | 'FULL_BACKEND'      // Complete production backend system
    | 'SIMPLE_SCRIPT'     // Single file/utility script
    | 'QUESTION'          // Question about project/code
    | 'EDIT_REQUEST'      // Modification to existing code
    | 'CODE_REVIEW'       // Code analysis/review
    | 'EXPLANATION'       // Request for explanation
    | 'UNKNOWN';          // Cannot determine

export interface IntentAnalysis {
    intent: UserIntent;
    confidence: number; // 0-1
    reasoning: string;
    suggestedAction: string;
    estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    requiresCodeGeneration: boolean;
    requiresMultipleFiles: boolean;
    suggestedTechStack?: {
        language: string;
        framework: string;
        reason: string;
    };
}

@injectable()
export class IntentClassifier {
    /**
     * Classify user intent from prompt
     */
    async classify(prompt: string, context?: { hasExistingProject?: boolean }): Promise<IntentAnalysis> {
        const lowerPrompt = prompt.toLowerCase().trim();

        // Question patterns - highest priority
        if (this.isQuestion(lowerPrompt)) {
            return {
                intent: 'QUESTION',
                confidence: 0.95,
                reasoning: 'Prompt contains question keywords',
                suggestedAction: 'Provide informative answer without code generation',
                estimatedComplexity: 'trivial',
                requiresCodeGeneration: false,
                requiresMultipleFiles: false,
            };
        }

        // Edit/modification patterns
        if (this.isEditRequest(lowerPrompt, context)) {
            return {
                intent: 'EDIT_REQUEST',
                confidence: 0.9,
                reasoning: 'Prompt requests modifications to existing code',
                suggestedAction: 'Modify existing files or add new features',
                estimatedComplexity: 'simple',
                requiresCodeGeneration: true,
                requiresMultipleFiles: false,
            };
        }

        // Code review patterns
        if (this.isCodeReview(lowerPrompt)) {
            return {
                intent: 'CODE_REVIEW',
                confidence: 0.9,
                reasoning: 'Prompt asks for code analysis or review',
                suggestedAction: 'Analyze code and provide feedback',
                estimatedComplexity: 'simple',
                requiresCodeGeneration: false,
                requiresMultipleFiles: false,
            };
        }

        // Explanation patterns
        if (this.isExplanationRequest(lowerPrompt)) {
            return {
                intent: 'EXPLANATION',
                confidence: 0.88,
                reasoning: 'Prompt asks for explanation of concepts',
                suggestedAction: 'Provide detailed explanation',
                estimatedComplexity: 'trivial',
                requiresCodeGeneration: false,
                requiresMultipleFiles: false,
            };
        }

        // Simple script vs full backend detection
        const scriptAnalysis = this.detectScriptIntent(lowerPrompt);
        if (scriptAnalysis.isScript) {
            const techStack = this.detectBestTechStack(prompt);
            return {
                intent: 'SIMPLE_SCRIPT',
                confidence: scriptAnalysis.confidence,
                reasoning: scriptAnalysis.reasoning,
                suggestedAction: 'Generate single file or minimal project structure',
                estimatedComplexity: scriptAnalysis.complexity,
                requiresCodeGeneration: true,
                requiresMultipleFiles: scriptAnalysis.needsMultipleFiles,
                suggestedTechStack: techStack,
            };
        }

        // Default: Full backend
        const techStack = this.detectBestTechStack(prompt);
        const complexity = this.estimateBackendComplexity(lowerPrompt);

        return {
            intent: 'FULL_BACKEND',
            confidence: 0.85,
            reasoning: 'Prompt requires production backend infrastructure',
            suggestedAction: 'Generate complete backend project with routes, services, database',
            estimatedComplexity: complexity,
            requiresCodeGeneration: true,
            requiresMultipleFiles: true,
            suggestedTechStack: techStack,
        };
    }

    /**
     * Check if prompt is a question
     */
    private isQuestion(prompt: string): boolean {
        const questionPatterns = [
            /^(what|how|why|when|where|which|who|can|could|would|should|is|are|does|do)\b/i,
            /\?$/,
            /\b(explain|tell me|help me understand|clarify|describe)\b/i,
            /\b(what is|how do|why does|when should)\b/i,
        ];

        return questionPatterns.some(pattern => pattern.test(prompt));
    }

    /**
     * Check if prompt is requesting edits
     */
    private isEditRequest(prompt: string, context?: { hasExistingProject?: boolean }): boolean {
        const editPatterns = [
            /\b(modify|change|update|fix|edit|refactor|improve|enhance)\b/i,
            /\b(add .+ to|remove .+ from|replace .+ with)\b/i,
            /\b(update the|change the|fix the)\b/i,
        ];

        const hasEditKeywords = editPatterns.some(pattern => pattern.test(prompt));

        // More likely to be edit if there's existing project context
        return hasEditKeywords || (!!context?.hasExistingProject && !this.isFullBackendRequest(prompt));
    }

    /**
     * Check if prompt is requesting code review
     */
    private isCodeReview(prompt: string): boolean {
        const reviewPatterns = [
            /\b(review|analyze|check|inspect|examine|audit)\b.*\b(code|implementation|solution)\b/i,
            /\b(is .+ correct|does .+ work|will .+ fail)\b/i,
            /\b(security issues|vulnerabilities|problems|issues)\b/i,
            /\b(optimize|improve performance|make better)\b/i,
        ];

        return reviewPatterns.some(pattern => pattern.test(prompt));
    }

    /**
     * Check if prompt is requesting explanation
     */
    private isExplanationRequest(prompt: string): boolean {
        const explanationPatterns = [
            /\b(explain|describe|tell me about|what does)\b/i,
            /\b(how does .+ work)\b/i,
            /\b(understand|clarify)\b/i,
        ];

        return explanationPatterns.some(pattern => pattern.test(prompt));
    }

    /**
     * Check if this is a full backend request
     */
    private isFullBackendRequest(prompt: string): boolean {
        const backendIndicators = [
            /\b(backend|api|rest|server|microservice|service)\b/i,
            /\b(database|auth|authentication|authorization)\b/i,
            /\b(production|scalable|enterprise)\b/i,
            /\b(crud|routes|endpoints|middleware)\b/i,
        ];

        return backendIndicators.some(pattern => pattern.test(prompt));
    }

    /**
     * Detect if prompt wants a simple script
     */
    private detectScriptIntent(prompt: string): {
        isScript: boolean;
        confidence: number;
        reasoning: string;
        complexity: 'trivial' | 'simple' | 'moderate';
        needsMultipleFiles: boolean;
    } {
        // Simple script indicators
        const simpleScriptPatterns = [
            { pattern: /\b(script|utility|tool|helper|function)\b/i, weight: 0.7 },
            { pattern: /\b(single file|one file|standalone)\b/i, weight: 0.9 },
            { pattern: /\b(convert|transform|parse|calculate|generate)\b.*\b(from|to|between)\b/i, weight: 0.8 },
            { pattern: /\b(read|write|process).*\b(file|data|text)\b/i, weight: 0.6 },
            { pattern: /\b(take|accept|receive|input).*\b(and|then).*\b(output|return|give|show)\b/i, weight: 0.75 },
        ];

        // Complexity indicators (suggests it might need backend)
        const complexityIndicators = [
            /\b(database|persist|store|save to db)\b/i,
            /\b(api|endpoint|route|server)\b/i,
            /\b(auth|login|signup|user|session)\b/i,
            /\b(production|scalable|deploy)\b/i,
            /\b(multiple users|concurrent|distributed)\b/i,
        ];

        let scriptScore = 0;
        let matchedPattern = '';

        for (const { pattern, weight } of simpleScriptPatterns) {
            if (pattern.test(prompt)) {
                scriptScore += weight;
                matchedPattern = pattern.source;
            }
        }

        const hasComplexityIndicators = complexityIndicators.some(pattern => pattern.test(prompt));

        // If has complexity indicators, it's not a simple script
        if (hasComplexityIndicators) {
            return {
                isScript: false,
                confidence: 0.85,
                reasoning: 'Requires backend infrastructure (database, API, auth, etc.)',
                complexity: 'moderate',
                needsMultipleFiles: true,
            };
        }

        // High script score = simple script
        if (scriptScore >= 0.7) {
            const wordCount = prompt.split(/\s+/).length;
            const complexity: 'trivial' | 'simple' | 'moderate' =
                wordCount < 20 ? 'trivial' : wordCount < 50 ? 'simple' : 'moderate';

            return {
                isScript: true,
                confidence: Math.min(scriptScore, 0.95),
                reasoning: `Prompt indicates simple utility/script: ${matchedPattern}`,
                complexity,
                needsMultipleFiles: complexity === 'moderate',
            };
        }

        return {
            isScript: false,
            confidence: 0.6,
            reasoning: 'No clear script indicators, defaulting to backend',
            complexity: 'moderate',
            needsMultipleFiles: true,
        };
    }

    /**
     * Detect best tech stack for the prompt
     */
    private detectBestTechStack(prompt: string): {
        language: string;
        framework: string;
        reason: string;
    } {
        const lowerPrompt = prompt.toLowerCase();

        // Explicit language/framework mentions
        const explicitMatches = [
            { pattern: /\b(python|fastapi|django|flask)\b/i, lang: 'python', fw: 'fastapi', reason: 'Explicit mention in prompt' },
            { pattern: /\b(typescript|node|express|nestjs|fastify)\b/i, lang: 'typescript', fw: 'fastify', reason: 'Explicit mention in prompt' },
            { pattern: /\b(go|golang|gin|fiber)\b/i, lang: 'go', fw: 'gin', reason: 'Explicit mention in prompt' },
            { pattern: /\b(rust|actix|rocket)\b/i, lang: 'rust', fw: 'actix', reason: 'Explicit mention in prompt' },
            { pattern: /\b(java|spring|springboot)\b/i, lang: 'java', fw: 'spring-boot', reason: 'Explicit mention in prompt' },
            { pattern: /\b(csharp|c#|dotnet|\.net|asp\.net)\b/i, lang: 'csharp', fw: 'aspnet', reason: 'Explicit mention in prompt' },
        ];

        for (const match of explicitMatches) {
            if (match.pattern.test(lowerPrompt)) {
                return { language: match.lang, framework: match.fw, reason: match.reason };
            }
        }

        // Simple script/utility indicators → Python (easier for scripts)
        if (/\b(script|utility|tool|generate|word|letter|simple|quick|convert)\b/i.test(lowerPrompt) &&
            !/\b(api|backend|server|database|auth)\b/i.test(lowerPrompt)) {
            return { language: 'python', framework: 'none', reason: 'Simple script best suited for Python' };
        }

        // Domain-based inference
        if (/\b(machine learning|ml|ai|data science|jupyter|numpy|pandas)\b/i.test(lowerPrompt)) {
            return { language: 'python', framework: 'fastapi', reason: 'ML/AI domain best suited for Python' };
        }

        if (/\b(real[- ]?time|websocket|socket\.io|streaming)\b/i.test(lowerPrompt)) {
            return { language: 'typescript', framework: 'fastify', reason: 'Real-time features best with Node.js/TypeScript' };
        }

        if (/\b(high[- ]?performance|concurrent|scalable|microservice)\b/i.test(lowerPrompt)) {
            return { language: 'go', framework: 'gin', reason: 'High-performance requirements suggest Go' };
        }

        if (/\b(enterprise|corporate|legacy|windows)\b/i.test(lowerPrompt)) {
            return { language: 'csharp', framework: 'aspnet', reason: 'Enterprise context suggests C#/.NET' };
        }

        // API/Backend keywords → TypeScript + Framework
        if (/\b(api|backend|server|endpoint|route)\b/i.test(lowerPrompt)) {
            return {
                language: 'typescript',
                framework: 'fastify',
                reason: 'Backend API best with TypeScript + Fastify'
            };
        }

        // Default for unclear cases: Python for simplicity
        return {
            language: 'python',
            framework: 'none',
            reason: 'Default choice for general scripts'
        };
    }

    /**
     * Estimate backend complexity
     */
    private estimateBackendComplexity(prompt: string): 'trivial' | 'simple' | 'moderate' | 'complex' {
        let complexityScore = 0;

        // Complexity indicators
        const indicators = [
            { pattern: /\b(auth|authentication|authorization|oauth|jwt)\b/i, weight: 2 },
            { pattern: /\b(database|postgres|mysql|mongodb|redis)\b/i, weight: 2 },
            { pattern: /\b(payment|stripe|billing|subscription)\b/i, weight: 3 },
            { pattern: /\b(real[- ]?time|websocket|notification|email)\b/i, weight: 2 },
            { pattern: /\b(file upload|storage|s3|cloud)\b/i, weight: 1 },
            { pattern: /\b(search|elasticsearch|algolia)\b/i, weight: 2 },
            { pattern: /\b(queue|job|worker|background|celery)\b/i, weight: 2 },
            { pattern: /\b(microservice|distributed|scalable)\b/i, weight: 3 },
            { pattern: /\b(docker|kubernetes|ci\/cd|deploy)\b/i, weight: 1 },
        ];

        for (const { pattern, weight } of indicators) {
            if (pattern.test(prompt)) {
                complexityScore += weight;
            }
        }

        if (complexityScore === 0) return 'simple';
        if (complexityScore <= 3) return 'moderate';
        return 'complex' as const;
    }
}

// ============================================
// SINGLETON
// ============================================

let classifierInstance: IntentClassifier | null = null;

export function getIntentClassifier(): IntentClassifier {
    if (!classifierInstance) {
        classifierInstance = new IntentClassifier();
    }
    return classifierInstance;
}
