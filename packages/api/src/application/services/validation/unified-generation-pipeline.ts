/**
 * Unified Generation Pipeline
 * 
 * Coordinates all code generation fixes:
 * 1. File Deduplication
 * 2. Blueprint Enforcement
 * 3. Decorator Import Injection (CG-009)
 * 4. Import Resolution
 * 5. Final Verification
 * 
 * This ensures generated code is complete, runnable, and error-free.
 */

import type { ArchitectureBlueprint } from '../../../domain/services/architecture/architecture-blueprint.js';
import { FileDeduplicator, getFileDeduplicator, type GeneratedFile } from './file-deduplicator.js';
import { BlueprintEnforcer, getBlueprintEnforcer } from '../../../domain/services/architecture/blueprint-enforcer.js';
import { ImportResolver, getImportResolver } from './import-resolver.js';
import { FinalVerifier, getFinalVerifier, type VerificationResult } from './final-verifier.js';
import { DecoratorImportInjector, getDecoratorImportInjector } from './decorator-import-injector.js';

export interface PipelineResult {
    files: GeneratedFile[];
    verification: VerificationResult;
    detectedFramework: string;
    stats: {
        inputFiles: number;
        deduplicatedFiles: number;
        duplicatesRemoved: number;
        missingFilesGenerated: number;
        importsResolved: number;
        decoratorImportsInjected: number;
        totalOutputFiles: number;
    };
}

export class UnifiedGenerationPipeline {
    private deduplicator: FileDeduplicator;
    private blueprintEnforcer: BlueprintEnforcer;
    private importResolver: ImportResolver;
    private verifier: FinalVerifier;
    private decoratorInjector: DecoratorImportInjector;

    constructor() {
        this.deduplicator = getFileDeduplicator();
        this.blueprintEnforcer = getBlueprintEnforcer();
        this.importResolver = getImportResolver();
        this.verifier = getFinalVerifier();
        this.decoratorInjector = getDecoratorImportInjector();
    }

    /**
     * Detect framework from generated code content
     */
    detectFramework(files: GeneratedFile[]): string {
        const allContent = files.map(f => f.content).join('\n');
        
        if (allContent.includes('@Module') || allContent.includes('@Controller') || 
            allContent.includes('@Injectable') || allContent.includes('@Schema') ||
            allContent.includes('SchemaFactory') || allContent.includes('MongooseModule')) {
            return 'nestjs';
        }
        
        if (allContent.includes('FastifyInstance') || allContent.includes("from 'fastify'")) {
            return 'fastify';
        }
        
        if (allContent.includes("from 'express'") || allContent.includes('Router()') || 
            allContent.includes('express.Router')) {
            return 'express';
        }
        
        if (allContent.includes('@Entity') || allContent.includes('@Column') || 
            allContent.includes('typeorm')) {
            return 'typeorm';
        }
        
        return 'unknown';
    }

