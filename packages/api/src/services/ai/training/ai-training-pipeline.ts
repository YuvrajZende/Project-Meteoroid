/**
 * AI Training Pipeline
 * Model fine-tuning, performance optimization, and versioning
 * 
 * @author Person 2 (AI/ML Engineer)
 * @phase Phase 5 - AI Optimization
 */

// ============================================
// TYPES
// ============================================

export interface TrainingExample {
    id: string;
    prompt: string;
    completion: string;
    category: 'database' | 'queue' | 'test' | 'code' | 'general';
    quality: number; // 1-5 rating
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface TrainingDataset {
    id: string;
    name: string;
    version: string;
    examples: TrainingExample[];
    categories: string[];
    totalExamples: number;
    qualityScore: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ModelVersion {
    id: string;
    name: string;
    version: string;
    baseModel: string;
    trainingDatasetId: string;
    status: 'pending' | 'training' | 'completed' | 'failed' | 'deployed';
    metrics: ModelMetrics;
    config: TrainingConfig;
    createdAt: Date;
    completedAt?: Date;
}

export interface ModelMetrics {
    accuracy: number;
    latency: number;
    tokensPerSecond: number;
    costPerRequest: number;
    successRate: number;
    averageQuality: number;
}

export interface TrainingConfig {
    epochs: number;
    learningRate: number;
    batchSize: number;
    warmupSteps: number;
    maxTokens: number;
    validationSplit: number;
}

export interface CostOptimization {
    currentCostPerRequest: number;
    optimizedCostPerRequest: number;
    savingsPercentage: number;
    recommendations: CostRecommendation[];
}

export interface CostRecommendation {
    type: 'model' | 'caching' | 'batching' | 'prompt';
    description: string;
    estimatedSavings: number;
    implementation: string;
}

export interface PerformanceMetrics {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
    errorRate: number;
    cacheHitRate: number;
}

// ============================================
// TRAINING DATA COLLECTOR
// ============================================

export class TrainingDataCollector {
    private examples: TrainingExample[] = [];
    private datasets: Map<string, TrainingDataset> = new Map();

    /**
     * Add a training example from generated code
     */
    addExample(example: Omit<TrainingExample, 'id' | 'createdAt'>): TrainingExample {
        const newExample: TrainingExample = {
            ...example,
            id: this.generateId(),
            createdAt: new Date(),
        };
        this.examples.push(newExample);
        return newExample;
    }

    /**
     * Collect example from successful code generation
     */
    collectFromGeneration(
        prompt: string,
        generatedCode: string,
        category: TrainingExample['category'],
        userRating?: number
    ): TrainingExample {
        return this.addExample({
            prompt,
            completion: generatedCode,
            category,
            quality: userRating || this.estimateQuality(generatedCode),
            metadata: {
                source: 'generation',
                timestamp: new Date().toISOString(),
            },
        });
    }

    /**
     * Estimate quality of generated code
     */
    private estimateQuality(code: string): number {
        let score = 3; // Base score

        // Check for code structure
        if (code.includes('export')) score += 0.3;
        if (code.includes('interface') || code.includes('type')) score += 0.3;
        if (code.includes('async') && code.includes('await')) score += 0.2;
        if (code.includes('try') && code.includes('catch')) score += 0.2;

        // Check for documentation
        if (code.includes('/**')) score += 0.3;
        if (code.includes('//')) score += 0.1;

        // Penalize for issues
        if (code.includes('TODO')) score -= 0.2;
        if (code.includes('any')) score -= 0.1;
        if (code.length < 100) score -= 0.3;

        return Math.max(1, Math.min(5, score));
    }

    /**
     * Create a training dataset from collected examples
     */
    createDataset(name: string, version: string, filter?: {
        categories?: string[];
        minQuality?: number;
        maxExamples?: number;
    }): TrainingDataset {
        let filtered = [...this.examples];

        if (filter?.categories?.length) {
            filtered = filtered.filter(e => filter.categories!.includes(e.category));
        }
        if (filter?.minQuality) {
            filtered = filtered.filter(e => e.quality >= filter.minQuality!);
        }
        if (filter?.maxExamples) {
            filtered = filtered.slice(0, filter.maxExamples);
        }

        const categories = [...new Set(filtered.map(e => e.category))];
        const qualityScore = filtered.reduce((sum, e) => sum + e.quality, 0) / filtered.length;

        const dataset: TrainingDataset = {
            id: this.generateId(),
            name,
            version,
            examples: filtered,
            categories,
            totalExamples: filtered.length,
            qualityScore,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.datasets.set(dataset.id, dataset);
        return dataset;
    }

    /**
     * Export dataset for fine-tuning
     */
    exportForFineTuning(datasetId: string): { training: string[]; validation: string[] } {
        const dataset = this.datasets.get(datasetId);
        if (!dataset) {
            throw new Error(`Dataset ${datasetId} not found`);
        }

        const examples = dataset.examples.map(e =>
            JSON.stringify({
                messages: [
                    { role: 'user', content: e.prompt },
                    { role: 'assistant', content: e.completion },
                ],
            })
        );

        const splitIndex = Math.floor(examples.length * 0.9);
        return {
            training: examples.slice(0, splitIndex),
            validation: examples.slice(splitIndex),
        };
    }

    /**
     * Get dataset statistics
     */
    getDatasetStats(datasetId: string): {
        total: number;
        byCategory: Record<string, number>;
        qualityDistribution: Record<number, number>;
        averagePromptLength: number;
        averageCompletionLength: number;
    } {
        const dataset = this.datasets.get(datasetId);
        if (!dataset) {
            throw new Error(`Dataset ${datasetId} not found`);
        }

        const byCategory: Record<string, number> = {};
        const qualityDistribution: Record<number, number> = {};
        let totalPromptLength = 0;
        let totalCompletionLength = 0;

        for (const example of dataset.examples) {
            byCategory[example.category] = (byCategory[example.category] || 0) + 1;
            const qualityRound = Math.round(example.quality);
            qualityDistribution[qualityRound] = (qualityDistribution[qualityRound] || 0) + 1;
            totalPromptLength += example.prompt.length;
            totalCompletionLength += example.completion.length;
        }

        return {
            total: dataset.examples.length,
            byCategory,
            qualityDistribution,
            averagePromptLength: totalPromptLength / dataset.examples.length,
            averageCompletionLength: totalCompletionLength / dataset.examples.length,
        };
    }

    private generateId(): string {
        return `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// ============================================
// MODEL VERSION MANAGER
// ============================================

export class ModelVersionManager {
    private versions: Map<string, ModelVersion> = new Map();
    private activeVersion: string | null = null;

    /**
     * Create a new model version for training
     */
    createVersion(
        name: string,
        version: string,
        baseModel: string,
        trainingDatasetId: string,
        config: TrainingConfig
    ): ModelVersion {
        const modelVersion: ModelVersion = {
            id: this.generateId(),
            name,
            version,
            baseModel,
            trainingDatasetId,
            status: 'pending',
            metrics: {
                accuracy: 0,
                latency: 0,
                tokensPerSecond: 0,
                costPerRequest: 0,
                successRate: 0,
                averageQuality: 0,
            },
            config,
            createdAt: new Date(),
        };

        this.versions.set(modelVersion.id, modelVersion);
        return modelVersion;
    }

    /**
     * Update version status
     */
    updateStatus(versionId: string, status: ModelVersion['status']): void {
        const version = this.versions.get(versionId);
        if (!version) {
            throw new Error(`Model version ${versionId} not found`);
        }
        version.status = status;
        if (status === 'completed') {
            version.completedAt = new Date();
        }
    }

    /**
     * Update version metrics
     */
    updateMetrics(versionId: string, metrics: Partial<ModelMetrics>): void {
        const version = this.versions.get(versionId);
        if (!version) {
            throw new Error(`Model version ${versionId} not found`);
        }
        version.metrics = { ...version.metrics, ...metrics };
    }

    /**
     * Deploy a version
     */
    deployVersion(versionId: string): void {
        const version = this.versions.get(versionId);
        if (!version) {
            throw new Error(`Model version ${versionId} not found`);
        }
        if (version.status !== 'completed') {
            throw new Error(`Cannot deploy version with status: ${version.status}`);
        }

        // Mark previous active as not deployed
        if (this.activeVersion) {
            const prev = this.versions.get(this.activeVersion);
            if (prev) {
                prev.status = 'completed';
            }
        }

        version.status = 'deployed';
        this.activeVersion = versionId;
    }

    /**
     * Get the active deployed version
     */
    getActiveVersion(): ModelVersion | null {
        if (!this.activeVersion) return null;
        return this.versions.get(this.activeVersion) || null;
    }

    /**
     * List all versions
     */
    listVersions(): ModelVersion[] {
        return Array.from(this.versions.values());
    }

    /**
     * Compare versions
     */
    compareVersions(versionId1: string, versionId2: string): {
        v1: ModelVersion;
        v2: ModelVersion;
        comparison: Record<keyof ModelMetrics, { v1: number; v2: number; diff: number }>;
    } {
        const v1 = this.versions.get(versionId1);
        const v2 = this.versions.get(versionId2);

        if (!v1 || !v2) {
            throw new Error('One or both versions not found');
        }

        const comparison: Record<keyof ModelMetrics, { v1: number; v2: number; diff: number }> = {
            accuracy: { v1: v1.metrics.accuracy, v2: v2.metrics.accuracy, diff: v2.metrics.accuracy - v1.metrics.accuracy },
            latency: { v1: v1.metrics.latency, v2: v2.metrics.latency, diff: v2.metrics.latency - v1.metrics.latency },
            tokensPerSecond: { v1: v1.metrics.tokensPerSecond, v2: v2.metrics.tokensPerSecond, diff: v2.metrics.tokensPerSecond - v1.metrics.tokensPerSecond },
            costPerRequest: { v1: v1.metrics.costPerRequest, v2: v2.metrics.costPerRequest, diff: v2.metrics.costPerRequest - v1.metrics.costPerRequest },
            successRate: { v1: v1.metrics.successRate, v2: v2.metrics.successRate, diff: v2.metrics.successRate - v1.metrics.successRate },
            averageQuality: { v1: v1.metrics.averageQuality, v2: v2.metrics.averageQuality, diff: v2.metrics.averageQuality - v1.metrics.averageQuality },
        };

        return { v1, v2, comparison };
    }

    private generateId(): string {
        return `mv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// ============================================
// COST OPTIMIZER
// ============================================

export class CostOptimizer {
    private requestHistory: Array<{
        model: string;
        tokens: number;
        cost: number;
        cached: boolean;
        timestamp: Date;
    }> = [];

    /**
     * Track a request for cost analysis
     */
    trackRequest(model: string, tokens: number, cost: number, cached: boolean): void {
        this.requestHistory.push({
            model,
            tokens,
            cost,
            cached,
            timestamp: new Date(),
        });

        // Keep last 10000 requests
        if (this.requestHistory.length > 10000) {
            this.requestHistory = this.requestHistory.slice(-10000);
        }
    }

    /**
     * Analyze costs and provide recommendations
     */
    analyze(): CostOptimization {
        const totalRequests = this.requestHistory.length;
        if (totalRequests === 0) {
            return {
                currentCostPerRequest: 0,
                optimizedCostPerRequest: 0,
                savingsPercentage: 0,
                recommendations: [],
            };
        }

        const totalCost = this.requestHistory.reduce((sum, r) => sum + r.cost, 0);
        const currentCostPerRequest = totalCost / totalRequests;
        const cacheHitRate = this.requestHistory.filter(r => r.cached).length / totalRequests;

        const recommendations: CostRecommendation[] = [];

        // Cache recommendation
        if (cacheHitRate < 0.3) {
            recommendations.push({
                type: 'caching',
                description: 'Implement response caching for repeated queries',
                estimatedSavings: currentCostPerRequest * 0.3,
                implementation: 'Use Redis or in-memory cache with TTL for similar prompts',
            });
        }

        // Model downgrade for simple tasks
        const avgTokens = this.requestHistory.reduce((sum, r) => sum + r.tokens, 0) / totalRequests;
        if (avgTokens < 500) {
            recommendations.push({
                type: 'model',
                description: 'Use smaller models for simple tasks',
                estimatedSavings: currentCostPerRequest * 0.5,
                implementation: 'Route simple prompts to GPT-3.5 instead of GPT-4',
            });
        }

        // Batching recommendation
        recommendations.push({
            type: 'batching',
            description: 'Batch similar requests together',
            estimatedSavings: currentCostPerRequest * 0.1,
            implementation: 'Queue and batch requests by category every 100ms',
        });

        // Prompt optimization
        recommendations.push({
            type: 'prompt',
            description: 'Optimize prompt length',
            estimatedSavings: currentCostPerRequest * 0.15,
            implementation: 'Use concise system prompts and remove redundant instructions',
        });

        const totalSavings = recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0);
        const optimizedCostPerRequest = Math.max(0, currentCostPerRequest - totalSavings);

        return {
            currentCostPerRequest,
            optimizedCostPerRequest,
            savingsPercentage: (totalSavings / currentCostPerRequest) * 100,
            recommendations,
        };
    }

    /**
     * Get cost breakdown by model
     */
    getCostByModel(): Record<string, { requests: number; totalCost: number; avgCost: number }> {
        const breakdown: Record<string, { requests: number; totalCost: number; avgCost: number }> = {};

        for (const request of this.requestHistory) {
            if (!breakdown[request.model]) {
                breakdown[request.model] = { requests: 0, totalCost: 0, avgCost: 0 };
            }
            breakdown[request.model].requests++;
            breakdown[request.model].totalCost += request.cost;
        }

        for (const model of Object.keys(breakdown)) {
            breakdown[model].avgCost = breakdown[model].totalCost / breakdown[model].requests;
        }

        return breakdown;
    }
}

// ============================================
// PERFORMANCE OPTIMIZER
// ============================================

export class PerformanceOptimizer {
    private latencyHistory: number[] = [];
    private errorHistory: boolean[] = [];
    private cacheHits = 0;
    private cacheMisses = 0;

    /**
     * Track request latency
     */
    trackLatency(latencyMs: number): void {
        this.latencyHistory.push(latencyMs);
        if (this.latencyHistory.length > 10000) {
            this.latencyHistory = this.latencyHistory.slice(-10000);
        }
    }

    /**
     * Track request success/failure
     */
    trackSuccess(success: boolean): void {
        this.errorHistory.push(!success);
        if (this.errorHistory.length > 10000) {
            this.errorHistory = this.errorHistory.slice(-10000);
        }
    }

    /**
     * Track cache hit/miss
     */
    trackCache(hit: boolean): void {
        if (hit) this.cacheHits++;
        else this.cacheMisses++;
    }

    /**
     * Get performance metrics
     */
    getMetrics(): PerformanceMetrics {
        const sorted = [...this.latencyHistory].sort((a, b) => a - b);
        const len = sorted.length;

        return {
            averageLatency: len ? sorted.reduce((a, b) => a + b, 0) / len : 0,
            p95Latency: len ? sorted[Math.floor(len * 0.95)] || 0 : 0,
            p99Latency: len ? sorted[Math.floor(len * 0.99)] || 0 : 0,
            throughput: len / ((Date.now() - this.getOldestTimestamp()) / 1000) || 0,
            errorRate: this.errorHistory.length ?
                this.errorHistory.filter(e => e).length / this.errorHistory.length : 0,
            cacheHitRate: (this.cacheHits + this.cacheMisses) > 0 ?
                this.cacheHits / (this.cacheHits + this.cacheMisses) : 0,
        };
    }

    /**
     * Get optimization recommendations
     */
    getRecommendations(): string[] {
        const metrics = this.getMetrics();
        const recommendations: string[] = [];

        if (metrics.p95Latency > 5000) {
            recommendations.push('Consider using streaming for long responses');
        }
        if (metrics.errorRate > 0.05) {
            recommendations.push('High error rate detected - check API limits and error handling');
        }
        if (metrics.cacheHitRate < 0.2) {
            recommendations.push('Low cache hit rate - implement prompt similarity caching');
        }

        return recommendations;
    }

    private getOldestTimestamp(): number {
        // Estimate based on history length - assume 1 request per second average
        return Date.now() - (this.latencyHistory.length * 1000);
    }
}

// ============================================
// SINGLETONS
// ============================================

let trainingDataCollector: TrainingDataCollector | null = null;
let modelVersionManager: ModelVersionManager | null = null;
let costOptimizer: CostOptimizer | null = null;
let performanceOptimizer: PerformanceOptimizer | null = null;

export function getTrainingDataCollector(): TrainingDataCollector {
    if (!trainingDataCollector) {
        trainingDataCollector = new TrainingDataCollector();
    }
    return trainingDataCollector;
}

export function getModelVersionManager(): ModelVersionManager {
    if (!modelVersionManager) {
        modelVersionManager = new ModelVersionManager();
    }
    return modelVersionManager;
}

export function getCostOptimizer(): CostOptimizer {
    if (!costOptimizer) {
        costOptimizer = new CostOptimizer();
    }
    return costOptimizer;
}

export function getPerformanceOptimizer(): PerformanceOptimizer {
    if (!performanceOptimizer) {
        performanceOptimizer = new PerformanceOptimizer();
    }
    return performanceOptimizer;
}
