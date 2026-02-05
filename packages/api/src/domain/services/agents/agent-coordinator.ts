/**
 * Agent Coordination Protocol
 * Defines how agents communicate and coordinate with each other
 */

import { getMCPHub, getAgentMonitor } from '../context/core-services.js';
import { getAgentRegistry } from '../../../services/registry/agent-registry.js';

// ============================================
// TYPES
// ============================================

/**
 * Coordination task that involves multiple agents
 */
export interface CoordinationTask {
    id: string;
    name: string;
    primaryAgent: string;
    supportingAgents: string[];
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    steps: CoordinationStep[];
    context: Record<string, unknown>;
    createdAt: Date;
    completedAt?: Date;
}

/**
 * A single step in a coordinated task
 */
export interface CoordinationStep {
    id: string;
    agentId: string;
    action: string;
    input: unknown;
    output?: unknown;
    status: 'pending' | 'running' | 'completed' | 'failed';
    dependsOn: string[];
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}

/**
 * Agent handoff request
 */
export interface HandoffRequest {
    fromAgent: string;
    toAgent: string;
    reason: string;
    context: Record<string, unknown>;
    priority: number;
}

/**
 * Coordination result
 */
export interface CoordinationResult {
    taskId: string;
    success: boolean;
    completedSteps: number;
    totalSteps: number;
    outputs: Record<string, unknown>;
    errors: string[];
    duration: number;
}

// ============================================
// AGENT COORDINATOR
// ============================================

/**
 * AgentCoordinator - Manages multi-agent collaboration
 */
export class AgentCoordinator {
    private activeTasks: Map<string, CoordinationTask> = new Map();
    private static instance: AgentCoordinator;

    static getInstance(): AgentCoordinator {
        if (!AgentCoordinator.instance) {
            AgentCoordinator.instance = new AgentCoordinator();
        }
        return AgentCoordinator.instance;
    }

