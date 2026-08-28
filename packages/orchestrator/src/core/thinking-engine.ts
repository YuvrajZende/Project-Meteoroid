/**
 * ============================================
 * THINKING ENGINE - THE BRAIN'S INNER VOICE
 * ============================================
 * 
 * This module implements the "always-on thinking mode" for the orchestrator.
 * It provides deep reasoning, reflection, and strategic planning capabilities.
 */

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";

dotenv.config();

// ============================================
// THINKING TYPES & INTERFACES
// ============================================

export interface ThinkingTrace {
    timestamp: Date;
    phase: ThinkingPhase;
    content: string;
    confidence: number;
    duration_ms: number;
}

export interface ThinkingResult {
    decision: string;
    reasoning: string;
    confidence: number;
    alternatives: string[];
    risks: string[];
    traces: ThinkingTrace[];
}

export interface TaskAnalysis {
    mainGoal: string;
    subTasks: SubTask[];
    dependencies: Map<string, string[]>;
    estimatedComplexity: "low" | "medium" | "high" | "extreme";
    requiredAgents: string[];
}

export interface SubTask {
    id: string;
    description: string;
    assignedAgent: string;
    priority: number;
    status: TaskStatus;
    expectedDuration: string;
    dependencies: string[];
    validationCriteria: string[];
}

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "blocked" | "correcting";
export type ThinkingPhase = "analysis" | "planning" | "decision" | "reflection" | "correction";

// ============================================
// THINKING ENGINE PROMPTS
// ============================================

const DEEP_THINKING_PROMPT = `You are the INNER VOICE of the LOVEABLE Orchestrator - the thinking engine that powers all decisions.

## YOUR PURPOSE
You engage in deep, structured reasoning before ANY decision. You think step-by-step, consider alternatives, identify risks, and ensure optimal outcomes.

## THINKING PROTOCOL

### Phase 1: ANALYSIS
- What is the core problem/request?
- What are the key components?
- What context do I have?
- What information am I missing?

### Phase 2: PLANNING
- What are possible approaches?
- What are the dependencies?
- Which agents are needed?
- In what order should they act?

### Phase 3: DECISION
- Which approach is optimal?
- What is my confidence level (0-100)?
- What could go wrong?
- What is my fallback plan?

### Phase 4: REFLECTION
- Am I missing anything obvious?
- Have I considered edge cases?
- Is this decision consistent with previous decisions?
- Could this cause problems for other agents?

## OUTPUT FORMAT
Structure your thinking as JSON:
{
    "analysis": {
        "core_problem": "...",
        "key_components": ["..."],
        "available_context": ["..."],
        "missing_info": ["..."]
    },
    "planning": {
        "approaches": ["..."],
        "dependencies": {"agent": ["depends_on"]},
        "required_agents": ["..."],
        "execution_order": ["..."]
    },
    "decision": {
        "chosen_approach": "...",
        "confidence": 0-100,
        "risks": ["..."],
        "fallback": "..."
    },
    "reflection": {
        "edge_cases": ["..."],
        "consistency_check": "...",
        "potential_issues": ["..."]
    }
}

THINK DEEPLY. BE THOROUGH. LEAVE NO STONE UNTURNED.`;

const TASK_DECOMPOSITION_PROMPT = `You are the TASK DECOMPOSITION ENGINE of the LOVEABLE Orchestrator.

## YOUR PURPOSE
Break down complex user requests into structured, actionable sub-tasks that can be distributed to specialized agents.

## AVAILABLE AGENTS
- AuthAgent: Authentication, JWT, OAuth, RBAC, Clerk integration
- DBAgent: Database schemas, Prisma/Drizzle, migrations
- APIAgent: REST/GraphQL endpoints, controllers
- SecurityAgent: Vulnerability scanning, secret detection
- QueueAgent: Redis queues, background jobs
- CICDAgent: GitHub Actions, Docker, deployments
- MonitoringAgent: Logging, metrics, health checks
- TestAgent: Unit/integration/E2E tests
- InfraAgent: Kubernetes, Terraform, IaC
- CodeGenAgent: General TypeScript utilities
- MicroserviceAgent: Service architecture
- EmailAgent: Email templates, notifications

## TASK BREAKDOWN RULES
1. Each task should be assignable to ONE agent
2. Tasks should have clear completion criteria
3. Dependencies must be explicitly stated
4. Estimate complexity (low/medium/high/extreme)
5. Define validation criteria for each task

## OUTPUT FORMAT
Provide tasks as JSON:
{
    "main_goal": "...",
    "complexity": "low|medium|high|extreme",
    "tasks": [
        {
            "id": "T1",
            "description": "...",
            "agent": "AuthAgent",
            "priority": 1,
            "dependencies": [],
            "expected_duration": "5-10 min",
            "validation_criteria": ["..."]
        }
    ]
}`;

