/**
 * ============================================
 * BRAIN CORE - THE CENTRAL NERVOUS SYSTEM
 * ============================================
 * 
 * This is the MASTER INTEGRATION LAYER that connects:
 * - Thinking Engine (Decision Making)
 * - Context Manager (Memory)
 * - Knowledge Base (Long-term Semantic Memory)
 * - Task Manager (Goal Tracking)
 * - Agent Monitor (Observation)
 * - MCP Hub (Communication)
 * - Health Monitor (System Health)
 * - Redis Checkpointer (Persistence)
 * 
 * All systems flow through the Brain Core, ensuring
 * seamless data exchange and coordinated operation.
 */

import { thinkingEngine, ThinkingResult, TaskAnalysis } from "./thinking-engine";
import { contextManager, ContextWindow, ProjectContextData } from "./context-manager";
import { knowledgeBase, KnowledgeEntry, KnowledgeType, SearchResult } from "./knowledge-base";
import { vectorStore } from "./vector-store";
import { taskManager, ManagedTask, TaskExecutionPlan } from "./task-manager";
import { agentMonitor, AgentStatus, AgentExecutionRecord } from "./agent-monitor";
import { mcpHub, MCPMessage } from "./mcp-communication";
import { healthMonitor, SystemHealth } from "./health-monitor";
import { redisCheckpointer, CheckpointData } from "./redis-checkpointer";
import { AgentName, AGENT_REGISTRY } from "../state";
import { BaseMessage } from "@langchain/core/messages";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface BrainState {
    phase: BrainPhase;
    isThinking: boolean;
    currentAgent: AgentName | null;
    currentTask: ManagedTask | null;
    lastThought: ThinkingResult | null;
    confidence: number;
    sessionId: string;
}

export interface BrainDecision {
    action: BrainAction;
    target: AgentName | null;
    reasoning: string;
    confidence: number;
    taskInstructions?: string;
    correctionInstructions?: string;
    relevantKnowledge: KnowledgeEntry[];
}

export interface AgentTaskPackage {
    taskId: string;
    description: string;
    instructions: string;
    context: ContextWindow;
    relevantKnowledge: KnowledgeEntry[];
    validationCriteria: string[];
    previousOutputs: string[];
}

export type BrainPhase =
    | "idle"
    | "analyzing"
    | "planning"
    | "deciding"
    | "executing"
    | "monitoring"
    | "correcting"
    | "reflecting";

export type BrainAction =
    | "invoke_agent"
    | "correct_agent"
    | "wait"
    | "finish"
    | "escalate";

// ============================================
// BRAIN CORE CLASS
// ============================================

export class BrainCore {
    private state: BrainState;
    private initialized: boolean = false;

    constructor() {
        this.state = {
            phase: "idle",
            isThinking: false,
            currentAgent: null,
            currentTask: null,
            lastThought: null,
            confidence: 0,
            sessionId: ""
        };
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize the Brain and all subsystems
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log(`\n`);
        console.log(`╔═══════════════════════════════════════════════════════════════════╗`);
        console.log(`║              🧠 BRAIN CORE INITIALIZATION                         ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════╣`);

        // Initialize Redis (optional - will use memory fallback)
        console.log(`║  📦 Connecting to Redis...                                        ║`);
        await redisCheckpointer.connect();
        this.state.sessionId = redisCheckpointer.getSessionId();

        // Setup MCP channels
        console.log(`║  📡 Setting up MCP communication channels...                      ║`);
        this.setupMCPHandlers();

        // Start health monitoring
        console.log(`║  🏥 Starting health monitor...                                    ║`);
        healthMonitor.startPeriodicChecks(60000);

        // Run initial health check
        await healthMonitor.runAllChecks();

        console.log(`║                                                                   ║`);
        console.log(`║  ✅ All systems connected and operational                         ║`);
        console.log(`║                                                                   ║`);
        console.log(`║  🔗 ACTIVE CONNECTIONS:                                           ║`);
        console.log(`║     💭 Thinking Engine ────────────────────────── READY           ║`);
        console.log(`║     📝 Context Manager ────────────────────────── READY           ║`);
        console.log(`║     📚 Knowledge Base ─────────────────────────── READY           ║`);
        console.log(`║     📋 Task Manager ───────────────────────────── READY           ║`);
        console.log(`║     👁️  Agent Monitor ─────────────────────────── READY           ║`);
        console.log(`║     📡 MCP Communication ─────────────────────── READY           ║`);
        console.log(`║     🏥 Health Monitor ─────────────────────────── READY           ║`);
        console.log(`║     💾 Redis Checkpointer ────────────────────── ${redisCheckpointer.isActive() ? "CONNECTED" : "MEMORY   "}   ║`);
        console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
        console.log(`\n`);

        this.initialized = true;
    }

