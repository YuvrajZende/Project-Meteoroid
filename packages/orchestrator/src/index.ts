import { graph, printGraphStructure } from "./graph";
import { HumanMessage } from "@langchain/core/messages";
import { agentMonitor } from "./core/agent-monitor";
import { taskManager } from "./core/task-manager";
import { thinkingEngine } from "./core/thinking-engine";
import * as dotenv from "dotenv";

dotenv.config();

// ============================================
// LOVEABLE BACKEND ORCHESTRATOR - ENTRY POINT
// ============================================

async function main() {
    console.log(`\n`);
    console.log(`╔════════════════════════════════════════════════════════════════════════════════╗`);
    console.log(`║                                                                                ║`);
    console.log(`║   ██╗      ██████╗ ██╗   ██╗███████╗ █████╗ ██████╗ ██╗     ███████╗          ║`);
    console.log(`║   ██║     ██╔═══██╗██║   ██║██╔════╝██╔══██╗██╔══██╗██║     ██╔════╝          ║`);
    console.log(`║   ██║     ██║   ██║██║   ██║█████╗  ███████║██████╔╝██║     █████╗            ║`);
    console.log(`║   ██║     ██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██║██╔══██╗██║     ██╔══╝            ║`);
    console.log(`║   ███████╗╚██████╔╝ ╚████╔╝ ███████╗██║  ██║██████╔╝███████╗███████╗          ║`);
    console.log(`║   ╚══════╝ ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝          ║`);
    console.log(`║                                                                                ║`);
    console.log(`║                    🧠 BACKEND ORCHESTRATOR v2.0.0                              ║`);
    console.log(`║                   AI-Powered Backend Generation System                         ║`);
    console.log(`║                                                                                ║`);
    console.log(`╠════════════════════════════════════════════════════════════════════════════════╣`);
    console.log(`║  🧠 BRAIN FEATURES:                                                            ║`);
    console.log(`║    ✓ Always-On Thinking Mode    ✓ Real-Time Agent Monitoring                  ║`);
    console.log(`║    ✓ Intelligent Task Distribution    ✓ Automatic Course Correction           ║`);
    console.log(`╚════════════════════════════════════════════════════════════════════════════════╝`);
    console.log(`\n`);

    // Validate environment
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_key_here') {
        console.error(`╔══════════════════════════════════════════════════════════════╗`);
        console.error(`║  ❌ ERROR: API Key Not Configured                            ║`);
        console.error(`╠══════════════════════════════════════════════════════════════╣`);
        console.error(`║  Please set your API key in .env file:                       ║`);
        console.error(`║                                                              ║`);
        console.error(`║  OPENAI_API_KEY=your_glm_api_key                             ║`);
        console.error(`║  OPENAI_BASE_URL=https://api.z.ai/api/coding/paas/v4         ║`);
        console.error(`║  MODEL_NAME=glm-4                                            ║`);
        console.error(`╚══════════════════════════════════════════════════════════════╝`);
        process.exit(1);
    }

    console.log(`✅ Environment validated`);
    console.log(`   Model: ${process.env.MODEL_NAME || 'glm-4'}`);
    console.log(`   Base URL: ${process.env.OPENAI_BASE_URL?.substring(0, 40)}...`);
    console.log(`\n`);

    // Print graph structure
    printGraphStructure();

    // Test request
    const userRequest = process.argv[2] || "I need a backend with Clerk authentication and a PostgreSQL database with Prisma ORM.";

    console.log(`╔══════════════════════════════════════════════════════════════════════════════╗`);
    console.log(`║  📝 USER REQUEST                                                             ║`);
    console.log(`╠══════════════════════════════════════════════════════════════════════════════╣`);
    // Word wrap the request
    const words = userRequest.split(' ');
    let line = '║  ';
    for (const word of words) {
        if ((line + word).length > 78) {
            console.log(line.padEnd(79) + '║');
            line = '║  ' + word + ' ';
        } else {
            line += word + ' ';
        }
    }
    console.log(line.padEnd(79) + '║');
    console.log(`╚══════════════════════════════════════════════════════════════════════════════╝`);
    console.log(`\n`);

    const inputs = {
        messages: [new HumanMessage(userRequest)],
        orchestrationMeta: {
            startTime: new Date(),
            totalSteps: 0,
            currentStep: 0,
            thinkingEnabled: true,
            monitoringEnabled: true,
            correctionEnabled: true
        }
    };

    console.log(`🚀 STARTING ORCHESTRATION...`);
    console.log(`   🧠 Thinking Mode: ACTIVE`);
    console.log(`   📊 Monitoring: ACTIVE`);
    console.log(`   🔧 Correction: ENABLED`);
    console.log(`\n`);

    const startTime = Date.now();

    try {
        let stepCount = 0;
        let lastNodeName = "";

        const stream = await graph.stream(inputs, {
            recursionLimit: 50,  // Increased for complex tasks
        });

        for await (const event of stream) {
            stepCount++;
            const entries = Object.entries(event);
            if (entries.length === 0) continue;

            const [nodeName, nodeData] = entries[0] as [string, any];

            // Avoid duplicate logs
            if (nodeName === lastNodeName && nodeName === "supervisor") {
                continue;
            }
            lastNodeName = nodeName;

            console.log(`\n${"═".repeat(70)}`);
            console.log(`📍 STEP ${stepCount}: ${nodeName.toUpperCase()}`);
            console.log(`${"═".repeat(70)}`);

            // Show brief info about the step
            if (nodeData && typeof nodeData === 'object') {
                if (nodeData.next) {
                    console.log(`   Next: ${nodeData.next}`);
                }
                if (nodeData.executedAgents && Array.isArray(nodeData.executedAgents)) {
                    console.log(`   Executed: ${nodeData.executedAgents.join(", ")}`);
                }
                if (nodeData.thinking) {
                    console.log(`   Thinking Phase: ${nodeData.thinking.currentPhase}`);
                    console.log(`   Confidence: ${nodeData.thinking.confidence}%`);
                }
                if (nodeData.taskList) {
                    console.log(`   Task Progress: ${nodeData.taskList.progress}%`);
                }
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n`);
        console.log(`╔════════════════════════════════════════════════════════════════════════════════╗`);
        console.log(`║                        ✅ ORCHESTRATION COMPLETE                               ║`);
        console.log(`╠════════════════════════════════════════════════════════════════════════════════╣`);
        console.log(`║  📊 EXECUTION SUMMARY                                                          ║`);
        console.log(`║  ─────────────────────────────────────────────────────────────────────────     ║`);
        console.log(`║    Total Steps: ${String(stepCount).padEnd(61)}║`);
        console.log(`║    Duration: ${(duration + " seconds").padEnd(64)}║`);
        console.log(`║    Task Progress: ${(taskManager.getProgress() + "%").padEnd(59)}║`);
        console.log(`║                                                                                ║`);
        console.log(`║  🧠 THINKING TRACES: ${String(thinkingEngine.getTraces().length).padEnd(56)}║`);
        console.log(`╚════════════════════════════════════════════════════════════════════════════════╝`);

        // Print final agent dashboard
        agentMonitor.printDashboard();

        // Print execution history
        const history = agentMonitor.getExecutionHistory(5);
        if (history.length > 0) {
            console.log(`\n📜 RECENT EXECUTION HISTORY:`);
            for (const record of history) {
                const duration = record.endTime
                    ? `${record.endTime.getTime() - record.startTime.getTime()}ms`
                    : "N/A";
                const status = record.status === "completed" ? "✅" :
                    record.status === "failed" ? "❌" : "🔄";
                console.log(`   ${status} ${record.agentId} (${duration})`);
            }
        }

    } catch (error: any) {
        console.error(`\n`);
        console.error(`╔════════════════════════════════════════════════════════════╗`);
        console.error(`║  ❌ ORCHESTRATION ERROR                                    ║`);
        console.error(`╠════════════════════════════════════════════════════════════╣`);
        console.error(`║  ${String(error.message).substring(0, 56).padEnd(56)} ║`);
        console.error(`╚════════════════════════════════════════════════════════════╝`);

        // Print partial agent dashboard
        agentMonitor.printDashboard();

        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { main };
