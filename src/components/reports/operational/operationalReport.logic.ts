/**
 * Display rules for the Operational Report. No imports and no React, so the rules
 * can be unit-tested with `node --test` (see tests-unit/).
 * The figures themselves come from GET /reports/operational and
 * GET /reports/resources-snapshot; definitions live in the analytics service
 * (src/reports/operational/operational-report.ts).
 */

export interface OperationalTotals {
  bookings: number;
  withVehicle: number;
  unassigned: number;
  completed: number;
  cancelled: number;
  jobOrders: number;
  jobOrdersNotDistributed: number;
}

export interface OperationalReportData {
  params?: { from: string; to: string; serviceId: string; vehicleId: string; timezone: string; includesCancelledInTotal: boolean };
  totals: OperationalTotals;
  monthly: { month: string; completed: number; cancelled: number }[];
  jobsPerVehicle: { vehicleId: string; plate: string; alias: string | null; jobs: number }[];
}

/** Same three states as the driver and helper badges: Available, On Duty, On Leave. */
export interface CrewCounts { onRoster: number; available: number; onDuty: number; onLeave: number }

export interface ResourcesSnapshotData {
  vehicles: { total: number; available: number; assigned: number; underMaintenance: number; underRepair: number };
  drivers: CrewCounts;
  helpers: CrewCounts;
}

export const CHART_COLORS = {
  navy: '#1a1f6e',
  completed: '#22c55e',
  cancelled: '#ef4444',
  assigned: '#3b82f6',
  maintenance: '#a855f7',
  onLeave: '#a855f7',
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-11-11" -> "Nov 11, 2025". Read as a calendar day, so the viewer's timezone never shifts it. */
export function formatDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

/** "Nov 11, 2025 to Nov 10, 2026", always with the year. */
export function formatRange(from: string, to: string): string {
  return `${formatDay(from)} to ${formatDay(to)}`;
}

/** "2025-11" -> "Nov 25". */
export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;
}

/** "2025-11" -> "November 2025", for screen readers. */
function monthName(month: string): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Share of bookings in the period that have a vehicle, to a whole percent. */
export function vehiclePercent(totals: Pick<OperationalTotals, 'bookings' | 'withVehicle'>): number {
  return totals.bookings > 0 ? Math.round((totals.withVehicle / totals.bookings) * 100) : 0;
}

export type CardTone = 'muted' | 'amber';
export type CardIcon = 'clipboard' | 'truck' | 'check' | 'package';

export interface PerformanceCard {
  key: 'bookings' | 'withVehicle' | 'completed' | 'jobOrders';
  label: string;
  value: string;
  caption: string;
  captionTone: CardTone;
  icon: CardIcon;
  tint: string;
}

/** The four cards, in order. On-time arrival is no longer tracked, so it has no card. */
export function performanceCards(totals: OperationalTotals): PerformanceCard[] {
  return [
    { key: 'bookings', label: 'Total bookings', value: String(totals.bookings), caption: 'Received in this period', captionTone: 'muted', icon: 'clipboard', tint: CHART_COLORS.navy },
    {
      key: 'withVehicle', label: 'Bookings with a vehicle', value: `${vehiclePercent(totals)}%`,
      caption: `${totals.unassigned} still unassigned`, captionTone: totals.unassigned > 0 ? 'amber' : 'muted', icon: 'truck', tint: CHART_COLORS.assigned,
    },
    { key: 'completed', label: 'Completed services', value: String(totals.completed), caption: `${totals.cancelled} cancelled`, captionTone: 'muted', icon: 'check', tint: CHART_COLORS.completed },
    { key: 'jobOrders', label: 'Job orders', value: String(totals.jobOrders), ...jobOrdersCaption(totals), icon: 'package', tint: CHART_COLORS.maintenance },
  ];
}

export function jobOrdersCaption(totals: Pick<OperationalTotals, 'jobOrdersNotDistributed'>): { caption: string; captionTone: CardTone } {
  return totals.jobOrdersNotDistributed > 0
    ? { caption: `${totals.jobOrdersNotDistributed} not yet distributed`, captionTone: 'amber' }
    : { caption: 'All distributed', captionTone: 'muted' };
}

