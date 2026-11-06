import { test, expect, type Locator, type Page } from '@playwright/test';
import { format } from 'date-fns';
import { randomUUID } from 'node:crypto';

test.use({ timezoneId: 'Asia/Manila' });

function futureDate(days: number) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date;
}
function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
async function selectDate(page: Page, trigger: Locator, date: Date) {
  await trigger.click();
  const calendar = page.locator('[data-datepicker-portal]');
  await expect(calendar).toBeVisible();
  // react-day-picker includes ordinal days in its accessible date labels.
  const label = format(date, 'PPPP');
  const day = calendar.getByRole('button', { name: label, exact: true });
  for (let month = 0; month < 12 && !(await day.isVisible()); month++) {
    await calendar.getByRole('button', { name: 'Go to the Next Month' }).click();
  }
  await expect(day).toBeEnabled();
  await day.click();
  await expect(calendar).toBeHidden();
}
async function selectOption(page: Page, trigger: Locator, name: string) {
  await trigger.click();
  await page.getByRole('option', { name, exact: true }).click();
}
async function nextStep(wizard: Locator, step: number) {
  const next = wizard.getByRole('button', { name: 'Continue', exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(wizard.getByText(new RegExp(`^Step ${step} `))).toBeVisible();
}

test('Booking regression: create, verify saved details, edit, and reschedule', async ({ page }) => {
  test.setTimeout(120_000);
  // Realistic fictional details; the API booking number identifies each run.
  const customer = {
    firstName: 'Ben', lastName: 'Delos Santos',
    email: `codex-e2e-${randomUUID()}@example.test`, contact: '+639093776440',
    items: 'Two boxes of books', instructions: 'Call before arrival.',
  };
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const pickupDate = futureDate(7);
  const rescheduledDate = futureDate(14);
  const wizard = page.getByRole('dialog');
  const search = page.getByPlaceholder('Search booking no. or client...');
  let bookingNumber = '';

  await test.step('Sign in and open Bookings', async () => {
    await page.goto('/login');
    await page.getByPlaceholder('you@welinc.com').fill(process.env.E2E_CS_EMAIL || 'cs.user@welinc.com');
    await page.getByPlaceholder('Enter password').fill(process.env.E2E_CS_PASSWORD || 'cs1234');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.getByRole('button', { name: 'Bookings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'BOOKING', exact: true })).toBeVisible();
  });

  await test.step('Step 1: select service, truck, and permit', async () => {
    await page.getByRole('button', { name: 'NEW BOOKING', exact: true }).click();
    await expect(wizard.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await wizard.getByRole('button', { name: /Lipat Bahay Residential/ }).click();
    await expect(wizard.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await wizard.getByRole('button', { name: /6W 14ft\. with Lifter/ }).click();
    const permit = wizard.getByRole('checkbox', { name: /Barangay \/ Subdivision Permit Required/ });
    await permit.check();
    await expect(permit).toBeChecked();
    await nextStep(wizard, 2);
  });

  await test.step('Step 2: fill customer, addresses, and future pickup schedule', async () => {
    await expect(wizard.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await wizard.getByPlaceholder('First name', { exact: true }).fill(customer.firstName);
    await wizard.getByPlaceholder('Last name', { exact: true }).fill(customer.lastName);
    await wizard.getByPlaceholder('email@gmail.com').fill(customer.email);
    await wizard.getByPlaceholder('912 345 6789').fill('9093776440');
    await wizard.getByRole('button', { name: 'NC NCR', exact: true }).click();
    // Address selects are ordered pickup city/barangay, delivery city/barangay.
    const selects = wizard.getByRole('combobox');
    await selectOption(page, selects.nth(0), 'Caloocan');
    await selectOption(page, selects.nth(1), 'Barangay 8');
    await wizard.getByPlaceholder('Street / building', { exact: true }).nth(0).fill('Metro Plaza');
    await wizard.getByPlaceholder('e.g. 1600', { exact: true }).fill('1421');
    await selectOption(page, selects.nth(2), 'Quezon City');
    await selectOption(page, selects.nth(3), 'Commonwealth');
    await wizard.getByPlaceholder('Street / building', { exact: true }).nth(1).fill('San Pedro');
    await wizard.getByPlaceholder('e.g. 4117', { exact: true }).fill('1121');
    await selectDate(page, wizard.getByRole('button', { name: 'Select pickup date' }), pickupDate);
    await selectOption(page, selects.filter({ hasText: 'Select time' }), '4:00 AM');
    await nextStep(wizard, 3);
  });

  await test.step('Step 3: enter items and protective materials', async () => {
    await expect(wizard.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await wizard.getByPlaceholder('e.g. 15', { exact: true }).fill('2');
    await wizard.getByPlaceholder('Sofa, ref, boxes...').fill(customer.items);
    await wizard.getByPlaceholder('Access codes, fragile notes, parking info...').fill(customer.instructions);
    for (const name of [/20x20x20 Box/, /Half Bubble Wrap/]) {
      const checkbox = wizard.getByRole('checkbox', { name });
      await checkbox.check();
      await expect(checkbox).toBeChecked();
    }
    await nextStep(wizard, 4);
  });

  await test.step('Step 4: select insurance', async () => {
    // Insurance is currently a clickable card, rather than a native checkbox.
    await wizard.locator('p').filter({ hasText: /^Goods in Transit Insurance$/ }).click();
    await nextStep(wizard, 5);
  });

  await test.step('Step 5: choose COD and accept policy and terms', async () => {
    const review = wizard.getByRole('button', { name: 'Review Details', exact: true });
    await expect(review).toBeDisabled();
    await wizard.getByRole('button', { name: /Cash on Delivery Pay on/ }).click();
    await expect(review).toBeDisabled();
    const terms = wizard.getByRole('checkbox', { name: /I have read and agree to/ });
    await terms.check();
    await expect(terms).toBeChecked();
    await expect(review).toBeEnabled();
    await review.click();
    await expect(wizard.getByText(/^Step 6 /)).toBeVisible();
  });

  await test.step('Step 6: review entered values and confirm booking', async () => {
    for (const value of [fullName, customer.email, customer.contact, customer.items,
      customer.instructions, 'Metro Plaza', 'San Pedro', '20x20x20 Box', 'Half Bubble Wrap']) {
      await expect(wizard).toContainText(value);
    }
    await expect(wizard).toContainText(`${isoDate(pickupDate)} at 4:00 AM`);
    await expect(wizard).toContainText('Yes — Required');
    // Scope to review rows; the step bar also contains the text Insurance.
    await expect(wizard.locator('span').filter({ hasText: /^Insurance$/ }).locator('..').filter({ hasText: 'Yes' })).toBeVisible();
    await expect(wizard.getByText('Payment Method', { exact: true }).locator('..')).toContainText('COD');
    const created = page.waitForResponse(response =>
      /\/booking\/?$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
    await wizard.getByRole('button', { name: 'Confirm Booking', exact: true }).click();
    const response = await created;
    expect(response.ok(), 'Booking creation API must succeed').toBeTruthy();
    const savedBooking = await response.json();
    bookingNumber = savedBooking.bookingNo;
    expect(bookingNumber).toMatch(/^BN-\d{8}-\d+$/);
    await expect(page.getByText('Booking added successfully.', { exact: true })).toBeVisible();
    await expect(wizard).toBeHidden();
    await search.fill(bookingNumber);
    const row = page.getByRole('row').filter({ hasText: bookingNumber });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Lipat Bahay');
    await expect(row).toContainText(isoDate(pickupDate));
    await expect(row).toContainText('For Plotting');
    await expect(row.getByRole('cell').first()).toHaveText(bookingNumber);
    await expect(row).toContainText(fullName);
    expect(bookingNumber).toMatch(/^BN-\d{8}-\d+$/);
  });

  await test.step('Reload and verify saved booking matches entered details', async () => {
    await page.reload();
    await search.fill(bookingNumber);
    const row = page.getByRole('row').filter({ hasText: bookingNumber });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(fullName);
    await row.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'View', exact: true }).click();
    const details = page.getByRole('dialog');
    const values: Record<string, string> = {
      'Name': fullName, 'Contact': customer.contact, 'Email': customer.email,
      'Date & Time': `${isoDate(pickupDate)} at 4:00 AM`,
      'Barangay / Subdivision Permit': 'Yes — Required', 'Est. Items': '2 pcs',
      'Payment Method': 'COD',
    };
    for (const [label, value] of Object.entries(values)) {
      await expect(details.getByText(label, { exact: true }).locator('..').locator('span').last()).toHaveText(value);
    }
    for (const value of ['Metro Plaza', 'Barangay 8', 'Caloocan', 'San Pedro', 'Commonwealth',
      'Quezon City', '20x20x20 Box', 'Half Bubble Wrap']) {
      await expect(details).toContainText(value);
    }
    await expect(details.getByText('Insurance', { exact: true }).locator('..').locator('span').last()).toHaveText('Yes');
    await page.getByRole('button', { name: 'Close booking details' }).click();
  });

  await test.step('Edit the created booking and verify persistence', async () => {
    const row = page.getByRole('row').filter({ hasText: bookingNumber });
    await row.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Booking' });
    await expect(edit.getByRole('textbox', { name: /Item Details/ })).toHaveValue(customer.items);
    await expect(edit.getByRole('textbox', { name: /Special Instructions/ })).toHaveValue(customer.instructions);
    await edit.getByRole('textbox', { name: /Full Name/ }).fill(`Ben Kyle ${customer.lastName}`);
    await edit.getByRole('button', { name: 'Update Booking', exact: true }).click();
    await expect(edit).toBeHidden();
    await page.reload();
    await search.fill(bookingNumber);
    await expect(row).toContainText(`Ben Kyle ${customer.lastName}`);
  });

  await test.step('Reschedule and verify persisted date and status', async () => {
    const row = page.getByRole('row').filter({ hasText: bookingNumber });
    await row.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'Reschedule', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reschedule Booking' });
    await expect(dialog.getByRole('button', { name: 'Save Date' })).toBeDisabled();
    await selectDate(page, dialog.locator('button[aria-haspopup="dialog"]'), rescheduledDate);
    await dialog.getByRole('button', { name: 'Save Date' }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await search.fill(bookingNumber);
    await expect(row).toContainText(isoDate(rescheduledDate));
    await expect(row).toContainText('Rescheduled');
  });
});
