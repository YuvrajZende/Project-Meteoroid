/**
 * Projects Service
 * Database operations for the projects table
 */

import { getSupabaseAdmin } from '../client.js';

/**
 * Project status enum
 */
export type ProjectStatus = 'pending' | 'generating' | 'completed' | 'failed';

/**
 * Project entity
 */
export interface Project {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    config: Record<string, unknown>;
    status: ProjectStatus;
    created_at: string;
    updated_at: string;
}

/**
 * Project insert DTO
 */
export interface ProjectInsert {
    user_id: string;
    name: string;
    description?: string | null;
    config?: Record<string, unknown>;
    status?: ProjectStatus;
}

/**
 * Project update DTO
 */
export interface ProjectUpdate {
    name?: string;
    description?: string | null;
    config?: Record<string, unknown>;
    status?: ProjectStatus;
}

/**
 * ProjectsService - CRUD operations for projects
 */
export class ProjectsService {
    private supabase = getSupabaseAdmin();

    /**
     * Get project by ID
     */
    async getById(id: string): Promise<Project | null> {
        const { data, error } = await this.supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to get project: ${error.message}`);
        }

        return data as Project;
    }

    /**
     * Get all projects for a user
     */
    async getByUserId(userId: string, options?: {
        status?: ProjectStatus;
        limit?: number;
        offset?: number;
    }): Promise<{ projects: Project[]; total: number }> {
        let query = this.supabase
            .from('projects')
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
            throw new Error(`Failed to get projects: ${error.message}`);
        }

        return {
            projects: (data || []) as Project[],
            total: count || 0,
        };
    }

    /**
     * Create a new project
     */
    async create(project: ProjectInsert): Promise<Project> {
        const { data, error } = await this.supabase
            .from('projects')
            .insert({
                user_id: project.user_id,
                name: project.name,
                description: project.description || null,
                config: project.config || {},
                status: project.status || 'pending',
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create project: ${error.message}`);
        }

        return data as Project;
    }

    /**
     * Update a project
     */
    async update(id: string, updates: ProjectUpdate): Promise<Project> {
        const { data, error } = await this.supabase
            .from('projects')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update project: ${error.message}`);
        }

        return data as Project;
    }

    /**
     * Update project status
     */
    async updateStatus(id: string, status: ProjectStatus): Promise<Project> {
        return this.update(id, { status });
    }

    /**
     * Delete a project
     */
    async delete(id: string): Promise<void> {
        const { error } = await this.supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete project: ${error.message}`);
        }
    }

    /**
     * Check if user owns the project
     */
    async isOwner(projectId: string, userId: string): Promise<boolean> {
        const project = await this.getById(projectId);
        return project?.user_id === userId;
    }
}

// Export singleton instance
export const projectsService = new ProjectsService();
