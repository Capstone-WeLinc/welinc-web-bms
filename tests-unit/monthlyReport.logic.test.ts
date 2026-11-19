import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInProgress, monthlyWindow, monthTickInterval, segments, serviceSlices, statusLabel, topServices, trendAriaLabel, trendRows, PAYMENT_COLORS, STATUS_COLORS,
} from '../src/components/reports/monthly/monthlyReport.logic.ts';

const months = [
  { label: 'Sep', year: 2026, month: 8, revenue: 0, trips: 0 },
  { label: 'Oct', year: 2026, month: 9, revenue: 5950, trips: 18 },
  { label: 'Nov', year: 2026, month: 10, revenue: 0, trips: 54 },
];

test('the current Manila month is in progress; earlier months are full', () => {
  assert.equal(isInProgress(months[2], '2026-11-10'), true);
  assert.equal(isInProgress(months[1], '2026-11-10'), false);
  assert.equal(isInProgress(months[2], '2026-12-01'), false);
});

test('trend rows switch between trips and revenue and flag the month in progress', () => {
  assert.deepEqual(trendRows(months, 'trips', '2026-11-10'), [
    { label: 'Sep 26', value: 0, inProgress: false },
    { label: 'Oct 26', value: 18, inProgress: false },
    { label: 'Nov 26', value: 54, inProgress: true },
  ]);
  assert.deepEqual(trendRows(months, 'revenue', '2026-11-10').map((row) => row.value), [0, 5950, 0]);
});

test('the trend chart has a label describing its content', () => {
  const label = trendAriaLabel(months, 'trips', '2026-11-10');
  assert.match(label, /Sep 2026 to Nov 2026/);
  assert.match(label, /Oct 2026: 18 trips; Nov 2026: 54 trips so far\./);
});

test('month labels thin out as the chart gets narrower', () => {
  assert.equal(monthTickInterval(700, 13), 0);
  assert.equal(monthTickInterval(400, 13), 1);
  assert.equal(monthTickInterval(400, 25), 2);
});

test('service type lists the top 6 by trips, then all other services', () => {
  const distribution = [
    { name: 'Motorized', value: 13 }, { name: 'Lifter', value: 11 }, { name: 'Closed van', value: 7 }, { name: 'Lifter PM', value: 7 },
    { name: 'Unit to Unit Transfer', value: 3 }, { name: '6W', value: 3 }, ...Array.from({ length: 14 }, (_, i) => ({ name: `Other ${i}`, value: 2 })),
  ];
  const { rows, shown, total } = topServices(distribution);
  assert.equal(shown, 6);
  assert.equal(total, 20);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0], { name: 'Motorized', trips: 13, percent: 18, width: 100, other: false });
  assert.deepEqual(rows[6], { name: 'All other services', trips: 28, percent: 39, width: 100, other: true });
  assert.equal(topServices([{ name: 'Lipat Bahay', value: 2 }]).rows.length, 1);
  assert.deepEqual(topServices([]).rows, []);
});

test('stacked segments are proportional and keep zero counts', () => {
  const status = segments([{ name: 'For Plotting', value: 72 }, { name: 'Assigned', value: 0 }, { name: 'Cancelled', value: 2 }], STATUS_COLORS);
  assert.deepEqual(status.map((part) => [part.name, part.value, part.percent, part.color]), [
    ['For Plotting', 72, 97, '#f59e0b'], ['Assigned', 0, 0, '#6366f1'], ['Cancelled', 2, 3, '#ef4444'],
  ]);
  assert.ok(Math.abs(status.reduce((sum, part) => sum + part.width, 0) - 100) < 1e-9);
  const payments = segments([{ name: 'GCash', value: 5950 }], PAYMENT_COLORS);
  assert.deepEqual(payments.map((part) => [part.percent, part.width, part.color]), [[100, 100, '#3b82f6']]);
  assert.ok(segments([{ name: 'Unknown', value: 0 }], {}).every((part) => part.width === 0));
});

