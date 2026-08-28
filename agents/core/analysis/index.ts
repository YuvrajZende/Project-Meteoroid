/**
 * Analysis Module - Exports
 * 
 * Central export point for the Analysis agents and utilities.
 * This module provides frontend analysis capabilities for the orchestrator.
 */

// ============================================
// FRONTEND ANALYZER AGENT
// ============================================

export {
    FrontendAnalyzerAgent,
    frontendAnalyzerAgent,
} from './frontend-analyzer.js';

// ============================================
// ANALYSIS UTILITIES
// ============================================

export { FrameworkDetector } from './framework-detector.js';
export { APICallExtractor } from './api-extractor.js';
export { AuthDetector } from './auth-detector.js';
export { DataModelInferrer } from './model-inferrer.js';
export { RouteAnalyzer } from './route-analyzer.js';

// ============================================
// PIPELINE COMPONENTS
// ============================================

// Repository Cloner
export {
    RepoCloner,
    repoCloner,
    parseGitHubUrl,
} from './repo-cloner.js';
export type {
    CloneOptions,
    CloneResult,
    RepoMetadata
} from './repo-cloner.js';

// Details Generator
export {
    DetailsGenerator,
} from './details-generator.js';
export type {
    DetailsGeneratorConfig,
    GeneratedDetails
} from './details-generator.js';

// Task Distributor
export {
    TaskDistributor,
} from './task-distributor.js';
export type {
    TaskDistributorConfig,
    DistributedTask,
    DistributionResult
} from './task-distributor.js';

// Analysis Pipeline (Main Entry Point)
export {
    AnalysisPipeline,
    analysisPipeline,
} from './analysis-pipeline.js';
export type {
    PipelineOptions,
    PipelineResult
} from './analysis-pipeline.js';

// ============================================
// TYPES
// ============================================

export type {
    // Framework types
    FrameworkType,
    FrameworkInfo,

    // API Call types
    HttpMethod,
    ApiLibraryType,
    ExtractedAPICall,

    // Data Model types
    InferredFieldType,
    InferredField,
    InferredType,
    InferredModel,

    // Auth types
    AuthProviderType,
    DetectedAuthStrategy,

    // Route types
    RouteInfo,

    // Dependency types
    DependencyInfo,

    // Result types
    FrontendAnalysisResult,
    FrontendAnalyzerConfig,
} from './types.js';

// ============================================
// AGENT CAPABILITIES MAP
// ============================================

export const FRONTEND_ANALYZER_CAPABILITIES = [
    // Framework detection
    'framework-detection',
    'react-detection',
    'vue-detection',
    'next-detection',
    'nuxt-detection',
    'svelte-detection',
    'angular-detection',

    // API extraction
    'api-extraction',
    'endpoint-detection',
    'fetch-analysis',
    'axios-analysis',
    'swr-analysis',
    'react-query-analysis',

    // Data modeling
    'model-inference',
    'typescript-analysis',
    'zod-schema-analysis',
    'form-state-analysis',

    // Auth detection
    'auth-detection',
    'clerk-detection',
    'auth0-detection',
    'firebase-detection',
    'supabase-detection',
    'nextauth-detection',

    // Routing
    'route-analysis',
    'protected-route-detection',

    // Dependencies
    'dependency-analysis',
    'package-analysis',

    // Pipeline capabilities
    'github-clone',
    'details-generation',
    'task-distribution',
] as const;

// Default export
export { analysisPipeline as default } from './analysis-pipeline.js';

