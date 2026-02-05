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
