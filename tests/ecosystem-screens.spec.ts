import { test, expect, type Page, type TestInfo } from '@playwright/test';

type Credentials = { email: string; password: string };
type Screen = { label: string; path: string };

const accounts: Record<'admin' | 'cs' | 'ops', Credentials> = {
  admin: { email: process.env.E2E_ADMIN_EMAIL || 'bms.admin@welinc.com', password: process.env.E2E_ADMIN_PASSWORD || 'admin1234' },
  cs: { email: process.env.E2E_CS_EMAIL || 'cs.user@welinc.com', password: process.env.E2E_CS_PASSWORD || 'cs1234' },
  ops: { email: process.env.E2E_OPS_EMAIL || 'ops.user@welinc.com', password: process.env.E2E_OPS_PASSWORD || 'ops1234' },
};

const screens: Record<keyof typeof accounts, Screen[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Settings', path: '/admin/settings' },
    { label: 'Profile', path: '/admin/profile' },
    { label: 'User Accounts', path: '/admin/users' },
    { label: 'Activity Logs', path: '/admin/activity-logs' },
    { label: 'Services Offered', path: '/admin/services-offered' },
    { label: 'Booking', path: '/admin/booking' },
    { label: 'Scheduling', path: '/admin/scheduling' },
    { label: 'Job Order', path: '/admin/job-order' },
    { label: 'Vehicle & Team Availability', path: '/admin/vehicle-availability' },
    { label: 'Post-Service', path: '/admin/post-service' },
    { label: 'Sales Report', path: '/admin/sales-report' },
    { label: 'Analytics & Reports', path: '/admin/reports' },
  ],
  cs: [
    { label: 'Dashboard', path: '/cs/dashboard' },
    { label: 'Bookings', path: '/cs/bookings' },
    { label: 'Daily Sales', path: '/cs/daily-sales' },
    { label: 'Post Service', path: '/cs/post-service' },
    { label: 'Profile', path: '/cs/profile' },
  ],
  ops: [
    { label: 'Dashboard', path: '/operations/dashboard' },
    { label: 'Scheduling', path: '/operations/scheduling' },
    { label: 'Vehicle & Team Availability', path: '/operations/vehicle-availability' },
    { label: 'Job Order', path: '/operations/job-order' },
    { label: 'Profile', path: '/operations/profile' },
  ],
};

async function signIn(page: Page, credentials: Credentials) {
  await page.goto('/login');
  await page.getByPlaceholder('you@welinc.com').fill(credentials.email);
  await page.getByPlaceholder('Enter password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/(admin|cs|operations)\/dashboard$/);
}

async function visitScreens(page: Page, testInfo: TestInfo, role: keyof typeof accounts) {
  const failures: string[] = [];
  const fleetRequests: string[] = [];
  const legacyFleetRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`));
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/api\/bms\/config\/(vehicles|drivers|garages)(\/|$)/.test(pathname)) fleetRequests.push(pathname);
    if (/\/api\/(vehicles|drivers|garages)(\/|$)/.test(pathname)) legacyFleetRequests.push(pathname);
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === 'http://127.0.0.1:5173' && response.status() >= 400) {
      failures.push(`HTTP ${response.status()} ${url.pathname}`);
    }
  });

  await signIn(page, accounts[role]);
  for (const screen of screens[role]) {
    await test.step(`${role}: open ${screen.label}`, async () => {
      await page.goto(screen.path);
      await expect(page).toHaveURL(new RegExp(`${screen.path.replaceAll('/', '\\/')}$`));
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/Internal Server Error|Unexpected error/i);
    });
  }

  if (role !== 'admin') {
    await page.goto('/admin/booking');
    const dashboard = role === 'cs' ? '/cs/dashboard' : '/operations/dashboard';
    await expect(page).toHaveURL(new RegExp(`${dashboard.replaceAll('/', '\\/')}$`));
    await expect(page.getByRole('heading').first()).toBeVisible();
  }
  expect(legacyFleetRequests, `${role} must not read fleet data from the legacy bridge API`).toEqual([]);
  if (role === 'admin' || role === 'ops') {
    await expect.poll(() => fleetRequests.length, { message: `${role} fleet screens should use Dispatch's BMS fleet API` }).toBeGreaterThan(0);
  }
  await testInfo.attach(`${role}-browser-diagnostics.json`, {
    body: JSON.stringify(failures, null, 2),
    contentType: 'application/json',
  });
  expect(failures, `${role} screen browser/API errors`).toEqual([]);
}

test('Administrator can open every BMS and integration screen', async ({ page }, testInfo) => {
  await visitScreens(page, testInfo, 'admin');
});

test('Customer Support can open every permitted BMS screen', async ({ page }, testInfo) => {
  await visitScreens(page, testInfo, 'cs');
});

test('Operations can open every permitted BMS screen', async ({ page }, testInfo) => {
  await visitScreens(page, testInfo, 'ops');
});
