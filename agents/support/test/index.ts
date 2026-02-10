/**
 * Test Agent Module Exports
 * 
 * Provides comprehensive test generation capabilities:
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

// ============================================
// CORE EXPORTS
// ============================================

export {
    TestAgent,
    testAgent,
    getTestAgent,
} from './test-agent.js';

// ============================================
// IAGENT INTERFACE
// ============================================

export {
    TestAgentWrapper,
    testAgentIAgent,
    getTestAgentWrapper,
} from './test-agent-iagent.js';

// ============================================
// TYPES
// ============================================

export type {
    // Framework types
    TestFramework,
    TestType,
    CoverageFormat,

    // Configuration
    TestConfig,
    CoverageThreshold,

    // Unit tests
    UnitTestRequest,
    UnitTestResult,
    MockConfig,
    MockFunction,

    // Integration tests
    IntegrationTestRequest,
    IntegrationTestResult,

    // E2E tests
    E2ETestRequest,
    E2ETestResult,
    UserFlow,
    FlowStep,

    // API tests
    APITestRequest,
    APITestResult,

    // Component tests
    ComponentTestRequest,
    ComponentTestResult,

    // Results
    TestGenerationResult,
    GeneratedTestFile,

    // Analysis
    CodeAnalysis,
    FunctionInfo,
    ClassInfo,
    ParameterInfo,
    PropertyInfo,

    // Status
    TestAgentStatus,
} from './types.js';

// ============================================
// TEMPLATES
// ============================================

export {
    // Config templates
    VITEST_CONFIG_TEMPLATE,
    JEST_CONFIG_TEMPLATE,
    PLAYWRIGHT_CONFIG_TEMPLATE,

    // Unit test templates
    UNIT_TEST_TEMPLATE,
    TEST_CASE_TEMPLATE,
    EDGE_CASE_TEMPLATE,

    // Mock templates
    MOCK_FILE_TEMPLATE,
    MOCK_FUNCTION_TEMPLATE,
    MOCK_ASYNC_FUNCTION_TEMPLATE,

    // Fixture templates
    FIXTURE_FILE_TEMPLATE,
    FACTORY_FUNCTION_TEMPLATE,

    // Integration test templates
    INTEGRATION_TEST_TEMPLATE,
    INTEGRATION_TEST_CASE_TEMPLATE,

    // API test templates
    API_TEST_TEMPLATE,
    API_TEST_CASE_TEMPLATE,

    // E2E test templates
    E2E_TEST_TEMPLATE,
    E2E_TEST_CASE_TEMPLATE,
    E2E_STEP_TEMPLATES,
    BROWSER_PROJECT_TEMPLATE,
    PAGE_OBJECT_TEMPLATE,

    // Component test templates
    REACT_COMPONENT_TEST_TEMPLATE,
    COMPONENT_TEST_CASE_TEMPLATE,
    SNAPSHOT_TEST_TEMPLATE,

    // Setup templates
    TEST_SETUP_TEMPLATE,
    DATABASE_TEST_UTILS_TEMPLATE,

    // All templates collection
    ALL_TEMPLATES,
} from './templates/index.js';

// ============================================
// AGENT CAPABILITIES
// ============================================

/**
 * Test Agent Capabilities
 * Used for capability-based agent routing
 */
export const TEST_AGENT_CAPABILITIES = [
    // Frameworks
    'vitest',
    'jest',
    'mocha',
    'playwright',
    'cypress',

    // Test types
    'unit-tests',
    'integration-tests',
    'e2e-tests',
    'api-tests',
    'component-tests',
    'snapshot-testing',

    // Features
    'mock-generation',
    'fixture-generation',
    'test-fixtures',
    'coverage-analysis',
    'coverage-reports',

    // UI testing
    'visual-regression',
    'accessibility-testing',
    'user-event-testing',
    'page-object-model',

    // Code analysis
    'code-analysis',
    'test-discovery',
    'test-scaffolding',
] as const;

export type TestAgentCapability = typeof TEST_AGENT_CAPABILITIES[number];
