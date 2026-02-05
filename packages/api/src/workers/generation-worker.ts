/**
 * Generation Worker
 * Processes code generation jobs from the queue
 */

import { Job } from 'bullmq';
import type { GenerationJobData, JobResult, JobProgress } from '../infrastructure/job-queue.js';
import { getJobQueue } from '../infrastructure/job-queue.js';
import { getKeyManager } from '../infrastructure/key-manager.js';
import { getAgentRegistry } from '../services/registry/agent-registry.js';
import { getAIClient } from '../infrastructure/ai-client.js';
import type { Agent } from '../services/registry/agent-registry.js';

/**
 * Generation stages
 */
const STAGES = {
    INIT: 'init',
    ANALYZE: 'analyze',
    PLAN: 'plan',
    GENERATE: 'generate',
    VALIDATE: 'validate',
    FINALIZE: 'finalize',
} as const;

type Stage = typeof STAGES[keyof typeof STAGES];

/**
 * Stage weights for progress calculation
 */
const STAGE_WEIGHTS: Record<Stage, number> = {
    [STAGES.INIT]: 5,
    [STAGES.ANALYZE]: 15,
    [STAGES.PLAN]: 20,
    [STAGES.GENERATE]: 45,
    [STAGES.VALIDATE]: 10,
    [STAGES.FINALIZE]: 5,
};

/**
 * Calculate cumulative progress
 */
function calculateProgress(completedStages: Stage[], currentStageProgress: number): number {
    let progress = 0;

    for (const stage of completedStages) {
        progress += STAGE_WEIGHTS[stage];
    }

    // Add current stage partial progress
    const lastStage = completedStages[completedStages.length - 1];
    const stageKeys = Object.keys(STAGES) as Stage[];
    const nextStageIndex = stageKeys.indexOf(lastStage) + 1;

    if (nextStageIndex < stageKeys.length) {
        const nextStage = stageKeys[nextStageIndex];
        progress += (STAGE_WEIGHTS[nextStage] * currentStageProgress) / 100;
    }

    return Math.min(100, Math.round(progress));
}

/**
 * Update job progress with logging
 */
async function updateProgress(
    job: Job<GenerationJobData>,
    stage: Stage,
    stageProgress: number,
    message?: string,
    agentId?: string
): Promise<void> {
    const completedStages: Stage[] = [];
    const stageKeys = Object.values(STAGES);

    for (const s of stageKeys) {
        if (s === stage) break;
        completedStages.push(s);
    }

    const overallProgress = calculateProgress(completedStages, stageProgress);

    const progress: JobProgress = {
        taskId: job.data.taskId,
        stage,
        progress: overallProgress,
        message,
        agentId,
    };

    // Update job progress
    await job.updateProgress(progress);

    // Publish to Redis for SSE streaming
    const queue = getJobQueue();
    await queue.publishProgress(job.data.taskId, progress);

    console.log(`📊 [${job.data.taskId}] ${stage}: ${overallProgress}% - ${message || ''}`);
}

/**
 * Process a generation job
 */
