/**
 * Analysis Pipeline
 * 
 * Unified orchestrator for the complete frontend analysis workflow:
 * 1. Clone GitHub repository
 * 2. Analyze all files for backend requirements
 * 3. Generate details.md specification
 * 4. Distribute tasks to agents via .md files
 */

import * as path from 'path';
import { RepoCloner, CloneResult, RepoMetadata } from './repo-cloner.js';
import { FrontendAnalyzerAgent } from './frontend-analyzer.js';
import { DetailsGenerator, GeneratedDetails } from './details-generator.js';
import { TaskDistributor, DistributionResult } from './task-distributor.js';
import type { FrontendAnalysisResult } from './types.js';

// ============================================
// TYPES
// ============================================

export interface PipelineOptions {
    /** GitHub repository URL OR local path */
    source: string;

    /** Output directory for all generated files */
    outputDir: string;

    /** Branch to clone (if source is GitHub URL) */
    branch?: string;

    /** Skip cloning (use source as local path) */
    skipClone?: boolean;

    /** Only generate specification, don't distribute tasks */
    specOnly?: boolean;

    /** Include JSON report alongside MD files */
    includeJsonReport?: boolean;

    /** Clean up cloned repo after analysis */
    cleanupAfterAnalysis?: boolean;

    /** Project name for generated files */
    projectName?: string;
}

export interface PipelineResult {
    success: boolean;

    /** Clone result (if cloning was performed) */
    clone?: CloneResult;

    /** Repository metadata */
    repoMetadata?: RepoMetadata;

    /** Path to the analyzed repository */
    analyzedPath: string;

    /** Frontend analysis result */
    analysis: FrontendAnalysisResult;

    /** Generated details.md info */
    details: GeneratedDetails;

    /** Distributed task info (if not spec-only) */
    tasks?: DistributionResult;

    /** Total duration in milliseconds */
    duration: number;

    /** Error message if failed */
    error?: string;
}

// ============================================
// ANALYSIS PIPELINE
// ============================================

export class AnalysisPipeline {
    private repoCloner: RepoCloner;
    private frontendAnalyzer: FrontendAnalyzerAgent;

    constructor() {
        this.repoCloner = new RepoCloner();
        this.frontendAnalyzer = new FrontendAnalyzerAgent();
    }

