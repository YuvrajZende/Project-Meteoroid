import { StateGraph, END, START } from "@langchain/langgraph";
import { TeamStateAnnotation, AGENT_REGISTRY } from "./state";
import { supervisorNode } from "./nodes/supervisor";
import { agentMonitor } from "./core/agent-monitor";
import { taskManager } from "./core/task-manager";
import {
    authAgentNode,
    dbAgentNode,
    apiAgentNode,
    securityAgentNode,
    queueAgentNode,
    cicdAgentNode,
    monitoringAgentNode,
    testAgentNode,
    infraAgentNode,
    codegenAgentNode,
    microserviceAgentNode,
    emailAgentNode,
} from "./nodes/workers";

// ============================================
// ORCHESTRATOR GRAPH DEFINITION
// ============================================

console.log(`\n`);
console.log(`╔═══════════════════════════════════════════════════════════════════╗`);
console.log(`║          🧠 LOVEABLE ORCHESTRATOR - BRAIN INITIALIZATION          ║`);
console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
console.log(`║  🔄 Loading Thinking Engine...                                    ║`);
console.log(`║  📊 Initializing Agent Monitor...                                 ║`);
console.log(`║  📋 Setting up Task Manager...                                    ║`);
console.log(`║  🏗️  Building StateGraph...                                        ║`);
console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
console.log(`\n`);

console.log(`📦 Registering ${Object.keys(AGENT_REGISTRY).length} agents across 4 tiers`);

const builder = new StateGraph(TeamStateAnnotation)
    // ============================================
    // ADD ALL NODES
    // ============================================

    // Supervisor (Brain with Thinking Mode)
    .addNode("supervisor", supervisorNode)

    // Tier 1: Core Agents
    .addNode("auth_agent", authAgentNode)
    .addNode("db_agent", dbAgentNode)
    .addNode("api_agent", apiAgentNode)

    // Tier 2: Specialized Agents
    .addNode("security_agent", securityAgentNode)
    .addNode("queue_agent", queueAgentNode)
    .addNode("cicd_agent", cicdAgentNode)

    // Tier 3: Supporting Agents
    .addNode("monitoring_agent", monitoringAgentNode)
    .addNode("test_agent", testAgentNode)
    .addNode("infra_agent", infraAgentNode)

    // Tier 4: Universal Agents
    .addNode("codegen_agent", codegenAgentNode)
    .addNode("microservice_agent", microserviceAgentNode)
    .addNode("email_agent", emailAgentNode)

    // ============================================
    // DEFINE EDGES
    // ============================================

    // Entry point -> Supervisor (Brain)
    .addEdge(START, "supervisor")

    // All agents return to Supervisor for monitoring and next decision
    .addEdge("auth_agent", "supervisor")
    .addEdge("db_agent", "supervisor")
    .addEdge("api_agent", "supervisor")
    .addEdge("security_agent", "supervisor")
    .addEdge("queue_agent", "supervisor")
    .addEdge("cicd_agent", "supervisor")
    .addEdge("monitoring_agent", "supervisor")
    .addEdge("test_agent", "supervisor")
    .addEdge("infra_agent", "supervisor")
    .addEdge("codegen_agent", "supervisor")
    .addEdge("microservice_agent", "supervisor")
    .addEdge("email_agent", "supervisor")

    // Conditional routing from Supervisor (Brain)
    .addConditionalEdges("supervisor", (state) => {
        const next = state.next;

        if (next === "FINISH") {
            console.log(`\n✅ Brain completing orchestration`);

            // Print final summary
            console.log(`\n${"═".repeat(70)}`);
            console.log(`📊 FINAL EXECUTION SUMMARY`);
            console.log(`${"═".repeat(70)}`);
            console.log(`   Agents used: ${state.executedAgents.join(", ")}`);
            console.log(`   Total artifacts: ${Object.keys(state.artifacts || {}).length}`);
            console.log(`   Task progress: ${taskManager.getProgress()}%`);

            // Print final monitoring dashboard
            agentMonitor.printDashboard();

            return END;
        }

        // Validate the agent exists
        if (next in AGENT_REGISTRY) {
            console.log(`\n🧠 Brain routing to: ${AGENT_REGISTRY[next as keyof typeof AGENT_REGISTRY].name}`);
            return next;
        }

        console.warn(`⚠️ Unknown agent: ${next}, finishing`);
        return END;
    });

