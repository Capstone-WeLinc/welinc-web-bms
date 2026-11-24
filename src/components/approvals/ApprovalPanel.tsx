import { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { CrewLeaveTrip } from '../crewleave/CrewLeaveDetails';
import {
  actionTitle, avatarTone, canDecideStatus, dueInfo, initials, manilaDateTime, peso, requestStyle, shortDetails,
  typeText, type ApprovalItem, type AuditEvent,
} from './approvalUtils';
import ApprovalStatusBadge from './ApprovalStatusBadge';

type Detail = Record<string, unknown>;
const record = (value: unknown) => (value && typeof value === 'object' ? value : {}) as Detail;
const text = (value: unknown, fallback = 'Not available') => (value === null || value === undefined || value === '' ? fallback : String(value));
/** "OPERATIONS" or "CUSTOMER_SERVICE" reads as "Operations" or "Customer Service". */
const titleCase = (value?: string) => (value ?? '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const leaveDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};
const leaveDays = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;

function Avatar({ name, size = 'h-7 w-7 text-[11px]' }: { name?: string; size?: string }) {
  return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${size} ${avatarTone(name)}`}>{initials(name)}</span>;
}

/** Label on the left, value on the right, like the design's detail rows. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-3 py-2 text-sm">
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words text-slate-800">{children}</dd>
  </div>;
}

function Collapsible({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <section className="border-t border-slate-200 px-5 py-4">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">{title}
        {count !== undefined && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">{count}</span>}
      </span>
      <ChevronDown size={16} aria-hidden="true" className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="mt-3">{children}</div>}
  </section>;
}

/** What the request changes or records, per type. Same facts as the old review popup. */
function TypeDetails({ item, detail }: { item: ApprovalItem; detail: Detail }) {
  if (item.type === 'booking') {
    const booking = record(detail.booking);
    const before = record(detail.payloadBefore);
    const after = record(detail.payloadAfter);
    const fields = Object.keys(after);
    return <>
      <Row label="Service">{text(booking.service)}</Row>
      <Row label="Booking date">{text(booking.date)}</Row>
      <Row label="Pickup">{text(booking.pickupAddress)}</Row>
      <Row label="Delivery">{text(booking.deliveryAddress ?? booking.address)}</Row>
      {/* The reason CS gave (always shown for cancellations, as in the old review popup). */}
      {(item.subtype === 'cancel' || text(detail.reason, '')) && <Row label="Reason">{text(detail.reason, 'No reason provided.')}</Row>}
      {item.subtype === 'reschedule' && fields.length > 0 && <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">Current</th><th className="px-3 py-2 font-medium">Requested</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{fields.map((field) => <tr key={field}>
            <td className="px-3 py-2 capitalize text-slate-700">{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</td>
            <td className="px-3 py-2 text-slate-500">{text(before[field], 'Not set')}</td>
            <td className="px-3 py-2 font-medium text-emerald-700">{text(after[field], '')}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </>;
  }
  if (item.type === 'collection') {
    return <>
      <Row label="Method">{text(detail.method)}</Row>
      <Row label="Reference">{text(detail.reference)}</Row>
      <Row label="Recorded by">{text(detail.recordedByName ?? item.submittedByName, 'Unknown user')}</Row>
    </>;
  }
  if (item.type === 'refund') {
    const collection = record(detail.collection);
    return <>
      <Row label="Reason">{text(detail.reason)}</Row>
      <Row label="Original payment">{`${text(collection.method, 'Payment')} - ${text(collection.reference, 'Reference unavailable')}`}</Row>
    </>;
  }
  // Crew leave and emergencies: the facts that used to sit in a separate "Request" card.
  const start = text(detail.startDate, '');
  const end = text(detail.endDate, start);
  const status = text(detail.status, item.status);
  const trips = Array.isArray(detail.affectedTrips) ? detail.affectedTrips as CrewLeaveTrip[] : [];
  const days = start ? leaveDays(start, end) : 0;
  return <>
    <Row label="Crew member">{text(detail.crewName, item.bookingNo)}{detail.crewType ? ` (${detail.crewType === 'DRIVER' ? 'Driver' : 'Helper'})` : ''}</Row>
    <Row label="Dates">{start ? (start === end ? leaveDate(start) : `${leaveDate(start)} – ${leaveDate(end)}`) : 'Not available'}</Row>
    <Row label="Duration">{days === 1 ? '1 day' : `${days} days`}</Row>
    <Row label="Reason">{text(detail.reason)}</Row>
    {status === 'Rejected' && <Row label="Rejected">{text(detail.decisionReason, 'No reason given.')}</Row>}
    {['Requested', 'Approved'].includes(status) && <Row label="Trips affected">{trips.length === 0
      ? 'None on these dates'
      : <ul className="space-y-1">{trips.map((trip) => <li key={trip.bookingUuid} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
        <span className="font-medium">{trip.bookingNo ?? 'Booking'}</span>{trip.client ? ` · ${trip.client}` : ''} · {leaveDate(trip.serviceDate)}{trip.dispatchTime ? ` ${trip.dispatchTime}` : ''}
      </li>)}</ul>}</Row>}
  </>;
}

/** What happens when Admin decides, shown above the buttons. */
function decisionNote(item: ApprovalItem) {
  if (item.type === 'collection') return 'Verify confirms this payment and includes it in Daily Sales.';
  if (item.type === 'refund') return 'Approval creates the linked reversal against the original payment.';
  if (item.type === 'booking' && item.subtype === 'reschedule') return 'Approving applies the requested change. Rescheduling releases the current assignment and returns the booking to plotting.';
  if (item.type === 'booking' && item.subtype === 'cancel') return 'Cancelling withdraws pending collections. Any verified payment creates a refund request for review.';
  return null;
}

export default function ApprovalPanel({ item, detail, loading, busy, onClose, onDecide }: {
  item: ApprovalItem; detail: Detail | null; loading: boolean; busy: boolean;
  onClose: () => void; onDecide: (decision: 'approve' | 'reject', reason?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const style = requestStyle(item);
  const canDecide = canDecideStatus(item.status);
  const due = dueInfo(item.submittedAt);
  const Icon = style.icon;
  const emergency = item.type === 'crew' && item.subtype === 'emergency';
  const approveText = item.type === 'collection' ? 'Verify' : emergency ? 'Confirm' : 'Approve';
  const audit: AuditEvent[] = Array.isArray(detail?.audit) ? detail.audit as AuditEvent[] : [];

  // Crew requests already show their rejection reason in their own rows.
  const decisionReason = !canDecide && item.type !== 'crew' ? text(item.decisionReason ?? detail?.decisionReason, '') : '';
  // Audit trail: recorded steps, or just "Request submitted" when none were recorded, then the open step.
  const steps = [
    ...(audit.length ? audit.map((event) => ({ title: actionTitle(event.action), at: event.createdAt, by: event.actorName }))
      : [{ title: 'Request submitted', at: item.submittedAt, by: item.submittedByName }]),
    ...(canDecide ? [{ title: 'Pending your approval', at: undefined, by: undefined }] : []),
  ];
  // Crew requests are titled by the person; everything else by what is being asked.
  const crewName = item.type === 'crew' ? text(detail?.crewName, '') : '';
  const title = crewName || shortDetails(item);
  const subtitle = item.type === 'crew'
    ? [crewName ? (text(detail?.crewType, '') === 'HELPER' ? 'Helper' : 'Driver') : '', shortDetails(item)].filter(Boolean).join(' · ')
    : '';
  const note = canDecide ? decisionNote(item) : null;

  return <aside aria-label={`${item.bookingNo} details`} className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-[400px] flex-col border-l border-slate-200 bg-white shadow-2xl xl:absolute xl:inset-0 xl:z-auto xl:w-auto xl:max-w-none xl:rounded-xl xl:border xl:shadow-sm">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-base font-bold text-slate-900">{item.bookingNo}</h2>
          <ApprovalStatusBadge status={item.status} />
        </div>      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Close details" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"><X size={18} /></button>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? <p className="px-5 py-10 text-center text-sm text-slate-500">Loading details...</p> : <>
        <section className="m-4 rounded-xl border border-slate-200">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.tile}`}><Icon size={18} aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900" title={item.summary}>{title}</p>
                {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
              </div>
            </div>
            {item.amount !== null && <div className="shrink-0 text-right">
              <p className="text-lg font-bold tabular-nums text-slate-900">{peso.format(item.amount)}</p>
              <p className="text-xs text-slate-500">Amount</p>
            </div>}
          </div>
          <dl className="px-4 py-2">
            <Row label="Requester"><span className="flex items-center gap-2"><Avatar name={item.submittedByName} /><span className="min-w-0"><span className="block truncate font-medium">{item.submittedByName ?? 'Unknown user'}</span><span className="block text-xs text-slate-500">{titleCase(item.submittedByRole)}</span></span></span></Row>
            <Row label="Request type"><span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${style.pill}`}>{typeText(item)}</span></Row>
            {item.type !== 'crew' && <Row label="Client">{item.client}</Row>}
            <Row label="Submitted">{manilaDateTime(item.submittedAt)}</Row>
            {canDecide && <Row label="Due"><span className="block">{manilaDateTime(due.dueAt.toISOString())}</span><span className={`block text-xs font-medium ${due.tone}`}>{due.label}</span></Row>}
            {!canDecide && item.decidedAt && <Row label="Decided">{manilaDateTime(item.decidedAt)}{item.decidedByName ? ` by ${item.decidedByName}` : ''}</Row>}
            {detail && <TypeDetails item={item} detail={detail} />}
            {decisionReason && <Row label="Decision note">{decisionReason}</Row>}
          </dl>
        </section>

        <Collapsible title="Audit Trail" count={steps.length}>
          <ol>{steps.map((step, index) => {
            const last = index === steps.length - 1;
            return <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span aria-hidden="true" className="absolute bottom-0 left-[4px] top-3 border-l border-slate-200" />}
              <span aria-hidden="true" className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-slate-400'}`} />
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <p className="text-sm text-slate-800">{step.title}</p>
                {step.at && <p className="shrink-0 text-right text-xs text-slate-500">{manilaDateTime(step.at)}{step.by && <><br />by {step.by}</>}</p>}
              </div>
            </li>;
          })}</ol>
        </Collapsible>

        {rejecting && <section className="border-t border-slate-200 px-5 py-4">
          <label htmlFor="reject-reason" className="text-sm font-medium text-slate-700">Reason for rejection <span className="text-red-600">*</span></label>
          <textarea id="reject-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} maxLength={500} rows={3} autoFocus
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20" placeholder="Enter a reason for the submitter" />
          {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </section>}
      </>}
    </div>

    {canDecide && !loading && <footer className="shrink-0 border-t border-slate-200 p-4">
      {note && !rejecting && <p className="mb-3 text-xs leading-relaxed text-slate-500">{note}</p>}
      <div className="grid grid-cols-2 gap-3">
        {rejecting ? <>
          <button type="button" disabled={busy} onClick={() => { setRejecting(false); setReason(''); setError(''); }} className="h-11 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Back</button>
          <button type="button" disabled={busy} onClick={() => { if (!reason.trim()) { setError('Enter a reason before rejecting.'); return; } onDecide('reject', reason.trim()); }} className="h-11 rounded-lg bg-red-600 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">{busy ? 'Saving...' : 'Confirm rejection'}</button>
        </> : <>
          <button type="button" disabled={busy} onClick={() => onDecide('approve')} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={17} aria-hidden="true" />{busy ? 'Saving...' : approveText}</button>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"><X size={17} aria-hidden="true" />Reject</button>
        </>}
      </div>
    </footer>}
  </aside>;
}
