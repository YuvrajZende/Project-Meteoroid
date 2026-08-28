/**
 * E2E UI Tests: Settings
 * Tests user settings, preferences, and configuration
 */

import { test, expect } from '@playwright/test';

test.describe('UI: Settings', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('/');
        await page.fill('input[name="email"]', 'e2e@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
    });

    test('should display settings page', async ({ page }) => {
        // Navigate to settings
        await page.goto('/settings');

        // Check for settings sections
        await expect(page.locator('.settings-section, [data-testid="settings-section"]')).toHaveCount(4);
        await expect(page.locator('h2:has-text("Profile"), h2:has-text("Account")')).toBeVisible();
        await expect(page.locator('h2:has-text("Preferences")')).toBeVisible();
        await expect(page.locator('h2:has-text("API Keys")')).toBeVisible();
        await expect(page.locator('h2:has-text("Security")')).toBeVisible();
    });

    test('should update user profile', async ({ page }) => {
        await page.goto('/settings');

        // Go to profile section
        await page.click('a[href*="#profile"], button:has-text("Profile")');

        // Update name
        const newName = `Updated Name ${Date.now()}`;
        await page.fill('input[name="name"]', newName);

        // Save changes
        await page.click('button:has-text("Save"), button:has-text("Update")');

        // Check success message
        await expect(page.locator('.success, .alert-success')).toBeVisible();

        // Verify updated name
        await expect(page.locator('input[name="name"]')).toHaveValue(newName);
    });

    test('should update user preferences', async ({ page }) => {
        await page.goto('/settings#preferences');

        // Toggle theme to dark
        await page.click('label:has-text("Dark Mode"), input[name="theme"][value="dark"]');

        // Select preferred language
        await page.selectOption('select[name="language"]', 'typescript');

        // Save
        await page.click('button:has-text("Save Preferences")');

        // Check success message
        await expect(page.locator('.success')).toBeVisible();

        // Verify theme changed (check for dark mode class)
        await expect(page.locator('body.dark, body[data-theme="dark"]')).toBeVisible();
    });

    test('should add API key', async ({ page }) => {
        await page.goto('/settings#api-keys');

        // Click add API key button
        await page.click('button:has-text("Add API Key"), [data-testid="add-api-key"]');

        // Fill API key form
        await page.fill('input[name="name"]', 'Test Key');
        await page.selectOption('select[name="provider"]', 'openai');
        await page.fill('input[name="key"]', 'sk-test-key-' + Date.now());

        // Submit
        await page.click('button[type="submit"]');

        // Check success message
        await expect(page.locator('.success')).toBeVisible();

        // Verify key appears in list
        await expect(page.locator('.api-key-item:has-text("Test Key")')).toBeVisible();
    });

    test('should delete API key', async ({ page }) => {
        await page.goto('/settings#api-keys');

        // Find existing API key
        const existingKey = page.locator('.api-key-item').first();

        if (await existingKey.isVisible()) {
            // Click delete button
            await existingKey.locator('button:has-text("Delete"), [data-testid="delete-key"]').click();

            // Confirm deletion
            await page.click('.modal button:has-text("Confirm"), .modal button:has-text("Delete")');

            // Check success message
            await expect(page.locator('.success')).toBeVisible();

            // Verify key removed
            await expect(existingKey).not.toBeVisible();
        }
    });

    test('should change password', async ({ page }) => {
        await page.goto('/settings#security');

        // Click change password
        await page.click('button:has-text("Change Password")');

        // Fill password form
        await page.fill('input[name="currentPassword"]', 'password123');
        await page.fill('input[name="newPassword"]', 'NewPassword123!');
        await page.fill('input[name="confirmPassword"]', 'NewPassword123!');

        // Submit
        await page.click('button[type="submit"]');

        // Check success message
        await expect(page.locator('.success')).toBeVisible();
    });

    test('should validate password strength', async ({ page }) => {
        await page.goto('/settings#security');

        // Click change password
        await page.click('button:has-text("Change Password")');

        // Enter weak password
        await page.fill('input[name="currentPassword"]', 'password123');
        await page.fill('input[name="newPassword"]', 'weak');

        // Check for validation error
        await expect(page.locator('.password-strength.weak, .error:has-text("weak")')).toBeVisible();

        // Enter strong password
        await page.fill('input[name="newPassword"]', 'StrongPassword123!');

        // Check for strength indicator
        await expect(page.locator('.password-strength.strong, .success:has-text("strong")')).toBeVisible();
    });

    test('should enable two-factor authentication', async ({ page }) => {
        await page.goto('/settings#security');

        // Check if 2FA is available
        const tfaToggle = page.locator('input[name="twoFactorEnabled"], [data-testid="2fa-toggle"]');

        if (await tfaToggle.isVisible()) {
            // Enable 2FA
            await tfaToggle.check();

            // Check for QR code or setup instructions
            await expect(page.locator('.qr-code, .tfa-setup-instructions, [data-testid="tfa-setup"]')).toBeVisible();

            // Enter verification code (mock)
            await page.fill('input[name="verificationCode"]', '123456');

            // Confirm
            await page.click('button:has-text("Verify"), button:has-text("Enable")');

            // Check success message
            await expect(page.locator('.success')).toBeVisible();

            // Verify toggle is checked
            await expect(tfaToggle).toBeChecked();
        }
    });

    test('should export user data', async ({ page }) => {
        await page.goto('/settings#privacy');

        // Click export data button
        const downloadPromise = page.waitForEvent('download');
        await page.click('button:has-text("Export Data"), [data-testid="export-data"]');

        // Check for download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.(json|csv|zip)$/);
    });

    test('should delete account', async ({ page }) => {
        await page.goto('/settings#danger-zone');

        // Scroll to danger zone
        await page.locator('.danger-zone, [data-testid="danger-zone"]').scrollIntoViewIfNeeded();

        // Click delete account button
        await page.click('button:has-text("Delete Account"):has-text("danger"), [data-testid="delete-account"]');

        // Check for confirmation modal with warning
        const modal = page.locator('.modal.danger, .modal:has-text("Delete Account")');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.warning:has-text("irreversible")')).toBeVisible();

        // Type confirmation text
        await page.fill('input[name="confirmText"]', 'DELETE');

        // Note: Don't actually delete in test
        // await page.click('button:has-text("Delete Account")');
    });

    test('should display notification settings', async ({ page }) => {
        await page.goto('/settings#notifications');

        // Check notification options
        await expect(page.locator('input[name="emailNotifications"]')).toBeVisible();
        await expect(page.locator('input[name="taskCompleteNotifications"]')).toBeVisible();
        await expect(page.locator('input[name="errorNotifications"]')).toBeVisible();

        // Toggle a notification setting
        await page.check('input[name="taskCompleteNotifications"]');

        // Save
        await page.click('button:has-text("Save")');

        // Check success message
        await expect(page.locator('.success')).toBeVisible();
    });
});
