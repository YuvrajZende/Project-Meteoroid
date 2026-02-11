/**
 * Unified Context Manager
 * Phase 1: Dependency Injection - Step 1.3
 *
 * Refactored to use dependency injection instead of singleton pattern.
 * Consolidates context management services:
 * - Conversation history
 * - Working memory
 * - Generation state
 * - Context persistence
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../../di/types.js';
import type {
    IContextManager,
    ConversationMessage,
    ContextWindow,
    ExtractedContextEntity,
    WorkingMemory,
    ContextArtifact,
    PersistentContext,
} from '../../../interfaces/context.interface.js';
import type { IProjectContextRepository } from '../../../repositories/project-context.repository.js';

/**
 * Generation State
 * Tracks the state of an active generation task
 */
export interface GenerationState {
    taskId: string;
    projectId: string;
    userId?: string;
    prompt: string;
    language: string;
    framework: string;
    entities: ExtractedContextEntity[];
    phase: 'analyzing' | 'generating' | 'validating' | 'complete' | 'failed';
    progress: number;
    filesGenerated: string[];
    errors: string[];
    startTime: Date;
    endTime?: Date;
}

/**
 * Context Manager Implementation
 *
 * Request-scoped service that manages conversation context, working memory,
 * and generation state for a single user/project session.
 */
@injectable()
export class ContextManager implements IContextManager {
    // Multi-tenant storage: key format is "userId:projectId"
    private contextWindows: Map<string, ContextWindow> = new Map();
    private workingMemories: Map<string, WorkingMemory> = new Map();
    private generationStates: Map<string, GenerationState> = new Map();
    private persistentContexts: Map<string, PersistentContext> = new Map();
    private initialized: boolean = false;

    constructor(
        @inject(TYPES.ProjectContextRepository) private projectContextRepo: IProjectContextRepository
    ) { }

    /**
     * Get the context key for multi-tenant storage
     */
    private getContextKey(projectId: string, userId: string): string {
        return `${userId}:${projectId}`;
    }

    /**
     * Get or create context window for specific project/user
     */
    private getContextWindow(projectId: string, userId: string): ContextWindow {
        const key = this.getContextKey(projectId, userId);
        if (!this.contextWindows.has(key)) {
            this.contextWindows.set(key, {
                messages: [],
                tokenCount: 0,
                maxTokens: 128000,
                entities: [],
                recentFiles: [],
            });
        }
        return this.contextWindows.get(key)!;
    }

    /**
     * Get or create working memory for specific project/user
     */
    private getWorkingMemoryObj(projectId: string, userId: string): WorkingMemory {
        const key = this.getContextKey(projectId, userId);
        if (!this.workingMemories.has(key)) {
            this.workingMemories.set(key, {
                currentTask: null,
                subtasks: [],
                completedSubtasks: [],
                decisions: [],
                artifacts: [],
            });
        }
        return this.workingMemories.get(key)!;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
    }

    // ============================================
    // IContextManager IMPLEMENTATION
    // ============================================

    async getContext(projectId: string, userId: string): Promise<ContextWindow> {
        const contextWindow = this.getContextWindow(projectId, userId);
        return { ...contextWindow };
    }

    async addMessage(projectId: string, userId: string, message: ConversationMessage): Promise<void> {
        const contextWindow = this.getContextWindow(projectId, userId);
        const fullMessage: ConversationMessage = {
            ...message,
            timestamp: message.timestamp || new Date(),
        };

        contextWindow.messages.push(fullMessage);
        contextWindow.tokenCount += this.estimateTokens(message.content);
        this.trimContext(contextWindow);
        this.extractEntities(message.content, contextWindow);
    }

    async clearContext(projectId: string, userId: string): Promise<void> {
        const key = this.getContextKey(projectId, userId);
        this.contextWindows.set(key, {
            messages: [],
            tokenCount: 0,
            maxTokens: 128000,
            entities: [],
            recentFiles: [],
        });
    }

    async getWorkingMemory(projectId: string, userId: string): Promise<WorkingMemory> {
        const workingMemory = this.getWorkingMemoryObj(projectId, userId);
        return { ...workingMemory };
    }

    async updateWorkingMemory(projectId: string, userId: string, updates: Partial<WorkingMemory>): Promise<void> {
        const workingMemory = this.getWorkingMemoryObj(projectId, userId);
        Object.assign(workingMemory, updates);
    }

    async addArtifact(projectId: string, userId: string, artifact: ContextArtifact): Promise<void> {
        const workingMemory = this.getWorkingMemoryObj(projectId, userId);
        const contextWindow = this.getContextWindow(projectId, userId);

        workingMemory.artifacts.push({
            ...artifact,
            id: artifact.id || `artifact-${Date.now()}`,
            timestamp: artifact.timestamp || new Date(),
        });

        if (!contextWindow.recentFiles.includes(artifact.path)) {
            contextWindow.recentFiles.unshift(artifact.path);
            contextWindow.recentFiles = contextWindow.recentFiles.slice(0, 20);
        }
    }

