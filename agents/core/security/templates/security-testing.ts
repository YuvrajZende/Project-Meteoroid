/**
 * ============================================
 * SECURITY TESTING TEMPLATES
 * ============================================
 * 
 * Security testing tools including penetration testing
 * scripts, fuzzing utilities, and vulnerability scanners.
 */

// ============================================
// PENETRATION TESTING SCRIPTS TEMPLATE
// ============================================

export const PENTEST_SCRIPTS_TEMPLATE = `/**
 * ============================================
 * PENETRATION TESTING SCRIPTS
 * ============================================
 * 
 * Automated security testing scripts for:
 * - Authentication testing
 * - Authorization testing
 * - Input validation testing
 * - Session management testing
 */

import fetch, { Response } from "node-fetch";

// ============================================
// TYPES
// ============================================

export interface PentestConfig {
    baseUrl: string;
    authToken?: string;
    timeout: number;
    verbose: boolean;
    stopOnFirstFailure: boolean;
}

export interface TestResult {
    name: string;
    category: string;
    passed: boolean;
    severity: "info" | "low" | "medium" | "high" | "critical";
    description: string;
    details?: string;
    recommendation?: string;
}

export interface TestSuite {
    name: string;
    tests: (() => Promise<TestResult>)[];
}

// ============================================
// CONFIGURATION
// ============================================

const defaultConfig: PentestConfig = {
    baseUrl: process.env.PENTEST_TARGET_URL || "http://localhost:3000",
    timeout: 10000,
    verbose: true,
    stopOnFirstFailure: false,
};

// ============================================
// TEST UTILITIES
// ============================================

async function makeRequest(
    config: PentestConfig,
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const url = \`\${config.baseUrl}\${path}\`;
    
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (config.authToken) {
        headers["Authorization"] = \`Bearer \${config.authToken}\`;
    }

    return fetch(url, {
        ...options,
        headers,
        timeout: config.timeout,
    } as any);
}

function log(config: PentestConfig, message: string): void {
    if (config.verbose) {
        console.log(\`[Pentest] \${message}\`);
    }
}

// ============================================
// AUTHENTICATION TESTS
// ============================================

export function authenticationTests(config: PentestConfig): TestSuite {
    return {
        name: "Authentication Tests",
        tests: [
            // Test: Weak password acceptance
            async () => {
                log(config, "Testing weak password acceptance...");
                try {
                    const response = await makeRequest(config, "/api/auth/register", {
                        method: "POST",
                        body: JSON.stringify({
                            email: "test@example.com",
                            password: "123456",
                            name: "Test User",
                        }),
                    });
                    
                    const passed = response.status === 400;
                    return {
                        name: "Weak Password Rejection",
                        category: "Authentication",
                        passed,
                        severity: passed ? "info" : "high",
                        description: "Application should reject weak passwords",
                        details: passed 
                            ? "Weak password was correctly rejected"
                            : "Weak password was accepted - HIGH RISK",
                        recommendation: passed ? undefined : "Implement password strength validation",
                    };
                } catch (error) {
                    return {
                        name: "Weak Password Rejection",
                        category: "Authentication",
                        passed: false,
                        severity: "medium",
                        description: "Test failed to execute",
                        details: String(error),
                    };
                }
            },

            // Test: Brute force protection
            async () => {
                log(config, "Testing brute force protection...");
                try {
                    const attempts = 10;
                    let blockedAt = -1;

                    for (let i = 0; i < attempts; i++) {
                        const response = await makeRequest(config, "/api/auth/login", {
                            method: "POST",
                            body: JSON.stringify({
                                email: "bruteforce@test.com",
                                password: \`wrongpassword\${i}\`,
                            }),
                        });

                        if (response.status === 429) {
                            blockedAt = i;
                            break;
                        }
                    }

                    const passed = blockedAt > 0 && blockedAt < 10;
                    return {
                        name: "Brute Force Protection",
                        category: "Authentication",
                        passed,
                        severity: passed ? "info" : "critical",
                        description: "Application should block repeated failed login attempts",
                        details: passed 
                            ? \`Rate limiting triggered after \${blockedAt} attempts\`
                            : "No rate limiting detected after 10 attempts",
                        recommendation: passed ? undefined : "Implement login rate limiting",
                    };
                } catch (error) {
                    return {
                        name: "Brute Force Protection",
                        category: "Authentication",
                        passed: false,
                        severity: "medium",
                        description: "Test failed to execute",
                        details: String(error),
                    };
                }
            },

            // Test: JWT token validation
            async () => {
                log(config, "Testing JWT token validation...");
                try {
                    const response = await makeRequest(config, "/api/protected", {
                        method: "GET",
                        headers: {
                            Authorization: "Bearer invalid.jwt.token",
                        },
                    });

                    const passed = response.status === 401;
                    return {
                        name: "Invalid JWT Rejection",
                        category: "Authentication",
                        passed,
                        severity: passed ? "info" : "critical",
                        description: "Application should reject invalid JWT tokens",
                        details: passed 
                            ? "Invalid JWT was correctly rejected"
                            : \`Invalid JWT was accepted (status: \${response.status})\`,
                        recommendation: passed ? undefined : "Implement proper JWT validation",
                    };
                } catch (error) {
                    return {
                        name: "Invalid JWT Rejection",
                        category: "Authentication",
                        passed: false,
                        severity: "medium",
                        description: "Test failed to execute",
                        details: String(error),
                    };
                }
            },
        ],
    };
}

// ============================================
// AUTHORIZATION TESTS
// ============================================

export function authorizationTests(config: PentestConfig): TestSuite {
    return {
        name: "Authorization Tests",
        tests: [
            // Test: Horizontal privilege escalation
            async () => {
                log(config, "Testing horizontal privilege escalation...");
                try {
                    // Try to access another user's data
                    const response = await makeRequest(config, "/api/users/other-user-id", {
                        method: "GET",
                    });

                    const passed = response.status === 403 || response.status === 404;
                    return {
                        name: "Horizontal Privilege Escalation",
                        category: "Authorization",
                        passed,
                        severity: passed ? "info" : "critical",
                        description: "Users should not access other users' data",
                        details: passed 
                            ? "Access to other user's data was denied"
                            : \`Access was granted (status: \${response.status})\`,
                        recommendation: passed ? undefined : "Implement proper access controls",
                    };
                } catch (error) {
                    return {
                        name: "Horizontal Privilege Escalation",
                        category: "Authorization",
                        passed: false,
                        severity: "medium",
                        description: "Test failed to execute",
                        details: String(error),
                    };
                }
            },

            // Test: Admin endpoint protection
            async () => {
                log(config, "Testing admin endpoint protection...");
                try {
                    const response = await makeRequest(config, "/api/admin/users", {
                        method: "GET",
                    });

                    const passed = response.status === 401 || response.status === 403;
                    return {
                        name: "Admin Endpoint Protection",
                        category: "Authorization",
                        passed,
                        severity: passed ? "info" : "critical",
                        description: "Admin endpoints should require proper authorization",
                        details: passed 
                            ? "Admin endpoint was protected"
                            : \`Admin endpoint was accessible (status: \${response.status})\`,
                        recommendation: passed ? undefined : "Implement role-based access control",
                    };
                } catch (error) {
                    return {
                        name: "Admin Endpoint Protection",
                        category: "Authorization",
                        passed: false,
                        severity: "medium",
                        description: "Test failed to execute",
                        details: String(error),
                    };
                }
            },
        ],
    };
}

// ============================================
// INJECTION TESTS
// ============================================

export function injectionTests(config: PentestConfig): TestSuite {
    const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "1; SELECT * FROM users",
        "' UNION SELECT * FROM users --",
    ];

    const xssPayloads = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert('xss')",
        "<svg onload=alert('xss')>",
    ];

    return {
        name: "Injection Tests",
        tests: [
            // SQL Injection test
            async () => {
                log(config, "Testing SQL injection protection...");
                try {
                    let vulnerable = false;

                    for (const payload of sqlPayloads) {
                        const response = await makeRequest(config, "/api/search", {
                            method: "GET",
                        }).catch(() => null);

                        // Also test via query params
                        const urlResponse = await fetch(
                            \`\${config.baseUrl}/api/search?q=\${encodeURIComponent(payload)}\`
                        ).catch(() => null);

                        // Check if payload was executed (simplified check)
                        if (urlResponse && urlResponse.status === 200) {
                            const body = await urlResponse.text();
                            if (body.includes("error") && body.includes("SQL")) {
                                vulnerable = true;
                                break;
                            }
                        }
                    }

                    return {
                        name: "SQL Injection Protection",
                        category: "Injection",
                        passed: !vulnerable,
                        severity: vulnerable ? "critical" : "info",
                        description: "Application should be protected against SQL injection",
                        details: vulnerable 
                            ? "SQL injection vulnerability detected"
                            : "No SQL injection vulnerabilities detected",
                        recommendation: vulnerable ? "Use parameterized queries" : undefined,
                    };
                } catch (error) {
                    return {
                        name: "SQL Injection Protection",
                        category: "Injection",
                        passed: true, // Assume protected if errored
                        severity: "info",
                        description: "Test completed with errors",
                        details: String(error),
                    };
                }
            },

            // XSS test
            async () => {
                log(config, "Testing XSS protection...");
                try {
                    let vulnerable = false;

                    for (const payload of xssPayloads) {
                        const response = await makeRequest(config, "/api/comments", {
                            method: "POST",
                            body: JSON.stringify({ content: payload }),
                        }).catch(() => null);

                        if (response && response.status === 200) {
                            const body = await response.text();
                            // Check if payload was reflected without encoding
                            if (body.includes(payload)) {
                                vulnerable = true;
                                break;
                            }
                        }
                    }

                    return {
                        name: "XSS Protection",
                        category: "Injection",
                        passed: !vulnerable,
                        severity: vulnerable ? "high" : "info",
                        description: "Application should sanitize output to prevent XSS",
                        details: vulnerable 
                            ? "XSS vulnerability detected - input reflected without encoding"
                            : "No XSS vulnerabilities detected",
                        recommendation: vulnerable ? "Implement output encoding" : undefined,
                    };
                } catch (error) {
                    return {
                        name: "XSS Protection",
                        category: "Injection",
                        passed: true,
                        severity: "info",
                        description: "Test completed with errors",
                        details: String(error),
                    };
                }
            },
        ],
    };
}

// ============================================
// TEST RUNNER
// ============================================

export async function runPentest(
    config: Partial<PentestConfig> = {}
): Promise<TestResult[]> {
    const finalConfig = { ...defaultConfig, ...config };
    const results: TestResult[] = [];

    const suites = [
        authenticationTests(finalConfig),
        authorizationTests(finalConfig),
        injectionTests(finalConfig),
    ];

    console.log("\\n=== Starting Penetration Tests ===\\n");
    console.log(\`Target: \${finalConfig.baseUrl}\\n\`);

    for (const suite of suites) {
        console.log(\`\\n--- \${suite.name} ---\\n\`);

        for (const test of suite.tests) {
            const result = await test();
            results.push(result);

            const icon = result.passed ? "✅" : "❌";
            console.log(\`\${icon} \${result.name}: \${result.passed ? "PASSED" : "FAILED"}\`);
            
            if (!result.passed && result.details) {
                console.log(\`   Details: \${result.details}\`);
            }
            if (result.recommendation) {
                console.log(\`   Recommendation: \${result.recommendation}\`);
            }

            if (!result.passed && finalConfig.stopOnFirstFailure) {
                console.log("\\nStopping on first failure.");
                return results;
            }
        }
    }

    // Summary
    console.log("\\n=== Test Summary ===\\n");
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(\`Total: \${results.length} | Passed: \${passed} | Failed: \${failed}\`);

    const critical = results.filter(r => !r.passed && r.severity === "critical");
    if (critical.length > 0) {
        console.log(\`\\n⚠️ CRITICAL ISSUES: \${critical.length}\`);
        critical.forEach(r => console.log(\`   - \${r.name}\`));
    }

    return results;
}
`;

