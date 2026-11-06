import type { ReactNode } from 'react';

// Used by the wizard's review step.
export function ReviewCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3">
        <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">{icon && <span aria-hidden="true">{icon}</span>}<span>{title}</span></h4>
      </div>
      <div className="space-y-2.5 p-4">{children}</div>
    </div>
  );
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3">
      <span className="text-[13px] font-medium text-slate-600">{label}</span>
      <span className="break-words text-[14.5px] font-medium text-slate-900">{value || '—'}</span>
    </div>
  );
}
