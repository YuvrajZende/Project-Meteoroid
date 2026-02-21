/**
 * Planning Service
 * Phase 1, Week 1, Day 6-7: Request Analysis and Task Planning
 *
 * This service handles:
 * - Analyzing user prompts to understand requirements
 * - Breaking down complex tasks into subtasks
 * - Estimating complexity and resource needs
 * - Determining execution strategy
 *
 * Replaces the planning logic from the monolithic IntegratedOrchestrator.
 */

import { injectable } from 'inversify';
import type { IPlanningService, PlanningRequest, PlanningResult, Subtask, ComplexityAnalysis } from '../../../interfaces/planning.interface.js';

@injectable()
export class PlanningService implements IPlanningService {
    constructor() {}

    /**
     * Analyze a request and create a comprehensive plan
     */
    async plan(request: PlanningRequest): Promise<PlanningResult> {
        console.log(`[PlanningService] Analyzing request: ${request.prompt.slice(0, 100)}...`);

        // Step 1: Analyze complexity
        const analysis = await this.analyzeComplexity(request);

        // Step 2: Create subtasks based on complexity
        const subtasks = await this.createSubtasks(request, analysis);

        // Step 3: Determine requirements
        const requirements = this.determineRequirements(request, subtasks);

        // Step 4: Determine execution strategy
        const strategy = this.determineStrategy(subtasks, analysis);

        const result: PlanningResult = {
            analysis: {
                complexity: analysis.complexity,
                estimatedDuration: this.estimateTotalDuration(subtasks),
                estimatedSubtasks: subtasks.length,
                confidence: analysis.confidence,
            },
            subtasks,
            requirements,
            strategy,
        };

        console.log(`[PlanningService] Plan created: ${subtasks.length} subtasks, ${analysis.complexity} complexity`);

        return result;
    }

    /**
     * Analyze the complexity of a request
     */
    async analyzeComplexity(request: PlanningRequest): Promise<ComplexityAnalysis> {
        const prompt = request.prompt.toLowerCase();

        // Complexity indicators
        const hasMultipleFiles = /multiple|several|various|files?|components?|modules?/i.test(prompt);
        const hasDatabaseOperations = /database|db|sql|query|model|schema|repository|crud|persist/i.test(prompt);
        const hasAuthentication = /auth|login|register|user|session|jwt|token|permission|role/i.test(prompt);
        const hasExternalAPIs = /api|fetch|http|external|third.party|integration|webhook/i.test(prompt);

        // Estimate lines of code based on complexity
        let estimatedLinesOfCode = 100; // Base
        if (hasMultipleFiles) estimatedLinesOfCode += 200;
        if (hasDatabaseOperations) estimatedLinesOfCode += 150;
        if (hasAuthentication) estimatedLinesOfCode += 100;
        if (hasExternalAPIs) estimatedLinesOfCode += 100;

        // Determine complexity level
        let complexity: 'simple' | 'moderate' | 'complex';
        let confidence = 0.8;

        const factorCount = [hasMultipleFiles, hasDatabaseOperations, hasAuthentication, hasExternalAPIs]
            .filter(Boolean).length;

        if (factorCount === 0) {
            complexity = 'simple';
            confidence = 0.9;
        } else if (factorCount <= 2) {
            complexity = 'moderate';
            confidence = 0.75;
        } else {
            complexity = 'complex';
            confidence = 0.65;
        }

        return {
            complexity,
            confidence,
            factors: {
                hasMultipleFiles,
                hasDatabaseOperations,
                hasAuthentication,
                hasExternalAPIs,
                estimatedLinesOfCode,
            },
            reasoning: this.generateComplexityReasoning(complexity, {
                hasMultipleFiles,
                hasDatabaseOperations,
                hasAuthentication,
                hasExternalAPIs,
            }),
        };
    }

    /**
     * Break down a request into subtasks
     */
    async createSubtasks(_request: PlanningRequest, complexity: ComplexityAnalysis): Promise<Subtask[]> {
        const subtasks: Subtask[] = [];

        // Task 1: Setup/Configuration (if needed)
        if (complexity.factors.hasDatabaseOperations || complexity.factors.hasAuthentication) {
            subtasks.push({
                id: 'setup-config',
                title: 'Setup and Configuration',
                description: 'Configure project settings, environment variables, and base configuration',
                order: 1,
                dependencies: [],
                estimatedDuration: 5,
                complexity: 'simple',
                requiredCapabilities: ['config'],
            });
        }

        // Task 2: Database Schema (if needed)
        if (complexity.factors.hasDatabaseOperations) {
            subtasks.push({
                id: 'database-schema',
                title: 'Database Schema Design',
                description: 'Design and implement database models, migrations, and relationships',
                order: 2,
                dependencies: complexity.factors.hasAuthentication ? ['setup-config'] : [],
                estimatedDuration: 15,
                complexity: 'moderate',
                requiredCapabilities: ['database', 'schema'],
            });
        }

        // Task 3: Authentication (if needed)
        if (complexity.factors.hasAuthentication) {
            subtasks.push({
                id: 'authentication',
                title: 'Authentication Implementation',
                description: 'Implement user authentication, JWT tokens, and authorization middleware',
                order: 3,
                dependencies: ['setup-config'],
                estimatedDuration: 20,
                complexity: 'moderate',
                requiredCapabilities: ['auth', 'security'],
            });
        }

        // Task 4: Core API/Logic
        subtasks.push({
            id: 'core-implementation',
            title: 'Core Implementation',
            description: 'Implement the main business logic and API endpoints',
            order: 4,
            dependencies: this.getCoreDependencies(complexity),
            estimatedDuration: complexity.complexity === 'simple' ? 15 : 30,
            complexity: complexity.complexity,
            requiredCapabilities: ['api', 'business-logic'],
        });

        // Task 5: Testing (always included)
        subtasks.push({
            id: 'testing',
            title: 'Testing and Validation',
            description: 'Write unit tests, integration tests, and validate the implementation',
            order: 5,
            dependencies: ['core-implementation'],
            estimatedDuration: 15,
            complexity: 'moderate',
            requiredCapabilities: ['testing', 'validation'],
        });

        // Task 6: Documentation (if complex)
        if (complexity.complexity === 'complex') {
            subtasks.push({
                id: 'documentation',
                title: 'Documentation',
                description: 'Write API documentation, usage examples, and README',
                order: 6,
                dependencies: ['core-implementation', 'testing'],
                estimatedDuration: 10,
                complexity: 'simple',
                requiredCapabilities: ['documentation'],
            });
        }

        return subtasks;
    }

