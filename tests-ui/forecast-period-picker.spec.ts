import { expect, test, type Page } from '@playwright/test';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const TOKEN = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'admin-1', email: 'admin@example.test', roles: [{ role: 'ADMIN', system: 'BMS' }], exp: 4102444800 })}.sig`;

async function openForecast(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-10T04:00:00Z'));
  await page.addInitScript((token) => { localStorage.setItem('token', token); }, TOKEN);
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (path === '/auth/me') return route.fulfill({ json: { id: 'admin-1', name: 'Admin', username: 'admin', email: 'admin@example.test', isActive: true, roles: [{ role: 'ADMIN', system: 'BMS' }], createdAt: '2026-01-01', deletionRequestStatus: 'NONE' } });
    if (path === '/approvals/counts') return route.fulfill({ json: { total: 0 } });
    if (route.request().method() !== 'GET') return route.fulfill({ json: {} });
    return route.fulfill({ json: [] });
  });
  await page.goto('/admin/reports');
  await page.getByRole('button', { name: 'AI Demand Forecast' }).click();
  return page.getByRole('button', { name: /^Forecast period:/ });
}

test('typing filters the forecast periods and Enter picks the match', async ({ page }) => {
  const picker = await openForecast(page);
  await expect(picker).toHaveAccessibleName('Forecast period: Next month (Dec 2026)');
  await picker.click();

  const search = page.getByRole('combobox', { name: 'Search forecast periods' });
  await expect(search).toBeFocused();
  const items = page.getByRole('option');
  await expect(items).toHaveText(['Next month (Dec 2026)', 'Next 7 days', 'Next 30 days', 'Next 90 days']);

  await search.fill('week');
  await expect(items).toHaveText(['Next 7 days']);
  await search.press('Enter');
  await expect(picker).toHaveAccessibleName('Forecast period: Next 7 days');
  await expect(search).toHaveCount(0);
  await expect(picker).toBeFocused();
});

test('search matches month names, numbers and words like quarter', async ({ page }) => {
  const picker = await openForecast(page);
  await picker.click();
  const search = page.getByRole('combobox', { name: 'Search forecast periods' });
  const items = page.getByRole('option');

  await search.fill('december');
  await expect(items).toHaveText(['Next month (Dec 2026)']);
  await search.fill('quarter');
  await expect(items).toHaveText(['Next 90 days']);
  await search.fill('30');
  await expect(items.first()).toHaveText('Next 30 days');
  await search.fill('xyz');
  await expect(items).toHaveCount(0);
  await expect(page.getByText('No period matches “xyz”.')).toBeVisible();

  await search.press('Escape');
  await expect(search).toHaveCount(0);
  await expect(picker).toHaveAccessibleName('Forecast period: Next month (Dec 2026)');
});

test('clicking an option picks it and reopening starts with an empty search', async ({ page }) => {
  const picker = await openForecast(page);
  await picker.click();
  await page.getByRole('combobox', { name: 'Search forecast periods' }).fill('90');
  await page.getByRole('option', { name: 'Next 90 days' }).click();
  await expect(picker).toHaveAccessibleName('Forecast period: Next 90 days');
  await picker.click();
  await expect(page.getByRole('combobox', { name: 'Search forecast periods' })).toHaveValue('');
  await expect(page.getByRole('option')).toHaveCount(4);
});