    async loadPersistentContext(userId: string, projectId: string): Promise<PersistentContext> {
        const key = `${userId}:${projectId}`;

        if (this.persistentContexts.has(key)) {
            return this.persistentContexts.get(key)!;
        }

        try {
            const context = await this.projectContextRepo.get(userId, projectId);
            if (context) {
                this.persistentContexts.set(key, context);
                return context;
            }
        } catch (error) {
            console.warn('[ContextManager] Failed to load persistent context:', error);
        }

        // Return default context if not found
        const defaultContext: PersistentContext = {
            userId,
            projectId,
            preferences: {},
            recentProjects: [],
            recentPrompts: [],
            techStackHistory: [],
            lastActive: new Date(),
        };
        this.persistentContexts.set(key, defaultContext);
        return defaultContext;
    }

    async savePersistentContext(context: PersistentContext): Promise<void> {
        const key = `${context.userId}:${context.projectId}`;
        context.lastActive = new Date();
        this.persistentContexts.set(key, context);

        try {
            await this.projectContextRepo.save(context);
        } catch (error) {
            console.warn('[ContextManager] Failed to save persistent context:', error);
        }
    }

    async getEntities(projectId: string, userId: string): Promise<ExtractedContextEntity[]> {
        const contextWindow = this.getContextWindow(projectId, userId);
        return [...contextWindow.entities];
    }

    async extractContext(projectId: string, userId: string, messages: ConversationMessage[]): Promise<ExtractedContextEntity[]> {
        const contextWindow = this.getContextWindow(projectId, userId);
        const _entities: ExtractedContextEntity[] = [];
        for (const message of messages) {
            this.extractEntities(message.content, contextWindow);
        }
        return [...contextWindow.entities];
    }

    // ============================================
    // HELPER METHODS (Backward Compatibility)
    // ============================================

    addMessageDirect(message: Omit<ConversationMessage, 'timestamp'>): void {
        // For backward compatibility, use a default context
        const contextWindow = this.getContextWindow('default', 'default');
        const fullMessage: ConversationMessage = {
            ...message,
            timestamp: new Date(),
        };

        contextWindow.messages.push(fullMessage);
        contextWindow.tokenCount += this.estimateTokens(message.content);
        this.trimContext(contextWindow);
        this.extractEntities(message.content, contextWindow);
    }

    getMessages(limit?: number): ConversationMessage[] {
        // For backward compatibility, use default context
        const contextWindow = this.getContextWindow('default', 'default');
        if (limit) {
            return contextWindow.messages.slice(-limit);
        }
        return [...contextWindow.messages];
    }

    getContextWindowDirect(): ContextWindow {
        // For backward compatibility, use default context
        return { ...this.getContextWindow('default', 'default') };
    }

