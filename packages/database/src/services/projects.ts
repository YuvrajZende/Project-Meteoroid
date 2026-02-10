/**
 * Projects Service
 * Database operations for the projects table
 */

import { getConvexClient, api } from '../../api/src/infrastructure/database/convex-client.js';
import { Id } from '../../api/convex/_generated/dataModel.js';

/**
 * Project status enum
 */
export type ProjectStatus = 'pending' | 'generating' | 'active' | 'completed' | 'failed' | 'archived';

/**
 * Project entity
 */
export interface Project {
    id: string; // Convex ID
    user_id: string; // Mapped from userId
    name: string;
    description: string | null;
    config: Record<string, unknown>;
    status: ProjectStatus;
    created_at: string;
    updated_at: string;
    _id: string;
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
    private convex = getConvexClient();

    /**
     * Get project by ID
     */
    async getById(id: string): Promise<Project | null> {
        // ID might be a Supabase ID (UUID) or Convex ID.
        // If it's a valid Convex ID, use get.
        // If not, we can't easily query by internal ID unless we stored it.
        // Assumption: We are fully migrating, so IDs passed here will be Convex IDs.

        try {
            // Cast to generic Id to satisfy type checker if strict
            const project = await this.convex.query(api.projects.get, { id: id as any });

            if (!project) return null;

            return this.mapToEntity(project);
        } catch (e) {
            console.error("Failed to get project by ID", e);
            return null;
        }
    }

    /**
     * Get all projects for a user
     */
    async getByUserId(userId: string, options?: {
        status?: ProjectStatus;
        limit?: number;
        offset?: number;
    }): Promise<{ projects: Project[]; total: number }> {
        const projects = await this.convex.query(api.projects.listByUser, { userId });

        // Client-side filtering and pagination (since we don't have complex queries in backend yet)
        let filtered = projects;

        if (options?.status) {
            filtered = filtered.filter(p => p.status === options.status);
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
            projects: filtered.map(p => this.mapToEntity(p)),
            total,
        };
    }

    /**
     * Create a new project
     */
    async create(project: ProjectInsert): Promise<Project> {
        const newId = await this.convex.mutation(api.projects.create, {
            userId: project.user_id,
            name: project.name,
            description: project.description || undefined,
            config: project.config,
            status: (project.status as any) || 'pending',
        });

        await new Promise(resolve => setTimeout(resolve, 100)); // Hack: wait for propagation? 
        // Better: return the object from creating, but my mutation returns ID.

        const created = await this.getById(newId);
        if (!created) throw new Error("Failed to retrieve created project");
        return created;
    }

    /**
     * Update a project
     */
    async update(id: string, updates: ProjectUpdate): Promise<Project> {
        await this.convex.mutation(api.projects.update, {
            id: id as any,
            name: updates.name,
            description: updates.description || undefined,
            config: updates.config,
            status: updates.status as any,
        });

        const updated = await this.getById(id);
        if (!updated) throw new Error("Failed to retrieve updated project");
        return updated;
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
        await this.convex.mutation(api.projects.deleteProject, { id: id as any });
    }

    /**
     * Check if user owns the project
     */
    async isOwner(projectId: string, userId: string): Promise<boolean> {
        const project = await this.getById(projectId);
        return project?.user_id === userId;
    }

    private mapToEntity(p: any): Project {
        return {
            id: p._id,
            _id: p._id,
            user_id: p.userId,
            name: p.name,
            description: p.description ?? null,
            config: p.config ?? {},
            status: (p.status as ProjectStatus) || 'pending',
            created_at: p.created_at || new Date().toISOString(),
            updated_at: p.updated_at || new Date().toISOString(),
        };
    }
}

// Export singleton instance
export const projectsService = new ProjectsService();
