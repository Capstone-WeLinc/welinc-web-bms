import { Check, Send, Siren, X } from 'lucide-react';
import { StatusBadge } from '../ui/StandardTable';

/**
 * The body of a crew leave / emergency request in Admin's "Review" popup (specs bms/0003, 0005).
 * Drivers and helpers file these themselves from the bms-mobile app.
 */

export type CrewLeaveView = {
  kind: string; status: string; crewName: string; crewType: string;
  startDate: string; endDate: string; reason: string; decisionReason?: string | null;
};
export type CrewLeaveAudit = { actorName?: string; action: string; reason?: string | null; createdAt: string };
export type CrewLeaveTrip = { bookingUuid: string; bookingNo?: string; client?: string; serviceDate: string; dispatchTime?: string | null };

const dateOnly = (date: string) => {
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};
const dateTime = (date?: string | null) => {
  if (!date) return 'Not available';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Not available';
  const datePart = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(value);
  const timePart = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(value);
  return `${datePart}, ${timePart}`;
};
const actionTitle = (action: string) => action.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const stepStyle = (action: string) => ['approved', 'confirmed'].includes(action) ? 'bg-emerald-50 text-emerald-700' : action === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-[#eef0fa] text-[#1a1f6e]';
const stepTitleStyle = (action: string) => ['approved', 'confirmed'].includes(action) ? 'text-emerald-700' : action === 'rejected' ? 'text-red-700' : 'text-slate-900';

/** "Requested" reads as "Pending" everywhere, like the CS For Approvals page. */
export function CrewLeaveStatusPill({ status }: { status: string }) {
  const label = status === 'Requested' ? 'Pending' : status;
  if (label === 'Approved') {
    return <span className="inline-flex min-w-24 justify-center rounded-full border border-[#30c967] bg-[#dcfce7] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#22ad4f]">{label}</span>;
  }
  return <StatusBadge status={label} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{children}</h3>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className="mt-0.5 break-words text-[15px] font-medium text-slate-900">{value}</p></div>;
}

export default function CrewLeaveDetails({ request, audit, trips }: {
  request: CrewLeaveView; audit: CrewLeaveAudit[]; trips: CrewLeaveTrip[];
}) {
  const pending = request.status === 'Requested';
  const active = pending || request.status === 'Approved';
  const role = request.crewType === 'HELPER' ? 'Helper' : 'Driver';
  const days = Math.round((Date.parse(`${request.endDate}T00:00:00Z`) - Date.parse(`${request.startDate}T00:00:00Z`)) / 86400000) + 1;
  const dates = request.startDate === request.endDate ? dateOnly(request.startDate) : `${dateOnly(request.startDate)} – ${dateOnly(request.endDate)}`;

  return <>
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3"><SectionLabel>Request</SectionLabel><CrewLeaveStatusPill status={request.status} /></div>
      {request.kind === 'EMERGENCY' && pending && <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"><Siren size={16} aria-hidden="true" />
        In effect now – {request.crewName} is already unavailable.</p>}
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
        <Field label="Crew member" value={`${request.crewName} (${role})`} />
        <Field label="Dates" value={dates} />
        <Field label="Duration" value={days === 1 ? '1 day' : `${days} days`} />
      </div>
      <div className="mt-4"><Field label="Reason" value={request.reason} /></div>
    </section>
    {request.status === 'Rejected' && <section className="rounded-xl border border-red-200 bg-red-50 p-3.5">
      <p className="text-sm font-medium text-red-800">Rejected by Admin</p>
      <p className="mt-1 text-sm text-red-700">{request.decisionReason || 'No reason given.'}</p>
    </section>}
    {active && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Trips affected</SectionLabel>{trips.length === 0
      ? <p className="mt-3 text-sm text-slate-600">None on these dates.</p>
      : <>
        <ul className="mt-3 space-y-1.5">{trips.map((trip) => <li key={trip.bookingUuid} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="font-medium">{trip.bookingNo ?? 'Booking'}</span>{trip.client ? ` · ${trip.client}` : ''} · {dateOnly(trip.serviceDate)}{trip.dispatchTime ? ` ${trip.dispatchTime}` : ''}</li>)}</ul>
        <p className="mt-2 text-xs text-slate-500">Operations will see these trips flagged for reassignment.</p>
      </>}</section>}
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Status timeline</SectionLabel><ol className="mt-3">{audit.map((event, index) => {
      const action = event.action.toLowerCase();
      const Icon = ['approved', 'confirmed'].includes(action) ? Check : action === 'rejected' || action === 'withdrawn' ? X : Send;
      // The filing reason and the rejection reason are already shown above.
      const note = ['filed', 'rejected'].includes(action) ? null : event.reason;
      return <li key={`${event.action}-${event.createdAt}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
        {index < audit.length - 1 && <span className="absolute bottom-0 left-[10px] top-6 border-l-2 border-slate-200" />}
        <span className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${stepStyle(action)}`}><Icon size={13} /></span>
        <div className="min-w-0">
          <p className={`text-[14.5px] font-medium ${stepTitleStyle(action)}`}>{actionTitle(event.action)}</p>
          <p className="text-sm text-slate-600">by <span className="font-semibold text-slate-800">{event.actorName ?? 'Unknown user'}</span> &middot; {dateTime(event.createdAt)}</p>
          {note && <p className="mt-2 rounded-lg p-3 text-sm text-slate-600">{note}</p>}
        </div>
      </li>;
    })}</ol></section>
  </>;
}
