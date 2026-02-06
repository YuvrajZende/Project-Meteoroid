/**
 * Frontend Analyzer Agent - Types
 * 
 * Type definitions for frontend analysis results.
 * These types define the structure of extracted information from frontend repositories.
 */

// ============================================
// FRAMEWORK DETECTION
// ============================================

export type FrameworkType = 
    | 'react'
    | 'react-vite'
    | 'next'
    | 'vue'
    | 'vue-vite'
    | 'nuxt'
    | 'svelte'
    | 'sveltekit'
    | 'angular'
    | 'solid'
    | 'astro'
    | 'remix'
    | 'unknown';

export interface FrameworkInfo {
    /** Detected framework */
    type: FrameworkType;
    /** Framework version from package.json */
    version: string | null;
    /** Whether it's a meta-framework (Next, Nuxt, SvelteKit, etc.) */
    isMetaFramework: boolean;
    /** TypeScript usage detected */
    usesTypeScript: boolean;
    /** Detected build tool (vite, webpack, esbuild, etc.) */
    buildTool: string | null;
    /** UI library if detected (MUI, Chakra, Tailwind, etc.) */
    uiLibrary: string | null;
    /** State management if detected (Redux, Zustand, Pinia, etc.) */
    stateManagement: string | null;
    /** Confidence score (0-1) */
    confidence: number;
}

// ============================================
// API CALL EXTRACTION
// ============================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type ApiLibraryType = 
    | 'fetch'
    | 'axios'
    | 'swr'
    | 'react-query'
    | 'tanstack-query'
    | 'trpc'
    | 'apollo'
    | 'urql'
    | 'ky'
    | 'got'
    | 'unknown';

export interface ExtractedAPICall {
    /** API endpoint path (e.g., '/api/users', '/auth/login') */
    endpoint: string;
    /** HTTP method */
    method: HttpMethod;
    /** Library used for the call */
    library: ApiLibraryType;
    /** File where this API call was found */
    sourceFile: string;
    /** Line number in source file */
    lineNumber: number;
    /** Inferred request body structure (if POST/PUT/PATCH) */
    requestBody?: InferredType;
    /** Inferred response structure */
    responseType?: InferredType;
    /** Whether authentication is likely required */
    requiresAuth: boolean;
    /** Query parameters if detected */
    queryParams?: string[];
    /** Path parameters (e.g., :id, [id]) */
    pathParams?: string[];
    /** Raw code snippet for context */
    codeSnippet?: string;
}

// ============================================
// DATA MODEL INFERENCE
// ============================================

export type InferredFieldType = 
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'array'
    | 'object'
    | 'enum'
    | 'uuid'
    | 'email'
    | 'url'
    | 'unknown';

export interface InferredField {
    /** Field name */
    name: string;
    /** Inferred type */
    type: InferredFieldType;
    /** Whether field appears optional */
    optional: boolean;
    /** Array element type if type is 'array' */
    arrayType?: InferredFieldType;
    /** Nested fields if type is 'object' */
    nestedFields?: InferredField[];
    /** Enum values if type is 'enum' */
    enumValues?: string[];
    /** Validation hints */
    validation?: {
        required?: boolean;
        minLength?: number;
        maxLength?: number;
        min?: number;
        max?: number;
        pattern?: string;
    };
}

export interface InferredType {
    /** Type name/identifier */
    name: string;
    /** Fields in this type */
    fields: InferredField[];
    /** Source of inference (form, state, props, api response) */
    source: 'form' | 'state' | 'props' | 'api' | 'typescript' | 'zod' | 'yup';
    /** File where this was inferred from */
    sourceFile: string;
    /** Confidence score (0-1) */
    confidence: number;
}

export interface InferredModel {
    /** Model name (e.g., 'User', 'Product', 'Order') */
    name: string;
    /** Inferred fields */
    fields: InferredField[];
    /** Where this model was inferred from */
    sources: Array<{
        file: string;
        type: 'interface' | 'type' | 'form' | 'state' | 'api-call';
    }>;
    /** Relationships to other models */
    relationships: Array<{
        targetModel: string;
        type: 'one-to-one' | 'one-to-many' | 'many-to-many';
        fieldName: string;
    }>;
    /** Suggested primary key field */
    primaryKey?: string;
    /** Confidence score (0-1) */
    confidence: number;
}

