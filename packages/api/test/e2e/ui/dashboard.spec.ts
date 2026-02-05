/**
 * E2E UI Tests: Dashboard
 * Tests the main dashboard interface and navigation
 */

import { test, expect } from '@playwright/test';

test.describe('UI: Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('/');
        await page.fill('input[name="email"]', 'e2e@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*dashboard/);
    });

    test('should display dashboard overview', async ({ page }) => {
        // Check for dashboard container
        await expect(page.locator('.dashboard, [data-testid="dashboard"]')).toBeVisible();

        // Check for stats cards
        await expect(page.locator('.stat-card, .metric-card')).toHaveCount(3); // projects, tasks, activity

        // Check for recent activity section
        await expect(page.locator('.recent-activity, [data-testid="recent-activity"]')).toBeVisible();
    });

    test('should display project statistics', async ({ page }) => {
        // Check projects stat card
        const projectsCard = page.locator('.stat-card:has-text("Projects"), .metric-card:has-text("Projects")');
        await expect(projectsCard).toBeVisible();

        // Check for count
        const count = projectsCard.locator('.count, .value, .number');
        await expect(count).toBeVisible();

        // Verify count is a number
        const countText = await count.textContent();
        expect(parseInt(countText || '0')).not.toBeNaN();
    });

    test('should display task statistics', async ({ page }) => {
        // Check tasks stat card
        const tasksCard = page.locator('.stat-card:has-text("Tasks"), .metric-card:has-text("Tasks")');
        await expect(tasksCard).toBeVisible();

        // Check for breakdown (pending, running, complete, failed)
        await expect(tasksCard.locator('.status-breakdown, .task-stats')).toBeVisible();
    });

    test('should display recent activity feed', async ({ page }) => {
        const activityFeed = page.locator('.activity-feed, .recent-activity-list');
        await expect(activityFeed).toBeVisible();

        // Check for activity items
        const items = activityFeed.locator('.activity-item');
        const count = await items.count();

        if (count > 0) {
            // Check first item has required elements
            await expect(items.first().locator('.timestamp, .date')).toBeVisible();
            await expect(items.first().locator('.description, .message')).toBeVisible();
        }
    });

    test('should navigate to projects from dashboard', async ({ page }) => {
        // Click on projects stat card or "View All" link
        const projectsLink = page.locator('a:has-text("View All Projects"), .stat-card:has-text("Projects")');
        await projectsLink.click();

        // Verify navigation
        await expect(page).toHaveURL(/.*projects/);
    });

    test('should display quick actions', async ({ page }) => {
        // Check for quick action buttons
        await expect(page.locator('button:has-text("New Project"), [data-testid="quick-create-project"]')).toBeVisible();
        await expect(page.locator('button:has-text("New Task"), [data-testid="quick-create-task"]')).toBeVisible();
    });

    test('should create project from quick action', async ({ page }) => {
        // Click quick create project
        await page.click('button:has-text("New Project"), [data-testid="quick-create-project"]');

        // Check project form modal appears
        await expect(page.locator('.modal:has-text("Create Project"), dialog:has-text("Create Project")')).toBeVisible();
    });

    test('should navigate between sections', async ({ page }) => {
        // Check navigation menu
        const nav = page.locator('nav, .sidebar, [data-testid="navigation"]');
        await expect(nav).toBeVisible();

        // Click on different navigation items
        await nav.locator('a:has-text("Projects"), [data-testid="nav-projects"]').click();
        await expect(page).toHaveURL(/.*projects/);

        await nav.locator('a:has-text("Tasks"), [data-testid="nav-tasks"]').click();
        await expect(page).toHaveURL(/.*tasks/);

        await nav.locator('a:has-text("Dashboard"), [data-testid="nav-dashboard"]').click();
        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should display user menu', async ({ page }) => {
        // Click user avatar/menu
        await page.click('.user-avatar, [data-testid="user-menu"], button[aria-label="User menu"]');

        // Check menu items
        const menu = page.locator('.dropdown-menu, .user-menu-content');
        await expect(menu).toBeVisible();
        await expect(menu.locator('a:has-text("Profile"), a:has-text("Settings")')).toBeVisible();
        await expect(menu.locator('button:has-text("Logout"), a:has-text("Logout")')).toBeVisible();
    });

    test('should update dashboard preferences', async ({ page }) => {
        // Click settings/preferences
        await page.click('button:has-text("Preferences"), [data-testid="preferences-btn"]');

        // Check preferences modal
        await expect(page.locator('.modal:has-text("Preferences")')).toBeVisible();

        // Toggle a preference (e.g., compact view)
        await page.check('input[name="compactView"]');
        await page.click('button:has-text("Save")');

        // Check for success message
        await expect(page.locator('.success')).toBeVisible();

        // Verify view changed
        await expect(page.locator('.dashboard.compact, [data-compact="true"]')).toBeVisible();
    });

    test('should respond to window resize', async ({ page }) => {
        // Check initial state (desktop)
        await expect(page.locator('.sidebar, nav')).toBeVisible();

        // Resize to mobile
        await page.setViewportSize({ width: 375, height: 667 });

        // Check for mobile navigation
        await expect(page.locator('.mobile-nav-toggle, .hamburger-menu')).toBeVisible();

        // Click mobile menu
        await page.click('.mobile-nav-toggle');

        // Check mobile menu appears
        await expect(page.locator('.mobile-menu, .sidebar.open')).toBeVisible();
    });
});
