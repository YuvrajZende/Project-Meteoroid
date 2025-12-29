/**
 * AI Intent Analyzer
 * 
 * Uses the FAST MODEL to intelligently determine:
 * 1. User's intent (QUESTION vs SIMPLE_SCRIPT vs FULL_BACKEND)
 * 2. Best programming language for the task
 * 3. Best framework (or none for simple scripts)
 * 
 * This REPLACES regex-based intent classification with AI intelligence.
 */

import { getAIClient } from '../infrastructure/ai-client.js';
import { getRobustJSONParser } from './robust-json-parser.js';

export interface AIIntentAnalysis {
    intent: 'QUESTION' | 'SIMPLE_SCRIPT' | 'FULL_BACKEND';
    language: string;
    framework: string;
    reasoning: string;
    confidence: number;
    requiresCodeGeneration: boolean;
    estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex';
}

export class AIIntentAnalyzer {
    /**
     * Analyze user prompt using AI instead of regex patterns
     */
    async analyze(prompt: string, context?: { hasExistingProject?: boolean }): Promise<AIIntentAnalysis> {
        const aiClient = getAIClient();
        const parser = getRobustJSONParser();

        const systemPrompt = `You are an expert at analyzing developer requests. Your job is to determine:

1. **Intent**: Is this a QUESTION (asking about something), SIMPLE_SCRIPT (wants a single utility/script), or FULL_BACKEND (needs production system)?

2. **Language**: Which programming language is BEST for this task?
   - Python: Great for scripts, data processing, ML/AI, quick utilities
   - TypeScript: Best for backends, APIs, real-time systems
   - Go: High-performance, concurrent systems
   - Rust: Systems programming, maximum performance
   - Java: Enterprise systems
   - C#: Windows/enterprise applications

3. **Framework**: What framework (if any)?
   - "none" for simple scripts
   - "fastapi" for Python APIs
   - "fastify" for TypeScript APIs
   - "gin" for Go APIs
   - etc.

4. **Complexity**: trivial, simple, moderate, or complex

Respond ONLY with valid JSON:
{
  "intent": "QUESTION" | "SIMPLE_SCRIPT" | "FULL_BACKEND",
  "language": "python" | "typescript" | "go" | "rust" | "java" | "csharp",
  "framework": "none" | "fastapi" | "fastify" | "gin" | "express" | "nestjs" | etc,
  "reasoning": "why you chose this combination",
  "confidence": 0.95,
  "requiresCodeGeneration": true | false,
  "estimatedComplexity": "trivial" | "simple" | "moderate" | "complex"
}

**Examples:**
- "What is JWT?" → QUESTION, no code needed
- "script to generate words A to Z" → SIMPLE_SCRIPT, python, none
- "Build REST API for user auth" → FULL_BACKEND, typescript, fastify
- "ML API for image classification" → FULL_BACKEND, python, fastapi

Respond with ONLY the JSON, no markdown, no explanation.`;

        try {
            // Call fast model for analysis
            const response = await aiClient.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this request: "${prompt}"${context?.hasExistingProject ? ' (user has an existing project)' : ''}` }
            ]);

            // Parse with robust parser
            const parseResult = parser.parse<AIIntentAnalysis>(response);

            if (!parseResult.success || !parseResult.data) {
                console.warn('[AI-INTENT] Failed to parse, using fallback');
                return this.getFallbackAnalysis(prompt);
            }

            const analysis = parseResult.data;

            // Validate and sanitize
            if (!['QUESTION', 'SIMPLE_SCRIPT', 'FULL_BACKEND'].includes(analysis.intent)) {
                analysis.intent = 'SIMPLE_SCRIPT';
            }

            console.log(`[AI-INTENT] Analyzed: ${analysis.intent} | ${analysis.language}/${analysis.framework} | confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
            console.log(`[AI-INTENT] Reasoning: ${analysis.reasoning}`);

            return analysis;

        } catch (error) {
            console.error('[AI-INTENT] Error during analysis:', error);
            return this.getFallbackAnalysis(prompt);
        }
    }

    /**
     * Fallback analysis using simple heuristics
     */
    private getFallbackAnalysis(prompt: string): AIIntentAnalysis {
        const lower = prompt.toLowerCase();

        // Check if question
        if (/^(what|how|why|when|where|which|who|can|could|would|should|is|are|does|do)\b/i.test(prompt) || prompt.includes('?')) {
            return {
                intent: 'QUESTION',
                language: 'typescript',
                framework: 'none',
                reasoning: 'Fallback: Detected question pattern',
                confidence: 0.7,
                requiresCodeGeneration: false,
                estimatedComplexity: 'trivial'
            };
        }

        // Check if simple script
        if (/\b(script|utility|generate|word|convert)\b/i.test(lower) && !/\b(api|backend|database)\b/i.test(lower)) {
            return {
                intent: 'SIMPLE_SCRIPT',
                language: 'python',
                framework: 'none',
                reasoning: 'Fallback: Simple script indicators detected',
                confidence: 0.7,
                requiresCodeGeneration: true,
                estimatedComplexity: 'simple'
            };
        }

        // Default: Full backend
        return {
            intent: 'FULL_BACKEND',
            language: 'typescript',
            framework: 'fastify',
            reasoning: 'Fallback: Defaulting to backend system',
            confidence: 0.6,
            requiresCodeGeneration: true,
            estimatedComplexity: 'moderate'
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let analyzerInstance: AIIntentAnalyzer | null = null;

export function getAIIntentAnalyzer(): AIIntentAnalyzer {
    if (!analyzerInstance) {
        analyzerInstance = new AIIntentAnalyzer();
    }
    return analyzerInstance;
}
