/**
 * Playwright Global Setup
 * Starts the test server before all E2E UI tests
 */

import { FullConfig } from '@playwright/test';
import { startTestServer } from './setup.js';

async function globalSetup(config: FullConfig) {
    console.log('[Playwright Setup] Starting test server for UI tests...');

    const serverUrl = await startTestServer({
        port: 0, // Use dynamic port
        host: '127.0.0.1',
        useRealDatabase: false,
    });

    console.log(`[Playwright Setup] Server started at ${serverUrl}`);
    console.log('[Playwright Setup] Ready to run UI E2E tests');
}

export default globalSetup;
