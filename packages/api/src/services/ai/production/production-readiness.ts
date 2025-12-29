/**
 * Production Readiness System
 * AI Quality Assurance, Error Handling, Feedback Loop, and Usage Analytics
 * 
 * @author Person 2 (AI/ML Engineer)
 * @phase Phase 6 - Production Readiness
 */

// ============================================
// TYPES
// ============================================

export interface AIQualityMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageLatency: number;
    averageQualityScore: number;
    byAgent: Record<string, AgentQualityMetrics>;
    byTimeWindow: TimeWindowMetrics[];
}

export interface AgentQualityMetrics {
    agentName: string;
    requests: number;
    successRate: number;
    avgLatency: number;
    avgQuality: number;
    errorRate: number;
    topErrors: string[];
}

export interface TimeWindowMetrics {
    windowStart: Date;
    windowEnd: Date;
    requests: number;
    successRate: number;
    avgLatency: number;
}

export interface ErrorEvent {
    id: string;
    timestamp: Date;
    agent: string;
    errorType: 'api' | 'validation' | 'timeout' | 'rate-limit' | 'parsing' | 'unknown';
    message: string;
    stack?: string;
    context: {
        prompt?: string;
        model?: string;
        tokensUsed?: number;
        latency?: number;
    };
    resolved: boolean;
    resolution?: string;
}

export interface FeedbackEntry {
    id: string;
    timestamp: Date;
    sessionId: string;
    agent: string;
    prompt: string;
    generatedCode: string;
    rating: 1 | 2 | 3 | 4 | 5;
    feedback?: string;
    issues: FeedbackIssue[];
    improvements: string[];
    usedInTraining: boolean;
}

export interface FeedbackIssue {
    type: 'incorrect' | 'incomplete' | 'style' | 'performance' | 'security' | 'other';
    description: string;
    severity: 'low' | 'medium' | 'high';
}

export interface UsageEvent {
    id: string;
    timestamp: Date;
    sessionId: string;
    userId?: string;
    agent: string;
    action: 'generate' | 'edit' | 'accept' | 'reject' | 'retry';
    prompt: string;
    model: string;
    tokensUsed: number;
    latency: number;
    success: boolean;
    qualityScore?: number;
}

export interface UsageAnalytics {
    totalSessions: number;
    totalRequests: number;
    uniqueUsers: number;
    byAgent: Record<string, {
        requests: number;
        acceptRate: number;
        avgRetries: number;
    }>;
    byTimeOfDay: Record<number, number>;
    byDayOfWeek: Record<number, number>;
    topPromptPatterns: Array<{ pattern: string; count: number }>;
    userRetentionRate: number;
}

// ============================================
// AI QUALITY ASSURANCE
// ============================================

export class AIQualityAssurance {
    private metrics: {
        requests: Array<{
            timestamp: Date;
            agent: string;
            success: boolean;
            latency: number;
            quality: number;
        }>;
    } = { requests: [] };

    /**
     * Track a request for quality metrics
     */
    trackRequest(
        agent: string,
        success: boolean,
        latency: number,
        qualityScore: number
    ): void {
        this.metrics.requests.push({
            timestamp: new Date(),
            agent,
            success,
            latency,
            quality: qualityScore,
        });

        // Keep last 50000 requests
        if (this.metrics.requests.length > 50000) {
            this.metrics.requests = this.metrics.requests.slice(-50000);
        }
    }

