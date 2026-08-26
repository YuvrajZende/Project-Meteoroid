/**
 * Test Agent IAgent Wrapper
 * Implements the IAgent interface for integration with the agent system
 * 
 * @author Person 2 (AI/ML Engineer)
 */

import type { IAgent } from '@loveable/shared';
import { TestAgent, testAgent } from './test-agent.js';
import type {
    TestGenerationResult,
    UnitTestRequest,
    IntegrationTestRequest,
    E2ETestRequest,
    APITestRequest,
    ComponentTestRequest,
    TestConfig,
} from './types.js';

// ============================================
// AGENT IDENTITY
// ============================================

const AGENT_ID = 'test-agent';
const AGENT_NAME = 'Test Agent';
const AGENT_VERSION = '1.0.0';
const AGENT_DESCRIPTION = 'Automated test generation for unit, integration, E2E, API, and component tests';

// ============================================
// CAPABILITIES
// ============================================

const CAPABILITIES = [
    // Frameworks
    'vitest',
    'jest',
    'mocha',
    'playwright',
    'cypress',

    // Test types
    'unit-tests',
    'integration-tests',
    'e2e-tests',
    'api-tests',
    'component-tests',
    'snapshot-testing',

    // Features
    'mock-generation',
    'fixture-generation',
    'test-fixtures',
    'coverage-analysis',
    'coverage-reports',

    // UI testing
    'visual-regression',
    'accessibility-testing',
    'user-event-testing',
    'page-object-model',

    // Code analysis
    'code-analysis',
    'test-discovery',
    'test-scaffolding',
];

// ============================================
// IAGENT WRAPPER CLASS
// ============================================

export class TestAgentWrapper implements IAgent {
    readonly id = AGENT_ID;
    readonly name = AGENT_NAME;
    readonly tier = 3 as const;
    readonly version = AGENT_VERSION;
    readonly description = AGENT_DESCRIPTION;
    readonly capabilities = CAPABILITIES;

    private agent: TestAgent;
    private isReady = false;

    constructor() {
        this.agent = testAgent;
    }

    // ============================================
    // LIFECYCLE METHODS
    // ============================================

    async initialize(config?: Record<string, unknown>): Promise<void> {
        if (this.isReady) return;

        // Inject services if provided
        if (config?.aiClient) {
            this.agent.setAIClient(config.aiClient);
        }

        if (config?.metricsService) {
            this.agent.setMetricsService(config.metricsService);
        }

        await this.agent.initialize();
        this.isReady = true;

        console.log(`[${AGENT_ID.toUpperCase()}] Initialized with ${CAPABILITIES.length} capabilities`);
    }

    async shutdown(): Promise<void> {
        this.isReady = false;
        console.log(`[${AGENT_ID.toUpperCase()}] Shutdown complete`);
    }

    async healthCheck(): Promise<{ healthy: boolean; message: string }> {
        const status = this.agent.getStatus();

        return {
            healthy: status.initialized,
            message: status.initialized
                ? `Test Agent ready with ${status.capabilities} capabilities`
                : 'Test Agent not initialized',
        };
    }

    // ============================================
    // EXECUTION
    // ============================================