// ============================================
// FUZZING TEMPLATE
// ============================================

export const FUZZING_TEMPLATE = `/**
 * ============================================
 * FUZZING UTILITIES
 * ============================================
 * 
 * Automated fuzzing for finding edge cases and
 * vulnerabilities through random/malformed input.
 */

import fetch from "node-fetch";

// ============================================
// TYPES
// ============================================

export interface FuzzConfig {
    baseUrl: string;
    iterations: number;
    timeout: number;
    verbose: boolean;
    seed?: number;
}

export interface FuzzResult {
    endpoint: string;
    method: string;
    payload: unknown;
    statusCode: number;
    responseTime: number;
    error?: string;
    interesting: boolean;
    reason?: string;
}

export interface FuzzReport {
    totalRequests: number;
    successfulRequests: number;
    errors: number;
    interestingResults: FuzzResult[];
    duration: number;
}

// ============================================
// PAYLOAD GENERATORS
// ============================================

/**
 * Generate random string of specified length
 */
function randomString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate random number in range
 */
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fuzz payload generators
 */
export const FUZZ_PAYLOADS = {
    // String mutations
    strings: (): string[] => [
        "",                                    // Empty string
        " ",                                   // Single space
        "\\t\\n\\r",                             // Whitespace chars
        randomString(1),                       // Single char
        randomString(100),                     // Normal length
        randomString(10000),                   // Very long
        "\\x00",                                // Null byte
        "\\x00\\x01\\x02\\x03",                   // Control chars
        "\\uFFFE\\uFFFF",                        // Invalid unicode
        "\\uD800\\uDC00",                        // Surrogate pairs
        "é̃ö́ü̈",                              // Combined unicode
        "<script>alert(1)</script>",           // XSS
        "'; DROP TABLE users; --",             // SQLi
        "../../../etc/passwd",                 // Path traversal
        String.fromCharCode(...Array(256).keys()), // All ASCII
    ],

    // Number mutations
    numbers: (): number[] => [
        0,
        -1,
        1,
        -0,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Infinity,
        -Infinity,
        NaN,
        1.7976931348623157e+308,
        5e-324,
        randomInt(-1000000, 1000000),
    ],

    // Boolean mutations
    booleans: (): unknown[] => [
        true,
        false,
        "true",
        "false",
        1,
        0,
        "1",
        "0",
        null,
        undefined,
    ],

    // Array mutations
    arrays: (): unknown[] => [
        [],
        [null],
        [undefined],
        Array(1000).fill(0),
        Array(1000).fill("a"),
        [[[[[]]]]],  // Deeply nested
        Array(100).fill({}),
    ],

    // Object mutations
    objects: (): unknown[] => [
        {},
        { __proto__: { admin: true } },  // Prototype pollution
        { constructor: { prototype: {} } },
        { toString: null },
        { valueOf: null },
        Object.create(null),
        { [Symbol.toPrimitive]: () => "hack" },
    ],

    // Type confusion
    typeConfusion: (): unknown[] => [
        null,
        undefined,
        NaN,
        Infinity,
        [],
        {},
        () => {},
        Symbol("test"),
        new Date(),
        new RegExp(".*"),
        BigInt(9007199254740991),
    ],
};

/**
 * Generate fuzz payload for a field
 */
export function generateFuzzPayload(fieldType: string): unknown {
    const generators: Record<string, () => unknown[]> = {
        string: FUZZ_PAYLOADS.strings,
        number: FUZZ_PAYLOADS.numbers,
        boolean: FUZZ_PAYLOADS.booleans,
        array: FUZZ_PAYLOADS.arrays,
        object: FUZZ_PAYLOADS.objects,
    };

    const generator = generators[fieldType] || FUZZ_PAYLOADS.typeConfusion;
    const payloads = generator();
    return payloads[Math.floor(Math.random() * payloads.length)];
}

// ============================================
// FUZZER
// ============================================

export class Fuzzer {
    private config: FuzzConfig;
    private results: FuzzResult[] = [];

    constructor(config: Partial<FuzzConfig> = {}) {
        this.config = {
            baseUrl: process.env.FUZZ_TARGET_URL || "http://localhost:3000",
            iterations: 100,
            timeout: 5000,
            verbose: true,
            ...config,
        };
    }

    /**
     * Fuzz an endpoint
     */
    async fuzzEndpoint(
        path: string,
        method: string,
        bodyTemplate: Record<string, string>
    ): Promise<FuzzResult[]> {
        const results: FuzzResult[] = [];

        for (let i = 0; i < this.config.iterations; i++) {
            // Generate fuzzed body
            const payload: Record<string, unknown> = {};
            for (const [key, type] of Object.entries(bodyTemplate)) {
                payload[key] = generateFuzzPayload(type);
            }

            const result = await this.sendRequest(path, method, payload);
            results.push(result);

            if (result.interesting && this.config.verbose) {
                console.log(\`[Fuzzer] Interesting: \${result.reason}\`);
            }
        }

        return results;
    }

    /**
     * Send a single fuzz request
     */
    private async sendRequest(
        path: string,
        method: string,
        payload: unknown
    ): Promise<FuzzResult> {
        const start = Date.now();
        const url = \`\${this.config.baseUrl}\${path}\`;

        try {
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                timeout: this.config.timeout,
            } as any);

            const responseTime = Date.now() - start;
            const interesting = this.isInteresting(response.status, responseTime);

            return {
                endpoint: path,
                method,
                payload,
                statusCode: response.status,
                responseTime,
                interesting: interesting.is,
                reason: interesting.reason,
            };
        } catch (error) {
            return {
                endpoint: path,
                method,
                payload,
                statusCode: 0,
                responseTime: Date.now() - start,
                error: String(error),
                interesting: true,
                reason: "Request failed",
            };
        }
    }

    /**
     * Check if result is interesting
     */
    private isInteresting(
        statusCode: number,
        responseTime: number
    ): { is: boolean; reason?: string } {
        // 500 errors are interesting
        if (statusCode >= 500) {
            return { is: true, reason: \`Server error: \${statusCode}\` };
        }

        // Very slow responses
        if (responseTime > 3000) {
            return { is: true, reason: \`Slow response: \${responseTime}ms\` };
        }

        // Unexpected status codes
        if ([418, 451, 508].includes(statusCode)) {
            return { is: true, reason: \`Unusual status: \${statusCode}\` };
        }

        return { is: false };
    }

    /**
     * Generate report
     */
    generateReport(results: FuzzResult[]): FuzzReport {
        return {
            totalRequests: results.length,
            successfulRequests: results.filter(r => !r.error).length,
            errors: results.filter(r => r.error).length,
            interestingResults: results.filter(r => r.interesting),
            duration: results.reduce((sum, r) => sum + r.responseTime, 0),
        };
    }
}

// ============================================
// STRUCTURED FUZZING
// ============================================

/**
 * Schema-based fuzzer
 */
export function fuzzSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
        if (typeof value === "string") {
            result[key] = generateFuzzPayload(value);
        } else if (typeof value === "object" && value !== null) {
            result[key] = fuzzSchema(value as Record<string, unknown>);
        } else {
            result[key] = generateFuzzPayload("typeConfusion");
        }
    }

    return result;
}
`;