    /**
     * Run the complete analysis pipeline
     */
    async run(options: PipelineOptions): Promise<PipelineResult> {
        const startTime = Date.now();

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  LOVEABLE BACKEND ORCHESTRATOR - Analysis Pipeline');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log();

        let cloneResult: CloneResult | undefined;
        let repoMetadata: RepoMetadata | undefined;
        let analyzedPath: string;

        try {
            // ========================================
            // STEP 1: CLONE (if needed)
            // ========================================

            if (this.isGitHubUrl(options.source) && !options.skipClone) {
                console.log('📥 STEP 1: Cloning repository...');
                console.log();

                const { result, metadata } = await this.repoCloner.cloneWithMetadata({
                    repoUrl: options.source,
                    branch: options.branch,
                });

                if (!result.success) {
                    return {
                        success: false,
                        analyzedPath: '',
                        analysis: {} as FrontendAnalysisResult,
                        details: {} as GeneratedDetails,
                        duration: Date.now() - startTime,
                        error: `Clone failed: ${result.error}`,
                    };
                }

                cloneResult = result;
                repoMetadata = metadata;
                analyzedPath = result.localPath;

                console.log(`✅ Cloned to: ${analyzedPath}`);
                console.log();
            } else {
                console.log('📂 STEP 1: Using local path...');
                analyzedPath = options.source;
                console.log(`   Path: ${analyzedPath}`);
                console.log();
            }

            // ========================================
            // STEP 2: ANALYZE
            // ========================================

            console.log('🔍 STEP 2: Analyzing frontend code...');
            console.log();

            // Initialize analyzer
            await this.frontendAnalyzer.initialize({});

            // Run analysis
            const analysis = await this.frontendAnalyzer.analyzeRepository({
                rootPath: analyzedPath,
                deepAnalysis: true,
            });

            console.log(`   Framework: ${analysis.framework.type}`);
            console.log(`   API Calls: ${analysis.apiCalls.length}`);
            console.log(`   Models: ${analysis.dataModels.length}`);
            console.log(`   Routes: ${analysis.routes.length}`);
            console.log(`   Auth: ${analysis.authStrategy.provider}`);
            console.log();

            // ========================================
            // STEP 3: GENERATE DETAILS.MD
            // ========================================

            console.log('📝 STEP 3: Generating specification...');
            console.log();

            const detailsGenerator = new DetailsGenerator({
                analysisResult: analysis,
                outputDir: path.join(options.outputDir, 'analysis'),
                includeJsonReport: options.includeJsonReport,
                repoMetadata: repoMetadata ? {
                    name: repoMetadata.name,
                    owner: repoMetadata.owner,
                    url: repoMetadata.url,
                    branch: repoMetadata.branch,
                } : undefined,
            });

            const details = await detailsGenerator.generate();

            console.log(`   Details: ${details.detailsPath}`);
            if (details.jsonReportPath) {
                console.log(`   Report: ${details.jsonReportPath}`);
            }
            console.log();

            // ========================================
            // STEP 4: DISTRIBUTE TASKS
            // ========================================

            let tasks: DistributionResult | undefined;

            if (!options.specOnly) {
                console.log('📋 STEP 4: Distributing agent tasks...');
                console.log();

                const taskDistributor = new TaskDistributor({
                    analysisResult: analysis,
                    outputDir: options.outputDir,
                    projectName: options.projectName || repoMetadata?.name || 'Backend',
                });

                tasks = await taskDistributor.distribute();

                console.log(`   Tasks created: ${tasks.totalAgents}`);
                console.log(`   Tasks dir: ${tasks.tasksDir}`);
                for (const task of tasks.tasks) {
                    console.log(`   - ${task.agentName}: ${path.basename(task.taskFilePath)}`);
                }
                console.log();
            }

            // ========================================
            // CLEANUP
            // ========================================

            if (options.cleanupAfterAnalysis && cloneResult) {
                console.log('🧹 Cleaning up cloned repository...');
                await this.repoCloner.cleanup(cloneResult.localPath);
                console.log();
            }

            // ========================================
            // COMPLETE
            // ========================================

            const duration = Date.now() - startTime;

            console.log('═══════════════════════════════════════════════════════════════');
            console.log('  ✅ PIPELINE COMPLETE');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log();
            console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
            console.log(`   Details: ${details.detailsPath}`);
            if (tasks) {
                console.log(`   Tasks: ${tasks.tasksDir}`);
            }
            console.log();
            console.log('   Next steps:');
            console.log('   1. Review details.md for accuracy');
            console.log('   2. Run orchestrator to execute agent tasks');
            console.log();

            return {
                success: true,
                clone: cloneResult,
                repoMetadata,
                analyzedPath,
                analysis,
                details,
                tasks,
                duration,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            console.error();
            console.error('❌ PIPELINE FAILED');
            console.error(`   Error: ${errorMessage}`);
            console.error();

            return {
                success: false,
                analyzedPath: options.source,
                analysis: {} as FrontendAnalysisResult,
                details: {} as GeneratedDetails,
                duration: Date.now() - startTime,
                error: errorMessage,
            };
        }
    }

    /**
     * Check if a string is a GitHub URL
     */
    private isGitHubUrl(source: string): boolean {
        return (
            source.includes('github.com') ||
            source.startsWith('git@github.com')
        );
    }

    /**
     * Cleanup any cloned repositories
     */
    async cleanup(): Promise<void> {
        await this.repoCloner.cleanupAll();
    }
}

// Export singleton
export const analysisPipeline = new AnalysisPipeline();
export default analysisPipeline;
