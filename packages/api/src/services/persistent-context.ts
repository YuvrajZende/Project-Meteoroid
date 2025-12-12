/**
 * Persistent Context Manager
 * 
 * Wraps the in-memory ContextManagerService with Supabase persistence.
 * Stores conversation history and project context in the database.
 * 
 * Usage:
 * - If Supabase is configured: Persists to database
 * - If not configured: Falls back to in-memory storage (graceful degradation)
 */

import {
    ContextManagerService,
    type ContextWindow,
    type MemoryEntry,
    type ProjectContext,
    getContextManager,
} from './core-services.js';

// ============================================
// TYPES
// ============================================

export interface PersistedContext {
    id?: string;
    project_id: string;
    user_id: string;
    conversation_history: MemoryEntry[];
    project_context: ProjectContext;
    created_at?: string;
    updated_at?: string;
}

export interface PersistenceConfig {
    enabled: boolean;
    autoSave: boolean;
    saveIntervalMs: number;
}

// ============================================
// PERSISTENT CONTEXT MANAGER
// ============================================

export class PersistentContextManager {
    private inMemoryManager: ContextManagerService;
    private config: PersistenceConfig;
    private pendingSaves: Map<string, NodeJS.Timeout> = new Map();
    private supabaseAvailable = false;

    constructor(config?: Partial<PersistenceConfig>) {
        this.config = {
            enabled: config?.enabled ?? true,
            autoSave: config?.autoSave ?? true,
            saveIntervalMs: config?.saveIntervalMs ?? 5000, // Save every 5 seconds
        };

        this.inMemoryManager = getContextManager();
        this.checkSupabaseAvailability();
    }

    /**
     * Check if Supabase is configured and available
     */
    private checkSupabaseAvailability(): void {
        const hasSupabase = !!(
            process.env.SUPABASE_URL &&
            process.env.SUPABASE_ANON_KEY
        );
        this.supabaseAvailable = hasSupabase;

        if (hasSupabase) {
            console.log('[PERSISTENT-CONTEXT] Supabase configured - persistence ENABLED');
        } else {
            console.log('[PERSISTENT-CONTEXT] Supabase not configured - using in-memory storage');
        }
    }

    /**
     * Get or create context for a project
     * Loads from Supabase if available and not in cache
     */
    async getContext(projectId: string, userId: string): Promise<ContextWindow> {
        // First check in-memory
        const key = `${projectId}:${userId}`;
        let context = this.inMemoryManager.getContext(projectId, userId);

        // If Supabase is available and context is new (empty history), try to load from DB
        if (this.supabaseAvailable && this.config.enabled && context.conversationHistory.length === 0) {
            try {
                const persisted = await this.loadFromSupabase(projectId, userId);
                if (persisted) {
                    // Restore from database
                    context.conversationHistory = persisted.conversation_history || [];
                    Object.assign(context.projectContext, persisted.project_context || {});
                    console.log(`[PERSISTENT-CONTEXT] Loaded context for ${key} from database`);
                }
            } catch (error) {
                console.warn(`[PERSISTENT-CONTEXT] Failed to load from Supabase: ${error}`);
            }
        }

        return context;
    }

    /**
     * Add memory entry with auto-save
     */
    async addMemory(
        projectId: string,
        userId: string,
        entry: Omit<MemoryEntry, 'timestamp'>
    ): Promise<void> {
        // Add to in-memory first
        this.inMemoryManager.addMemory(projectId, userId, entry);

        // Schedule persistence
        if (this.supabaseAvailable && this.config.autoSave) {
            this.scheduleSave(projectId, userId);
        }
    }

    /**
     * Add generated file with auto-save
     */
    async addGeneratedFile(projectId: string, userId: string, filePath: string): Promise<void> {
        this.inMemoryManager.addGeneratedFile(projectId, userId, filePath);

        if (this.supabaseAvailable && this.config.autoSave) {
            this.scheduleSave(projectId, userId);
        }
    }

    /**
     * Update project context with auto-save
     */
    async updateProjectContext(
        projectId: string,
        userId: string,
        updates: Partial<ProjectContext>
    ): Promise<void> {
        this.inMemoryManager.updateProjectContext(projectId, userId, updates);

        if (this.supabaseAvailable && this.config.autoSave) {
            this.scheduleSave(projectId, userId);
        }
    }

    /**
     * Manually save context to Supabase
     */
    async saveContext(projectId: string, userId: string): Promise<boolean> {
        if (!this.supabaseAvailable) {
            console.log('[PERSISTENT-CONTEXT] Supabase not available, skipping save');
            return false;
        }

        try {
            const context = this.inMemoryManager.getContext(projectId, userId);
            await this.saveToSupabase(projectId, userId, context);
            console.log(`[PERSISTENT-CONTEXT] Saved context for ${projectId}:${userId}`);
            return true;
        } catch (error) {
            console.error(`[PERSISTENT-CONTEXT] Failed to save: ${error}`);
            return false;
        }
    }

