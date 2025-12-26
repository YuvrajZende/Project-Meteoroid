/**
 * Unified Context Manager
 * Phase 27: Production-Ready Architecture
 * 
 * Consolidates context management services:
 * - Conversation history
 * - Working memory
 * - Generation state
 * - Context persistence
 */

import { getSupabaseAdmin } from '../infrastructure/database-client.js';

// ============================================
// TYPES
// ============================================

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

export interface PersistentContext {
    userId: string;
    projectId: string;
    preferences: Record<string, unknown>;
    recentProjects: string[];
    recentPrompts: string[];
    techStackHistory: string[];
    lastActive: Date;
}

// ============================================
// CONTEXT MANAGER
// ============================================

export class ContextManager {
    private contextWindow: ContextWindow;
    private workingMemory: WorkingMemory;
    private generationStates: Map<string, GenerationState> = new Map();
    private persistentContexts: Map<string, PersistentContext> = new Map();
    private initialized: boolean = false;

    constructor() {
        this.contextWindow = {
            messages: [],
            tokenCount: 0,
            maxTokens: 128000,
            entities: [],
            recentFiles: [],
        };

        this.workingMemory = {
            currentTask: null,
            subtasks: [],
            completedSubtasks: [],
            decisions: [],
            artifacts: [],
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;
    }

    // Conversation Context
    addMessage(message: Omit<ConversationMessage, 'timestamp'>): void {
        const fullMessage: ConversationMessage = {
            ...message,
            timestamp: new Date(),
        };

        this.contextWindow.messages.push(fullMessage);
        this.contextWindow.tokenCount += this.estimateTokens(message.content);
        this.trimContext();
        this.extractEntities(message.content);
    }

    getMessages(limit?: number): ConversationMessage[] {
        if (limit) {
            return this.contextWindow.messages.slice(-limit);
        }
        return [...this.contextWindow.messages];
    }

    getContextWindow(): ContextWindow {
        return { ...this.contextWindow };
    }

    private trimContext(): void {
        while (this.contextWindow.tokenCount > this.contextWindow.maxTokens * 0.9) {
            const removed = this.contextWindow.messages.shift();
            if (removed) {
                this.contextWindow.tokenCount -= this.estimateTokens(removed.content);
            } else {
                break;
            }
        }
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    private extractEntities(content: string): void {
        const languages = ['typescript', 'python', 'go', 'rust', 'java', 'javascript'];
        for (const lang of languages) {
            if (content.toLowerCase().includes(lang)) {
                this.addEntity({ type: 'language', name: lang, value: lang, source: 'inferred' });
            }
        }

        const frameworks = ['fastify', 'express', 'fastapi', 'django', 'gin', 'spring'];
        for (const fw of frameworks) {
            if (content.toLowerCase().includes(fw)) {
                this.addEntity({ type: 'framework', name: fw, value: fw, source: 'inferred' });
            }
        }
    }

    addEntity(entity: ExtractedContextEntity): void {
        const exists = this.contextWindow.entities.some(
            e => e.type === entity.type && e.name === entity.name
        );
        if (!exists) {
            this.contextWindow.entities.push(entity);
        }
    }

    getEntities(type?: string): ExtractedContextEntity[] {
        if (type) {
            return this.contextWindow.entities.filter(e => e.type === type);
        }
        return [...this.contextWindow.entities];
    }

    // Working Memory
    setCurrentTask(task: string): void {
        this.workingMemory.currentTask = task;
    }

    addSubtask(subtask: string): void {
        this.workingMemory.subtasks.push(subtask);
    }

    completeSubtask(subtask: string): void {
        const index = this.workingMemory.subtasks.indexOf(subtask);
        if (index > -1) {
            this.workingMemory.subtasks.splice(index, 1);
            this.workingMemory.completedSubtasks.push(subtask);
        }
    }

    addArtifact(artifact: Omit<ContextArtifact, 'id' | 'timestamp'>): void {
        this.workingMemory.artifacts.push({
            ...artifact,
            id: `artifact-${Date.now()}`,
            timestamp: new Date(),
        });

        if (!this.contextWindow.recentFiles.includes(artifact.path)) {
            this.contextWindow.recentFiles.unshift(artifact.path);
            this.contextWindow.recentFiles = this.contextWindow.recentFiles.slice(0, 20);
        }
    }

    getWorkingMemory(): WorkingMemory {
        return { ...this.workingMemory };
    }

    // Generation State
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

    // Persistent Context
    async loadPersistentContext(userId: string, projectId: string): Promise<PersistentContext> {
        const key = `${userId}:${projectId}`;

        if (this.persistentContexts.has(key)) {
            return this.persistentContexts.get(key)!;
        }

        try {
            const supabase = getSupabaseAdmin();
            const { data, error } = await supabase
                .from('project_contexts')
                .select('*')
                .eq('user_id', userId)
                .eq('project_id', projectId)
                .single();

            if (data && !error) {
                const context: PersistentContext = {
                    userId: data.user_id,
                    projectId: data.project_id,
                    preferences: data.preferences || {},
                    recentProjects: data.recent_projects || [],
                    recentPrompts: data.recent_prompts || [],
                    techStackHistory: data.tech_stack_history || [],
                    lastActive: new Date(data.last_active),
                };
                this.persistentContexts.set(key, context);
                return context;
            }
        } catch {
            // Database not available
        }

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
            const supabase = getSupabaseAdmin();
            await supabase
                .from('project_contexts')
                .upsert({
                    user_id: context.userId,
                    project_id: context.projectId,
                    preferences: context.preferences,
                    recent_projects: context.recentProjects,
                    recent_prompts: context.recentPrompts,
                    tech_stack_history: context.techStackHistory,
                    last_active: context.lastActive,
                });
        } catch {
            // Database save failed
        }
    }

    // Context Building
    buildPromptContext(): string {
        let context = '';

        const recentMessages = this.getMessages(5);
        if (recentMessages.length > 0) {
            context += '## Recent Conversation:\n';
            for (const msg of recentMessages) {
                context += `${msg.role}: ${msg.content.slice(0, 200)}...\n`;
            }
            context += '\n';
        }

        if (this.contextWindow.entities.length > 0) {
            context += '## Detected Context:\n';
            for (const entity of this.contextWindow.entities) {
                context += `- ${entity.type}: ${entity.name}\n`;
            }
            context += '\n';
        }

        if (this.workingMemory.currentTask) {
            context += `## Current Task:\n${this.workingMemory.currentTask}\n\n`;
        }

        return context;
    }

    getStatus(): {
        initialized: boolean;
        messageCount: number;
        tokenCount: number;
        entityCount: number;
    } {
        return {
            initialized: this.initialized,
            messageCount: this.contextWindow.messages.length,
            tokenCount: this.contextWindow.tokenCount,
            entityCount: this.contextWindow.entities.length,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let contextManagerInstance: ContextManager | null = null;

export function getContextManager(): ContextManager {
    if (!contextManagerInstance) {
        contextManagerInstance = new ContextManager();
    }
    return contextManagerInstance;
}

export function createContextManager(): ContextManager {
    return new ContextManager();
}
