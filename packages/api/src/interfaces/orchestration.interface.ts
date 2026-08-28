/**
 * Orchestration Service Interface
 *
 * Defines the contract for the main orchestration service that coordinates
 * planning, generation, and validation phases.
 */

export interface OrchestrationInput {
    taskId?: string;
    projectId: string;
    userId?: string;
    prompt: string;
    context?: GenerationContext;
    priority?: 'low' | 'medium' | 'high';
}

export interface GenerationContext {
    language?: string;
    framework?: string;
    database?: string;
    authProvider?: string;
    features?: string[];
    techStack?: string[];
}

export interface OrchestrationResult {
    success: boolean;
    taskId: string;
    files?: GeneratedFile[];
    subtasks?: GenerationResult[];
    warnings?: string[];
    errors?: string[];
    duration?: number;
    metadata?: Record<string, unknown>;
}

export interface GeneratedFile {
    path: string;
    content: string;
    language: string;
    type: 'code' | 'config' | 'test' | 'doc';
}

export interface GenerationResult {
    subtask: string;
    code: string;
    files: GeneratedFile[];
    explanation: string;
    success: boolean;
    errors: string[];
    duration: number;
}

export interface OrchestrationStep {
    phase: 'validation' | 'planning' | 'generation' | 'persistence' | 'complete';
    step: string;
    message: string;
    progress: number;
    metadata?: Record<string, unknown>;
}

export interface OrchestratorStatus {
    activeTasks: number;
    totalTasks: number;
    uptime: number;
}

export interface ProgressCallback {
    (step: OrchestrationStep): void;
}

/**
 * Main orchestrator interface
 * All orchestrator implementations must implement this
 */
export interface IOrchestrator {
    /**
     * Main orchestration method
     * @param input - Orchestration input with user prompt and context
     * @param onProgress - Optional callback for progress updates
     * @returns Orchestration result with generated files
     */
    orchestrate(
        input: OrchestrationInput,
        onProgress?: ProgressCallback
    ): Promise<OrchestrationResult>;

    /**
     * Get current orchestrator status
     */
    getStatus(): OrchestratorStatus;

    /**
     * Cancel a running orchestration
     * @param taskId - Task ID to cancel
     */
    cancel(taskId: string): Promise<void>;
}
