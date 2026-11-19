import { test, expect } from '@playwright/test';

test('BMS app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/./);
});