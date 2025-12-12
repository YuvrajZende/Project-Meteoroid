import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { TeamStateAnnotation, AGENT_REGISTRY, AgentName } from "../state";
import {
    brainCore,
    thinkingEngine,
    contextManager,
    knowledgeBase,
    taskManager,
    agentMonitor,
    healthMonitor,
    vectorStore
} from "../core";
import { parallelExecutor } from "../parallel-executor";
import * as dotenv from "dotenv";

dotenv.config();

// ============================================
// BRAIN SYSTEM PROMPT - THE THINKING ORCHESTRATOR
// ============================================

const BRAIN_SYSTEM_PROMPT = `You are the BRAIN of the LOVEABLE Backend Orchestrator - an AI-powered system that coordinates 12 specialized agents to build complete backend systems.

## 🧠 THINKING MODE: ALWAYS ON

You MUST think deeply before every decision. Your thinking process includes:

1. **ANALYSIS**: What is the problem? What do I know? What am I missing?
2. **PLANNING**: What approaches exist? What are dependencies? What's the optimal order?
3. **DECISION**: Which approach is best? What's my confidence? What are the risks?
4. **REFLECTION**: Am I missing anything? Have I considered edge cases?

## 🔗 YOUR INTEGRATED SYSTEMS

You have access to interconnected subsystems:
- **Knowledge Base**: Semantic memory of all decisions, code, and artifacts
- **Context Manager**: Working memory and agent-specific context
- **Task Manager**: Goal tracking and dependency management
- **Agent Monitor**: Real-time status of all 12 agents
- **Health Monitor**: System health and alerts

## 🤖 YOUR AGENT TEAM

### Tier 1: Core Agents (Must complete first)
- **AuthAgent** (auth_agent): Authentication, JWT, OAuth, Clerk, RBAC
- **DBAgent** (db_agent): Database schemas, Prisma/Drizzle, migrations
- **APIAgent** (api_agent): REST/GraphQL endpoints, controllers

### Tier 2: Specialized Agents (After core setup)
- **SecurityAgent** (security_agent): Security scanning, vulnerabilities
- **QueueAgent** (queue_agent): Redis, BullMQ, background jobs
- **CICDAgent** (cicd_agent): GitHub Actions, Docker, deployments

### Tier 3: Supporting Agents (Production readiness)
- **MonitoringAgent** (monitoring_agent): Logging, metrics, health checks
- **TestAgent** (test_agent): Unit/integration/E2E tests
- **InfraAgent** (infra_agent): Kubernetes, Terraform

### Tier 4: Universal Agents (As needed)
- **CodeGenAgent** (codegen_agent): General utilities
- **MicroserviceAgent** (microservice_agent): Service architecture
- **EmailAgent** (email_agent): Email services

## 📊 RESPONSE FORMAT

Respond with the next agent to invoke, or FINISH if complete.
Valid responses: AuthAgent, DBAgent, APIAgent, SecurityAgent, QueueAgent, CICDAgent, MonitoringAgent, TestAgent, InfraAgent, CodeGenAgent, MicroserviceAgent, EmailAgent, FINISH

## 🎯 CRITICAL RULES

1. ALWAYS think before acting - never skip analysis
2. NEVER invoke the same agent twice in a row (unless correcting)
3. FOLLOW dependency order - don't skip ahead
4. MONITOR agent outputs - detect issues early
5. COURSE CORRECT promptly - don't let errors propagate
6. FINISH only when ALL tasks are complete
`;

// ============================================
// MODEL CONFIGURATION
// ============================================

const getModel = () => {
    return new ChatOpenAI({
        modelName: process.env.MODEL_NAME || "glm-4",
        openAIApiKey: process.env.OPENAI_API_KEY,
        configuration: {
            baseURL: process.env.OPENAI_BASE_URL,
        },
        temperature: 0.1,
    });
};

// ============================================
// AGENT NAME MAPPING
// ============================================

const AGENT_NAME_TO_NODE: Record<string, AgentName> = {
    "AuthAgent": "auth_agent",
    "DBAgent": "db_agent",
    "APIAgent": "api_agent",
    "SecurityAgent": "security_agent",
    "QueueAgent": "queue_agent",
    "CICDAgent": "cicd_agent",
    "MonitoringAgent": "monitoring_agent",
    "TestAgent": "test_agent",
    "InfraAgent": "infra_agent",
    "CodeGenAgent": "codegen_agent",
    "MicroserviceAgent": "microservice_agent",
    "EmailAgent": "email_agent",
};

// ============================================
// ENHANCED SUPERVISOR NODE - THE BRAIN
// ============================================

