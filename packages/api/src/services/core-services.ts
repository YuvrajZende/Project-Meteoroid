/**
 * Orchestrator Core Services Integration
 * Bridges the orchestrator core components with the API server
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Thinking trace from the thinking engine
 */
export interface ThinkingTrace {
    id: string;
    phase: string;
    thought: string;
    confidence: number;
    timestamp: Date;
}

/**
 * Task analysis result
 */
export interface TaskAnalysis {
    task: string;
    requirements: string[];
    suggestedAgents: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedSteps: number;
    subTasks?: SubTask[];
}

/**
 * Sub-task breakdown
 */
export interface SubTask {
    id: string;
    description: string;
    agent: string;
    dependencies: string[];
    priority: number;
}

/**
 * Context window for an agent
 */
export interface ContextWindow {
    projectId: string;
    userId: string;
    conversationHistory: MemoryEntry[];
    projectContext: ProjectContext;
    activeAgents: string[];
}

/**
 * Memory entry in context
 */
export interface MemoryEntry {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

/**
 * Project-specific context
 */
export interface ProjectContext {
    name: string;
    description?: string;
    techStack?: string[];
    generatedFiles: string[];
    lastUpdated: Date;
}

/**
 * Agent execution status
 */
export interface AgentExecutionStatus {
    agentId: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    currentTask?: string;
    progress?: number;
    lastExecution?: Date;
}

/**
 * MCP Message for inter-agent communication
 */
export interface MCPMessage {
    id: string;
    from: string;
    to: string;
    type: 'request' | 'response' | 'broadcast' | 'notification';
    payload: unknown;
    timestamp: Date;
}

// ============================================
// THINKING ENGINE SERVICE
// ============================================

/**
 * ThinkingEngineService - Task analysis and planning
 */
export class ThinkingEngineService {
    private traces: ThinkingTrace[] = [];

    /**
     * Analyze a task and plan execution
     */
    async analyzeTask(task: string, _context?: Record<string, unknown>): Promise<TaskAnalysis> {

        // Add trace
        this.addTrace('analysis', `Analyzing task: ${task.substring(0, 50)}...`, 0.8);

        // Analyze task keywords
        const taskLower = task.toLowerCase();
        const requirements: string[] = [];
        const suggestedAgents: string[] = [];

        // Keyword matching for requirements
        if (taskLower.includes('auth') || taskLower.includes('login')) {
            requirements.push('Authentication system');
            suggestedAgents.push('auth-agent');
        }
        if (taskLower.includes('security') || taskLower.includes('protect')) {
            requirements.push('Security middleware');
            suggestedAgents.push('security-agent');
        }
        if (taskLower.includes('monitor') || taskLower.includes('log')) {
            requirements.push('Monitoring/Logging');
            suggestedAgents.push('monitoring-agent');
        }
        if (taskLower.includes('api') || taskLower.includes('rest')) {
            requirements.push('API endpoints');
        }
        if (taskLower.includes('database') || taskLower.includes('db')) {
            requirements.push('Database integration');
        }

        // Default if nothing matched
        if (requirements.length === 0) {
            requirements.push('General code generation');
            suggestedAgents.push('auth-agent');
        }

        // Determine complexity
        const wordCount = task.split(' ').length;
        const complexity = wordCount < 15 ? 'simple' : wordCount < 40 ? 'moderate' : 'complex';

        this.addTrace('planning', `Identified ${requirements.length} requirements`, 0.9);

        return {
            task,
            requirements,
            suggestedAgents,
            complexity,
            estimatedSteps: suggestedAgents.length * 3 + 2,
            subTasks: suggestedAgents.map((agent, i) => ({
                id: `subtask-${i + 1}`,
                description: `Execute ${agent}`,
                agent,
                dependencies: i > 0 ? [`subtask-${i}`] : [],
                priority: suggestedAgents.length - i,
            })),
        };
    }