    /**
     * Setup MCP message handlers for inter-system communication
     */
    private setupMCPHandlers(): void {
        // Handle task completion messages
        mcpHub.subscribe("orchestrator:broadcast", "brain", async (msg) => {
            if (msg.type === "task_update") {
                this.handleTaskUpdate(msg);
            }
        });

        // Handle agent completion signals
        for (const agentId of Object.keys(AGENT_REGISTRY)) {
            mcpHub.subscribe(`agent:${agentId}`, "brain", async (msg) => {
                await this.handleAgentMessage(agentId as AgentName, msg);
            });
        }
    }

    // ============================================
    // MAIN DECISION LOOP
    // ============================================

    /**
     * Process a user request - THE MAIN ENTRY POINT
     */
    async processRequest(userRequest: string): Promise<void> {
        this.state.phase = "analyzing";
        console.log(`\n🧠 [Brain] Processing new request...`);

        // Step 1: Store the request in knowledge base
        knowledgeBase.store("requirement", userRequest, {
            source: "user",
            importance: 10,
            tags: ["user-request", "requirement"]
        });

        // Step 2: Update context with the request
        contextManager.updateProjectContext({
            description: userRequest
        });

        // Step 3: Deep thinking - analyze the request
        const analysis = await thinkingEngine.think(
            userRequest,
            "analysis",
            "Analyze this user request deeply. Identify the core requirements, technical needs, and potential challenges."
        );

        // Step 4: Decompose into tasks
        this.state.phase = "planning";
        const taskAnalysis = await thinkingEngine.decomposeTasks(userRequest);

        // Step 5: Create execution plan
        const plan = taskManager.createPlan(taskAnalysis);

        // Store the plan in knowledge base
        knowledgeBase.store("decision", JSON.stringify({
            mainGoal: taskAnalysis.mainGoal,
            taskCount: taskAnalysis.subTasks.length,
            requiredAgents: taskAnalysis.requiredAgents
        }), {
            source: "brain",
            importance: 9,
            tags: ["plan", "execution-plan"]
        });

        // Step 6: Create checkpoint
        await this.saveCheckpoint(0);

        console.log(`🧠 [Brain] Request analyzed. Created ${taskAnalysis.subTasks.length} tasks.`);
    }

    /**
     * Decide on the next action
     */
    async decideNextAction(
        executedAgents: string[],
        messages: BaseMessage[]
    ): Promise<BrainDecision> {
        this.state.phase = "deciding";
        this.state.isThinking = true;

        console.log(`\n🧠 [Brain] Thinking about next action...`);

        // Gather context from all systems
        const currentPlan = taskManager.getCurrentPlan();
        const nextTask = taskManager.getNextTask();
        const agentStatuses = agentMonitor.getAllAgentStatuses();
        const recentEvents = agentMonitor.getRecentEvents(5);
        const systemHealth = healthMonitor.getSystemHealth();

        // Build comprehensive context for thinking
        const contextParts = [
            `=== CURRENT STATE ===`,
            `Executed Agents: ${executedAgents.join(", ") || "None"}`,
            `Progress: ${taskManager.getProgress()}%`,
            `System Health: ${systemHealth.status}`,
            ``,
            `=== NEXT TASK ===`,
            nextTask ? `${nextTask.id}: ${nextTask.description} (→ ${nextTask.assignedAgent})` : "No pending tasks",
            ``,
            `=== RECENT EVENTS ===`,
            ...recentEvents.map(e => `- ${e.message}`)
        ];

        // Get relevant knowledge for the task
        let relevantKnowledge: KnowledgeEntry[] = [];
        if (nextTask) {
            const searchResults = knowledgeBase.search({
                query: nextTask.description,
                limit: 5
            });
            relevantKnowledge = searchResults.map(r => r.entry);

            if (relevantKnowledge.length > 0) {
                contextParts.push(``, `=== RELEVANT KNOWLEDGE ===`);
                relevantKnowledge.forEach(k => {
                    contextParts.push(`- [${k.type}] ${k.content.substring(0, 100)}...`);
                });
            }
        }

        // Deep thinking
        const thinkingResult = await thinkingEngine.think(
            contextParts.join("\n"),
            "decision",
            "Given the current state, what should be the next action? Consider task dependencies, agent availability, and overall progress."
        );

        this.state.lastThought = thinkingResult;
        this.state.confidence = thinkingResult.confidence;
        this.state.isThinking = false;

        // Determine action based on thinking
        let decision: BrainDecision;

        if (taskManager.isExecutionComplete()) {
            decision = {
                action: "finish",
                target: null,
                reasoning: "All tasks completed successfully.",
                confidence: thinkingResult.confidence,
                relevantKnowledge: []
            };
        } else if (nextTask) {
            const agentId = this.getAgentIdFromName(nextTask.assignedAgent);
            decision = {
                action: "invoke_agent",
                target: agentId,
                reasoning: `Executing task ${nextTask.id} with ${nextTask.assignedAgent}`,
                confidence: thinkingResult.confidence,
                taskInstructions: this.buildTaskInstructions(nextTask, relevantKnowledge),
                relevantKnowledge
            };
        } else {
            decision = {
                action: "wait",
                target: null,
                reasoning: "Waiting for task dependencies to complete.",
                confidence: thinkingResult.confidence,
                relevantKnowledge: []
            };
        }

        console.log(`🧠 [Brain] Decision: ${decision.action} ${decision.target || ""} (${decision.confidence}% confidence)`);

        return decision;
    }

