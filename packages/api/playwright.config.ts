import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Tests run against a live server
 */
export default defineConfig({
  testDir: './test/e2e/ui',

  // Use parallel execution for faster tests
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    // Base URL for tests - will be set dynamically
    baseURL: 'http://127.0.0.1:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Projects are groups of tests
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global setup and teardown
  globalSetup: './test/e2e/global-setup.ts',
  globalTeardown: './test/e2e/global-teardown.ts',
});
