import type { ReactNode } from 'react';
import { DETAIL_SECTIONS, hasDetails, type ServiceDetailLists } from './detailLists';

/** A white card with the One UI section title (gold bar, navy uppercase text). */
export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">
        <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The three lists as titled cards, for the View details window on Services Offered. */
export function ServiceDetailCards({ details }: { details: ServiceDetailLists }) {
  return (
    <>
      {DETAIL_SECTIONS.map(({ key, title }) => (
        <DetailCard key={key} title={title}>
          {details[key].length === 0
            ? <p className="text-sm text-slate-500">None listed.</p>
            : <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{details[key].map(line => <li key={line}>{line}</li>)}</ul>}
        </DetailCard>
      ))}
    </>
  );
}

/** The three lists as titled bullet lists. `compact` is the smaller text used inside the booking wizard. */
export function ServiceDetailsSections({ details, compact = false }: { details: ServiceDetailLists; compact?: boolean }) {
  if (!hasDetails(details)) {
    return <p className={compact ? 'text-xs text-slate-500' : 'text-sm text-slate-500'}>No details added yet.</p>;
  }
  return (
    <div className={compact ? 'space-y-2 text-xs text-slate-600' : 'space-y-4 text-sm text-slate-700'}>
      {DETAIL_SECTIONS.filter(({ key }) => details[key].length > 0).map(({ key, title }) => (
        <div key={key}>
          <p className={compact ? 'font-medium' : 'text-xs font-medium uppercase tracking-wider text-[#1a1f6e]'}>{title}</p>
          <ul className={`list-disc pl-4 ${compact ? 'mt-1' : 'mt-1.5 space-y-1'}`}>
            {details[key].map(line => <li key={line}>{line}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