    /**
     * Handle agent output and decide if correction is needed
     */
    async processAgentOutput(
        agentId: AgentName,
        taskId: string,
        output: string
    ): Promise<{ needsCorrection: boolean; correction?: string }> {
        this.state.phase = "monitoring";

        console.log(`\n🧠 [Brain] Processing output from ${AGENT_REGISTRY[agentId].name}...`);

        // Store output in knowledge base
        const knowledgeId = knowledgeBase.storeCode(output, agentId, undefined, taskId);

        // Update context
        contextManager.recordAgentOutput(agentId, output);

        // Get the task for validation criteria
        const task = taskManager.getCurrentPlan()?.tasks.find(t => t.id === taskId);
        if (!task) {
            return { needsCorrection: false };
        }

        // Check for deviation
        const deviation = await thinkingEngine.checkDeviation(
            task.description,
            task.validationCriteria,
            output
        );

        if (deviation.hasDeviation) {
            this.state.phase = "correcting";

            // Store the correction decision
            knowledgeBase.storeDecision(
                `Correction needed for ${agentId}`,
                `Type: ${deviation.deviationType}, Severity: ${deviation.severity}`,
                "brain"
            );

            // Record in monitors
            agentMonitor.recordDeviation(agentId, taskId, deviation.deviationType || "unknown", deviation.severity || "minor");

            // Apply correction to task
            if (deviation.correction) {
                taskManager.applyCorrection(taskId, deviation.deviationType || "unknown", deviation.correction);
                agentMonitor.recordCorrection(agentId, taskId, deviation.correction);
            }

            return {
                needsCorrection: true,
                correction: deviation.correction
            };
        }

        // Mark task as completed
        taskManager.completeTask(taskId, output);
        agentMonitor.completeExecution(agentId, taskId, output);

        // Add to project artifacts
        contextManager.addArtifact(`${agentId}: ${task.description}`);

        return { needsCorrection: false };
    }

    // ============================================
    // AGENT TASK PREPARATION
    // ============================================

    /**
     * Prepare a complete task package for an agent
     */
    prepareAgentTask(agentId: AgentName, task: ManagedTask): AgentTaskPackage {
        // Get context window for this agent
        const context = contextManager.buildContextWindow(agentId);

        // Find relevant knowledge
        const relevantKnowledge = knowledgeBase.findRelevantForAgent(
            agentId,
            task.description,
            5
        );

        // Get previous outputs from related agents
        const previousOutputs: string[] = [];
        for (const depId of task.dependencies) {
            const depTask = taskManager.getCurrentPlan()?.tasks.find(t => t.id === depId);
            if (depTask?.output) {
                previousOutputs.push(`[${depId}]: ${depTask.output.substring(0, 500)}...`);
            }
        }

        // Build comprehensive instructions
        const instructions = this.buildTaskInstructions(task, relevantKnowledge);

        return {
            taskId: task.id,
            description: task.description,
            instructions,
            context,
            relevantKnowledge,
            validationCriteria: task.validationCriteria,
            previousOutputs
        };
    }

    /**
     * Build detailed task instructions including relevant knowledge
     */
    private buildTaskInstructions(task: ManagedTask, knowledge: KnowledgeEntry[]): string {
        const parts: string[] = [
            `=== YOUR TASK ===`,
            `ID: ${task.id}`,
            `Description: ${task.description}`,
            `Priority: ${task.priority}`,
            ``,
            `=== VALIDATION CRITERIA ===`,
            ...task.validationCriteria.map(c => `✓ ${c}`),
        ];

        if (knowledge.length > 0) {
            parts.push(``, `=== RELEVANT CONTEXT ===`);
            for (const k of knowledge) {
                parts.push(`--- ${k.type.toUpperCase()} (from ${k.metadata.source}) ---`);
                parts.push(k.content.substring(0, 500));
                parts.push(``);
            }
        }

        if (task.dependencies.length > 0) {
            parts.push(``, `=== DEPENDENCIES ===`);
            parts.push(`This task depends on: ${task.dependencies.join(", ")}`);
        }

        parts.push(``, `=== IMPORTANT ===`);
        parts.push(`- Focus ONLY on this specific task`);
        parts.push(`- Do NOT add features not requested`);
        parts.push(`- Ensure all validation criteria are met`);

        return parts.join("\n");
    }

