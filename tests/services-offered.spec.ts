import { sessionToken } from './session-helpers';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test.describe.configure({ retries: 0 });
type Item = { id?: string; name: string; description?: string; duration?: string; price?: number };
type ApiItem = Omit<Item, 'price'> & { price?: string | number | null };
function normalizeItem(item: ApiItem): Item {

  const { price, ...fields } = item;
  return { ...fields, ...(price !== undefined && price !== null ? { price: Number(price) } : {}) };
}
const runId = randomUUID();
const groups: { tab: string; endpoint: string; formTitle: string; items: Item[] }[] = [
  { tab: 'Services', endpoint: 'booking-services', formTitle: 'Add service', items: [
    { name: `codex-e2e-${runId}-booking-service`, description: 'E2E test booking service.' },
  ] },
  { tab: 'Additional Services', endpoint: 'services-offered', formTitle: 'Add additional service', items: [
    { name: `codex-e2e-${runId}-add-on`, description: 'E2E test additional service.', duration: '1 hr', price: 450 },
  ] },
  { tab: 'Protective Materials', endpoint: 'protective-materials', formTitle: 'Add protective material', items: [
    { name: `codex-e2e-${runId}-material`, price: 115 },
  ] },
];
const peso = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
function modal(page: Page, title: string) {
  // This page's custom Modal has no dialog role; scope it by its visible heading.
  return page.locator('div.fixed.inset-0.z-50').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}
async function assertDetail(view: Locator, name: string, value: string) {
  await expect(view.getByText(name, { exact: true }).locator('..').locator('p').last()).toHaveText(value);
}

test('Services Offered: add and verify each catalog type through the gateway', async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000);
  let headers: { Authorization: string };
  async function getItems(endpoint: string): Promise<Item[]> {
    const response = await page.request.get(`http://localhost:3000/bms/config/${endpoint}`, { headers });
    expect(response.ok(), `Read ${endpoint}: ${response.status()}`).toBeTruthy();
    const items: ApiItem[] = await response.json();
    return items.map(normalizeItem);
  }
  const verified: { tab: string; id: string; name: string; created: boolean }[] = [];
  await test.step('Sign in as administrator and open Services Offered', async () => {
    await page.goto('/login');
    await page.getByPlaceholder('you@welinc.com').fill(process.env.E2E_ADMIN_EMAIL || 'bms.admin@welinc.com');
    await page.getByPlaceholder('Enter password').fill(process.env.E2E_ADMIN_PASSWORD || 'admin1234');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    const nav = page.getByRole('button', { name: 'Services Offered', exact: true });
    await expect(nav).toBeVisible();
    const token = await sessionToken(page);
    expect(token).toBeTruthy();
    headers = { Authorization: `Bearer ${token}` };
    await nav.click();
    await expect(page.getByRole('heading', { name: 'SERVICES OFFERED', exact: true })).toBeVisible();
  });
  for (const group of groups) {
    expect(group.items).toHaveLength(1);
    for (const item of group.items) {
      await test.step(`${group.tab}: ${item.name}`, async () => {
        await page.getByRole('button', { name: group.tab, exact: true }).click();
        const search = page.getByPlaceholder(group.tab === 'Protective Materials' ? 'Search materials...' : 'Search services...');
        await search.fill(item.name);
        const matches = (await getItems(group.endpoint)).filter(record => record.name.toLowerCase() === item.name.toLowerCase());
        expect(matches.length, `No duplicate catalog names: ${item.name}`).toBeLessThanOrEqual(1);
        let saved: Item;
        if (matches.length) {
          saved = matches[0];
          expect(saved).toMatchObject(item);
        } else {
          await page.getByRole('button', { name: group.tab === 'Protective Materials' ? 'ADD MATERIAL' : 'ADD SERVICE', exact: true }).click();
          const form = modal(page, group.formTitle);
          await expect(form).toBeVisible();
          // Check required-field validation before submitting valid data.
          await form.getByRole('button', { name: 'ADD ITEM', exact: true }).click();
          await expect(form.getByPlaceholder('Enter service name')).toHaveAttribute('aria-invalid', 'true');
          await expect(form).toBeVisible();
          await form.getByPlaceholder('Enter service name').fill(item.name);
          if (item.description !== undefined) await form.getByPlaceholder('Describe the service offered').fill(item.description);
          if (item.duration !== undefined) await form.getByPlaceholder('e.g. 2hr').fill(item.duration);
          if (item.price !== undefined) await form.getByRole('spinbutton').fill(String(item.price));
          const submission = page.waitForResponse(response => new URL(response.url()).pathname.replace(/^\/api(?=\/|$)/, '') === `/bms/config/${group.endpoint}` && response.request().method() === 'POST');
          await form.getByRole('button', { name: 'ADD ITEM', exact: true }).click();
          const response = await submission;
          expect(response.ok(), `Create ${item.name}: ${response.status()}`).toBeTruthy();
          saved = normalizeItem(await response.json());
          expect(saved).toMatchObject(item);
          await expect(form).toBeHidden();
          await expect(page.getByText(group.tab === 'Protective Materials' ? 'Material added successfully' : 'Service added successfully', { exact: true })).toBeVisible();
        }
        expect(saved.id).toEqual(expect.any(String));
        const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: item.name, exact: true }) });
        await expect(row).toHaveCount(1);
        if (item.description !== undefined) await expect(row).toContainText(item.description);
        if (item.duration !== undefined) await expect(row).toContainText(item.duration);
        if (item.price !== undefined) await expect(row.getByRole('cell', { name: peso(item.price), exact: true })).toBeVisible();
        await row.getByRole('button', { name: 'Open actions' }).click();
        await page.getByRole('menuitem', { name: 'View', exact: true }).click();
        const view = modal(page, 'Item details');
        await expect(view).toBeVisible();
        await assertDetail(view, 'Name', item.name);
        if (item.description !== undefined) await assertDetail(view, 'Description', item.description);
        if (item.duration !== undefined) await assertDetail(view, 'Duration', item.duration);
        if (item.price !== undefined) await assertDetail(view, 'Price', peso(item.price));
        // The sole button in the details modal is the icon-only close control.
        await view.getByRole('button').click();
        await expect(view).toBeHidden();
        await page.reload();
        await page.getByRole('button', { name: group.tab, exact: true }).click();
        await search.fill(item.name);
        await expect(row).toHaveCount(1);
        const persisted = (await getItems(group.endpoint)).filter(record => record.id === saved.id);
        expect(persisted).toHaveLength(1);
        expect(persisted[0]).toMatchObject(item);
        if (item.description !== undefined) await expect(row).toContainText(item.description);
        if (item.price !== undefined) await expect(row).toContainText(peso(item.price));
        verified.push({ tab: group.tab, id: saved.id!, name: item.name, created: matches.length === 0 });
      });
    }
  }
  await test.step('Verify all three catalog types and sign out', async () => {
    for (const group of groups) {
      const entries = verified.filter(record => record.tab === group.tab);
      expect(entries).toHaveLength(1);
      expect(new Set(entries.map(record => record.id)).size).toBe(1);
      const persisted = await getItems(group.endpoint);
      for (const item of group.items) {
        const matches = persisted.filter(record => record.name === item.name);
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject(item);
      }
    }
    expect(verified).toHaveLength(3);
    await testInfo.attach('verified-catalog-items.json', { body: JSON.stringify(verified, null, 2), contentType: 'application/json' });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Are you sure you want to log out?' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });
});
