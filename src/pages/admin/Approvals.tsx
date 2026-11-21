import { StatusFilter } from '../../components/ui/ListSearchFilters';
import ModalHeader from '../../components/ui/ModalHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import { AlarmClock, CalendarOff, Check, CheckCheck, ClipboardCheck, Clock3, Coins, Eye, FileCheck2, History, Search, ShieldAlert, Siren, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import CrewLeaveDetails, { type CrewLeaveAudit, type CrewLeaveTrip } from '../../components/crewleave/CrewLeaveDetails';

type ItemType = 'booking' | 'collection' | 'refund' | 'crew';
type ApprovalItem = {
  id: string; type: ItemType; subtype: string | null; bookingId?: string;
  bookingNo: string; client: string; summary: string; amount: number | null;
  submittedAt: string; submittedBy: string; submittedByName?: string; submittedByRole?: string; status: string; decisionReason?: string | null;
  startDate?: string; endDate?: string;
  /** History only. */
  decidedAt?: string; decidedByName?: string;
};
type ApprovalCounts = {
  total: number; booking: number; collection: number; refund: number; crew: number; emergency: number; overdue: number;
  oldestAt: string | null; collectionAmount: number; refundAmount: number;
};
type PageResult = { items: ApprovalItem[]; total: number; page: number; limit: number };
type FilterType = 'all' | ItemType;
type View = 'waiting' | 'history';
type Decision = '' | 'approved' | 'rejected' | 'withdrawn';
const DECISION_OPTIONS: { value: Decision; label: string }[] = [
  { value: '', label: 'All' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'withdrawn', label: 'Withdrawn' },
];
const APPROVAL_FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'booking', label: 'Bookings' },
  { value: 'collection', label: 'Collections' },
  { value: 'refund', label: 'Refunds' },
  { value: 'crew', label: 'Crew leave' },
];

const ZERO_COUNTS: ApprovalCounts = { total: 0, booking: 0, collection: 0, refund: 0, crew: 0, emergency: 0, overdue: 0, oldestAt: null, collectionAmount: 0, refundAmount: 0 };
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const manilaDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available';
const ageLabel = (value: string) => {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  return hours >= 24 ? `${Math.floor(hours / 24)}d` : `${hours}h`;
};
const subtypeLabel = (value: string | null) => ({ reschedule: 'Reschedule', cancel: 'Cancellation' }[value ?? ''] ?? '');
const shortDate = (value: string) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00+08:00`));
/** One short line per row; the full text stays in the review popup (and as a hover tooltip). */
const shortDetails = (item: ApprovalItem) => {
  if (item.type === 'crew' && item.startDate && item.endDate) {
    const days = Math.round((Date.parse(`${item.endDate}T00:00:00Z`) - Date.parse(`${item.startDate}T00:00:00Z`)) / 86400000) + 1;
    return `${item.startDate === item.endDate ? shortDate(item.startDate) : `${shortDate(item.startDate)} – ${shortDate(item.endDate)}`} · ${days === 1 ? '1 day' : `${days} days`}`;
  }
  if (item.type === 'refund') return item.summary.replace(/^Refund (requested|approved):\s*/i, '');
  if (item.type === 'booking' && item.subtype === 'cancel') return item.summary.replace(/^Cancellation (requested|approved):\s*/i, '') || 'Cancellation';
  return item.summary;
};
const typeText = (item: ApprovalItem) => item.type === 'booking' ? `Booking · ${subtypeLabel(item.subtype) || 'Request'}`
  : item.type === 'collection' ? 'Collection' : item.type === 'refund' ? 'Refund' : 'Crew leave';
const titleFor = (item?: ApprovalItem) => {
  if (!item) return 'Review approval';
  if (item.type === 'collection') return 'Verify collection';
  if (item.type === 'refund') return 'Review refund request';
  if (item.type === 'crew') return item.subtype === 'emergency' ? 'Emergency request' : 'Leave request';
  return `Review ${item.subtype === 'cancel' ? 'cancellation' : item.subtype ?? 'booking'} request`;
};

function SummaryCard({ label, value, tone, icon: Icon, onClick }: { label: string; value: string | number; tone: string; icon: typeof Clock3; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-[96px] w-full min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 lg:gap-3 lg:p-3 2xl:gap-4 2xl:p-4">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full lg:h-10 lg:w-10 2xl:h-12 2xl:w-12 ${tone}`}><Icon size={22} strokeWidth={2.25} /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium leading-5 text-slate-700">{label}</span>
      <span className="mt-1 block text-[22px] font-bold leading-tight tabular-nums text-[#0b0f4a]">{value}</span>
    </span>
  </button>;
}

function ApprovalStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = ['approved', 'verified', 'refunded'].includes(normalized)
    ? 'border-[#30c967] bg-[#dcfce7] text-[#22ad4f]'
    : ['pending', 'requested', 'verifying'].includes(normalized)
      ? 'border-[#ff7a00] bg-[#fff3e4] text-[#ff7a00]'
      : ['rejected', 'cancelled', 'withdrawn'].includes(normalized)
        ? 'border-[#ef4444] bg-[#fee2e2] text-[#ef4444]'
        : 'border-[#94a3b8] bg-[#f8fafc] text-[#475569]';
  return <span className={`inline-flex min-w-24 justify-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${tone}`}>{normalized === 'requested' ? 'Pending' : status}</span>;
}

function ApprovalReview({ item, detail, onClose, onDecide, busy }: { item: ApprovalItem; detail: Record<string, unknown> | null; onClose: () => void; onDecide: (decision: 'approve' | 'reject', reason?: string) => void; busy: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const booking = (detail?.booking && typeof detail.booking === 'object' ? detail.booking : {}) as Record<string, unknown>;
  const before = (detail?.payloadBefore && typeof detail.payloadBefore === 'object' ? detail.payloadBefore : {}) as Record<string, unknown>;
  const after = (detail?.payloadAfter && typeof detail.payloadAfter === 'object' ? detail.payloadAfter : {}) as Record<string, unknown>;
  const collection = (detail?.collection && typeof detail.collection === 'object' ? detail.collection : {}) as Record<string, unknown>;
  const fields = Object.keys(after);
  const cancelReason = String(detail?.reason ?? '');
  const emergency = item.type === 'crew' && item.subtype === 'emergency';
  const approveText = item.type === 'collection' ? 'Verify collection' : item.type === 'refund' ? 'Approve refund'
    : item.type === 'crew' ? (emergency ? 'Confirm emergency' : 'Approve leave') : 'Approve request';
  const crewRequest = item.type === 'crew' && detail ? {
    kind: String(detail.kind ?? ''), status: String(detail.status ?? item.status), crewName: String(detail.crewName ?? ''),
    crewType: String(detail.crewType ?? ''), crewEmpId: String(detail.crewEmpId ?? item.bookingNo), startDate: String(detail.startDate ?? ''),
    endDate: String(detail.endDate ?? ''), reason: String(detail.reason ?? ''), decisionReason: detail.decisionReason as string | null | undefined,
  } : null;
  const canDecide = ['pending', 'requested', 'verifying'].includes(item.status.toLowerCase());

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="approval-modal-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#f1f4fa] shadow-2xl">
      <ModalHeader plain titleId="approval-modal-title" icon={ClipboardCheck} title={titleFor(item)} subtitle={item.type === 'crew' ? undefined : item.bookingNo} onClose={onClose} closeLabel="Close review" />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {item.type === 'booking' && <>
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Booking details</SectionLabel><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <DetailField label="Client" value={String(booking.client ?? item.client)} /><DetailField label="Service" value={String(booking.service ?? 'Not available')} />
            <DetailField label="Booking Date" value={String(booking.date ?? 'Not available')} /><DetailField label="Amount" value={peso.format(Number(booking.amount ?? item.amount ?? 0))} />
            <DetailField label="Pickup Address" value={String(booking.pickupAddress ?? 'Not available')} /><DetailField label="Delivery Address" value={String(booking.deliveryAddress ?? booking.address ?? 'Not available')} />
          </div></section>
          {item.subtype === 'reschedule' ? <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Requested change</SectionLabel><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[440px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-2">Field</th><th className="py-2">Current</th><th className="py-2">Requested</th></tr></thead><tbody className="divide-y divide-slate-100">{fields.map((field) => <tr key={field}><td className="py-2 font-medium capitalize text-slate-700">{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</td><td className="py-2 text-slate-500">{String(before[field] ?? 'Not set')}</td><td className="py-2 font-medium text-emerald-700">{String(after[field] ?? '')}</td></tr>)}</tbody></table></div><p className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">{canDecide ? 'Approving this request applies the requested booking change. Rescheduling releases the current assignment and returns the booking to plotting.' : 'This requested booking change has been approved.'}</p></section> : <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Request reason</SectionLabel><p className="mt-3 text-sm leading-relaxed text-slate-700">{cancelReason || 'No reason provided.'}</p>{item.subtype === 'cancel' && canDecide && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Cancelling withdraws pending collections. Any verified payment creates a refund request for review.</p>}</section>}
        </>}
        {item.type === 'collection' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Collection details</SectionLabel><div className="mt-3 grid gap-3 sm:grid-cols-2"><DetailField label="Client" value={String(detail?.clientName ?? item.client)} /><DetailField label="Payment method" value={String(detail?.method ?? 'Not available')} /><DetailField label="Amount" value={peso.format(Number(detail?.amount ?? item.amount ?? 0))} /><DetailField label="Reference" value={String(detail?.reference ?? 'Not available')} /><DetailField label="Recorded by" value={String(detail?.recordedByName ?? item.submittedByName ?? 'Unknown user')} /><DetailField label="Submitted" value={manilaDateTime(String(detail?.submittedAt ?? item.submittedAt))} /></div><p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{canDecide ? 'Verify confirms this payment and includes it in Daily Sales.' : 'This payment has been verified and included in Daily Sales.'}</p></section>}
        {item.type === 'refund' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Refund details</SectionLabel><div className="mt-3 grid gap-3 sm:grid-cols-2"><DetailField label="Client" value={String(detail?.clientName ?? item.client)} /><DetailField label="Amount" value={peso.format(Number(detail?.amount ?? item.amount ?? 0))} /><DetailField label="Reason" value={String(detail?.reason ?? 'Not available')} /><DetailField label="Requested by" value={String(detail?.submittedByName ?? item.submittedByName ?? 'Unknown user')} /><DetailField label="Original payment" value={`${String(collection.method ?? 'Payment')} - ${String(collection.reference ?? 'Reference unavailable')}`} /></div><p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{canDecide ? 'Approval creates the linked reversal against the original payment.' : 'This refund was approved and the linked reversal was created.'}</p></section>}
        {crewRequest && <CrewLeaveDetails viewer="admin" request={crewRequest} audit={Array.isArray(detail?.audit) ? detail.audit as CrewLeaveAudit[] : []} trips={Array.isArray(detail?.affectedTrips) ? detail.affectedTrips as CrewLeaveTrip[] : []} />}
        {item.type !== 'crew' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Submission</SectionLabel><p className="mt-2 text-sm text-slate-600">Submitted by <span className="font-medium text-slate-800">{item.submittedByName || 'Unknown user'}</span> on {manilaDateTime(item.submittedAt)}</p></section>}
        {rejecting && <section className="rounded-2xl border border-red-200 bg-white p-4"><label htmlFor="reject-reason" className="text-sm font-medium text-slate-700">Reason for rejection <span className="text-red-600">*</span></label><textarea id="reject-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} maxLength={500} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20" placeholder="Enter a reason for the submitter" />{error && <p className="mt-1 text-sm text-red-700">{error}</p>}</section>}
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
        {!canDecide ? <button type="button" onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700">Close</button> : rejecting ? <><button type="button" disabled={busy} onClick={() => { setRejecting(false); setReason(''); }} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 px-4 text-sm text-slate-700">Back</button><button type="button" disabled={busy} onClick={() => { if (!reason.trim()) { setError('Enter a reason before rejecting.'); return; } onDecide('reject', reason.trim()); }} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? 'Saving...' : 'Confirm rejection'}</button></> : <><button type="button" disabled={busy} onClick={() => setRejecting(true)} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-red-300 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50">Reject</button><button type="button" disabled={busy} onClick={() => onDecide('approve')} className="inline-flex h-10 w-fit items-center gap-2 whitespace-nowrap rounded-lg bg-[#030848] px-4 text-sm font-medium text-white hover:bg-[#151b63] disabled:bg-slate-100 disabled:text-slate-400"><Check size={16} />{busy ? 'Saving...' : approveText}</button></>}
      </footer>
    </section>
  </div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) { return <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1a1f6e]"><span className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{children}</h3>; }
function DetailField({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 break-words text-sm font-medium text-slate-800">{value}</p></div>; }

export default function Approvals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('view') === 'history' ? 'history' : 'waiting';
  const filter = APPROVAL_FILTER_OPTIONS.find(option => option.value === searchParams.get('type'))?.value ?? 'all';
  const overdueOnly = view === 'waiting' && searchParams.get('overdue') === 'true';
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [counts, setCounts] = useState<ApprovalCounts>(ZERO_COUNTS);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [subtype, setSubtype] = useState('');
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<Decision>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(false);
    try {
      // Dates filter Waiting by when it was sent, and History by when it was decided.
      const params = view === 'history'
        ? { status: 'history', type: filter, subtype: subtype || undefined, decision: decision || undefined, from: dateFrom || undefined, to: dateTo || undefined, search: search || undefined, page, limit }
        : { type: filter, subtype: subtype || undefined, overdue: overdueOnly ? 'true' : undefined, from: dateFrom || undefined, to: dateTo || undefined, search: search || undefined, page, limit };
      const [listResponse, countResponse] = await Promise.all([
        api.get<PageResult>('/approvals', { params }),
        api.get<ApprovalCounts>('/approvals/counts'),
      ]);
      setItems(listResponse.data.items ?? []);
      setTotal(listResponse.data.total ?? 0);
      setCounts(countResponse.data ?? ZERO_COUNTS);
    } catch {
      setError(true);
      if (!quiet) toast.error('Unable to load approvals.');
    } finally { if (!quiet) setLoading(false); }
  }, [view, filter, subtype, overdueOnly, decision, dateFrom, dateTo, search, page, limit]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  const openReview = async (item: ApprovalItem) => {
    setSelected(item); setDetail(null); setDetailLoading(true);
    try { const response = await api.get<Record<string, unknown>>(`/approvals/${item.type}/${encodeURIComponent(item.id)}`); setDetail(response.data); }
    catch { toast.error('Unable to load approval details.'); setSelected(null); }
    finally { setDetailLoading(false); }
  };
  const decide = async (choice: 'approve' | 'reject', reason?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.post(`/approvals/${selected.type}/${encodeURIComponent(selected.id)}/${choice}`, choice === 'reject' ? { reason } : {});
      toast.success(choice === 'approve' ? 'Approved. You can find it in History.' : 'Rejected. You can find it in History.');
      setSelected(null); setDetail(null); await load(true);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof message === 'string' ? message : 'Unable to update this approval. Refresh and try again.');
    } finally { setBusy(false); }
  };

  // "Total waiting" was the sum of the other cards; Overdue says what needs attention first.
  const cards = useMemo(() => [
    { key: 'overdue', label: 'Overdue (over 24 h)', value: counts.overdue, tone: counts.overdue ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500', icon: AlarmClock },
    { key: 'booking', label: 'Reschedules & cancellations', value: counts.booking, tone: 'bg-indigo-50 text-indigo-700', icon: FileCheck2 },
    { key: 'collection', label: 'Collections to verify', value: counts.collection, tone: 'bg-blue-50 text-blue-700', icon: CheckCheck },
    { key: 'refund', label: 'Refund requests', value: counts.refund, tone: 'bg-red-50 text-red-700', icon: Coins },
    { key: 'crew', label: counts.emergency ? `Crew leave (${counts.emergency} emergency)` : 'Crew leave', value: counts.crew, tone: counts.emergency ? 'bg-red-600 text-white' : 'bg-purple-50 text-purple-700', icon: counts.emergency ? Siren : CalendarOff },
  ], [counts]);

  // The date range sits in the header, so it stays put when switching tabs or cards.
  const resetFilters = () => { setSubtype(''); setDecision(''); setPage(1); };
  /** Cards always open the Waiting tab, filtered to what they count. */
  const showWaiting = (key: string) => {
    setSearchParams(key === 'overdue' ? { overdue: 'true' } : key === 'all' ? {} : { type: key });
    resetFilters();
  };
  const chooseView = (next: View) => { setSearchParams(next === 'history' ? { view: 'history' } : {}); resetFilters(); };
  const chooseFilter = (value: FilterType) => {
    const next: Record<string, string> = {};
    if (view === 'history') next.view = 'history';
    if (overdueOnly) next.overdue = 'true';
    if (value !== 'all') next.type = value;
    setSearchParams(next);
    setSubtype('');
    setPage(1);
  };
  const totalPages = Math.max(1, Math.ceil(total / limit));
  // Same tab style as Activity Logs and Team Management.
  const tab = (value: View, label: string, Icon: typeof Clock3) => (
    <button type="button" role="tab" aria-selected={view === value} onClick={() => chooseView(value)}
      className={`flex h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 ${view === value ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-600 hover:text-[#1a1f6e]'}`}>
      <Icon size={17} aria-hidden="true" />{label}
    </button>
  );
  const headings = view === 'history'
    ? ['Booking / Client', 'Type', 'Details', 'Decision', 'Decided by', 'Decided on', 'Action']
    : ['Booking / Client', 'Type', 'Details', 'Amount', 'Status', 'Waiting', 'Action'];
  const clientCell = (item: ApprovalItem) => <td className="px-4 py-3 align-middle"><p className="font-medium text-slate-900">{item.bookingNo}</p><p className="text-sm text-slate-600">{item.client}</p></td>;
  const typeCell = (item: ApprovalItem) => <td className="whitespace-nowrap px-4 py-3 align-middle text-sm text-slate-700">{item.type === 'crew' && item.subtype === 'emergency' ? <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"><Siren size={12} aria-hidden="true" />Emergency</span> : typeText(item)}</td>;
  const detailsCell = (item: ApprovalItem) => <td className="max-w-[260px] px-4 py-3 align-middle text-sm text-slate-700"><span className="block truncate" title={item.summary}>{shortDetails(item)}</span></td>;
  const viewCell = (item: ApprovalItem) => {
    const label = view === 'waiting' ? 'Review' : 'View';
    return <td className="px-4 py-3 align-middle"><button type="button" onClick={() => void openReview(item)} aria-label={`${label} ${item.bookingNo}`} title={label} className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/20"><Eye className="h-4 w-4" aria-hidden="true" /></button></td>;
  };
  const emptyTitle = view === 'history' ? 'No decided requests found' : overdueOnly ? 'Nothing is overdue' : "You're all caught up";
  const emptyText = view === 'history' ? 'Approved, rejected and withdrawn requests appear here.' : 'No approvals are waiting.';

  return <div className="space-y-5">
    <PageHeader icon={ClipboardCheck} title="APPROVALS" subtitle={<>Review reschedules, cancellations, collection verifications, refund requests and crew leave <span className="font-medium text-[#b8860b]">that need your action.</span></>} subtitleClassName="mt-1 text-sm text-slate-500"
      action={<DateRangeFilter from={dateFrom} to={dateTo} onFromChange={value => { setDateFrom(value); setPage(1); }} onToChange={value => { setDateTo(value); setPage(1); }} onClear={() => { setDateFrom(''); setDateTo(''); setPage(1); }} />} />
    <div role="tablist" aria-label="Approvals" className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
      {tab('waiting', 'Waiting', Clock3)}
      {tab('history', 'History', History)}
    </div>
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3 2xl:gap-4">{cards.map(({ key, ...card }) => <SummaryCard key={key} {...card} onClick={() => showWaiting(key)} />)}</div>
    <div className="flex flex-col gap-4 items-start justify-between lg:flex-row lg:items-center border border-b-0 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="relative w-full lg:max-w-md">
        <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={event => { setSearch(event.target.value); setPage(1); }}
          placeholder="Search booking no., client or crew..."
          aria-label="Search booking no., client or crew..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a0f2e]/20"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {overdueOnly && <button type="button" onClick={() => showWaiting('all')} aria-label="Show all waiting requests" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700"><AlarmClock size={15} aria-hidden="true" />Overdue only<X size={14} aria-hidden="true" /></button>}
        {view === 'history' && <StatusFilter options={DECISION_OPTIONS} value={decision} onChange={value => { setDecision(value); setPage(1); }} allValue="" allLabel="All Decisions" ariaLabel="Filter by decision" />}
        <StatusFilter options={APPROVAL_FILTER_OPTIONS} value={filter} onChange={chooseFilter} allValue="all" allLabel="All Requests" ariaLabel="Filter approvals" />
        {filter === 'booking' && <StatusFilter
          options={[{ value: '', label: 'All' }, { value: 'reschedule', label: 'Reschedule' }, { value: 'cancel', label: 'Cancellation' }]}
          value={subtype}
          onChange={value => { setSubtype(value); setPage(1); }}
          allValue=""
          allLabel="All Booking Requests"
          ariaLabel="Filter booking requests"
        />}
      </div>
    </div>
    <section className="!mt-0 overflow-visible border border-slate-200 bg-white">
      {error ? <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center"><ShieldAlert className="mb-2 h-8 w-8 text-amber-600" /><p className="text-sm font-medium text-slate-800">Approvals could not be loaded.</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-[#030848] px-4 py-2 text-sm font-medium text-white">Retry</button></div> : <div className="overflow-x-auto"><table className="approval-data-table min-w-[1020px] w-full table-auto text-sm">
        <thead><tr className="bg-[#1a1f6e]">{headings.map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-slate-500">Loading approvals...</td></tr> : items.length === 0 ? <tr><td colSpan={7} className="px-4 py-16 text-center">{view === 'history' ? <History className="mx-auto mb-2 h-8 w-8 text-slate-400" /> : <CheckCheck className="mx-auto mb-2 h-8 w-8 text-emerald-600" />}<p className="text-sm font-semibold text-slate-800">{emptyTitle}</p><p className="mt-1 text-sm text-slate-500">{emptyText}</p></td></tr> : items.map((item) => {
          if (view === 'history') {
            return <tr key={`${item.type}-${item.id}`}>{clientCell(item)}{typeCell(item)}{detailsCell(item)}<td className="px-4 py-3 align-middle"><span title={item.decisionReason ?? undefined}><ApprovalStatusBadge status={item.status} /></span></td><td className="whitespace-nowrap px-4 py-3 align-middle text-slate-700">{item.decidedByName ?? 'Unknown user'}</td><td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-slate-600">{manilaDateTime(item.decidedAt)}</td>{viewCell(item)}</tr>;
          }
          const overdue = Date.now() - new Date(item.submittedAt).getTime() > 86400000;
          return <tr key={`${item.type}-${item.id}`}>{clientCell(item)}{typeCell(item)}{detailsCell(item)}<td className="whitespace-nowrap px-4 py-3 align-middle font-medium tabular-nums text-slate-900">{item.amount === null ? '-' : peso.format(item.amount)}</td><td className="px-4 py-3 align-middle"><ApprovalStatusBadge status={item.status} /></td><td className={`whitespace-nowrap px-4 py-3 align-middle tabular-nums ${overdue ? 'font-medium text-red-700' : 'text-slate-600'}`}>{ageLabel(item.submittedAt)}{overdue && <span className="ml-1">Overdue</span>}</td>{viewCell(item)}</tr>;
        })}</tbody>
      </table></div>}
      {!error && <TablePagination page={page} totalPages={totalPages} totalItems={total} pageSize={limit} onPageChange={setPage} onPageSizeChange={(size) => { setLimit(size); setPage(1); }} />}
    </section>
    {selected && (detailLoading ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"><div className="rounded-xl bg-white px-5 py-4 text-sm text-slate-600">Loading approval details...</div></div> : <ApprovalReview item={selected} detail={detail} busy={busy} onClose={() => { if (!busy) setSelected(null); }} onDecide={(choice, reason) => void decide(choice, reason)} />)}
  </div>;
}
