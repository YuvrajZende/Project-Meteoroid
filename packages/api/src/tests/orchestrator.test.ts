/**
 * Orchestrator Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    OrchestratorService,
    createOrchestrator,
} from '../services/orchestrator.js';
import {
    ThinkingEngineService,
    ContextManagerService,
    AgentMonitorService,
    getThinkingEngine,
    getContextManager,
    getAgentMonitor,
} from '../services/core-services.js';
import {
    AgentCoordinator,
    getAgentCoordinator,
} from '../services/agent-coordinator.js';

// ============================================
// MOCK SETUP
// ============================================

vi.mock('../services/key-manager.js', () => ({
    getKeyManager: () => ({
        getNextKey: () => ({ key: 'test-api-key', provider: 'openai' }),
        hasAvailableKeys: () => true,
    }),
}));

// ============================================
// ORCHESTRATOR SERVICE TESTS
// ============================================

describe('OrchestratorService', () => {
    let orchestrator: OrchestratorService;

    beforeEach(() => {
        orchestrator = createOrchestrator({
            modelName: 'gpt-4',
            thinkingEnabled: true,
            monitoringEnabled: true,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await orchestrator.initialize();
            const status = orchestrator.getStatus();
            expect(status.initialized).toBe(true);
        });

        it('should return correct config in status', async () => {
            await orchestrator.initialize();
            const status = orchestrator.getStatus();
            expect(status.config?.modelName).toBe('gpt-4');
            expect(status.config?.thinkingEnabled).toBe(true);
        });
    });

    describe('execution', () => {
        beforeEach(async () => {
            await orchestrator.initialize();
        });

        it('should execute a task and return result', async () => {
            const result = await orchestrator.execute({
                taskId: 'test-task-1',
                userId: process.env.TEST_USER_ID || '6461ad32-3dcb-4760-87b2-c4f7458025e3',
                prompt: 'Create a simple authentication system',
            });

            expect(result).toBeDefined();
            expect(result.success).toBeDefined();
            expect(result.taskId).toBe('test-task-1');
        });

        it('should handle errors gracefully', async () => {
            const result = await orchestrator.execute({
                taskId: 'test-task-2',
                userId: process.env.TEST_USER_ID || '6461ad32-3dcb-4760-87b2-c4f7458025e3',
                prompt: '', // Empty prompt should be handled
            });

            expect(result).toBeDefined();
        });
    });

    describe('getStatus', () => {
        it('should return uninitialized status before init', () => {
            const freshOrchestrator = createOrchestrator({});
            const status = freshOrchestrator.getStatus();
            expect(status.initialized).toBe(false);
        });

        it('should include config after init', async () => {
            await orchestrator.initialize();
            const status = orchestrator.getStatus();
            expect(status.config).toBeDefined();
        });
    });
});

// ============================================
// THINKING ENGINE TESTS
// ============================================

describe('ThinkingEngineService', () => {
    let engine: ThinkingEngineService;

    beforeEach(() => {
        engine = getThinkingEngine();
        engine.clearTraces();
    });

    describe('analyzeTask', () => {
        it('should identify auth-related tasks', async () => {
            const analysis = await engine.analyzeTask('Create a JWT authentication system');

            expect(analysis.suggestedAgents).toContain('auth-agent');
            expect(analysis.requirements).toContain('Authentication system');
        });

        it('should identify security-related tasks', async () => {
            const analysis = await engine.analyzeTask('Add security headers and rate limiting');

            expect(analysis.suggestedAgents).toContain('security-agent');
            expect(analysis.requirements).toContain('Security middleware');
        });

        it('should identify monitoring-related tasks', async () => {
            const analysis = await engine.analyzeTask('Setup logging and monitoring');

            expect(analysis.suggestedAgents).toContain('monitoring-agent');
            expect(analysis.requirements).toContain('Monitoring/Logging');
        });

        it('should determine complexity based on word count', async () => {
            const simpleAnalysis = await engine.analyzeTask('Add login');
            expect(simpleAnalysis.complexity).toBe('simple');

            // Need more than 15 words for moderate complexity
            const moderateAnalysis = await engine.analyzeTask(
                'Create a comprehensive authentication system with JWT tokens refresh mechanism and rate limiting protection against brute force attacks and session management'
            );
            expect(moderateAnalysis.complexity).toBe('moderate');
        });

        it('should generate subtasks', async () => {
            const analysis = await engine.analyzeTask('Create auth and security');

            expect(analysis.subTasks).toBeDefined();
            expect(analysis.subTasks!.length).toBeGreaterThan(0);
        });
    });

    describe('traces', () => {
        it('should record traces during analysis', async () => {
            await engine.analyzeTask('Test task');
            const traces = engine.getTraces();

            expect(traces.length).toBeGreaterThan(0);
            expect(traces[0].phase).toBe('analysis');
        });

        it('should clear traces', async () => {
            await engine.analyzeTask('Test task');
            engine.clearTraces();

            expect(engine.getTraces().length).toBe(0);
        });
    });
});

// ============================================
// CONTEXT MANAGER TESTS
// ============================================

describe('ContextManagerService', () => {
    let contextManager: ContextManagerService;

    beforeEach(() => {
        contextManager = getContextManager();
    });

    describe('getContext', () => {
        it('should create new context for unknown project', () => {
            const context = contextManager.getContext('new-project', 'user-1');

            expect(context.projectId).toBe('new-project');
            expect(context.userId).toBe('user-1');
            expect(context.conversationHistory).toEqual([]);
        });

        it('should return same context for same project/user', () => {
            const context1 = contextManager.getContext('project-1', 'user-1');
            const context2 = contextManager.getContext('project-1', 'user-1');

            expect(context1).toBe(context2);
        });
    });

    describe('addMemory', () => {
        it('should add memory entry to context', () => {
            contextManager.addMemory('project-1', 'user-1', {
                role: 'user',
                content: 'Hello',
            });

            const context = contextManager.getContext('project-1', 'user-1');
            expect(context.conversationHistory.length).toBe(1);
            expect(context.conversationHistory[0].content).toBe('Hello');
        });

        it('should include timestamp in memory entry', () => {
            contextManager.addMemory('project-2', 'user-1', {
                role: 'assistant',
                content: 'Response',
            });

            const context = contextManager.getContext('project-2', 'user-1');
            expect(context.conversationHistory[0].timestamp).toBeInstanceOf(Date);
        });
    });

    describe('addGeneratedFile', () => {
        it('should add file to project context', () => {
            contextManager.addGeneratedFile('project-3', 'user-1', 'src/auth.ts');

            const context = contextManager.getContext('project-3', 'user-1');
            expect(context.projectContext.generatedFiles).toContain('src/auth.ts');
        });

        it('should not add duplicate files', () => {
            contextManager.addGeneratedFile('project-4', 'user-1', 'src/test.ts');
            contextManager.addGeneratedFile('project-4', 'user-1', 'src/test.ts');

            const context = contextManager.getContext('project-4', 'user-1');
            expect(context.projectContext.generatedFiles.filter(f => f === 'src/test.ts').length).toBe(1);
        });
    });

    describe('clearContext', () => {
        it('should remove context for project/user', () => {
            contextManager.getContext('project-5', 'user-1');
            contextManager.clearContext('project-5', 'user-1');

            // Getting context again should create fresh one
            const context = contextManager.getContext('project-5', 'user-1');
            expect(context.conversationHistory.length).toBe(0);
        });
    });
});

// ============================================
// AGENT MONITOR TESTS
// ============================================

describe('AgentMonitorService', () => {
    let monitor: AgentMonitorService;

    beforeEach(() => {
        monitor = getAgentMonitor();
    });

    describe('registerAgent', () => {
        it('should register agent with idle status', () => {
            monitor.registerAgent('test-agent');
            const status = monitor.getStatus('test-agent');

            expect(status).toBeDefined();
            expect(status!.status).toBe('idle');
        });
    });

    describe('execution tracking', () => {
        beforeEach(() => {
            monitor.registerAgent('track-agent');
        });

        it('should track execution start', () => {
            monitor.startExecution('track-agent', 'test-task');
            const status = monitor.getStatus('track-agent');

            expect(status!.status).toBe('running');
            expect(status!.currentTask).toBe('test-task');
        });

        it('should track execution completion', () => {
            monitor.startExecution('track-agent', 'complete-task');
            monitor.completeExecution('track-agent', true);

            const status = monitor.getStatus('track-agent');
            expect(status!.status).toBe('completed');
            expect(status!.lastExecution).toBeInstanceOf(Date);
        });

        it('should track execution failure', () => {
            monitor.startExecution('track-agent', 'fail-task');
            monitor.completeExecution('track-agent', false, 'Test error');

            const status = monitor.getStatus('track-agent');
            expect(status!.status).toBe('failed');
        });
    });

    describe('progress updates', () => {
        beforeEach(() => {
            monitor.registerAgent('progress-agent');
            monitor.startExecution('progress-agent', 'progress-task');
        });

        it('should update progress', () => {
            monitor.updateProgress('progress-agent', 50);
            const status = monitor.getStatus('progress-agent');

            expect(status!.progress).toBe(50);
        });

        it('should clamp progress between 0 and 100', () => {
            monitor.updateProgress('progress-agent', 150);
            expect(monitor.getStatus('progress-agent')!.progress).toBe(100);

            monitor.updateProgress('progress-agent', -10);
            expect(monitor.getStatus('progress-agent')!.progress).toBe(0);
        });
    });
});

// ============================================
// AGENT COORDINATOR TESTS
// ============================================

describe('AgentCoordinator', () => {
    let coordinator: AgentCoordinator;

    beforeEach(() => {
        coordinator = getAgentCoordinator();
    });

    describe('createCoordinationTask', () => {
        it('should create task with correct structure', async () => {
            const task = await coordinator.createCoordinationTask(
                'Test Task',
                'primary-agent',
                [
                    { agentId: 'primary-agent', action: 'step1', input: {} },
                    { agentId: 'support-agent', action: 'step2', input: {}, dependsOn: ['step-1'] },
                ]
            );

            expect(task.id).toMatch(/^coord-/);
            expect(task.name).toBe('Test Task');
            expect(task.primaryAgent).toBe('primary-agent');
            expect(task.steps.length).toBe(2);
            expect(task.status).toBe('pending');
        });

        it('should identify supporting agents', async () => {
            const task = await coordinator.createCoordinationTask(
                'Multi-Agent Task',
                'agent-1',
                [
                    { agentId: 'agent-1', action: 'a1', input: {} },
                    { agentId: 'agent-2', action: 'a2', input: {} },
                    { agentId: 'agent-3', action: 'a3', input: {} },
                ]
            );

            expect(task.supportingAgents).toContain('agent-2');
            expect(task.supportingAgents).toContain('agent-3');
            expect(task.supportingAgents).not.toContain('agent-1');
        });
    });

    describe('task management', () => {
        it('should list active tasks', async () => {
            await coordinator.createCoordinationTask('Active 1', 'a', [
                { agentId: 'a', action: 'x', input: {} },
            ]);

            const activeTasks = coordinator.listActiveTasks();
            expect(activeTasks.length).toBeGreaterThan(0);
        });

        it('should get task status', async () => {
            const task = await coordinator.createCoordinationTask('Status Test', 'a', [
                { agentId: 'a', action: 'x', input: {} },
            ]);

            const status = coordinator.getTaskStatus(task.id);
            expect(status).toBeDefined();
            expect(status!.name).toBe('Status Test');
        });

        it('should cancel pending task', async () => {
            const task = await coordinator.createCoordinationTask('Cancel Test', 'a', [
                { agentId: 'a', action: 'x', input: {} },
            ]);

            const cancelled = coordinator.cancelTask(task.id);
            expect(cancelled).toBe(true);
            expect(coordinator.getTaskStatus(task.id)!.status).toBe('failed');
        });
    });
});
