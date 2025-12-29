/**
 * AI Services Test Suite
 * Tests for Person 2's AI implementation
 * 
 * This test verifies the core functionality of all AI services
 */

// Training Pipeline Tests
describe('AI Training Pipeline', () => {
    describe('TrainingDataCollector', () => {
        it('should instantiate and add training examples', async () => {
            const { TrainingDataCollector } = await import('../packages/api/src/services/ai/training/ai-training-pipeline');
            const collector = new TrainingDataCollector();

            const example = collector.addExample({
                prompt: 'Create a user model',
                completion: 'model User { id String @id }',
                category: 'database',
                quality: 4,
            });

            expect(example.id).toBeDefined();
            expect(example.prompt).toBe('Create a user model');
            expect(example.category).toBe('database');
        });

        it('should create datasets from examples', async () => {
            const { TrainingDataCollector } = await import('../packages/api/src/services/ai/training/ai-training-pipeline');
            const collector = new TrainingDataCollector();

            collector.addExample({
                prompt: 'Test prompt 1',
                completion: 'Test completion 1',
                category: 'database',
                quality: 4,
            });
            collector.addExample({
                prompt: 'Test prompt 2',
                completion: 'Test completion 2',
                category: 'queue',
                quality: 3,
            });

            const dataset = collector.createDataset('test-dataset', '1.0.0');

            expect(dataset.name).toBe('test-dataset');
            expect(dataset.totalExamples).toBe(2);
        });
    });

    describe('ModelVersionManager', () => {
        it('should create model versions', async () => {
            const { ModelVersionManager } = await import('../packages/api/src/services/ai/training/ai-training-pipeline');
            const manager = new ModelVersionManager();

            const version = manager.createVersion(
                'test-model',
                '1.0.0',
                'gpt-4',
                'dataset-1',
                {
                    epochs: 3,
                    learningRate: 0.001,
                    batchSize: 32,
                    warmupSteps: 100,
                    maxTokens: 4096,
                    validationSplit: 0.1,
                }
            );

            expect(version.name).toBe('test-model');
            expect(version.version).toBe('1.0.0');
            expect(version.status).toBe('pending');
        });
    });

    describe('CostOptimizer', () => {
        it('should track requests and analyze costs', async () => {
            const { CostOptimizer } = await import('../packages/api/src/services/ai/training/ai-training-pipeline');
            const optimizer = new CostOptimizer();

            optimizer.trackRequest('gpt-4', 1000, 0.03, false);
            optimizer.trackRequest('gpt-4', 500, 0.015, true);

            const analysis = optimizer.analyze();
            expect(analysis.currentCostPerRequest).toBeGreaterThan(0);
            expect(analysis.recommendations).toBeDefined();
        });
    });

    describe('PerformanceOptimizer', () => {
        it('should track latency metrics', async () => {
            const { PerformanceOptimizer } = await import('../packages/api/src/services/ai/training/ai-training-pipeline');
            const optimizer = new PerformanceOptimizer();

            optimizer.trackLatency(100);
            optimizer.trackLatency(200);
            optimizer.trackLatency(150);

            const metrics = optimizer.getMetrics();
            expect(metrics.averageLatency).toBe(150);
        });
    });
});

// Output Validation Tests
describe('Output Validation', () => {
    describe('OutputValidator', () => {
        it('should validate code with no errors', async () => {
            const { OutputValidator } = await import('../packages/api/src/services/ai/validation/output-validator');
            const validator = new OutputValidator();

            const code = `
export interface User {
    id: string;
    name: string;
}

export async function getUser(id: string): Promise<User> {
    try {
        return { id, name: 'Test' };
    } catch (error) {
        throw error;
    }
}
`;
            const result = validator.validate(code);
            expect(result.valid).toBe(true);
            expect(result.score).toBeGreaterThan(50);
        });

        it('should detect security issues with eval', async () => {
            const { OutputValidator } = await import('../packages/api/src/services/ai/validation/output-validator');
            const validator = new OutputValidator();

            const code = `
eval(userInput);
`;
            const result = validator.validate(code);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e: { type: string }) => e.type === 'security')).toBe(true);
        });
    });
});

// Production Readiness Tests
describe('Production Readiness', () => {
    describe('AIQualityAssurance', () => {
        it('should track requests', async () => {
            const { AIQualityAssurance } = await import('../packages/api/src/services/ai/production/production-readiness');
            const qa = new AIQualityAssurance();

            qa.trackRequest('database', true, 100, 85);
            qa.trackRequest('database', true, 150, 90);
            qa.trackRequest('queue', false, 200, 0);

            const metrics = qa.getMetrics(24);
            expect(metrics.totalRequests).toBe(3);
            expect(metrics.successfulRequests).toBe(2);
            expect(metrics.failedRequests).toBe(1);
        });
    });

    describe('ErrorHandlingManager', () => {
        it('should log errors and provide recovery suggestions', async () => {
            const { ErrorHandlingManager } = await import('../packages/api/src/services/ai/production/production-readiness');
            const errorManager = new ErrorHandlingManager();

            const error = errorManager.handleError(
                'database',
                'api',
                'API timeout',
                { latency: 5000 }
            );

            expect(error.id).toBeDefined();
            expect(error.agent).toBe('database');

            const suggestions = errorManager.getRecoverySuggestions('rate-limit');
            expect(suggestions.length).toBeGreaterThan(0);
        });
    });

    describe('FeedbackLoop', () => {
        it('should collect and track feedback', async () => {
            const { FeedbackLoop } = await import('../packages/api/src/services/ai/production/production-readiness');
            const feedback = new FeedbackLoop();

            feedback.submitFeedback('s1', 'database', 'p1', 'c1', 5);
            feedback.submitFeedback('s2', 'queue', 'p2', 'c2', 2);
            feedback.submitFeedback('s3', 'test', 'p3', 'c3', 4);

            const highQuality = feedback.getHighQualityFeedback(4);
            expect(highQuality.length).toBe(2);
        });
    });

    describe('UsageAnalyticsService', () => {
        it('should track usage events', async () => {
            const { UsageAnalyticsService } = await import('../packages/api/src/services/ai/production/production-readiness');
            const analytics = new UsageAnalyticsService();

            analytics.trackEvent({
                timestamp: new Date(),
                sessionId: 'session-1',
                agent: 'database',
                action: 'generate',
                prompt: 'Create user model',
                model: 'gpt-4',
                tokensUsed: 500,
                latency: 1000,
                success: true,
            });

            const stats = analytics.getAnalytics(7);
            expect(stats.totalRequests).toBe(1);
        });
    });
});

// Launch Preparation Tests
describe('Launch Preparation', () => {
    describe('UserOnboardingService', () => {
        it('should manage user onboarding progress', async () => {
            const { UserOnboardingService } = await import('../packages/api/src/services/ai/launch/launch-preparation');
            const onboarding = new UserOnboardingService();

            const progress = onboarding.startOnboarding('user-1');
            expect(progress.userId).toBe('user-1');
            expect(progress.currentStep).toBe(1);

            const step = onboarding.getCurrentStep('user-1');
            expect(step).toBeDefined();
        });
    });

    describe('HelpDocumentationService', () => {
        it('should provide searchable help documentation', async () => {
            const { HelpDocumentationService } = await import('../packages/api/src/services/ai/launch/launch-preparation');
            const helpService = new HelpDocumentationService();

            const article = helpService.getArticle('getting-started');
            expect(article).toBeDefined();
            expect(article?.title).toContain('Getting Started');

            const results = helpService.search('database');
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
