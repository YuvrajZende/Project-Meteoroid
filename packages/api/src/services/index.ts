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