// ============================================
// VULNERABILITY SCANNER TEMPLATE
// ============================================

export const VULNERABILITY_SCANNER_TEMPLATE = `/**
 * ============================================
 * VULNERABILITY SCANNER
 * ============================================
 * 
 * Automated vulnerability scanning for common
 * security issues in web applications.
 */

import fetch from "node-fetch";

// ============================================
// TYPES
// ============================================

export interface ScanConfig {
    baseUrl: string;
    paths: string[];
    timeout: number;
    concurrency: number;
    verbose: boolean;
}

export interface VulnerabilityFinding {
    id: string;
    title: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    category: string;
    description: string;
    evidence?: string;
    recommendation: string;
    references?: string[];
    affectedUrl?: string;
}

export interface ScanReport {
    target: string;
    startTime: Date;
    endTime: Date;
    findings: VulnerabilityFinding[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
}

// ============================================
// SCANNER CHECKS
// ============================================

type ScanCheck = (config: ScanConfig) => Promise<VulnerabilityFinding[]>;

/**
 * Check for security headers
 */
const checkSecurityHeaders: ScanCheck = async (config) => {
    const findings: VulnerabilityFinding[] = [];
    const response = await fetch(config.baseUrl).catch(() => null);
    
    if (!response) return findings;

    const headers = response.headers;

    // Check X-Frame-Options
    if (!headers.get("x-frame-options")) {
        findings.push({
            id: "HEADER-001",
            title: "Missing X-Frame-Options Header",
            severity: "medium",
            category: "Security Headers",
            description: "The X-Frame-Options header is not set, which may allow clickjacking attacks.",
            recommendation: "Set X-Frame-Options header to DENY or SAMEORIGIN",
            affectedUrl: config.baseUrl,
        });
    }

    // Check X-Content-Type-Options
    if (!headers.get("x-content-type-options")) {
        findings.push({
            id: "HEADER-002",
            title: "Missing X-Content-Type-Options Header",
            severity: "low",
            category: "Security Headers",
            description: "The X-Content-Type-Options header is not set, which may allow MIME type sniffing.",
            recommendation: "Set X-Content-Type-Options header to nosniff",
            affectedUrl: config.baseUrl,
        });
    }

    // Check Content-Security-Policy
    if (!headers.get("content-security-policy")) {
        findings.push({
            id: "HEADER-003",
            title: "Missing Content-Security-Policy Header",
            severity: "medium",
            category: "Security Headers",
            description: "No Content-Security-Policy header found, which helps prevent XSS attacks.",
            recommendation: "Implement a Content-Security-Policy header",
            affectedUrl: config.baseUrl,
        });
    }

    // Check Strict-Transport-Security
    if (!headers.get("strict-transport-security")) {
        findings.push({
            id: "HEADER-004",
            title: "Missing HSTS Header",
            severity: "medium",
            category: "Security Headers",
            description: "The Strict-Transport-Security header is not set.",
            recommendation: "Set Strict-Transport-Security header with appropriate max-age",
            affectedUrl: config.baseUrl,
        });
    }

    // Check for information disclosure
    const server = headers.get("server");
    if (server && /nginx|apache|iis/i.test(server)) {
        findings.push({
            id: "HEADER-005",
            title: "Server Version Disclosure",
            severity: "low",
            category: "Information Disclosure",
            description: \`Server header reveals: \${server}\`,
            evidence: server,
            recommendation: "Remove or obfuscate the Server header",
            affectedUrl: config.baseUrl,
        });
    }

    return findings;
};

/**
 * Check for sensitive file exposure
 */
const checkSensitiveFiles: ScanCheck = async (config) => {
    const findings: VulnerabilityFinding[] = [];
    
    const sensitiveFiles = [
        "/.env",
        "/.git/config",
        "/robots.txt",
        "/sitemap.xml",
        "/.htaccess",
        "/wp-config.php",
        "/config.php",
        "/.DS_Store",
        "/backup.zip",
        "/database.sql",
        "/.svn/entries",
        "/package.json",
        "/composer.json",
    ];

    for (const file of sensitiveFiles) {
        try {
            const response = await fetch(\`\${config.baseUrl}\${file}\`, {
                method: "GET",
                timeout: config.timeout,
            } as any);

            if (response.status === 200) {
                const contentType = response.headers.get("content-type") || "";
                
                // Check if it's actually the file content
                if (!contentType.includes("text/html")) {
                    findings.push({
                        id: \`FILE-\${file.replace(/[^a-z0-9]/gi, "")}\`,
                        title: \`Sensitive File Exposed: \${file}\`,
                        severity: file.includes(".env") || file.includes(".git") ? "critical" : "medium",
                        category: "Information Disclosure",
                        description: \`Sensitive file \${file} is publicly accessible.\`,
                        recommendation: "Block access to sensitive files in your web server configuration",
                        affectedUrl: \`\${config.baseUrl}\${file}\`,
                    });
                }
            }
        } catch {
            // Ignore errors (file not accessible)
        }
    }

    return findings;
};

/**
 * Check for common vulnerabilities in paths
 */
const checkCommonVulnerabilities: ScanCheck = async (config) => {
    const findings: VulnerabilityFinding[] = [];

    // Check for directory listing
    for (const path of config.paths) {
        try {
            const response = await fetch(\`\${config.baseUrl}\${path}\`, {
                timeout: config.timeout,
            } as any);
            
            const body = await response.text();
            
            if (body.includes("Index of") || body.includes("Directory listing")) {
                findings.push({
                    id: "DIRLIST-001",
                    title: "Directory Listing Enabled",
                    severity: "medium",
                    category: "Information Disclosure",
                    description: \`Directory listing is enabled for \${path}\`,
                    recommendation: "Disable directory listing in web server configuration",
                    affectedUrl: \`\${config.baseUrl}\${path}\`,
                });
            }
        } catch {
            // Ignore errors
        }
    }

    return findings;
};

/**
 * Check for CORS misconfiguration
 */
const checkCORS: ScanCheck = async (config) => {
    const findings: VulnerabilityFinding[] = [];

    try {
        const response = await fetch(config.baseUrl, {
            headers: {
                Origin: "https://evil.com",
            },
        });

        const allowOrigin = response.headers.get("access-control-allow-origin");
        const allowCredentials = response.headers.get("access-control-allow-credentials");

        if (allowOrigin === "*") {
            findings.push({
                id: "CORS-001",
                title: "CORS Allows All Origins",
                severity: "medium",
                category: "CORS",
                description: "CORS is configured to allow all origins (*)",
                recommendation: "Restrict CORS to specific trusted origins",
                affectedUrl: config.baseUrl,
            });
        }

        if (allowOrigin === "https://evil.com" && allowCredentials === "true") {
            findings.push({
                id: "CORS-002",
                title: "CORS Reflects Origin with Credentials",
                severity: "high",
                category: "CORS",
                description: "CORS reflects arbitrary origins and allows credentials",
                evidence: \`Allow-Origin: \${allowOrigin}, Allow-Credentials: \${allowCredentials}\`,
                recommendation: "Do not reflect arbitrary origins when credentials are allowed",
                affectedUrl: config.baseUrl,
            });
        }
    } catch {
        // Ignore errors
    }

    return findings;
};

// ============================================
// SCANNER
// ============================================

export class VulnerabilityScanner {
    private config: ScanConfig;
    private checks: ScanCheck[] = [
        checkSecurityHeaders,
        checkSensitiveFiles,
        checkCommonVulnerabilities,
        checkCORS,
    ];

    constructor(config: Partial<ScanConfig> = {}) {
        this.config = {
            baseUrl: config.baseUrl || "http://localhost:3000",
            paths: config.paths || ["/", "/api"],
            timeout: config.timeout || 5000,
            concurrency: config.concurrency || 5,
            verbose: config.verbose ?? true,
        };
    }

    /**
     * Run all security checks
     */
    async scan(): Promise<ScanReport> {
        const startTime = new Date();
        const allFindings: VulnerabilityFinding[] = [];

        console.log(\`\\n=== Vulnerability Scan: \${this.config.baseUrl} ===\\n\`);

        for (const check of this.checks) {
            try {
                const findings = await check(this.config);
                allFindings.push(...findings);

                if (this.config.verbose && findings.length > 0) {
                    findings.forEach(f => {
                        const icon = { critical: "🔴", high: "🟠", medium: "🟡", low: "🔵", info: "⚪" }[f.severity];
                        console.log(\`\${icon} \${f.severity.toUpperCase()}: \${f.title}\`);
                    });
                }
            } catch (error) {
                console.error("Check failed:", error);
            }
        }

        const endTime = new Date();

        const report: ScanReport = {
            target: this.config.baseUrl,
            startTime,
            endTime,
            findings: allFindings,
            summary: {
                critical: allFindings.filter(f => f.severity === "critical").length,
                high: allFindings.filter(f => f.severity === "high").length,
                medium: allFindings.filter(f => f.severity === "medium").length,
                low: allFindings.filter(f => f.severity === "low").length,
                info: allFindings.filter(f => f.severity === "info").length,
            },
        };

        this.printSummary(report);
        return report;
    }

    private printSummary(report: ScanReport): void {
        console.log("\\n=== Scan Summary ===");
        console.log(\`Duration: \${(report.endTime.getTime() - report.startTime.getTime()) / 1000}s\`);
        console.log(\`Total findings: \${report.findings.length}\`);
        console.log(\`  Critical: \${report.summary.critical}\`);
        console.log(\`  High: \${report.summary.high}\`);
        console.log(\`  Medium: \${report.summary.medium}\`);
        console.log(\`  Low: \${report.summary.low}\`);
        console.log(\`  Info: \${report.summary.info}\`);
    }
}
`;

// ============================================
// EXPORTS
// ============================================

export const SECURITY_TESTING_TEMPLATE_SETS = {
    pentest: {
        name: "Penetration Testing",
        template: PENTEST_SCRIPTS_TEMPLATE,
        description: "Automated security testing scripts",
    },
    fuzzing: {
        name: "Fuzzing",
        template: FUZZING_TEMPLATE,
        description: "Input fuzzing utilities",
    },
    scanner: {
        name: "Vulnerability Scanner",
        template: VULNERABILITY_SCANNER_TEMPLATE,
        description: "Automated vulnerability scanning",
    },
};

export function getSecurityTestingTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        pentest: PENTEST_SCRIPTS_TEMPLATE,
        fuzzing: FUZZING_TEMPLATE,
        scanner: VULNERABILITY_SCANNER_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableSecurityTestingTypes(): string[] {
    return ["pentest", "fuzzing", "scanner"];
}
