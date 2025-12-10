/**
 * Generation Worker
 * Processes code generation jobs from the queue
 */

import { Job } from 'bullmq';
import type { GenerationJobData, JobResult, JobProgress } from '../services/job-queue.js';
import { getJobQueue } from '../services/job-queue.js';
import { getKeyManager } from '../services/key-manager.js';
import { getAgentRegistry } from '../services/agent-registry.js';

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

        // TODO: Use Brain to analyze the prompt and determine required agents
        const requiredCapabilities = analyzePrompt(job.data.prompt);

        await updateProgress(job, STAGES.ANALYZE, 50, `Identified ${requiredCapabilities.length} capabilities`);

        // Find matching agents
        const matchingAgents = requiredCapabilities.flatMap(cap =>
            registry.getByCapability(cap)
        );

        await updateProgress(job, STAGES.ANALYZE, 100, `Found ${matchingAgents.length} relevant agents`);

        // Stage 3: Plan execution
        await updateProgress(job, STAGES.PLAN, 0, 'Planning execution strategy...');

        // TODO: Create execution plan based on available agents
        const executionPlan = {
            steps: matchingAgents.map(agent => ({
                agentId: agent.id,
                task: `Generate ${agent.capabilities.join(', ')}`,
            })),
        };

        await updateProgress(job, STAGES.PLAN, 100, `Planned ${executionPlan.steps.length} steps`);

        // Stage 4: Generate code
        await updateProgress(job, STAGES.GENERATE, 0, 'Starting code generation...');

        const generatedFiles: Array<{ path: string; content: string; type: string }> = [];

        // TODO: Execute each agent in the plan
        // For now, simulate generation
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

            // Simulate agent execution time
            await sleep(500);

            // TODO: Actually call the agent
            // const result = await agent.execute({ prompt: job.data.prompt });
            // generatedFiles.push(...result.files);
        }

        // If no agents matched, generate a placeholder
        if (executionPlan.steps.length === 0) {
            generatedFiles.push({
                path: 'README.md',
                content: `# Generated Project\n\nPrompt: ${job.data.prompt}\n\nNo specific agents matched this request.`,
                type: 'markdown',
            });
        }

        await updateProgress(job, STAGES.GENERATE, 100, 'Code generation complete');

        // Stage 5: Validate
        await updateProgress(job, STAGES.VALIDATE, 0, 'Validating generated code...');

        // TODO: Run validation checks (lint, type check, tests)
        await sleep(200);

        await updateProgress(job, STAGES.VALIDATE, 100, 'Validation passed');

        // Stage 6: Finalize
        await updateProgress(job, STAGES.FINALIZE, 0, 'Finalizing results...');

        // TODO: Store generated files, update database
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
 * Analyze prompt to determine required capabilities
 */
function analyzePrompt(prompt: string): string[] {
    const lowerPrompt = prompt.toLowerCase();
    const capabilities: string[] = [];

    // Simple keyword matching (TODO: Replace with AI analysis)
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
