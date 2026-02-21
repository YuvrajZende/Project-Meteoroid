/**
 * Orchestration File Writing Service
 * 
 * Handles file writing, post-processing, and validation.
 * 
 * Extracted from IntegratedOrchestrator to improve maintainability.
 */

import type { FileWriterService, WriteResult } from '../../../../infrastructure/file-writer.js';
import type { CodePostProcessor } from '../../validation/code-postprocessor.js';
import type { DependencyRegistry } from '../../../../services/registry/dependency-registry.js';
import type { ImportRegistry } from '../../../../services/registry/import-registry.js';
import type { ProjectIntegrityValidator } from '../../validation/project-integrity-validator.js';
import type { UnifiedGenerationPipeline } from '../../validation/unified-generation-pipeline.js';
import { getFileWriter } from '../../../../infrastructure/file-writer.js';
import { getCodePostProcessor } from '../../validation/code-postprocessor.js';
import { getDependencyRegistry } from '../../../../services/registry/dependency-registry.js';
import { getImportRegistry } from '../../../../services/registry/import-registry.js';
import { getProjectIntegrityValidator } from '../../validation/project-integrity-validator.js';
import { getUnifiedGenerationPipeline } from '../../validation/unified-generation-pipeline.js';

export interface FileToWrite {
    path: string;
    content: string;
    type?: 'code' | 'config' | 'doc';
}

export interface FileProcessingResult {
    filesToWrite: FileToWrite[];
    processedOutput: {
        files: FileToWrite[];
        entryPoint: FileToWrite;
        stats: {
            totalFiles: number;
            fixedImports: number;
            removedJsonBlocks: number;
        };
    };
    validationReport: {
        score: number;
        isValid: boolean;
        summary: { critical: number; errors: number; warnings: number };
        recommendations: string[];
    };
}

export class OrchestrationFileService {
    private fileWriter: FileWriterService;
    private codePostProcessor: CodePostProcessor;
    private dependencyRegistry: DependencyRegistry;
    private importRegistry: ImportRegistry;
    private projectIntegrityValidator: ProjectIntegrityValidator;
    private unifiedPipeline: UnifiedGenerationPipeline;

    constructor() {
        this.fileWriter = getFileWriter();
        this.codePostProcessor = getCodePostProcessor();
        this.dependencyRegistry = getDependencyRegistry();
        this.importRegistry = getImportRegistry();
        this.projectIntegrityValidator = getProjectIntegrityValidator();
        this.unifiedPipeline = getUnifiedGenerationPipeline();
    }

    async initialize(): Promise<void> {
        await this.dependencyRegistry.initialize();
        await this.importRegistry.initialize();
        await this.projectIntegrityValidator.initialize();
    }

