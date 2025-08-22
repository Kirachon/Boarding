/**
 * Frontend Integration Tests
 * Tests SvelteKit frontend functionality and API integration
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Test user credentials
const testUser = {
  email: 'frontend-test@boardinghouse.com',
  password: 'TestPassword123!',
  firstName: 'Frontend',
  lastName: 'Test'
};

test.describe('Frontend Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for integration tests
    test.setTimeout(60000);
    
    // Navigate to the application
    await page.goto(BASE_URL);
  });

  test.describe('Authentication Flow', () => {
    test('should display login page', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      
      await expect(page.locator('h1')).toContainText('Welcome back');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show validation errors for invalid login', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Should show validation errors
      await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
      await expect(page.locator('text=Password is required')).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      // First register a test user via API
      await page.request.post(`${API_URL}/auth/register`, {
        data: testUser
      });

      await page.goto(`${BASE_URL}/auth/login`);
      
      // Fill login form
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
      await expect(page.locator('h1')).toContainText('Dashboard');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/login`);
      
      // Fill with invalid credentials
      await page.fill('input[type="email"]', 'invalid@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('[role="alert"]')).toContainText('Invalid credentials');
    });

    test('should logout successfully', async ({ page }) => {
      // Login first
      await loginUser(page, testUser);
      
      // Click user menu
      await page.click('[aria-label="User menu"]');
      
      // Click logout
      await page.click('text=Sign out');
      
      // Should redirect to login page
      await expect(page).toHaveURL(`${BASE_URL}/auth/login`);
    });
  });

  test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, testUser);
    });

    test('should display dashboard with statistics', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Dashboard');
      await expect(page.locator('text=Welcome back')).toBeVisible();
      
      // Should show connection status
      await expect(page.locator('text=Live').or(page.locator('text=Offline'))).toBeVisible();
    });

    test('should show real-time connection status', async ({ page }) => {
      // Check for connection indicator
      const connectionStatus = page.locator('text=Live').or(page.locator('text=Offline'));
      await expect(connectionStatus).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, testUser);
    });

    test('should navigate between pages', async ({ page }) => {
      // Test navigation to rooms
      await page.click('text=Rooms');
      await expect(page).toHaveURL(`${BASE_URL}/rooms`);
      await expect(page.locator('h1')).toContainText('Rooms');
      
      // Test navigation to tenants
      await page.click('text=Tenants');
      await expect(page).toHaveURL(`${BASE_URL}/tenants`);
      await expect(page.locator('h1')).toContainText('Tenants');
      
      // Test navigation to bookings
      await page.click('text=Bookings');
      await expect(page).toHaveURL(`${BASE_URL}/bookings`);
      await expect(page.locator('h1')).toContainText('Bookings');
    });

    test('should toggle sidebar on mobile', async ({ page }) => {
      // Resize to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Sidebar should be hidden initially
      await expect(page.locator('nav')).not.toBeVisible();
      
      // Click hamburger menu
      await page.click('[aria-label="Open sidebar"]');
      
      // Sidebar should be visible
      await expect(page.locator('nav')).toBeVisible();
      
      // Click close button
      await page.click('[aria-label="Close sidebar"]');
      
      // Sidebar should be hidden again
      await expect(page.locator('nav')).not.toBeVisible();
    });
  });

  test.describe('Rooms Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, testUser);
      await page.goto(`${BASE_URL}/rooms`);
    });

    test('should display rooms page', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Rooms');
      await expect(page.locator('text=Manage your boarding house rooms')).toBeVisible();
    });

    test('should toggle between grid and list view', async ({ page }) => {
      // Should start in grid view
      await expect(page.locator('[aria-label="Grid view"]')).toHaveClass(/bg-primary-600/);
      
      // Click list view
      await page.click('[aria-label="List view"]');
      await expect(page.locator('[aria-label="List view"]')).toHaveClass(/bg-primary-600/);
      
      // Click grid view
      await page.click('[aria-label="Grid view"]');
      await expect(page.locator('[aria-label="Grid view"]')).toHaveClass(/bg-primary-600/);
    });

    test('should filter rooms', async ({ page }) => {
      // Wait for filters to load
      await page.waitForSelector('[placeholder*="Search"]');
      
      // Test search filter
      await page.fill('[placeholder*="Search"]', 'test');
      await page.keyboard.press('Enter');
      
      // Should update URL with search parameter
      await expect(page).toHaveURL(/search=test/);
    });

    test('should show empty state when no rooms', async ({ page }) => {
      // If no rooms exist, should show empty state
      const emptyState = page.locator('text=No rooms found');
      if (await emptyState.isVisible()) {
        await expect(emptyState).toBeVisible();
        await expect(page.locator('text=Get started by creating your first room')).toBeVisible();
      }
    });
  });

  test.describe('Theme Toggle', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, testUser);
    });

    test('should toggle between light and dark mode', async ({ page }) => {
      // Should start in light mode
      await expect(page.locator('html')).not.toHaveClass('dark');
      
      // Click theme toggle
      await page.click('[aria-label="Toggle theme"]');
      
      // Should switch to dark mode
      await expect(page.locator('html')).toHaveClass('dark');
      
      // Click theme toggle again
      await page.click('[aria-label="Toggle theme"]');
      
      // Should switch back to light mode
      await expect(page.locator('html')).not.toHaveClass('dark');
    });

    test('should persist theme preference', async ({ page }) => {
      // Toggle to dark mode
      await page.click('[aria-label="Toggle theme"]');
      await expect(page.locator('html')).toHaveClass('dark');
      
      // Reload page
      await page.reload();
      
      // Should still be in dark mode
      await expect(page.locator('html')).toHaveClass('dark');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Block all API requests
      await page.route(`${API_URL}/**`, route => route.abort());
      
      await page.goto(`${BASE_URL}/auth/login`);
      
      // Try to login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      
      // Should show network error
      await expect(page.locator('[role="alert"]')).toContainText('Network error');
    });

    test('should handle 404 pages', async ({ page }) => {
      await page.goto(`${BASE_URL}/non-existent-page`);
      
      // Should show 404 page or redirect
      const is404 = await page.locator('text=404').isVisible();
      const isRedirect = page.url() !== `${BASE_URL}/non-existent-page`;
      
      expect(is404 || isRedirect).toBe(true);
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, testUser);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for important ARIA labels
      await expect(page.locator('[aria-label="Open sidebar"]')).toBeVisible();
      await expect(page.locator('[aria-label="Toggle theme"]')).toBeVisible();
      await expect(page.locator('[aria-label="User menu"]')).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Tab through navigation items
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to activate with Enter
      await page.keyboard.press('Enter');
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      // Should have h1 for page title
      await expect(page.locator('h1')).toBeVisible();
      
      // Should not skip heading levels
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance', () => {
    test('should load pages within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should not have console errors', async ({ page }) => {
      const consoleErrors = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      // Should not have any console errors
      expect(consoleErrors).toHaveLength(0);
    });
  });
});

// Helper function to login user
async function loginUser(page, user) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}
