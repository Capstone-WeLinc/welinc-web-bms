/**
 * Display rules for the Monthly Report. No imports and no React, so they can be
 * unit-tested with `node --test` (see tests-unit/). The figures come from the
 * existing calculations on the Reports page.
 */

/** One calendar month. trips: non-cancelled bookings dated up to today; paidTrips: bookings with a verified payment that month. */
export interface MonthPoint { label: string; year: number; month: number; revenue: number; trips: number; paidTrips: number }

export const MONTHLY_COLORS = {
  navy: '#1a1f6e',
  inProgress: '#8f94c7',
  otherServices: '#b4b8d8',
} as const;

export const STATUS_COLORS: Record<string, string> = {
  'For Plotting': '#f59e0b',
  'For Verification': '#3b82f6',
  Assigned: '#6366f1',
  Rescheduled: '#06b6d4',
  Completed: '#10b981',
  Cancelled: '#ef4444',
};

export const PAYMENT_COLORS: Record<string, string> = {
  GCash: '#3b82f6',
  BDO: '#22c55e',
  Xendit: '#8b5cf6',
  Cash: '#f59e0b',
};

const FALLBACK_COLORS = ['#64748b', '#0ea5e9', '#d946ef', '#84cc16'];

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const PESO_COMPACT = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 });

export const formatPeso = (value: number) => PESO.format(value);
export const formatPesoCompact = (value: number) => PESO_COMPACT.format(value);

/** "Nov 2026". */
export const monthName = (point: Pick<MonthPoint, 'label' | 'year'>) => `${point.label} ${point.year}`;

/**
 * The Monthly Report window: the first day of the month `range - 1` months before `today`'s
 * month, to the last day of `today`'s month. Exactly `range` calendar months.
 * Works on YYYY-MM-DD strings (Asia/Manila), so the viewer's timezone can never shift a day.
 */
export function monthlyWindow(range: number, today: string): { start: string; end: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const startIndex = year * 12 + month - (range - 1);
  const startYear = Math.floor(startIndex / 12);
  const startMonth = startIndex - startYear * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return { start: `${startYear}-${pad(startMonth + 1)}-01`, end: `${year}-${pad(month + 1)}-${pad(lastDay)}` };
}

/** True for the calendar month that contains `today` (YYYY-MM-DD, Asia/Manila): its figures are still growing. */
export function isInProgress(point: Pick<MonthPoint, 'year' | 'month'>, today: string): boolean {
  return point.year === Number(today.slice(0, 4)) && point.month === Number(today.slice(5, 7)) - 1;
}

/** Chart rows: "Nov 25" labels, the chosen metric, and whether the month is still in progress. */
export function trendRows(months: MonthPoint[], metric: 'revenue' | 'trips', today: string) {
  return months.map((point) => ({
    label: `${point.label} ${String(point.year).slice(2)}`,
    value: point[metric],
    inProgress: isInProgress(point, today),
  }));
}

/** Recharts tick interval: label every month when each gets 48px or more, otherwise every second or third. */
export function monthTickInterval(chartWidth: number, months: number): number {
  if (months <= 1 || chartWidth <= 0) return 0;
  const perMonth = chartWidth / months;
  if (perMonth >= 48) return 0;
  if (perMonth >= 24) return 1;
  return 2;
}

export function trendAriaLabel(months: MonthPoint[], metric: 'revenue' | 'trips', today: string): string {
  if (!months.length) return 'Monthly trend: no months in the selected range.';
  const format = (value: number) => (metric === 'revenue' ? formatPeso(value) : `${value} ${value === 1 ? 'trip' : 'trips'}`);
  const parts = months.filter((point) => point[metric] > 0)
    .map((point) => `${monthName(point)}: ${format(point[metric])}${isInProgress(point, today) ? ' so far' : ''}`);
  return `Bar chart of ${metric === 'revenue' ? 'verified revenue' : 'trips'} per month, ${monthName(months[0])} to ${monthName(months[months.length - 1])}. `
    + (parts.length ? `${parts.join('; ')}.` : 'Every month is zero.');
}

const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export interface ServiceRow { name: string; trips: number; percent: number; width: number; other: boolean }

/**
 * The busiest services by trips, then one "All other services" row for the rest.
 * Bars are relative to the busiest service; the "other" row is capped at full width.
 */
