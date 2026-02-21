/**
 * Orchestration Services
 * 
 * The orchestration layer for AI-powered code generation.
 * Uses IntegratedOrchestrator as the main entry point.
 */

// ============================================
// MAIN ORCHESTRATOR - IntegratedOrchestrator
// ============================================

export {
    IntegratedOrchestrator,
    getIntegratedOrchestrator,
    createIntegratedOrchestrator,
    type IntegratedOrchestratorConfig,
    type OrchestrationInput,
    type OrchestrationStep,
    type OrchestrationResult,
} from './integrated-orchestrator.js';

// ============================================
// MULTI-MODEL PIPELINE (Used internally by IntegratedOrchestrator)
// ============================================

export {
    MultiModelOrchestrator,
    getMultiModelOrchestrator,
    type MultiModelConfig,
    type MultiModelRequest,
    type GenerationResult as MultiModelGenerationResult,
    type ContextAnalysis,
} from './multi-model-orchestrator.js';

// ============================================
// REFACTORED SERVICES (ARCH-001)
// ============================================

export {
    OrchestrationContextService,
    OrchestrationGenerationService,
    OrchestrationFileService,
    type ContextResult,
    type CodeGenerationRequest,
    type CodeGenerationResult,
    type FileToWrite,
    type FileProcessingResult,
} from './services/index.js';

export type {
    MultiModelResult,
    GeneratedFile,
    TokenCost,
    ArchitectureBlueprint,
    AgentExecutionRecord,
    TokenUsage,
    OrchestrationMetrics,
    QualityAssessmentResult,
    LearningMetrics,
    CostSummary,
    DatabaseSaveResult,
} from './services/index.js';