    /**
     * Clear context from memory and optionally from database
     */
    async clearContext(projectId: string, userId: string, deleteFromDb = false): Promise<void> {
        const key = `${projectId}:${userId}`;

        // Cancel pending save
        const existing = this.pendingSaves.get(key);
        if (existing) {
            clearTimeout(existing);
            this.pendingSaves.delete(key);
        }

        // Clear in-memory
        this.inMemoryManager.clearContext(projectId, userId);

        // Delete from DB if requested
        if (deleteFromDb && this.supabaseAvailable) {
            try {
                await this.deleteFromSupabase(projectId, userId);
                console.log(`[PERSISTENT-CONTEXT] Deleted context for ${key} from database`);
            } catch (error) {
                console.warn(`[PERSISTENT-CONTEXT] Failed to delete from Supabase: ${error}`);
            }
        }
    }

    /**
     * Schedule a save operation (debounced)
     */
    private scheduleSave(projectId: string, userId: string): void {
        const key = `${projectId}:${userId}`;

        // Cancel existing timer
        const existing = this.pendingSaves.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        // Schedule new save
        const timer = setTimeout(() => {
            this.saveContext(projectId, userId);
            this.pendingSaves.delete(key);
        }, this.config.saveIntervalMs);

        this.pendingSaves.set(key, timer);
    }

    /**
     * Load context from Supabase
     */
    private async loadFromSupabase(projectId: string, userId: string): Promise<PersistedContext | null> {
        const supabase = this.getSupabaseClient();
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .from('project_contexts')
                .select('*')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null; // Not found
                throw error;
            }

            return data as PersistedContext;
        } catch (error) {
            console.warn(`[PERSISTENT-CONTEXT] Load failed: ${error}`);
            return null;
        }
    }

    /**
     * Save context to Supabase
     */
    private async saveToSupabase(projectId: string, userId: string, context: ContextWindow): Promise<void> {
        const supabase = this.getSupabaseClient();
        if (!supabase) {
            console.warn('[PERSISTENT-CONTEXT] Supabase client not available');
            return;
        }

        const data: PersistedContext = {
            project_id: projectId,
            user_id: userId,
            conversation_history: context.conversationHistory,
            project_context: context.projectContext,
        };

        // Upsert: insert or update
        const { error } = await supabase
            .from('project_contexts')
            .upsert(data, {
                onConflict: 'project_id,user_id',
                ignoreDuplicates: false
            });

        if (error) {
            throw error;
        }
    }

    /**
     * Delete context from Supabase
     */
    private async deleteFromSupabase(projectId: string, userId: string): Promise<void> {
        const supabase = this.getSupabaseClient();
        if (!supabase) return;

        const { error } = await supabase
            .from('project_contexts')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) {
            throw error;
        }
    }

    /**
     * Get Supabase client (lazy-loaded)
     */
    private getSupabaseClient() {
        if (!this.supabaseAvailable) return null;

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!url || !key) return null;

        // Lazy import to avoid breaking if @supabase/supabase-js isn't installed
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { createClient } = require('@supabase/supabase-js');
            return createClient(url, key);
        } catch {
            console.warn('[PERSISTENT-CONTEXT] @supabase/supabase-js not installed');
            return null;
        }
    }

    /**
     * Get persistence status
     */
    getStatus(): { supabaseAvailable: boolean; pendingSaves: number; config: PersistenceConfig } {
        return {
            supabaseAvailable: this.supabaseAvailable,
            pendingSaves: this.pendingSaves.size,
            config: this.config,
        };
    }

    /**
     * Flush all pending saves
     */
    async flushAll(): Promise<void> {
        const saves = Array.from(this.pendingSaves.keys()).map(key => {
            const [projectId, userId] = key.split(':');
            return this.saveContext(projectId, userId);
        });

        await Promise.all(saves);
        this.pendingSaves.clear();
    }
}

// ============================================
// SINGLETON
// ============================================

let persistentContextInstance: PersistentContextManager | null = null;

export function getPersistentContext(): PersistentContextManager {
    if (!persistentContextInstance) {
        persistentContextInstance = new PersistentContextManager();
    }
    return persistentContextInstance;
}

export function createPersistentContext(config?: Partial<PersistenceConfig>): PersistentContextManager {
    persistentContextInstance = new PersistentContextManager(config);
    return persistentContextInstance;
}
