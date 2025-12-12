/**
 * Tasks Service
 * Database operations for the tasks table (job queue metadata)
 */

import { getSupabaseAdmin } from '../client.js';

/**
 * Task status enum
 */
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Task entity
 */
export interface Task {
    id: string;
    user_id: string;
    project_id: string | null;
    prompt: string;
    status: TaskStatus;
    progress: number;
    result: Record<string, unknown> | null;
    error: string | null;
    agents_used: string[];
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

/**
 * Task insert DTO
 */
export interface TaskInsert {
    user_id: string;
    project_id?: string | null;
    prompt: string;
    status?: TaskStatus;
}

/**
 * Task update DTO
 */
export interface TaskUpdate {
    status?: TaskStatus;
    progress?: number;
    result?: Record<string, unknown> | null;
    error?: string | null;
    agents_used?: string[];
    started_at?: string | null;
    completed_at?: string | null;
}

/**
 * TasksService - CRUD operations for tasks
 */
export class TasksService {
    private supabase = getSupabaseAdmin();

    /**
     * Get task by ID
     */
    async getById(id: string): Promise<Task | null> {
        const { data, error } = await this.supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to get task: ${error.message}`);
        }

        return data as Task;
    }

    /**
     * Get all tasks for a user
     */
    async getByUserId(userId: string, options?: {
        status?: TaskStatus;
        limit?: number;
        offset?: number;
    }): Promise<{ tasks: Task[]; total: number }> {
        let query = this.supabase
            .from('tasks')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (options?.status) {
            query = query.eq('status', options.status);
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        const { data, error, count } = await query;

        if (error) {
            throw new Error(`Failed to get tasks: ${error.message}`);
        }

        return {
            tasks: (data || []) as Task[],
            total: count || 0,
        };
    }

    /**
     * Get tasks by project ID
     */
    async getByProjectId(projectId: string): Promise<Task[]> {
        const { data, error } = await this.supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to get tasks: ${error.message}`);
        }

        return (data || []) as Task[];
    }

    /**
     * Create a new task
     */
    async create(task: TaskInsert): Promise<Task> {
        const { data, error } = await this.supabase
            .from('tasks')
            .insert({
                user_id: task.user_id,
                project_id: task.project_id || null,
                prompt: task.prompt,
                status: task.status || 'queued',
                progress: 0,
                agents_used: [],
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create task: ${error.message}`);
        }

        return data as Task;
    }

    /**
     * Update a task
     */
    async update(id: string, updates: TaskUpdate): Promise<Task> {
        const { data, error } = await this.supabase
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update task: ${error.message}`);
        }

        return data as Task;
    }

    /**
     * Update task status
     */
    async updateStatus(id: string, status: TaskStatus): Promise<Task> {
        const updates: TaskUpdate = { status };

        if (status === 'processing') {
            updates.started_at = new Date().toISOString();
        } else if (status === 'completed' || status === 'failed') {
            updates.completed_at = new Date().toISOString();
        }

        return this.update(id, updates);
    }

    /**
     * Update task progress
     */
    async updateProgress(id: string, progress: number): Promise<Task> {
        return this.update(id, { progress: Math.min(100, Math.max(0, progress)) });
    }

    /**
     * Mark task as completed with result
     */
    async complete(id: string, result: Record<string, unknown>): Promise<Task> {
        return this.update(id, {
            status: 'completed',
            progress: 100,
            result: result,
            completed_at: new Date().toISOString(),
        });
    }

    /**
     * Mark task as failed with error
     */
    async fail(id: string, errorMessage: string): Promise<Task> {
        return this.update(id, {
            status: 'failed',
            error: errorMessage,
            completed_at: new Date().toISOString(),
        });
    }

    /**
     * Add agent to the list of agents used
     */
    async addAgentUsed(id: string, agentId: string): Promise<Task> {
        const task = await this.getById(id);
        if (!task) throw new Error('Task not found');

        const agentsUsed = [...(task.agents_used || []), agentId];
        return this.update(id, { agents_used: agentsUsed });
    }

    /**
     * Delete a task
     */
    async delete(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete task: ${error.message}`);
        }
    }

    /**
     * Cancel a pending task
     */
    async cancel(id: string): Promise<Task | null> {
        const task = await this.getById(id);
        if (!task) return null;

        // Only cancel queued tasks
        if (task.status !== 'queued') {
            throw new Error('Can only cancel queued tasks');
        }

        return this.fail(id, 'Task cancelled by user');
    }
}

// Export singleton instance
export const tasksService = new TasksService();
