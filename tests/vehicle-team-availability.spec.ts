import { test, expect, type Page, type Response } from '@playwright/test';
import { addDays, format } from 'date-fns';
import { randomUUID } from 'node:crypto';

test.use({ timezoneId: 'Asia/Manila' });
test.describe.configure({ retries: 0 });
const runId = randomUUID();

function apiPath(response: Response) {
  return new URL(response.url()).pathname.replace(/^\/api(?=\/|$)/, '');
}
function responseFor(page: Page, path: string, method = 'GET') {
  return page.waitForResponse(response => apiPath(response) === path && response.request().method() === method);
}
async function chooseLicenseExpiry(page: Page, form: ReturnType<Page['getByRole']>, date: Date) {
  const field = form.locator('div.block').filter({
    has: page.locator('span').filter({ hasText: /^License Expiry \*$/ }),
  });
  await field.locator('button[aria-haspopup="dialog"]').click();
  const calendar = page.locator('[data-datepicker-portal]');
  await expect(calendar).toBeVisible();
  const day = calendar.getByRole('button', { name: format(date, 'PPPP'), exact: true });
  for (let month = 0; month < 4 && !(await day.isVisible()); month++) {
    await calendar.getByRole('button', { name: 'Go to the Next Month' }).click();
  }
  await expect(day).toBeEnabled();
  await day.click();
  await expect(calendar).toBeHidden();
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const expiry = addDays(new Date(`${today}T12:00:00`), 45);

test('Vehicle and Team Availability: create a driver and helper through the gateway', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('you@welinc.com').fill(process.env.E2E_ADMIN_EMAIL || 'bms.admin@welinc.com');
  await page.getByPlaceholder('Enter password').fill(process.env.E2E_ADMIN_PASSWORD || 'admin1234');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };

  const driver = {
    fullName: `codex-e2e-driver-${runId}`,
    email: `codex-e2e-${runId}@example.test`,
    licenseNo: `E2E-${runId.slice(0, 8)}`,
    phone: '9174638205',
    emergencyName: `E2E emergency ${runId.slice(0, 8)}`,
    emergencyPhone: '9185726394',
  };
  await page.getByRole('button', { name: 'Vehicle & Team Availability', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'VEHICLE & TEAM AVAILABILITY', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Drivers', exact: true }).click();
  await page.getByRole('button', { name: 'ADD DRIVER', exact: true }).click();
  const driverForm = page.getByRole('dialog', { name: 'Add new driver', exact: true });
  await expect(driverForm).toBeVisible();
  await driverForm.getByPlaceholder('Full name', { exact: true }).fill(driver.fullName);
  const personal = driverForm.locator('section').filter({ has: page.getByRole('heading', { name: 'Personal Information' }) });
  const emergency = driverForm.locator('section').filter({ has: page.getByRole('heading', { name: 'Emergency Details' }) });
  await personal.getByRole('textbox', { name: 'Philippine mobile number' }).fill(driver.phone);
  await driverForm.getByPlaceholder('Email address', { exact: true }).fill(driver.email);
  await driverForm.getByPlaceholder('License number', { exact: true }).fill(driver.licenseNo);
  await chooseLicenseExpiry(page, driverForm, expiry);
  await driverForm.getByPlaceholder('Emergency contact', { exact: true }).fill(driver.emergencyName);
  await emergency.getByRole('textbox', { name: 'Philippine mobile number' }).fill(driver.emergencyPhone);
  const driverSaving = responseFor(page, '/bms/config/drivers', 'POST');
  await driverForm.getByRole('button', { name: 'Save', exact: true }).click();
  const savedDriverResponse = await driverSaving;
  expect(savedDriverResponse.ok(), `Create driver returned ${savedDriverResponse.status()}`).toBeTruthy();
  const savedDriver = await savedDriverResponse.json();
  expect(savedDriver).toMatchObject({
    fullName: driver.fullName, email: driver.email, licenseNo: driver.licenseNo,
    status: 'Available', emergencyName: driver.emergencyName,
  });
  await expect(page.getByRole('row').filter({ hasText: driver.fullName })).toHaveCount(1);
  const driverList = await page.request.get('http://127.0.0.1:3005/api/bms/config/drivers', { headers });
  expect(driverList.ok()).toBeTruthy();
  expect((await driverList.json()).find((item: { id: string }) => item.id === savedDriver.id)).toMatchObject({
    fullName: driver.fullName, email: driver.email, licenseNo: driver.licenseNo,
  });

  const helper = {
    fullName: `codex-e2e-helper-${runId}`,
    phone: '9175826403',
    emergencyName: `E2E helper emergency ${runId.slice(0, 8)}`,
    emergencyPhone: '9186937514',
  };
  await page.getByRole('button', { name: 'Helpers', exact: true }).click();
  await page.getByRole('button', { name: 'ADD HELPER', exact: true }).click();
  const helperForm = page.getByRole('dialog', { name: 'Add new helper', exact: true });
  await expect(helperForm).toBeVisible();
  await helperForm.getByPlaceholder('Full name', { exact: true }).fill(helper.fullName);
  const helperPersonal = helperForm.locator('section').filter({ has: page.getByRole('heading', { name: 'Personal Information' }) });
  const helperEmergency = helperForm.locator('section').filter({ has: page.getByRole('heading', { name: 'Emergency Details' }) });
  await helperPersonal.getByRole('textbox', { name: 'Philippine mobile number' }).fill(helper.phone);
  await helperForm.getByPlaceholder('Emergency contact', { exact: true }).fill(helper.emergencyName);
  await helperEmergency.getByRole('textbox', { name: 'Philippine mobile number' }).fill(helper.emergencyPhone);
  const helperSaving = responseFor(page, '/bms/config/helpers', 'POST');
  await helperForm.getByRole('button', { name: 'Save', exact: true }).click();
  const savedHelperResponse = await helperSaving;
  expect(savedHelperResponse.ok(), `Create helper returned ${savedHelperResponse.status()}`).toBeTruthy();
  const savedHelper = await savedHelperResponse.json();
  expect(savedHelper).toMatchObject({
    fullName: helper.fullName, status: 'Available', emergencyName: helper.emergencyName,
  });
  await expect(page.getByRole('row').filter({ hasText: helper.fullName })).toHaveCount(1);
  const helperList = await page.request.get('http://127.0.0.1:3005/api/bms/config/helpers', { headers });
  expect(helperList.ok()).toBeTruthy();
  expect((await helperList.json()).find((item: { id: string }) => item.id === savedHelper.id)).toMatchObject({
    fullName: helper.fullName, emergencyName: helper.emergencyName,
  });
});