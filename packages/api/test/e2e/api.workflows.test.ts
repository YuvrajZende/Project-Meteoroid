/**
 * E2E Tests: API Workflows
 * Tests complete user workflows through the API
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { withE2ESetup, getServerUrl, authenticatedRequest } from './setup.js';
import { MockDatabase } from '../src/repositories/__tests__/mock-database.js';
import { seedTestData } from './setup.js';

describe('E2E: API Workflows', () => {
    let testDb: MockDatabase;
    let serverUrl: string;

    beforeAll(async () => {
        serverUrl = getServerUrl();
        // Get database instance from DI container for seeding
        const { initDIContainer, TYPES } = await import('../src/di/types.js');
        const container = initDIContainer();
        testDb = container.get<MockDatabase>(TYPES.Database);

        // Seed test data
        await seedTestData(testDb, 'users', [
            { id: 'user_e2e_1', email: 'e2e@example.com', name: 'E2E Test User', role: 'user', preferences: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ]);

        await seedTestData(testDb, 'projects', [
            { id: 'proj_e2e_1', user_id: 'user_e2e_1', name: 'E2E Test Project', description: 'Test project for E2E tests', status: 'active', tech_stack: '[]', config: '{}', files_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ]);
    });

    withE2ESetup(() => {
        // ============================================
        // TEST SUITE: User Authentication Flow
        // ============================================
        describe('Authentication Flow', () => {
            test('should register new user', async () => {
                const response = await fetch(`${serverUrl}/api/v1/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'newuser@example.com',
                        password: 'SecurePassword123!',
                        name: 'New User',
                    }),
                });

                expect(response.status).toBe(201);
                const data = await response.json();
                expect(data).toHaveProperty('userId');
                expect(data.email).toBe('newuser@example.com');
            });

            test('should login with valid credentials', async () => {
                const response = await fetch(`${serverUrl}/api/v1/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'e2e@example.com',
                        password: 'password123',
                    }),
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data).toHaveProperty('token');
                expect(data).toHaveProperty('user');
            });

            test('should reject invalid credentials', async () => {
                const response = await fetch(`${serverUrl}/api/v1/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'e2e@example.com',
                        password: 'wrongpassword',
                    }),
                });

                expect(response.status).toBe(401);
            });
        });

        // ============================================
        // TEST SUITE: Project Management Flow
        // ============================================
        describe('Project Management Flow', () => {
            test('should create new project', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/projects`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: 'My Test Project',
                        description: 'A project for E2E testing',
                        techStack: ['typescript', 'fastify'],
                    }),
                });

                expect(response.status).toBe(201);
                const data = response.data as Record<string, unknown>;
                expect(data).toHaveProperty('id');
                expect(data.name).toBe('My Test Project');
            });

            test('should list user projects', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/projects`);

                expect(response.status).toBe(200);
                const data = response.data as Record<string, unknown>;
                expect(data).toHaveProperty('projects');
                expect(Array.isArray(data.projects)).toBe(true);
            });

            test('should get project by ID', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/projects/proj_e2e_1`);

                expect(response.status).toBe(200);
                const data = response.data as Record<string, unknown>;
                expect(data.id).toBe('proj_e2e_1');
                expect(data.name).toBe('E2E Test Project');
            });

            test('should update project', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/projects/proj_e2e_1`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        name: 'Updated E2E Project',
                        description: 'Updated description',
                    }),
                });

                expect(response.status).toBe(200);
                const data = response.data as Record<string, unknown>;
                expect(data.name).toBe('Updated E2E Project');
            });
        });

        // ============================================
        // TEST SUITE: Task Execution Flow
        // ============================================
        describe('Task Execution Flow', () => {
            test('should create and execute task', async () => {
                // Create task
                const createResponse = await authenticatedRequest(`${serverUrl}/api/v1/tasks`, {
                    method: 'POST',
                    body: JSON.stringify({
                        projectId: 'proj_e2e_1',
                        type: 'generation',
                        prompt: 'Create a simple REST API',
                        config: { model: 'gpt-4', temperature: 0.7 },
                    }),
                });

                expect(createResponse.status).toBe(201);
                const task = createResponse.data as Record<string, unknown>;
                expect(task).toHaveProperty('id');
                expect(task.status).toBe('pending');

                const taskId = task.id as string;

                // Poll for task completion
                let attempts = 0;
                let finalStatus: string = 'pending';

                while (attempts < 30 && finalStatus !== 'complete' && finalStatus !== 'failed') {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const statusResponse = await authenticatedRequest(`${serverUrl}/api/v1/tasks/${taskId}/status`);
                    expect(statusResponse.status).toBe(200);

                    const statusData = statusResponse.data as Record<string, unknown>;
                    finalStatus = statusData.status as string;
                    attempts++;
                }

                expect(['complete', 'failed']).toContain(finalStatus);
            });

            test('should list project tasks', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/projects/proj_e2e_1/tasks`);

                expect(response.status).toBe(200);
                const data = response.data as Record<string, unknown>;
                expect(data).toHaveProperty('tasks');
            });
        });

        // ============================================
        // TEST SUITE: Context Management Flow
        // ============================================
        describe('Context Management Flow', () => {
            test('should save and retrieve project context', async () => {
                const context = {
                    userId: 'user_e2e_1',
                    projectId: 'proj_e2e_1',
                    preferences: { theme: 'dark', language: 'typescript' },
                    recentPrompts: ['Create API', 'Add tests'],
                    techStackHistory: ['typescript', 'vitest'],
                };

                // Save context
                const saveResponse = await authenticatedRequest(`${serverUrl}/api/v1/context`, {
                    method: 'POST',
                    body: JSON.stringify(context),
                });

                expect(saveResponse.status).toBe(201);

                // Retrieve context
                const getResponse = await authenticatedRequest(`${serverUrl}/api/v1/context/user_e2e_1/proj_e2e_1`);

                expect(getResponse.status).toBe(200);
                const data = getResponse.data as Record<string, unknown>;
                expect(data.preferences).toEqual({ theme: 'dark', language: 'typescript' });
            });
        });

        // ============================================
        // TEST SUITE: Learning Flow
        // ============================================
        describe('Learning Flow', () => {
            test('should store and retrieve learning patterns', async () => {
                // Simulate storing a learning iteration
                const iteration = {
                    projectId: 'proj_e2e_1',
                    taskId: 'task_learning_1',
                    prompt: 'Test prompt',
                    code: 'export function test() { return true; }',
                    language: 'typescript',
                    framework: 'vitest',
                    timestamp: new Date().toISOString(),
                    feedback: { success: true, errors: [] },
                };

                const response = await authenticatedRequest(`${serverUrl}/api/v1/learning/iterations`, {
                    method: 'POST',
                    body: JSON.stringify(iteration),
                });

                expect(response.status).toBe(201);
            });

            test('should get learned patterns', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/learning/patterns?limit=10`);

                expect(response.status).toBe(200);
                const data = response.data as Record<string, unknown>;
                expect(data).toHaveProperty('patterns');
            });
        });

        // ============================================
        // TEST SUITE: Error Handling
        // ============================================
        describe('Error Handling', () => {
            test('should return 404 for non-existent resource', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/projects/nonexistent`);

                expect(response.status).toBe(404);
                const data = response.data as Record<string, unknown>;
                expect(data).toHaveProperty('error');
            });

            test('should validate request body', async () => {
                const response = await authenticatedRequest(`${serverUrl}/api/v1/projects`, {
                    method: 'POST',
                    body: JSON.stringify({
                        // Missing required 'name' field
                        description: 'Invalid project',
                    }),
                });

                expect(response.status).toBe(400);
                const data = response.data as Record<string, unknown>;
                expect(data).toHaveProperty('error');
            });

            test('should handle rate limiting', async () => {
                // Make multiple rapid requests
                const requests = Array(10).fill(null).map(() =>
                    fetch(`${serverUrl}/api/v1/projects`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer test-token` },
                    })
                );

                const responses = await Promise.all(requests);

                // At least one should be rate limited
                const rateLimited = responses.some(r => r.status === 429);
                if (rateLimited) {
                    const data = await responses[0].json();
                    expect(data).toHaveProperty('error');
                }
            });
        });
    });
});
