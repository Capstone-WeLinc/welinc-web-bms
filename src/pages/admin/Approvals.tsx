import { StatusFilter } from '../../components/ui/ListSearchFilters';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import { AlarmClock, CheckCheck, ClipboardCheck, Clock3, Coins, FileCheck2, History, Search, ShieldAlert, UserRoundMinus, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import ApprovalPanel from '../../components/approvals/ApprovalPanel';
import ApprovalStatusBadge from '../../components/approvals/ApprovalStatusBadge';
import {
  avatarTone, dueInfo, initials, manilaDate, peso, requestStyle, shortDetails, typeText,
  type ApprovalItem, type ItemType,
} from '../../components/approvals/approvalUtils';

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
const itemKey = (item: ApprovalItem) => `${item.type}-${item.id}`;

function SummaryCard({ label, value, tone, icon: Icon, onClick }: { label: string; value: string | number; tone: string; icon: typeof Clock3; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-[96px] w-full min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 lg:gap-3 lg:p-3 2xl:gap-4 2xl:p-4">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full lg:h-10 lg:w-10 2xl:h-12 2xl:w-12 ${tone}`}><Icon size={22} strokeWidth={2.25} /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium leading-5 text-slate-700">{label}</span>
      <span className="mt-1 block text-[22px] font-bold leading-tight tabular-nums text-[#0b0f4a]">{value}</span>
    </span>
  </button>;
}


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

  const closePanel = () => { if (!busy) { setSelected(null); setDetail(null); } };
  /** Clicking a row (or its checkbox) opens it in the side panel; clicking the open row again closes it. */
  const toggleRow = async (item: ApprovalItem) => {
    if (selected && itemKey(selected) === itemKey(item)) { closePanel(); return; }
    if (busy) return;
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

  // Pending: everything still waiting for Admin. Its click shows the whole Needs action list.
  const cards = useMemo(() => [
    { key: 'all', label: 'Pending', value: counts.total, tone: 'bg-orange-50 text-orange-600', icon: Clock3 },
    { key: 'booking', label: 'Reschedules & cancellations', value: counts.booking, tone: 'bg-indigo-50 text-indigo-700', icon: FileCheck2 },
    { key: 'collection', label: 'Collections to verify', value: counts.collection, tone: 'bg-blue-50 text-blue-700', icon: CheckCheck },
    { key: 'refund', label: 'Refund requests', value: counts.refund, tone: 'bg-red-50 text-red-700', icon: Coins },
    { key: 'crew', label: 'Leave Request', value: counts.crew, tone: 'bg-purple-50 text-purple-700', icon: UserRoundMinus },
  ], [counts]);

  // The date range sits in the header, so it stays put when switching tabs or cards.
  const resetFilters = () => { setSubtype(''); setDecision(''); setPage(1); };
  /** Cards always open the Needs action tab, filtered to what they count. */
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
    ? ['Request', 'Type', 'Requester', 'Amount', 'Decided', 'Status']
    : ['Request', 'Type', 'Requester', 'Amount', 'Due Date', 'Status'];
  const emptyTitle = view === 'history' ? 'No decided requests found' : overdueOnly ? 'Nothing is overdue' : "You're all caught up";
  const emptyText = view === 'history' ? 'Approved, rejected and withdrawn requests appear here.' : 'Nothing needs your action right now.';
  const columnCount = headings.length + 1;

  const row = (item: ApprovalItem) => {
    const open = selected !== null && itemKey(selected) === itemKey(item);
    const style = requestStyle(item);
    const Icon = style.icon;
    const due = dueInfo(item.submittedAt);
    return <tr key={itemKey(item)} onClick={() => void toggleRow(item)} aria-selected={open}
      className={`cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 ${open ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}>
      <td className="w-12 px-4 py-3.5 align-middle" onClick={(event) => event.stopPropagation()}>
        <input type="checkbox" checked={open} onChange={() => void toggleRow(item)} aria-label={`${open ? 'Close' : 'Open'} ${item.bookingNo}`}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600" />
      </td>
      <td className="px-4 py-3.5 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.tile}`}><Icon size={16} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{item.bookingNo}</p>
            <p className="max-w-[220px] truncate text-xs text-slate-500" title={item.summary}>{item.type === 'crew' ? shortDetails(item) : item.client}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 align-middle"><span className={`rounded-md px-2 py-1 text-xs font-medium ${style.pill}`}>{typeText(item)}</span></td>
      <td className="px-4 py-3.5 align-middle">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(item.submittedByName)}`}>{initials(item.submittedByName)}</span>
          <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{item.submittedByName ?? 'Unknown user'}</p><p className="truncate text-xs text-slate-500">{item.submittedByRole ?? ''}</p></div>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 align-middle tabular-nums text-slate-800">{item.amount === null ? '-' : peso.format(item.amount)}</td>
      {view === 'history'
        ? <td className="whitespace-nowrap px-4 py-3.5 align-middle"><p className="text-slate-800">{manilaDate(item.decidedAt)}</p><p className="text-xs text-slate-500">{item.decidedByName ? `by ${item.decidedByName}` : ''}</p></td>
        : <td className="whitespace-nowrap px-4 py-3.5 align-middle"><p className="text-slate-800">{manilaDate(due.dueAt.toISOString())}</p><p className={`text-xs font-medium ${due.tone}`}>{due.label}</p></td>}
      <td className="px-4 py-3.5 align-middle"><span title={view === 'history' ? item.decisionReason ?? undefined : undefined}><ApprovalStatusBadge status={item.status} /></span></td>
    </tr>;
  };

  return <div className="space-y-5">
    <PageHeader icon={ClipboardCheck} title="APPROVALS" subtitle="Review and take action on pending requests" subtitleClassName="mt-1 text-sm text-slate-500"
      action={<DateRangeFilter from={dateFrom} to={dateTo} onFromChange={value => { setDateFrom(value); setPage(1); }} onToChange={value => { setDateTo(value); setPage(1); }} onClear={() => { setDateFrom(''); setDateTo(''); setPage(1); }} />} />
    {/* PageHeader leaves 32px under its line; pull the tabs up so every gap on the page is 20px. */}
    <div role="tablist" aria-label="Approvals" className="!-mt-3 inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
      {tab('waiting', 'Needs action', Clock3)}
      {tab('history', 'History', History)}
    </div>
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3 2xl:gap-4">{cards.map(({ key, ...card }) => <SummaryCard key={key} {...card} onClick={() => showWaiting(key)} />)}</div>

    {/* The table and, when a request is open, its side panel (as in the design). */}
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 items-start justify-between lg:flex-row lg:items-center border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
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
            {overdueOnly && <button type="button" onClick={() => showWaiting('all')} aria-label="Show all requests that need action" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700"><AlarmClock size={15} aria-hidden="true" />Overdue only<X size={14} aria-hidden="true" /></button>}
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
        {error ? <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center"><ShieldAlert className="mb-2 h-8 w-8 text-amber-600" /><p className="text-sm font-medium text-slate-800">Approvals could not be loaded.</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-[#030848] px-4 py-2 text-sm font-medium text-white">Retry</button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] table-auto text-sm">
          <thead><tr className="border-b border-slate-200 bg-white">
            <th className="w-12 px-4 py-3"><span className="sr-only">Open</span></th>
            {headings.map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600">{heading}</th>)}
          </tr></thead>
          <tbody>{loading ? <tr><td colSpan={columnCount} className="px-4 py-14 text-center text-sm text-slate-500">Loading approvals...</td></tr> : items.length === 0 ? <tr><td colSpan={columnCount} className="px-4 py-16 text-center">{view === 'history' ? <History className="mx-auto mb-2 h-8 w-8 text-slate-400" /> : <CheckCheck className="mx-auto mb-2 h-8 w-8 text-emerald-600" />}<p className="text-sm font-semibold text-slate-800">{emptyTitle}</p><p className="mt-1 text-sm text-slate-500">{emptyText}</p></td></tr> : items.map(row)}</tbody>
        </table></div>}
        {!error && <TablePagination page={page} totalPages={totalPages} totalItems={total} pageSize={limit} onPageChange={setPage} onPageSizeChange={(size) => { setLimit(size); setPage(1); }} />}
      </div>
      {selected && <>
        {/* Below xl the panel slides over the page; tapping outside closes it. */}
        <div aria-hidden="true" className="fixed inset-0 z-[89] bg-slate-950/30 xl:hidden" onClick={closePanel} />
        {/* On xl the panel stays beside the table (it does not follow the page as it scrolls): this slot is as tall as
            the table, at least 560px, and the panel scrolls inside it. Below xl the slot adds no space and the panel is fixed. */}
        <div className="contents xl:relative xl:block xl:min-h-[560px] xl:w-[380px] xl:shrink-0 xl:self-stretch">
          <ApprovalPanel key={itemKey(selected)} item={selected} detail={detail} loading={detailLoading} busy={busy} onClose={closePanel} onDecide={(choice, reason) => void decide(choice, reason)} />
        </div>
      </>}
    </div>
  </div>;
}
