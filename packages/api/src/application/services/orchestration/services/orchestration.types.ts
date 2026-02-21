/**
 * Orchestration Types
 * 
 * Proper TypeScript types to replace `any` usages throughout the orchestration layer.
 */

export interface MultiModelResult {
    code: string;
    explanation: string;
    files: GeneratedFile[];
    totalCost: number;
    analysisTime: number;
    generationTime: number;
    analysisCost?: TokenCost;
    generationCost?: TokenCost;
    architectureBlueprint?: ArchitectureBlueprint;
    contextAnalysis?: {
        architectureBlueprint: ArchitectureBlueprint | null;
    };
}

export interface GeneratedFile {
    path: string;
    content: string;
    language?: string;
}

export interface TokenCost {
    inputTokens: number;
    outputTokens: number;
    model?: string;
}

export interface ArchitectureBlueprint {
    projectId?: string;
    userId?: string;
    taskId?: string;
    prompt?: string;
    language?: string;
    framework?: string;
    generatedFiles?: Array<{
        path: string;
        agent?: string;
    }>;
    qualityScore?: number;
    filesCount?: number;
    explanation?: string;
    timestamp?: string;
    fileStructure?: string[];
}

export interface AgentExecutionRecord {
    agentId: string;
    agentName: string;
    executionTime: number;
    tokenUsage: TokenUsage;
    success: boolean;
    filesGenerated: number;
    error?: string;
    timestamp: string;
    taskId: string;
    projectId: string;
    userId: string;
}

export interface TokenUsage {
    prompt: number;
    completion: number;
    total: number;
}

export interface OrchestrationMetrics {
    totalDuration: number;
    thinkingTime: number;
    agentsExecuted: string[];
    subtasksCount: number;
    filesGenerated: number;
    success: boolean;
    error?: string;
    totalTokens: number;
    totalCost: number;
    analysisModel?: string;
    generationModel?: string;
}

export interface QualityAssessmentResult {
    score: number;
    passed: boolean;
    issues: Array<{
        severity: 'error' | 'warning' | 'info';
        message: string;
        file?: string;
        line?: number;
    }>;
    recommendations: string[];
    shouldRegenerate: boolean;
}

export interface LearningMetrics {
    duration: number;
    tokensUsed: number;
    cost: number;
}

export interface CostSummary {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
}

export interface DatabaseSaveResult {
    projectId: string | null;
    taskId: string | null;
    success: boolean;
}