/** Recharts tick interval: 0 labels every month, 1 labels every second month when each month gets under 48px. */
export function monthTickInterval(chartWidth: number, months: number): 0 | 1 {
  if (months <= 1 || chartWidth <= 0) return 0;
  return chartWidth / months >= 48 ? 0 : 1;
}

/** Whole-number y-axis ticks from 0, at least 0 to 4. */
export function integerTicks(maxValue: number): number[] {
  const top = Math.max(4, Math.ceil(maxValue));
  const step = Math.ceil(top / 4);
  const ticks: number[] = [];
  for (let tick = 0; tick < top + step; tick += step) {
    ticks.push(tick);
    if (tick >= top) break;
  }
  return ticks;
}

export function chartRows(monthly: OperationalReportData['monthly']) {
  return monthly.map((month) => ({ ...month, label: monthLabel(month.month) }));
}

/** Accessible description of the closed-jobs chart. */
export function closedJobsAriaLabel(monthly: OperationalReportData['monthly'], from: string, to: string): string {
  const completed = monthly.reduce((sum, month) => sum + month.completed, 0);
  const cancelled = monthly.reduce((sum, month) => sum + month.cancelled, 0);
  const busy = monthly.filter((month) => month.completed + month.cancelled > 0)
    .map((month) => `${monthName(month.month)}: ${month.completed} completed, ${month.cancelled} cancelled`);
  return `Stacked bar chart of closed jobs per month, ${formatRange(from, to)}. ${completed} completed and ${cancelled} cancelled in total.`
    + (busy.length ? ` ${busy.join('; ')}.` : ' No jobs closed in any month.');
}

export function topVehicles(rows: OperationalReportData['jobsPerVehicle'], limit = 8) {
  return [...rows].sort((a, b) => b.jobs - a.jobs || a.plate.localeCompare(b.plate)).slice(0, limit);
}

/** Bar width as a percentage of the busiest vehicle. */
export function vehicleBarWidth(jobs: number, busiest: number): number {
  return busiest > 0 ? (jobs / busiest) * 100 : 0;
}

export interface Segment { key: string; label: string; count: number; color: string; width: number }

/** Segment widths proportional to counts. A zero total gives zero-width segments over an empty track. */
export function segments(parts: Omit<Segment, 'width'>[]): Segment[] {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  return parts.map((part) => ({ ...part, width: total > 0 ? (part.count / total) * 100 : 0 }));
}

export interface ResourceRow { key: 'vehicles' | 'drivers' | 'helpers'; name: string; totalLabel: string; segments: Segment[] }

export function resourceRows(snapshot: ResourcesSnapshotData): ResourceRow[] {
  const crew = (counts: CrewCounts) => segments([
    { key: 'available', label: 'Available', count: counts.available, color: CHART_COLORS.completed },
    { key: 'onDuty', label: 'On duty', count: counts.onDuty, color: CHART_COLORS.assigned },
    { key: 'onLeave', label: 'On leave', count: counts.onLeave, color: CHART_COLORS.onLeave },
  ]);
  const { vehicles } = snapshot;
  return [
    {
      key: 'vehicles', name: 'Vehicles', totalLabel: `${vehicles.total} in fleet`,
      segments: segments([
        { key: 'available', label: 'Available', count: vehicles.available, color: CHART_COLORS.completed },
        { key: 'assigned', label: 'Assigned', count: vehicles.assigned, color: CHART_COLORS.assigned },
        { key: 'underMaintenance', label: 'Under maintenance', count: vehicles.underMaintenance, color: CHART_COLORS.maintenance },
        { key: 'underRepair', label: 'Under repair', count: vehicles.underRepair, color: CHART_COLORS.cancelled },
      ]),
    },
    { key: 'drivers', name: 'Drivers', totalLabel: `${snapshot.drivers.onRoster} on roster`, segments: crew(snapshot.drivers) },
    { key: 'helpers', name: 'Helpers', totalLabel: `${snapshot.helpers.onRoster} on roster`, segments: crew(snapshot.helpers) },
  ];
}

export function resourceAriaLabel(row: ResourceRow): string {
  return `${row.name}, ${row.totalLabel}: ${row.segments.map((segment) => `${segment.count} ${segment.label.toLowerCase()}`).join(', ')}`;
}
