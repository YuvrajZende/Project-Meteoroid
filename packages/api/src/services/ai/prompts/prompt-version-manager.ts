/**
 * Prompt Version Manager
 * Handles prompt versioning, A/B testing, and performance tracking
 * 
 * @author Person 2 (AI/ML Engineer)
 */

// ============================================
// TYPES
// ============================================

export interface PromptVersion {
    id: string;
    name: string;
    version: string;
    content: string;
    systemPrompt?: string;
    fewShotExamples?: string[];
    chainOfThought?: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    metadata?: Record<string, unknown>;
}

export interface PromptPerformance {
    versionId: string;
    totalRequests: number;
    successCount: number;
    failureCount: number;
    avgResponseTime: number;
    avgTokensUsed: number;
    successRate: number;
    lastUsed: Date;
}

export interface ABTestConfig {
    testId: string;
    name: string;
    controlVersionId: string;
    treatmentVersionIds: string[];
    trafficSplit: Record<string, number>; // versionId -> percentage
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
}

export interface ABTestResult {
    testId: string;
    versionId: string;
    requestCount: number;
    successRate: number;
    avgResponseTime: number;
    avgTokensUsed: number;
    winner?: string;
}

// ============================================
// PROMPT VERSION MANAGER
// ============================================

export class PromptVersionManager {
    private versions: Map<string, PromptVersion> = new Map();
    private performance: Map<string, PromptPerformance> = new Map();
    private abTests: Map<string, ABTestConfig> = new Map();
    private abResults: Map<string, ABTestResult[]> = new Map();
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Load default prompt versions
        this.loadDefaultVersions();

