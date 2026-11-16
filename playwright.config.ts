import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Local workflows share fixture databases, so execute serially. */
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: 'http://localhost:8003',
    trace: 'on-first-retry',
  },

  /* The local ecosystem acceptance run targets Chromium. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

  ],

  // Start Vite automatically, or reuse a running local frontend.
  // The backend and its database must be running separately for login/bookings.
  webServer: {
    command: 'npm run dev -- --host localhost --port 8003 --strictPort',
    url: 'http://localhost:8003/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {VITE_API_BASE_URL:'http://localhost:3000',VITE_PORTAL_URL:'http://localhost:8000'},
  },
});
