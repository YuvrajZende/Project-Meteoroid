/**
 * AI Orchestration Layer
 * Integrates all AI services for a cohesive experience
 * 
 * This module provides a unified interface to:
 * - Training pipeline
 * - Output validation
 * - Quality assurance
 * - Usage analytics
 * - Error handling
 * - Feedback loop
 * 
 * @author Person 2 (AI/ML Engineer)
 */

import { getAIIntegrationService, type AIRequest, type AIResponse } from './ai-integration-service.js';
import { getTrainingDataCollector, getCostOptimizer, getPerformanceOptimizer } from './training/index.js';
import { getOutputValidator, type ValidationResult } from './validation/index.js';
import {
    getAIQualityAssurance,
    getErrorHandlingManager,
    getFeedbackLoop,
    getUsageAnalyticsService,
    type ErrorEvent,
} from './production/index.js';

// ============================================
// TYPES
// ============================================

export interface AIOrchestrationRequest extends AIRequest {
    sessionId: string;
    userId?: string;
    agent: 'database' | 'queue' | 'test' | 'code';
    validateOutput?: boolean;
    trackUsage?: boolean;
    collectTraining?: boolean;
}

export interface AIOrchestrationResult {
    response: AIResponse;
    validation?: ValidationResult;
    metadata: {
        requestId: string;
        latency: number;
        cached: boolean;
        qualityScore?: number;
    };
}

// ============================================
// AI ORCHESTRATION SERVICE
// ============================================

export class AIOrchestrationService {
    private aiService = getAIIntegrationService();
    private trainingCollector = getTrainingDataCollector();
    private costOptimizer = getCostOptimizer();
    private performanceOptimizer = getPerformanceOptimizer();
    private outputValidator = getOutputValidator();
    private qualityAssurance = getAIQualityAssurance();
    private errorHandler = getErrorHandlingManager();
    private feedbackLoop = getFeedbackLoop();
    private usageAnalytics = getUsageAnalyticsService();

    /**
     * Execute an AI request with full orchestration
     */
    async execute(request: AIOrchestrationRequest): Promise<AIOrchestrationResult> {
        const requestId = this.generateId();
        const startTime = Date.now();
        let response: AIResponse;
        let validation: ValidationResult | undefined;
        let error: Error | null = null;

        try {
            // Execute the AI request
            response = await this.aiService.chat(request);
            const latency = Date.now() - startTime;

            // Track performance
            this.performanceOptimizer.trackLatency(latency);
            this.performanceOptimizer.trackSuccess(true);

            // Track cost
            const cost = this.estimateCost(request.model || 'gpt-4', response.usage?.totalTokens || 0);
            this.costOptimizer.trackRequest(request.model || 'gpt-4', response.usage?.totalTokens || 0, cost, false);

            // Validate output if requested
            if (request.validateOutput) {
                validation = this.outputValidator.validateForCategory(response.content, request.agent);
            }

            // Track quality
            const qualityScore = validation?.score || this.estimateQuality(response.content);
            this.qualityAssurance.trackRequest(request.agent, true, latency, qualityScore);

            // Collect training data if requested
            if (request.collectTraining && qualityScore >= 70) {
                this.trainingCollector.collectFromGeneration(
                    request.prompt,
                    response.content,
                    request.agent,
                    Math.round(qualityScore / 20) as 1 | 2 | 3 | 4 | 5
                );
            }

            // Track usage
            if (request.trackUsage) {
                this.usageAnalytics.trackEvent({
                    timestamp: new Date(),
                    sessionId: request.sessionId,
                    userId: request.userId,
                    agent: request.agent,
                    action: 'generate',
                    prompt: request.prompt.substring(0, 100),
                    model: request.model || 'gpt-4',
                    tokensUsed: response.usage?.totalTokens || 0,
                    latency,
                    success: true,
                    qualityScore,
                });
            }

            return {
                response,
                validation,
                metadata: {
                    requestId,
                    latency,
                    cached: false,
                    qualityScore,
                },
            };

        } catch (err) {
            error = err instanceof Error ? err : new Error(String(err));
            const latency = Date.now() - startTime;

            // Track failure
            this.performanceOptimizer.trackSuccess(false);
            this.qualityAssurance.trackRequest(request.agent, false, latency, 0);

            // Log error
            const errorEvent = this.errorHandler.handleError(
                request.agent,
                this.classifyError(error),
                error.message,
                {
                    prompt: request.prompt.substring(0, 200),
                    model: request.model,
                    latency,
                }
            );

            // Track failed usage
            if (request.trackUsage) {
                this.usageAnalytics.trackEvent({
                    timestamp: new Date(),
                    sessionId: request.sessionId,
                    userId: request.userId,
                    agent: request.agent,
                    action: 'generate',
                    prompt: request.prompt.substring(0, 100),
                    model: request.model || 'gpt-4',
                    tokensUsed: 0,
                    latency,
                    success: false,
                });
            }

            throw new AIOrchestrationError(error.message, errorEvent, request.agent);
        }
    }

