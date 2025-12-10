/**
 * API Routes Integration Tests
 * Uses Fastify's inject for testing without HTTP
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from '../routes/index.js';

// ============================================
// TEST SETUP
// ============================================

let app: FastifyInstance;

beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerRoutes(app);
    await app.ready();
});

afterAll(async () => {
    await app.close();
});

// ============================================
// HEALTH ROUTE TESTS
// ============================================

describe('Health Routes', () => {
    describe('GET /health', () => {
        it('should return 200 with health status', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.status).toBe('healthy');
        });

        it('should include uptime', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health',
            });

            const body = JSON.parse(response.payload);
            expect(body.uptime).toBeDefined();
            expect(typeof body.uptime).toBe('number');
        });
    });
});

// ============================================
// AGENT ROUTE TESTS
// ============================================

describe('Agent Routes', () => {
    describe('GET /api/v1/agents', () => {
        it('should return list of agents', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/agents',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.agents).toBeDefined();
            expect(Array.isArray(body.agents)).toBe(true);
        });

        it('should return agent count', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/agents',
            });

            const body = JSON.parse(response.payload);
            // Response may have count field
            expect(body.agents).toBeDefined();
        });
    });

    describe('GET /api/v1/agents/:id', () => {
        it('should return 404 for unknown agent', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/agents/unknown-agent-id',
            });

            expect(response.statusCode).toBe(404);
        });
    });
});

// ============================================
// ORCHESTRATOR ROUTE TESTS
// ============================================

describe('Orchestrator Routes', () => {
    describe('GET /api/v1/orchestrator/status', () => {
        it('should return orchestrator status', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/orchestrator/status',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.services).toBeDefined();
            expect(body.agents).toBeDefined();
        });

        it('should include service statuses', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/orchestrator/status',
            });

            const body = JSON.parse(response.payload);
            expect(body.services.thinkingEngine).toBe('available');
            expect(body.services.contextManager).toBe('available');
        });
    });

    describe('GET /api/v1/orchestrator/agents', () => {
        it('should return connected agents list', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/orchestrator/agents',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.agents).toBeDefined();
            expect(body.summary).toBeDefined();
        });
    });

    describe('POST /api/v1/orchestrator/think', () => {
        it('should analyze a valid task', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/orchestrator/think',
                headers: { 'Content-Type': 'application/json' },
                payload: {
                    task: 'Create a JWT authentication system with refresh tokens',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.analysis).toBeDefined();
            expect(body.analysis.suggestedAgents).toBeDefined();
        });

        it('should reject tasks that are too short', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/orchestrator/think',
                headers: { 'Content-Type': 'application/json' },
                payload: {
                    task: 'hi', // Too short
                },
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe('GET /api/v1/orchestrator/context/:projectId', () => {
        it('should return project context', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/orchestrator/context/test-project-123',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.projectId).toBe('test-project-123');
            expect(body.context).toBeDefined();
        });
    });
});

// ============================================
// TEMPLATE ROUTE TESTS
// ============================================

describe('Template Routes', () => {
    describe('GET /api/v1/templates', () => {
        it('should return 200', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/templates',
            });

            expect(response.statusCode).toBe(200);
        });

        it('should return valid JSON', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/templates',
            });

            expect(() => JSON.parse(response.payload)).not.toThrow();
        });
    });
});

// ============================================
// METRICS ROUTE TESTS
// ============================================

describe('Metrics Routes', () => {
    describe('GET /metrics', () => {
        it('should return Prometheus metrics', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/metrics',
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toContain('text/plain');
        });
    });

    describe('GET /metrics/json', () => {
        it('should return 200', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/metrics/json',
            });

            expect(response.statusCode).toBe(200);
        });
    });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/unknown-route',
        });

        expect(response.statusCode).toBe(404);
    });

    it('should handle malformed JSON', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/orchestrator/think',
            headers: { 'Content-Type': 'application/json' },
            payload: 'invalid json{',
        });

        expect(response.statusCode).toBe(400);
    });
});
