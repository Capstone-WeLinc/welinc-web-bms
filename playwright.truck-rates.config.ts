import { defineConfig } from '@playwright/test';

// Isolated logic tests: intentionally no app server, browser, or ecosystem
// global setup (which resets shared local test data).
export default defineConfig({
  testDir: './tests',
  testMatch: 'truck-rates.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
