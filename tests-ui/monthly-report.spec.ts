import { expect, test, type Page } from '@playwright/test';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const TOKEN = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'admin-1', email: 'admin@example.test', roles: [{ role: 'ADMIN', system: 'BMS' }], exp: 4102444800 })}.sig`;

// 18 trips in October, 54 in November (month in progress), 2 cancelled; one verified GCash payment in October.
const services = ['Lipat Bahay', 'Office Pull out', 'Corporate Delivery', 'Unit to Unit Transfer'];
const BOOKINGS = [
  ...Array.from({ length: 18 }, (_, i) => ({ id: `oct-${i}`, bookingNo: `OCT-${i}`, client: 'Client', service: services[i % 4], date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, status: 'For Plotting', amount: 0 })),
  ...Array.from({ length: 54 }, (_, i) => ({ id: `nov-${i}`, bookingNo: `NOV-${i}`, client: 'Client', service: services[i % 2], date: `2026-11-${String((i % 9) + 1).padStart(2, '0')}`, status: 'For Plotting', amount: 0 })),
  { id: 'c1', bookingNo: 'C1', client: 'Client', service: 'Lipat Bahay', date: '2026-11-03', status: 'Cancelled', amount: 0 },
  { id: 'c2', bookingNo: 'C2', client: 'Client', service: 'Lipat Bahay', date: '2026-11-04', status: 'Cancelled', amount: 0 },
];
const SALES = [{ id: 's1', date: '2026-10-15', bookingNo: 'OCT-0', status: 'Submitted', gcashPayment: 5950, totalDailySales: 5950 }];

async function openMonthly(page: Page, extraBookings: object[] = []) {
  await page.clock.setFixedTime(new Date('2026-11-10T04:00:00Z'));
  await page.addInitScript((token) => { localStorage.setItem('token', token); }, TOKEN);
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (path === '/auth/me') return route.fulfill({ json: { id: 'admin-1', name: 'Admin', username: 'admin', email: 'admin@example.test', isActive: true, roles: [{ role: 'ADMIN', system: 'BMS' }], createdAt: '2026-01-01', deletionRequestStatus: 'NONE' } });
    if (path === '/booking') return route.fulfill({ json: [...BOOKINGS, ...extraBookings] });
    if (path === '/daily-sales') return route.fulfill({ json: SALES });
    if (path === '/approvals/counts') return route.fulfill({ json: { total: 0 } });
    if (route.request().method() !== 'GET') return route.fulfill({ json: {} });
    return route.fulfill({ json: [] });
  });
  await page.goto('/admin/reports');
  await page.getByRole('button', { name: 'Monthly Report' }).click();
  return page.getByTestId('monthly-report');
}

test('order: trend beside booking status, then service type beside payment method, then the table', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const report = await openMonthly(page);
  const box = async (id: string) => (await report.getByTestId(id).boundingBox())!;
  const trend = await box('monthly-trend-card');
  const status = await box('booking-status-card');
  const service = await box('service-type-card');
  const payment = await box('payment-card');
  const table = await box('month-table');
  expect(Math.abs(trend.y - status.y)).toBeLessThan(2);
  expect(status.x).toBeGreaterThan(trend.x + trend.width - 1);
  expect(trend.width).toBeGreaterThan(status.width);
  expect(service.y).toBeGreaterThan(Math.max(trend.y + trend.height, status.y + status.height) - 1);
  expect(Math.abs(service.y - payment.y)).toBeLessThan(2);
  expect(payment.x).toBeGreaterThan(service.x + service.width - 1);
  expect(table.y).toBeGreaterThan(Math.max(service.y + service.height, payment.y + payment.height) - 1);
});

test('cards show the figures, the month in progress and the booking status counts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const report = await openMonthly(page);
  const kpis = report.getByTestId('monthly-kpis');
  await expect(kpis).toContainText('Revenue, Nov 2026 so far');
  await expect(kpis).toContainText('Oct 2026: ₱5,950.00');
  await expect(kpis).toContainText('Revenue, last 12 months');
  await expect(kpis).toContainText(/Trips\s*72/);
  // ₱5,950 verified on one booking: the average is per paid trip, not spread over 72 trips.
  await expect(kpis).toContainText('Average per paid trip₱5,950.00Verified revenue ÷ 1 paid trip');

  const status = report.getByTestId('booking-status-card');
  await expect(status.getByText(/All bookings, including cancelled/)).toHaveCount(0);
  await expect(status.locator('li')).toHaveText([/For plotting\s*72/, /For verification\s*0/, /Assigned\s*0/, /Rescheduled\s*0/, /Completed\s*0/, /Cancelled\s*2/]);

  await expect(report.getByTestId('payment-card')).toContainText(/GCash\s*₱5,950.00\s*· 100%/);
  await expect(report.getByTestId('month-table').getByText('In progress')).toHaveCount(1);
  // 12M is exactly Dec 2025 to Nov 2026: 12 months, not 13.
  await expect(report.getByTestId('monthly-trend-card').locator('[data-months]')).toHaveAttribute('data-months', '12');
  await expect(kpis).toContainText('Dec 2025 to Nov 2026');
  await expect(report.getByTestId('month-table')).toContainText('of 12');
  await expect(report.getByTestId('monthly-trend-card').locator('[data-months]')).toHaveAttribute('aria-label', /Oct 2026: 18 trips; Nov 2026: 54 trips so far/);

  await report.getByRole('group', { name: 'Trend measure' }).getByRole('button', { name: 'Revenue' }).click();
  await expect(report.getByTestId('monthly-trend-card').locator('[data-months]')).toHaveAttribute('aria-label', /verified revenue per month.*Oct 2026: ₱5,950.00/);
});

test('on narrow screens booking status stacks under the trend, before service type', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1400 });
  const report = await openMonthly(page);
  const trend = (await report.getByTestId('monthly-trend-card').boundingBox())!;
  const status = (await report.getByTestId('booking-status-card').boundingBox())!;
  const service = (await report.getByTestId('service-type-card').boundingBox())!;
  expect(status.y).toBeGreaterThan(trend.y + trend.height - 1);
  expect(service.y).toBeGreaterThan(status.y + status.height - 1);
});

test('service type donut: main services only, then other services with Include unmapped', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const other = (id: string, service: string) => ({ id, bookingNo: id, client: 'Client', service, date: '2026-10-20', status: 'For Plotting', amount: 0 });
  const report = await openMonthly(page, [other('m1', 'Motorized'), other('m2', 'Motorized'), other('n1', 'NC: 6W 14 FT. W/ Lifter (2 Helpers)')]);
  const card = report.getByTestId('service-type-card');
  const legend = card.locator('.mr-donut-legend li');
  const checkbox = card.getByRole('checkbox', { name: 'Include unmapped' });

  await expect(checkbox).not.toBeChecked();
  await expect(card).toContainText('Main services by trips · 3 trips in 2 other services not shown');
  await expect(legend).toHaveText([/Lipat Bahay\s*32 \(44%\)/, /Office Pull Out\s*32 \(44%\)/, /Corporate Delivery\s*4 \(6%\)/, /Unit to Unit Transfer\s*4 \(6%\)/]);

  await checkbox.check();
  await expect(card).toContainText('All services by trips, including unmapped');
  await expect(legend).toHaveCount(6);
  await expect(legend.nth(4)).toHaveText(/Motorized\s*2 \(3%\)/);
  await expect(legend.nth(5)).toHaveText(/NC: 6W 14 FT\. W\/ Lifter \(2 Helpers\)\s*1 \(1%\)/);
  await expect(legend.first()).toHaveText(/Lipat Bahay\s*32 \(43%\)/);

  await checkbox.uncheck();
  await expect(legend).toHaveCount(4);
});

test('Include unmapped is disabled when every trip is a main service', async ({ page }) => {
  const report = await openMonthly(page);
  await expect(report.getByTestId('service-type-card').getByRole('checkbox', { name: 'Include unmapped' })).toBeDisabled();
});

test('bookings later this month are upcoming, not trips; the table shows paid trips', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const later = (id: string, date: string) => ({ id, bookingNo: id, client: 'Client', service: 'Lipat Bahay', date, status: 'For Plotting', amount: 0 });
  const report = await openMonthly(page, [later('f1', '2026-11-20'), later('f2', '2026-11-28'), later('f3', '2026-11-11')]);
  const kpis = report.getByTestId('monthly-kpis');
  // Today is Nov 10: the Nov 11, 20 and 28 bookings are booked, not trips yet.
  await expect(kpis).toContainText('Trips72Up to today · 3 more booked this month');
  await expect(report.getByTestId('monthly-trend-card').locator('[data-months]')).toHaveAttribute('aria-label', /Nov 2026: 54 trips so far/);
  const table = report.getByTestId('month-table');
  await expect(table.locator('thead th')).toHaveText(['Month', 'Trips', 'Revenue', 'Paid trips', 'Avg per paid trip', 'Vs prior month']);
  await expect(table.locator('tbody tr').filter({ hasText: 'Oct 2026' })).toHaveText(/Oct 2026\s*18\s*₱5,950.00\s*1\s*₱5,950.00/);
  await expect(table.locator('tfoot tr')).toHaveText(/Total\s*72\s*₱5,950.00\s*1\s*₱5,950.00/);
});
