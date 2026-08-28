/**
 * Meteoroid CLI - Type Definitions
 * Common type definitions for API responses
 */

// ═══════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface HealthResponse {
    status: string;
    uptime: number;
    version: string;
}

export interface DeepHealthResponse {
    status: string;
    checks: {
        database: { status: string; latency?: number };
        vectorStore: { status: string; embeddingsCount?: number };
        redis: { status: string };
        agents: { status: string; loaded: number };
    };
}

export interface ChatResponse {
    response: string;
    model: string;
    duration: number;
}

export interface CodeGenerationResponse {
    success: boolean;
    generatedCode?: Array<{ subtask: string; code: string; explanation: string; agent: string }>;
    fileWriteResult?: { success: boolean; projectPath: string; filesWritten: string[]; errors: string[] };
    intentAnalysis?: { intent: string; confidence: number; language: string; framework: string; reasoning?: string };
    answer?: string;
    isQuestion?: boolean;
    totalDuration?: number;
    agentsExecuted?: string[];
    errors?: string[];
    costs?: { total: number };
}

export interface TaskAnalysisResponse {
    localAnalysis: {
        complexity: string;
        requirements: string[];
        suggestedAgents: string[];
        subTasks: string[];
    };
    aiAnalysis?: {
        complexity: string;
        subtasks: string[];
    };
    duration: number;
}

export interface AgentInfo {
    id: string;
    name: string;
    tier: number;
    capabilities: string[];
    status: string;
}

export interface AgentsResponse {
    count: number;
    agents: AgentInfo[];
}

export interface OrchestratorStatusResponse {
    initialized: boolean;
    mode: string;
    services: {
        aiClient: { status: string; model: string; baseUrl?: string };
        thinkingEngine?: string;
        contextManager?: string;
    };
}

export interface ServiceInfo {
    id: string;
    name: string;
    category: string;
    description: string;
}

export interface ServicesResponse {
    data: {
        services: ServiceInfo[];
        total: number;
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

export function isChatResponse(data: unknown): data is ChatResponse {
    return typeof data === 'object' && data !== null && 'response' in data;
}

export function isCodeGenerationResponse(data: unknown): data is CodeGenerationResponse {
    return typeof data === 'object' && data !== null && 'success' in data;
}

export function isTaskAnalysisResponse(data: unknown): data is TaskAnalysisResponse {
    return typeof data === 'object' && data !== null && 'localAnalysis' in data;
}

export function isAgentsResponse(data: unknown): data is AgentsResponse {
    return typeof data === 'object' && data !== null && 'count' in data && 'agents' in data;
}

export function isServicesResponse(data: unknown): data is ServicesResponse {
    return typeof data === 'object' && data !== null && 'data' in data;
}

export function isOrchestratorStatusResponse(data: unknown): data is OrchestratorStatusResponse {
    return typeof data === 'object' && data !== null && 'initialized' in data && 'mode' in data;
}

export function isHealthResponse(data: unknown): data is HealthResponse {
    return typeof data === 'object' && data !== null && 'status' in data;
}

export function isDeepHealthResponse(data: unknown): data is DeepHealthResponse {
    return typeof data === 'object' && data !== null && 'checks' in data;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function asType<T>(data: unknown): T {
    return data as T;
}

export default {
    isChatResponse,
    isCodeGenerationResponse,
    isTaskAnalysisResponse,
    isAgentsResponse,
    isServicesResponse,
    isOrchestratorStatusResponse,
    isHealthResponse,
    isDeepHealthResponse,
    asType,
};
