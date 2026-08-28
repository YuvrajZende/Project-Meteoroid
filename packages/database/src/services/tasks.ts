/**
 * Tasks Service
 * Database operations for the tasks table (job queue metadata)
 */

import { getConvexClient, api } from '../../api/src/infrastructure/database/convex-client.js';

/**
 * Task status enum
 */
export type TaskStatus = 'queued' | 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Task entity
 */
export interface Task {
    id: string; // Convex ID
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
    _id: string;
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
    private convex = getConvexClient();

    /**
     * Get task by ID
     */
    async getById(id: string): Promise<Task | null> {
        try {
            const task = await this.convex.query(api.tasks.get, { id: id as any });
            if (!task) return null;
            return this.mapToEntity(task);
        } catch (e) {
            console.error("Failed to get task by ID", e);
            return null;
        }
    }

    /**
     * Get all tasks for a user
     */
    async getByUserId(userId: string, options?: {
        status?: TaskStatus;
        limit?: number;
        offset?: number;
    }): Promise<{ tasks: Task[]; total: number }> {
        const tasks = await this.convex.query(api.tasks.listByUser, { userId });

        let filtered = tasks;

        if (options?.status) {
            filtered = filtered.filter(t => t.status === options.status);
        }

        // Sort by created_at desc
        filtered.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });

        const total = filtered.length;

        if (options?.offset !== undefined || options?.limit !== undefined) {
            const start = options.offset || 0;
            const end = options.limit ? start + options.limit : filtered.length;
            filtered = filtered.slice(start, end);
        }

        return {
            tasks: filtered.map(t => this.mapToEntity(t)),
            total,
        };
    }

    /**
     * Get tasks by project ID
     */
    async getByProjectId(projectId: string): Promise<Task[]> {
        const tasks = await this.convex.query(api.tasks.listByProject, { projectId: projectId as any });

        // Sort desc
        tasks.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });

        return tasks.map(t => this.mapToEntity(t));
    }

    /**
     * Create a new task
     */
    async create(task: TaskInsert): Promise<Task> {
        const newId = await this.convex.mutation(api.tasks.create, {
            userId: task.user_id,
            projectId: task.project_id ? (task.project_id as any) : undefined,
            prompt: task.prompt,
            status: task.status || 'queued',
        });

        // Fetch back
        const created = await this.getById(newId);
        if (!created) throw new Error("Failed to retrieve created task");
        return created;
    }

    /**
     * Update a task
     */
    async update(id: string, updates: TaskUpdate): Promise<Task> {
        await this.convex.mutation(api.tasks.update, {
            id: id as any,
            status: updates.status,
            progress: updates.progress,
            result: updates.result,
            error: updates.error,
            agents_used: updates.agents_used,
            started_at: updates.started_at,
            completed_at: updates.completed_at,
        });

        const updated = await this.getById(id);
        if (!updated) throw new Error("Failed to retrieve updated task");
        return updated;
    }

    /**
     * Update task status
     */
    async updateStatus(id: string, status: TaskStatus): Promise<Task> {
        return this.update(id, { status });
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
        await this.convex.mutation(api.tasks.deleteTask, { id: id as any });
    }

    /**
     * Cancel a pending task
     */
    async cancel(id: string): Promise<Task | null> {
        const task = await this.getById(id);
        if (!task) return null;

        // Only cancel queued/pending tasks
        if (task.status !== 'queued' && task.status !== 'pending') {
            throw new Error('Can only cancel queued or pending tasks');
        }

        return this.fail(id, 'Task cancelled by user');
    }

    private mapToEntity(t: any): Task {
        return {
            id: t._id,
            _id: t._id,
            user_id: t.userId || '',
            project_id: t.projectId || null,
            prompt: t.prompt,
            status: (t.status as TaskStatus),
            progress: t.progress || 0,
            result: t.result || null,
            error: t.error || null,
            agents_used: t.agents_used || [],
            started_at: t.started_at || null,
            completed_at: t.completed_at || null,
            created_at: t.created_at || new Date().toISOString(),
        };
    }
}

// Export singleton instance
export const tasksService = new TasksService();
