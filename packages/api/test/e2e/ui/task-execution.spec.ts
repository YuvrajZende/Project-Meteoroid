/**
 * E2E UI Tests: Task Execution
 * Tests AI task creation, monitoring, and completion through the browser UI
 */

import { test, expect } from '@playwright/test';

test.describe('UI: Task Execution', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('/');
        await page.fill('input[name="email"]', 'e2e@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*dashboard|.*projects/);
    });

    test('should display task creation form', async ({ page }) => {
        // Navigate to project
        await page.goto('/projects/proj_e2e_1');

        // Check for create task button
        await expect(page.locator('button:has-text("Create Task"), button:has-text("New Task"), [data-testid="create-task-btn"]')).toBeVisible();
    });

    test('should create generation task', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1');

        // Click create task
        await page.click('button:has-text("Create Task"), [data-testid="create-task-btn"]');

        // Check task form modal
        await expect(page.locator('.modal, dialog, [role="dialog"]')).toBeVisible();

        // Select task type
        await page.selectOption('select[name="type"]', 'generation');

        // Enter prompt
        await page.fill('textarea[name="prompt"]', 'Create a simple REST API endpoint for user management');

        // Configure options
        await page.fill('input[name="model"]', 'gpt-4');
        await page.fill('input[name="temperature"]', '0.7');

        // Submit
        await page.click('button[type="submit"]:has-text("Create"), button:has-text("Start")');

        // Check success message
        await expect(page.locator('.success, .alert-success')).toBeVisible();

        // Navigate to tasks tab
        await page.click('a:has-text("Tasks"), [data-testid="tasks-tab"]');

        // Verify task appears in list
        await expect(page.locator('.task-card:has-text("Create a simple REST API")')).toBeVisible();
    });

    test('should monitor task progress', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1/tasks');

        // Click on first pending/running task
        const taskCard = page.locator('.task-card[data-status="pending"], .task-card[data-status="running"]').first();
        if (await taskCard.isVisible()) {
            await taskCard.click();

            // Check task detail page
            await expect(page.locator('.task-detail, [data-testid="task-detail"]')).toBeVisible();

            // Check for progress indicator
            await expect(page.locator('.progress-bar, [data-testid="progress"]')).toBeVisible();

            // Check for status badge
            const statusBadge = page.locator('.status-badge, [data-testid="task-status"]');
            await expect(statusBadge).toBeVisible();

            const status = await statusBadge.textContent();
            expect(['pending', 'running', 'complete', 'failed']).toContain(status?.toLowerCase() || '');
        }
    });

    test('should display task completion result', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1/tasks');

        // Click on completed task
        const completedTask = page.locator('.task-card[data-status="complete"], .task-card:has-text("Complete")').first();

        if (await completedTask.isVisible()) {
            await completedTask.click();

            // Check for generated code/output
            await expect(page.locator('.code-output, .task-result, [data-testid="task-output"]')).toBeVisible();

            // Check for action buttons (retry, copy, etc.)
            await expect(page.locator('button:has-text("Copy"), button:has-text("Download")')).toBeVisible();
        }
    });

    test('should retry failed task', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1/tasks');

        // Find failed task
        const failedTask = page.locator('.task-card[data-status="failed"], .task-card:has-text("Failed")').first();

        if (await failedTask.isVisible()) {
            // Click retry button
            await failedTask.locator('button:has-text("Retry"), [data-testid="retry-btn"]').click();

            // Confirm retry
            await page.click('.modal button:has-text("Confirm")');

            // Check success message
            await expect(page.locator('.success, .alert-success')).toBeVisible();

            // Verify task status changed to pending/running
            const status = await failedTask.locator('.status-badge').textContent();
            expect(['pending', 'running']).toContain(status?.toLowerCase() || '');
        }
    });

    test('should cancel running task', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1/tasks');

        // Find running task
        const runningTask = page.locator('.task-card[data-status="running"], .task-card:has-text("Running")').first();

        if (await runningTask.isVisible()) {
            // Click cancel button
            await runningTask.locator('button:has-text("Cancel"), [data-testid="cancel-btn"]').click();

            // Confirm cancellation
            await page.click('.modal button:has-text("Confirm")');

            // Check status changed to cancelled
            await expect(runningTask.locator('.status-badge')).toHaveText(/cancelled|canceled/i);
        }
    });

    test('should filter tasks by type', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1/tasks');

        // Click filter button
        await page.click('button[aria-label="Filter tasks"], [data-testid="task-filter-btn"]');

        // Select "generation" type
        await page.click('label:has-text("Generation"), input[value="generation"]');

        // Apply filter
        await page.click('button:has-text("Apply")');

        // Verify filtered results
        const tasks = page.locator('.task-card');
        const count = await tasks.count();

        for (let i = 0; i < count; i++) {
            const typeBadge = tasks.nth(i).locator('.task-type, [data-testid="task-type"]');
            await expect(typeBadge).toHaveText(/generation/i);
        }
    });

    test('should view task history timeline', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1/tasks');

        // Click on task
        const firstTask = page.locator('.task-card').first();
        await firstTask.click();

        // Check for timeline/history section
        await expect(page.locator('.task-timeline, .task-history, [data-testid="task-timeline"]')).toBeVisible();

        // Verify timeline entries
        const timelineEntries = page.locator('.timeline-entry, .history-item');
        const count = await timelineEntries.count();
        expect(count).toBeGreaterThan(0);

        // Check first entry has timestamp and status
        await expect(timelineEntries.first().locator('.timestamp, .date')).toBeVisible();
        await expect(timelineEntries.first().locator('.status, .event-type')).toBeVisible();
    });

    test('should copy generated code', async ({ page }) => {
        await page.goto('/projects/proj_e2e_1/tasks');

        // Click on completed task
        const completedTask = page.locator('.task-card[data-status="complete"]').first();

        if (await completedTask.isVisible()) {
            await completedTask.click();

            // Click copy button
            await page.click('button:has-text("Copy"), [data-testid="copy-code-btn"]');

            // Check for copy success feedback
            await expect(page.locator('.toast, .notification:has-text("Copied")')).toBeVisible();
        }
    });
});
