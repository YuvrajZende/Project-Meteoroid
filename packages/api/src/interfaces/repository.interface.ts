/**
 * Repository Interfaces
 * Week 2: Repository Layer - Day 11
 *
 * Defines contracts for data access layer following Repository Pattern.
 * Repositories abstract database operations and provide:
 * - Clean separation between business logic and data access
 * - Easier testing (can mock repositories)
 * - Consistent data access patterns
 * - Transaction support
 */

// ============================================
// COMMON TYPES
// ============================================

/**
 * Query options for filtering and pagination
 */
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
}

/**
 * Pagination result
 */
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

// ============================================
// PROJECT REPOSITORY
// ============================================

/**
 * Project entity
 */
export interface Project {
    id: string;
    userId: string;
    name: string;
    description?: string;
    config: Record<string, unknown>;
    techStack: string[];
    status: 'active' | 'archived' | 'deleted';
    filesCount?: number;
    lastGeneratedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Project repository interface
 */
export interface IProjectRepository {
    /**
     * Create a new project
     */
    create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;

    /**
     * Find project by ID
     */
    findById(id: string): Promise<Project | null>;

    /**
     * Find all projects for a user
     */
    findByUser(userId: string, options?: QueryOptions): Promise<Project[]>;

    /**
     * Find projects with pagination
     */
    findPaginated(userId: string, options?: QueryOptions): Promise<PaginatedResult<Project>>;

    /**
     * Update project
     */
    update(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void>;

    /**
     * Upsert project (create or update)
     */
    upsert(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Project>;

    /**
     * Delete project (soft delete by setting status to archived)
     */
    delete(id: string): Promise<void>;

    /**
     * Archive project
     */
    archive(id: string): Promise<void>;

    /**
     * Get project count for user
     */
    count(userId: string): Promise<number>;

    /**
     * Update project's last generation timestamp
     */
    updateLastGenerated(id: string, fileCount: number): Promise<void>;
}

// ============================================
// TASK REPOSITORY
// ============================================

/**
 * Task entity
 */
export interface Task {
    id: string;
    projectId: string;
    userId?: string;
    type: 'generation' | 'validation' | 'deployment' | 'custom';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    prompt: string;
    config: Record<string, unknown>;
    result?: Record<string, unknown>;
    errors?: string[];
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Task repository interface
 */
export interface ITaskRepository {
    /**
     * Create a new task
     */
    create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;

    /**
     * Find task by ID
     */
    findById(id: string): Promise<Task | null>;

    /**
     * Find all tasks for a project
     */
    findByProject(projectId: string, options?: QueryOptions): Promise<Task[]>;

    /**
     * Find all tasks for a user
     */
    findByUser(userId: string, options?: QueryOptions): Promise<Task[]>;

    /**
     * Find running tasks
     */
    findRunning(): Promise<Task[]>;

    /**
     * Update task status
     */
    updateStatus(id: string, status: Task['status']): Promise<void>;

    /**
     * Update task result
     */
    updateResult(id: string, result: Task['result']): Promise<void>;

    /**
     * Update task with errors
     */
    addError(id: string, error: string): Promise<void>;

    /**
     * Update task
     */
    update(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void>;

    /**
     * Delete task
     */
    delete(id: string): Promise<void>;

    /**
     * Get task count by status for a project
     */
    countByStatus(projectId: string, status?: Task['status']): Promise<Map<Task['status'], number>>;

    /**
     * Find tasks by type
     */
    findByType(type: Task['type'], options?: QueryOptions): Promise<Task[]>;

    /**
     * Get recent tasks for dashboard
     */
    getRecent(userId: string, limit: number): Promise<Task[]>;
}

// ============================================
// AUDIT REPOSITORY
// ============================================

/**
 * Audit log entity
 */
export interface AuditLog {
    id: string;
    projectId: string;
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
}

/**
 * Audit repository interface
 */
export interface IAuditRepository {
    /**
     * Create audit log entry
     */
    create(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog>;

    /**
     * Find audit logs for a project
     */
    findByProject(projectId: string, options?: QueryOptions): Promise<AuditLog[]>;

    /**
     * Find audit logs for a user
     */
    findByUser(userId: string, options?: QueryOptions): Promise<AuditLog[]>;

    /**
     * Find audit logs by action
     */
    findByAction(action: string, options?: QueryOptions): Promise<AuditLog[]>;

    /**
     * Find audit logs for an entity
     */
    findByEntity(entityType: string, entityId: string, options?: QueryOptions): Promise<AuditLog[]>;

    /**
     * Get recent audit logs
     */
    getRecent(projectId: string, limit: number): Promise<AuditLog[]>;

    /**
     * Search audit logs
     */
    search(filters: {
        projectId?: string;
        userId?: string;
        action?: string;
        entityType?: string;
        startDate?: Date;
        endDate?: Date;
    }, options?: QueryOptions): Promise<AuditLog[]>;

    /**
     * Delete old audit logs (cleanup)
     */
    deleteOlderThan(date: Date): Promise<number>;

    /**
     * Get audit statistics for a project
     */
    getStatistics(projectId: string, timeRange?: { start: Date; end: Date }): Promise<{
        totalActions: number;
        actionsByType: Record<string, number>;
        uniqueUsers: number;
    }>;
}

// ============================================
// USER REPOSITORY
// ============================================

/**
 * User entity
 */
export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: 'admin' | 'user' | 'viewer';
    preferences: Record<string, unknown>;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * User repository interface
 */
export interface IUserRepository {
    /**
     * Create a new user
     */
    create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;

    /**
     * Find user by ID
     */
    findById(id: string): Promise<User | null>;

    /**
     * Find user by email
     */
    findByEmail(email: string): Promise<User | null>;

    /**
     * Update user
     */
    update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void>;

    /**
     * Update last login timestamp
     */
    updateLastLogin(id: string): Promise<void>;

    /**
     * Update user preferences
     */
    updatePreferences(id: string, preferences: Partial<User['preferences']>): Promise<void>;

    /**
     * Delete user
     */
    delete(id: string): Promise<void>;

    /**
     * Get all users
     */
    findAll(options?: QueryOptions): Promise<User[]>;

    /**
     * Get users by role
     */
    findByRole(role: User['role'], options?: QueryOptions): Promise<User[]>;

    /**
     * Search users by name or email
     */
    search(query: string, options?: QueryOptions): Promise<User[]>;

    /**
     * Count total users
     */
    count(): Promise<number>;

    /**
     * Count users by role
     */
    countByRole(): Promise<Record<User['role'], number>>;
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Batch operation result
 */
export interface BatchResult<T> {
    succeeded: T[];
    failed: Array<{ item: T; error: string }>;
    total: number;
}

/**
 * Batch operations interface (optional optimization)
 */
export interface IBatchOperations {
    /**
     * Batch insert projects
     */
    batchCreateProjects(projects: Array<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<BatchResult<Project>>;

    /**
     * Batch update tasks
     */
    batchUpdateTaskStatus(taskIds: string[], status: Task['status']): Promise<BatchResult<string>>;

    /**
     * Batch delete audit logs
     */
    batchDeleteAuditLogs(ids: string[]): Promise<BatchResult<string>>;
}
