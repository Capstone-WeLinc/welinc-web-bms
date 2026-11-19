import { expect, test, type Page } from '@playwright/test';

const vehicles = [
  { id: 'available-1', plateNumber: 'NDA-3398', alias: 'Unit 1', type: '4W L300 FB Van', brand: 'Mitsubishi', model: 'L300', capacity: '', capacityKg: null, dimensions: `4W - 7'5" x 4 x 4 FT.`, requiredHelpers: 1, requiredHelpersMin: 1, requiredHelpersMax: 2, status: 'Available', isAssigned: false, regExpiry: '', insExpiry: '', driver: null, helpers: [], isSample: true },
  { id: 'assigned-1', plateNumber: 'NBD-2041', alias: 'Unit 2', type: '6W 14ft. with Lifter', brand: '', model: '', capacity: '3,000 kg', capacityKg: 3000, dimensions: '14 x 7 x 6 FT.', requiredHelpers: 2, requiredHelpersMin: 1, requiredHelpersMax: 2, status: 'Available', isAssigned: true, driver: { id: 'driver-1', name: 'Juan Dela Cruz', initials: 'JD' }, helpers: [{ id: 'helper-1', name: 'Eric Bautista', initials: 'EB' }], isSample: true },
  { id: 'maintenance-1', plateNumber: 'NFK-8824', alias: 'Unit 3', type: '10ft. Closed Van', brand: '', model: '', capacity: '1,500 kg', capacityKg: 1500, dimensions: '10 x 6 x 6 FT.', requiredHelpers: 2, requiredHelpersMin: 2, requiredHelpersMax: 2, status: 'Under Maintenance', isAssigned: false, driver: null, helpers: [], statusDetails: { reason: 'Preventive maintenance', since: '2026-11-01', expectedBack: '2026-11-05', remarks: 'Sample record' }, isSample: true },
  { id: 'repair-1', plateNumber: 'NGH-1207', alias: 'Unit 4', type: '4W L300 FB Van', brand: 'Mitsubishi', model: 'L300', capacity: '', capacityKg: null, dimensions: `4W - 7'5" x 4 x 4 FT.`, requiredHelpers: 1, requiredHelpersMin: 1, requiredHelpersMax: 1, status: 'Under Repair', isAssigned: false, driver: null, helpers: [], statusDetails: { reason: 'Brake repair', since: '2026-11-02', expectedBack: '2026-11-08', remarks: 'Sample record' }, isSample: true },
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `vehicle-${index + 5}`, plateNumber: `TEST-${index + 5}`, alias: `Unit ${index + 5}`,
    type: '6W 14ft. with Lifter', brand: '', model: '', capacity: '3,000 kg', capacityKg: 3000,
    dimensions: '14 x 7 x 6 FT.', requiredHelpers: 2, requiredHelpersMin: 2, requiredHelpersMax: 2,
    status: 'Available', isAssigned: false, driver: null, helpers: [], isSample: true,
  })),
];

function detailsFor(vehicle: (typeof vehicles)[number]) {
  return {
    ...vehicle,
    currentAssignment: vehicle.id === 'assigned-1' ? {
      bookingNumber: 'BN-SAMPLE-0001', jobOrderNumber: 'JO-SAMPLE-0001', service: 'Corporate Delivery',
      date: '2026-11-05', startTime: '08:00 AM', endTime: '02:00 PM', route: 'NC — NCR to NCR. Pickup: NCR · Delivery: NCR',
    } : null,
    upcomingSchedule: [],
  };
}

async function openVehiclePage(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@welinc.com').fill(process.env.E2E_ADMIN_EMAIL || 'bms.admin@welinc.com');
  await page.getByPlaceholder('Enter password').fill(process.env.E2E_ADMIN_PASSWORD || 'admin1234');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.route('**/api/bms/config/vehicles/availability', route => route.fulfill({ json: vehicles }));
  await page.route('**/api/bms/config/vehicles/availability/*/details', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    const vehicle = vehicles.find(item => item.id === id);
    return route.fulfill({ status: vehicle ? 200 : 404, json: vehicle ? detailsFor(vehicle) : { message: 'Not found' } });
  });
  await page.route('**/api/bms/config/drivers', route => route.fulfill({ json: [] }));
  await page.route('**/api/bms/config/helpers', route => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Vehicle & Team Availability', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'VEHICLE & TEAM AVAILABILITY', exact: true })).toBeVisible();
  await expect(page.getByText('9 of 9 items')).toBeVisible();
}

test('vehicle card grid filters each status, searches crew, shows status-specific details, and paginates', async ({ page }) => {
  await openVehiclePage(page);
  const cards = page.locator('article');
  await expect(cards).toHaveCount(8);
  for (const [filter, expectedPlate] of [
    ['Available', 'NDA-3398'], ['Assigned', 'NBD-2041'], ['Under Maintenance', 'NFK-8824'], ['Under Repair', 'NGH-1207'],
  ]) {
    await page.getByRole('button', { name: filter, exact: true }).click();
    await expect(cards).toHaveCount(filter === 'Available' ? 6 : 1);
    await expect(cards.filter({ hasText: expectedPlate })).toHaveCount(1);
  }

  await page.getByRole('button', { name: 'All', exact: true }).click();
  const search = page.getByPlaceholder('Search vehicles...');
  await search.fill('Eric Bautista');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('NBD-2041');

  for (const [id, title, expected] of [
    ['assigned-1', 'Current assignment', 'BN-SAMPLE-0001'],
    ['available-1', 'Not assigned right now', 'This vehicle is free for new bookings.'],
    ['maintenance-1', 'Status details', 'Preventive maintenance'],
    ['repair-1', 'Status details', 'Brake repair'],
  ]) {
    await search.clear();
    const card = cards.filter({ hasText: vehicles.find(item => item.id === id)!.plateNumber });
    await card.getByRole('button', { name: `View details for ${vehicles.find(item => item.id === id)!.plateNumber}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(title, { exact: false })).toBeVisible();
    await expect(dialog.getByText(expected, { exact: false })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
  }

  await expect(cards).toHaveCount(8);
  await page.getByRole('button', { name: 'Go to page 2' }).click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('1 of 9 items')).toBeVisible();
});
