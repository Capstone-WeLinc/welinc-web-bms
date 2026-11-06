import { test, expect } from '@playwright/test';

test('Scheduling and Job Order screens read BMS and partner data through the gateway', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@welinc.com').fill(process.env.E2E_OPS_EMAIL || 'ops.user@welinc.com');
  await page.getByPlaceholder('Enter password').fill(process.env.E2E_OPS_PASSWORD || 'ops1234');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/operations\/dashboard$/);

  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };
  const paths = ['/scheduling', '/bms/config/vehicles', '/bms/config/drivers', '/bms/config/helpers',
    '/bms/config/garages', '/job-order', '/job-order/assigned-bookings'];
  for (const path of paths) {
    const response = await page.request.get(`http://127.0.0.1:3005/api${path}`, { headers });
    expect(response.ok(), `GET gateway ${path}: ${response.status()}`).toBeTruthy();
    expect(await response.json(), `${path} returns the expected list`).toEqual(expect.any(Array));
  }

  for (const [label, path] of [['Scheduling', '/operations/scheduling'], ['Job Order', '/operations/job-order']] as const) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
    await expect(page.getByRole('heading').first()).toBeVisible();
  }
});
