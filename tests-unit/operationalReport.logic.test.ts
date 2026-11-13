import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chartRows, closedJobsAriaLabel, formatRange, integerTicks, jobOrdersCaption, monthLabel, monthTickInterval,
  performanceCards, resourceRows, segments, topVehicles, vehicleBarWidth, vehiclePercent,
} from '../src/components/reports/operational/operationalReport.logic.ts';

const totals = { bookings: 62, withVehicle: 0, unassigned: 62, completed: 0, cancelled: 2, jobOrders: 0, jobOrdersNotDistributed: 0 };

test('cards come in order and the on-time arrival card is gone', () => {
  const cards = performanceCards(totals);
  assert.deepEqual(cards.map((card) => card.label), ['Total bookings', 'Bookings with a vehicle', 'Completed services', 'Job orders']);
  assert.ok(!cards.some((card) => /on-time|arrival/i.test(card.label)));
  assert.deepEqual(cards.map((card) => card.value), ['62', '0%', '0', '0']);
  assert.deepEqual(cards.map((card) => card.caption), ['Received in this period', '62 still unassigned', '2 cancelled', 'All distributed']);
  assert.equal(cards[1].captionTone, 'amber');
});

test('bookings with a vehicle is a whole percent of total bookings', () => {
  assert.equal(vehiclePercent({ bookings: 3, withVehicle: 2 }), 67);
  assert.equal(vehiclePercent({ bookings: 0, withVehicle: 0 }), 0);
});

test('job orders caption turns amber when some are not distributed', () => {
  assert.deepEqual(jobOrdersCaption({ jobOrdersNotDistributed: 0 }), { caption: 'All distributed', captionTone: 'muted' });
  assert.deepEqual(jobOrdersCaption({ jobOrdersNotDistributed: 3 }), { caption: '3 not yet distributed', captionTone: 'amber' });
});

test('dates show in full with the year', () => {
  assert.equal(formatRange('2025-11-11', '2026-11-10'), 'Nov 11, 2025 to Nov 10, 2026');
  assert.equal(monthLabel('2025-11'), 'Nov 25');
});

test('month labels: every month when there is room, every second month when narrow', () => {
  assert.equal(monthTickInterval(700, 13), 0);
  assert.equal(monthTickInterval(320, 13), 1);
  const rows = chartRows(Array.from({ length: 13 }, (_, i) => ({ month: `${2025 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, '0')}`, completed: 0, cancelled: 0 })));
  assert.equal(rows.length, 13);
  assert.equal(rows[0].label, 'Nov 25');
  assert.equal(rows[12].label, 'Nov 26');
});

test('y-axis ticks are whole numbers from 0', () => {
  assert.deepEqual(integerTicks(2), [0, 1, 2, 3, 4]);
  assert.deepEqual(integerTicks(10), [0, 3, 6, 9, 12]);
  assert.ok(integerTicks(37).every((tick) => Number.isInteger(tick)));
});

test('the chart has a label describing its content', () => {
  const label = closedJobsAriaLabel([{ month: '2026-10', completed: 0, cancelled: 0 }, { month: '2026-11', completed: 1, cancelled: 2 }], '2026-10-01', '2026-11-10');
  assert.match(label, /1 completed and 2 cancelled/);
  assert.match(label, /November 2026: 1 completed, 2 cancelled/);
});

test('jobs per vehicle shows the top 8, busiest first, bars relative to the busiest', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ vehicleId: `v${i}`, plate: `P${i}`, alias: null, jobs: i + 1 }));
  const top = topVehicles(rows);
  assert.equal(top.length, 8);
  assert.equal(top[0].jobs, 10);
  assert.equal(vehicleBarWidth(5, 10), 50);
  assert.equal(vehicleBarWidth(0, 0), 0);
});

test('resource bars are proportional, list zero counts, and an empty total is an empty track', () => {
  const rows = resourceRows({
    vehicles: { total: 12, available: 10, assigned: 0, underMaintenance: 1, underRepair: 1 },
    drivers: { onRoster: 13, available: 13, onDuty: 0, onLeave: 0 },
    helpers: { onRoster: 0, available: 0, onDuty: 0, onLeave: 0 },
  });
  assert.deepEqual(rows.map((row) => row.totalLabel), ['12 in fleet', '13 on roster', '0 on roster']);
  assert.deepEqual(rows[0].segments.map((segment) => [segment.label, segment.count]), [['Available', 10], ['Assigned', 0], ['Under maintenance', 1], ['Under repair', 1]]);
  assert.ok(Math.abs(rows[0].segments[0].width - (10 / 12) * 100) < 1e-9);
  assert.ok(rows[2].segments.every((segment) => segment.width === 0));
  // Drivers and helpers use the same three states as their badges on Vehicle & Team Availability.
  assert.deepEqual(rows[1].segments.map((segment) => segment.label), ['Available', 'On duty', 'On leave']);
  assert.deepEqual(rows[2].segments.map((segment) => segment.label), ['Available', 'On duty', 'On leave']);
  assert.equal(segments([]).length, 0);
});