    /**
     * Submit user feedback for a generation
     */
    submitFeedback(
        sessionId: string,
        agent: string,
        prompt: string,
        generatedCode: string,
        rating: 1 | 2 | 3 | 4 | 5,
        feedback?: string
    ): void {
        this.feedbackLoop.submitFeedback(sessionId, agent, prompt, generatedCode, rating, { feedback });

        // Track feedback action
        this.usageAnalytics.trackEvent({
            timestamp: new Date(),
            sessionId,
            agent,
            action: rating >= 4 ? 'accept' : 'reject',
            prompt: prompt.substring(0, 100),
            model: 'feedback',
            tokensUsed: 0,
            latency: 0,
            success: true,
            qualityScore: rating * 20,
        });
    }

    /**
     * Get comprehensive dashboard metrics
     */
    getDashboardMetrics(timeWindowHours: number = 24): AIOrchestrationDashboard {
        const qualityMetrics = this.qualityAssurance.getMetrics(timeWindowHours);
        const errorStats = this.errorHandler.getErrorStats(timeWindowHours);
        const feedbackAnalytics = this.feedbackLoop.getAnalytics();
        const usageAnalytics = this.usageAnalytics.getAnalytics(Math.ceil(timeWindowHours / 24));
        const costAnalysis = this.costOptimizer.analyze();
        const perfMetrics = this.performanceOptimizer.getMetrics();
        const perfRecommendations = this.performanceOptimizer.getRecommendations();

        return {
            quality: {
                successRate: qualityMetrics.successRate,
                averageQuality: qualityMetrics.averageQualityScore,
                totalRequests: qualityMetrics.totalRequests,
            },
            errors: {
                totalErrors: errorStats.totalErrors,
                unresolvedErrors: errorStats.unresolvedErrors,
                errorRate: errorStats.errorRate,
                topErrorTypes: Object.entries(errorStats.byType).slice(0, 5),
            },
            feedback: {
                totalFeedback: feedbackAnalytics.totalFeedback,
                averageRating: feedbackAnalytics.averageRating,
                topIssues: feedbackAnalytics.topIssues.slice(0, 5),
            },
            usage: {
                totalSessions: usageAnalytics.totalSessions,
                totalRequests: usageAnalytics.totalRequests,
                topAgents: Object.entries(usageAnalytics.byAgent)
                    .map(([agent, data]) => ({ agent, ...data }))
                    .sort((a, b) => b.requests - a.requests)
                    .slice(0, 5),
            },
            cost: {
                currentCostPerRequest: costAnalysis.currentCostPerRequest,
                potentialSavings: costAnalysis.savingsPercentage,
                topRecommendations: costAnalysis.recommendations.slice(0, 3),
            },
            performance: {
                averageLatency: perfMetrics.averageLatency,
                p95Latency: perfMetrics.p95Latency,
                cacheHitRate: perfMetrics.cacheHitRate,
                recommendations: perfRecommendations,
            },
        };
    }