    /**
     * Create a coordinated task involving multiple agents
     */
    async createCoordinationTask(
        name: string,
        primaryAgentId: string,
        steps: Array<{
            agentId: string;
            action: string;
            input: unknown;
            dependsOn?: string[];
        }>
    ): Promise<CoordinationTask> {
        const taskId = `coord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const supportingAgents = new Set<string>();
        steps.forEach(s => supportingAgents.add(s.agentId));
        supportingAgents.delete(primaryAgentId);

        const task: CoordinationTask = {
            id: taskId,
            name,
            primaryAgent: primaryAgentId,
            supportingAgents: Array.from(supportingAgents),
            status: 'pending',
            steps: steps.map((s, i) => ({
                id: `step-${i + 1}`,
                agentId: s.agentId,
                action: s.action,
                input: s.input,
                status: 'pending',
                dependsOn: s.dependsOn || [],
            })),
            context: {},
            createdAt: new Date(),
        };

        this.activeTasks.set(taskId, task);
        console.log(`📋 Created coordination task: ${name} (${taskId})`);

        return task;
    }

    /**
     * Execute a coordinated task
     */
    async executeCoordinationTask(taskId: string): Promise<CoordinationResult> {
        const task = this.activeTasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const startTime = Date.now();
        task.status = 'in-progress';

        const registry = getAgentRegistry();
        const monitor = getAgentMonitor();
        const mcpHub = getMCPHub();
        const outputs: Record<string, unknown> = {};
        const errors: string[] = [];

        console.log(`🚀 Executing coordination task: ${task.name}`);

        // Execute steps in dependency order
        const completedSteps = new Set<string>();

        while (completedSteps.size < task.steps.length) {
            const pendingSteps = task.steps.filter(s =>
                s.status === 'pending' &&
                s.dependsOn.every(dep => completedSteps.has(dep))
            );

            if (pendingSteps.length === 0 && completedSteps.size < task.steps.length) {
                // Deadlock or circular dependency
                errors.push('Deadlock detected in task dependencies');
                break;
            }

            // Execute all ready steps in parallel
            await Promise.all(pendingSteps.map(async (step) => {
                const agent = registry.getById(step.agentId);
                if (!agent) {
                    step.status = 'failed';
                    step.error = `Agent ${step.agentId} not found`;
                    errors.push(step.error);
                    completedSteps.add(step.id);
                    return;
                }

                step.status = 'running';
                step.startedAt = new Date();
                monitor.startExecution(step.agentId, step.action);

                // Notify other agents
                mcpHub.send(
                    'coordinator',
                    step.agentId,
                    'notification',
                    { action: 'stepStarted', stepId: step.id, taskId }
                );

                try {
                    // Inject context from previous steps
                    const enrichedInput = {
                        ...(step.input as Record<string, unknown>),
                        __context: task.context,
                        __previousOutputs: outputs,
                    };

                    const result = await agent.execute({
                        task: step.action,
                        context: enrichedInput,
                    });

                    step.output = result;
                    step.status = 'completed';
                    step.completedAt = new Date();
                    outputs[step.id] = result;

                    // Update shared context
                    if (result.metadata) {
                        Object.assign(task.context, result.metadata);
                    }

                    monitor.completeExecution(step.agentId, true);
                    console.log(`   ✅ Step ${step.id} completed by ${step.agentId}`);

                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    step.status = 'failed';
                    step.error = errorMsg;
                    step.completedAt = new Date();
                    errors.push(`Step ${step.id}: ${errorMsg}`);

                    monitor.completeExecution(step.agentId, false, errorMsg);
                    console.log(`   ❌ Step ${step.id} failed: ${errorMsg}`);
                }

                completedSteps.add(step.id);
            }));
        }

        // Finalize task
        const allSucceeded = task.steps.every(s => s.status === 'completed');
        task.status = allSucceeded ? 'completed' : 'failed';
        task.completedAt = new Date();

        const result: CoordinationResult = {
            taskId,
            success: allSucceeded,
            completedSteps: task.steps.filter(s => s.status === 'completed').length,
            totalSteps: task.steps.length,
            outputs,
            errors,
            duration: Date.now() - startTime,
        };

        console.log(`📋 Coordination task ${task.name}: ${allSucceeded ? 'SUCCESS' : 'FAILED'}`);
        return result;
    }

    /**
     * Request handoff between agents
     */
    async requestHandoff(request: HandoffRequest): Promise<boolean> {
        const registry = getAgentRegistry();
        const mcpHub = getMCPHub();

        const fromAgent = registry.getById(request.fromAgent);
        const toAgent = registry.getById(request.toAgent);

        if (!fromAgent || !toAgent) {
            console.error(`Handoff failed: Agent not found`);
            return false;
        }

        console.log(`🔄 Handoff: ${request.fromAgent} → ${request.toAgent}`);
        console.log(`   Reason: ${request.reason}`);

        // Send handoff notification
        mcpHub.send(request.fromAgent, request.toAgent, 'request', {
            type: 'handoff',
            reason: request.reason,
            context: request.context,
            priority: request.priority,
        });

        return true;
    }

    /**
     * Get status of a coordination task
     */
    getTaskStatus(taskId: string): CoordinationTask | undefined {
        return this.activeTasks.get(taskId);
    }

    /**
     * List all active tasks
     */
    listActiveTasks(): CoordinationTask[] {
        return Array.from(this.activeTasks.values()).filter(
            t => t.status === 'pending' || t.status === 'in-progress'
        );
    }

    /**
     * Get all tasks
     */
    getAllTasks(): CoordinationTask[] {
        return Array.from(this.activeTasks.values());
    }

    /**
     * Cancel a task
     */
    cancelTask(taskId: string): boolean {
        const task = this.activeTasks.get(taskId);
        if (!task) return false;

        if (task.status === 'pending' || task.status === 'in-progress') {
            task.status = 'failed';
            task.completedAt = new Date();
            console.log(`❌ Cancelled coordination task: ${task.name}`);
            return true;
        }

        return false;
    }
}

// ============================================
// SINGLETON EXPORTS
// ============================================

let coordinator: AgentCoordinator | null = null;

export function getAgentCoordinator(): AgentCoordinator {
    if (!coordinator) {
        coordinator = AgentCoordinator.getInstance();
    }
    return coordinator;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a simple sequential coordination task
 */
export async function coordinateSequential(
    agents: string[],
    task: string,
    initialInput: unknown
): Promise<CoordinationResult> {
    const coordinator = getAgentCoordinator();

    const steps = agents.map((agentId, index) => ({
        agentId,
        action: task,
        input: index === 0 ? initialInput : {},
        dependsOn: index > 0 ? [`step-${index}`] : [],
    }));

    const coordTask = await coordinator.createCoordinationTask(
        `Sequential: ${task}`,
        agents[0],
        steps
    );

    return coordinator.executeCoordinationTask(coordTask.id);
}

/**
 * Create a parallel coordination task (all agents run simultaneously)
 */
export async function coordinateParallel(
    agents: string[],
    task: string,
    input: unknown
): Promise<CoordinationResult> {
    const coordinator = getAgentCoordinator();

    const steps = agents.map(agentId => ({
        agentId,
        action: task,
        input,
        dependsOn: [], // No dependencies = parallel
    }));

    const coordTask = await coordinator.createCoordinationTask(
        `Parallel: ${task}`,
        agents[0],
        steps
    );

    return coordinator.executeCoordinationTask(coordTask.id);
}