    /**
     * Get comprehensive quality metrics
     */
    getMetrics(timeWindowHours: number = 24): AIQualityMetrics {
        const cutoff = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
        const recentRequests = this.metrics.requests.filter(r => r.timestamp >= cutoff);

        const totalRequests = recentRequests.length;
        if (totalRequests === 0) {
            return {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                successRate: 0,
                averageLatency: 0,
                averageQualityScore: 0,
                byAgent: {},
                byTimeWindow: [],
            };
        }

        const successfulRequests = recentRequests.filter(r => r.success).length;
        const failedRequests = totalRequests - successfulRequests;
        const successRate = successfulRequests / totalRequests;
        const averageLatency = recentRequests.reduce((sum, r) => sum + r.latency, 0) / totalRequests;
        const averageQualityScore = recentRequests.reduce((sum, r) => sum + r.quality, 0) / totalRequests;

        // Metrics by agent
        const byAgent: Record<string, AgentQualityMetrics> = {};
        const agentGroups = this.groupBy(recentRequests, r => r.agent);

        for (const [agentName, requests] of Object.entries(agentGroups)) {
            const agentTotal = requests.length;
            const agentSuccess = requests.filter(r => r.success).length;

            byAgent[agentName] = {
                agentName,
                requests: agentTotal,
                successRate: agentSuccess / agentTotal,
                avgLatency: requests.reduce((sum, r) => sum + r.latency, 0) / agentTotal,
                avgQuality: requests.reduce((sum, r) => sum + r.quality, 0) / agentTotal,
                errorRate: (agentTotal - agentSuccess) / agentTotal,
                topErrors: [], // Would be populated from error tracking
            };
        }

        // Metrics by time window (hourly)
        const byTimeWindow: TimeWindowMetrics[] = [];
        for (let i = 0; i < timeWindowHours; i++) {
            const windowStart = new Date(Date.now() - (i + 1) * 60 * 60 * 1000);
            const windowEnd = new Date(Date.now() - i * 60 * 60 * 1000);
            const windowRequests = recentRequests.filter(
                r => r.timestamp >= windowStart && r.timestamp < windowEnd
            );

            if (windowRequests.length > 0) {
                byTimeWindow.push({
                    windowStart,
                    windowEnd,
                    requests: windowRequests.length,
                    successRate: windowRequests.filter(r => r.success).length / windowRequests.length,
                    avgLatency: windowRequests.reduce((sum, r) => sum + r.latency, 0) / windowRequests.length,
                });
            }
        }

        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            successRate,
            averageLatency,
            averageQualityScore,
            byAgent,
            byTimeWindow,
        };
    }

    /**
     * Check if quality thresholds are met
     */
    checkThresholds(thresholds: {
        minSuccessRate?: number;
        maxLatency?: number;
        minQualityScore?: number;
    }): { passed: boolean; violations: string[] } {
        const metrics = this.getMetrics();
        const violations: string[] = [];

        if (thresholds.minSuccessRate && metrics.successRate < thresholds.minSuccessRate) {
            violations.push(`Success rate ${(metrics.successRate * 100).toFixed(1)}% below threshold ${thresholds.minSuccessRate * 100}%`);
        }
        if (thresholds.maxLatency && metrics.averageLatency > thresholds.maxLatency) {
            violations.push(`Average latency ${metrics.averageLatency.toFixed(0)}ms above threshold ${thresholds.maxLatency}ms`);
        }
        if (thresholds.minQualityScore && metrics.averageQualityScore < thresholds.minQualityScore) {
            violations.push(`Quality score ${metrics.averageQualityScore.toFixed(1)} below threshold ${thresholds.minQualityScore}`);
        }

        return { passed: violations.length === 0, violations };
    }

    private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
        const result: Record<string, T[]> = {};
        for (const item of array) {
            const key = keyFn(item);
            if (!result[key]) result[key] = [];
            result[key].push(item);
        }
        return result;
    }
}

// ============================================
// ERROR HANDLING MANAGER
// ============================================

export class ErrorHandlingManager {
    private errors: ErrorEvent[] = [];
    private errorHandlers: Map<ErrorEvent['errorType'], (error: ErrorEvent) => void> = new Map();

    /**
     * Register an error handler for a specific type
     */
    registerHandler(errorType: ErrorEvent['errorType'], handler: (error: ErrorEvent) => void): void {
        this.errorHandlers.set(errorType, handler);
    }