    /**
     * Get health status of all AI services
     */
    getHealthStatus(): AIOrchestrationHealth {
        const qualityCheck = this.qualityAssurance.checkThresholds({
            minSuccessRate: 0.9,
            maxLatency: 5000,
            minQualityScore: 60,
        });

        const errorStats = this.errorHandler.getErrorStats(1);
        const perfMetrics = this.performanceOptimizer.getMetrics();

        const issues: string[] = [];

        if (!qualityCheck.passed) {
            issues.push(...qualityCheck.violations);
        }
        if (errorStats.errorRate > 5) {
            issues.push(`High error rate: ${errorStats.errorRate.toFixed(1)} errors/hour`);
        }
        if (perfMetrics.p95Latency > 10000) {
            issues.push(`High P95 latency: ${perfMetrics.p95Latency.toFixed(0)}ms`);
        }

        return {
            status: issues.length === 0 ? 'healthy' : issues.length < 3 ? 'degraded' : 'unhealthy',
            issues,
            lastCheck: new Date(),
            services: {
                aiService: 'operational',
                validation: 'operational',
                training: 'operational',
                analytics: 'operational',
            },
        };
    }

    private classifyError(error: Error): ErrorEvent['errorType'] {
        const message = error.message.toLowerCase();

        if (message.includes('rate limit') || message.includes('429')) return 'rate-limit';
        if (message.includes('timeout')) return 'timeout';
        if (message.includes('parse') || message.includes('json')) return 'parsing';
        if (message.includes('api') || message.includes('fetch')) return 'api';
        if (message.includes('valid')) return 'validation';
        return 'unknown';
    }

    private estimateCost(model: string, tokens: number): number {
        const costPer1k: Record<string, number> = {
            'gpt-4': 0.03,
            'gpt-4-turbo': 0.01,
            'gpt-3.5-turbo': 0.001,
            'claude-3-opus': 0.015,
            'claude-3-sonnet': 0.003,
        };
        return (tokens / 1000) * (costPer1k[model] || 0.01);
    }

    private estimateQuality(code: string): number {
        let score = 50;

        if (code.includes('export')) score += 10;
        if (code.includes('interface') || code.includes('type')) score += 10;
        if (code.includes('async')) score += 5;
        if (code.includes('/**')) score += 10;
        if (code.includes('try') && code.includes('catch')) score += 5;
        if (code.length > 500) score += 5;
        if (code.includes('any')) score -= 5;

        return Math.min(100, Math.max(0, score));
    }

    private generateId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// ============================================
// TYPES FOR DASHBOARD
// ============================================

export interface AIOrchestrationDashboard {
    quality: {
        successRate: number;
        averageQuality: number;
        totalRequests: number;
    };
    errors: {
        totalErrors: number;
        unresolvedErrors: number;
        errorRate: number;
        topErrorTypes: [string, number][];
    };
    feedback: {
        totalFeedback: number;
        averageRating: number;
        topIssues: Array<{ type: string; count: number }>;
    };
    usage: {
        totalSessions: number;
        totalRequests: number;
        topAgents: Array<{ agent: string; requests: number; acceptRate: number }>;
    };
    cost: {
        currentCostPerRequest: number;
        potentialSavings: number;
        topRecommendations: Array<{ type: string; description: string; estimatedSavings: number }>;
    };
    performance: {
        averageLatency: number;
        p95Latency: number;
        cacheHitRate: number;
        recommendations: string[];
    };
}

export interface AIOrchestrationHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    lastCheck: Date;
    services: {
        aiService: 'operational' | 'degraded' | 'down';
        validation: 'operational' | 'degraded' | 'down';
        training: 'operational' | 'degraded' | 'down';
        analytics: 'operational' | 'degraded' | 'down';
    };
}

// ============================================
// ERROR CLASS
// ============================================

export class AIOrchestrationError extends Error {
    constructor(
        message: string,
        public readonly errorEvent: ErrorEvent,
        public readonly agent: string
    ) {
        super(message);
        this.name = 'AIOrchestrationError';
    }
}

// ============================================
// SINGLETON
// ============================================

let aiOrchestrationService: AIOrchestrationService | null = null;

export function getAIOrchestrationService(): AIOrchestrationService {
    if (!aiOrchestrationService) {
        aiOrchestrationService = new AIOrchestrationService();
    }
    return aiOrchestrationService;
}
