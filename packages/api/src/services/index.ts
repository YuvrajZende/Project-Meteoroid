/**
 * Services module exports
 */

export { AgentRegistry, getAgentRegistry } from './agent-registry.js';
export { AgentLoader, createAgentLoader } from './agent-loader.js';
export {
    KeyManager,
    getKeyManager,
    createKeyManager,
    type AIProvider,
    type KeyMetadata,
    type KeyManagerConfig,
    type SelectionStrategy,
} from './key-manager.js';
export {
    JobQueue,
    getJobQueue,
    createJobQueue,
    type GenerationJobData,
    type JobProgress,
    type JobResult,
    type JobQueueConfig,
} from './job-queue.js';
export {
    OrchestratorService,
    getOrchestrator,
    createOrchestrator,
    registerOrchestrator,
    type OrchestratorConfig,
    type ExecutionContext,
    type ExecutionResult,
    type ProgressCallback,
} from './orchestrator.js';

// Core Services
export {
    ThinkingEngineService,
    ContextManagerService,
    AgentMonitorService,
    MCPHubService,
    getThinkingEngine,
    getContextManager,
    getAgentMonitor,
    getMCPHub,
    initializeCoreServices,
    type ThinkingTrace,
    type TaskAnalysis,
    type SubTask,
    type ContextWindow,
    type MemoryEntry,
    type ProjectContext,
    type AgentExecutionStatus,
    type MCPMessage,
} from './core-services.js';

// Agent Coordination
export {
    AgentCoordinator,
    getAgentCoordinator,
    coordinateSequential,
    coordinateParallel,
    type CoordinationTask,
    type CoordinationStep,
    type CoordinationResult,
    type HandoffRequest,
} from './agent-coordinator.js';

// AI Client
export {
    AIClient,
    getAIClient,
    type ChatMessage,
} from './ai-client.js';

// Integrated Orchestrator (REAL orchestrator - replaces demo mode)
export {
    IntegratedOrchestrator,
    getIntegratedOrchestrator,
    createIntegratedOrchestrator,
    type IntegratedOrchestratorConfig,
    type OrchestrationInput,
    type OrchestrationStep,
    type OrchestrationResult,
} from './integrated-orchestrator.js';

// File Writer (writes generated code to disk)
export {
    FileWriterService,
    getFileWriter,
    createFileWriter,
    type GeneratedFile,
    type WriteResult,
    type FileWriterConfig,
} from './file-writer.js';

// Persistent Context (Supabase-backed context manager)
export {
    PersistentContextManager,
    getPersistentContext,
    createPersistentContext,
    type PersistedContext,
    type PersistenceConfig,
} from './persistent-context.js';

// Agent Templates (wires agent templates to code generation)
export {
    AgentTemplateOrchestrator,
    getAgentTemplateOrchestrator,
    type AgentTemplate,
    type TemplateContext,
    type TemplateResult,
} from './agent-templates.js';

// Benchmarking Service (tracks agent and orchestrator performance)
export {
    BenchmarkingService,
    getBenchmarkingService,
    createBenchmarkingService,
    type AgentBenchmark,
    type AgentMetrics,
    type OrchestratorMetrics,
    type BenchmarkScenario,
    type BenchmarkResult,
    type BenchmarkReport,
} from './benchmarking.js';

// ============================================
// PHASE 13: MULTI-MODEL HYDRATION PATTERN
// ============================================

// Model Registry (comprehensive model configuration)
export {
    MODEL_REGISTRY,
    PROVIDER_CONFIGS,
    getModel,
    getModelsByTier,
    getModelsByProvider,
    getModelsByCapability,
    getCheapestModel,
    getBestQualityModel,
    getRecommendedModelPair,
    getConfiguredModelPair,
    listAllModels,
    isProviderConfigured,
    getConfiguredProviders,
    getAvailableModels,
    estimateCost,
    type ModelConfig,
    type ModelProvider,
    type ModelTier,
    type ModelCapability,
    type ModelPricing,
    type ProviderConfig,
} from './model-registry.js';