    /**
     * Log and handle an error
     */
    handleError(
        agent: string,
        errorType: ErrorEvent['errorType'],
        message: string,
        context: ErrorEvent['context'],
        stack?: string
    ): ErrorEvent {
        const errorEvent: ErrorEvent = {
            id: this.generateId(),
            timestamp: new Date(),
            agent,
            errorType,
            message,
            stack,
            context,
            resolved: false,
        };

        this.errors.push(errorEvent);

        // Keep last 10000 errors
        if (this.errors.length > 10000) {
            this.errors = this.errors.slice(-10000);
        }

        // Call registered handler
        const handler = this.errorHandlers.get(errorType);
        if (handler) {
            handler(errorEvent);
        }

        return errorEvent;
    }

    /**
     * Mark an error as resolved
     */
    resolveError(errorId: string, resolution: string): void {
        const error = this.errors.find(e => e.id === errorId);
        if (error) {
            error.resolved = true;
            error.resolution = resolution;
        }
    }

    /**
     * Get error statistics
     */
    getErrorStats(timeWindowHours: number = 24): {
        totalErrors: number;
        unresolvedErrors: number;
        byType: Record<string, number>;
        byAgent: Record<string, number>;
        recentErrors: ErrorEvent[];
        errorRate: number;
    } {
        const cutoff = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
        const recentErrors = this.errors.filter(e => e.timestamp >= cutoff);

        const byType: Record<string, number> = {};
        const byAgent: Record<string, number> = {};

        for (const error of recentErrors) {
            byType[error.errorType] = (byType[error.errorType] || 0) + 1;
            byAgent[error.agent] = (byAgent[error.agent] || 0) + 1;
        }

        return {
            totalErrors: recentErrors.length,
            unresolvedErrors: recentErrors.filter(e => !e.resolved).length,
            byType,
            byAgent,
            recentErrors: recentErrors.slice(-10),
            errorRate: recentErrors.length / timeWindowHours, // Errors per hour
        };
    }

    /**
     * Get recovery suggestions for an error type
     */
    getRecoverySuggestions(errorType: ErrorEvent['errorType']): string[] {
        const suggestions: Record<ErrorEvent['errorType'], string[]> = {
            'api': [
                'Check API key validity',
                'Verify API endpoint URL',
                'Check rate limits',
                'Retry with exponential backoff',
            ],
            'validation': [
                'Review output format expectations',
                'Add input validation',
                'Check prompt for clarity',
            ],
            'timeout': [
                'Increase timeout threshold',
                'Use streaming for long responses',
                'Break down large requests',
            ],
            'rate-limit': [
                'Implement request queuing',
                'Add caching layer',
                'Upgrade API plan',
            ],
            'parsing': [
                'Review AI response format',
                'Add error handling for malformed responses',
                'Use more specific prompts',
            ],
            'unknown': [
                'Check logs for more details',
                'Review recent changes',
                'Contact support if persistent',
            ],
        };

        return suggestions[errorType] || suggestions['unknown'];
    }

    private generateId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// ============================================
// FEEDBACK LOOP
// ============================================

export class FeedbackLoop {
    private feedback: FeedbackEntry[] = [];

    /**
     * Submit feedback for generated code
     */
    submitFeedback(
        sessionId: string,
        agent: string,
        prompt: string,
        generatedCode: string,
        rating: 1 | 2 | 3 | 4 | 5,
        options?: {
            feedback?: string;
            issues?: FeedbackIssue[];
            improvements?: string[];
        }
    ): FeedbackEntry {
        const entry: FeedbackEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            sessionId,
            agent,
            prompt,
            generatedCode,
            rating,
            feedback: options?.feedback,
            issues: options?.issues || [],
            improvements: options?.improvements || [],
            usedInTraining: false,
        };

        this.feedback.push(entry);

        // Keep last 10000 entries
        if (this.feedback.length > 10000) {
            this.feedback = this.feedback.slice(-10000);
        }

        return entry;
    }

    /**
     * Get feedback for training data extraction
     */
    getHighQualityFeedback(minRating: number = 4): FeedbackEntry[] {
        return this.feedback.filter(
            f => f.rating >= minRating && !f.usedInTraining && f.issues.length === 0
        );
    }

