import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { ThinkingTrace, SubTask, TaskStatus } from "./core/thinking-engine";

// ============================================
// SHARED CONTEXT INTERFACES
// ============================================

export interface ProjectSpec {
    name: string;
    description: string;
    techStack?: string[];
    framework?: "express" | "nestjs" | "fastify";
    database?: "postgres" | "mongodb" | "mysql";
}

export interface AuthConfig {
    provider: "clerk" | "auth0" | "custom" | "jwt";
    features: string[];
    mfa?: boolean;
    oauth?: string[];
}

export interface DatabaseConfig {
    type: "postgres" | "mongodb" | "mysql";
    orm: "prisma" | "drizzle" | "typeorm";
    migrations: boolean;
}

export interface APIConfig {
    style: "rest" | "graphql" | "trpc";
    versioning: boolean;
    documentation: boolean;
}

export interface SecurityConfig {
    scanning: boolean;
    secretDetection: boolean;
    compliance: string[];
}

export interface InfraConfig {
    containerization: "docker" | "podman";
    orchestration: "kubernetes" | "swarm" | "none";
    cicd: "github-actions" | "gitlab-ci" | "jenkins";
}

// ============================================
// THINKING & MONITORING INTERFACES
// ============================================

export interface OrchestratorThinking {
    currentPhase: "analysis" | "planning" | "execution" | "reflection" | "correction";
    reasoning: string;
    confidence: number;
    traces: ThinkingTrace[];
    lastThoughtAt: Date;
}

export interface AgentMonitoringState {
    agentId: string;
    status: "idle" | "executing" | "completed" | "failed" | "correcting";
    currentTask: string | null;
    lastActivity: Date | null;
    successRate: number;
}

export interface TaskListState {
    planId: string;
    mainGoal: string;
    tasks: SubTask[];
    currentTaskId: string | null;
    completedCount: number;
    failedCount: number;
    progress: number;
}

export interface CorrectionState {
    hasDeviation: boolean;
    deviationType: string | null;
    severity: "minor" | "moderate" | "major" | "critical" | null;
    correctionInstructions: string | null;
    correctedAgents: string[];
}

// ============================================
// AGENT REGISTRY - ALL 12 AGENTS
// ============================================

export const AGENT_REGISTRY = {
    // Tier 1: Core Agents (Person 1, 2, 3)
    auth_agent: { name: "AuthAgent", owner: "Person1", tier: 1, description: "Authentication & Authorization" },
    db_agent: { name: "DBAgent", owner: "Person2", tier: 1, description: "Database schemas & migrations" },
    api_agent: { name: "APIAgent", owner: "Person3", tier: 1, description: "REST/GraphQL API generation" },

    // Tier 2: Specialized Agents
    security_agent: { name: "SecurityAgent", owner: "Person1", tier: 2, description: "Security scanning & vulnerability detection" },
    queue_agent: { name: "QueueAgent", owner: "Person2", tier: 2, description: "Message queues & async processing" },
    cicd_agent: { name: "CICDAgent", owner: "Person3", tier: 2, description: "CI/CD pipeline generation" },

    // Tier 3: Supporting Agents
    monitoring_agent: { name: "MonitoringAgent", owner: "Person1", tier: 3, description: "Observability & health checks" },
    test_agent: { name: "TestAgent", owner: "Person2", tier: 3, description: "Test generation & execution" },
    infra_agent: { name: "InfraAgent", owner: "Person3", tier: 3, description: "Infrastructure as Code" },

    // Universal Agents (Person 4)
    codegen_agent: { name: "CodeGenAgent", owner: "Person4", tier: 4, description: "General code generation" },
    microservice_agent: { name: "MicroserviceAgent", owner: "Person4", tier: 4, description: "Microservice architecture" },
    email_agent: { name: "EmailAgent", owner: "Person4", tier: 4, description: "Email service integration" },
} as const;

export type AgentName = keyof typeof AGENT_REGISTRY;

// ============================================
// ENHANCED TEAM STATE ANNOTATION (LangGraph)
// ============================================

export const TeamStateAnnotation = Annotation.Root({
    // ========================================
    // CORE STATE
    // ========================================

    // Message History
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),

    // Routing
    next: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "supervisor",
    }),

    // Execution tracking
    executedAgents: Annotation<string[]>({
        reducer: (x, y) => [...new Set([...x, ...y])],
        default: () => [],
    }),

    // Generated artifacts
    artifacts: Annotation<Record<string, string>>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({}),
    }),

    // ========================================
    // THINKING STATE (ALWAYS ON)
    // ========================================

    thinking: Annotation<OrchestratorThinking>({
        reducer: (x, y) => ({
            ...x,
            ...y,
            traces: [...(x.traces || []), ...(y.traces || [])]
        }),
        default: () => ({
            currentPhase: "analysis",
            reasoning: "",
            confidence: 0,
            traces: [],
            lastThoughtAt: new Date()
        }),
    }),

    // ========================================
    // TASK MANAGEMENT STATE
    // ========================================

    taskList: Annotation<TaskListState>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({
            planId: "",
            mainGoal: "",
            tasks: [],
            currentTaskId: null,
            completedCount: 0,
            failedCount: 0,
            progress: 0
        }),
    }),

    // ========================================
    // AGENT MONITORING STATE
    // ========================================

    agentMonitoring: Annotation<Record<string, AgentMonitoringState>>({
        reducer: (x, y) => {
            const result = { ...x };
            for (const [key, value] of Object.entries(y)) {
                result[key] = { ...(result[key] || {}), ...value };
            }
            return result;
        },
        default: () => ({}),
    }),

    // ========================================
    // CORRECTION STATE
    // ========================================

    correction: Annotation<CorrectionState>({
        reducer: (x, y) => ({
            ...x,
            ...y,
            correctedAgents: [...new Set([...(x.correctedAgents || []), ...(y.correctedAgents || [])])]
        }),
        default: () => ({
            hasDeviation: false,
            deviationType: null,
            severity: null,
            correctionInstructions: null,
            correctedAgents: []
        }),
    }),

    // ========================================
    // PROJECT CONFIGURATION STATE
    // ========================================

    projectSpec: Annotation<ProjectSpec>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({ name: "", description: "" }),
    }),

    authConfig: Annotation<AuthConfig>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({ provider: "custom", features: [] }),
    }),

    databaseConfig: Annotation<DatabaseConfig>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({ type: "postgres", orm: "prisma", migrations: true }),
    }),

    apiConfig: Annotation<APIConfig>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({ style: "rest", versioning: true, documentation: true }),
    }),

    securityConfig: Annotation<SecurityConfig>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({ scanning: true, secretDetection: true, compliance: [] }),
    }),

    infraConfig: Annotation<InfraConfig>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({ containerization: "docker", orchestration: "none", cicd: "github-actions" }),
    }),

    // ========================================
    // ORCHESTRATION METADATA
    // ========================================

    orchestrationMeta: Annotation<{
        startTime: Date;
        totalSteps: number;
        currentStep: number;
        thinkingEnabled: boolean;
        monitoringEnabled: boolean;
        correctionEnabled: boolean;
    }>({
        reducer: (x, y) => ({ ...x, ...y }),
        default: () => ({
            startTime: new Date(),
            totalSteps: 0,
            currentStep: 0,
            thinkingEnabled: true,
            monitoringEnabled: true,
            correctionEnabled: true
        }),
    }),
});

export type TeamState = typeof TeamStateAnnotation.State;
