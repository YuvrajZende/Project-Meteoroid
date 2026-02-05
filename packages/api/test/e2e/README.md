# E2E Testing Guide

This directory contains end-to-end tests for the Loveable Backend API.

## Test Structure

```
test/e2e/
├── setup.ts                 # Test database and server management utilities
├── global-setup.ts          # Playwright global setup (starts server)
├── global-teardown.ts       # Playwright global teardown (stops server)
├── api.workflows.test.ts    # API workflow tests (Vitest)
├── ui/                      # UI/browser tests (Playwright)
│   ├── auth-flow.spec.ts
│   ├── project-management.spec.ts
│   ├── task-execution.spec.ts
│   ├── dashboard.spec.ts
│   ├── settings.spec.ts
│   └── helpers.ts           # Common test helpers and page objects
└── README.md                # This file
```

## Test Types

### API E2E Tests (`*.e2e.test.ts`)
Run with Vitest against a live server. Tests complete API workflows including:
- User authentication (register, login)
- Project management (CRUD operations)
- Task execution (create, monitor, completion)
- Context management
- Learning patterns
- Error handling

### UI E2E Tests (`ui/*.spec.ts`)
Run with Playwright to test the browser UI. Tests include:
- Authentication flow (login forms, validation)
- Project management (create, edit, delete projects)
- Task execution (create tasks, monitor progress)
- Dashboard navigation and statistics
- Settings and preferences

## Running Tests

### API E2E Tests
```bash
# Run all API E2E tests
npm run test:e2e

# Run specific test file
npx vitest --config vitest.e2e.config.ts test/e2e/api.workflows.test.ts
```

### UI E2E Tests
```bash
# Run all UI E2E tests
npm run test:e2e:ui

# Run specific test file
npx playwright test auth-flow.spec.ts

# Run in headed mode (show browser)
npx playwright test --headed

# Run with UI mode (interactive)
npx playwright test --ui
```

### All Tests
```bash
# Run both unit and E2E tests
npm run test:all
```

## Test Configuration

### API E2E (`vitest.e2e.config.ts`)
- Timeout: 60 seconds per test
- Hook timeout: 2 minutes for setup/teardown
- Serial execution (pool: 1)
- No coverage collection for E2E tests

### UI E2E (`playwright.config.ts`)
- Test directory: `./test/e2e/ui`
- Browser: Chromium (default)
- Parallel execution: Enabled
- Screenshots on failure: Enabled
- Trace on retry: Enabled
- Reporter: HTML + JUnit

## Test Data

### Mock Database
Tests use `MockDatabase` by default - an in-memory SQL parser that supports:
- SELECT, INSERT, UPDATE, DELETE queries
- WHERE clauses with AND/OR/ILIKE
- Numbered parameters ($1, $2)
- OFFSET/LIMIT pagination
- String literals

### Real Database
To test against a real database, set environment variable:
```bash
TEST_DATABASE_URL=postgresql://... npm run test:e2e
```

## Test Helpers

### API Test Helpers (`setup.ts`)
```typescript
import { startTestServer, stopTestServer, authenticatedRequest } from './setup.js';

// Start server (gets dynamic URL)
const serverUrl = await startTestServer();

// Make authenticated request
const response = await authenticatedRequest(`${serverUrl}/api/v1/projects`);
```

### UI Test Helpers (`ui/helpers.ts`)
```typescript
import { login, createProject, DashboardPage, ProjectsPage } from './ui/helpers.js';

// Login
await login(page, 'e2e@example.com', 'password123');

// Create project using helper
await createProject(page, 'My Project', 'Description', ['typescript']);

// Use page objects
const projectsPage = new ProjectsPage(page);
await projectsPage.goto();
const count = await projectsPage.getProjectCount();
```

## Writing New Tests

### API E2E Test Template
```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import { withE2ESetup, getServerUrl } from './setup.js';

describe('E2E: My Feature', () => {
    let serverUrl: string;

    beforeAll(async () => {
        serverUrl = getServerUrl();
    });

    withE2ESetup(() => {
        test('should do something', async () => {
            const response = await fetch(`${serverUrl}/api/v1/endpoint`);
            expect(response.status).toBe(200);
        });
    });
});
```

### UI E2E Test Template
```typescript
import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.describe('UI: My Feature', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display feature', async ({ page }) => {
        await page.goto('/my-feature');
        await expect(page.locator('.my-component')).toBeVisible();
    });
});
```

## Test Data Fixtures

### User
```typescript
{
    id: 'user_e2e_1',
    email: 'e2e@example.com',
    name: 'E2E Test User',
    password: 'password123',
    role: 'user'
}
```

### Project
```typescript
{
    id: 'proj_e2e_1',
    userId: 'user_e2e_1',
    name: 'E2E Test Project',
    description: 'Test project for E2E tests',
    status: 'active',
    techStack: ['typescript', 'fastify']
}
```

## Troubleshooting

### Server won't start
- Check if port is already in use
- Verify dependencies are installed: `npm install`
- Check server logs: `npm run dev` in a separate terminal

### Tests timeout
- Increase timeout in `vitest.e2e.config.ts` or `playwright.config.ts`
- Check if server is responding: `curl http://localhost:3000/health`

### Browser tests fail
- Ensure browsers are installed: `npx playwright install`
- Try running in headed mode to see what's happening: `npx playwright test --headed`
- Check Playwright trace: `npx playwright show-trace test-results/[trace-name]`

### Database errors
- Check MockDatabase supports the SQL features you're using
- For real database, verify connection string is correct
- Clear test data between tests if needed

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run unit tests
  run: npm run test

- name: Run E2E tests
  run: npm run test:all

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results/
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Use `beforeEach`/`afterEach` to reset state
3. **Meaningful assertions**: Test behavior, not implementation details
4. **Wait properly**: Use `waitForSelector` instead of hardcoded delays
5. **Page objects**: Use the provided page objects for complex interactions
6. **Error messages**: Include clear descriptions in test names
7. **Test data**: Use fixtures for consistent test data

## Next Steps

- [ ] Add visual regression tests
- [ ] Add performance tests
- [ ] Add accessibility tests
- [ ] Add mobile-responsive tests
- [ ] Add API load tests with Autocannon
