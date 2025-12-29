/**
 * Test Agent Types
 * Type definitions for test generation
 */

// ============================================
// TEST FRAMEWORK TYPES
// ============================================

export type TestFramework = 'vitest' | 'jest' | 'mocha' | 'playwright' | 'cypress';
export type TestType = 'unit' | 'integration' | 'e2e' | 'component' | 'api' | 'snapshot';
export type CoverageFormat = 'html' | 'json' | 'lcov' | 'text' | 'cobertura';

// ============================================
// TEST CONFIGURATION
// ============================================

export interface TestConfig {
    framework: TestFramework;
    testType: TestType;
    coverage: boolean;
    coverageThreshold?: CoverageThreshold;
    setupFiles?: string[];
    testMatch?: string[];
    testTimeout?: number;
    maxConcurrency?: number;
    environment?: 'node' | 'jsdom' | 'happy-dom';
}

export interface CoverageThreshold {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
}

// ============================================
// UNIT TEST TYPES
// ============================================

export interface UnitTestRequest {
    sourceFile: string;
    sourceCode: string;
    testFramework?: TestFramework;
    includeEdgeCases?: boolean;
    includeMocks?: boolean;
    includeFixtures?: boolean;
}

export interface UnitTestResult {
    testFile: string;
    testCode: string;
    mockFile?: string;
    mockCode?: string;
    fixtureFile?: string;
    fixtureCode?: string;
    testCount: number;
    coverage?: CoverageThreshold;
}

export interface MockConfig {
    modulePath: string;
    mockName: string;
    functions: MockFunction[];
}

export interface MockFunction {
    name: string;
    returnType: string;
    returnValue?: string;
    isAsync: boolean;
}

// ============================================
// INTEGRATION TEST TYPES
// ============================================

export interface IntegrationTestRequest {
    serviceName: string;
    dependencies: string[];
    endpoints?: string[];
    database?: boolean;
    redis?: boolean;
    externalApis?: string[];
}

export interface IntegrationTestResult {
    testFile: string;
    testCode: string;
    setupFile?: string;
    setupCode?: string;
    testCount: number;
}

// ============================================
// E2E TEST TYPES (PLAYWRIGHT)
// ============================================

export interface E2ETestRequest {
    pageUrl: string;
    userFlows: UserFlow[];
    framework?: 'playwright' | 'cypress';
    browsers?: ('chromium' | 'firefox' | 'webkit')[];
    screenshots?: boolean;
    video?: boolean;
}

export interface UserFlow {
    name: string;
    steps: FlowStep[];
}

export interface FlowStep {
    action: 'navigate' | 'click' | 'fill' | 'select' | 'wait' | 'assert' | 'screenshot';
    selector?: string;
    value?: string;
    timeout?: number;
    expected?: string;
}

export interface E2ETestResult {
    testFile: string;
    testCode: string;
    pageObjectFile?: string;
    pageObjectCode?: string;
    configFile?: string;
    configCode?: string;
    testCount: number;
}

// ============================================
// API TEST TYPES
// ============================================

export interface APITestRequest {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    requestBody?: Record<string, unknown>;
    expectedStatus: number;
    expectedBody?: Record<string, unknown>;
    headers?: Record<string, string>;
    auth?: {
        type: 'bearer' | 'basic' | 'api-key';
        token?: string;
    };
}

export interface APITestResult {
    testFile: string;
    testCode: string;
    testCount: number;
}

// ============================================
// COMPONENT TEST TYPES
// ============================================

export interface ComponentTestRequest {
    componentPath: string;
    componentCode: string;
    framework: 'react' | 'vue' | 'svelte' | 'solid';
    includeSnapshots?: boolean;
    includeAccessibility?: boolean;
    includeUserEvents?: boolean;
}

export interface ComponentTestResult {
    testFile: string;
    testCode: string;
    snapshotFile?: string;
    testCount: number;
}

// ============================================
// TEST GENERATION RESULT
// ============================================

export interface TestGenerationResult {
    success: boolean;
    files: GeneratedTestFile[];
    totalTests: number;
    estimatedCoverage?: CoverageThreshold;
    dependencies: string[];
    setupInstructions: string[];
    errors?: string[];
}

export interface GeneratedTestFile {
    path: string;
    content: string;
    type: 'test' | 'mock' | 'fixture' | 'config' | 'setup' | 'page-object';
    testCount?: number;
    description?: string;
}

// ============================================
// ANALYSIS TYPES
// ============================================

export interface CodeAnalysis {
    functions: FunctionInfo[];
    classes: ClassInfo[];
    imports: string[];
    exports: string[];
    dependencies: string[];
}

export interface FunctionInfo {
    name: string;
    isAsync: boolean;
    isExported: boolean;
    parameters: ParameterInfo[];
    returnType?: string;
    complexity: number;
    lineStart: number;
    lineEnd: number;
}

export interface ParameterInfo {
    name: string;
    type?: string;
    optional: boolean;
    defaultValue?: string;
}

export interface ClassInfo {
    name: string;
    isExported: boolean;
    methods: FunctionInfo[];
    properties: PropertyInfo[];
    extends?: string;
    implements?: string[];
}

export interface PropertyInfo {
    name: string;
    type?: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    isReadonly: boolean;
}

// ============================================
// TEST AGENT STATUS
// ============================================

export interface TestAgentStatus {
    initialized: boolean;
    capabilities: number;
    supportedFrameworks: TestFramework[];
    supportedTestTypes: TestType[];
}