    /**
     * Determine execution strategy
     */
    determineStrategy(subtasks: Subtask[], complexity: ComplexityAnalysis): {
        approach: 'incremental' | 'parallel' | 'sequential';
        reasoning: string;
        recommendedFirstStep: string;
    } {
        // Determine approach based on complexity and dependencies
        let approach: 'incremental' | 'parallel' | 'sequential';
        let reasoning: string;

        if (complexity.complexity === 'simple') {
            approach = 'sequential';
            reasoning = 'Simple tasks can be completed sequentially without overhead';
        } else if (complexity.complexity === 'complex') {
            approach = 'parallel';
            reasoning = 'Complex task with multiple independent components that can be developed in parallel';
        } else {
            approach = 'incremental';
            reasoning = 'Moderate complexity best handled incrementally with validation at each step';
        }

        const recommendedFirstStep = subtasks[0]?.title || 'Start with configuration setup';

        return { approach, reasoning, recommendedFirstStep };
    }

    /**
     * Determine resource requirements
     */
    private determineRequirements(request: PlanningRequest, subtasks: Subtask[]) {
        const prompt = request.prompt.toLowerCase();

        // Detect programming language
        const languagePatterns = {
            typescript: /typescript|ts\b|node/i,
            python: /python|py\b|django|flask/i,
            go: /go\b|golang/i,
            rust: /rust\b|rs\b/i,
            java: /java\b|spring/i,
        };

        let suggestedLanguage = 'typescript';
        for (const [lang, pattern] of Object.entries(languagePatterns)) {
            if (pattern.test(prompt)) {
                suggestedLanguage = lang;
                break;
            }
        }

        // Detect framework
        const frameworkPatterns = {
            fastify: /fastify/i,
            express: /express/i,
            fastapi: /fastapi/i,
            django: /django/i,
            spring: /spring/i,
        };

        let suggestedFramework = 'fastify';
        for (const [fw, pattern] of Object.entries(frameworkPatterns)) {
            if (pattern.test(prompt)) {
                suggestedFramework = fw;
                break;
            }
        }

        // Check requirements from subtasks
        const needsAuthentication = subtasks.some(st => st.id === 'authentication');
        const needsDatabase = subtasks.some(st => st.id === 'database-schema');
        const needsAPI = subtasks.some(st => st.requiredCapabilities.includes('api'));
        const needsFileOperations = /file|upload|download|storage/i.test(prompt);

        return {
            needsAuthentication,
            needsDatabase,
            needsAPI,
            needsFileOperations,
            suggestedFramework,
            suggestedLanguage,
        };
    }

    /**
     * Generate reasoning for complexity assessment
     */
    private generateComplexityReasoning(
        complexity: 'simple' | 'moderate' | 'complex',
        factors: {
            hasMultipleFiles: boolean;
            hasDatabaseOperations: boolean;
            hasAuthentication: boolean;
            hasExternalAPIs: boolean;
        }
    ): string {
        const reasons: string[] = [];

        if (factors.hasMultipleFiles) reasons.push('multiple files need to be created');
        if (factors.hasDatabaseOperations) reasons.push('database operations are required');
        if (factors.hasAuthentication) reasons.push('authentication system needed');
        if (factors.hasExternalAPIs) reasons.push('external API integration required');

        if (reasons.length === 0) {
            return 'Straightforward implementation with no complex dependencies';
        }

        return ` classified as ${complexity} because: ${reasons.join(', ')}`;
    }

    /**
     * Get dependencies for core implementation task
     */
    private getCoreDependencies(complexity: ComplexityAnalysis): string[] {
        const deps: string[] = [];

        if (complexity.factors.hasAuthentication) {
            deps.push('authentication');
        }

        if (complexity.factors.hasDatabaseOperations) {
            deps.push('database-schema');
        }

        if (complexity.factors.hasMultipleFiles && !deps.includes('setup-config')) {
            deps.push('setup-config');
        }

        return deps;
    }

    /**
     * Estimate total duration based on subtasks
     */
    private estimateTotalDuration(subtasks: Subtask[]): number {
        return subtasks.reduce((total, task) => total + task.estimatedDuration, 0);
    }
}
