/**
 * Stress Test Script
 * Uses autocannon to benchmark the API server
 */

import autocannon from 'autocannon';

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:3000';

interface BenchmarkResult {
    name: string;
    url: string;
    duration: number;
    requests: {
        total: number;
        average: number;
        sent: number;
    };
    latency: {
        average: number;
        p50: number;
        p90: number;
        p95: number;
        p99: number;
        max: number;
    };
    throughput: {
        average: number;
        total: number;
    };
    errors: number;
    timeouts: number;
    success: boolean;
}

// ============================================
// BENCHMARK FUNCTIONS
// ============================================

/**
 * Run a single benchmark
 */
async function runBenchmark(
    name: string,
    path: string,
    options: {
        duration?: number;
        connections?: number;
        pipelining?: number;
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: unknown;
        headers?: Record<string, string>;
    } = {}
): Promise<BenchmarkResult> {
    const url = `${BASE_URL}${path}`;
    const duration = options.duration || 10;
    const connections = options.connections || 10;

    console.log(`\n🚀 Running benchmark: ${name}`);
    console.log(`   URL: ${url}`);
    console.log(`   Duration: ${duration}s, Connections: ${connections}`);

    return new Promise((resolve) => {
        const instance = autocannon({
            url,
            duration,
            connections,
            pipelining: options.pipelining || 1,
            method: options.method || 'GET',
            body: options.body ? JSON.stringify(options.body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        }, (err: Error | null, result: autocannon.Result) => {
            if (err) {
                console.error(`   ❌ Error: ${err.message}`);
                resolve({
                    name,
                    url,
                    duration,
                    requests: { total: 0, average: 0, sent: 0 },
                    latency: { average: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 },
                    throughput: { average: 0, total: 0 },
                    errors: 1,
                    timeouts: 0,
                    success: false,
                });
                return;
            }

            const benchResult: BenchmarkResult = {
                name,
                url,
                duration: result.duration,
                requests: {
                    total: result.requests.total,
                    average: result.requests.average,
                    sent: result.requests.sent,
                },
                latency: {
                    average: result.latency.average,
                    p50: result.latency.p50,
                    p90: result.latency.p90,
                    p95: result.latency.p95,
                    p99: result.latency.p99,
                    max: result.latency.max,
                },
                throughput: {
                    average: result.throughput.average,
                    total: result.throughput.total,
                },
                errors: result.errors,
                timeouts: result.timeouts,
                success: result.errors === 0 && result.timeouts === 0,
            };

            console.log(`   ✅ Completed: ${result.requests.average.toFixed(2)} req/sec`);
            console.log(`   📊 Latency (avg): ${result.latency.average.toFixed(2)}ms`);
            console.log(`   📊 Latency (p99): ${result.latency.p99.toFixed(2)}ms`);

            resolve(benchResult);
        });

        autocannon.track(instance, { renderProgressBar: true });
    });
}

/**
 * Run health check benchmark
 */
async function benchmarkHealth(): Promise<BenchmarkResult> {
    return runBenchmark('Health Check', '/health', {
        duration: 10,
        connections: 100,
    });
}

/**
 * Run agents list benchmark
 */
async function benchmarkAgents(): Promise<BenchmarkResult> {
    return runBenchmark('List Agents', '/api/v1/agents', {
        duration: 10,
        connections: 50,
    });
}

/**
 * Run orchestrator status benchmark
 */
async function benchmarkOrchestratorStatus(): Promise<BenchmarkResult> {
    return runBenchmark('Orchestrator Status', '/api/v1/orchestrator/status', {
        duration: 10,
        connections: 50,
    });
}

/**
 * Run templates list benchmark
 */
async function benchmarkTemplates(): Promise<BenchmarkResult> {
    return runBenchmark('List Templates', '/api/v1/templates', {
        duration: 10,
        connections: 50,
    });
}

/**
 * Run think analysis benchmark
 */
async function benchmarkThink(): Promise<BenchmarkResult> {
    return runBenchmark('Think Analysis', '/api/v1/orchestrator/think', {
        duration: 10,
        connections: 20,
        method: 'POST',
        body: {
            task: 'Create a JWT authentication system with refresh tokens and rate limiting',
        },
    });
}

// ============================================
// LOAD PROFILES
// ============================================

/**
 * Normal load test (100 req/sec target)
 */
async function normalLoadTest(): Promise<BenchmarkResult[]> {
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 NORMAL LOAD TEST (100 req/sec target)');
    console.log('═══════════════════════════════════════════');

    const results: BenchmarkResult[] = [];
    results.push(await runBenchmark('Health (Normal)', '/health', { connections: 10 }));
    results.push(await runBenchmark('Agents (Normal)', '/api/v1/agents', { connections: 10 }));
    return results;
}

/**
 * High load test (1000 req/sec target)
 */
async function highLoadTest(): Promise<BenchmarkResult[]> {
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 HIGH LOAD TEST (1000 req/sec target)');
    console.log('═══════════════════════════════════════════');

    const results: BenchmarkResult[] = [];
    results.push(await runBenchmark('Health (High)', '/health', { connections: 100 }));
    results.push(await runBenchmark('Agents (High)', '/api/v1/agents', { connections: 50 }));
    return results;
}

/**
 * Peak load test (5000 req/sec target)
 */
async function peakLoadTest(): Promise<BenchmarkResult[]> {
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 PEAK LOAD TEST (5000 req/sec target)');
    console.log('═══════════════════════════════════════════');

    const results: BenchmarkResult[] = [];
    results.push(await runBenchmark('Health (Peak)', '/health', { connections: 500, pipelining: 10 }));
    return results;
}

/**
 * Burst load test (10000 req/sec for 10 seconds)
 */
async function burstLoadTest(): Promise<BenchmarkResult[]> {
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 BURST LOAD TEST (10000 req/sec target)');
    console.log('═══════════════════════════════════════════');

    const results: BenchmarkResult[] = [];
    results.push(await runBenchmark('Health (Burst)', '/health', {
        connections: 1000,
        pipelining: 10,
        duration: 10
    }));
    return results;
}

// ============================================
// REPORT GENERATION
// ============================================

/**
 * Generate summary report
 */
function generateReport(results: BenchmarkResult[]): void {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                        📊 STRESS TEST REPORT                         ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Server: ${BASE_URL}`);
    console.log(`Date: ${new Date().toISOString()}`);
    console.log('───────────────────────────────────────────────────────────────────');

    console.log('\n📈 RESULTS BY ENDPOINT:\n');

    for (const result of results) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.name}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Requests: ${result.requests.total} total, ${result.requests.average.toFixed(2)} req/sec`);
        console.log(`   Latency:  avg=${result.latency.average.toFixed(2)}ms, p99=${result.latency.p99.toFixed(2)}ms, max=${result.latency.max.toFixed(2)}ms`);
        console.log(`   Errors:   ${result.errors} errors, ${result.timeouts} timeouts`);
        console.log('');
    }

    // Summary stats
    const totalRequests = results.reduce((sum, r) => sum + r.requests.total, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const avgLatency = results.reduce((sum, r) => sum + r.latency.average, 0) / results.length;
    const avgReqSec = results.reduce((sum, r) => sum + r.requests.average, 0) / results.length;

    console.log('───────────────────────────────────────────────────────────────────');
    console.log('📊 SUMMARY:');
    console.log(`   Total Requests: ${totalRequests.toLocaleString()}`);
    console.log(`   Total Errors:   ${totalErrors}`);
    console.log(`   Avg Latency:    ${avgLatency.toFixed(2)}ms`);
    console.log(`   Avg Throughput: ${avgReqSec.toFixed(2)} req/sec`);
    console.log('═══════════════════════════════════════════════════════════════════');
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('           🚀 LOVEABLE BACKEND STRESS TEST SUITE                    ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Target: ${BASE_URL}`);
    console.log('');

    const allResults: BenchmarkResult[] = [];

    // Run individual endpoint benchmarks
    console.log('\n📊 INDIVIDUAL ENDPOINT BENCHMARKS\n');
    allResults.push(await benchmarkHealth());
    allResults.push(await benchmarkAgents());
    allResults.push(await benchmarkOrchestratorStatus());
    allResults.push(await benchmarkTemplates());
    allResults.push(await benchmarkThink());

    // Run load profile tests
    const normalResults = await normalLoadTest();
    const highResults = await highLoadTest();
    const peakResults = await peakLoadTest();
    const burstResults = await burstLoadTest();

    allResults.push(...normalResults, ...highResults, ...peakResults, ...burstResults);

    // Generate report
    generateReport(allResults);
}

// Run if called directly
main().catch(console.error);

export {
    runBenchmark,
    benchmarkHealth,
    benchmarkAgents,
    benchmarkOrchestratorStatus,
    benchmarkTemplates,
    benchmarkThink,
    normalLoadTest,
    highLoadTest,
    peakLoadTest,
    burstLoadTest,
    generateReport,
};
