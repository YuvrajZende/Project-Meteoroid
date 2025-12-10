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
