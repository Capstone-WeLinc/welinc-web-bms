import type { ReactNode } from 'react';
import { AlertTriangle, CircleHelp, ShieldCheck, Sparkles } from 'lucide-react';
import KPICard from '../../shared/KpiCard';

type IconType = typeof Sparkles;

/**
 * Card used for every section. The body grows to fill the card and the footer is
 * pinned to the bottom, so cards in the same row line up at equal height.
 */
export function Panel({ title, subtitle, action, className = '', children, icon: Icon, footer }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; className?: string; children: ReactNode; icon?: IconType; footer?: ReactNode;
}) {
  return <article className={`flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(26,31,110,0.12)] ${className}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a1f6e] to-[#3159c8] text-white shadow-sm"><Icon size={18} aria-hidden="true" /></span>}
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
    <div className="flex flex-1 flex-col px-5 py-4 sm:px-6">{children}</div>
    {footer && <footer className="mt-auto border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">{footer}</footer>}
  </article>;
}

/** KPI tile: the same shared KPICard (dashboard-compact) that the Admin Dashboard uses. */
export function StatCard({ label, value, description, icon, accent, muted = false, tone }: {
  label: string; value: string; description?: ReactNode; icon: IconType; accent: string; muted?: boolean; tone?: 'positive' | 'negative' | 'warning';
}) {
  const valueClassName = muted ? 'text-slate-400' : tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : undefined;
  return <KPICard variant="dashboard-compact" label={label} value={value} icon={icon} iconColor={accent} description={description} valueClassName={valueClassName}
    // The shared card lifts on hover; the forecast keeps its cards still (important modifiers win over the shared classes).
    className="hover:!translate-y-0 hover:!shadow-sm" />;
}

export function EmptyState({ text, height = 'min-h-[180px]' }: { text: ReactNode; height?: string }) {
  return <div className={`flex ${height} flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 text-center text-sm text-slate-500`}>{text}</div>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  const styles = tone === 'warning' ? 'border-amber-200 bg-amber-50/80 text-amber-900' : 'border-blue-100 bg-blue-50/80 text-blue-900';
  const Icon = tone === 'warning' ? AlertTriangle : CircleHelp;
  return <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-5 ${styles}`}><Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><div>{children}</div></div>;
}

/** Marks where a figure comes from: verified booking/fleet data, a fixed rule, or the LLM. */
export function SourceBadge({ source }: { source: 'verified' | 'rule' | 'ai' }) {
  const config = {
    verified: { label: 'Verified data', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', Icon: ShieldCheck },
    rule: { label: 'Rule-based', className: 'border-slate-200 bg-slate-50 text-slate-600', Icon: ShieldCheck },
    ai: { label: 'AI-generated', className: 'border-violet-200 bg-violet-50 text-violet-700', Icon: Sparkles },
  }[source];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${config.className}`}><config.Icon size={11} aria-hidden="true" />{config.label}</span>;
}

export function LegendDot({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
    {dashed
      ? <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden="true" />
      : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />}
    {label}
  </span>;
}

/** Small pill toggle group used for chart options (weekly/daily, resource). */
export function Toggle<T extends string>({ value, options, onChange, label }: { value: NoInfer<T>; options: readonly T[]; onChange: (value: NoInfer<T>) => void; label: string }) {
  return <div className="flex rounded-full border border-slate-200 bg-slate-100/70 p-0.5" role="group" aria-label={label}>
    {options.map((option) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${value === option ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-600 hover:text-[#1a1f6e]'}`}>{option}</button>)}
  </div>;
}

export function KpiSkeletonRow() {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex min-h-[96px] animate-pulse items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100" />
      <div className="flex-1 space-y-2"><div className="h-3 w-28 rounded bg-slate-100" /><div className="h-5 w-16 rounded bg-slate-200" /><div className="h-3 w-36 rounded bg-slate-100" /></div>
    </div>)}
  </div>;
}

export function ChartSkeleton({ height = 'h-[300px]' }: { height?: string }) {
  return <div className={`${height} w-full animate-pulse rounded-xl bg-slate-50`} aria-hidden="true">
    <div className="flex h-full items-end gap-3 px-6 pb-6">{[40, 65, 50, 80, 55, 70, 45].map((h, i) => <div key={i} className="flex-1 rounded-t bg-slate-100" style={{ height: `${h}%` }} />)}</div>
  </div>;
}

export function DashboardSkeleton() {
  return <div className="space-y-6" role="status" aria-label="Loading forecast">
    <KpiSkeletonRow />
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {[0, 1].map((i) => <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-6"><div className="mb-4 h-5 w-48 animate-pulse rounded bg-slate-100" /><ChartSkeleton /></div>)}
    </div>
  </div>;
}

/** Collapsible accessible table view for a chart. */
export function DataTable({ caption, columns, rows }: { caption: string; columns: { key: string; label: string; align?: 'right' }[]; rows: Record<string, ReactNode>[] }) {
  return <details className="group">
    <summary className="cursor-pointer list-none text-xs font-semibold text-[#1a1f6e] hover:underline"><span className="group-open:hidden">Show data table</span><span className="hidden group-open:inline">Hide data table</span></summary>
    <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-slate-50 text-slate-600"><tr>{columns.map((column) => <th key={column.key} scope="col" className={`px-3 py-2 font-semibold ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column.key} className={`px-3 py-1.5 text-slate-700 ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>{row[column.key]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}
