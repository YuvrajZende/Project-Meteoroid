/**
 * Services Index - Phase 27 Refactored
 * 
 * Centralized barrel export for all services.
 * Organized into logical categories for better maintainability.
 * 
 * Note: Where there are conflicting type names, we use explicit exports
 * to avoid ambiguity (e.g., GeneratedFile, SupportedLanguage).
 */

// ============================================
// ORCHESTRATION - Main orchestration pipeline
// ============================================
export * from './orchestration/index.js';

// ============================================
// INFRASTRUCTURE - Core system services
// Explicit exports to avoid WriteResult conflict with orchestration
// ============================================
export {
    AIClient,
    getAIClient,
    type ChatMessage,
    CostTrackerService,
    getCostTracker,
    FileWriterService,
    getFileWriter,
    getSupabaseClient,
    getSupabaseAdmin,
    checkSupabaseConnection,
    checkVectorStore,
    JobQueue,
    getJobQueue,
    KeyManager,
    getKeyManager,
    BenchmarkingService,
    getBenchmarkingService,
} from './infrastructure/index.js';

// ============================================
// GENERATION - Code generation services
// ============================================
export {
    EnhancedCodeGenerator,
    getEnhancedCodeGenerator,
    type EnhancedCodeGenRequest,
    type EnhancedCodeGenResult,
    type SupportedLanguage,
    type SupportedFramework,
    type GeneratedFile,
    type EnhancedFeature,
    DatabaseCodeGenerator,
    getDatabaseCodeGenerator,
    RouteGenerator,
    getRouteGenerator,
} from './generation/index.js';

// ============================================
// VALIDATION - Code validation & post-processing
// Explicit exports due to GeneratedFile conflict
// ============================================
export {
    CodePostProcessor,
    getCodePostProcessor,
    type ProcessedOutput,
    CodeValidator,
    getCodeValidator,
    ProjectIntegrityValidator,
    getProjectIntegrityValidator,
    type ValidationReport,
    type ValidationIssue,
} from './validation/index.js';

// ============================================
// REGISTRY - All registries (deps, imports, agents, models, services)
// Explicit exports due to SupportedLanguage conflict
// ============================================
export {
    DependencyRegistry,
    getDependencyRegistry,
    type DependencyMapping,
    type PackageJson,
    type DependencyAnalysis,
    ImportRegistry,
    getImportRegistry,
    type ImportStatement,
    type ImportConflict,
    type DeduplicationResult,
    AgentRegistry,
    getAgentRegistry,
    MODEL_REGISTRY,
    getModel,
    getModelsByTier,
    getModelsByProvider,
    type ModelConfig,
    // Service Registry
    ServiceRegistry,
    getServiceRegistry,
    initializeServiceRegistry,
    type ServiceDefinition,
    type ServiceCategory,
    type UserConnection,
    type CredentialField,
    type CreateConnectionInput,
    type UpdateConnectionInput,
    type ConnectionTestResult,
} from './registry/index.js';

// ============================================
// CONTEXT - Context management services
// ============================================
export * from './context/index.js';

// ============================================
// LEARNING - AI learning & vector storage
// Explicit exports to avoid LearningContext conflict with orchestration/types
// ============================================
export {
    LearningService,
    getLearningService,
    type LearningConfig,
    type LearnedPattern,
    type GenerationIteration,
    type TestingIteration,
    type PreContext,
    VectorStoreService,
    getVectorStore,
    createVectorStore,
    type VectorStoreConfig,
    type CodeChunk,
    type EmbeddedChunk,
    type SimilarityResult,
    type IndexingResult,
    type SearchOptions,
    VectorLearningSystem,
    getVectorLearningSystem,
    type VectorLearningContext,
    EnhancedLearningContextBuilder,
    getEnhancedLearningContextBuilder,
    type LearningContext as EnhancedLearningContext,
} from './learning/index.js';

// ============================================
// ANALYSIS - AI analysis services
// Explicit exports to avoid ExtractedEntity conflict
// ============================================
export {
    AIIntentAnalyzer,
    getAIIntentAnalyzer,
    IntentClassifier,
    getIntentClassifier,
    type IntentAnalysis,
    type UserIntent,
    EntityExtractorService,
    getEntityExtractor,
    type ExtractedEntity as AnalysisExtractedEntity,
    type EntityExtractionResult,
    QualityAssessmentService,
    getQualityAssessment,
    RobustJSONParser,
    getRobustJSONParser,
} from './analysis/index.js';

