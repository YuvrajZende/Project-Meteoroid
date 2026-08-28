/**
 * E2E UI Tests: Project Management
 * Tests project creation, listing, and management through the browser UI
 */

import { test, expect } from '@playwright/test';

test.describe('UI: Project Management', () => {
    // Login before each test
    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Login
        await page.fill('input[name="email"]', 'e2e@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*dashboard|.*projects/);
    });

    test('should display projects list', async ({ page }) => {
        // Navigate to projects page
        await page.goto('/projects');

        // Check for projects list
        await expect(page.locator('.projects-list, [data-testid="projects-list"]')).toBeVisible();

        // Check if at least one project is displayed
        const projectCards = page.locator('.project-card, [data-testid="project-card"]');
        const count = await projectCards.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should create new project', async ({ page }) => {
        // Click create project button
        await page.click('button:has-text("Create Project"), button:has-text("New Project"), [data-testid="create-project-btn"]');

        // Check if project form modal appears
        await expect(page.locator('.modal, dialog, [role="dialog"]')).toBeVisible();

        // Fill project form
        const timestamp = Date.now();
        await page.fill('input[name="name"]', `E2E Test Project ${timestamp}`);
        await page.fill('textarea[name="description"]', 'This is an E2E test project');

        // Select tech stack (assuming multi-select or checkboxes)
        await page.check('input[type="checkbox"][value="typescript"]');
        await page.check('input[type="checkbox"][value="fastify"]');

        // Submit form
        await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save")');

        // Check for success message
        await expect(page.locator('.success, .alert-success, [role="status"]')).toBeVisible();

        // Verify project appears in list
        const projectName = page.locator(`.project-card:has-text("E2E Test Project ${timestamp}")`);
        await expect(projectName).toBeVisible();
    });

    test('should filter projects by status', async ({ page }) => {
        await page.goto('/projects');

        // Click on status filter
        await page.click('button[aria-label="Filter"], [data-testid="filter-btn"]');

        // Select "active" status
        await page.click('label:has-text("Active"), input[value="active"]');

        // Apply filter
        await page.click('button:has-text("Apply")');

        // Check that projects list updates
        const projects = page.locator('.project-card');
        const count = await projects.count();

        // Verify filtered results
        for (let i = 0; i < count; i++) {
            const statusBadge = projects.nth(i).locator('.status-badge, [data-testid="status"]');
            await expect(statusBadge).toHaveText(/active/i);
        }
    });

    test('should search projects', async ({ page }) => {
        await page.goto('/projects');

        // Fill search input
        await page.fill('input[name="search"], [data-testid="search-input"]', 'E2E');

        // Wait for debounce/filter
        await page.waitForTimeout(500);

        // Check that search results are displayed
        const projects = page.locator('.project-card');
        const count = await projects.count();

        if (count > 0) {
            // At least one result should contain "E2E"
            const firstProject = projects.first();
            await expect(firstProject).toContainText(/E2E/i, { timeout: 5000 });
        }
    });

    test('should view project details', async ({ page }) => {
        await page.goto('/projects');

        // Click on first project
        await page.click('.project-card:first-child, [data-testid="project-card"]:first-child');

        // Check URL navigation
        await expect(page).toHaveURL(/.*projects\/.+/);

        // Verify project details are shown
        await expect(page.locator('h1:has-text("E2E Test Project")')).toBeVisible();
        await expect(page.locator('.project-description, [data-testid="description"]')).toBeVisible();
        await expect(page.locator('.tech-stack, [data-testid="tech-stack"]')).toBeVisible();
    });

    test('should update project settings', async ({ page }) => {
        // Navigate to a project
        await page.goto('/projects/proj_e2e_1');

        // Click settings/edit button
        await page.click('button:has-text("Settings"), button:has-text("Edit"), [data-testid="settings-btn"]');

        // Update project name
        const newName = `Updated Project ${Date.now()}`;
        await page.fill('input[name="name"]', newName);

        // Save changes
        await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

        // Check success message
        await expect(page.locator('.success, .alert-success')).toBeVisible();

        // Verify updated name is displayed
        await expect(page.locator('h1, .project-name')).toHaveText(newName);
    });

    test('should delete project with confirmation', async ({ page }) => {
        await page.goto('/projects');

        // Get initial project count
        const projectsBefore = await page.locator('.project-card').count();

        // Click delete on first project (if not the test project)
        const deleteBtn = page.locator('.project-card:not(:has-text("E2E Test Project")) button:has-text("Delete")').first();
        if (await deleteBtn.isVisible()) {
            await deleteBtn.click();

            // Confirm deletion in modal
            await page.click('.modal button:has-text("Confirm"), .modal button:has-text("Delete")');

            // Check success message
            await expect(page.locator('.success, .alert-success')).toBeVisible();

            // Verify project count decreased
            const projectsAfter = await page.locator('.project-card').count();
            expect(projectsAfter).toBe(projectsBefore - 1);
        }
    });
});
