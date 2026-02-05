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
export * from '../application/services/orchestration/index.js';

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
} from '../infrastructure/index.js';

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
} from '../application/services/generation/index.js';

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
} from '../application/services/validation/index.js';

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
    // Connection Manager
    ConnectionManager,
    getConnectionManager,
} from './registry/index.js';

// ============================================
// CONTEXT - Context management services (Moved to domain/services)
// ============================================
export * from '../domain/services/context/index.js';

// ============================================
// LEARNING - AI learning & vector storage (Moved to domain/services)
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
} from '../domain/services/learning/index.js';

// ============================================
// ANALYSIS - AI analysis services (Moved to domain/services)
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
} from '../domain/services/analysis/index.js';

// ============================================
// ARCHITECTURE - Project architecture services (Moved to domain/services)
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
} from '../domain/services/architecture/index.js';

// ============================================
// INTEGRATIONS - Third-party integrations (Moved to infrastructure/api)
// ============================================
export * from '../infrastructure/api/integrations/index.js';

// ============================================
// AGENTS - Agent coordination & management (Moved to domain/services)
// ============================================
export * from '../domain/services/agents/index.js';

// ============================================
// SECURITY - Security services (Moved to domain/services)
// ============================================
export * from '../domain/services/security/index.js';

// ============================================
// UTILITY SERVICES
// ============================================

// Interactive service selector
export { InteractiveServiceSelector, getInteractiveServiceSelector } from './interactive-service-selector.js';

// Setup guide generator  
export { SetupGuideGenerator, getSetupGuideGenerator } from './setup-guide-generator.js';

// Test generator
export { TestGenerator, createTestGenerator } from './test-generator.js';
