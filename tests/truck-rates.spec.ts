import { expect, test } from '@playwright/test';
import {
  filterTruckRates,
  hasPreferredTruckSelection,
  preferredTruckCharge,
  TEMPORARY_NC_TRUCK_RATES,
  truckContextChanged,
  truckRateView,
} from '../src/components/booking/truckRates';

test('the preferred truck rate is charged, except when none is picked or for Unit to Unit Transfer', () => {
  const truck = TEMPORARY_NC_TRUCK_RATES[0];
  expect(preferredTruckCharge(truck, false)).toBe(truck.rate);
  expect(preferredTruckCharge(truck, true)).toBe(0);
  expect(preferredTruckCharge(null, false)).toBe(0);
});

test('truck rates are isolated by exact selected type and location and exclude inactive rows', () => {
  const closedVans = filterTruckRates(TEMPORARY_NC_TRUCK_RATES, '10ft. Closed Van', 'NC');
  expect(closedVans.map(rate => rate.name)).toHaveLength(2);
  expect(closedVans.every(rate => rate.truckTypeId === '10ft. Closed Van' && rate.locationCode === 'NC' && rate.isActive)).toBe(true);
  expect(filterTruckRates(TEMPORARY_NC_TRUCK_RATES, '6W 14ft. with Lifter', 'NC')).toHaveLength(2);
  expect(filterTruckRates(TEMPORARY_NC_TRUCK_RATES, '4W L300 FB Van', 'NC')).toHaveLength(2);
  expect(filterTruckRates(TEMPORARY_NC_TRUCK_RATES, '10ft. Closed Van', 'N1')).toHaveLength(0);
});

test('temporary NC catalog contains every provided variant for each truck type', () => {
  const types = ['6W 14ft. with Lifter', '10ft. Closed Van', '4W L300 FB Van'];
  for (const type of types) {
    const rows = filterTruckRates(TEMPORARY_NC_TRUCK_RATES, type, 'NC');
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(rate => rate.id)).size).toBe(2);
  }
});

test('a zone or truck type change invalidates the previous selection context', () => {
  const context = { truckTypeId: '10ft. Closed Van', locationCode: 'NC' };
  expect(truckContextChanged(context, { ...context })).toBe(false);
  expect(truckContextChanged(context, { ...context, locationCode: 'N1' })).toBe(true);
  expect(truckContextChanged(context, { ...context, truckTypeId: '4W L300 FB Van' })).toBe(true);
});

test('empty, loading and error states are distinct and Continue requires a matching selection', () => {
  const rates = filterTruckRates(TEMPORARY_NC_TRUCK_RATES, '10ft. Closed Van', 'NC');
  expect(truckRateView([], '10ft. Closed Van', 'NC', false, false)).toBe('empty');
  expect(truckRateView([], '10ft. Closed Van', 'NC', true, false)).toBe('loading');
  expect(truckRateView([], '10ft. Closed Van', 'NC', false, true)).toBe('error');
  expect(truckRateView(rates, '10ft. Closed Van', 'NC', false, false)).toBe('options');
  expect(hasPreferredTruckSelection(rates[0], '10ft. Closed Van', 'NC', false)).toBe(true);
  expect(hasPreferredTruckSelection(rates[0], '4W L300 FB Van', 'NC', false)).toBe(false);
  expect(hasPreferredTruckSelection(null, '10ft. Closed Van', 'NC', false)).toBe(false);
  expect(hasPreferredTruckSelection(null, '', 'NC', true)).toBe(true);
});
