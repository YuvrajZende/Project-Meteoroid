/**
 * E2E UI Test Helpers
 * Common utilities and page objects for Playwright tests
 */

import { Page, Locator } from '@playwright/test';

// ============================================
// TEST DATA GENERATORS
// ============================================

export function generateTestEmail(): string {
    return `test-${Date.now()}@e2e.example.com`;
}

export function generateTestName(): string {
    return `Test User ${Date.now()}`;
}

export function generateTestProjectName(): string {
    return `E2E Project ${Date.now()}`;
}

// ============================================
// AUTH HELPERS
// ============================================

export async function login(
    page: Page,
    email: string = 'e2e@example.com',
    password: string = 'password123'
): Promise<void> {
    await page.goto('/');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard|.*projects/, { timeout: 10000 });
}

export async function logout(page: Page): Promise<void> {
    await page.click('button[aria-label="Logout"], .logout-button, a[href*="logout"]');
    await page.waitForURL(/.*login|\/$/, { timeout: 5000 });
}

export async function register(
    page: Page,
    name: string,
    email: string,
    password: string
): Promise<void> {
    await page.goto('/');
    await page.click('a[href*="register"]');

    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard|.*projects/, { timeout: 10000 });
}

// ============================================
// PROJECT HELPERS
// ============================================

export async function createProject(
    page: Page,
    name: string,
    description?: string,
    techStack?: string[]
): Promise<void> {
    await page.click('button:has-text("Create Project"), [data-testid="create-project-btn"]');

    await page.fill('input[name="name"]', name);

    if (description) {
        await page.fill('textarea[name="description"]', description);
    }

    if (techStack) {
        for (const tech of techStack) {
            await page.check(`input[type="checkbox"][value="${tech}"]`);
        }
    }

    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save")');

    // Wait for success message
    await page.waitForSelector('.success, .alert-success, [role="status"]', { timeout: 5000 });
}

export async function navigateToProject(page: Page, projectId: string): Promise<void> {
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
}

// ============================================
// TASK HELPERS
// ============================================

export async function createTask(
    page: Page,
    projectId: string,
    type: 'generation' | 'testing' | 'planning',
    prompt: string,
    config?: Record<string, unknown>
): Promise<void> {
    await page.goto(`/projects/${projectId}`);

    await page.click('button:has-text("Create Task"), [data-testid="create-task-btn"]');

    await page.selectOption('select[name="type"]', type);
    await page.fill('textarea[name="prompt"]', prompt);

    if (config) {
        if (config.model) {
            await page.fill('input[name="model"]', config.model as string);
        }
        if (config.temperature) {
            await page.fill('input[name="temperature"]', config.temperature as string);
        }
    }

    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Start")');

    // Wait for success message
    await page.waitForSelector('.success, .alert-success', { timeout: 5000 });
}

export async function waitForTaskCompletion(
    page: Page,
    taskId: string,
    timeout: number = 120000
): Promise<'complete' | 'failed' | 'cancelled'> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const statusBadge = page.locator('.status-badge, [data-testid="task-status"]');
        const status = await statusBadge.textContent();

        if (status?.match(/complete|successful/i)) {
            return 'complete';
        }
        if (status?.match(/failed|error/i)) {
            return 'failed';
        }
        if (status?.match(/cancelled|canceled/i)) {
            return 'cancelled';
        }

        await page.waitForTimeout(1000);
    }

    throw new Error(`Task ${taskId} did not complete within ${timeout}ms`);
}

// ============================================
// NAVIGATION HELPERS
// ============================================

export async function navigateTo(page: Page, path: string): Promise<void> {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
}

export async function clickNav(page: Page, item: 'dashboard' | 'projects' | 'tasks' | 'settings'): Promise<void> {
    const selector = {
        dashboard: 'a[href*="dashboard"], [data-testid="nav-dashboard"]',
        projects: 'a[href*="projects"], [data-testid="nav-projects"]',
        tasks: 'a[href*="tasks"], [data-testid="nav-tasks"]',
        settings: 'a[href*="settings"], [data-testid="nav-settings"]',
    }[item];

    await page.click(selector);
    await page.waitForURL(new RegExp(`.*${item}`));
}

// ============================================
// MODAL HELPERS
// ============================================

