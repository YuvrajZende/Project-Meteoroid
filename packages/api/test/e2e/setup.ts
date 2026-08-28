/**
 * E2E Test Setup
 * Provides test database initialization, server management, and test utilities
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Server } from 'node:http';
import { AddressInfo } from 'net';
import { build } from 'vite';
import type { InlineConfig } from 'vite';
import { initDIContainer, resetDIContainer, TYPES } from '../../src/di/types.js';
import { MockDatabase } from '../src/repositories/__tests__/mock-database.js';
import { IDatabase } from '../src/interfaces/database.interface.js';
import { SupabaseDatabase } from '../src/infrastructure/database/supabase-database.js';

// ============================================
// TEST DATABASE SETUP
// ============================================

export interface TestDatabaseConfig {
    connectionString?: string;
    useMock?: boolean;
}

let testDatabase: IDatabase | MockDatabase | null = null;

/**
 * Initialize test database (mock or real)
 */
export async function setupTestDatabase(config: TestDatabase = {}): Promise<IDatabase> {
    const { useMock = true, connectionString } = config;

    if (useMock || !connectionString) {
        console.log('[E2E Setup] Using MockDatabase for testing');
        testDatabase = new MockDatabase();
        return testDatabase;
    }

    console.log('[E2E Setup] Using real database for E2E tests');
    // TODO: Initialize real database connection if needed
    testDatabase = new SupabaseDatabase(connectionString);
    await testDatabase.initialize?.();
    return testDatabase;
}

export async function cleanupTestDatabase(): Promise<void> {
    if (testDatabase && 'clearAll' in testDatabase) {
        (testDatabase as MockDatabase).clearAll();
    }
    if (testDatabase && 'close' in testDatabase) {
        await testDatabase.close?.();
    }
    testDatabase = null;
}

// ============================================
// TEST SERVER MANAGEMENT
// ============================================

export interface TestServerConfig {
    port?: number;
    host?: string;
    useRealDatabase?: boolean;
}

let testServer: Server | null = null;
let serverUrl: string | null = null;

/**
 * Start the API server for testing
 */
export async function startTestServer(config: TestServerConfig = {}): Promise<string> {
    const { port = 0, host = '127.0.0.1', useRealDatabase = false } = config;

    console.log(`[E2E Setup] Starting test server on ${host}:${port}...`);

    // Import and start the server
    const { startServer } = await import('../../src/index.js');
    testServer = await startServer({ port, host, useTestDatabase: !useRealDatabase });

    // Get the actual port (if port was 0, OS assigns one)
    const address = testServer.address() as AddressInfo;
    const actualPort = address.port;
    serverUrl = `http://${host}:${actualPort}`;

    console.log(`[E2E Setup] Test server started at ${serverUrl}`);

    return serverUrl;
}

/**
 * Stop the test server
 */
export async function stopTestServer(): Promise<void> {
    if (testServer) {
        console.log('[E2E Setup] Stopping test server...');
        await new Promise<void>((resolve) => {
            testServer!.close(() => {
                console.log('[E2E Setup] Test server stopped');
                testServer = null;
                serverUrl = null;
                resolve();
            });
        });
    }
}

/**
 * Get the current server URL
 */
export function getServerUrl(): string {
    if (!serverUrl) {
        throw new Error('Server not started. Call startTestServer() first.');
    }
    return serverUrl;
}

// ============================================
// TEST FIXTURES
// ============================================

/**
 * Seed test data into database
 */
export async function seedTestData(database: IDatabase, tableName: string, data: Record<string, unknown>[]): Promise<void> {
    if ('seed' in database) {
        (database as MockDatabase).seed(tableName, data);
    } else {
        // For real database, use INSERT queries
        for (const row of data) {
            await database.query(`INSERT INTO ${tableName} (${Object.keys(row).join(', ')}) VALUES (${Object.values(row).map((_, i) => `$${i + 1}`).join(', ')})`, row);
        }
    }
}

// ============================================
// HTTP HELPERS
// ============================================

export interface TestResponse {
    status: number;
    headers: Record<string, string>;
    data: unknown;
}

/**
 * Make authenticated test request
 */
export async function authenticatedRequest(
    url: string,
    options: RequestInit = {}
): Promise<TestResponse> {
    const token = await getTestAuthToken();

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    });

    const data = await response.json().catch(() => null);

    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data,
    };
}

/**
 * Get test auth token
 */
async function getTestAuthToken(): Promise<string> {
    // For now, return a test token
    // TODO: Implement proper test authentication
    return 'test-token-' + Date.now();
}

// ============================================
// VITEST FIXTURES
// ============================================

/**
 * E2E test lifecycle setup
 */
export function withE2ESetup(
    testFn: () => void | Promise<void>,
    config?: TestServerConfig & TestDatabaseConfig
) {
    const serverConfig: TestServerConfig = {
        port: config?.port,
        host: config?.host,
        useRealDatabase: config?.useRealDatabase,
    };

    const dbConfig: TestDatabaseConfig = {
        connectionString: config?.connectionString,
        useMock: !config?.useRealDatabase,
    };

    beforeAll(async () => {
        // Reset DI container
        resetDIContainer();

        // Setup test database
        await setupTestDatabase(dbConfig);

        // Start test server
        await startTestServer(serverConfig);
    }, 30000); // 30 second timeout

    afterAll(async () => {
        // Cleanup
        await stopTestServer();
        await cleanupTestDatabase();
        resetDIContainer();
    }, 10000);

    // Run the test
    testFn();
}
