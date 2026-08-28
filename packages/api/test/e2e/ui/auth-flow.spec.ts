/**
 * E2E UI Tests: Authentication Flow
 * Tests user registration and login through the browser UI
 */

import { test, expect } from '@playwright/test';

test.describe('UI: Authentication Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('/');
    });

    test('should display login form', async ({ page }) => {
        // Check if login form is visible
        await expect(page.locator('form[name="login"]')).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
        // Try to submit empty form
        await page.click('button[type="submit"]');

        // Check for validation errors
        const emailError = page.locator('input[name="email"] + .error');
        await expect(emailError).toBeVisible();

        const passwordError = page.locator('input[name="password"] + .error');
        await expect(passwordError).toBeVisible();
    });

    test('should navigate to registration page', async ({ page }) => {
        // Click register link
        await page.click('a[href*="register"]');

        // Check URL change
        await expect(page).toHaveURL(/.*register/);

        // Check registration form
        await expect(page.locator('input[name="name"]')).toBeVisible();
    });

    test('should register new user successfully', async ({ page }) => {
        // Navigate to registration
        await page.click('a[href*="register"]');

        // Fill registration form
        const timestamp = Date.now();
        await page.fill('input[name="name"]', `Test User ${timestamp}`);
        await page.fill('input[name="email"]', `test${timestamp}@example.com`);
        await page.fill('input[name="password"]', 'SecurePassword123!');
        await page.fill('input[name="confirmPassword"]', 'SecurePassword123!');

        // Submit form
        await page.click('button[type="submit"]');

        // Check for success message or redirect
        await expect(page).toHaveURL(/.*dashboard|.*projects/, { timeout: 10000 });
    });

    test('should login with valid credentials', async ({ page }) => {
        // Fill login form
        await page.fill('input[name="email"]', 'e2e@example.com');
        await page.fill('input[name="password"]', 'password123');

        // Submit form
        await page.click('button[type="submit"]');

        // Check for successful login (redirect to dashboard)
        await expect(page).toHaveURL(/.*dashboard|.*projects/, { timeout: 10000 });
    });

    test('should show error for invalid credentials', async ({ page }) => {
        // Fill login form with invalid credentials
        await page.fill('input[name="email"]', 'wrong@example.com');
        await page.fill('input[name="password"]', 'wrongpassword');

        // Submit form
        await page.click('button[type="submit"]');

        // Check for error message
        const errorMessage = page.locator('.error, .alert-error, [role="alert"]');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(/invalid|credentials|failed/i);
    });

    test('should logout successfully', async ({ page }) => {
        // Login first
        await page.fill('input[name="email"]', 'e2e@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*dashboard|.*projects/);

        // Click logout
        await page.click('button[aria-label="Logout"], .logout-button, a[href*="logout"]');

        // Check redirect to login
        await expect(page).toHaveURL(/.*login|\/$/, { timeout: 5000 });
    });
});
