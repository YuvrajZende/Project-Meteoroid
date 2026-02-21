/**
 * Orchestration Analysis Service
 * 
 * Handles thinking, analysis, and agent selection phases.
 * Combines local thinking engine with AI-powered analysis.
 * 
 * Extracted from IntegratedOrchestrator to improve maintainability.
 */

import {
    getThinkingEngine,
    type ThinkingEngineService,
    type TaskAnalysis,
    type ThinkingTrace,
} from '../../../../domain/services/context/core-services.js';
import { getAIClient, type AIClient } from '../../../../infrastructure/ai-client.js';
import {
    getAgentMonitor,
    type AgentMonitorService,
} from '../../../../domain/services/context/core-services.js';

export interface AnalysisResult {
    taskAnalysis: TaskAnalysis;
    aiAnalysis?: {
        complexity: string;
        subtasks: string[];
        suggestedAgents: string[];
        estimatedSteps: number;
    };
    selectedAgents: string[];
    subtasks: string[];
    thinkingTime: number;
}

export class OrchestrationAnalysisService {
    private thinkingEngine: ThinkingEngineService;
    private aiClient: AIClient;
    private agentMonitor: AgentMonitorService;

    constructor() {
        this.thinkingEngine = getThinkingEngine();
        this.aiClient = getAIClient();
        this.agentMonitor = getAgentMonitor();
    }

    clearTraces(): void {
        this.thinkingEngine.clearTraces();
    }

    getTraces(): ThinkingTrace[] {
        return this.thinkingEngine.getTraces();
    }

    async analyze(
        prompt: string,
        useAIThinking: boolean,
        _knownAgents: string[]
    ): Promise<AnalysisResult> {
        let thinkingTime = 0;
        
        const taskAnalysis = await this.thinkingEngine.analyzeTask(prompt);
        
        let aiAnalysis: AnalysisResult['aiAnalysis'];
        
        if (useAIThinking) {
            try {
                const aiAnalysisStart = Date.now();
                aiAnalysis = await this.aiClient.analyzeTask(prompt);
                thinkingTime = Date.now() - aiAnalysisStart;
                
                const mergedAgents = [...new Set([
                    ...taskAnalysis.suggestedAgents,
                    ...aiAnalysis.suggestedAgents,
                ])];
                taskAnalysis.suggestedAgents = mergedAgents;
            } catch (error) {
                console.warn('[ORCHESTRATOR] AI analysis failed:', error);
            }
        }
        
        const selectedAgents = aiAnalysis?.suggestedAgents || taskAnalysis.suggestedAgents;
        const subtasks = aiAnalysis?.subtasks || ['Implement the requested functionality'];
        
        return {
            taskAnalysis,
            aiAnalysis,
            selectedAgents,
            subtasks,
            thinkingTime,
        };
    }

    registerAgents(agents: string[]): void {
        for (const agent of agents) {
            this.agentMonitor.registerAgent(agent);
        }
    }

    startAgentExecution(agent: string, subtask: string): void {
        this.agentMonitor.startExecution(agent, subtask);
    }

    updateAgentProgress(agent: string, progress: number): void {
        this.agentMonitor.updateProgress(agent, progress);
    }

    completeAgentExecution(agent: string, success: boolean, error?: string): void {
        this.agentMonitor.completeExecution(agent, success, error);
    }

    getAllAgentStatuses(): ReturnType<AgentMonitorService['getAllStatus']> {
        return this.agentMonitor.getAllStatus();
    }
}
