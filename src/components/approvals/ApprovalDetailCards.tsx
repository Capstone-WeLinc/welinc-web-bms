import { createContext, useContext, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { DetailCard } from '../services/ServiceDetails';
import type { CrewLeaveTrip } from '../crewleave/CrewLeaveDetails';
import {
  actionTitle, dueInfo, leaveDate, leaveDays, manilaDateTime, peso, record, text, titleCase,
  typeText, type ApprovalItem, type AuditEvent, type Detail,
} from './approvalUtils';

/**
 * `card`: One UI cards, for the History details modal.
 * `panel`: the Needs action side panel's own containers (a bordered first section, then
 * collapsible sections). Titles, rows and the timeline look the same in both.
 */
type Variant = 'card' | 'panel';
const VariantContext = createContext<Variant>('card');

/**
 * What one approval request is, in the same order everywhere: Request Details, Booking Details
 * (reschedules and cancellations) and Timeline. Shared by the side panel on Needs action and the
 * details modal on History, so both show the same facts, each once; only the look differs.
 */
export default function ApprovalDetailCards({ item, detail, pending, variant = 'card' }: { item: ApprovalItem; detail: Detail; pending: boolean; variant?: Variant }) {
  return <VariantContext.Provider value={variant}>
    <RequestCard item={item} detail={detail} />
    {item.type === 'booking' && <BookingCard item={item} detail={detail} />}
    <TimelineCard item={item} detail={detail} pending={pending} />
  </VariantContext.Provider>;
}

/** The One UI gold bar before a section title (as on the modal's cards). */
function GoldBar() {
  return <span aria-hidden="true" className="h-4 w-[3px] shrink-0 rounded-full bg-[#e8b800]" />;
}

/** The One UI section title (gold bar, navy uppercase text), as on the modal's cards. */
const titleClass = 'flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]';

/** A titled section: a One UI card, or in the panel a bordered box (`boxed`) or a collapsible section. */
function Section({ title, boxed = false, children }: { title: string; boxed?: boolean; children: ReactNode }) {
  const variant = useContext(VariantContext);
  const [open, setOpen] = useState(true);
  if (variant === 'card') return <DetailCard title={title}>{children}</DetailCard>;
  if (boxed) {
    return <section className="m-4 rounded-xl border border-slate-200 p-4">
      <h3 className={titleClass}><GoldBar />{title}</h3>
      <div className="mt-3">{children}</div>
    </section>;
  }
  return <section className="border-t border-slate-200 px-5 py-4">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
      <span className={titleClass}><GoldBar />{title}</span>
      <ChevronDown size={16} aria-hidden="true" className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="mt-3">{children}</div>}
  </section>;
}

/** Label on the left, value on the right (One UI rows, as in Booking details). */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className="space-y-2.5">{children}</dl>;
}

/** Old value -> new value: old in grey, a gold arrow, new in navy. */
function Change({ from, to }: { from: string; to: string }) {
  return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
    <span className="font-normal text-slate-500">{from}</span>
    <ArrowRight size={14} aria-label="changed to" className="shrink-0 text-[#e8b800]" />
    <span className="font-semibold text-[#1a1f6e]">{to}</span>
  </span>;
}