const CORRECTION_PROMPT = `You are the COURSE CORRECTION ENGINE of the LOVEABLE Orchestrator.

## YOUR PURPOSE
Detect when agents deviate from the plan and generate corrective actions.

## DEVIATION TYPES
1. SCOPE_CREEP: Agent added features not in the task
2. INCOMPLETE: Agent missed required elements
3. WRONG_APPROACH: Agent used incorrect patterns/technologies
4. DEPENDENCY_VIOLATION: Agent operated on incomplete dependencies
5. QUALITY_ISSUE: Output doesn't meet standards
6. OFF_TASK: Agent worked on something completely different

## CORRECTION ACTIONS
- RETRY: Have the agent redo the task
- SUPPLEMENT: Have another agent add missing pieces
- REVERT: Discard output and reassign
- ADJUST_PLAN: Modify the overall plan to accommodate
- ESCALATE: Mark as blocker and halt

## OUTPUT FORMAT
{
    "deviation_detected": true|false,
    "deviation_type": "...",
    "severity": "minor|moderate|major|critical",
    "description": "...",
    "correction_action": "...",
    "corrective_instructions": "..."
}`;

// ============================================
// THINKING ENGINE CLASS
// ============================================

export class ThinkingEngine {
    private model: ChatOpenAI;
    private traces: ThinkingTrace[] = [];

    constructor() {
        this.model = new ChatOpenAI({
            modelName: process.env.MODEL_NAME || "glm-4",
            openAIApiKey: process.env.OPENAI_API_KEY,
            configuration: {
                baseURL: process.env.OPENAI_BASE_URL,
            },
            temperature: 0.2, // Lower temperature for more focused thinking
        });
    }