    /**
     * Mark feedback as used in training
     */
    markAsUsedInTraining(feedbackIds: string[]): void {
        for (const id of feedbackIds) {
            const entry = this.feedback.find(f => f.id === id);
            if (entry) {
                entry.usedInTraining = true;
            }
        }
    }

    /**
     * Get feedback analytics
     */
    getAnalytics(): {
        totalFeedback: number;
        averageRating: number;
        ratingDistribution: Record<number, number>;
        topIssues: Array<{ type: string; count: number }>;
        byAgent: Record<string, { count: number; avgRating: number }>;
        improvementSuggestions: string[];
    } {
        const totalFeedback = this.feedback.length;
        if (totalFeedback === 0) {
            return {
                totalFeedback: 0,
                averageRating: 0,
                ratingDistribution: {},
                topIssues: [],
                byAgent: {},
                improvementSuggestions: [],
            };
        }

        const averageRating = this.feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback;

        const ratingDistribution: Record<number, number> = {};
        for (const entry of this.feedback) {
            ratingDistribution[entry.rating] = (ratingDistribution[entry.rating] || 0) + 1;
        }

        const issueCount: Record<string, number> = {};
        for (const entry of this.feedback) {
            for (const issue of entry.issues) {
                issueCount[issue.type] = (issueCount[issue.type] || 0) + 1;
            }
        }
        const topIssues = Object.entries(issueCount)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const byAgent: Record<string, { count: number; avgRating: number }> = {};
        for (const entry of this.feedback) {
            if (!byAgent[entry.agent]) {
                byAgent[entry.agent] = { count: 0, avgRating: 0 };
            }
            byAgent[entry.agent].count++;
            byAgent[entry.agent].avgRating += entry.rating;
        }
        for (const agent of Object.keys(byAgent)) {
            byAgent[agent].avgRating /= byAgent[agent].count;
        }

        // Collect unique improvement suggestions
        const allImprovements = this.feedback.flatMap(f => f.improvements);
        const improvementCount = new Map<string, number>();
        for (const improvement of allImprovements) {
            improvementCount.set(improvement, (improvementCount.get(improvement) || 0) + 1);
        }
        const improvementSuggestions = [...improvementCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([suggestion]) => suggestion);

        return {
            totalFeedback,
            averageRating,
            ratingDistribution,
            topIssues,
            byAgent,
            improvementSuggestions,
        };
    }