test('booking statuses read in sentence case', () => {
  assert.equal(statusLabel('For Plotting'), 'For plotting');
  assert.equal(statusLabel('Cancelled'), 'Cancelled');
});

const SERVICES = [
  { name: 'Lipat Bahay', value: 30 }, { name: 'Office Pull out', value: 10 }, { name: 'Office Pull Out', value: 2 },
  { name: 'Corporate Delivery', value: 4 }, { name: 'Unit to Unit Transfer', value: 4 },
  { name: 'NC: 6W 14 FT. W/ Lifter', value: 11 }, { name: 'Motorized', value: 13 }, { name: 'Closed van', value: 7 },
  { name: 'Truck A', value: 3 }, { name: 'Truck B', value: 3 }, { name: 'Truck C', value: 2 }, { name: 'Truck D', value: 1 },
];

test('service donut shows only the four main services by default, in the forecast colours', () => {
  const { slices, top, unmappedTrips, unmappedServices } = serviceSlices(SERVICES);
  assert.deepEqual(slices.map((slice) => [slice.name, slice.trips, slice.percent, slice.color]), [
    ['Lipat Bahay', 30, 60, '#f59e0b'],
    ['Office Pull Out', 12, 24, '#a855f7'], // "Office Pull out" and "Office Pull Out" count as one service
    ['Corporate Delivery', 4, 8, '#3b82f6'],
    ['Unit to Unit Transfer', 4, 8, '#22c55e'],
  ]);
  assert.equal(top?.name, 'Lipat Bahay');
  assert.equal(unmappedTrips, 40);
  assert.equal(unmappedServices, 7);
});

test('include unmapped adds the other services and re-bases every share on all trips', () => {
  const { slices, unmappedTrips } = serviceSlices(SERVICES, true);
  assert.equal(unmappedTrips, 40);
  assert.deepEqual(slices.map((slice) => [slice.name, slice.trips, slice.percent, slice.unmapped]), [
    ['Lipat Bahay', 30, 33, false], ['Office Pull Out', 12, 13, false], ['Corporate Delivery', 4, 4, false], ['Unit to Unit Transfer', 4, 4, false],
    ['Motorized', 13, 14, true], ['NC: 6W 14 FT. W/ Lifter', 11, 12, true], ['Closed van', 7, 8, true], ['Truck A', 3, 3, true], ['Truck B', 3, 3, true],
    ['All other services', 3, 3, true],
  ]);
  assert.equal(slices.at(-1)?.color, '#94a3b8');
  assert.equal(new Set(slices.map((slice) => slice.color)).size, slices.length);
});

test('service donut handles no data and only-unmapped data', () => {
  assert.deepEqual(serviceSlices([]), { slices: [], top: null, unmappedTrips: 0, unmappedServices: 0 });
  const onlyOther = serviceSlices([{ name: 'Motorized', value: 5 }]);
  assert.deepEqual([onlyOther.slices.length, onlyOther.unmappedTrips], [0, 5]);
  assert.equal(serviceSlices([{ name: 'Motorized', value: 5 }], true).top?.name, 'Motorized');
});

test('monthly window is exactly N calendar months ending this Manila month, with no day shift', () => {
  assert.deepEqual(monthlyWindow(12, '2026-11-10'), { start: '2025-12-01', end: '2026-11-30' });
  assert.deepEqual(monthlyWindow(6, '2026-11-10'), { start: '2026-06-01', end: '2026-11-30' });
  assert.deepEqual(monthlyWindow(24, '2026-11-10'), { start: '2024-12-01', end: '2026-11-30' });
  assert.deepEqual(monthlyWindow(12, '2026-01-31'), { start: '2025-02-01', end: '2026-01-31' });
  assert.deepEqual(monthlyWindow(12, '2028-02-03'), { start: '2027-03-01', end: '2028-02-29' }); // leap year
});
