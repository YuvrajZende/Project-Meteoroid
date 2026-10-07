/**
 * E2E Test Configuration
 * Vitest config for end-to-end tests with live server
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        testTimeout: 60000, // 60 second timeout for E2E tests
        hookTimeout: 120000, // 2 minute timeout for setup/teardown
        bail: 1, // Stop on first failure (comment out to continue on failure)
        // Run tests serially in a single process (E2E tests may have side effects)
        pool: 'forks',
        poolOptions: {
            forks: { singleFork: true },
        },
        include: ['test/e2e/**/*.test.ts'],
        // E2E tests don't need coverage
        coverage: { enabled: false },
        // Setup file for test initialization
        setupFiles: ['./test/e2e/setup.ts'],
        globals: true,
        environment: 'node',
    },
});
