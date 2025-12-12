/**
 * Cost Tracker Service - Production-Grade AI Cost Management
 * 
 * Tracks all AI API costs in real-time:
 * - Per-request cost tracking
 * - Per-model cost aggregation
 * - Budget alerts and limits
 * - Cost optimization recommendations
 * - Historical cost analysis
 * - Supabase persistence for long-term storage
 */

import { getModel } from './model-registry.js';
import { getSupabaseAdmin, checkSupabaseConnection } from './database-client.js';

// ============================================
// TYPES
// ============================================

export interface CostRecord {
    id: string;
    timestamp: string;
    modelId: string;
    modelName: string;
    provider: string;

    // Token usage
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheHit: boolean;

    // Cost in USD
    inputCost: number;
    outputCost: number;
    totalCost: number;

    // Context
    taskId?: string;
    projectId?: string;
    userId?: string;
    stage: 'analysis' | 'code-generation' | 'context-preparation' | 'other';

    // Performance
    latencyMs: number;
    success: boolean;
    error?: string;
}

export interface CostSummary {
    totalCost: number;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgCostPerRequest: number;
    avgTokensPerRequest: number;
    costByModel: Record<string, number>;
    costByProvider: Record<string, number>;
    costByStage: Record<string, number>;
    period: {
        start: string;
        end: string;
    };
}

export interface BudgetConfig {
    dailyLimitUSD: number;
    monthlyLimitUSD: number;
    alertThreshold: number; // 0-1, e.g., 0.8 = alert at 80%
    hardLimit: boolean; // If true, block requests when limit reached
}

export interface CostOptimizationSuggestion {
    type: 'model-switch' | 'caching' | 'batching' | 'context-reduction';
    description: string;
    potentialSavings: number; // USD
    currentCost: number;
    suggestedCost: number;
}

// ============================================
// COST TRACKER SERVICE
// ============================================

export class CostTrackerService {
    private records: CostRecord[] = [];
    private budget: BudgetConfig;
    private dailyCost: number = 0;
    private monthlyCost: number = 0;
    private lastDayReset: string = '';
    private lastMonthReset: string = '';
    private supabaseEnabled: boolean = false;
    private pendingPersistence: CostRecord[] = [];
    private persistenceInterval: NodeJS.Timeout | null = null;

    constructor(budget?: Partial<BudgetConfig>) {
        this.budget = {
            dailyLimitUSD: budget?.dailyLimitUSD ?? parseFloat(process.env.DAILY_BUDGET_USD || '10.00'),
            monthlyLimitUSD: budget?.monthlyLimitUSD ?? parseFloat(process.env.MONTHLY_BUDGET_USD || '100.00'),
            alertThreshold: budget?.alertThreshold ?? parseFloat(process.env.BUDGET_ALERT_THRESHOLD || '0.8'),
            hardLimit: budget?.hardLimit ?? (process.env.BUDGET_HARD_LIMIT === 'true'),
        };

        this.resetDailyIfNeeded();
        this.resetMonthlyIfNeeded();

        // Initialize Supabase persistence
        this.initializeSupabasePersistence();
    }

    /**
     * Initialize Supabase persistence (async)
     */
    private async initializeSupabasePersistence(): Promise<void> {
        try {
            const isConnected = await checkSupabaseConnection();
            if (isConnected) {
                this.supabaseEnabled = true;
                console.log('[COST-TRACKER] Supabase persistence enabled');

                // Start periodic persistence (every 30 seconds)
                this.persistenceInterval = setInterval(() => {
                    this.flushPendingRecords().catch(console.error);
                }, 30000);
            } else {
                console.log('[COST-TRACKER] Supabase not connected, using in-memory only');
            }
        } catch (error) {
            console.warn('[COST-TRACKER] Supabase initialization failed:', error);
        }
    }

