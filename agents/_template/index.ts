/**
 * Agent Template
 * 
 * This is a template/boilerplate for creating new agents.
 * Copy this directory and modify for your agent implementation.
 * 
 * INSTRUCTIONS:
 * 1. Copy this entire `_template` folder to your agent location
 *    e.g., `agents/core/database/` or `agents/specialized/cicd/`
 * 
 * 2. Rename and implement the agent class
 * 
 * 3. The orchestrator will automatically discover and load your agent
 *    when the server starts
 * 
 * REQUIREMENTS:
 * - Your agent MUST implement the IAgent interface
 * - Export the agent class as default or named export
 * - The agent must pass validation (isValidAgent check)
 */

import type {
    IAgent,
    AgentConfig,
    AgentInput,
    AgentOutput,
    AgentHealthStatus,
    AgentTier,
} from '@loveable/shared';

/**
 * Template Agent
 * Replace this with your actual agent implementation
 */
export class TemplateAgent implements IAgent {
    // ========================================
    // REQUIRED: Agent Identity
    // ========================================

    /** Unique ID - use kebab-case (e.g., 'database-agent') */
    public readonly id = 'template-agent';

    /** Human-readable name */
    public readonly name = 'Template Agent';

    /** 
     * Agent tier:
     * - 1 = Core (auth, security, monitoring, database, api, queue)
     * - 2 = Specialized (cicd, infra, microservice)
     * - 3 = Support (test, codegen, email)
     */
    public readonly tier: AgentTier = 3;

    /**
     * List of capabilities this agent provides
     * Used by orchestrator to route tasks
     */
    public readonly capabilities: string[] = [
        'template-capability',
        'example-task',
    ];

    // ========================================
    // OPTIONAL: Additional metadata
    // ========================================

    public readonly description = 'A template agent for demonstration';
    public readonly version = '1.0.0';

    // ========================================
    // PRIVATE: Internal state
    // ========================================

    private initialized = false;
    private config: AgentConfig = {};

    // ========================================
    // REQUIRED: IAgent Methods
    // ========================================

    /**
     * Initialize the agent
     * Called once when the orchestrator loads the agent
     */
    async initialize(config: AgentConfig): Promise<void> {
        console.log(`[${this.name}] Initializing...`);

        this.config = config;

        // TODO: Add your initialization logic here
        // - Connect to external services
        // - Load models or resources
        // - Validate configuration

        this.initialized = true;
        console.log(`[${this.name}] Initialized successfully`);
    }

    /**
     * Execute a task
     * This is the main entry point for agent functionality
     */
    async execute(input: AgentInput): Promise<AgentOutput> {
        if (!this.initialized) {
            return {
                success: false,
                error: {
                    code: 'NOT_INITIALIZED',
                    message: 'Agent has not been initialized',
                },
            };
        }

        const startTime = Date.now();

        try {
            console.log(`[${this.name}] Executing task: ${input.task}`);

            // TODO: Implement your agent logic here
            // This is where the magic happens!

            // Example response
            const executionTime = Date.now() - startTime;

            return {
                success: true,
                message: `Task completed: ${input.task}`,
                files: [
                    // {
                    //   path: 'example/file.ts',
                    //   content: '// Generated content',
                    //   type: 'code',
                    //   language: 'typescript',
                    // },
                ],
                metadata: {
                    executionTime,
                    model: this.config.modelName || 'none',
                },
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                success: false,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: errorMessage,
                    details: error,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                },
            };
        }
    }

    /**
     * Health check
     * Returns the current health status of the agent
     */
    async healthCheck(): Promise<AgentHealthStatus> {
        return {
            healthy: this.initialized,
            message: this.initialized
                ? 'Agent is healthy and ready'
                : 'Agent not initialized',
            details: {
                version: this.version,
                capabilities: this.capabilities,
            },
        };
    }

    /**
     * Shutdown (optional)
     * Clean up resources when the server is stopping
     */
    async shutdown(): Promise<void> {
        console.log(`[${this.name}] Shutting down...`);

        // TODO: Add cleanup logic here
        // - Close connections
        // - Release resources

        this.initialized = false;
    }
}

// Export the agent (can be default or named export)
export default new TemplateAgent();