// Cost Tracker (real-time cost monitoring)
export {
    CostTrackerService,
    getCostTracker,
    createCostTracker,
    type CostRecord,
    type CostSummary,
    type BudgetConfig,
    type CostOptimizationSuggestion,
} from './cost-tracker.js';

// Multi-Model Orchestrator (two-stage pipeline)
export {
    MultiModelOrchestrator,
    getMultiModelOrchestrator,
    createMultiModelOrchestrator,
    type MultiModelConfig,
    type ContextAnalysis,
    type GenerationResult,
    type MultiModelRequest,
} from './multi-model-orchestrator.js';

// CodeGen Service (Person 4's code generation pipeline integration)
export {
    CodeGenService,
    getCodeGenService,
    type CodeGenRequest,
    type CodeGenResult,
    type GeneratedFile as CodeGenFile,  // Renamed to avoid conflict with file-writer's GeneratedFile
    type SupportedLanguage,
    type SupportedFramework,
} from './codegen-service.js';

// ============================================
// PHASE 14: FRAMEWORK-SPECIFIC TEMPLATES
// ============================================

export {
    FASTIFY_TEMPLATES,
    EXPRESS_TEMPLATES,
    NESTJS_TEMPLATES,
    HONO_TEMPLATES,
    getFrameworkTemplates,
    getTemplateForStack,
    detectFrameworkFromPrompt,
    getCompleteProjectTemplate,
    type FrameworkTemplate,
    type TemplateFile,
} from './framework-templates.js';

// Phase 14.4: Agent Stack Constraints
export {
    getAgentConstraints,
    buildAgentSystemPrompt,
    validateAgentOutput,
    getAgentBoilerplate,
    getSupportedAgentTypes,
    type AgentConstraints,
    type AgentType,
} from './agent-stack-constraints.js';

// ============================================
// PHASE 15: AUTOMATED DEPLOYMENT PIPELINE
// ============================================

// GitHub Integration (15.1)
export {
    GitHubService,
    getGitHubService,
    createGitHubService,
    type GitHubConfig,
    type GitHubUser,
    type GitHubRepo,
    type CreateRepoOptions,
    type CommitOptions,
    type CommitResult,
} from './github-service.js';

// Deployment Service (15.2)
export {
    DeploymentService,
    getDeploymentService,
    createDeploymentService,
    type DeploymentConfig,
    type DeploymentProvider,
    type DeploymentStatus,
    type DeploymentSite,
    type DeploymentResult,
    type DeployOptions,
} from './deployment-service.js';

// Auto-Deploy Manager (15.4)
export {
    AutoDeployManager,
    getAutoDeployManager,
    createAutoDeployManager,
    type AutoDeployConfig,
    type DeploymentEvent,
    type ProjectDeploymentState,
    type StoredDeployment,
} from './auto-deploy-manager.js';

// ============================================
// PHASE 16: REAL-TIME PREVIEW & COLLABORATION
// ============================================

// Preview Service (16.1 - 16.4)
export {
    PreviewService,
    getPreviewService,
    createPreviewService,
    type PreviewConfig,
    type PreviewFile,
    type PreviewRequest,
    type PreviewSession,
    type PreviewResult,
    type PreviewFramework,
    type HMRUpdate,
    type CollaborationCursor,
    type CollaborationState,
} from './preview-service.js';

// ============================================
// PHASE 17: CODE GENERATION QUALITY
// ============================================

// Code Post-Processor (17.1)
export {
    CodePostProcessor,
    getCodePostProcessor,
    createCodePostProcessor,
    type GeneratedFile as PostProcessedFile,
    type ProcessedOutput,
    type AICodeResponse,
} from './code-postprocessor.js';

// Project Scaffold Generator (17.3)
export {
    ProjectScaffoldGenerator,
    createProjectScaffold,
    getDefaultScaffoldConfig,
    type ScaffoldConfig,
    type ScaffoldFile,
    type ScaffoldResult,
} from './project-scaffold.js';

// Test Generator (17.4)
export {
    TestGenerator,
    getTestGenerator,
    createTestGenerator,
    type TestFile,
    type TestGeneratorConfig,
    type GeneratedTestResult,
} from './test-generator.js';

