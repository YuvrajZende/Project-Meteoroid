/**
 * ============================================
 * CONTEXT MANAGER - MEMORY & CONTEXT HANDLING
 * ============================================
 * 
 * Implements context management for the orchestrator:
 * - Short-term memory (current session)
 * - Long-term memory (persistent data)
 * - Context windowing for LLM calls
 * - Conversation summarization
 */

import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// ============================================
// TYPES AND INTERFACES
// ============================================

export interface ContextWindow {
    messages: BaseMessage[];
    systemContext: string;
    agentContext: Record<string, AgentContext>;
    projectContext: ProjectContextData;
}

export interface AgentContext {
    agentId: string;
    lastOutput: string | null;
    outputSummary: string | null;
    executionCount: number;
    capabilities: string[];
}

export interface ProjectContextData {
    name: string;
    description: string;
    techStack: string[];
    requirements: string[];
    generatedArtifacts: string[];
}

export interface MemoryEntry {
    id: string;
    timestamp: Date;
    type: "conversation" | "artifact" | "decision" | "correction";
    content: string;
    metadata: Record<string, any>;
}

export interface ConversationSummary {
    mainGoal: string;
    keyDecisions: string[];
    completedTasks: string[];
    pendingTasks: string[];
    artifacts: string[];
}

// ============================================
// CONTEXT MANAGER CLASS
// ============================================

export class ContextManager {
    private shortTermMemory: MemoryEntry[] = [];
    private agentContexts: Map<string, AgentContext> = new Map();
    private projectContext: ProjectContextData;
    private conversationHistory: BaseMessage[] = [];
    private summaries: ConversationSummary[] = [];
    private maxContextTokens: number;
    private model: ChatOpenAI | null = null;

    constructor(maxContextTokens: number = 8000) {
        this.maxContextTokens = maxContextTokens;
        this.projectContext = {
            name: "",
            description: "",
            techStack: [],
            requirements: [],
            generatedArtifacts: []
        };
        this.initializeAgentContexts();
    }

    /**
     * Initialize context for all agents
     */
    private initializeAgentContexts(): void {
        const agents = [
            { id: "auth_agent", capabilities: ["JWT", "OAuth", "RBAC", "Clerk", "Session management"] },
            { id: "db_agent", capabilities: ["Prisma", "Drizzle", "PostgreSQL", "MongoDB", "Migrations"] },
            { id: "api_agent", capabilities: ["REST", "GraphQL", "tRPC", "OpenAPI", "Validation"] },
            { id: "security_agent", capabilities: ["SAST", "DAST", "Secret detection", "CORS", "Rate limiting"] },
            { id: "queue_agent", capabilities: ["Redis", "BullMQ", "Background jobs", "Pub/Sub"] },
            { id: "cicd_agent", capabilities: ["GitHub Actions", "Docker", "Kubernetes", "Deployment"] },
            { id: "monitoring_agent", capabilities: ["Logging", "Metrics", "Health checks", "Alerting"] },
            { id: "test_agent", capabilities: ["Jest", "Vitest", "E2E", "Integration tests"] },
            { id: "infra_agent", capabilities: ["Terraform", "Kubernetes", "AWS", "GCP"] },
            { id: "codegen_agent", capabilities: ["TypeScript", "Utilities", "Types", "Boilerplate"] },
            { id: "microservice_agent", capabilities: ["Service mesh", "API gateway", "Discovery"] },
            { id: "email_agent", capabilities: ["Templates", "SMTP", "SendGrid", "Notifications"] }
        ];

        for (const agent of agents) {
            this.agentContexts.set(agent.id, {
                agentId: agent.id,
                lastOutput: null,
                outputSummary: null,
                executionCount: 0,
                capabilities: agent.capabilities
            });
        }
    }

    // ============================================
    // CONTEXT WINDOW MANAGEMENT
    // ============================================