export function topServices(distribution: { name: string; value: number }[], limit = 6): { rows: ServiceRow[]; shown: number; total: number } {
  const ranked = distribution.filter((item) => item.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const totalTrips = ranked.reduce((sum, item) => sum + item.value, 0);
  const top = ranked.slice(0, limit);
  const busiest = top[0]?.value ?? 0;
  const rows: ServiceRow[] = top.map((item) => ({
    name: item.name, trips: item.value, percent: share(item.value, totalTrips), width: busiest > 0 ? (item.value / busiest) * 100 : 0, other: false,
  }));
  const rest = ranked.slice(limit).reduce((sum, item) => sum + item.value, 0);
  if (rest > 0) rows.push({ name: 'All other services', trips: rest, percent: share(rest, totalTrips), width: Math.min(100, (rest / busiest) * 100), other: true });
  return { rows, shown: top.length, total: ranked.length };
}

/**
 * The four main services, with the same names and colours as the AI Demand Forecast's
 * Service Share donut (forecast/format.ts SERVICE_COLORS; UNMAPPED_COLOR for the rest).
 */
export const MAIN_SERVICES: { name: string; key: string; color: string }[] = [
  { name: 'Lipat Bahay', key: 'lipatbahay', color: '#f59e0b' },
  { name: 'Office Pull Out', key: 'officepullout', color: '#a855f7' },
  { name: 'Corporate Delivery', key: 'corporatedelivery', color: '#3b82f6' },
  { name: 'Unit to Unit Transfer', key: 'unittounittransfer', color: '#22c55e' },
];
const OTHER_SERVICE_COLOR = '#94a3b8';
const EXTRA_SERVICE_COLORS = ['#1a1f6e', '#ef4444', '#0ea5e9', '#d946ef', '#14b8a6'];

/** The main service a booking's service name belongs to, or null for any other (unmapped) service. */
export function mainServiceOf(name: string): (typeof MAIN_SERVICES)[number] | null {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  return MAIN_SERVICES.find((service) => key.includes(service.key)) ?? null;
}

export interface ServiceSlice { name: string; trips: number; percent: number; color: string; other: boolean; unmapped: boolean }

/**
 * Donut slices for Service type.
 * - By default only the four main services, with shares of their combined trips.
 * - With `includeUnmapped`, the other services are added too (the busiest `otherLimit`
 *   by name, the rest as "All other services") and every share is re-based on all trips.
 * Spellings such as "Office Pull out" and "Office Pull Out" count as one main service.
 */
export function serviceSlices(distribution: { name: string; value: number }[], includeUnmapped = false, otherLimit = 5) {
  const main = new Map<string, number>();
  const others = new Map<string, number>();
  for (const item of distribution) {
    if (item.value <= 0) continue;
    const service = mainServiceOf(item.name);
    if (service) main.set(service.name, (main.get(service.name) ?? 0) + item.value);
    else others.set(item.name, (others.get(item.name) ?? 0) + item.value);
  }
  const unmappedTrips = [...others.values()].reduce((sum, value) => sum + value, 0);
  const mainSlices = MAIN_SERVICES.filter((service) => main.has(service.name))
    .map((service) => ({ name: service.name, trips: main.get(service.name)!, color: service.color, other: false, unmapped: false }))
    .sort((a, b) => b.trips - a.trips);

  const extra: Omit<ServiceSlice, 'percent'>[] = [];
  if (includeUnmapped && unmappedTrips > 0) {
    const ranked = [...others.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    ranked.slice(0, otherLimit).forEach(([name, trips], index) => extra.push({ name, trips, color: EXTRA_SERVICE_COLORS[index % EXTRA_SERVICE_COLORS.length], other: false, unmapped: true }));
    const rest = ranked.slice(otherLimit).reduce((sum, [, trips]) => sum + trips, 0);
    if (rest > 0) extra.push({ name: 'All other services', trips: rest, color: OTHER_SERVICE_COLOR, other: true, unmapped: true });
  }

  const chosen = [...mainSlices, ...extra];
  const base = chosen.reduce((sum, slice) => sum + slice.trips, 0);
  const slices: ServiceSlice[] = chosen.map((slice) => ({ ...slice, percent: share(slice.trips, base) }));
  const top = slices.filter((slice) => !slice.other).reduce<ServiceSlice | null>((best, slice) => (!best || slice.trips > best.trips ? slice : best), null);
  return { slices, top, unmappedTrips, unmappedServices: others.size };
}

export interface Segment { name: string; value: number; percent: number; width: number; color: string }

/** Stacked-bar segments with proportional widths; colours come from the palette, then fallbacks. */
export function segments(items: { name: string; value: number }[], palette: Record<string, string>): Segment[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let fallback = 0;
  return items.map((item) => ({
    ...item,
    percent: share(item.value, total),
    width: total > 0 ? (item.value / total) * 100 : 0,
    color: palette[item.name] ?? FALLBACK_COLORS[fallback++ % FALLBACK_COLORS.length],
  }));
}

/** Booking status labels in sentence case, as the rest of the page writes them. */
export function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