// Code Validator (17.6)
export {
    CodeValidator,
    getCodeValidator,
    createCodeValidator,
    type ValidationError,
    type ValidationResult,
    type CodeFile,
    type ValidatorConfig,
} from './code-validator.js';

// Database Code Generator (17.2)
export {
    DatabaseCodeGenerator,
    getDatabaseCodeGenerator,
    createDatabaseCodeGenerator,
    type EntityField,
    type EntityDefinition,
    type DatabaseConfig,
    type GeneratedDbFile,
    type DatabaseGenerationResult,
} from './database-generator.js';

// Route Generator (17.1)
export {
    RouteGenerator,
    getRouteGenerator,
    createRouteGenerator,
    type RouteConfig,
    type EntityRoute,
    type GeneratedRoute,
    type RouteGenerationResult,
} from './route-generator.js';

// Enhanced Code Generator (Phase 17 + Person 4 Integration)
export {
    EnhancedCodeGenerator,
    getEnhancedCodeGenerator,
    createEnhancedCodeGenerator,
    type EnhancedCodeGenRequest,
    type EnhancedCodeGenResult,
    type EnhancedFeature,
    // Note: SupportedLanguage and SupportedFramework already exported from codegen-service
} from './enhanced-code-generator.js';

// Vector Store (Phase 18)
export {
    VectorStoreService,
    getVectorStore,
    createVectorStore,
    type VectorStoreConfig,
    type CodeChunk,
    type EmbeddedChunk,
    type SimilarityResult,
    type IndexingResult,
    type SearchOptions,
} from './vector-store.js';

// Learning Service (Phase 18)
export {
    LearningService,
    getLearningService,
    createLearningService,
    type LearningConfig,
    type GenerationIteration,
    type TestingIteration,
    type LearnedPattern,
    type PreContext,
} from './learning-service.js';

// ============================================
// PHASE 19: SECURITY (Simplified - Using Supabase)
// ============================================

// MFA Service (19.5 - Multi-Factor Authentication) - Optional premium feature
export {
    MFAService,
    getMFAService,
    type MFASetupResult,
    type MFAVerifyResult,
    type MFAStatus,
} from './mfa-service.js';

// Note: The following services were REMOVED (Supabase handles them):
// - Password Service (Supabase uses Bcrypt)
// - JWT Service (Supabase generates JWTs)
// - Encryption Service (Supabase encrypts at rest)
// - OAuth State Service (Supabase handles PKCE)
// - Request Signing Service (Not needed for user-facing API)
// - Secret Rotation Service (Over-engineered)
// - Vault Service (Over-engineered)

// ============================================
// PHASE 20: ARCHITECTURE BLUEPRINT GENERATOR
// ============================================

// Architecture Blueprint Generator (ASCII art system design)
export {
    ArchitectureBlueprintGenerator,
    getArchitectureBlueprintGenerator,
    type RouteDefinition,
    type ServiceDefinition,
    type DatabaseTable,
    type AgentDefinition,
    type MiddlewareDefinition,
    type ArchitectureBlueprint,
    type BlueprintRequest,
} from './architecture-blueprint.js';

// ============================================
// PHASE 21: CODE QUALITY & KNOWLEDGE (Phase 21)
// ============================================

// Quality Assessment Service (Code quality evaluation before postprocessing)
export {
    QualityAssessmentService,
    getQualityAssessment,
    type QualityAssessmentConfig,
    type QualityAssessmentResult,
    type QualityIssue,
} from './quality-assessment.js';

// Architecture Knowledge Service (Cross-reference past architectures)
export {
    ArchitectureKnowledgeService,
    getArchitectureKnowledge,
    type StoredArchitecture,
    type ArchitectureMatch,
} from './architecture-knowledge.js';

// ============================================
// PHASE 21: ENHANCED INTELLIGENCE
// ============================================

// Intent Classifier (Determine user intent: question vs code generation vs edit)
export {
    IntentClassifier,
    getIntentClassifier,
    type UserIntent,
    type IntentAnalysis,
} from './intent-classifier.js';

// Robust JSON Parser (Fix malformed LLM responses)
export {
    RobustJSONParser,
    getRobustJSONParser,
    type JSONParseResult,
} from './robust-json-parser.js';

