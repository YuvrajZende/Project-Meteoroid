/**
 * Context Manager Interface
 *
 * Defines the contract for managing context windows, conversation history,
 * and working memory across orchestration sessions.
 */

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

export interface ContextWindow {
    messages: ConversationMessage[];
    tokenCount: number;
    maxTokens: number;
    entities: ExtractedContextEntity[];
    recentFiles: string[];
}

export interface ExtractedContextEntity {
    type: string;
    name: string;
    value: string;
    source: 'user' | 'system' | 'inferred';
}

export interface WorkingMemory {
    currentTask: string | null;
    subtasks: string[];
    completedSubtasks: string[];
    decisions: ContextDecision[];
    artifacts: ContextArtifact[];
}

export interface ContextDecision {
    id: string;
    description: string;
    reasoning: string;
    timestamp: Date;
}

export interface ContextArtifact {
    id: string;
    type: 'code' | 'config' | 'doc' | 'schema';
    path: string;
    summary: string;
    timestamp: Date;
}

export interface PersistentContext {
    userId: string;
    projectId: string;
    preferences: Record<string, unknown>;
    recentProjects: string[];
    recentPrompts: string[];
    techStackHistory: string[];
    lastActive: Date;
}

/**
 * Context Manager interface
 * Manages conversation context and working memory
 */
export interface IContextManager {
    /**
     * Get the context window for a project/user
     */
    getContext(projectId: string, userId: string): Promise<ContextWindow>;

    /**
     * Add a message to the conversation context
     */
    addMessage(projectId: string, userId: string, message: ConversationMessage): Promise<void>;

    /**
     * Clear context for a project/user
     */
    clearContext(projectId: string, userId: string): Promise<void>;

    /**
     * Get working memory
     */
    getWorkingMemory(projectId: string, userId: string): Promise<WorkingMemory>;

    /**
     * Update working memory
     */
    updateWorkingMemory(projectId: string, userId: string, updates: Partial<WorkingMemory>): Promise<void>;

    /**
     * Add an artifact to context
     */
    addArtifact(projectId: string, userId: string, artifact: ContextArtifact): Promise<void>;

    /**
     * Load persistent context
     */
    loadPersistentContext(userId: string, projectId: string): Promise<PersistentContext>;

    /**
     * Save persistent context
     */
    savePersistentContext(context: PersistentContext): Promise<void>;

    /**
     * Get entities from context
     */
    getEntities(projectId: string, userId: string): Promise<ExtractedContextEntity[]>;

    /**
     * Extract context from messages
     */
    extractContext(projectId: string, userId: string, messages: ConversationMessage[]): Promise<ExtractedContextEntity[]>;
}