    /**
     * Build context window for an agent
     */
    buildContextWindow(agentId: string): ContextWindow {
        const agentContext = this.agentContexts.get(agentId) || {
            agentId,
            lastOutput: null,
            outputSummary: null,
            executionCount: 0,
            capabilities: []
        };

        // Get recent relevant messages
        const relevantMessages = this.getRelevantMessages(agentId);

        // Build system context
        const systemContext = this.buildSystemContext(agentId);

        return {
            messages: relevantMessages,
            systemContext,
            agentContext: Object.fromEntries(this.agentContexts),
            projectContext: this.projectContext
        };
    }

    /**
     * Get messages relevant to an agent's task
     */
    private getRelevantMessages(agentId: string, maxMessages: number = 10): BaseMessage[] {
        const relevant: BaseMessage[] = [];

        // Always include the original user request
        const userMessage = this.conversationHistory.find(m => m._getType() === "human");
        if (userMessage) {
            relevant.push(userMessage);
        }

        // Include recent agent outputs (summarized if needed)
        for (let i = this.conversationHistory.length - 1; i >= 0 && relevant.length < maxMessages; i--) {
            const msg = this.conversationHistory[i];
            if (msg._getType() === "ai") {
                relevant.push(msg);
            }
        }

        return relevant.slice(0, maxMessages);
    }

    /**
     * Build system context string
     */
    private buildSystemContext(agentId: string): string {
        const parts: string[] = [];

        // Project context
        if (this.projectContext.name) {
            parts.push(`PROJECT: ${this.projectContext.name}`);
            parts.push(`DESCRIPTION: ${this.projectContext.description}`);
            parts.push(`TECH STACK: ${this.projectContext.techStack.join(", ")}`);
        }

        // Completed tasks summary
        const completedTasks = this.shortTermMemory
            .filter(m => m.type === "artifact")
            .map(m => m.content);

        if (completedTasks.length > 0) {
            parts.push(`\nCOMPLETED WORK:`);
            completedTasks.slice(-5).forEach(t => parts.push(`- ${t}`));
        }

        // Agent capabilities reminder
        const agentContext = this.agentContexts.get(agentId);
        if (agentContext) {
            parts.push(`\nYOUR CAPABILITIES: ${agentContext.capabilities.join(", ")}`);
        }

        return parts.join("\n");
    }

    // ============================================
    // MEMORY OPERATIONS
    // ============================================

    /**
     * Add a message to conversation history
     */
    addMessage(message: BaseMessage): void {
        this.conversationHistory.push(message);

        // Trim if too long
        if (this.conversationHistory.length > 50) {
            this.summarizeAndTruncate();
        }
    }

    /**
     * Add multiple messages
     */
    addMessages(messages: BaseMessage[]): void {
        messages.forEach(m => this.addMessage(m));
    }

    /**
     * Record a memory entry
     */
    recordMemory(entry: Omit<MemoryEntry, "id" | "timestamp">): void {
        this.shortTermMemory.push({
            ...entry,
            id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: new Date()
        });

        // Trim old entries
        if (this.shortTermMemory.length > 100) {
            this.shortTermMemory = this.shortTermMemory.slice(-100);
        }
    }

    /**
     * Record an agent's output
     */
    recordAgentOutput(agentId: string, output: string): void {
        const context = this.agentContexts.get(agentId);
        if (context) {
            context.lastOutput = output;
            context.executionCount++;

            // Create summary for long outputs
            if (output.length > 500) {
                context.outputSummary = this.createQuickSummary(output);
            } else {
                context.outputSummary = output;
            }
        }

        this.recordMemory({
            type: "artifact",
            content: `${agentId} generated output (${output.length} chars)`,
            metadata: { agentId, outputLength: output.length }
        });
    }

    /**
     * Record a decision
     */
    recordDecision(decision: string, reasoning: string): void {
        this.recordMemory({
            type: "decision",
            content: decision,
            metadata: { reasoning }
        });
    }

    // ============================================
    // PROJECT CONTEXT
    // ============================================

    /**
     * Update project context
     */
    updateProjectContext(updates: Partial<ProjectContextData>): void {
        this.projectContext = { ...this.projectContext, ...updates };
    }

