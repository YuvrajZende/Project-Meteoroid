/**
 * IAgent Interface
 * The core contract that ALL agents must implement
 * This enables the plug-and-play architecture
 */

/**
 * Agent tier levels - determines priority and capabilities
 */
export type AgentTier = 1 | 2 | 3;

/**
 * Configuration passed to agent during initialization
 */
export interface AgentConfig {
    /** AI model to use (e.g., 'gpt-4', 'claude-3') */
    modelName?: string;

    /** Temperature for AI generation (0-2) */
    temperature?: number;

    /** Maximum tokens for response */
    maxTokens?: number;

    /** Custom agent-specific settings */
    customSettings?: Record<string, unknown>;

    /** API keys (injected by orchestrator) */
    apiKeys?: {
        openai?: string;
        anthropic?: string;
        zai?: string;
    };
}

/**
 * Input provided to agent for task execution
 */
export interface AgentInput {
    /** The task description or prompt */
    task: string;

    /** Task priority (1-10, higher = more important) */
    priority?: number;

    /** Additional context for the task */
    context?: Record<string, unknown>;

    /** Outputs from previously executed agents in the chain */
    previousOutputs?: AgentOutput[];

    /** User ID making the request */
    userId?: string;

    /** Project ID if applicable */
    projectId?: string;

    /** Unique request/task ID for tracing */
    requestId?: string;
}

/**
 * Generated file structure
 */
export interface GeneratedFile {
    /** Relative path where the file should be created */
    path: string;

    /** File content */
    content: string;

    /** File type classification */
    type: 'code' | 'config' | 'doc' | 'asset';

    /** Programming language if applicable */
    language?: string;
}

/**
 * Output returned by agent after execution
 */
export interface AgentOutput {
    /** Whether the task completed successfully */
    success: boolean;

    /** Generated files (if any) */
    files?: GeneratedFile[];

    /** Human-readable message about the result */
    message?: string;

    /** Error details if success is false */
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };

    /** Additional metadata about the execution */
    metadata?: {
        /** Time taken to execute (ms) */
        executionTime?: number;

        /** Tokens used (for AI-based agents) */
        tokensUsed?: {
            prompt: number;
            completion: number;
            total: number;
        };

        /** Model used */
        model?: string;

        /** Any other relevant metadata */
        [key: string]: unknown;
    };

    /** Suggested next agents to run */
    suggestedNextAgents?: string[];
}

/**
 * Agent health status
 */
export interface AgentHealthStatus {
    /** Whether the agent is healthy */
    healthy: boolean;

    /** Status message */
    message?: string;

    /** Last successful execution timestamp */
    lastSuccessfulExecution?: Date;

    /** Additional health details */
    details?: Record<string, unknown>;
}

/**
 * IAgent Interface
 * The core contract that all agents MUST implement
 */
export interface IAgent {
    /** Unique identifier for the agent (e.g., 'auth-agent', 'security-agent') */
    readonly id: string;

    /** Human-readable name (e.g., 'Authentication Agent') */
    readonly name: string;

    /** Agent tier: 1 (Core), 2 (Specialized), 3 (Support) */
    readonly tier: AgentTier;

    /** List of capabilities this agent provides */
    readonly capabilities: string[];

    /** Optional description of what this agent does */
    readonly description?: string;

    /** Optional version string */
    readonly version?: string;

    /**
     * Initialize the agent with configuration
     * Called once when the agent is loaded by the orchestrator
     */
    initialize(config: AgentConfig): Promise<void>;

    /**
     * Execute a task and return the result
     * This is the main entry point for agent functionality
     */
    execute(input: AgentInput): Promise<AgentOutput>;

    /**
     * Health check for the agent
     * Used by the orchestrator to verify agent status
     */
    healthCheck(): Promise<AgentHealthStatus>;

    /**
     * Optional cleanup/shutdown method
     * Called when the orchestrator is shutting down
     */
    shutdown?(): Promise<void>;
}

/**
 * Agent metadata for registration
 */
export interface AgentMetadata {
    id: string;
    name: string;
    tier: AgentTier;
    capabilities: string[];
    description?: string;
    version?: string;
    path: string;
    loadedAt: Date;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'uninitialized';
}

/**
 * Type guard to check if an object implements IAgent
 */
export function isValidAgent(obj: unknown): obj is IAgent {
    if (!obj || typeof obj !== 'object') return false;

    const agent = obj as Partial<IAgent>;

    return (
        typeof agent.id === 'string' &&
        typeof agent.name === 'string' &&
        typeof agent.tier === 'number' &&
        [1, 2, 3].includes(agent.tier) &&
        Array.isArray(agent.capabilities) &&
        typeof agent.initialize === 'function' &&
        typeof agent.execute === 'function' &&
        typeof agent.healthCheck === 'function'
    );
}
