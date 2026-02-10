/**
 * Test Agent
 * Automated test generation for various testing frameworks
 * 
 * Capabilities:
 * - Unit test generation (Vitest/Jest)
 * - Integration test templates
 * - E2E test generation (Playwright/Cypress)
 * - API test generation
 * - Component test generation (React/Vue)
 * - Mock and fixture generation
 * - Coverage configuration
 * 
 * @author Person 2 (AI/ML Engineer)
 */

import {
    TestConfig,
    TestFramework,
    TestType,
    UnitTestRequest,
    UnitTestResult,
    IntegrationTestRequest,
    IntegrationTestResult,
    E2ETestRequest,
    E2ETestResult,
    APITestRequest,
    APITestResult,
    ComponentTestRequest,
    ComponentTestResult,
    TestGenerationResult,
    GeneratedTestFile,
    CoverageThreshold,
    CodeAnalysis,
    FunctionInfo,
    ClassInfo,
    MockConfig,
    TestAgentStatus,
} from './types.js';

import {
    VITEST_CONFIG_TEMPLATE,
    JEST_CONFIG_TEMPLATE,
    UNIT_TEST_TEMPLATE,
    TEST_CASE_TEMPLATE,
    EDGE_CASE_TEMPLATE,
    MOCK_FILE_TEMPLATE,
    MOCK_FUNCTION_TEMPLATE,
    MOCK_ASYNC_FUNCTION_TEMPLATE,
    FIXTURE_FILE_TEMPLATE,
    FACTORY_FUNCTION_TEMPLATE,
    INTEGRATION_TEST_TEMPLATE,
    INTEGRATION_TEST_CASE_TEMPLATE,
    API_TEST_TEMPLATE,
    API_TEST_CASE_TEMPLATE,
    PLAYWRIGHT_CONFIG_TEMPLATE,
    BROWSER_PROJECT_TEMPLATE,
    E2E_TEST_TEMPLATE,
    E2E_TEST_CASE_TEMPLATE,
    E2E_STEP_TEMPLATES,
    PAGE_OBJECT_TEMPLATE,
    REACT_COMPONENT_TEST_TEMPLATE,
    COMPONENT_TEST_CASE_TEMPLATE,
    SNAPSHOT_TEST_TEMPLATE,
    TEST_SETUP_TEMPLATE,
} from './templates/index.js';

// ============================================
// TEST AGENT CLASS
// ============================================

export class TestAgent {
    private isInitialized = false;
    private aiClient: unknown = null;
    private metricsService: unknown = null;

    private readonly supportedFrameworks: TestFramework[] = ['vitest', 'jest', 'mocha', 'playwright', 'cypress'];
    private readonly supportedTestTypes: TestType[] = ['unit', 'integration', 'e2e', 'component', 'api', 'snapshot'];

    constructor() {
        // Initialize with defaults
    }

    // ============================================
    // SERVICE INJECTION
    // ============================================

    setAIClient(client: unknown): void {
        this.aiClient = client;
    }

    setMetricsService(service: unknown): void {
        this.metricsService = service;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        console.log('[TEST-AGENT] Test Agent initialized');
        console.log('[TEST-AGENT] Supported frameworks:', this.supportedFrameworks.join(', '));
        console.log('[TEST-AGENT] Supported test types:', this.supportedTestTypes.join(', '));

        this.isInitialized = true;
    }

    // ============================================
    // CODE ANALYSIS
    // ============================================