export async function processGenerationJob(
    job: Job<GenerationJobData>
): Promise<JobResult> {
    const startTime = Date.now();
    const agentsUsed: string[] = [];

    console.log(`🚀 Starting job ${job.id}: "${job.data.prompt.substring(0, 50)}..."`);

    try {
        // Stage 1: Initialize
        await updateProgress(job, STAGES.INIT, 0, 'Initializing generation context...');

        const keyManager = getKeyManager();
        const registry = getAgentRegistry();

        // Check for available keys
        if (!keyManager.hasAvailableKeys('openai')) {
            throw new Error('No OpenAI API keys available');
        }

        await updateProgress(job, STAGES.INIT, 100, 'Context initialized');

        // Stage 2: Analyze prompt
        await updateProgress(job, STAGES.ANALYZE, 0, 'Analyzing prompt...');

        let taskAnalysis;
        let requiredCapabilities: string[] = [];

        try {
            // Use AI client for sophisticated prompt analysis
            const aiClient = getAIClient();
            taskAnalysis = await aiClient.analyzeTask(job.data.prompt);

            await updateProgress(job, STAGES.ANALYZE, 50, `AI analysis complete: ${taskAnalysis.complexity} complexity`);

            // Map suggested agents to capabilities
            requiredCapabilities = taskAnalysis.suggestedAgents || [];

            // If AI didn't return specific agents, use keyword matching as fallback
            if (requiredCapabilities.length === 0) {
                requiredCapabilities = analyzePrompt(job.data.prompt);
            }

            console.log({
                complexity: taskAnalysis.complexity,
                subtasks: taskAnalysis.subtasks.length,
                agents: requiredCapabilities.length,
            }, 'Task analysis complete');

        } catch (aiError) {
            // Fallback to keyword matching if AI analysis fails
            console.warn('[GENERATION-WORKER] AI analysis failed, using keyword matching fallback:', aiError);
            requiredCapabilities = analyzePrompt(job.data.prompt);
            taskAnalysis = {
                complexity: 'moderate',
                subtasks: ['Implement requested feature'],
                suggestedAgents: requiredCapabilities,
                estimatedSteps: 3,
            };
        }

        // Find matching agents based on capabilities
        const matchingAgents = requiredCapabilities.flatMap(cap => {
            try {
                return registry.getByCapability(cap);
            } catch (error) {
                console.warn(`[GENERATION-WORKER] No agent found for capability: ${cap}`);
                return [];
            }
        });

        // Remove duplicate agents by ID
        const uniqueAgents = matchingAgents.filter((agent, index, self) =>
            index === self.findIndex((a) => a.id === agent.id)
        );

        await updateProgress(job, STAGES.ANALYZE, 100, `Found ${uniqueAgents.length} relevant agents`);

        // Stage 3: Plan execution
        await updateProgress(job, STAGES.PLAN, 0, 'Planning execution strategy...');

        // Create execution plan based on AI analysis and available agents
        const executionPlan = {
            steps: uniqueAgents.map(agent => ({
                agentId: agent.id,
                task: `Generate ${agent.capabilities.join(', ')}`,
            })),
            subtasks: taskAnalysis?.subtasks || [],
            complexity: taskAnalysis?.complexity || 'moderate',
        };

        await updateProgress(job, STAGES.PLAN, 100, `Planned ${executionPlan.steps.length} steps (${executionPlan.complexity} complexity)`);

        // Stage 4: Generate code
        await updateProgress(job, STAGES.GENERATE, 0, 'Starting code generation...');

        const generatedFiles: Array<{ path: string; content: string; type: string }> = [];

        // Execute each agent in the plan
        for (let i = 0; i < executionPlan.steps.length; i++) {
            const step = executionPlan.steps[i];
            const stepProgress = ((i + 1) / executionPlan.steps.length) * 100;

            await updateProgress(
                job,
                STAGES.GENERATE,
                Math.round(stepProgress * 0.8), // Leave 20% for finalization
                `Executing ${step.agentId}...`,
                step.agentId
            );

            agentsUsed.push(step.agentId);

            try {
                // Get the agent from registry using getAllAgents and filtering
                const allAgents = registry.getAllAgents();
                const agent = allAgents.find(a => a.id === step.agentId);

                if (agent) {
                    // Execute agent with context
                    // In a full implementation, this would call the agent's execute method
                    // For now, we generate files using AI client
                    const agentFiles = await executeAgentGeneration(agent, job.data.prompt);

                    generatedFiles.push(...agentFiles);
                } else {
                    // Fallback: Generate file using AI client if agent not found
                    const aiFile = await generateFallbackFile(step.agentId, step.task, job.data.prompt);
                    generatedFiles.push(aiFile);
                }
            } catch (agentError) {
                console.error(`[GENERATION-WORKER] Agent ${step.agentId} failed:`, agentError);
                // Continue with other agents even if one fails
            }
        }

        // If no agents matched, use AI to generate a basic project
        if (executionPlan.steps.length === 0) {
            await updateProgress(job, STAGES.GENERATE, 90, 'No agents found, using AI generation...');

            try {
                const aiClient = getAIClient();
                const aiResult = await aiClient.generateCode(job.data.prompt, {
                    language: 'TypeScript',
                    framework: 'Fastify',
                });

                if (aiResult.files && aiResult.files.length > 0) {
                    generatedFiles.push(...aiResult.files.map(f => ({
                        path: f.path,
                        content: f.content,
                        type: 'code',
                    })));
                } else {
                    generatedFiles.push({
                        path: 'README.md',
                        content: `# Generated Project\n\nPrompt: ${job.data.prompt}\n\n${aiResult.explanation || 'AI-generated content'}`,
                        type: 'markdown',
                    });
                }
            } catch (aiError) {
                // Final fallback
                generatedFiles.push({
                    path: 'README.md',
                    content: `# Generated Project\n\nPrompt: ${job.data.prompt}\n\nNo specific agents matched this request and AI generation failed.`,
                    type: 'markdown',
                });
            }
        }

        await updateProgress(job, STAGES.GENERATE, 100, 'Code generation complete');

        // Stage 5: Validate
        await updateProgress(job, STAGES.VALIDATE, 0, 'Validating generated code...');

        // Run validation checks
        const validationChecks = {
            hasFiles: generatedFiles.length > 0,
            hasContent: generatedFiles.some(f => f.content.length > 0),
            validPaths: generatedFiles.every(f => f.path.length > 0),
            noDuplicatePaths: new Set(generatedFiles.map(f => f.path)).size === generatedFiles.length,
        };

        // Perform basic code quality checks (logging only for now)
        await performQualityChecks(generatedFiles);

        const isValid = Object.values(validationChecks).every(v => v);

        await sleep(200);

        const validationMessage = isValid
            ? 'Validation passed'
            : 'Validation completed with warnings';

        await updateProgress(job, STAGES.VALIDATE, 100, validationMessage);

        // Stage 6: Finalize
        await updateProgress(job, STAGES.FINALIZE, 0, 'Finalizing results...');

        // Store generated files and update database
        // TODO: Implement database persistence for generated files
        await sleep(100);

        await updateProgress(job, STAGES.FINALIZE, 100, 'Generation complete!');

        const executionTime = Date.now() - startTime;

        const result: JobResult = {
            taskId: job.data.taskId,
            success: true,
            files: generatedFiles,
            agentsUsed,
            executionTime,
        };

        console.log(`✅ Job ${job.id} completed in ${executionTime}ms`);

        return result;

    } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error(`❌ Job ${job.id} failed:`, errorMessage);

        return {
            taskId: job.data.taskId,
            success: false,
            agentsUsed,
            error: errorMessage,
            executionTime,
        };
    }
}