export const supervisorNode = async (state: typeof TeamStateAnnotation.State) => {
    const model = getModel();
    const isFirstStep = state.executedAgents.length === 0;

    console.log(`\n${"═".repeat(70)}`);
    console.log(`🧠 ORCHESTRATOR BRAIN - FULLY INTEGRATED MODE`);
    console.log(`${"═".repeat(70)}\n`);

    // ========================================
    // PHASE 1: INITIAL SETUP (First Step Only)
    // ========================================

    if (isFirstStep) {
        console.log(`📋 First step - Initializing Brain Core...\n`);

        // Initialize the brain and all subsystems
        await brainCore.initialize();

        // Get user request from messages
        const userMessage = state.messages.find(m => m._getType() === "human");
        const userRequest = userMessage?.content?.toString() || "";

        // Process the request through the brain
        await brainCore.processRequest(userRequest);

        // Add messages to context
        contextManager.addMessages(state.messages);
    }

    // ========================================
    // PHASE 2: PROCESS PREVIOUS AGENT OUTPUT
    // ========================================

    if (!isFirstStep && state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];

        if (lastMessage._getType() === "ai") {
            const lastAgentOutput = lastMessage.content?.toString() || "";
            const lastAgentId = state.executedAgents[state.executedAgents.length - 1] as AgentName;
            const currentTask = taskManager.getCurrentPlan()?.tasks.find(t => t.status === "in_progress");

            if (currentTask && lastAgentId) {
                // Process through brain core
                const result = await brainCore.processAgentOutput(
                    lastAgentId,
                    currentTask.id,
                    lastAgentOutput
                );

                if (result.needsCorrection) {
                    console.log(`\n🔧 CORRECTION REQUIRED`);
                    console.log(`   Agent: ${AGENT_REGISTRY[lastAgentId].name}`);
                    console.log(`   Correction: ${result.correction}`);

                    // Re-invoke the same agent with correction
                    return {
                        next: lastAgentId,
                        correction: {
                            hasDeviation: true,
                            deviationType: "detected",
                            severity: "moderate" as const,
                            correctionInstructions: result.correction,
                            correctedAgents: [lastAgentId]
                        },
                        thinking: {
                            currentPhase: "correction" as const,
                            reasoning: `Detected deviation in ${AGENT_REGISTRY[lastAgentId].name}. Applying correction.`,
                            confidence: 70,
                            traces: [],
                            lastThoughtAt: new Date()
                        }
                    };
                }
            }
        }
    }

    // ========================================
    // PHASE 3: DISPLAY SYSTEM STATUS
    // ========================================

    // Print agent monitoring dashboard
    agentMonitor.printDashboard();

    // Print brain status
    brainCore.printStatus();

    // Check for unhealthy agents
    const unhealthyAgents = agentMonitor.getUnhealthyAgents();
    if (unhealthyAgents.length > 0) {
        console.log(`\n⚠️ WARNING: ${unhealthyAgents.length} agents have issues:`);
        unhealthyAgents.forEach(a => console.log(`   - ${a.name}: ${a.health}`));
    }

    // ========================================
    // PHASE 4: BRAIN DECISION
    // ========================================

    // Get decision from brain core
    const decision = await brainCore.decideNextAction(
        state.executedAgents,
        state.messages
    );

    // Check if we should finish
    if (decision.action === "finish") {
        console.log(`\n✅ ORCHESTRATION COMPLETE`);
        console.log(`   Total agents used: ${state.executedAgents.length}`);
        console.log(`   Task completion: ${taskManager.getProgress()}%`);

        // Print knowledge base stats
        const kbStats = knowledgeBase.getStats();
        console.log(`   Knowledge entries: ${kbStats.totalEntries}`);

        taskManager.updatePlanStatus("completed");

        // Save final checkpoint
        await brainCore.saveCheckpoint(state.executedAgents.length);

        return {
            next: "FINISH",
            thinking: {
                currentPhase: "reflection" as const,
                reasoning: "All tasks completed successfully.",
                confidence: decision.confidence,
                traces: thinkingEngine.getTraces(),
                lastThoughtAt: new Date()
            }
        };
    }

    // ========================================
    // PHASE 5: ROUTE TO NEXT AGENT
    // ========================================

    if (decision.action === "invoke_agent" && decision.target) {
        const nextTask = taskManager.getNextTask();

        if (nextTask) {
            // Prepare the full task package for the agent
            const taskPackage = brainCore.prepareAgentTask(decision.target, nextTask);

            // Start task tracking
            taskManager.startTask(nextTask.id);
            agentMonitor.startExecution(decision.target, nextTask.id, nextTask.description);
        }

        console.log(`\n🚀 Routing to: ${AGENT_REGISTRY[decision.target].name}`);
        console.log(`   Confidence: ${decision.confidence}%`);
        console.log(`   Relevant Knowledge: ${decision.relevantKnowledge.length} entries`);

        return {
            next: decision.target,
            thinking: {
                currentPhase: "execution" as const,
                reasoning: decision.reasoning,
                confidence: decision.confidence,
                traces: thinkingEngine.getTraces(),
                lastThoughtAt: new Date()
            }
        };
    }

    // ========================================
    // PHASE 6: FALLBACK - LLM DECISION
    // ========================================

    // If brain core didn't make a clear decision, use LLM
    console.log(`\n💭 Using LLM for final decision...`);

    const contextParts = [
        `Executed Agents: ${state.executedAgents.join(", ") || "None"}`,
        `Task Progress: ${taskManager.getSummary()}`,
        `Knowledge Base: ${knowledgeBase.getStats().totalEntries} entries`
    ];

    const messages = [
        new SystemMessage(BRAIN_SYSTEM_PROMPT),
        ...state.messages,
        new HumanMessage(`
=== CURRENT STATE ===
${contextParts.join("\n")}

Based on this analysis, respond with the next agent to invoke or FINISH.
RESPOND WITH ONLY THE AGENT NAME OR "FINISH".
        `)
    ];

    const response = await model.invoke(messages);
    const content = response.content.toString().trim();

    console.log(`💭 LLM Decision: ${content}`);

    // Parse response
    if (content.toUpperCase().includes("FINISH")) {
        return { next: "FINISH" };
    }

    for (const [agentName, nodeId] of Object.entries(AGENT_NAME_TO_NODE)) {
        if (content.includes(agentName)) {
            const nextTask = taskManager.getNextTask();
            if (nextTask) {
                taskManager.startTask(nextTask.id);
                agentMonitor.startExecution(nodeId, nextTask.id, nextTask.description);
            }
            return { next: nodeId };
        }
    }

    // Default: finish
    console.log(`\n✅ No more tasks, finishing execution`);
    return { next: "FINISH" };
};
