import { sessionToken } from './session-helpers';
import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Manila' });
test.describe.configure({ retries: 0 });

/**
 * Spec bms/0012: drivers and helpers are the people with that role in Auth. They show up on Team
 * Management by themselves, with the name, email and contact number of their account; BMS has no
 * Add or Delete, and edits only its own details there.
 */
test('Team Management lists crew from their accounts and edits only BMS details', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@welinc.com').fill(process.env.E2E_ADMIN_EMAIL || 'bms.admin@welinc.com');
  await page.getByPlaceholder('Enter password').fill(process.env.E2E_ADMIN_PASSWORD || 'admin1234');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const token = await sessionToken(page);
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };

  const listed = await page.request.get('http://localhost:3000/bms/config/drivers', { headers });
  expect(listed.ok()).toBeTruthy();
  const drivers: Array<Record<string, unknown>> = await listed.json();
  expect(drivers.length).toBeGreaterThan(0);
  for (const driver of drivers) {
    expect(driver.userId).toEqual(expect.any(String));
    for (const gone of ['empId', 'initials', 'totalTrips']) expect(driver).not.toHaveProperty(gone);
  }
  const first = drivers[0] as { id: string; userId: string; fullName: string; emergencyName: string };

  // Account fields can't be changed from BMS.
  const refused = await page.request.patch(`http://localhost:3000/bms/config/drivers/${first.id}`, { headers, data: { fullName: 'Someone else' } });
  expect(refused.status()).toBe(400);

  await page.getByRole('button', { name: 'Team Management', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'TEAM MANAGEMENT', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^ADD (DRIVER|HELPER)$/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Employee ID' })).toHaveCount(0);

  const row = page.getByRole('row').filter({ hasText: first.fullName });
  // One Edit button per row; no menu, no Delete. The portal link is inside the form.
  await expect(row.getByRole('button', { name: `Actions for ${first.fullName}` })).toHaveCount(0);
  await row.getByRole('button', { name: `Edit ${first.fullName}` }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByRole('link', { name: 'Edit in portal' })).toHaveAttribute('href', new RegExp(`/admin/people/${first.userId}\\?system=BMS$`));
  await expect(form.getByLabel('Full name')).toHaveCount(0);
  await expect(form.getByLabel('License number')).toBeVisible();
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();

  // The BMS details save, and the account's name comes back unchanged.
  const emergencyName = `E2E emergency ${Date.now()}`;
  const saved = await page.request.patch(`http://localhost:3000/bms/config/drivers/${first.id}`, { headers, data: { emergencyName } });
  expect(saved.ok()).toBeTruthy();
  expect(await saved.json()).toMatchObject({ id: first.id, emergencyName, fullName: first.fullName });
  await page.request.patch(`http://localhost:3000/bms/config/drivers/${first.id}`, { headers, data: { emergencyName: first.emergencyName } });
});