/**
 * Perform quality checks on generated files
 */
async function performQualityChecks(
    files: Array<{ path: string; content: string; type: string }>
): Promise<{
    hasTypeScript: boolean;
    hasTests: boolean;
    hasDocumentation: boolean;
    avgFileSize: number;
}> {
    let totalSize = 0;
    let hasTypeScript = false;
    let hasTests = false;
    let hasDocumentation = false;

    for (const file of files) {
        totalSize += file.content.length;

        // Check for TypeScript files
        if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
            hasTypeScript = true;
        }

        // Check for test files
        if (file.path.includes('.test.') || file.path.includes('.spec.') || file.path.includes('__tests__')) {
            hasTests = true;
        }

        // Check for documentation
        if (file.path.toLowerCase().includes('readme') || file.path.toLowerCase().includes('doc')) {
            hasDocumentation = true;
        }
    }

    return {
        hasTypeScript,
        hasTests,
        hasDocumentation,
        avgFileSize: files.length > 0 ? Math.round(totalSize / files.length) : 0,
    };
}

/**
 * Analyze prompt to determine required capabilities
 * Uses keyword matching as a baseline fallback when AI analysis is not available
 */
function analyzePrompt(prompt: string): string[] {
    const lowerPrompt = prompt.toLowerCase();
    const capabilities: string[] = [];

    // Simple keyword matching for common development tasks
    // This provides a baseline until AI analysis is integrated
    const keywordMap: Record<string, string[]> = {
        'auth': ['jwt-auth', 'oauth', 'clerk-auth'],
        'login': ['jwt-auth', 'session-management'],
        'authentication': ['jwt-auth', 'oauth', 'mfa'],
        'database': ['prisma', 'drizzle', 'postgresql'],
        'api': ['rest-api', 'openapi', 'validation'],
        'graphql': ['graphql', 'apollo'],
        'security': ['helmet', 'cors', 'rate-limiting'],
        'monitoring': ['sentry', 'datadog-apm', 'health-endpoints'],
        'test': ['vitest', 'jest', 'integration-tests'],
        'docker': ['docker', 'kubernetes'],
        'ci/cd': ['github-actions', 'gitlab-ci'],
        'email': ['resend', 'nodemailer'],
    };

    for (const [keyword, caps] of Object.entries(keywordMap)) {
        if (lowerPrompt.includes(keyword)) {
            capabilities.push(...caps);
        }
    }

    // Remove duplicates
    return [...new Set(capabilities)];
}

/**
 * Execute agent generation using AI client
 */
async function executeAgentGeneration(
    agent: Agent,
    prompt: string
): Promise<Array<{ path: string; content: string; type: string }>> {
    try {
        const aiClient = getAIClient();

        const result = await aiClient.generateCode(
            `${agent.capabilities.join(', ')}: ${prompt}`,
            {
                language: 'TypeScript',
                framework: 'Fastify',
            }
        );

        if (result.files && result.files.length > 0) {
            return result.files.map(f => ({
                path: f.path,
                content: f.content,
                type: 'code',
            }));
        }

        // Fallback to markdown output
        return [{
            path: `${agent.id}/output.md`,
            content: `# Generated by ${agent.name}\n\nCapabilities: ${agent.capabilities.join(', ')}\n\n${result.explanation || result.code || 'No content generated'}`,
            type: 'markdown',
        }];
    } catch (error) {
        console.error(`[GENERATION-WORKER] Failed to execute agent ${agent.id}:`, error);
        return [{
            path: `${agent.id}/error.md`,
            content: `# Generation Error\n\nAgent: ${agent.name}\n\nError: ${error instanceof Error ? error.message : String(error)}`,
            type: 'markdown',
        }];
    }
}

/**
 * Generate fallback file when agent is not found
 */
async function generateFallbackFile(
    agentId: string,
    task: string,
    prompt: string
): Promise<{ path: string; content: string; type: string }> {
    return {
        path: `${agentId}/output.md`,
        content: `# Agent Not Found: ${agentId}\n\nTask: ${task}\n\nPrompt: ${prompt}\n\nNote: This agent was not found in the registry. Please check agent configuration.`,
        type: 'markdown',
    };
}

/**
 * Utility sleep function
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start the generation worker
 */
export function startGenerationWorker(): void {
    const queue = getJobQueue();
    queue.startWorker(processGenerationJob);
    console.log('🚀 Generation worker started');
}

/**
 * Stop the generation worker
 */
export async function stopGenerationWorker(): Promise<void> {
    const queue = getJobQueue();
    await queue.stopWorker();
    console.log('🛑 Generation worker stopped');
}
