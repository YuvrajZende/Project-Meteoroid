/**
 * ============================================
 * ORCHESTRATOR CORE MODULE EXPORTS
 * ============================================
 * 
 * The Brain and Nervous System of the LOVEABLE Orchestrator.
 * All core systems are interconnected through the Brain Core.
 * 
 * ARCHITECTURE:
 * 
 *                    ┌─────────────────┐
 *                    │   BRAIN CORE    │  ← Central Nervous System
 *                    │  (Integration)  │
 *                    └────────┬────────┘
 *                             │
 *         ┌───────────────────┼───────────────────┐
 *         │                   │                   │
 *    ┌────▼────┐       ┌──────▼──────┐     ┌─────▼─────┐
 *    │ THINKING │       │   CONTEXT   │     │ KNOWLEDGE │
 *    │  ENGINE  │◄─────►│   MANAGER   │◄───►│   BASE    │
 *    └────┬─────┘       └──────┬──────┘     └─────┬─────┘
 *         │                    │                  │
 *         └────────────────────┼──────────────────┘
 *                              │
 *         ┌───────────────────┬┴──────────────────┐
 *         │                   │                   │
 *    ┌────▼────┐       ┌──────▼──────┐     ┌─────▼─────┐
 *    │  TASK   │       │   AGENT     │     │    MCP    │
 *    │ MANAGER │◄─────►│   MONITOR   │◄───►│    HUB    │
 *    └────┬────┘       └──────┬──────┘     └─────┬─────┘
 *         │                   │                  │
 *         └───────────────────┼──────────────────┘
 *                             │
 *         ┌───────────────────┴───────────────────┐
 *         │                                       │
 *    ┌────▼────┐                           ┌─────▼─────┐
 *    │ HEALTH  │                           │   REDIS   │
 *    │ MONITOR │                           │CHECKPOINTER│
 *    └─────────┘                           └───────────┘
 */

// ============================================
// BRAIN CORE - THE MASTER INTEGRATION LAYER
// ============================================
export {
    BrainCore,
    brainCore,
    BrainState,
    BrainDecision,
    BrainPhase,
    BrainAction,
    AgentTaskPackage
} from "./brain-core";

// ============================================
// THINKING ENGINE - DECISION MAKING
// ============================================
export {
    ThinkingEngine,
    thinkingEngine,
    ThinkingTrace,
    ThinkingResult,
    TaskAnalysis,
    SubTask,
    TaskStatus,
    ThinkingPhase
} from "./thinking-engine";

// ============================================
// CONTEXT MANAGER - WORKING MEMORY
// ============================================
export {
    ContextManager,
    contextManager,
    ContextWindow,
    AgentContext,
    ProjectContextData,
    MemoryEntry,
    ConversationSummary
} from "./context-manager";

// ============================================
// KNOWLEDGE BASE - LONG-TERM SEMANTIC MEMORY
// ============================================
export {
    KnowledgeBase,
    knowledgeBase,
    KnowledgeEntry,
    KnowledgeMetadata,
    KnowledgeType,
    SearchResult,
    KnowledgeQuery
} from "./knowledge-base";

// ============================================
// TASK MANAGER - GOAL TRACKING
// ============================================
export {
    TaskManager,
    taskManager,
    ManagedTask,
    CorrectionRecord,
    TaskExecutionPlan
} from "./task-manager";

// ============================================
// AGENT MONITOR - OBSERVATION
// ============================================
export {
    AgentMonitor,
    agentMonitor,
    AgentStatus,
    AgentExecutionRecord,
    MonitoringEvent,
    AgentExecutionStatus,
    AgentHealth,
    MonitoringEventType
} from "./agent-monitor";

// ============================================
// MCP HUB - INTER-AGENT COMMUNICATION
// ============================================
export {
    MCPCommunicationHub,
    mcpHub,
    MCPMessage,
    MCPMetadata,
    MCPMessageType,
    MCPHandler,
    MCPChannel
} from "./mcp-communication";

// ============================================
// REDIS CHECKPOINTER - STATE PERSISTENCE
// ============================================
export {
    RedisCheckpointer,
    redisCheckpointer,
    CheckpointData,
    CheckpointMetadata,
    RedisConfig
} from "./redis-checkpointer";

// ============================================
// HEALTH MONITOR - SYSTEM HEALTH
// ============================================
export {
    HealthMonitor,
    healthMonitor,
    SystemHealth,
    ComponentHealth,
    SystemMetrics,
    HealthAlert,
    HealthStatus,
    ComponentType
} from "./health-monitor";

// ============================================
// VECTOR STORE - SEMANTIC EMBEDDINGS
// ============================================
export {
    VectorStore,
    vectorStore,
    VectorEntry,
    VectorMetadata,
    SearchOptions,
    SimilarityResult
} from "./vector-store";