/** "preferredTime" reads as "Preferred time". */
const fieldLabel = (field: string) => {
  const words = field.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`).trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const fieldValue = (value: unknown) => leaveDate(text(value, 'Not set'));

/** What was asked, starting with the type of request. */
function RequestCard({ item, detail }: { item: ApprovalItem; detail: Detail }) {
  return <Section title="Request Details" boxed>
    <Rows>
      <DetailRow label="Request type">{typeText(item)}</DetailRow>
      <RequestRows item={item} detail={detail} />
    </Rows>
  </Section>;
}

/** The rest of Request Details, per type. */
function RequestRows({ item, detail }: { item: ApprovalItem; detail: Detail }) {
  if (item.type === 'booking') {
    const before = record(detail.payloadBefore);
    const after = record(detail.payloadAfter);
    const reason = text(detail.reason, '');
    if (item.subtype === 'cancel') {
      return <DetailRow label="Reason">{reason || 'No reason provided.'}</DetailRow>;
    }
    return <>
      {Object.keys(after).map(field => <DetailRow key={field} label={fieldLabel(field)}>
        <Change from={fieldValue(before[field])} to={fieldValue(after[field])} />
      </DetailRow>)}
      {reason && <DetailRow label="Reason">{reason}</DetailRow>}
    </>;
  }
  if (item.type === 'collection') {
    return <>
      <DetailRow label="Client">{item.client}</DetailRow>
      {item.amount !== null && <DetailRow label="Amount">{peso.format(item.amount)}</DetailRow>}
      <DetailRow label="Method">{text(detail.method)}</DetailRow>
      <DetailRow label="Reference">{text(detail.reference)}</DetailRow>
    </>;
  }
  if (item.type === 'refund') {
    const collection = record(detail.collection);
    return <>
      <DetailRow label="Client">{item.client}</DetailRow>
      {item.amount !== null && <DetailRow label="Amount">{peso.format(item.amount)}</DetailRow>}
      <DetailRow label="Reason">{text(detail.reason)}</DetailRow>
      <DetailRow label="Original payment">{`${text(collection.method, 'Payment')} - ${text(collection.reference, 'Reference unavailable')}`}</DetailRow>
    </>;
  }
  // Crew leave and emergencies. The crew member's name is already the header's reference line.
  const start = text(detail.startDate, '');
  const end = text(detail.endDate, start);
  const days = start ? leaveDays(start, end) : 0;
  const trips = Array.isArray(detail.affectedTrips) ? detail.affectedTrips as CrewLeaveTrip[] : [];
  return <>
    {detail.crewType ? <DetailRow label="Crew type">{detail.crewType === 'DRIVER' ? 'Driver' : 'Helper'}</DetailRow> : null}
    <DetailRow label="Dates">{start ? (start === end ? leaveDate(start) : `${leaveDate(start)} – ${leaveDate(end)}`) : 'Not available'}</DetailRow>
    {start && <DetailRow label="Duration">{days === 1 ? '1 day' : `${days} days`}</DetailRow>}
    <DetailRow label="Reason">{text(detail.reason)}</DetailRow>
    {['Requested', 'Approved'].includes(text(detail.status, item.status)) && <DetailRow label="Trips affected">{trips.length === 0
      ? 'None on these dates'
      : <ul className="space-y-1">{trips.map(trip => <li key={trip.bookingUuid} className="rounded-md bg-amber-50 px-2 py-1 text-xs font-normal text-amber-900">
        <span className="font-medium">{trip.bookingNo ?? 'Booking'}</span>{trip.client ? ` · ${trip.client}` : ''} · {leaveDate(trip.serviceDate)}{trip.dispatchTime ? ` ${trip.dispatchTime}` : ''}
      </li>)}</ul>}</DetailRow>}
  </>;
}

/** The booking the reschedule or cancellation was for. */
function BookingCard({ item, detail }: { item: ApprovalItem; detail: Detail }) {
  const booking = record(detail.booking);
  return <Section title="Booking Details">
    <Rows>
      <DetailRow label="Client">{item.client}</DetailRow>
      <DetailRow label="Service">{text(booking.service)}</DetailRow>
      <DetailRow label="Pickup">{text(booking.pickupAddress)}</DetailRow>
      <DetailRow label="Delivery">{text(booking.deliveryAddress ?? booking.address)}</DetailRow>
      {item.amount !== null && <DetailRow label="Amount">{peso.format(item.amount)}</DetailRow>}
    </Rows>
  </Section>;
}

const DECISION_ACTIONS = ['approved', 'rejected', 'withdrawn', 'withdraw', 'verified', 'confirmed', 'refunded'];

type Step = { title: string; at?: string; by?: string; role?: string; decision: boolean; due?: ReturnType<typeof dueInfo> };

/**
 * Who did what, and when: the recorded audit steps, or the submission and the decision when none
 * were recorded. It replaces separate Requester, Submitted, Due and Decision rows, which repeated
 * these steps. A request still waiting ends with an open step that shows when it's due.
 */
function TimelineCard({ item, detail, pending }: { item: ApprovalItem; detail: Detail; pending: boolean }) {
  const audit: AuditEvent[] = Array.isArray(detail.audit) ? detail.audit as AuditEvent[] : [];
  const steps: Step[] = audit.length
    ? audit.map(event => ({ title: actionTitle(event.action), at: event.createdAt, by: event.actorName, role: event.actorRole, decision: DECISION_ACTIONS.includes(event.action) }))
    : [{ title: 'Submitted', at: item.submittedAt, by: item.submittedByName, role: item.submittedByRole, decision: false }];
  if (item.decidedAt && !steps.some(step => step.decision)) {
    steps.push({ title: item.status, at: item.decidedAt, by: item.decidedByName, decision: true });
  }
  if (pending) steps.push({ title: 'Waiting for your approval', decision: false, due: dueInfo(item.submittedAt) });
  const note = text(item.decisionReason ?? detail.decisionReason, '');
  // Navy steps, gold decision, hollow gold for the open step.
  const dot = (step: Step) => step.due ? 'border-2 border-[#e8b800] bg-white' : step.decision ? 'bg-[#e8b800]' : 'bg-[#1a1f6e]';

  return <Section title="Timeline">
    <ol>{steps.map((step, index) => {
      const last = index === steps.length - 1;
      const role = step.role && step.role !== 'Unknown role' ? titleCase(step.role) : '';
      return <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
        {!last && <span aria-hidden="true" className="absolute bottom-0 left-[4px] top-3 border-l border-slate-200" />}
        <span aria-hidden="true" className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot(step)}`} />
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{step.title}</p>
            {step.by && <p className="text-sm text-slate-600">by {step.by}{role ? ` · ${role}` : ''}</p>}
            {step.due && <p className="text-sm text-slate-600">Due {manilaDateTime(step.due.dueAt.toISOString())} · <span className={`font-medium ${step.due.tone}`}>{step.due.label}</span></p>}
          </div>
          {step.at && <p className="shrink-0 text-xs text-slate-500">{manilaDateTime(step.at)}</p>}
        </div>
      </li>;
    })}</ol>
    {note && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Decision note</p>
      <p className="mt-1 break-words text-sm text-slate-800">{note}</p>
    </div>}
  </Section>;
}
