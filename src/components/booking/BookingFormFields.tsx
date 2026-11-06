import type { ReactNode } from 'react';

// Used by the new booking wizard.
export function BookingFormSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
    <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">{icon}{title}</h3>
    {children}
  </section>;
}

export function BookingFormField({ id, label, required = false, className = '', children }: { id: string; label: ReactNode; required?: boolean; className?: string; children: ReactNode }) {
  return <div className={className} data-step2-field={id}>
    <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</label>
    {children}
  </div>;
}