    private trimContext(contextWindow: ContextWindow): void {
        while (contextWindow.tokenCount > contextWindow.maxTokens * 0.9) {
            const removed = contextWindow.messages.shift();
            if (removed) {
                contextWindow.tokenCount -= this.estimateTokens(removed.content);
            } else {
                break;
            }
        }
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    private extractEntities(content: string, contextWindow: ContextWindow): void {
        const languages = ['typescript', 'python', 'go', 'rust', 'java', 'javascript'];
        for (const lang of languages) {
            if (content.toLowerCase().includes(lang)) {
                this.addEntityDirect(entity => {
                    const exists = contextWindow.entities.some(
                        e => e.type === entity.type && e.name === entity.name
                    );
                    if (!exists) {
                        contextWindow.entities.push(entity);
                    }
                }, { type: 'language', name: lang, value: lang, source: 'inferred' });
            }
        }

        const frameworks = ['fastify', 'express', 'fastapi', 'django', 'gin', 'spring'];
        for (const fw of frameworks) {
            if (content.toLowerCase().includes(fw)) {
                this.addEntityDirect(entity => {
                    const exists = contextWindow.entities.some(
                        e => e.type === entity.type && e.name === entity.name
                    );
                    if (!exists) {
                        contextWindow.entities.push(entity);
                    }
                }, { type: 'framework', name: fw, value: fw, source: 'inferred' });
            }
        }
    }

    addEntityDirect(
        addFn: (entity: ExtractedContextEntity) => void,
        entity: ExtractedContextEntity
    ): void {
        addFn(entity);
    }

    getEntitiesDirect(type?: string): ExtractedContextEntity[] {
        // For backward compatibility, use default context
        const contextWindow = this.getContextWindow('default', 'default');
        if (type) {
            return contextWindow.entities.filter(e => e.type === type);
        }
        return [...contextWindow.entities];
    }

    setCurrentTask(task: string): void {
        // For backward compatibility, use default context
        const workingMemory = this.getWorkingMemoryObj('default', 'default');
        workingMemory.currentTask = task;
    }

    addSubtask(subtask: string): void {
        // For backward compatibility, use default context
        const workingMemory = this.getWorkingMemoryObj('default', 'default');
        workingMemory.subtasks.push(subtask);
    }

    completeSubtask(subtask: string): void {
        // For backward compatibility, use default context
        const workingMemory = this.getWorkingMemoryObj('default', 'default');
        const index = workingMemory.subtasks.indexOf(subtask);
        if (index > -1) {
            workingMemory.subtasks.splice(index, 1);
            workingMemory.completedSubtasks.push(subtask);
        }
    }

    addArtifactDirect(artifact: Omit<ContextArtifact, 'id' | 'timestamp'>): void {
        // For backward compatibility, use default context
        const workingMemory = this.getWorkingMemoryObj('default', 'default');
        const contextWindow = this.getContextWindow('default', 'default');

        workingMemory.artifacts.push({
            ...artifact,
            id: `artifact-${Date.now()}`,
            timestamp: new Date(),
        });

        if (!contextWindow.recentFiles.includes(artifact.path)) {
            contextWindow.recentFiles.unshift(artifact.path);
            contextWindow.recentFiles = contextWindow.recentFiles.slice(0, 20);
        }
    }

    getWorkingMemoryDirect(): WorkingMemory {
        // For backward compatibility, use default context
        return { ...this.getWorkingMemoryObj('default', 'default') };
    }

    // ============================================
    // GENERATION STATE
    // ============================================

    startGeneration(state: Omit<GenerationState, 'startTime' | 'phase' | 'progress' | 'filesGenerated' | 'errors'>): string {
        const fullState: GenerationState = {
            ...state,
            phase: 'analyzing',
            progress: 0,
            filesGenerated: [],
            errors: [],
            startTime: new Date(),
        };

        this.generationStates.set(state.taskId, fullState);
        return state.taskId;
    }

    updateGeneration(taskId: string, updates: Partial<GenerationState>): void {
        const state = this.generationStates.get(taskId);
        if (state) {
            Object.assign(state, updates);
        }
    }

    completeGeneration(taskId: string, filesGenerated: string[]): void {
        const state = this.generationStates.get(taskId);
        if (state) {
            state.phase = 'complete';
            state.progress = 100;
            state.filesGenerated = filesGenerated;
            state.endTime = new Date();
        }
    }

    getGenerationState(taskId: string): GenerationState | undefined {
        return this.generationStates.get(taskId);
    }

    // ============================================
    // CONTEXT BUILDING
    // ============================================

    buildPromptContext(projectId?: string, userId?: string): string {
        // Use provided context or fall back to default
        const contextWindow = projectId && userId
            ? this.getContextWindow(projectId, userId)
            : this.getContextWindow('default', 'default');
        const workingMemory = projectId && userId
            ? this.getWorkingMemoryObj(projectId, userId)
            : this.getWorkingMemoryObj('default', 'default');

        let context = '';

        const recentMessages = contextWindow.messages.slice(-5);
        if (recentMessages.length > 0) {
            context += '## Recent Conversation:\n';
            for (const msg of recentMessages) {
                context += `${msg.role}: ${msg.content.slice(0, 200)}...\n`;
            }
            context += '\n';
        }

        if (contextWindow.entities.length > 0) {
            context += '## Detected Context:\n';
            for (const entity of contextWindow.entities) {
                context += `- ${entity.type}: ${entity.name}\n`;
            }
            context += '\n';
        }

        if (workingMemory.currentTask) {
            context += `## Current Task:\n${workingMemory.currentTask}\n\n`;
        }

        return context;
    }

    getStatus(): {
        initialized: boolean;
        totalContexts: number;
        defaultContext: {
            messageCount: number;
            tokenCount: number;
            entityCount: number;
        };
    } {
        const defaultContext = this.getContextWindow('default', 'default');
        return {
            initialized: this.initialized,
            totalContexts: this.contextWindows.size,
            defaultContext: {
                messageCount: defaultContext.messages.length,
                tokenCount: defaultContext.tokenCount,
                entityCount: defaultContext.entities.length,
            },
        };
    }
}

// ============================================
// BACKWARD COMPATIBILITY
// ============================================
// These will be removed once all code is migrated to DI

let contextManagerInstance: ContextManager | null = null;

/**
 * @deprecated Use DI container instead. Call getDIContainer().get(TYPES.ContextManager)
 */
export function getContextManager(): ContextManager {
    if (!contextManagerInstance) {
        // For now, create a simple instance without dependencies
        // This will be removed once DI is fully implemented
        contextManagerInstance = new ContextManager(
            null as any // Temporary: database dependency
        );
    }
    return contextManagerInstance;
}

/**
 * @deprecated Use DI container instead
 */
export function createContextManager(): ContextManager {
    return new ContextManager(
        null as any // Temporary: database dependency
    );
}