    async processFiles(
        allCode: string,
        projectName: string,
        language: string,
        architectureBlueprint: unknown
    ): Promise<FileProcessingResult> {
        const processedOutput = await this.codePostProcessor.process(allCode, projectName);

        const mapFileType = (type?: string): 'code' | 'config' | 'doc' | undefined => {
            if (type === 'schema' || type === 'migration') return 'code';
            return type as 'code' | 'config' | 'doc' | undefined;
        };

        const isPythonProject = language.toLowerCase() === 'python';
        const isGoProject = language.toLowerCase() === 'go';
        const isRustProject = language.toLowerCase() === 'rust';
        const isJavaProject = language.toLowerCase() === 'java';
        const shouldAddSrcPrefix = !isPythonProject && !isGoProject;

        let filesToWrite: FileToWrite[] = [
            ...processedOutput.files.map(f => ({
                path: shouldAddSrcPrefix && !f.path.startsWith('src/') ? `src/${f.path}` : f.path,
                content: f.content,
                type: mapFileType(f.type),
            })),
            {
                path: processedOutput.entryPoint.path,
                content: processedOutput.entryPoint.content,
                type: 'code' as const,
            },
        ];

        const pipelineResult = this.unifiedPipeline.execute(
            filesToWrite.map(f => ({
                path: f.path,
                content: f.content,
                type: f.type,
                language,
            })),
            architectureBlueprint as never,
            language,
            'fastify'
        );

        filesToWrite = pipelineResult.files.map(f => ({
            path: f.path,
            content: f.content,
            type: (f.type === 'doc' ? 'doc' : f.type === 'config' ? 'config' : 'code') as 'code' | 'config' | 'doc',
        }));

        this.importRegistry.clear();
        let totalImportsFixes = 0;

        for (let i = 0; i < filesToWrite.length; i++) {
            const file = filesToWrite[i];
            if (file.content && (file.path.endsWith('.ts') || file.path.endsWith('.js'))) {
                const dedupeResult = this.importRegistry.deduplicateImports(file.content, file.path);
                if (dedupeResult.changesMade > 0) {
                    filesToWrite[i] = { ...file, content: dedupeResult.deduplicatedCode };
                    totalImportsFixes += dedupeResult.changesMade;
                }
            }
        }

        let duplicateNameFixes = 0;
        for (let i = 0; i < filesToWrite.length; i++) {
            const file = filesToWrite[i];
            if (file.content && (file.path.endsWith('.ts') || file.path.endsWith('.js'))) {
                const fixResult = this.importRegistry.fixDuplicateNamedImports(file.content, file.path);
                if (fixResult.fixed > 0) {
                    filesToWrite[i] = { ...file, content: fixResult.code };
                    duplicateNameFixes += fixResult.fixed;
                }
            }
        }

        let syntaxFixCount = 0;
        for (let i = 0; i < filesToWrite.length; i++) {
            const file = filesToWrite[i];
            if (file.content && (file.path.endsWith('.ts') || file.path.endsWith('.js'))) {
                const fixResult = this.codePostProcessor.validateAndFixSyntax(file.content, file.path);
                if (fixResult.fixed) {
                    filesToWrite[i] = { ...file, content: fixResult.content };
                    syntaxFixCount++;
                }
            }
        }

        this.dependencyRegistry.clear();
        const fileMap = new Map<string, string>();
        for (const file of filesToWrite) {
            fileMap.set(file.path, file.content);
        }

        const dependencyAnalysis = this.dependencyRegistry.analyzeProject(fileMap);
        const isNodeProject = !isPythonProject && !isGoProject && !isRustProject && !isJavaProject;

        if (isNodeProject && (dependencyAnalysis.detected.length > 0 || filesToWrite.some(f => f.path.includes('package.json')))) {
            const existingPkgIndex = filesToWrite.findIndex(f =>
                f.path === 'package.json' || f.path === 'src/package.json'
            );
            const existingPkgJson = existingPkgIndex >= 0 ? filesToWrite[existingPkgIndex].content : null;

            let packageJsonContent: string;

            if (existingPkgJson) {
                packageJsonContent = this.dependencyRegistry.mergeWithExistingPackageJson(
                    existingPkgJson,
                    projectName
                );
            } else {
                const generatedPackageJson = this.dependencyRegistry.generatePackageJson(projectName);
                packageJsonContent = JSON.stringify(generatedPackageJson, null, 2);
            }

            if (existingPkgIndex >= 0) {
                filesToWrite[existingPkgIndex] = {
                    path: 'package.json',
                    content: packageJsonContent,
                    type: 'config',
                };
            } else {
                filesToWrite.push({
                    path: 'package.json',
                    content: packageJsonContent,
                    type: 'config',
                });
            }
        }

        const projectForValidation = {
            name: projectName,
            entryPoint: { path: processedOutput.entryPoint.path, content: processedOutput.entryPoint.content },
            routes: filesToWrite.filter(f => f.path.includes('route')).map(f => ({ path: f.path, content: f.content })),
            services: filesToWrite.filter(f => f.path.includes('service')).map(f => ({ path: f.path, content: f.content })),
            controllers: filesToWrite.filter(f => f.path.includes('controller')).map(f => ({ path: f.path, content: f.content })),
            middleware: filesToWrite.filter(f => f.path.includes('middleware')).map(f => ({ path: f.path, content: f.content })),
            utilities: filesToWrite.filter(f => f.path.includes('util')).map(f => ({ path: f.path, content: f.content })),
            types: filesToWrite.filter(f => f.path.includes('type')).map(f => ({ path: f.path, content: f.content })),
        };

        const validationReport = await this.projectIntegrityValidator.validateProject(projectForValidation);

        return {
            filesToWrite,
            processedOutput: {
                files: processedOutput.files.map(f => ({
                    path: f.path,
                    content: f.content,
                    type: mapFileType(f.type) as 'code' | 'config' | 'doc',
                })),
                entryPoint: {
                    path: processedOutput.entryPoint.path,
                    content: processedOutput.entryPoint.content,
                },
                stats: {
                    totalFiles: processedOutput.stats.totalFiles,
                    fixedImports: processedOutput.stats.fixedImports + totalImportsFixes + duplicateNameFixes,
                    removedJsonBlocks: processedOutput.stats.removedJsonBlocks,
                },
            },
            validationReport: {
                score: validationReport.score,
                isValid: validationReport.isValid,
                summary: validationReport.summary,
                recommendations: validationReport.recommendations,
            },
        };
    }

    async writeProject(
        projectId: string,
        filesToWrite: FileToWrite[],
        projectName: string,
        language: string
    ): Promise<WriteResult> {
        return this.fileWriter.writeProject(projectId, filesToWrite, {
            projectName,
            language,
        });
    }
}