    /**
     * Record a new API call cost
     */
    recordCost(params: {
        modelId: string;
        inputTokens: number;
        outputTokens: number;
        cacheHit?: boolean;
        taskId?: string;
        projectId?: string;
        userId?: string;
        stage: CostRecord['stage'];
        latencyMs: number;
        success: boolean;
        error?: string;
    }): CostRecord {
        this.resetDailyIfNeeded();
        this.resetMonthlyIfNeeded();

        const model = getModel(params.modelId);
        const inputCost = this.calculateInputCost(params.modelId, params.inputTokens, params.cacheHit || false);
        const outputCost = this.calculateOutputCost(params.modelId, params.outputTokens);
        const totalCost = inputCost + outputCost;

        const record: CostRecord = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            modelId: params.modelId,
            modelName: model?.name || params.modelId,
            provider: model?.provider || 'unknown',
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            totalTokens: params.inputTokens + params.outputTokens,
            cacheHit: params.cacheHit || false,
            inputCost,
            outputCost,
            totalCost,
            taskId: params.taskId,
            projectId: params.projectId,
            userId: params.userId,
            stage: params.stage,
            latencyMs: params.latencyMs,
            success: params.success,
            error: params.error,
        };

        this.records.push(record);
        this.dailyCost += totalCost;
        this.monthlyCost += totalCost;

        // Queue for Supabase persistence
        if (this.supabaseEnabled) {
            this.pendingPersistence.push(record);
        }

        // Keep only last 10,000 records in memory
        if (this.records.length > 10000) {
            this.records = this.records.slice(-10000);
        }

        // Check budget alerts
        this.checkBudgetAlerts();