    /**
     * Add a thinking trace
     */
    private addTrace(phase: string, thought: string, confidence: number): void {
        this.traces.push({
            id: `trace-${Date.now()}`,
            phase,
            thought,
            confidence,
            timestamp: new Date(),
        });
    }

    /**
     * Get all traces
     */
    getTraces(): ThinkingTrace[] {
        return [...this.traces];
    }

    /**
     * Clear traces
     */
    clearTraces(): void {
        this.traces = [];
    }
}

// ============================================
// CONTEXT MANAGER SERVICE
// ============================================

/**
 * ContextManagerService - Working memory management
 */
export class ContextManagerService {
    private contexts: Map<string, ContextWindow> = new Map();
    private maxHistoryLength = 50;

    /**
     * Get or create context for a project
     */
    getContext(projectId: string, userId: string): ContextWindow {
        const key = `${projectId}:${userId}`;

        if (!this.contexts.has(key)) {
            this.contexts.set(key, {
                projectId,
                userId,
                conversationHistory: [],
                projectContext: {
                    name: 'New Project',
                    generatedFiles: [],
                    lastUpdated: new Date(),
                },
                activeAgents: [],
            });
        }

        return this.contexts.get(key)!;
    }

    /**
     * Add memory entry to context
     */
    addMemory(projectId: string, userId: string, entry: Omit<MemoryEntry, 'timestamp'>): void {
        const context = this.getContext(projectId, userId);

        context.conversationHistory.push({
            ...entry,
            timestamp: new Date(),
        });

        // Trim if too long
        if (context.conversationHistory.length > this.maxHistoryLength) {
            context.conversationHistory = context.conversationHistory.slice(-this.maxHistoryLength);
        }

        context.projectContext.lastUpdated = new Date();
    }

    /**
     * Add generated file to context
     */
    addGeneratedFile(projectId: string, userId: string, filePath: string): void {
        const context = this.getContext(projectId, userId);
        if (!context.projectContext.generatedFiles.includes(filePath)) {
            context.projectContext.generatedFiles.push(filePath);
        }
    }

    /**
     * Update project context
     */
    updateProjectContext(projectId: string, userId: string, updates: Partial<ProjectContext>): void {
        const context = this.getContext(projectId, userId);
        Object.assign(context.projectContext, updates, { lastUpdated: new Date() });
    }

    /**
     * Clear context for a project
     */
    clearContext(projectId: string, userId: string): void {
        this.contexts.delete(`${projectId}:${userId}`);
    }
}

// ============================================
// AGENT MONITOR SERVICE
// ============================================

/**
 * AgentMonitorService - Track agent status and execution
 */
export class AgentMonitorService {
    private agentStatus: Map<string, AgentExecutionStatus> = new Map();
    private executionHistory: Array<{
        agentId: string;
        task: string;
        startTime: Date;
        endTime?: Date;
        success?: boolean;
        error?: string;
    }> = [];

    /**
     * Register an agent
     */
    registerAgent(agentId: string): void {
        this.agentStatus.set(agentId, {
            agentId,
            status: 'idle',
        });
    }

    /**
     * Mark agent as running
     */
    startExecution(agentId: string, task: string): void {
        const status = this.agentStatus.get(agentId);
        if (status) {
            status.status = 'running';
            status.currentTask = task;
            status.progress = 0;
        }

        this.executionHistory.push({
            agentId,
            task,
            startTime: new Date(),
        });
    }

    /**
     * Update execution progress
     */
    updateProgress(agentId: string, progress: number): void {
        const status = this.agentStatus.get(agentId);
        if (status) {
            status.progress = Math.min(100, Math.max(0, progress));
        }
    }

    /**
     * Mark execution as complete
     */
    completeExecution(agentId: string, success: boolean, error?: string): void {
        const status = this.agentStatus.get(agentId);
        if (status) {
            status.status = success ? 'completed' : 'failed';
            status.lastExecution = new Date();
            status.currentTask = undefined;
            status.progress = undefined;
        }

        // Update history (find last matching entry)
        for (let i = this.executionHistory.length - 1; i >= 0; i--) {
            const entry = this.executionHistory[i];
            if (entry.agentId === agentId && !entry.endTime) {
                entry.endTime = new Date();
                entry.success = success;
                entry.error = error;
                break;
            }
        }
    }