    /**
     * Engage in deep thinking about a problem
     */
    async think(
        context: string,
        phase: ThinkingPhase,
        additionalPrompt?: string
    ): Promise<ThinkingResult> {
        const startTime = Date.now();
        
        console.log(`\n🧠 [THINKING] Engaging ${phase.toUpperCase()} mode...`);

        const messages = [
            new SystemMessage(DEEP_THINKING_PROMPT),
            new HumanMessage(`
CONTEXT:
${context}

CURRENT PHASE: ${phase}

${additionalPrompt || "Think deeply about the situation and provide your analysis."}

Respond with structured JSON thinking.
            `)
        ];

        try {
            const response = await this.model.invoke(messages);
            const content = response.content.toString();
            const duration = Date.now() - startTime;

            // Parse the thinking
            let parsed: any;
            try {
                // Extract JSON from response
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    parsed = { raw_thinking: content };
                }
            } catch {
                parsed = { raw_thinking: content };
            }

            const trace: ThinkingTrace = {
                timestamp: new Date(),
                phase,
                content: content,
                confidence: parsed.decision?.confidence || 50,
                duration_ms: duration
            };
            this.traces.push(trace);

            console.log(`🧠 [THINKING] ${phase.toUpperCase()} complete (${duration}ms)`);
            this.printThinkingSummary(parsed);

            return {
                decision: parsed.decision?.chosen_approach || "",
                reasoning: content,
                confidence: parsed.decision?.confidence || 50,
                alternatives: parsed.planning?.approaches || [],
                risks: parsed.decision?.risks || [],
                traces: [trace]
            };
        } catch (error) {
            console.error(`🧠 [THINKING] Error in ${phase}:`, error);
            throw error;
        }
    }

    /**
     * Decompose a user request into actionable tasks
     */
    async decomposeTasks(userRequest: string): Promise<TaskAnalysis> {
        console.log(`\n📋 [TASK DECOMPOSITION] Analyzing request...`);

        const messages = [
            new SystemMessage(TASK_DECOMPOSITION_PROMPT),
            new HumanMessage(`
USER REQUEST:
"${userRequest}"

Break this down into specific, agent-assignable tasks.
            `)
        ];

        const response = await this.model.invoke(messages);
        const content = response.content.toString();

        let parsed: any;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON found");
            }
        } catch {
            console.warn("⚠️ Could not parse task decomposition, using default");
            parsed = {
                main_goal: userRequest,
                complexity: "medium",
                tasks: []
            };
        }

        const subTasks: SubTask[] = (parsed.tasks || []).map((t: any) => ({
            id: t.id || `T${Math.random().toString(36).substr(2, 9)}`,
            description: t.description || "",
            assignedAgent: t.agent || "CodeGenAgent",
            priority: t.priority || 5,
            status: "pending" as TaskStatus,
            expectedDuration: t.expected_duration || "unknown",
            dependencies: t.dependencies || [],
            validationCriteria: t.validation_criteria || []
        }));

        console.log(`📋 [TASK DECOMPOSITION] Created ${subTasks.length} tasks`);
        this.printTaskList(subTasks);

        return {
            mainGoal: parsed.main_goal || userRequest,
            subTasks,
            dependencies: new Map(),
            estimatedComplexity: parsed.complexity || "medium",
            requiredAgents: [...new Set(subTasks.map(t => t.assignedAgent))]
        };
    }

    /**
     * Check if an agent's output deviates from the plan
     */
    async checkDeviation(
        taskDescription: string,
        expectedOutput: string[],
        actualOutput: string
    ): Promise<{
        hasDeviation: boolean;
        deviationType?: string;
        severity?: string;
        correction?: string;
    }> {
        console.log(`\n🔍 [DEVIATION CHECK] Analyzing agent output...`);

        const messages = [
            new SystemMessage(CORRECTION_PROMPT),
            new HumanMessage(`
TASK DESCRIPTION:
${taskDescription}

EXPECTED OUTPUTS/CRITERIA:
${expectedOutput.join("\n")}

ACTUAL OUTPUT:
${actualOutput.substring(0, 2000)}... [truncated]

Analyze if there's any deviation from the expected task.
            `)
        ];

        const response = await this.model.invoke(messages);
        const content = response.content.toString();

        let parsed: any;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                parsed = { deviation_detected: false };
            }
        } catch {
            parsed = { deviation_detected: false };
        }

        if (parsed.deviation_detected) {
            console.log(`⚠️ [DEVIATION] ${parsed.deviation_type}: ${parsed.description}`);
        } else {
            console.log(`✅ [DEVIATION CHECK] No significant deviation detected`);
        }

        return {
            hasDeviation: parsed.deviation_detected || false,
            deviationType: parsed.deviation_type,
            severity: parsed.severity,
            correction: parsed.corrective_instructions
        };
    }

    /**
     * Get all thinking traces
     */
    getTraces(): ThinkingTrace[] {
        return [...this.traces];
    }

    /**
     * Clear thinking traces
     */
    clearTraces(): void {
        this.traces = [];
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private printThinkingSummary(parsed: any): void {
        console.log(`\n┌─────────────────────────────────────────┐`);
        console.log(`│          💭 THINKING SUMMARY            │`);
        console.log(`├─────────────────────────────────────────┤`);
        
        if (parsed.analysis?.core_problem) {
            console.log(`│ Problem: ${parsed.analysis.core_problem.substring(0, 35)}...`);
        }
        if (parsed.decision?.chosen_approach) {
            console.log(`│ Decision: ${parsed.decision.chosen_approach.substring(0, 33)}...`);
        }
        if (parsed.decision?.confidence) {
            console.log(`│ Confidence: ${parsed.decision.confidence}%`);
        }
        if (parsed.decision?.risks?.length) {
            console.log(`│ Risks: ${parsed.decision.risks.length} identified`);
        }
        
        console.log(`└─────────────────────────────────────────┘\n`);
    }

    private printTaskList(tasks: SubTask[]): void {
        console.log(`\n┌─────────────────────────────────────────┐`);
        console.log(`│            📋 TASK LIST                 │`);
        console.log(`├─────────────────────────────────────────┤`);
        
        for (const task of tasks) {
            const status = task.status === "completed" ? "✅" : 
                          task.status === "in_progress" ? "🔄" : 
                          task.status === "failed" ? "❌" : "⏳";
            console.log(`│ ${status} ${task.id}: ${task.description.substring(0, 30)}...`);
            console.log(`│    → ${task.assignedAgent} (P${task.priority})`);
        }
        
        console.log(`└─────────────────────────────────────────┘\n`);
    }
}

// Export singleton instance
export const thinkingEngine = new ThinkingEngine();
