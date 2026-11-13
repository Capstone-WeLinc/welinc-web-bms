import { expect, test, type Route } from '@playwright/test';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const TOKEN = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'admin-1', email: 'admin@example.test', roles: [{ role: 'ADMIN', system: 'BMS' }], exp: 4102444800 })}.sig`;

const MONTHS = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
const REPORT = {
  params: { from: '2025-11-11', to: '2026-11-10', serviceId: 'All', vehicleId: 'All', timezone: 'Asia/Manila', includesCancelledInTotal: false },
  totals: { bookings: 62, withVehicle: 0, unassigned: 62, completed: 0, cancelled: 2, jobOrders: 0, jobOrdersNotDistributed: 0 },
  monthly: MONTHS.map((month) => ({ month, completed: 0, cancelled: month === '2026-11' ? 2 : 0 })),
  jobsPerVehicle: [] as { vehicleId: string; plate: string; alias: string | null; jobs: number }[],
};
const SNAPSHOT = {
  vehicles: { total: 12, available: 10, assigned: 0, underMaintenance: 1, underRepair: 1 },
  drivers: { onRoster: 13, available: 13, onDuty: 0, onLeave: 0 },
  helpers: { onRoster: 20, available: 20, onDuty: 0, onLeave: 0 },
};

interface Mocks {
  operational: URL[];
  snapshot: URL[];
  operationalHandler?: (route: Route, attempt: number) => Promise<void>;
  snapshotHandler?: (route: Route, attempt: number) => Promise<void>;
}

async function openReport(page: Page, mocks: Mocks) {
  await page.clock.setFixedTime(new Date('2026-11-10T04:00:00Z'));
  await page.addInitScript((token) => { localStorage.setItem('token', token); }, TOKEN);
  // Only backend calls: Vite also serves source modules from src/lib/api/.
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    if (path === '/reports/operational') {
      mocks.operational.push(url);
      if (mocks.operationalHandler) return mocks.operationalHandler(route, mocks.operational.length);
      return route.fulfill({ json: REPORT });
    }
    if (path === '/reports/resources-snapshot') {
      mocks.snapshot.push(url);
      if (mocks.snapshotHandler) return mocks.snapshotHandler(route, mocks.snapshot.length);
      return route.fulfill({ json: SNAPSHOT });
    }
    if (path === '/auth/me') {
      return route.fulfill({ json: { id: 'admin-1', name: 'Admin', username: 'admin', email: 'admin@example.test', isActive: true, roles: [{ role: 'ADMIN', system: 'BMS' }], createdAt: '2026-01-01', deletionRequestStatus: 'NONE' } });
    }
    if (path === '/bms/config/vehicles') return route.fulfill({ json: [{ id: 'v1', plateNumber: 'ABC 1234', alias: 'Truck 1', status: 'AVAILABLE' }] });
    if (path === '/approvals/counts') return route.fulfill({ json: { total: 0 } });
    if (route.request().method() !== 'GET') return route.fulfill({ json: {} });
    return route.fulfill({ json: [] });
  });
  await page.goto('/admin/reports');
  await page.getByRole('button', { name: 'Operational Report' }).click();
  return page.getByTestId('operational-report');
}

const freshMocks = (): Mocks => ({ operational: [], snapshot: [] });

test('shows the four cards in order, without on-time arrival', async ({ page }) => {
  const report = await openReport(page, freshMocks());
  const cards = report.getByTestId('performance-cards').locator('[data-card]');
  await expect(cards).toHaveCount(4);
  await expect(cards).toHaveText([/Total bookings\s*62\s*Received in this period/, /Bookings with a vehicle\s*0%\s*62 still unassigned/, /Completed services\s*0\s*2 cancelled/, /Job orders\s*0\s*All distributed/]);
  // Same KPI card styling as the Admin dashboard, and no section heading.
  await expect(cards.first().locator('> div')).toHaveClass(/rounded-xl/);
  await expect(page.getByText('Performance this period', { exact: true })).toHaveCount(0);
  await expect(report.getByText(/on-time arrival/i)).toHaveCount(0);
  await expect(report.getByText('Vehicle status')).toHaveCount(0);
  await expect(report.getByRole('link', { name: /View details/ })).toHaveCount(1);
});

test('the shared report filter bar drives the Operational tab', async ({ page }) => {
  await openReport(page, freshMocks());
  const filters = page.getByRole('group', { name: 'Report filters' });
  await expect(filters).toBeVisible();
  await expect(filters.locator('#reports-date-range')).toHaveValue(/2025.*to.*2026/);
  await expect(filters.locator('#reports-service')).toBeVisible();
  await expect(filters.locator('#reports-vehicle')).toBeVisible();
  await expect(filters.getByRole('button', { name: /Save report/ })).toBeVisible();
  await expect(page.getByTestId('operational-report').getByRole('group', { name: 'Report filters' })).toHaveCount(0);
});

test('chart has a continuous 13-month axis and an accessible label', async ({ page }) => {
  const report = await openReport(page, freshMocks());
  const chart = report.getByTestId('closed-jobs-card').locator('[data-months]');
  await expect(chart).toHaveAttribute('role', 'img');
  await expect(chart).toHaveAttribute('data-months', '13');
  await expect(chart).toHaveAttribute('aria-label', /0 completed and 2 cancelled in total\. November 2026: 0 completed, 2 cancelled\./);
  // 13 evenly spaced slots; at this width every second month is labelled (Nov 25, Jan 26, ... Nov 26).
  const labels = chart.locator('.recharts-cartesian-axis-tick-value').filter({ hasText: /^[A-Z][a-z]{2} \d{2}$/ });
  await expect(labels).toHaveText(['Nov 25', 'Jan 26', 'Mar 26', 'May 26', 'Jul 26', 'Sep 26', 'Nov 26']);
  await expect(chart.locator('.recharts-bar-rectangle')).toHaveCount(1);
});

test('jobs per vehicle empty state uses full dates', async ({ page }) => {
  const report = await openReport(page, freshMocks());
  const empty = report.getByTestId('vehicles-empty');
  await expect(empty).toContainText('No vehicles assigned yet');
  await expect(empty).toContainText('Confirmed assignments for Nov 11, 2025 to Nov 10, 2026 will show up here.');
});

test('jobs per vehicle ranks vehicles when there is data', async ({ page }) => {
  const mocks = freshMocks();
  mocks.operationalHandler = (route) => route.fulfill({ json: { ...REPORT, jobsPerVehicle: [{ vehicleId: 'v2', plate: 'XYZ 9876', alias: null, jobs: 1 }, { vehicleId: 'v1', plate: 'ABC 1234', alias: 'Truck 1', jobs: 3 }] } });
  const report = await openReport(page, mocks);
  const rows = report.getByTestId('jobs-per-vehicle-card').locator('.opr-vehicle');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('ABC 1234');
  await expect(rows.first().locator('.opr-vehicle-count')).toContainText('3');
});

test('resources card shows today’s counts and ignores the date range and filters', async ({ page }) => {
  const mocks = freshMocks();
  const report = await openReport(page, mocks);
  const resources = report.getByTestId('resources-card');
  await expect(resources.locator('[data-resource="vehicles"]')).toContainText('12 in fleet');
  await expect(resources.locator('[data-resource="vehicles"] .opr-legend')).toHaveText(/Available 10\s*Assigned 0\s*Under maintenance 1\s*Under repair 1/);
  await expect(resources.locator('[data-resource="drivers"]')).toContainText('13 on roster');
  await expect(resources.locator('[data-resource="helpers"] .opr-legend')).toHaveText(/Available 20\s*On duty 0\s*On leave 0/);

  await expect.poll(() => mocks.snapshot.length).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  const snapshotCalls = mocks.snapshot.length;
  await page.locator('#reports-service').click();
  await page.getByRole('option', { name: 'Lipat Bahay' }).click();
  await page.locator('#reports-vehicle').click();
  await page.getByRole('option', { name: 'ABC 1234' }).click();
  await expect.poll(() => mocks.operational.at(-1)?.searchParams.get('vehicleId')).toBe('v1');
  expect(mocks.operational.at(-1)?.searchParams.get('serviceId')).toBe('Lipat Bahay');
  expect(mocks.operational.at(-1)?.searchParams.get('from')).toBe('2025-11-11');
  await page.waitForTimeout(300);
  expect(mocks.snapshot).toHaveLength(snapshotCalls);
  expect([...mocks.snapshot[0].searchParams.keys()]).toEqual([]);
});

test('shows loading skeletons, then an error with a working retry', async ({ page }) => {
  const mocks = freshMocks();
  // Dev mode runs effects twice (React StrictMode), so failures are switched by flags, not by attempt number.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let failing = true;
  mocks.operationalHandler = async (route) => {
    if (!failing) return route.fulfill({ json: REPORT });
    await gate;
    return route.fulfill({ status: 500, json: { message: 'down' } });
  };
  mocks.snapshotHandler = async (route) => {
    if (!failing) return route.fulfill({ json: SNAPSHOT });
    await gate;
    return route.fulfill({ status: 503, json: {} });
  };
  const report = await openReport(page, mocks);

  await expect(report.getByTestId('performance-cards').getByRole('status')).toHaveCount(4);
  await expect(report.getByTestId('resources-card').getByRole('status')).toHaveCount(1);
  release();
  await expect(report.getByText('The figures for this period couldn’t be loaded.')).toBeVisible();
  await expect(report.getByTestId('resources-card').getByRole('alert')).toContainText('Today’s fleet and roster couldn’t be loaded.');
  failing = false;

  await report.getByRole('alert').filter({ hasText: 'figures for this period' }).getByRole('button', { name: 'Try again' }).click();
  await expect(report.getByTestId('performance-cards').locator('[data-card]')).toHaveCount(4);
  await report.getByTestId('resources-card').getByRole('button', { name: 'Try again' }).click();
  await expect(report.getByTestId('resources-card')).toContainText('12 in fleet');
});

test('export offers PDF and Excel of the filtered view', async ({ page }) => {
  const report = await openReport(page, freshMocks());
  await expect(report.locator('[data-card]')).toHaveCount(4);
  const filters = page.getByRole('group', { name: 'Report filters' });
  await filters.getByText('Export', { exact: true }).click();
  const [excel] = await Promise.all([page.waitForEvent('download'), filters.getByRole('button', { name: 'Excel' }).click()]);
  expect(excel.suggestedFilename()).toMatch(/^welinc-operational-report-.*\.xlsx$/);
  const [pdf] = await Promise.all([page.waitForEvent('download'), filters.getByRole('button', { name: 'PDF' }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^welinc-operational-report-.*\.pdf$/);
});