        console.log('[PROMPT-MANAGER] Initialized with', this.versions.size, 'prompt versions');
        this.isInitialized = true;
    }

    private loadDefaultVersions(): void {
        // Database Agent prompts
        this.registerVersion({
            id: 'database-agent-v1',
            name: 'Database Agent System Prompt',
            version: '1.0.0',
            content: `You are a database expert specializing in schema design, migrations, and optimization.`,
            systemPrompt: 'database-expert',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Queue Agent prompts
        this.registerVersion({
            id: 'queue-agent-v1',
            name: 'Queue Agent System Prompt',
            version: '1.0.0',
            content: `You are a background job processing expert specializing in BullMQ and Redis queues.`,
            systemPrompt: 'queue-expert',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Test Agent prompts
        this.registerVersion({
            id: 'test-agent-v1',
            name: 'Test Agent System Prompt',
            version: '1.0.0',
            content: `You are a testing expert specializing in unit, integration, and E2E testing.`,
            systemPrompt: 'testing-expert',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Code generation prompts
        this.registerVersion({
            id: 'codegen-v1',
            name: 'Code Generation System Prompt',
            version: '1.0.0',
            content: `You are an expert code generator. Output only valid, runnable TypeScript code.`,
            systemPrompt: 'code-generator',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    // ============================================
    // VERSION MANAGEMENT
    // ============================================

    registerVersion(version: PromptVersion): void {
        this.versions.set(version.id, version);

        // Initialize performance tracking
        if (!this.performance.has(version.id)) {
            this.performance.set(version.id, {
                versionId: version.id,
                totalRequests: 0,
                successCount: 0,
                failureCount: 0,
                avgResponseTime: 0,
                avgTokensUsed: 0,
                successRate: 0,
                lastUsed: new Date(),
            });
        }
    }

    getVersion(versionId: string): PromptVersion | undefined {
        return this.versions.get(versionId);
    }

    getActiveVersions(category?: string): PromptVersion[] {
        return Array.from(this.versions.values())
            .filter(v => v.isActive)
            .filter(v => !category || v.id.startsWith(category));
    }

    updateVersion(versionId: string, updates: Partial<PromptVersion>): boolean {
        const version = this.versions.get(versionId);
        if (!version) return false;

        this.versions.set(versionId, {
            ...version,
            ...updates,
            updatedAt: new Date(),
        });

        return true;
    }

    deactivateVersion(versionId: string): boolean {
        return this.updateVersion(versionId, { isActive: false });
    }

    // ============================================
    // PERFORMANCE TRACKING
    // ============================================

    recordUsage(versionId: string, metrics: {
        success: boolean;
        responseTime: number;
        tokensUsed: number;
    }): void {
        const perf = this.performance.get(versionId);
        if (!perf) return;

        perf.totalRequests++;
        if (metrics.success) {
            perf.successCount++;
        } else {
            perf.failureCount++;
        }

        // Update rolling averages
        const n = perf.totalRequests;
        perf.avgResponseTime = ((perf.avgResponseTime * (n - 1)) + metrics.responseTime) / n;
        perf.avgTokensUsed = ((perf.avgTokensUsed * (n - 1)) + metrics.tokensUsed) / n;
        perf.successRate = perf.successCount / perf.totalRequests;
        perf.lastUsed = new Date();

        this.performance.set(versionId, perf);
    }

    getPerformance(versionId: string): PromptPerformance | undefined {
        return this.performance.get(versionId);
    }

    getAllPerformance(): PromptPerformance[] {
        return Array.from(this.performance.values());
    }

    getBestPerforming(category?: string): PromptVersion | undefined {
        const versions = this.getActiveVersions(category);
        const performances = versions
            .map(v => ({ version: v, perf: this.performance.get(v.id) }))
            .filter(p => p.perf && p.perf.totalRequests > 10) // Minimum sample size
            .sort((a, b) => (b.perf?.successRate || 0) - (a.perf?.successRate || 0));

        return performances[0]?.version;
    }

    // ============================================
    // A/B TESTING
    // ============================================

    createABTest(config: ABTestConfig): void {
        this.abTests.set(config.testId, config);
        this.abResults.set(config.testId, []);
        console.log(`[PROMPT-MANAGER] A/B test created: ${config.name}`);
    }

    getABTest(testId: string): ABTestConfig | undefined {
        return this.abTests.get(testId);
    }

    selectVersionForABTest(testId: string): string | undefined {
        const test = this.abTests.get(testId);
        if (!test || !test.isActive) return undefined;

        // Weighted random selection based on traffic split
        const random = Math.random() * 100;
        let cumulative = 0;

        for (const [versionId, percentage] of Object.entries(test.trafficSplit)) {
            cumulative += percentage;
            if (random <= cumulative) {
                return versionId;
            }
        }

        return test.controlVersionId;
    }

    recordABTestResult(testId: string, versionId: string, success: boolean, metrics: {
        responseTime: number;
        tokensUsed: number;
    }): void {
        const results = this.abResults.get(testId) || [];

        // Find or create result entry for this version
        let result = results.find(r => r.versionId === versionId);
        if (!result) {
            result = {
                testId,
                versionId,
                requestCount: 0,
                successRate: 0,
                avgResponseTime: 0,
                avgTokensUsed: 0,
            };
            results.push(result);
        }

        // Update metrics
        result.requestCount++;
        const n = result.requestCount;
        result.successRate = ((result.successRate * (n - 1)) + (success ? 1 : 0)) / n;
        result.avgResponseTime = ((result.avgResponseTime * (n - 1)) + metrics.responseTime) / n;
        result.avgTokensUsed = ((result.avgTokensUsed * (n - 1)) + metrics.tokensUsed) / n;

        this.abResults.set(testId, results);
    }

    getABTestResults(testId: string): ABTestResult[] {
        return this.abResults.get(testId) || [];
    }

    evaluateABTest(testId: string): ABTestResult | undefined {
        const results = this.getABTestResults(testId);
        if (results.length === 0) return undefined;

        // Find the winner based on success rate (with minimum sample size)
        const validResults = results.filter(r => r.requestCount >= 30);
        if (validResults.length === 0) return undefined;

        const winner = validResults.reduce((best, current) =>
            current.successRate > best.successRate ? current : best
        );

        winner.winner = winner.versionId;
        return winner;
    }

    endABTest(testId: string): ABTestResult | undefined {
        const test = this.abTests.get(testId);
        if (!test) return undefined;

        test.isActive = false;
        test.endDate = new Date();
        this.abTests.set(testId, test);

        const result = this.evaluateABTest(testId);
        console.log(`[PROMPT-MANAGER] A/B test ended: ${test.name}. Winner: ${result?.winner || 'inconclusive'}`);

        return result;
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus(): {
        initialized: boolean;
        totalVersions: number;
        activeVersions: number;
        activeTests: number;
    } {
        return {
            initialized: this.isInitialized,
            totalVersions: this.versions.size,
            activeVersions: this.getActiveVersions().length,
            activeTests: Array.from(this.abTests.values()).filter(t => t.isActive).length,
        };
    }
}

// ============================================
// SINGLETON
// ============================================

let instance: PromptVersionManager | null = null;

export function getPromptVersionManager(): PromptVersionManager {
    if (!instance) {
        instance = new PromptVersionManager();
    }
    return instance;
}