// ============================================
// ARCHITECTURE - Project architecture services
// Explicit exports to avoid ArchitectureBlueprint conflict with orchestration/types
// ============================================
export {
    ArchitectureBlueprintGenerator,
    getArchitectureBlueprintGenerator,
    type ArchitectureBlueprint as ArchitectureBlueprintType,
    ArchitectureKnowledgeService,
    getArchitectureKnowledge,
    createProjectScaffold,
    type ScaffoldConfig,
    type ScaffoldResult,
} from './architecture/index.js';

// ============================================
// INTEGRATIONS - Third-party integrations
// ============================================
export * from './integrations/index.js';

// ============================================
// AGENTS - Agent coordination & management
// ============================================
export * from './agents/index.js';

// ============================================
// SECURITY - Security services
// ============================================
export * from './security/index.js';

// ============================================
// UTILITY SERVICES
// ============================================

// Interactive service selector
export { InteractiveServiceSelector, getInteractiveServiceSelector } from './interactive-service-selector.js';

// Setup guide generator  
export { SetupGuideGenerator, getSetupGuideGenerator } from './setup-guide-generator.js';

// Test generator
export { TestGenerator, createTestGenerator } from './test-generator.js';

// ============================================
// AI INTEGRATION (Person 2's Implementation)
// ============================================

export {
    // Core AI Service
    AIIntegrationService,
    getAIIntegrationService,

    // Prompt Templates
    SYSTEM_PROMPTS,
    FEW_SHOT_EXAMPLES,
    CHAIN_OF_THOUGHT,
    buildDatabasePrompt,
    buildQueuePrompt,
    buildTestPrompt,
    buildCodeGenerationPrompt,

    // Prompt Version Manager
    PromptVersionManager,
    getPromptVersionManager,

    // Training Pipeline (Phase 5)
    TrainingDataCollector,
    ModelVersionManager,
    CostOptimizer,
    PerformanceOptimizer,
    getTrainingDataCollector,
    getModelVersionManager,
    getCostOptimizer,
    getPerformanceOptimizer,

    // Output Validation (Phase 5)
    OutputValidator,
    getOutputValidator,
    SYNTAX_RULES,
    TYPE_RULES,
    SECURITY_RULES,
    BEST_PRACTICE_RULES,

    // Production Readiness (Phase 6)
    AIQualityAssurance,
    ErrorHandlingManager,
    FeedbackLoop,
    UsageAnalyticsService,
    getAIQualityAssurance,
    getErrorHandlingManager,
    getFeedbackLoop,
    getUsageAnalyticsService,

    // Launch Preparation (Phase 7)
    ModelPerformanceValidator,
    UserOnboardingService,
    HelpDocumentationService,
    getModelPerformanceValidator,
    getUserOnboardingService,
    getHelpDocumentationService,

    // Core Types
    type AIRequest,
    type AIResponse,
    type AgentTask,
    type AgentResult,
    type PromptVersion,
    type PromptPerformance,
    type ABTestConfig,
    type ABTestResult,

    // Training Types
    type TrainingExample,
    type TrainingDataset,
    type ModelVersion,
    type ModelMetrics,
    type TrainingConfig,
    type CostOptimization,
    type CostRecommendation,
    type PerformanceMetrics,

    // Validation Types
    type ValidationResult,
    type ValidationError,
    type ValidationWarning,
    type ValidationMetadata,
    type ValidationRule,

    // Production Types
    type AIQualityMetrics,
    type AgentQualityMetrics,
    type ErrorEvent,
    type FeedbackEntry,
    type FeedbackIssue,
    type UsageEvent,
    type UsageAnalytics,

    // Launch Types
    type ModelValidation,
    type BenchmarkResult,
    type ValidationIssue as ModelValidationIssue,
    type OnboardingStep,
    type UserOnboardingProgress,
    type HelpArticle,
    type HelpSearchResult,

    // AI Orchestration Layer
    AIOrchestrationService,
    getAIOrchestrationService,
    AIOrchestrationError,
    type AIOrchestrationRequest,
    type AIOrchestrationResult,
    type AIOrchestrationDashboard,
    type AIOrchestrationHealth,
} from './ai/index.js';