// ============================================
// COMPILE THE GRAPH
// ============================================

export const graph = builder.compile();

console.log(`✅ Orchestrator Brain compiled successfully!`);
console.log(`   🧠 Thinking Mode: ENABLED`);
console.log(`   📊 Agent Monitoring: ACTIVE`);
console.log(`   📋 Task Management: READY`);
console.log(`   🔧 Course Correction: ENABLED`);
console.log(`\n`);

// ============================================
// ENHANCED GRAPH VISUALIZATION HELPER
// ============================================

export const printGraphStructure = () => {
    console.log(`\n`);
    console.log(`╔═══════════════════════════════════════════════════════════════════════════════╗`);
    console.log(`║                    🧠 LOVEABLE ORCHESTRATOR ARCHITECTURE                      ║`);
    console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣`);
    console.log(`║                                                                               ║`);
    console.log(`║                              [USER REQUEST]                                   ║`);
    console.log(`║                                    │                                          ║`);
    console.log(`║                                    ▼                                          ║`);
    console.log(`║                         ┌──────────────────┐                                  ║`);
    console.log(`║                         │   🧠 BRAIN       │                                  ║`);
    console.log(`║                         │   (Supervisor)   │                                  ║`);
    console.log(`║                         │                  │                                  ║`);
    console.log(`║                         │ ┌──────────────┐ │                                  ║`);
    console.log(`║                         │ │ 💭 THINKING  │ │  ← Always-On Thinking Mode      ║`);
    console.log(`║                         │ └──────────────┘ │                                  ║`);
    console.log(`║                         │ ┌──────────────┐ │                                  ║`);
    console.log(`║                         │ │ 📋 TASKS     │ │  ← Task Distribution            ║`);
    console.log(`║                         │ └──────────────┘ │                                  ║`);
    console.log(`║                         │ ┌──────────────┐ │                                  ║`);
    console.log(`║                         │ │ 📊 MONITOR   │ │  ← Agent Monitoring             ║`);
    console.log(`║                         │ └──────────────┘ │                                  ║`);
    console.log(`║                         │ ┌──────────────┐ │                                  ║`);
    console.log(`║                         │ │ 🔧 CORRECT   │ │  ← Course Correction            ║`);
    console.log(`║                         │ └──────────────┘ │                                  ║`);
    console.log(`║                         └────────┬─────────┘                                  ║`);
    console.log(`║                                  │                                            ║`);
    console.log(`║      ┌────────┬────────┬────────┼────────┬────────┬────────┐                 ║`);
    console.log(`║      ▼        ▼        ▼        ▼        ▼        ▼        ▼                 ║`);
    console.log(`║                                                                               ║`);

    const tiers = [
        { name: "📊 TIER 1 (CORE)", agents: ["auth_agent", "db_agent", "api_agent"], color: "🟢" },
        { name: "🔧 TIER 2 (SPECIALIZED)", agents: ["security_agent", "queue_agent", "cicd_agent"], color: "🟡" },
        { name: "🛠️  TIER 3 (SUPPORTING)", agents: ["monitoring_agent", "test_agent", "infra_agent"], color: "🟠" },
        { name: "🌐 TIER 4 (UNIVERSAL)", agents: ["codegen_agent", "microservice_agent", "email_agent"], color: "🔵" },
    ];

    for (const tier of tiers) {
        console.log(`║  ${tier.name.padEnd(70)} ║`);
        for (const agentId of tier.agents) {
            const agent = AGENT_REGISTRY[agentId as keyof typeof AGENT_REGISTRY];
            const line = `    ${tier.color} ${agent.name.padEnd(20)} │ ${agent.description}`;
            console.log(`║  ${line.padEnd(73)}║`);
        }
        console.log(`║                                                                               ║`);
    }

    console.log(`╠═══════════════════════════════════════════════════════════════════════════════╣`);
    console.log(`║  🧠 BRAIN CAPABILITIES:                                                       ║`);
    console.log(`║    • Always-On Thinking Mode - Deep reasoning before every decision           ║`);
    console.log(`║    • Task Decomposition - Breaks requests into agent-assignable tasks         ║`);
    console.log(`║    • Agent Monitoring - Real-time tracking of all 12 agents                   ║`);
    console.log(`║    • Course Correction - Detects and fixes agent deviations                   ║`);
    console.log(`║    • Progress Tracking - Monitors task completion and dependencies            ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════════════════════╝`);
    console.log(`\n`);
};