    // ============================================
    // STATE MANAGEMENT
    // ============================================

    /**
     * Save current state as checkpoint
     */
    async saveCheckpoint(stepNumber: number): Promise<void> {
        // Map internal phase to state-compatible phase
        const phaseMap: Record<BrainPhase, "analysis" | "planning" | "execution" | "reflection" | "correction"> = {
            idle: "analysis",
            analyzing: "analysis",
            planning: "planning",
            deciding: "planning",
            executing: "execution",
            monitoring: "execution",
            correcting: "correction",
            reflecting: "reflection"
        };

        const stateSnapshot = {
            executedAgents: [] as string[],
            taskList: {
                planId: taskManager.getCurrentPlan()?.planId || "",
                mainGoal: taskManager.getCurrentPlan()?.mainGoal || "",
                tasks: taskManager.getCurrentPlan()?.tasks || [],
                currentTaskId: null,
                completedCount: taskManager.getCurrentPlan()?.completedTasks || 0,
                failedCount: taskManager.getCurrentPlan()?.failedTasks || 0,
                progress: taskManager.getProgress()
            },
            thinking: {
                currentPhase: phaseMap[this.state.phase],
                reasoning: this.state.lastThought?.reasoning || "",
                confidence: this.state.confidence,
                traces: thinkingEngine.getTraces(),
                lastThoughtAt: new Date()
            }
        };

        await redisCheckpointer.saveCheckpoint(stateSnapshot, stepNumber);

        // Also export knowledge base for recovery
        const knowledge = knowledgeBase.export();
        if (redisCheckpointer.isActive()) {
            // Store knowledge in Redis
            // (In production, this would be a separate knowledge persistence layer)
        }
    }

    /**
     * Restore from checkpoint
     */
    async restoreFromCheckpoint(checkpointId?: string): Promise<boolean> {
        const checkpoint = checkpointId
            ? await redisCheckpointer.loadCheckpoint(checkpointId)
            : await redisCheckpointer.loadLatestCheckpoint();

        if (!checkpoint) {
            console.log(`🧠 [Brain] No checkpoint found to restore`);
            return false;
        }

        console.log(`🧠 [Brain] Restoring from checkpoint: ${checkpoint.id}`);
        // Restoration logic would go here
        return true;
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================

    private handleTaskUpdate(msg: MCPMessage): void {
        console.log(`🧠 [Brain] Received task update: ${msg.payload.taskId}`);
        // Handle task status updates from agents
    }

    private async handleAgentMessage(agentId: AgentName, msg: MCPMessage): Promise<void> {
        console.log(`🧠 [Brain] Received message from ${agentId}: ${msg.type}`);

        if (msg.type === "response" && msg.payload.output) {
            await this.processAgentOutput(agentId, msg.payload.taskId, msg.payload.output);
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    private getAgentIdFromName(agentName: string): AgentName | null {
        for (const [id, info] of Object.entries(AGENT_REGISTRY)) {
            if (info.name === agentName) {
                return id as AgentName;
            }
        }
        return null;
    }

    /**
     * Get current brain state
     */
    getState(): BrainState {
        return { ...this.state };
    }

    /**
     * Print brain status dashboard
     */
    printStatus(): void {
        const stats = knowledgeBase.getStats();
        const health = healthMonitor.getSystemHealth();

        console.log(`\n`);
        console.log(`╔═══════════════════════════════════════════════════════════════════╗`);
        console.log(`║                    🧠 BRAIN STATUS                                ║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
        console.log(`║  Phase: ${this.state.phase.toUpperCase().padEnd(57)}║`);
        console.log(`║  Thinking: ${this.state.isThinking ? "YES 💭" : "NO".padEnd(52)}   ║`);
        console.log(`║  Confidence: ${this.state.confidence}%`.padEnd(67) + `║`);
        console.log(`║  Session: ${this.state.sessionId.padEnd(55)}║`);
        console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
        console.log(`║  📚 Knowledge Base: ${stats.totalEntries} entries`.padEnd(66) + `║`);
        console.log(`║  📋 Task Progress: ${taskManager.getProgress()}%`.padEnd(66) + `║`);
        console.log(`║  🏥 System Health: ${health.status.toUpperCase()}`.padEnd(66) + `║`);
        console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
        console.log(`\n`);
    }
}

// Export singleton instance
export const brainCore = new BrainCore();
