/**
 * Test Fixtures
 * Common test data and mock objects
 */

// ============================================
// USER FIXTURES
// ============================================

export const TEST_USERS = {
    admin: {
        id: 'user-admin-001',
        email: 'admin@test.com',
        password: 'TestPassword123!',
        role: 'admin',
        tier: 'enterprise',
    },
    proUser: {
        id: 'user-pro-001',
        email: 'pro@test.com',
        password: 'ProPassword456!',
        role: 'user',
        tier: 'pro',
    },
    freeUser: {
        id: 'user-free-001',
        email: 'free@test.com',
        password: 'FreePassword789!',
        role: 'user',
        tier: 'free',
    },
};

// ============================================
// PROJECT FIXTURES
// ============================================

export const TEST_PROJECTS = {
    simpleProject: {
        id: 'proj-simple-001',
        name: 'Simple Test Project',
        description: 'A simple project for testing',
        userId: TEST_USERS.proUser.id,
        createdAt: new Date('2024-01-01'),
    },
    complexProject: {
        id: 'proj-complex-001',
        name: 'Complex Enterprise Project',
        description: 'A complex project with multiple requirements',
        userId: TEST_USERS.admin.id,
        createdAt: new Date('2024-01-15'),
        settings: {
            framework: 'fastify',
            database: 'supabase',
            auth: 'jwt',
        },
    },
};

// ============================================
// TASK FIXTURES
// ============================================

export const TEST_TASKS = {
    simpleAuth: {
        id: 'task-auth-001',
        prompt: 'Create a simple login endpoint',
        projectId: TEST_PROJECTS.simpleProject.id,
        status: 'pending',
    },
    complexAuth: {
        id: 'task-auth-002',
        prompt: `
            Create a complete authentication system with:
            - JWT-based login with access and refresh tokens
            - User registration with email verification
            - Password reset flow
            - Session management with Redis
            - Rate limiting on auth endpoints
            - Audit logging for all auth events
        `,
        projectId: TEST_PROJECTS.complexProject.id,
        status: 'pending',
    },
    securityTask: {
        id: 'task-security-001',
        prompt: 'Add comprehensive security headers and CORS configuration',
        projectId: TEST_PROJECTS.simpleProject.id,
        status: 'pending',
    },
    monitoringTask: {
        id: 'task-monitoring-001',
        prompt: 'Set up structured logging with Pino and health check endpoints',
        projectId: TEST_PROJECTS.simpleProject.id,
        status: 'pending',
    },
};

// ============================================
// AGENT FIXTURES
// ============================================

export const TEST_AGENTS = {
    authAgent: {
        id: 'auth-agent',
        name: 'AuthAgent',
        description: 'Handles authentication and authorization',
        tier: 'core' as const,
        capabilities: ['jwt', 'oauth', 'session', 'password-hashing'],
        version: '1.0.0',
    },
    securityAgent: {
        id: 'security-agent',
        name: 'SecurityAgent',
        description: 'Handles security middleware and protections',
        tier: 'core' as const,
        capabilities: ['rate-limiting', 'headers', 'cors', 'sanitization'],
        version: '1.0.0',
    },
    monitoringAgent: {
        id: 'monitoring-agent',
        name: 'MonitoringAgent',
        description: 'Handles logging and observability',
        tier: 'core' as const,
        capabilities: ['logging', 'metrics', 'health-check', 'tracing'],
        version: '1.0.0',
    },
};

// ============================================
// API REQUEST FIXTURES
// ============================================

export const API_REQUESTS = {
    validThink: {
        method: 'POST',
        url: '/api/v1/orchestrator/think',
        headers: { 'Content-Type': 'application/json' },
        payload: {
            task: 'Create a JWT authentication system with refresh tokens',
        },
    },
    validExecute: {
        method: 'POST',
        url: '/api/v1/orchestrator/execute',
        headers: { 'Content-Type': 'application/json' },
        payload: {
            prompt: 'Create a simple health check endpoint',
            projectId: TEST_PROJECTS.simpleProject.id,
        },
    },
    invalidThink: {
        method: 'POST',
        url: '/api/v1/orchestrator/think',
        headers: { 'Content-Type': 'application/json' },
        payload: {
            task: 'hi', // Too short
        },
    },
    malformedJson: {
        method: 'POST',
        url: '/api/v1/orchestrator/execute',
        headers: { 'Content-Type': 'application/json' },
        payload: '{ invalid json }',
    },
};

// ============================================
// EXPECTED RESPONSES
// ============================================

export const EXPECTED_RESPONSES = {
    health: {
        status: 'healthy',
    },
    orchestratorStatus: {
        services: {
            thinkingEngine: 'available',
            contextManager: 'available',
            mcpHub: 'available',
            agentMonitor: 'available',
        },
    },
    // Note: Use this for manual comparison, not with vitest matchers
    thinkAnalysisShape: {
        analysis: {
            suggestedAgents: ['auth-agent', 'security-agent'], // Example values
            complexity: 'moderate', // 'simple' | 'moderate' | 'complex'
            requirements: ['Authentication system', 'Security middleware'],
        },
    },
};

// ============================================
// ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES = {
    unauthorized: 'Unauthorized',
    forbidden: 'Forbidden',
    notFound: 'Not found',
    validation: 'Validation error',
    rateLimit: 'Too many requests',
    serverError: 'Internal server error',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createAuthHeader(token: string): Record<string, string> {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export function generateTestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createTestProject(overrides: Partial<typeof TEST_PROJECTS.simpleProject> = {}) {
    return {
        ...TEST_PROJECTS.simpleProject,
        id: generateTestId('proj'),
        ...overrides,
    };
}

export function createTestTask(overrides: Partial<typeof TEST_TASKS.simpleAuth> = {}) {
    return {
        ...TEST_TASKS.simpleAuth,
        id: generateTestId('task'),
        ...overrides,
    };
}
