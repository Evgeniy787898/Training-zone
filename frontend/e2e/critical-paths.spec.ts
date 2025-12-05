/**
 * TZONA E2E Tests - Critical User Paths
 * 
 * These tests cover the most important user journeys:
 * 1. App loads correctly
 * 2. Navigation works
 * 3. Core features are accessible
 */

import { test, expect } from '@playwright/test';

test.describe('Critical Path: App Loading', () => {
    test('app loads and shows main content', async ({ page }) => {
        await page.goto('/');

        // Wait for app to hydrate
        await page.waitForLoadState('networkidle');

        // App should load without errors
        await expect(page).toHaveTitle(/TZONA|Тренировочная зона/i);
    });

    test('app shows loading state initially', async ({ page }) => {
        await page.goto('/');

        // Either shows loading or main content
        const hasContent = await page.locator('body').textContent();
        expect(hasContent).toBeTruthy();
    });
});

test.describe('Critical Path: Navigation', () => {
    test('today page is accessible', async ({ page }) => {
        await page.goto('/today');
        await page.waitForLoadState('networkidle');

        // Should not show error page
        const pageContent = await page.textContent('body');
        expect(pageContent).not.toContain('404');
    });

    test('exercises page is accessible', async ({ page }) => {
        await page.goto('/exercises');
        await page.waitForLoadState('networkidle');

        // Should not show error page
        const pageContent = await page.textContent('body');
        expect(pageContent).not.toContain('404');
    });

    test('settings page is accessible', async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');

        // Should not show error page
        const pageContent = await page.textContent('body');
        expect(pageContent).not.toContain('404');
    });
});

test.describe('Critical Path: API Health', () => {
    test('health endpoint responds', async ({ request }) => {
        const response = await request.get('/api/health');

        // API should respond (may be 200 OK or redirect)
        expect(response.status()).toBeLessThan(500);
    });
});

test.describe('Critical Path: Mobile Responsiveness', () => {
    test('app is usable on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Should have valid content
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });
});