    /**
     * Execute the full pipeline
     */
    execute(
        files: GeneratedFile[],
        blueprint: ArchitectureBlueprint | null,
        language: string,
        framework: string
    ): PipelineResult {
        console.log('\n========================================');
        console.log('  UNIFIED GENERATION PIPELINE');
        console.log('========================================');
        console.log(`  Input: ${files.length} files`);
        console.log(`  Language: ${language}`);
        console.log(`  Framework: ${framework}`);
        console.log('');

        const inputCount = files.length;

        const detectedFramework = this.detectFramework(files);
        if (detectedFramework !== 'unknown' && detectedFramework !== framework) {
            console.log(`[PIPELINE] Detected framework: ${detectedFramework} (overriding ${framework})`);
            framework = detectedFramework;
        }

        console.log('[PIPELINE] Step 1: Deduplicating files...');
        const dedupeResult = this.deduplicator.deduplicate(files);
        console.log(`[PIPELINE] Removed ${dedupeResult.duplicatesRemoved} duplicates`);

        console.log('[PIPELINE] Step 2: Enforcing blueprint...');
        let enforceResult: {
            files: GeneratedFile[];
            added: number;
            verification: { complete: boolean; missing: string[]; extra: string[]; generated: GeneratedFile[] };
        } = {
            files: dedupeResult.files,
            added: 0,
            verification: { complete: true, missing: [], extra: [], generated: [] }
        };

        if (blueprint) {
            enforceResult = this.blueprintEnforcer.enforce(
                blueprint,
                dedupeResult.files,
                language,
                framework
            );
            console.log(`[PIPELINE] Generated ${enforceResult.added} missing files from blueprint`);
        }

        console.log('[PIPELINE] Step 2.5: Injecting decorator imports (CG-009)...');
        const afterDecoratorInjection = this.decoratorInjector.processFiles(enforceResult.files);
        const decoratorImportsInjected = afterDecoratorInjection.filter((f, i) => 
            f.content !== enforceResult.files[i]?.content
        ).length;
        if (decoratorImportsInjected > 0) {
            console.log(`[PIPELINE] Injected decorator imports into ${decoratorImportsInjected} files`);
        }

        console.log('[PIPELINE] Step 3: Resolving imports...');
        const importResult = this.importResolver.resolve(afterDecoratorInjection, language);
        console.log(`[PIPELINE] Generated ${importResult.newFiles.length} files for missing imports`);
        console.log(`[PIPELINE] Removed ${importResult.removedImports.length} invalid imports`);

        console.log('[PIPELINE] Step 4: Final verification...');
        const verification = this.verifier.verify(importResult.files, language);

        console.log('\n========================================');
        console.log('  PIPELINE COMPLETE');
        console.log('========================================');
        console.log(`  Input files:     ${inputCount}`);
        console.log(`  After dedupe:    ${dedupeResult.files.length}`);
        console.log(`  After blueprint: ${enforceResult.files.length}`);
        console.log(`  After imports:   ${importResult.files.length}`);
        console.log(`  Framework:       ${framework}`);
        console.log(`  Verification:    ${verification.success ? 'PASSED' : 'FAILED'}`);
        console.log('');

        if (!verification.success) {
            console.warn('[PIPELINE] Verification failed with errors:');
            for (const error of verification.errors.slice(0, 5)) {
                console.warn(`  - ${error}`);
            }
            if (verification.errors.length > 5) {
                console.warn(`  ... and ${verification.errors.length - 5} more`);
            }
        }

        return {
            files: importResult.files,
            verification,
            detectedFramework: framework,
            stats: {
                inputFiles: inputCount,
                deduplicatedFiles: dedupeResult.files.length,
                duplicatesRemoved: dedupeResult.duplicatesRemoved,
                missingFilesGenerated: enforceResult.added + importResult.newFiles.length,
                importsResolved: importResult.removedImports.length,
                decoratorImportsInjected,
                totalOutputFiles: importResult.files.length,
            },
        };
    }

    /**
     * Quick pipeline for simple cases (no blueprint)
     */
    quickProcess(files: GeneratedFile[], language: string): PipelineResult {
        return this.execute(files, null, language, 'unknown');
    }

    /**
     * Get stats for a pipeline run
     */
    getStats(result: PipelineResult): string {
        const { stats, verification } = result;
        return `
Pipeline Statistics:
  Input Files:       ${stats.inputFiles}
  Duplicates:        ${stats.duplicatesRemoved} removed
  Missing Generated: ${stats.missingFilesGenerated} files
  Imports Resolved:  ${stats.importsResolved}
  Decorator Inj:     ${stats.decoratorImportsInjected} files
  Output Files:      ${stats.totalOutputFiles}
  
Verification:
  Status:            ${verification.success ? 'PASSED' : 'FAILED'}
  Valid Files:       ${verification.stats.validFiles}/${verification.stats.totalFiles}
  Errors:            ${verification.errors.length}
  Warnings:          ${verification.warnings.length}
`.trim();
    }
}

// Singleton
let instance: UnifiedGenerationPipeline | null = null;

export function getUnifiedGenerationPipeline(): UnifiedGenerationPipeline {
    if (!instance) {
        instance = new UnifiedGenerationPipeline();
    }
    return instance;
}

export function createUnifiedGenerationPipeline(): UnifiedGenerationPipeline {
    instance = new UnifiedGenerationPipeline();
    return instance;
}
