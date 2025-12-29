/**
 * Prompts Module Exports
 * 
 * @author Person 2 (AI/ML Engineer)
 */

// ============================================
// AGENT PROMPTS
// ============================================

export {
    SYSTEM_PROMPTS,
    FEW_SHOT_EXAMPLES,
    CHAIN_OF_THOUGHT,
    buildDatabasePrompt,
    buildQueuePrompt,
    buildTestPrompt,
    buildCodeGenerationPrompt,
    trackPromptUsage,
    PROMPT_VERSIONS,
    type PromptMetrics,
} from './agent-prompts.js';

// ============================================
// PROMPT VERSION MANAGER
// ============================================

export {
    PromptVersionManager,
    getPromptVersionManager,
    type PromptVersion,
    type PromptPerformance,
    type ABTestConfig,
    type ABTestResult,
} from './prompt-version-manager.js';
