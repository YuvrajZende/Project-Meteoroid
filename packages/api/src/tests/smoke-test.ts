/**
 * Smoke Test Script
 * Manual validation script for testing the API server
 * 
 * Run with: npm run smoke-test
 * Requires: Server running on localhost:3000
 */

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:3000';

interface TestResult {
    name: string;
    endpoint: string;
    method: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    statusCode?: number;
    duration: number;
    error?: string;
    response?: unknown;
}

const results: TestResult[] = [];

// ============================================
// HTTP HELPER
// ============================================

async function request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
): Promise<{ status: number; data: unknown; duration: number }> {
    const start = Date.now();

    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        return {
            status: response.status,
            data,
            duration: Date.now() - start,
        };
    } catch (error) {
        return {
            status: 0,
            data: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - start,
        };
    }
}

// ============================================
// TEST RUNNER
// ============================================

async function runTest(
    name: string,
    endpoint: string,
    method: string,
    expectedStatus: number,
    body?: unknown,
    validator?: (data: unknown) => boolean
): Promise<void> {
    process.stdout.write(`  Testing: ${name}... `);

    const { status, data, duration } = await request(method, endpoint, body);

    const result: TestResult = {
        name,
        endpoint,
        method,
        status: 'FAIL',
        statusCode: status,
        duration,
    };

    if (status === 0) {
        result.status = 'FAIL';
        result.error = 'Connection failed - is the server running?';
    } else if (status === expectedStatus) {
        if (validator) {
            if (validator(data)) {
                result.status = 'PASS';
            } else {
                result.status = 'FAIL';
                result.error = 'Response validation failed';
            }
        } else {
            result.status = 'PASS';
        }
    } else {
        result.status = 'FAIL';
        result.error = `Expected ${expectedStatus}, got ${status}`;
    }

    result.response = data;
    results.push(result);

    if (result.status === 'PASS') {
        console.log(`✅ PASS (${duration}ms)`);
    } else {
        console.log(`❌ FAIL - ${result.error}`);
    }
}

// ============================================
// SMOKE TESTS
// ============================================

async function runSmokeTests(): Promise<void> {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                     🔥 SMOKE TEST SUITE                            ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Target Server: ${BASE_URL}`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('───────────────────────────────────────────────────────────────────\n');

    // ============================================
    // 1. HEALTH CHECKS
    // ============================================
    console.log('📋 HEALTH CHECKS\n');

    await runTest(
        'Health Endpoint',
        '/health',
        'GET',
        200,
        undefined,
        (data: unknown) => {
            const d = data as { status?: string };
            return d.status === 'healthy';
        }
    );

    await runTest(
        'Metrics Endpoint',
        '/metrics',
        'GET',
        200
    );

    // ============================================
    // 2. AGENT DISCOVERY
    // ============================================
    console.log('\n📋 AGENT DISCOVERY\n');

    await runTest(
        'List All Agents',
        '/api/v1/agents',
        'GET',
        200,
        undefined,
        (data: unknown) => {
            const d = data as { agents?: unknown[] };
            return Array.isArray(d.agents);
        }
    );

    await runTest(
        'Agent Not Found (404)',
        '/api/v1/agents/non-existent-agent',
        'GET',
        404
    );

    // ============================================
    // 3. ORCHESTRATOR
    // ============================================
    console.log('\n📋 ORCHESTRATOR\n');

    await runTest(
        'Orchestrator Status',
        '/api/v1/orchestrator/status',
        'GET',
        200,
        undefined,
        (data: unknown) => {
            const d = data as { services?: unknown };
            return d.services !== undefined;
        }
    );

    await runTest(
        'List Orchestrator Agents',
        '/api/v1/orchestrator/agents',
        'GET',
        200,
        undefined,
        (data: unknown) => {
            const d = data as { agents?: unknown[]; summary?: unknown };
            return d.agents !== undefined && d.summary !== undefined;
        }
    );

    await runTest(
        'Think Analysis',
        '/api/v1/orchestrator/think',
        'POST',
        200,
        { task: 'Create a JWT authentication system with refresh tokens' },
        (data: unknown) => {
            const d = data as { analysis?: { suggestedAgents?: unknown[] } };
            return d.analysis !== undefined;
        }
    );

    await runTest(
        'Think - Invalid (Too Short)',
        '/api/v1/orchestrator/think',
        'POST',
        400,
        { task: 'hi' }
    );

    await runTest(
        'Get Project Context',
        '/api/v1/orchestrator/context/smoke-test-project',
        'GET',
        200,
        undefined,
        (data: unknown) => {
            const d = data as { projectId?: string };
            return d.projectId === 'smoke-test-project';
        }
    );

    // ============================================
    // 4. TASK EXECUTION
    // ============================================
    console.log('\n📋 TASK EXECUTION\n');

    await runTest(
        'Execute Simple Task',
        '/api/v1/orchestrator/execute',
        'POST',
        200,
        {
            prompt: 'Create a simple hello world function',
            projectId: 'smoke-test-execution',
        },
        (data: unknown) => {
            const d = data as { taskId?: string; success?: boolean };
            return d.taskId !== undefined;
        }
    );

    // ============================================
    // 5. TEMPLATES
    // ============================================
    console.log('\n📋 TEMPLATES\n');

    await runTest(
        'List Templates',
        '/api/v1/templates',
        'GET',
        200
    );

    // ============================================
    // 6. ERROR HANDLING
    // ============================================
    console.log('\n📋 ERROR HANDLING\n');

    await runTest(
        'Malformed JSON',
        '/api/v1/orchestrator/execute',
        'POST',
        400,
        '{ invalid json }'
    );

    await runTest(
        'Unknown Route (404)',
        '/api/v1/this/does/not/exist',
        'GET',
        404
    );

    // ============================================
    // RESULTS SUMMARY
    // ============================================
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                        📊 RESULTS SUMMARY                          ');
    console.log('═══════════════════════════════════════════════════════════════════');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    const total = results.length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;

    console.log(`\n  Total Tests:  ${total}`);
    console.log(`  ✅ Passed:    ${passed}`);
    console.log(`  ❌ Failed:    ${failed}`);
    console.log(`  ⏭️ Skipped:   ${skipped}`);
    console.log(`  ⏱️ Avg Time:  ${avgDuration.toFixed(2)}ms`);

    console.log('\n───────────────────────────────────────────────────────────────────');

    if (failed > 0) {
        console.log('\n❌ FAILED TESTS:\n');
        results
            .filter(r => r.status === 'FAIL')
            .forEach(r => {
                console.log(`  • ${r.name}`);
                console.log(`    Endpoint: ${r.method} ${r.endpoint}`);
                console.log(`    Error: ${r.error}`);
                console.log('');
            });
    }

    console.log('═══════════════════════════════════════════════════════════════════');

    if (failed === 0) {
        console.log('\n🎉 ALL SMOKE TESTS PASSED!\n');
        process.exit(0);
    } else {
        console.log(`\n⚠️ ${failed} TEST(S) FAILED - Review above for details\n`);
        process.exit(1);
    }
}

// Run tests
runSmokeTests().catch(error => {
    console.error('Smoke test failed:', error);
    process.exit(1);
});