    /**
     * Add to tech stack
     */
    addTechStack(tech: string): void {
        if (!this.projectContext.techStack.includes(tech)) {
            this.projectContext.techStack.push(tech);
        }
    }

    /**
     * Add requirement
     */
    addRequirement(requirement: string): void {
        if (!this.projectContext.requirements.includes(requirement)) {
            this.projectContext.requirements.push(requirement);
        }
    }

    /**
     * Add generated artifact
     */
    addArtifact(artifact: string): void {
        if (!this.projectContext.generatedArtifacts.includes(artifact)) {
            this.projectContext.generatedArtifacts.push(artifact);
        }
    }

    // ============================================
    // SUMMARIZATION
    // ============================================

    /**
     * Summarize and truncate conversation history
     */
    private async summarizeAndTruncate(): Promise<void> {
        if (!this.model) {
            this.initializeModel();
        }

        // Keep first (user request) and last 10 messages
        const toSummarize = this.conversationHistory.slice(1, -10);

        if (toSummarize.length > 0) {
            const summary = this.createQuickSummary(
                toSummarize.map(m => m.content?.toString() || "").join("\n")
            );

            this.summaries.push({
                mainGoal: this.extractMainGoal(),
                keyDecisions: this.extractKeyDecisions(),
                completedTasks: this.extractCompletedTasks(),
                pendingTasks: [],
                artifacts: this.projectContext.generatedArtifacts
            });

            // Truncate history
            this.conversationHistory = [
                this.conversationHistory[0], // Keep user request
                new SystemMessage(`[Previous conversation summary: ${summary}]`),
                ...this.conversationHistory.slice(-10)
            ];
        }
    }

    /**
     * Create a quick summary without LLM call
     */
    private createQuickSummary(text: string, maxLength: number = 200): string {
        // Extract key info without LLM
        const lines = text.split("\n").filter(l => l.trim());
        const important = lines.filter(l =>
            l.includes("export") ||
            l.includes("function") ||
            l.includes("interface") ||
            l.includes("class") ||
            l.includes("// ")
        );

        if (important.length > 0) {
            return important.slice(0, 3).join("; ").substring(0, maxLength);
        }

        return text.substring(0, maxLength) + (text.length > maxLength ? "..." : "");
    }

    private extractMainGoal(): string {
        const userMessage = this.conversationHistory.find(m => m._getType() === "human");
        return userMessage?.content?.toString().substring(0, 100) || "Unknown goal";
    }

    private extractKeyDecisions(): string[] {
        return this.shortTermMemory
            .filter(m => m.type === "decision")
            .slice(-5)
            .map(m => m.content);
    }

    private extractCompletedTasks(): string[] {
        return this.shortTermMemory
            .filter(m => m.type === "artifact")
            .slice(-10)
            .map(m => m.content);
    }

    private initializeModel(): void {
        this.model = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
            temperature: 0.3,
        });
    }

    // ============================================
    // GETTERS
    // ============================================

    /**
     * Get conversation history
     */
    getConversationHistory(): BaseMessage[] {
        return [...this.conversationHistory];
    }

    /**
     * Get all memories
     */
    getMemories(): MemoryEntry[] {
        return [...this.shortTermMemory];
    }

    /**
     * Get project context
     */
    getProjectContext(): ProjectContextData {
        return { ...this.projectContext };
    }

    /**
     * Get agent context
     */
    getAgentContext(agentId: string): AgentContext | undefined {
        return this.agentContexts.get(agentId);
    }

    /**
     * Get all summaries
     */
    getSummaries(): ConversationSummary[] {
        return [...this.summaries];
    }

    /**
     * Clear all context (for new session)
     */
    clear(): void {
        this.shortTermMemory = [];
        this.conversationHistory = [];
        this.summaries = [];
        this.projectContext = {
            name: "",
            description: "",
            techStack: [],
            requirements: [],
            generatedArtifacts: []
        };
        this.initializeAgentContexts();
    }
}

// Export singleton instance
export const contextManager = new ContextManager();