// ============================================
// AUTH STRATEGY DETECTION
// ============================================

export type AuthProviderType = 
    | 'clerk'
    | 'auth0'
    | 'firebase'
    | 'supabase'
    | 'nextauth'
    | 'passport'
    | 'custom-jwt'
    | 'session-based'
    | 'none'
    | 'unknown';

export interface DetectedAuthStrategy {
    /** Primary auth provider detected */
    provider: AuthProviderType;
    /** Package name if third-party */
    packageName?: string;
    /** Version from package.json */
    version?: string;
    /** Authentication features detected */
    features: {
        socialLogin: boolean;
        emailPassword: boolean;
        magicLink: boolean;
        phoneAuth: boolean;
        mfa: boolean;
        sso: boolean;
    };
    /** Protected routes/paths detected */
    protectedRoutes: string[];
    /** Auth-related files found */
    authFiles: string[];
    /** Auth hooks/utilities used */
    authHooks: string[];
    /** Token storage method */
    tokenStorage: 'cookie' | 'localStorage' | 'sessionStorage' | 'memory' | 'unknown';
    /** Confidence score (0-1) */
    confidence: number;
}

// ============================================
// ROUTING ANALYSIS
// ============================================

export interface RouteInfo {
    /** Route path (e.g., '/users/:id', '/products') */
    path: string;
    /** HTTP method if API route */
    method?: HttpMethod;
    /** Whether this is a dynamic route */
    isDynamic: boolean;
    /** Path parameters */
    params: string[];
    /** Component file for this route */
    componentFile?: string;
    /** Is this a protected/authenticated route */
    isProtected: boolean;
    /** Nested/child routes */
    children?: RouteInfo[];
    /** Layout file if applicable */
    layoutFile?: string;
}

// ============================================
// DEPENDENCY ANALYSIS
// ============================================

export interface DependencyInfo {
    /** Package name */
    name: string;
    /** Installed version */
    version: string;
    /** Whether it's a dev dependency */
    isDev: boolean;
    /** Category of the dependency */
    category: 
        | 'framework'
        | 'ui-library'
        | 'state-management'
        | 'data-fetching'
        | 'auth'
        | 'validation'
        | 'testing'
        | 'build-tool'
        | 'utility'
        | 'other';
    /** Backend implications (what backend features this implies) */
    backendImplications?: string[];
}

// ============================================
// COMPLETE ANALYSIS RESULT
// ============================================

export interface FrontendAnalysisResult {
    /** Timestamp of analysis */
    analyzedAt: Date;
    /** Path to analyzed repository */
    repositoryPath: string;
    /** Detected framework */
    framework: FrameworkInfo;
    /** Extracted API calls */
    apiCalls: ExtractedAPICall[];
    /** Inferred data models */
    dataModels: InferredModel[];
    /** Detected authentication strategy */
    authStrategy: DetectedAuthStrategy;
    /** Route structure */
    routes: RouteInfo[];
    /** Dependency information */
    dependencies: DependencyInfo[];
    /** Files analyzed */
    filesAnalyzed: number;
    /** Analysis statistics */
    stats: {
        totalFiles: number;
        jsxFiles: number;
        tsFiles: number;
        apiCallsFound: number;
        modelsInferred: number;
        routesDetected: number;
    };
    /** Warnings or issues during analysis */
    warnings: string[];
    /** Suggestions for backend generation */
    suggestions: {
        recommendedDatabase: 'postgresql' | 'mysql' | 'mongodb';
        recommendedOrm: 'prisma' | 'drizzle' | 'typeorm';
        recommendedAuth: AuthProviderType;
        apiStyle: 'rest' | 'graphql' | 'trpc';
    };
}

// ============================================
// ANALYZER CONFIGURATION
// ============================================

export interface FrontendAnalyzerConfig {
    /** Root directory to analyze */
    rootPath: string;
    /** Directories to exclude */
    excludeDirs?: string[];
    /** File extensions to analyze */
    extensions?: string[];
    /** Maximum file size to analyze (bytes) */
    maxFileSize?: number;
    /** Whether to follow symlinks */
    followSymlinks?: boolean;
    /** Deep analysis (slower but more accurate) */
    deepAnalysis?: boolean;
}
