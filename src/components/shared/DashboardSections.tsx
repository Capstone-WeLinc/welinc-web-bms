import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ActionRow({ label, detail, value, tone, onClick }: { label: string; detail: string; value: number; tone: 'red' | 'amber' | 'blue' | 'emerald' | 'slate'; onClick: () => void }) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-[filter] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 ${tones[tone]}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-sm opacity-80">{detail}</span>
      </span>
      <span className="shrink-0 text-xl font-semibold tabular-nums">{value}</span>
    </button>
  );
}

const WATCH_TONES = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600',
};

/** A light monitoring row: a small tinted icon, the label, and the count. */
export function WatchRow({ label, detail, value, icon: Icon, tone, onClick }: { label: string; detail: string; value: number; icon: LucideIcon; tone: keyof typeof WATCH_TONES; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${WATCH_TONES[tone]}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-800">{label}</span>
          <span className="block text-xs text-slate-500">{detail}</span>
        </span>
        <span className="shrink-0 text-lg font-semibold tabular-nums text-slate-800">{value}</span>
      </button>
    </li>
  );
}

export function ScheduleJobRow({ time, client, reference, isUnassigned, truck, driver, trailing }: { time: string; client?: string; reference?: string; isUnassigned: boolean; truck?: string; driver?: string; trailing: ReactNode }) {
  return (
    <li className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[76px_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <span className="text-[15px] font-semibold tabular-nums text-[#1a1f6e]">{time}</span>
      <span className="min-w-0">
        <span className="block break-words text-[15px] font-medium text-slate-900">{client || 'Client unavailable'}</span>
        <span className="block text-sm tabular-nums text-slate-600">{reference}</span>
      </span>
      <span className="col-start-2 min-w-0 text-sm sm:col-start-auto">
        {isUnassigned ? (
          <span className="text-slate-400">No truck or team yet</span>
        ) : (
          <>
            <span className="block font-medium text-slate-900">{truck || 'Truck not recorded'}</span>
            <span className="block break-words text-slate-600">{driver || 'Driver not recorded'}</span>
          </>
        )}
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:justify-end">{trailing}</span>
    </li>
  );
}
