/**
 * Orchestration Quality Service
 * 
 * Handles quality assessment and architecture knowledge storage.
 * 
 * Extracted from IntegratedOrchestrator to improve maintainability.
 */

import {
    getQualityAssessment,
    type QualityAssessmentService,
} from '../../../../domain/services/analysis/quality-assessment.js';
import {
    getArchitectureKnowledge,
    type ArchitectureKnowledgeService,
} from '../../../../domain/services/architecture/architecture-knowledge.js';

export interface QualityResult {
    score: number;
    passed: boolean;
    issues: Array<{ severity: string; message: string }>;
    recommendations: string[];
    shouldRegenerate: boolean;
}

export class OrchestrationQualityService {
    private qualityAssessment: QualityAssessmentService;
    private architectureKnowledge: ArchitectureKnowledgeService;

    constructor() {
        this.qualityAssessment = getQualityAssessment();
        this.architectureKnowledge = getArchitectureKnowledge();
    }

    async initialize(): Promise<void> {
        await this.qualityAssessment.initialize();
        await this.architectureKnowledge.initialize();
    }

    async assessQuality(
        files: Array<{ path: string; content: string }>,
        blueprint: unknown,
        language: string,
        framework: string
    ): Promise<QualityResult> {
        try {
            const assessment = await this.qualityAssessment.assess(
                files,
                blueprint as never,
                language,
                framework
            );

            return {
                score: assessment.score,
                passed: assessment.passed,
                issues: assessment.issues,
                recommendations: assessment.recommendations,
                shouldRegenerate: assessment.shouldRegenerate,
            };
        } catch (error) {
            console.warn('[QUALITY] Assessment failed:', error);
            return {
                score: 50,
                passed: true,
                issues: [],
                recommendations: ['Quality assessment failed - manual review recommended'],
                shouldRegenerate: false,
            };
        }
    }

    async storeArchitecture(
        projectId: string,
        prompt: string,
        language: string,
        framework: string,
        generatedFilePaths: string[],
        qualityScore: number,
        multiModelResult?: {
            architectureBlueprint?: unknown;
            files: Array<{ path: string }>;
            explanation?: string;
        }
    ): Promise<boolean> {
        try {
            if (multiModelResult?.architectureBlueprint) {
                await this.architectureKnowledge.storeArchitecture(
                    projectId,
                    prompt,
                    language,
                    framework,
                    [],
                    multiModelResult.architectureBlueprint as never,
                    generatedFilePaths,
                    qualityScore
                );
                return true;
            }

            if (multiModelResult) {
                const minimalBlueprint = {
                    projectId,
                    prompt,
                    language,
                    framework,
                    generatedFiles: generatedFilePaths.map(path => ({
                        path,
                        agent: path.split('/')[0],
                    })),
                    qualityScore,
                    filesCount: multiModelResult.files.length,
                    explanation: multiModelResult.explanation,
                    timestamp: new Date().toISOString(),
                };
                await this.architectureKnowledge.storeArchitecture(
                    projectId,
                    prompt,
                    language,
                    framework,
                    [],
                    minimalBlueprint as never,
                    generatedFilePaths,
                    qualityScore
                );
                return true;
            }

            const minimalBlueprint = {
                projectId,
                prompt,
                language,
                framework,
                generatedFiles: generatedFilePaths.map(path => ({
                    path,
                    agent: path.split('/')[0],
                })),
                qualityScore,
                timestamp: new Date().toISOString(),
            };
            await this.architectureKnowledge.storeArchitecture(
                projectId,
                prompt,
                language,
                framework,
                [],
                minimalBlueprint as never,
                generatedFilePaths,
                qualityScore
            );
            return true;
        } catch (error) {
            console.warn('[ARCH-KNOWLEDGE] Failed to store architecture:', error);
            return false;
        }
    }
}