        return record;
    }

    /**
     * Flush pending records to Supabase
     */
    private async flushPendingRecords(): Promise<void> {
        if (!this.supabaseEnabled || this.pendingPersistence.length === 0) {
            return;
        }

        const recordsToFlush = [...this.pendingPersistence];
        this.pendingPersistence = [];

        try {
            const supabase = getSupabaseAdmin();

            // Transform records to DB format
            // Note: project_id and user_id should be UUIDs or null
            const isValidUUID = (str: string | undefined): boolean => {
                if (!str) return false;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return uuidRegex.test(str);
            };

            const dbRecords = recordsToFlush.map(record => ({
                id: record.id,
                model_id: record.modelId,
                model_name: record.modelName,
                provider: record.provider,
                input_tokens: record.inputTokens,
                output_tokens: record.outputTokens,
                total_tokens: record.totalTokens,
                cache_hit: record.cacheHit,
                input_cost: record.inputCost,
                output_cost: record.outputCost,
                total_cost: record.totalCost,
                task_id: record.taskId,
                project_id: isValidUUID(record.projectId) ? record.projectId : null,
                user_id: isValidUUID(record.userId) ? record.userId : null,
                stage: record.stage,
                latency_ms: record.latencyMs,
                success: record.success,
                error: record.error,
                created_at: record.timestamp,
            }));

            const { error } = await supabase
                .from('cost_records')
                .insert(dbRecords);

            if (error) {
                console.error('[COST-TRACKER] Failed to persist records:', error);
                // Put records back for retry
                this.pendingPersistence.unshift(...recordsToFlush);
            } else {
                console.log(`[COST-TRACKER] Persisted ${recordsToFlush.length} records to Supabase`);
            }
        } catch (error) {
            console.error('[COST-TRACKER] Persistence error:', error);
            // Put records back for retry
            this.pendingPersistence.unshift(...recordsToFlush);
        }
    }

    /**
     * Force flush all pending records (call before shutdown)
     */
    async shutdown(): Promise<void> {
        if (this.persistenceInterval) {
            clearInterval(this.persistenceInterval);
        }
        await this.flushPendingRecords();
    }

    /**
     * Calculate input token cost
     */
    private calculateInputCost(modelId: string, tokens: number, cacheHit: boolean): number {
        const model = getModel(modelId);
        if (!model) return 0;

        const rate = cacheHit && model.pricing.cacheHitPerMillion
            ? model.pricing.cacheHitPerMillion
            : model.pricing.inputPerMillion;

        return (tokens / 1_000_000) * rate;
    }

    /**
     * Calculate output token cost
     */
    private calculateOutputCost(modelId: string, tokens: number): number {
        const model = getModel(modelId);
        if (!model) return 0;

        return (tokens / 1_000_000) * model.pricing.outputPerMillion;
    }

    /**
     * Reset daily cost if it's a new day
     */
    private resetDailyIfNeeded(): void {
        const today = new Date().toISOString().split('T')[0];
        if (this.lastDayReset !== today) {
            this.dailyCost = 0;
            this.lastDayReset = today;
        }
    }

    /**
     * Reset monthly cost if it's a new month
     */
    private resetMonthlyIfNeeded(): void {
        const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        if (this.lastMonthReset !== thisMonth) {
            this.monthlyCost = 0;
            this.lastMonthReset = thisMonth;
        }
    }

    /**
     * Check budget and trigger alerts if needed
     */
    private checkBudgetAlerts(): void {
        const dailyRatio = this.dailyCost / this.budget.dailyLimitUSD;
        const monthlyRatio = this.monthlyCost / this.budget.monthlyLimitUSD;

        if (dailyRatio >= this.budget.alertThreshold) {
            console.warn(`[COST-TRACKER] ⚠️ Daily budget ${(dailyRatio * 100).toFixed(1)}% used ($${this.dailyCost.toFixed(4)} / $${this.budget.dailyLimitUSD})`);
        }

        if (monthlyRatio >= this.budget.alertThreshold) {
            console.warn(`[COST-TRACKER] ⚠️ Monthly budget ${(monthlyRatio * 100).toFixed(1)}% used ($${this.monthlyCost.toFixed(4)} / $${this.budget.monthlyLimitUSD})`);
        }
    }

    /**
     * Check if we can proceed with a request (budget check)
     */
    canProceed(estimatedCost: number = 0): { allowed: boolean; reason?: string } {
        if (!this.budget.hardLimit) {
            return { allowed: true };
        }

        if (this.dailyCost + estimatedCost > this.budget.dailyLimitUSD) {
            return {
                allowed: false,
                reason: `Daily budget exceeded: $${this.dailyCost.toFixed(4)} / $${this.budget.dailyLimitUSD}`,
            };
        }

        if (this.monthlyCost + estimatedCost > this.budget.monthlyLimitUSD) {
            return {
                allowed: false,
                reason: `Monthly budget exceeded: $${this.monthlyCost.toFixed(4)} / $${this.budget.monthlyLimitUSD}`,
            };
        }

        return { allowed: true };
    }

    /**
     * Get current daily cost
     */
    getDailyCost(): number {
        this.resetDailyIfNeeded();
        return this.dailyCost;
    }

    /**
     * Get current monthly cost
     */
    getMonthlyCost(): number {
        this.resetMonthlyIfNeeded();
        return this.monthlyCost;
    }

    /**
     * Get budget status
     */
    getBudgetStatus(): {
        daily: { used: number; limit: number; percentage: number };
        monthly: { used: number; limit: number; percentage: number };
    } {
        this.resetDailyIfNeeded();
        this.resetMonthlyIfNeeded();

        return {
            daily: {
                used: this.dailyCost,
                limit: this.budget.dailyLimitUSD,
                percentage: (this.dailyCost / this.budget.dailyLimitUSD) * 100,
            },
            monthly: {
                used: this.monthlyCost,
                limit: this.budget.monthlyLimitUSD,
                percentage: (this.monthlyCost / this.budget.monthlyLimitUSD) * 100,
            },
        };
    }

    /**
     * Get cost summary for a time period
     */
    getSummary(startDate?: Date, endDate?: Date): CostSummary {
        const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        const end = endDate || new Date();

        const filteredRecords = this.records.filter(r => {
            const timestamp = new Date(r.timestamp);
            return timestamp >= start && timestamp <= end;
        });

        const costByModel: Record<string, number> = {};
        const costByProvider: Record<string, number> = {};
        const costByStage: Record<string, number> = {};

        let totalCost = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        for (const record of filteredRecords) {
            totalCost += record.totalCost;
            totalInputTokens += record.inputTokens;
            totalOutputTokens += record.outputTokens;

            costByModel[record.modelId] = (costByModel[record.modelId] || 0) + record.totalCost;
            costByProvider[record.provider] = (costByProvider[record.provider] || 0) + record.totalCost;
            costByStage[record.stage] = (costByStage[record.stage] || 0) + record.totalCost;
        }

        return {
            totalCost,
            totalRequests: filteredRecords.length,
            totalInputTokens,
            totalOutputTokens,
            avgCostPerRequest: filteredRecords.length > 0 ? totalCost / filteredRecords.length : 0,
            avgTokensPerRequest: filteredRecords.length > 0
                ? (totalInputTokens + totalOutputTokens) / filteredRecords.length
                : 0,
            costByModel,
            costByProvider,
            costByStage,
            period: {
                start: start.toISOString(),
                end: end.toISOString(),
            },
        };
    }

    /**
     * Get optimization suggestions based on usage patterns
     */
    getOptimizationSuggestions(): CostOptimizationSuggestion[] {
        const suggestions: CostOptimizationSuggestion[] = [];
        const summary = this.getSummary();

        // Check if expensive models are used for analysis
        const analysisRecords = this.records.filter(r => r.stage === 'analysis');
        const expensiveAnalysis = analysisRecords.filter(r => {
            const model = getModel(r.modelId);
            return model && model.tier === 'powerful';
        });

        if (expensiveAnalysis.length > 0) {
            const currentCost = expensiveAnalysis.reduce((sum, r) => sum + r.totalCost, 0);
            const estimatedSavings = currentCost * 0.9; // Fast models are ~10x cheaper

            suggestions.push({
                type: 'model-switch',
                description: `Switch to a fast model (GPT-4o Mini or GLM-4 Flash) for task analysis. ${expensiveAnalysis.length} analysis calls used expensive models.`,
                potentialSavings: estimatedSavings,
                currentCost,
                suggestedCost: currentCost - estimatedSavings,
            });
        }

        // Check for low cache hit rate with DeepSeek
        const deepseekRecords = this.records.filter(r => r.provider === 'deepseek');
        if (deepseekRecords.length > 10) {
            const cacheHits = deepseekRecords.filter(r => r.cacheHit).length;
            const cacheHitRate = cacheHits / deepseekRecords.length;

            if (cacheHitRate < 0.5) {
                const potentialSavings = deepseekRecords.reduce((sum, r) => {
                    if (!r.cacheHit) {
                        return sum + (r.inputCost * 0.74); // Cache hit is ~74% cheaper
                    }
                    return sum;
                }, 0);

                suggestions.push({
                    type: 'caching',
                    description: `DeepSeek cache hit rate is ${(cacheHitRate * 100).toFixed(1)}%. Consider reusing prompts to improve caching.`,
                    potentialSavings,
                    currentCost: summary.costByProvider['deepseek'] || 0,
                    suggestedCost: (summary.costByProvider['deepseek'] || 0) - potentialSavings,
                });
            }
        }

        return suggestions;
    }

    /**
     * Get recent records
     */
    getRecentRecords(limit: number = 100): CostRecord[] {
        return this.records.slice(-limit);
    }

    /**
     * Clear all records (for testing)
     */
    clear(): void {
        this.records = [];
        this.dailyCost = 0;
        this.monthlyCost = 0;
    }

    /**
     * Update budget configuration
     */
    updateBudget(budget: Partial<BudgetConfig>): void {
        this.budget = { ...this.budget, ...budget };
    }
}

// ============================================
// SINGLETON
// ============================================

let costTrackerInstance: CostTrackerService | null = null;

export function getCostTracker(): CostTrackerService {
    if (!costTrackerInstance) {
        costTrackerInstance = new CostTrackerService();
    }
    return costTrackerInstance;
}

export function createCostTracker(budget?: Partial<BudgetConfig>): CostTrackerService {
    costTrackerInstance = new CostTrackerService(budget);
    return costTrackerInstance;
}
