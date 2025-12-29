/**
 * AI Module Exports
 * 
 * @author Person 2 (AI/ML Engineer)
 */

// ============================================
// AI INTEGRATION SERVICE
// ============================================

export {
    AIIntegrationService,
    getAIIntegrationService,
    type AIRequest,
    type AIResponse,
    type AgentTask,
    type AgentResult,
    type AIIntegrationConfig,
} from './ai-integration-service.js';

// ============================================
// PROMPT TEMPLATES
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
} from './prompts/agent-prompts.js';

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
} from './prompts/prompt-version-manager.js';

// ============================================
// TRAINING PIPELINE (Phase 5)
// ============================================

export {
    TrainingDataCollector,
    ModelVersionManager,
    CostOptimizer,
    PerformanceOptimizer,
    getTrainingDataCollector,
    getModelVersionManager,
    getCostOptimizer,
    getPerformanceOptimizer,
    type TrainingExample,
    type TrainingDataset,
    type ModelVersion,
    type ModelMetrics,
    type TrainingConfig,
    type CostOptimization,
    type CostRecommendation,
    type PerformanceMetrics,
} from './training/index.js';

// ============================================
// OUTPUT VALIDATION (Phase 5)
// ============================================

export {
    OutputValidator,
    getOutputValidator,
    SYNTAX_RULES,
    TYPE_RULES,
    SECURITY_RULES,
    BEST_PRACTICE_RULES,
    type ValidationResult,
    type ValidationError,
    type ValidationWarning,
    type ValidationMetadata,
    type ValidationRule,
} from './validation/index.js';

// ============================================
// PRODUCTION READINESS (Phase 6)
// ============================================

export {
    AIQualityAssurance,
    ErrorHandlingManager,
    FeedbackLoop,
    UsageAnalyticsService,
    getAIQualityAssurance,
    getErrorHandlingManager,
    getFeedbackLoop,
    getUsageAnalyticsService,
    type AIQualityMetrics,
    type AgentQualityMetrics,
    type TimeWindowMetrics,
    type ErrorEvent,
    type FeedbackEntry,
    type FeedbackIssue,
    type UsageEvent,
    type UsageAnalytics,
} from './production/index.js';

// ============================================
// LAUNCH PREPARATION (Phase 7)
// ============================================

export {
    ModelPerformanceValidator,
    UserOnboardingService,
    HelpDocumentationService,
    getModelPerformanceValidator,
    getUserOnboardingService,
    getHelpDocumentationService,
    type ModelValidation,
    type ValidationMetrics as ModelValidationMetrics,
    type BenchmarkResult,
    type ValidationIssue,
    type OnboardingStep,
    type OnboardingContent,
    type QuizQuestion,
    type UserOnboardingProgress,
    type HelpArticle,
    type HelpSearchResult,
} from './launch/index.js';

// ============================================
// AI ORCHESTRATION LAYER (Unified Interface)
// ============================================

export {
    AIOrchestrationService,
    getAIOrchestrationService,
    AIOrchestrationError,
    type AIOrchestrationRequest,
    type AIOrchestrationResult,
    type AIOrchestrationDashboard,
    type AIOrchestrationHealth,
} from './ai-orchestration-layer.js';
