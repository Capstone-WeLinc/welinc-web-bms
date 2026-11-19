import type { ForecastHorizon } from './types';

/** Colours validated for colour-blind separation in this order (adjacent pairs). */
export const SERVICE_COLORS: Record<string, string> = {
  'Corporate Delivery': '#3b82f6',
  'Lipat Bahay': '#f59e0b',
  'Office Pull Out': '#a855f7',
  'Unit to Unit Transfer': '#22c55e',
};
export const UNMAPPED_COLOR = '#94a3b8';
export const ACTUAL_COLOR = '#3159c8';
export const FORECAST_COLOR = '#d4a72c';
export const RESOURCE_COLORS = { trucks: '#3159c8', drivers: '#d4a72c', helpers: '#0ea5e9' } as const;

export const tooltipStyle = { borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
export const axisTick = { fontSize: 12, fill: '#64748b' };
export const gridStroke = '#e2e8f0';

const numberFormat = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });
export const num = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) ? 'N/A' : numberFormat.format(value));
export const pct = (value: number | null | undefined, signed = false) => (value === null || value === undefined || !Number.isFinite(value)
  ? 'N/A'
  : `${signed && value > 0 ? '+' : ''}${numberFormat.format(value)}%`);

export function formatDate(value?: string | null, options: { weekday?: boolean; year?: boolean } = {}) {
  if (!value) return 'N/A';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-PH', { ...(options.weekday ? { weekday: 'short' as const } : {}), month: 'short', day: 'numeric', ...(options.year ? { year: 'numeric' as const } : {}) });
}
export const formatRange = (start: string, end: string) => (start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`);
export const formatMonth = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });

/** Forecast period options. ("Next month" was removed from the list; the horizon type still accepts it.) */
export function horizonOptions(): { id: ForecastHorizon; label: string }[] {
  return [
    { id: '7days', label: 'Next 7 days' },
    { id: '30days', label: 'Next 30 days' },
    { id: '90days', label: 'Next 90 days' },
  ];
}

/** Every chart in the module uses this box, so all charts share the same size. */
export const CHART_BOX = 'h-[300px] w-full min-w-0';
/** Two equal columns: charts are always paired side by side at the same width. */
export const PAIR_GRID = 'grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2';
