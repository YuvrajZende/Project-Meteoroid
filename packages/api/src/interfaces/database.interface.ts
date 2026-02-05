/**
 * Database Interfaces
 *
 * Defines the contract for database operations and repositories.
 * Provides abstraction over database implementation.
 */

import type { OrchestrationResult } from './orchestration.interface.js';

export interface DatabaseConfig {
    url?: string;
    apiKey?: string;
    maxConnections?: number;
    connectionTimeout?: number;
    idleTimeout?: number;
}

export interface QueryResult<T> {
    data: T[] | null;
    error: string | null;
    count: number;
}

export interface Transaction {
    query<T>(sql: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}

export interface Project {
    id: string;
    userId: string;
    name: string;
    config: Record<string, unknown>;
    status: 'active' | 'archived' | 'deleted';
    lastGeneratedAt?: Date;
    filesCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Task {
    id: string;
    projectId: string;
    userId?: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    prompt: string;
    result?: OrchestrationResult;
    config?: Record<string, unknown>;
    subtasks?: string[];
    progress?: number;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface AuditLog {
    id: string;
    projectId: string;
    userId?: string;
    action: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}

export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Database interface
 * Provides low-level database operations
 */
export interface IDatabase {
    /**
     * Execute a query
     */
    query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]>;

    /**
     * Execute a transaction
     */
    transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T>;

    /**
     * Get connection health status
     */
    getConnectionState(): Promise<{ connected: boolean; latency?: number }>;

    /**
     * Close database connection
     */
    close(): Promise<void>;
}

/**
 * Project repository interface
 */
export interface IProjectRepository {
    create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
    findById(id: string): Promise<Project | null>;
    findByUser(userId: string): Promise<Project[]>;
    update(id: string, updates: Partial<Project>): Promise<void>;
    delete(id: string): Promise<void>;
    upsert(project: Project): Promise<Project>;
}

/**
 * Task repository interface
 */
export interface ITaskRepository {
    create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
    findById(id: string): Promise<Task | null>;
    findByProject(projectId: string): Promise<Task[]>;
    findByUser(userId: string): Promise<Task[]>;
    updateStatus(id: string, status: Task['status']): Promise<void>;
    updateProgress(id: string, progress: number): Promise<void>;
    delete(id: string): Promise<void>;
}

/**
 * Audit repository interface
 */
export interface IAuditRepository {
    create(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;
    findByProject(projectId: string, limit?: number): Promise<AuditLog[]>;
    findByUser(userId: string, limit?: number): Promise<AuditLog[]>;
}

/**
 * User repository interface
 */
export interface IUserRepository {
    create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    update(id: string, updates: Partial<User>): Promise<void>;
    delete(id: string): Promise<void>;
}