// Enhanced Learning Context Builder (Build rich context from past generations)
export {
    EnhancedLearningContextBuilder,
    getEnhancedLearningContextBuilder,
    type LearningContext,
} from './enhanced-learning-context.js';

// ============================================
// PHASE 22: AI-DRIVEN LEARNING & INTELLIGENCE
// ============================================

// AI Intent Analyzer (Uses AI to determine intent/language instead of regex)
export {
    AIIntentAnalyzer,
    getAIIntentAnalyzer,
    type AIIntentAnalysis,
} from './ai-intent-analyzer.js';

// Vector Learning System (Semantic search using Supabase embeddings)
export {
    VectorLearningSystem,
    getVectorLearningSystem,
    type VectorLearningContext,
} from './vector-learning-system.js';

// ============================================
// PHASE 21: SERVICE INTEGRATION FRAMEWORK
// ============================================

// Service Registry (100+ third-party service definitions)
export {
    ServiceRegistry,
    getServiceRegistry,
    initializeServiceRegistry,
    type ServiceDefinition as ServiceDef,  // Renamed to avoid conflict with architecture-blueprint
    type ServiceCategory,
    type CredentialField,
    type CodeTemplate,
    type ServiceQuestion,
    type ServiceSelection,
    type SetupStep,
    type SetupGuide,
} from './service-registry/index.js';

// Connection Manager (User service connections with encryption)
export {
    ConnectionManager,
    getConnectionManager,
    type UserConnection,
    type CreateConnectionInput,
    type UpdateConnectionInput,
    type ConnectionTestResult,
    type ServiceUsageLog,
    type ServiceUsageStats,
} from './connection-manager/index.js';

// Service Adapters (Per-service test and code generation)
export {
    BaseAdapter,
    getServiceAdapter,
    hasAdapter,
    getAllAdapters,
    initializeAdapters,
    registerAdapter,
} from './adapters/adapter-factory.js';

// Interactive Service Selector (AI-driven service selection)
export {
    InteractiveServiceSelector,
    getInteractiveServiceSelector,
} from './interactive-service-selector.js';

// Setup Guide Generator (Step-by-step setup instructions)
export {
    SetupGuideGenerator,
    getSetupGuideGenerator,
} from './setup-guide-generator.js';

// ============================================
// PHASE 24: CONTEXT MANAGEMENT SYSTEM
// ============================================

// Entity Extractor (Extract entities from prompts before generation)
export {
    EntityExtractorService,
    getEntityExtractor,
    type ExtractedEntity,
    type EntityProperty,
    type EntityRelationship,
    type ExtractedFeatures,
    type ExtractedIntegrations,
    type EntityExtractionResult,
    type EntityExtractorConfig,
} from './entity-extractor.js';

// Generation Context (Maintain context throughout pipeline)
export {
    GenerationContextService,
    getGenerationContext,
    type GenerationContext,
    type GenerationDecision,
    type GeneratedFileInfo,
    type SubtaskResult,
    type ContextSummary,
} from './generation-context.js';

// Prompt Templates (Standardized prompts with context)
export {
    buildSubtaskPrompt,
    buildSchemaPrompt,
    buildRoutePrompt,
    buildServicePrompt,
    buildValidationPrompt,
    getContextReminder,
    getEntityConstraints,
} from './prompt-templates.js';

// ============================================
// PHASE 25: CODE QUALITY & OVERSIGHT AGENTS
// ============================================

// Code Quality Agent (Validates and fixes generated code)
export {
    CodeQualityAgent,
    getCodeQualityAgent,
    createCodeQualityAgent,
    type QualityCheck,
    type QualityReport,
    type QualityAgentConfig,
    type ValidationContext,
} from './code-quality-agent.js';

// Framework Oversight Agent (Oversees pipeline, controls learning)
export {
    FrameworkOversightAgent,
    getFrameworkOversightAgent,
    createFrameworkOversightAgent,
    type ContextInjection,
    type PreContext as OversightPreContext,
    type LearningDecision,
    type OversightDecision,
    type OversightAgentConfig,
    type PostReviewResult,
} from './framework-oversight-agent.js';

