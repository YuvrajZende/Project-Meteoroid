/**
 * Repository Test Fixtures
 * Provides mock data and test helpers for repository tests
 */

import type { Project, Task, AuditLog, User } from '../../interfaces/repository.interface.js';

export const mockUser: User = {
    id: 'user_test_123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed_password_123',
    role: 'user',
    preferences: { theme: 'dark', notifications: true },
    lastLoginAt: new Date('2024-01-15T10:30:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
};

export const mockProject: Project = {
    id: 'proj_test_123',
    userId: 'user_test_123',
    name: 'Test Project',
    description: 'A test project for unit testing',
    config: { language: 'typescript', framework: 'fastify' },
    techStack: ['typescript', 'fastify', 'supabase'],
    status: 'active',
    filesCount: 42,
    lastGeneratedAt: new Date('2024-01-15T10:30:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
};

// Database row format (snake_case) for users
export const mockUserRow = {
    id: 'user_test_123',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'hashed_password_123',
    role: 'user',
    preferences: JSON.stringify({ theme: 'dark', notifications: true }),
    last_login_at: '2024-01-15T10:30:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T10:30:00Z',
};

// Database row format (snake_case) for projects
export const mockProjectRow = {
    id: 'proj_test_123',
    user_id: 'user_test_123',
    name: 'Test Project',
    description: 'A test project for unit testing',
    config: JSON.stringify({ language: 'typescript', framework: 'fastify' }),
    tech_stack: ['typescript', 'fastify', 'supabase'],
    status: 'active',
    files_count: 42,
    last_generated_at: '2024-01-15T10:30:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T10:30:00Z',
};

// Database row format (snake_case) for tasks
export const mockTaskRow = {
    id: 'task_test_123',
    project_id: 'proj_test_123',
    user_id: 'user_test_123',
    type: 'generation',
    status: 'running',
    prompt: 'Generate a user authentication system',
    config: JSON.stringify({ model: 'gpt-4', temperature: 0.7 }),
    result: JSON.stringify({
        code: 'export function authenticate() { return true; }',
        files: [{ path: 'src/auth.ts', content: 'export function authenticate() { return true; }', language: 'typescript' }],
        explanation: 'Generated authentication function',
        success: true,
        errors: [],
        metrics: { duration: 1500, tokensUsed: 500, cost: 0.01 },
    }),
    errors: JSON.stringify([]),
    started_at: '2024-01-15T10:00:00Z',
    completed_at: '2024-01-15T10:01:00Z',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:01:00Z',
};

// Database row format (snake_case) for audit logs
export const mockAuditLogRow = {
    id: 'audit_test_123',
    project_id: 'proj_test_123',
    user_id: 'user_test_123',
    action: 'project.created',
    entity_type: 'project',
    entity_id: 'proj_test_123',
    changes: JSON.stringify({
        name: { from: null, to: 'Test Project' },
        status: { from: null, to: 'active' },
    }),
    metadata: JSON.stringify({ ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0...' }),
    created_at: '2024-01-15T10:00:00Z',
};

export const mockTask: Task = {
    id: 'task_test_123',
    projectId: 'proj_test_123',
    userId: 'user_test_123',
    type: 'generation',
    status: 'running',
    prompt: 'Generate a user authentication system',
    config: { model: 'gpt-4', temperature: 0.7 },
    result: {
        code: 'export function authenticate() { return true; }',
        files: [{ path: 'src/auth.ts', content: 'export function authenticate() { return true; }', language: 'typescript' }],
        explanation: 'Generated authentication function',
        success: true,
        errors: [],
        metrics: { duration: 1500, tokensUsed: 500, cost: 0.01 },
    },
    errors: [],
    startedAt: new Date('2024-01-15T10:00:00Z'),
    completedAt: new Date('2024-01-15T10:01:00Z'),
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:01:00Z'),
};

export const mockAuditLog: AuditLog = {
    id: 'audit_test_123',
    projectId: 'proj_test_123',
    userId: 'user_test_123',
    action: 'project.created',
    entityType: 'project',
    entityId: 'proj_test_123',
    changes: {
        name: { from: null, to: 'Test Project' },
        status: { from: null, to: 'active' },
    },
    metadata: { ipAddress: '127.0.0.1', userAgent: 'Mozilla/5.0...' },
    createdAt: new Date('2024-01-15T10:00:00Z'),
};

export function generateMockUsers(count: number): User[] {
    return Array.from({ length: count }, (_, i) => ({
        ...mockUser,
        id: `user_test_${i}`,
        email: `test${i}@example.com`,
        name: `Test User ${i}`,
    }));
}

export function generateMockProjects(count: number, userId: string = mockUser.id): Project[] {
    return Array.from({ length: count }, (_, i) => ({
        ...mockProject,
        id: `proj_test_${i}`,
        userId,
        name: `Test Project ${i}`,
    }));
}

export function generateMockTasks(count: number, projectId: string = mockProject.id): Task[] {
    return Array.from({ length: count }, (_, i) => ({
        ...mockTask,
        id: `task_test_${i}`,
        projectId,
        status: ['pending', 'running', 'completed', 'failed'][i % 4] as Task['status'],
    }));
}
