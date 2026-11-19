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
  use: { baseURL: 'http://localhost:8003', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host localhost --port 8003 --strictPort',
    url: 'http://localhost:8003/login',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {VITE_API_BASE_URL:'http://localhost:3000',VITE_PORTAL_URL:'http://localhost:8000'},
  },
});