export async function closeModal(page: Page): Promise<void> {
    const closeButton = page.locator('.modal button[aria-label="Close"], .modal .close, dialog::backdrop');
    await closeButton.click();
}

export async function confirmModal(page: Page): Promise<void> {
    await page.click('.modal button:has-text("Confirm"), .modal button:has-text("Yes"), .modal button:has-text("OK")');
}

export async function cancelModal(page: Page): Promise<void> {
    await page.click('.modal button:has-text("Cancel"), .modal button:has-text("No")');
}

// ============================================
// ASSERTION HELPERS
// ============================================

export async function expectSuccessMessage(page: Page): Promise<void> {
    const selector = '.success, .alert-success, [role="status"]:has-text("success")';
    await page.waitForSelector(selector, { timeout: 5000 });
}

export async function expectErrorMessage(page: Page): Promise<void> {
    const selector = '.error, .alert-error, [role="alert"]';
    await page.waitForSelector(selector, { timeout: 5000 });
}

export async function expectUrl(page: Page, pattern: RegExp): Promise<void> {
    await page.waitForURL(pattern, { timeout: 5000 });
}

// ============================================
// PAGE OBJECTS
// ============================================

export class DashboardPage {
    constructor(private page: Page) {}

    async goto() {
        await this.page.goto('/dashboard');
        await this.page.waitForLoadState('networkidle');
    }

    get projectsStat() {
        return this.page.locator('.stat-card:has-text("Projects")');
    }

    get tasksStat() {
        return this.page.locator('.stat-card:has-text("Tasks")');
    }

    get activityFeed() {
        return this.page.locator('.activity-feed, .recent-activity-list');
    }

    get quickCreateProject() {
        return this.page.locator('button:has-text("New Project"), [data-testid="quick-create-project"]');
    }

    async getProjectCount(): Promise<number> {
        const count = await this.projectsStat.locator('.count, .value').textContent();
        return parseInt(count || '0');
    }
}

export class ProjectsPage {
    constructor(private page: Page) {}

    async goto() {
        await this.page.goto('/projects');
        await this.page.waitForLoadState('networkidle');
    }

    get projectCards() {
        return this.page.locator('.project-card, [data-testid="project-card"]');
    }

    get createButton() {
        return this.page.locator('button:has-text("Create Project"), [data-testid="create-project-btn"]');
    }

    get filterButton() {
        return this.page.locator('button[aria-label="Filter"], [data-testid="filter-btn"]');
    }

    get searchInput() {
        return this.page.locator('input[name="search"], [data-testid="search-input"]');
    }

    async getProjectCount(): Promise<number> {
        return await this.projectCards.count();
    }

    async getProjectByName(name: string) {
        return this.projectCards.filter({ hasText: name });
    }
}

export class TasksPage {
    constructor(private page: Page) {}

    async goto(projectId: string) {
        await this.page.goto(`/projects/${projectId}/tasks`);
        await this.page.waitForLoadState('networkidle');
    }

    get taskCards() {
        return this.page.locator('.task-card, [data-testid="task-card"]');
    }

    get createButton() {
        return this.page.locator('button:has-text("Create Task"), [data-testid="create-task-btn"]');
    }

    get filterButton() {
        return this.page.locator('button[aria-label="Filter tasks"], [data-testid="task-filter-btn"]');
    }

    async getTaskCount(): Promise<number> {
        return await this.taskCards.count();
    }

    async getTasksByStatus(status: 'pending' | 'running' | 'complete' | 'failed') {
        return this.taskCards.filter({ hasAttribute: 'data-status', value: status });
    }
}

export class SettingsPage {
    constructor(private page: Page) {}

    async goto(section?: string) {
        await this.page.goto(`/settings${section ? '#' + section : ''}`);
        await this.page.waitForLoadState('networkidle');
    }

    async save() {
        await this.page.click('button:has-text("Save"), button:has-text("Update")');
        await this.page.waitForSelector('.success, .alert-success', { timeout: 5000 });
    }

    get profileSection() {
        return this.page.locator('#profile, .settings-section:has-text("Profile")');
    }

    get preferencesSection() {
        return this.page.locator('#preferences, .settings-section:has-text("Preferences")');
    }

    get apiKeysSection() {
        return this.page.locator('#api-keys, .settings-section:has-text("API Keys")');
    }

    get securitySection() {
        return this.page.locator('#security, .settings-section:has-text("Security")');
    }
}
