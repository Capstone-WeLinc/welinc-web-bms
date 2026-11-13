import { defineConfig, devices } from '@playwright/test';

/**
 * UI tests with every API call mocked: no backend or database needed.
 * Run with `npm run test:ui`. The full ecosystem suite stays in playwright.config.ts.
 */
export default defineConfig({
  testDir: './tests-ui',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