    async execute(task: {
        type: string;
        input: Record<string, unknown>;
        options?: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        output: unknown;
        metadata?: Record<string, unknown>;
    }> {
        const startTime = Date.now();

        try {
            if (!this.isReady) {
                await this.initialize();
            }

            let result: unknown;

            switch (task.type) {
                case 'generate':
                case 'generate-tests':
                    result = await this.handleGenerate(task.input);
                    break;

                case 'generate-unit-tests':
                    result = await this.handleUnitTests(task.input);
                    break;

                case 'generate-integration-tests':
                    result = await this.handleIntegrationTests(task.input);
                    break;

                case 'generate-e2e-tests':
                    result = await this.handleE2ETests(task.input);
                    break;

                case 'generate-api-tests':
                    result = await this.handleAPITests(task.input);
                    break;

                case 'generate-component-tests':
                    result = await this.handleComponentTests(task.input);
                    break;

                case 'generate-config':
                    result = await this.handleConfigGeneration(task.input);
                    break;

                case 'analyze-code':
                    result = this.agent.analyzeCode(task.input.sourceCode as string);
                    break;

                default:
                    // Default to comprehensive generation
                    result = await this.handleGenerate(task.input);
            }

            const duration = Date.now() - startTime;

            return {
                success: true,
                output: result,
                metadata: {
                    agentId: AGENT_ID,
                    taskType: task.type,
                    durationMs: duration,
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[${AGENT_ID.toUpperCase()}] Execution failed:`, errorMessage);

            return {
                success: false,
                output: null,
                metadata: {
                    agentId: AGENT_ID,
                    taskType: task.type,
                    error: errorMessage,
                    durationMs: Date.now() - startTime,
                },
            };
        }
    }

    // ============================================
    // TASK HANDLERS
    // ============================================

    private async handleGenerate(input: Record<string, unknown>): Promise<TestGenerationResult> {
        const requirements = (input.requirements || input.prompt || '') as string;
        return this.agent.generate(requirements);
    }

    private async handleUnitTests(input: Record<string, unknown>): Promise<unknown> {
        const request: UnitTestRequest = {
            sourceFile: input.sourceFile as string,
            sourceCode: input.sourceCode as string,
            testFramework: input.framework as 'vitest' | 'jest' | undefined,
            includeEdgeCases: input.includeEdgeCases as boolean,
            includeMocks: input.includeMocks as boolean,
            includeFixtures: input.includeFixtures as boolean,
        };

        return this.agent.generateUnitTests(request);
    }

    private async handleIntegrationTests(input: Record<string, unknown>): Promise<unknown> {
        const request: IntegrationTestRequest = {
            serviceName: input.serviceName as string,
            dependencies: (input.dependencies || []) as string[],
            endpoints: input.endpoints as string[],
            database: input.database as boolean,
            redis: input.redis as boolean,
            externalApis: input.externalApis as string[],
        };

        return this.agent.generateIntegrationTests(request);
    }

    private async handleE2ETests(input: Record<string, unknown>): Promise<unknown> {
        const request: E2ETestRequest = {
            pageUrl: input.pageUrl as string,
            userFlows: (input.userFlows || []) as E2ETestRequest['userFlows'],
            framework: input.framework as 'playwright' | 'cypress',
            browsers: input.browsers as ('chromium' | 'firefox' | 'webkit')[],
            screenshots: input.screenshots as boolean,
            video: input.video as boolean,
        };

        return this.agent.generateE2ETests(request);
    }

    private async handleAPITests(input: Record<string, unknown>): Promise<unknown> {
        const requests = (input.requests || [input]) as APITestRequest[];
        return this.agent.generateAPITests(requests);
    }

    private async handleComponentTests(input: Record<string, unknown>): Promise<unknown> {
        const request: ComponentTestRequest = {
            componentPath: input.componentPath as string,
            componentCode: input.componentCode as string,
            framework: (input.framework || 'react') as 'react' | 'vue' | 'svelte' | 'solid',
            includeSnapshots: input.includeSnapshots as boolean,
            includeAccessibility: input.includeAccessibility as boolean,
            includeUserEvents: input.includeUserEvents as boolean,
        };

        return this.agent.generateComponentTests(request);
    }

    private async handleConfigGeneration(input: Record<string, unknown>): Promise<{ vitest?: string; jest?: string; setup?: string }> {
        const config: TestConfig = {
            framework: (input.framework || 'vitest') as TestConfig['framework'],
            testType: (input.testType || 'unit') as TestConfig['testType'],
            coverage: input.coverage !== false,
            environment: input.environment as 'node' | 'jsdom',
            coverageThreshold: input.coverageThreshold as TestConfig['coverageThreshold'],
            setupFiles: input.setupFiles as string[],
            testTimeout: input.testTimeout as number,
            maxConcurrency: input.maxConcurrency as number,
        };

        const result: { vitest?: string; jest?: string; setup?: string } = {};

        if (config.framework === 'vitest') {
            result.vitest = this.agent.generateVitestConfig(config);
        } else if (config.framework === 'jest') {
            result.jest = this.agent.generateJestConfig(config);
        }

        result.setup = this.agent.generateTestSetup();

        return result;
    }

    // ============================================
    // CAPABILITY HELPERS
    // ============================================

    canHandle(capability: string): boolean {
        return this.capabilities.includes(capability);
    }

    suggestNextAgents(): string[] {
        return [
            'codegen-agent',  // For code formatting
            'database-agent', // For database test fixtures
            'queue-agent',    // For queue worker tests
        ];
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let wrapperInstance: TestAgentWrapper | null = null;

export function getTestAgentWrapper(): TestAgentWrapper {
    if (!wrapperInstance) {
        wrapperInstance = new TestAgentWrapper();
    }
    return wrapperInstance;
}

export const testAgentIAgent = getTestAgentWrapper();