    /**
     * Get all agent statuses
     */
    getAllStatus(): AgentExecutionStatus[] {
        return Array.from(this.agentStatus.values());
    }

    /**
     * Get agent status
     */
    getStatus(agentId: string): AgentExecutionStatus | undefined {
        return this.agentStatus.get(agentId);
    }

    /**
     * Get execution history
     */
    getHistory(limit = 100): typeof this.executionHistory {
        return this.executionHistory.slice(-limit);
    }
}

// ============================================
// MCP HUB SERVICE
// ============================================

/**
 * MCPHubService - Inter-agent communication
 */
export class MCPHubService {
    private messageQueue: MCPMessage[] = [];
    private handlers: Map<string, ((message: MCPMessage) => void)[]> = new Map();

    /**
     * Send message between agents
     */
    send(from: string, to: string, type: MCPMessage['type'], payload: unknown): string {
        const message: MCPMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            from,
            to,
            type,
            payload,
            timestamp: new Date(),
        };

        this.messageQueue.push(message);

        // Notify handlers
        const targetHandlers = this.handlers.get(to) || [];
        targetHandlers.forEach(handler => handler(message));

        // Broadcast handlers
        if (type === 'broadcast') {
            this.handlers.forEach((handlers, agentId) => {
                if (agentId !== from) {
                    handlers.forEach(handler => handler(message));
                }
            });
        }

        return message.id;
    }

    /**
     * Subscribe to messages
     */
    subscribe(agentId: string, handler: (message: MCPMessage) => void): () => void {
        if (!this.handlers.has(agentId)) {
            this.handlers.set(agentId, []);
        }
        this.handlers.get(agentId)!.push(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(agentId);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index > -1) handlers.splice(index, 1);
            }
        };
    }

    /**
     * Get pending messages for an agent
     */
    getPending(agentId: string): MCPMessage[] {
        return this.messageQueue.filter(m => m.to === agentId);
    }

    /**
     * Clear message queue
     */
    clearQueue(): void {
        this.messageQueue = [];
    }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

let thinkingEngine: ThinkingEngineService | null = null;
let contextManager: ContextManagerService | null = null;
let agentMonitor: AgentMonitorService | null = null;
let mcpHub: MCPHubService | null = null;

export function getThinkingEngine(): ThinkingEngineService {
    if (!thinkingEngine) {
        thinkingEngine = new ThinkingEngineService();
    }
    return thinkingEngine;
}

export function getContextManager(): ContextManagerService {
    if (!contextManager) {
        contextManager = new ContextManagerService();
    }
    return contextManager;
}

export function getAgentMonitor(): AgentMonitorService {
    if (!agentMonitor) {
        agentMonitor = new AgentMonitorService();
    }
    return agentMonitor;
}

export function getMCPHub(): MCPHubService {
    if (!mcpHub) {
        mcpHub = new MCPHubService();
    }
    return mcpHub;
}

/**
 * Initialize all core services
 */
export function initializeCoreServices(): {
    thinkingEngine: ThinkingEngineService;
    contextManager: ContextManagerService;
    agentMonitor: AgentMonitorService;
    mcpHub: MCPHubService;
} {
    console.log('🧠 Initializing Core Services...');

    const services = {
        thinkingEngine: getThinkingEngine(),
        contextManager: getContextManager(),
        agentMonitor: getAgentMonitor(),
        mcpHub: getMCPHub(),
    };

    console.log('   ✅ ThinkingEngine ready');
    console.log('   ✅ ContextManager ready');
    console.log('   ✅ AgentMonitor ready');
    console.log('   ✅ MCPHub ready');

    return services;
}
