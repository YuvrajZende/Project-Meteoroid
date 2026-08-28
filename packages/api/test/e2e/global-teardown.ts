/**
 * Playwright Global Teardown
 * Stops the test server after all E2E UI tests
 */

import { FullConfig } from '@playwright/test';
import { stopTestServer } from './setup.js';

async function globalTeardown(config: FullConfig) {
    console.log('[Playwright Teardown] Stopping test server...');
    await stopTestServer();
    console.log('[Playwright Teardown] Server stopped, cleanup complete');
}

export default globalTeardown;