    private generateId(): string {
        return `fb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// ============================================
// USAGE ANALYTICS
// ============================================

export class UsageAnalyticsService {
    private events: UsageEvent[] = [];
    private sessions: Set<string> = new Set();
    private users: Set<string> = new Set();

    /**
     * Track a usage event
     */
    trackEvent(event: Omit<UsageEvent, 'id'>): UsageEvent {
        const fullEvent: UsageEvent = {
            ...event,
            id: this.generateId(),
        };

        this.events.push(fullEvent);
        this.sessions.add(event.sessionId);
        if (event.userId) {
            this.users.add(event.userId);
        }

        // Keep last 100000 events
        if (this.events.length > 100000) {
            this.events = this.events.slice(-100000);
        }

        return fullEvent;
    }

    /**
     * Get comprehensive usage analytics
     */
    getAnalytics(timeWindowDays: number = 30): UsageAnalytics {
        const cutoff = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);
        const recentEvents = this.events.filter(e => e.timestamp >= cutoff);

        const totalRequests = recentEvents.length;
        const uniqueSessions = new Set(recentEvents.map(e => e.sessionId)).size;
        const uniqueUsers = new Set(recentEvents.filter(e => e.userId).map(e => e.userId)).size;

        // By agent
        const byAgent: Record<string, { requests: number; acceptRate: number; avgRetries: number }> = {};
        const agentEvents = this.groupBy(recentEvents, e => e.agent);

        for (const [agent, events] of Object.entries(agentEvents)) {
            const accepts = events.filter(e => e.action === 'accept').length;
            const generates = events.filter(e => e.action === 'generate').length;
            const retries = events.filter(e => e.action === 'retry').length;

            byAgent[agent] = {
                requests: events.length,
                acceptRate: generates > 0 ? accepts / generates : 0,
                avgRetries: generates > 0 ? retries / generates : 0,
            };
        }

        // By time of day (0-23)
        const byTimeOfDay: Record<number, number> = {};
        for (const event of recentEvents) {
            const hour = event.timestamp.getHours();
            byTimeOfDay[hour] = (byTimeOfDay[hour] || 0) + 1;
        }

        // By day of week (0-6, Sunday = 0)
        const byDayOfWeek: Record<number, number> = {};
        for (const event of recentEvents) {
            const day = event.timestamp.getDay();
            byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
        }

        // Top prompt patterns (simplified)
        const promptPatterns: Record<string, number> = {};
        for (const event of recentEvents.filter(e => e.action === 'generate')) {
            const pattern = this.extractPromptPattern(event.prompt);
            promptPatterns[pattern] = (promptPatterns[pattern] || 0) + 1;
        }
        const topPromptPatterns = Object.entries(promptPatterns)
            .map(([pattern, count]) => ({ pattern, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // User retention (simplified - users who returned)
        const userSessions = this.groupBy(
            recentEvents.filter(e => e.userId),
            e => e.userId!
        );
        const returningUsers = Object.values(userSessions).filter(
            events => new Set(events.map(e => e.sessionId)).size > 1
        ).length;
        const userRetentionRate = uniqueUsers > 0 ? returningUsers / uniqueUsers : 0;

        return {
            totalSessions: uniqueSessions,
            totalRequests,
            uniqueUsers,
            byAgent,
            byTimeOfDay,
            byDayOfWeek,
            topPromptPatterns,
            userRetentionRate,
        };
    }

    /**
     * Get popular features/agents
     */
    getPopularFeatures(): Array<{ agent: string; action: string; count: number }> {
        const featureCount: Record<string, number> = {};

        for (const event of this.events) {
            const key = `${event.agent}:${event.action}`;
            featureCount[key] = (featureCount[key] || 0) + 1;
        }

        return Object.entries(featureCount)
            .map(([key, count]) => {
                const [agent, action] = key.split(':');
                return { agent, action, count };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    }

    private extractPromptPattern(prompt: string): string {
        // Extract pattern by normalizing prompt
        return prompt
            .toLowerCase()
            .replace(/[a-z0-9_]+/g, match =>
                ['create', 'generate', 'build', 'test', 'queue', 'database', 'api', 'user'].includes(match)
                    ? match
                    : '#'
            )
            .replace(/#+/g, '#')
            .slice(0, 50);
    }

    private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
        const result: Record<string, T[]> = {};
        for (const item of array) {
            const key = keyFn(item);
            if (!result[key]) result[key] = [];
            result[key].push(item);
        }
        return result;
    }

    private generateId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// ============================================
// SINGLETONS
// ============================================

let aiQualityAssurance: AIQualityAssurance | null = null;
let errorHandlingManager: ErrorHandlingManager | null = null;
let feedbackLoop: FeedbackLoop | null = null;
let usageAnalyticsService: UsageAnalyticsService | null = null;

export function getAIQualityAssurance(): AIQualityAssurance {
    if (!aiQualityAssurance) {
        aiQualityAssurance = new AIQualityAssurance();
    }
    return aiQualityAssurance;
}

export function getErrorHandlingManager(): ErrorHandlingManager {
    if (!errorHandlingManager) {
        errorHandlingManager = new ErrorHandlingManager();
    }
    return errorHandlingManager;
}

export function getFeedbackLoop(): FeedbackLoop {
    if (!feedbackLoop) {
        feedbackLoop = new FeedbackLoop();
    }
    return feedbackLoop;
}

export function getUsageAnalyticsService(): UsageAnalyticsService {
    if (!usageAnalyticsService) {
        usageAnalyticsService = new UsageAnalyticsService();
    }
    return usageAnalyticsService;
}