    /**
     * Analyze source code to extract testable elements
     */
    analyzeCode(sourceCode: string): CodeAnalysis {
        const functions: FunctionInfo[] = [];
        const classes: ClassInfo[] = [];
        const imports: string[] = [];
        const exports: string[] = [];
        const dependencies: string[] = [];

        // Extract imports
        const importRegex = /import\s+(?:(?:\{[^}]+\})|(?:\*\s+as\s+\w+)|(?:[\w,\s]+))\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(sourceCode)) !== null) {
            imports.push(match[0]);
            if (!match[1].startsWith('.')) {
                dependencies.push(match[1]);
            }
        }

        // Extract exported functions
        const exportFuncRegex = /export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
        while ((match = exportFuncRegex.exec(sourceCode)) !== null) {
            functions.push({
                name: match[2],
                isAsync: !!match[1],
                isExported: true,
                parameters: this.parseParameters(match[3]),
                returnType: match[4]?.trim(),
                complexity: this.calculateComplexity(sourceCode, match.index),
                lineStart: this.getLineNumber(sourceCode, match.index),
                lineEnd: this.getLineNumber(sourceCode, match.index) + 10,
            });
            exports.push(match[2]);
        }

        // Extract arrow functions
        const arrowFuncRegex = /export\s+const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/g;
        while ((match = arrowFuncRegex.exec(sourceCode)) !== null) {
            functions.push({
                name: match[1],
                isAsync: !!match[2],
                isExported: true,
                parameters: this.parseParameters(match[3]),
                returnType: match[4]?.trim(),
                complexity: this.calculateComplexity(sourceCode, match.index),
                lineStart: this.getLineNumber(sourceCode, match.index),
                lineEnd: this.getLineNumber(sourceCode, match.index) + 5,
            });
            exports.push(match[1]);
        }

        // Extract classes
        const classRegex = /export\s+class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
        while ((match = classRegex.exec(sourceCode)) !== null) {
            classes.push({
                name: match[1],
                isExported: true,
                methods: [],
                properties: [],
                extends: match[2],
                implements: match[3]?.split(',').map(s => s.trim()),
            });
            exports.push(match[1]);
        }

        return { functions, classes, imports, exports, dependencies };
    }

    private parseParameters(paramString: string): { name: string; type?: string; optional: boolean; defaultValue?: string; }[] {
        if (!paramString.trim()) return [];

        return paramString.split(',').map(param => {
            const parts = param.trim().split(':');
            const nameWithDefault = parts[0].trim();
            const hasDefault = nameWithDefault.includes('=');
            const isOptional = nameWithDefault.includes('?') || hasDefault;

            let name = nameWithDefault.replace('?', '').split('=')[0].trim();
            const defaultValue = hasDefault ? nameWithDefault.split('=')[1]?.trim() : undefined;

            return {
                name,
                type: parts[1]?.split('=')[0]?.trim(),
                optional: isOptional,
                defaultValue,
            };
        });
    }

    private calculateComplexity(code: string, startIndex: number): number {
        const sampleLength = 500;
        const sample = code.slice(startIndex, startIndex + sampleLength);

        let complexity = 1;
        complexity += (sample.match(/if\s*\(/g) || []).length;
        complexity += (sample.match(/else\s*\{/g) || []).length;
        complexity += (sample.match(/for\s*\(/g) || []).length;
        complexity += (sample.match(/while\s*\(/g) || []).length;
        complexity += (sample.match(/switch\s*\(/g) || []).length;
        complexity += (sample.match(/\?\s*[^:]/g) || []).length;
        complexity += (sample.match(/&&|\|\|/g) || []).length;
        complexity += (sample.match(/catch\s*\(/g) || []).length;

        return Math.min(complexity, 20);
    }

    private getLineNumber(code: string, index: number): number {
        return code.slice(0, index).split('\n').length;
    }

    // ============================================
    // UNIT TEST GENERATION
    // ============================================

    async generateUnitTests(request: UnitTestRequest): Promise<UnitTestResult> {
        const framework = request.testFramework || 'vitest';
        const analysis = this.analyzeCode(request.sourceCode);
        const moduleName = this.extractModuleName(request.sourceFile);

        let testCases = '';
        let testCount = 0;

        for (const func of analysis.functions) {
            testCases += this.generateFunctionTestCase(func, request.includeEdgeCases);
            testCount += request.includeEdgeCases ? 3 : 1;
        }

        for (const cls of analysis.classes) {
            testCases += this.generateClassTestCase(cls, request.includeEdgeCases);
            testCount += (cls.methods.length + 1) * (request.includeEdgeCases ? 2 : 1);
        }

        const imports = this.generateTestImports(request.sourceFile, analysis);

        let testCode = UNIT_TEST_TEMPLATE
            .replace('{{MODULE_NAME}}', moduleName)
            .replace('{{IMPORTS}}', imports)
            .replace('{{BEFORE_EACH}}', request.includeMocks ? 'vi.clearAllMocks();' : '')
            .replace('{{AFTER_EACH}}', '')
            .replace('{{TEST_CASES}}', testCases);

        const result: UnitTestResult = {
            testFile: request.sourceFile.replace(/\.(ts|js)$/, `.test.$1`),
            testCode,
            testCount,
        };

        // Generate mocks if requested
        if (request.includeMocks && analysis.dependencies.length > 0) {
            const mockResult = this.generateMocks(moduleName, analysis);
            result.mockFile = `__mocks__/${moduleName}.ts`;
            result.mockCode = mockResult;
        }

        // Generate fixtures if requested
        if (request.includeFixtures) {
            const fixtureResult = this.generateFixtures(moduleName);
            result.fixtureFile = `__fixtures__/${moduleName}.fixtures.ts`;
            result.fixtureCode = fixtureResult;
        }

        return result;
    }

    private extractModuleName(filePath: string): string {
        const fileName = filePath.split(/[/\\]/).pop() || '';
        return fileName.replace(/\.(ts|js|tsx|jsx)$/, '');
    }

    private generateTestImports(sourceFile: string, analysis: CodeAnalysis): string {
        const modulePath = './' + sourceFile.replace(/\.(ts|js)$/, '');
        const exports = analysis.exports.join(', ');
        return `import { ${exports} } from '${modulePath}';`;
    }

    private generateFunctionTestCase(func: FunctionInfo, includeEdgeCases?: boolean): string {
        const asyncPrefix = func.isAsync ? 'async ' : '';
        const awaitPrefix = func.isAsync ? 'await ' : '';

        const params = func.parameters.map(p => this.getDefaultValue(p.type)).join(', ');

        let testCase = TEST_CASE_TEMPLATE
            .replace(/{{FUNCTION_NAME}}/g, func.name)
            .replace('{{TEST_DESCRIPTION}}', `return expected result when called with valid input`)
            .replace('{{ASYNC}}', asyncPrefix)
            .replace('{{ARRANGE}}', `const input = ${params || 'undefined'};`)
            .replace('{{ACT}}', `const result = ${awaitPrefix}${func.name}(${params ? 'input' : ''});`)
            .replace('{{ASSERT}}', 'expect(result).toBeDefined();');

        let edgeCases = '';
        if (includeEdgeCases) {
            // Null/undefined case
            edgeCases += EDGE_CASE_TEMPLATE
                .replace('{{EDGE_CASE_NAME}}', 'null input')
                .replace('{{ASYNC}}', asyncPrefix)
                .replace('{{ARRANGE}}', '')
                .replace('{{ACT_ASSERT}}', func.isAsync
                    ? `await expect(${func.name}(null)).rejects.toThrow();`
                    : `expect(() => ${func.name}(null)).toThrow();`);

            // Empty input case
            edgeCases += EDGE_CASE_TEMPLATE
                .replace('{{EDGE_CASE_NAME}}', 'empty input')
                .replace('{{ASYNC}}', asyncPrefix)
                .replace('{{ARRANGE}}', '')
                .replace('{{ACT_ASSERT}}', `const result = ${awaitPrefix}${func.name}();\n            expect(result).toBeDefined();`);
        }

        return testCase.replace('{{EDGE_CASES}}', edgeCases);
    }

    private generateClassTestCase(cls: ClassInfo, _includeEdgeCases?: boolean): string {
        let testCases = `    describe('${cls.name}', () => {\n`;
        testCases += `        let instance: ${cls.name};\n\n`;
        testCases += `        beforeEach(() => {\n`;
        testCases += `            instance = new ${cls.name}();\n`;
        testCases += `        });\n\n`;

        testCases += `        it('should be instantiated', () => {\n`;
        testCases += `            expect(instance).toBeInstanceOf(${cls.name});\n`;
        testCases += `        });\n`;

        // Add method tests placeholder
        testCases += `\n        // TODO: Add tests for class methods\n`;

        testCases += `    });\n\n`;
        return testCases;
    }

    private getDefaultValue(type?: string): string {
        if (!type) return `'test-value'`;

        const normalizedType = type.toLowerCase().trim();

        if (normalizedType === 'string') return `'test-string'`;
        if (normalizedType === 'number') return '42';
        if (normalizedType === 'boolean') return 'true';
        if (normalizedType.includes('[]')) return '[]';
        if (normalizedType.includes('record') || normalizedType === 'object') return '{}';
        if (normalizedType === 'date') return 'new Date()';
        if (normalizedType === 'null') return 'null';
        if (normalizedType === 'undefined') return 'undefined';

        return '{}';
    }

    private generateMocks(moduleName: string, analysis: CodeAnalysis): string {
        let mockImplementations = '';
        let mockExports = '';
        let mockResets = '';

        for (const func of analysis.functions) {
            const template = func.isAsync ? MOCK_ASYNC_FUNCTION_TEMPLATE : MOCK_FUNCTION_TEMPLATE;
            const returnValue = this.getDefaultValue(func.returnType);

            mockImplementations += template
                .replace('{{FUNCTION_NAME}}', this.toPascalCase(func.name))
                .replace('{{MOCK_IMPLEMENTATION}}', func.isAsync ? '' : `() => ${returnValue}`)
                .replace('{{RETURN_VALUE}}', returnValue);

            mockExports += `    ${func.name}: mock${this.toPascalCase(func.name)},\n`;
            mockResets += `    mock${this.toPascalCase(func.name)}.mockReset();\n`;
        }

        return MOCK_FILE_TEMPLATE
            .replace(/{{MODULE_NAME}}/g, this.toPascalCase(moduleName))
            .replace('{{MOCK_IMPLEMENTATIONS}}', mockImplementations)
            .replace('{{MOCK_EXPORTS}}', mockExports)
            .replace('{{MOCK_RESETS}}', mockResets);
    }

    private generateFixtures(_moduleName: string): string {
        return FIXTURE_FILE_TEMPLATE
            .replace('{{MODULE_NAME}}', '')
            .replace('{{FIXTURE_IMPORTS}}', '')
            .replace('{{SAMPLE_DATA}}', `export const sampleData = {\n    id: '1',\n    name: 'Test',\n    createdAt: new Date(),\n};`)
            .replace('{{FACTORY_FUNCTIONS}}', '');
    }

    // ============================================
    // INTEGRATION TEST GENERATION
    // ============================================

    async generateIntegrationTests(request: IntegrationTestRequest): Promise<IntegrationTestResult> {
        let imports = '';
        let setupVars = '';
        let beforeAll = '';
        let afterAll = '';
        let testCases = '';
        let testCount = 0;

        if (request.database) {
            imports += `import { setupTestDatabase, cleanupTestDatabase } from '../utils/test-db.js';\n`;
            setupVars += `let db: any;\n`;
            beforeAll += `        db = await setupTestDatabase();\n`;
            afterAll += `        await cleanupTestDatabase();\n`;
        }

        if (request.redis) {
            imports += `import { createTestRedis, closeTestRedis } from '../utils/test-redis.js';\n`;
            setupVars += `let redis: any;\n`;
            beforeAll += `        redis = await createTestRedis();\n`;
            afterAll += `        await closeTestRedis();\n`;
        }

        for (const endpoint of request.endpoints || []) {
            testCases += INTEGRATION_TEST_CASE_TEMPLATE
                .replace('{{ENDPOINT_OR_METHOD}}', endpoint)
                .replace('{{TEST_DESCRIPTION}}', `successfully process ${endpoint}`)
                .replace('{{ARRANGE}}', `const request = { /* test data */ };`)
                .replace('{{ACT}}', `const result = await service.${endpoint}(request);`)
                .replace('{{ASSERT}}', `expect(result).toBeDefined();\n            expect(result.success).toBe(true);`)
                .replace('{{ERROR_ARRANGE}}', `const invalidRequest = null;`)
                .replace('{{ERROR_ACT_ASSERT}}', `await expect(service.${endpoint}(invalidRequest)).rejects.toThrow();`);
            testCount += 2;
        }

        const testCode = INTEGRATION_TEST_TEMPLATE
            .replace('{{SERVICE_NAME}}', request.serviceName)
            .replace('{{IMPORTS}}', imports)
            .replace('{{SETUP_VARS}}', setupVars)
            .replace('{{BEFORE_ALL}}', beforeAll)
            .replace('{{AFTER_ALL}}', afterAll)
            .replace('{{BEFORE_EACH}}', '')
            .replace('{{AFTER_EACH}}', '')
            .replace('{{TEST_CASES}}', testCases);

        return {
            testFile: `tests/integration/${this.toKebabCase(request.serviceName)}.integration.test.ts`,
            testCode,
            testCount,
        };
    }

    // ============================================
    // E2E TEST GENERATION (PLAYWRIGHT)
    // ============================================

    async generateE2ETests(request: E2ETestRequest): Promise<E2ETestResult> {
        const framework = request.framework || 'playwright';
        const browsers = request.browsers || ['chromium'];

        // Generate Playwright config
        let browserProjects = '';
        const deviceMap: Record<string, string> = {
            chromium: 'Desktop Chrome',
            firefox: 'Desktop Firefox',
            webkit: 'Desktop Safari',
        };

        for (const browser of browsers) {
            browserProjects += BROWSER_PROJECT_TEMPLATE
                .replace('{{BROWSER}}', browser)
                .replace('{{DEVICE}}', deviceMap[browser] || 'Desktop Chrome');
        }

        const configCode = PLAYWRIGHT_CONFIG_TEMPLATE
            .replace('{{BASE_URL}}', request.pageUrl.replace(/\/[^/]*$/, '') || 'http://localhost:3000')
            .replace('{{SCREENSHOT_MODE}}', request.screenshots ? 'on' : 'off')
            .replace('{{VIDEO_MODE}}', request.video ? 'on' : 'off')
            .replace('{{BROWSER_PROJECTS}}', browserProjects);

        // Generate test cases
        let testCases = '';
        let testCount = 0;

        for (const flow of request.userFlows) {
            let steps = '';

            for (const step of flow.steps) {
                const stepTemplate = E2E_STEP_TEMPLATES[step.action];
                if (stepTemplate) {
                    steps += stepTemplate
                        .replace('{{VALUE}}', step.value || '')
                        .replace('{{SELECTOR}}', step.selector || '')
                        .replace('{{TIMEOUT}}', String(step.timeout || 5000))
                        .replace('{{EXPECTED}}', step.expected || '')
                        .replace('{{ASSERTION}}', step.action === 'assert' ? 'toContainText' : '');
                    steps += '\n';
                }
            }

            testCases += E2E_TEST_CASE_TEMPLATE
                .replace('{{TEST_NAME}}', flow.name)
                .replace('{{STEPS}}', steps);
            testCount++;
        }

        const pageName = this.extractPageName(request.pageUrl);
        const testCode = E2E_TEST_TEMPLATE
            .replace('{{PAGE_NAME}}', pageName)
            .replace('{{PAGE_URL}}', request.pageUrl)
            .replace('{{IMPORTS}}', '')
            .replace('{{TEST_CASES}}', testCases);

        return {
            testFile: `tests/e2e/${this.toKebabCase(pageName)}.spec.ts`,
            testCode,
            configFile: 'playwright.config.ts',
            configCode,
            testCount,
        };
    }

    private extractPageName(url: string): string {
        const path = url.replace(/https?:\/\/[^/]+/, '');
        const parts = path.split('/').filter(Boolean);
        return parts.length > 0 ? this.toPascalCase(parts[parts.length - 1]) : 'Home';
    }

    // ============================================
    // API TEST GENERATION
    // ============================================

    async generateAPITests(requests: APITestRequest[]): Promise<APITestResult> {
        let testCases = '';
        let testCount = 0;

        for (const req of requests) {
            const headers = req.headers
                ? Object.entries(req.headers).map(([k, v]) => `.set('${k}', '${v}')`).join('\n                ')
                : '';

            const body = req.requestBody ? `.send(${JSON.stringify(req.requestBody, null, 8)})` : '';

            const assertions = req.expectedBody
                ? `expect(response.body).toMatchObject(${JSON.stringify(req.expectedBody, null, 12)});`
                : `expect(response.body).toBeDefined();`;

            testCases += API_TEST_CASE_TEMPLATE
                .replace(/{{METHOD}}/g, req.method)
                .replace(/{{METHOD_LOWER}}/g, req.method.toLowerCase())
                .replace(/{{PATH}}/g, req.endpoint)
                .replace('{{HEADERS}}', headers)
                .replace('{{BODY}}', body)
                .replace('{{EXPECTED_STATUS}}', String(req.expectedStatus))
                .replace('{{ASSERTIONS}}', assertions)
                .replace('{{INVALID_BODY}}', '{ invalid: true }')
                .replace('{{AUTH_TEST}}', req.auth ? this.generateAuthTest(req) : '');

            testCount += req.auth ? 3 : 2;
        }

        const endpointName = requests[0]?.endpoint.replace(/^\//, '') || 'api';

        const testCode = API_TEST_TEMPLATE
            .replace('{{ENDPOINT_NAME}}', endpointName)
            .replace('{{IMPORTS}}', `import app from '../src/app.js';`)
            .replace('{{AUTH_VARS}}', '')
            .replace('{{BEFORE_ALL}}', '')
            .replace('{{AFTER_ALL}}', '')
            .replace('{{TEST_CASES}}', testCases);

        return {
            testFile: `tests/api/${this.toKebabCase(endpointName)}.api.test.ts`,
            testCode,
            testCount,
        };
    }

    private generateAuthTest(req: APITestRequest): string {
        return `
        it('should return 401 without authentication', async () => {
            const response = await request
                .${req.method.toLowerCase()}('${req.endpoint}')
                .expect(401);
            
            expect(response.body).toHaveProperty('error');
        });`;
    }

    // ============================================
    // COMPONENT TEST GENERATION
    // ============================================

    async generateComponentTests(request: ComponentTestRequest): Promise<ComponentTestResult> {
        const componentName = this.extractModuleName(request.componentPath);

        let testCases = '';
        let testCount = 0;

        // Render test
        testCases += COMPONENT_TEST_CASE_TEMPLATE
            .replace('{{TEST_DESCRIPTION}}', 'renders without crashing')
            .replace('{{PROPS}}', '')
            .replace('{{ASSERTIONS}}', `expect(screen.getByRole('main')).toBeInTheDocument();`);
        testCount++;

        // Props test
        testCases += COMPONENT_TEST_CASE_TEMPLATE
            .replace('{{TEST_DESCRIPTION}}', 'displays content based on props')
            .replace('{{PROPS}}', '{ testProp: "test-value" }')
            .replace('{{ASSERTIONS}}', `expect(screen.getByText('test-value')).toBeInTheDocument();`);
        testCount++;

        // User interaction test
        if (request.includeUserEvents) {
            testCases += COMPONENT_TEST_CASE_TEMPLATE
                .replace('{{TEST_DESCRIPTION}}', 'handles user interactions')
                .replace('{{PROPS}}', '{ onClick: vi.fn() }')
                .replace('{{ASSERTIONS}}', `const button = screen.getByRole('button');\n        await user.click(button);\n        expect(defaultProps.onClick).toHaveBeenCalled();`);
            testCount++;
        }

        const testCode = REACT_COMPONENT_TEST_TEMPLATE
            .replace(/{{COMPONENT_NAME}}/g, componentName)
            .replace('{{IMPORTS}}', `import ${componentName} from '${request.componentPath.replace(/\.(tsx|jsx)$/, '')}';`)
            .replace('{{DEFAULT_PROPS}}', `// Add default props here`)
            .replace('{{TEST_CASES}}', testCases);

        const result: ComponentTestResult = {
            testFile: request.componentPath.replace(/\.(tsx|jsx)$/, `.test.$1`),
            testCode,
            testCount,
        };

        // Add snapshot test
        if (request.includeSnapshots) {
            result.snapshotFile = request.componentPath.replace(/\.(tsx|jsx)$/, `.snap.$1`);
        }

        return result;
    }

    // ============================================
    // CONFIG GENERATION
    // ============================================

    generateVitestConfig(config: TestConfig): string {
        return VITEST_CONFIG_TEMPLATE
            .replace('{{ENVIRONMENT}}', config.environment || 'node')
            .replace('{{COVERAGE_STATEMENTS}}', String(config.coverageThreshold?.statements || 80))
            .replace('{{COVERAGE_BRANCHES}}', String(config.coverageThreshold?.branches || 80))
            .replace('{{COVERAGE_FUNCTIONS}}', String(config.coverageThreshold?.functions || 80))
            .replace('{{COVERAGE_LINES}}', String(config.coverageThreshold?.lines || 80))
            .replace('{{SETUP_FILES}}', config.setupFiles?.map(f => `'${f}'`).join(', ') || '')
            .replace('{{TEST_TIMEOUT}}', String(config.testTimeout || 10000))
            .replace('{{HOOK_TIMEOUT}}', String(config.testTimeout || 10000))
            .replace('{{MAX_CONCURRENCY}}', String(config.maxConcurrency || 5));
    }

    generateJestConfig(config: TestConfig): string {
        return JEST_CONFIG_TEMPLATE
            .replace('{{ENVIRONMENT}}', config.environment === 'jsdom' ? 'jsdom' : 'node')
            .replace('{{COVERAGE_STATEMENTS}}', String(config.coverageThreshold?.statements || 80))
            .replace('{{COVERAGE_BRANCHES}}', String(config.coverageThreshold?.branches || 80))
            .replace('{{COVERAGE_FUNCTIONS}}', String(config.coverageThreshold?.functions || 80))
            .replace('{{COVERAGE_LINES}}', String(config.coverageThreshold?.lines || 80))
            .replace('{{SETUP_FILES}}', config.setupFiles?.map(f => `'${f}'`).join(', ') || '')
            .replace('{{TEST_TIMEOUT}}', String(config.testTimeout || 10000))
            .replace('{{MAX_CONCURRENCY}}', String(config.maxConcurrency || 5));
    }

    generateTestSetup(): string {
        return TEST_SETUP_TEMPLATE
            .replace('{{IMPORTS}}', '')
            .replace('{{BEFORE_ALL}}', '// Global setup')
            .replace('{{AFTER_ALL}}', '// Global teardown')
            .replace('{{AFTER_EACH}}', 'vi.clearAllMocks();')
            .replace('{{ADDITIONAL_UTILITIES}}', '');
    }

    // ============================================
    // COMPREHENSIVE GENERATION
    // ============================================

    async generate(requirements: string): Promise<TestGenerationResult> {
        const files: GeneratedTestFile[] = [];
        const dependencies = ['vitest'];
        const setupInstructions: string[] = [];
        let totalTests = 0;

        // Analyze requirements
        const lowerReq = requirements.toLowerCase();

        // Determine what to generate
        const needsUnit = lowerReq.includes('unit') || lowerReq.includes('test');
        const needsIntegration = lowerReq.includes('integration') || lowerReq.includes('service');
        const needsE2E = lowerReq.includes('e2e') || lowerReq.includes('end-to-end') || lowerReq.includes('playwright');
        const needsAPI = lowerReq.includes('api') || lowerReq.includes('endpoint');
        const needsComponent = lowerReq.includes('component') || lowerReq.includes('react') || lowerReq.includes('vue');

        // Generate Vitest config
        files.push({
            path: 'vitest.config.ts',
            content: this.generateVitestConfig({
                framework: 'vitest',
                testType: 'unit',
                coverage: true,
                environment: needsComponent ? 'jsdom' : 'node',
            }),
            type: 'config',
            description: 'Vitest configuration',
        });

        // Generate test setup
        files.push({
            path: 'tests/setup.ts',
            content: this.generateTestSetup(),
            type: 'setup',
            description: 'Test setup file',
        });
        setupInstructions.push('Add "tests/setup.ts" to vitest.config.ts setupFiles');

        if (needsE2E) {
            dependencies.push('@playwright/test');

            const e2eResult = await this.generateE2ETests({
                pageUrl: 'http://localhost:3000/',
                userFlows: [
                    {
                        name: 'should load the home page',
                        steps: [
                            { action: 'navigate', value: '/' },
                            { action: 'wait', selector: 'body', timeout: 5000 },
                            { action: 'assert', selector: 'h1', expected: 'Welcome' },
                        ],
                    },
                ],
                browsers: ['chromium'],
                screenshots: true,
            });

            files.push({
                path: e2eResult.testFile,
                content: e2eResult.testCode,
                type: 'test',
                testCount: e2eResult.testCount,
                description: 'E2E test file',
            });

            if (e2eResult.configCode) {
                files.push({
                    path: 'playwright.config.ts',
                    content: e2eResult.configCode,
                    type: 'config',
                    description: 'Playwright configuration',
                });
            }

            totalTests += e2eResult.testCount;
            setupInstructions.push('Run: npx playwright install');
        }

        if (needsAPI) {
            dependencies.push('supertest');

            const apiResult = await this.generateAPITests([
                {
                    endpoint: '/api/health',
                    method: 'GET',
                    expectedStatus: 200,
                },
            ]);

            files.push({
                path: apiResult.testFile,
                content: apiResult.testCode,
                type: 'test',
                testCount: apiResult.testCount,
                description: 'API test file',
            });

            totalTests += apiResult.testCount;
        }

        if (needsComponent) {
            dependencies.push('@testing-library/react', '@testing-library/user-event');
            setupInstructions.push('Add JSDOM setup for component tests');
        }

        setupInstructions.push('Install dependencies: npm install -D ' + dependencies.join(' '));
        setupInstructions.push('Add test script to package.json: "test": "vitest"');
        setupInstructions.push('Add coverage script: "test:coverage": "vitest --coverage"');

        return {
            success: true,
            files,
            totalTests,
            dependencies,
            setupInstructions,
            estimatedCoverage: {
                statements: 80,
                branches: 75,
                functions: 80,
                lines: 80,
            },
        };
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    private toPascalCase(str: string): string {
        return str
            .split(/[-_\s]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    private toKebabCase(str: string): string {
        return str
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase()
            .replace(/^-/, '')
            .replace(/[_\s]+/g, '-');
    }

    // ============================================
    // STATUS
    // ============================================

    getStatus(): TestAgentStatus {
        return {
            initialized: this.isInitialized,
            capabilities: 24,
            supportedFrameworks: this.supportedFrameworks,
            supportedTestTypes: this.supportedTestTypes,
        };
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: TestAgent | null = null;

export function getTestAgent(): TestAgent {
    if (!instance) {
        instance = new TestAgent();
    }
    return instance;
}

export const testAgent = getTestAgent();
