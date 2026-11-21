import { StatusFilter } from '../../components/ui/ListSearchFilters';
import ModalHeader from '../../components/ui/ModalHeader';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { apiProblem } from '../../lib/api-shapes';
import type { Driver, Helper } from '../../lib/types';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import KPICard from '../../components/shared/KpiCard';
import CrewLeaveDetails, { CrewLeaveStatusPill, type CrewLeaveAudit } from '../../components/crewleave/CrewLeaveDetails';
import { AlertTriangle, BellRing, CalendarOff, CheckCheck, CheckCircle2, ClipboardCheck, Clock3, Eye, Plus, Search, Send, Siren, Undo2, XCircle } from 'lucide-react';

/**
 * Operations "For Approvals" (spec bms/0003): leave and emergency requests for drivers and
 * helpers, filed here by Operations and decided by Admin. Layout follows the CS For Approvals page.
 */

type LeaveRequest = {
  id: string; crewType: 'DRIVER' | 'HELPER'; crewId: string; crewEmpId: string; crewName: string;
  kind: 'LEAVE' | 'EMERGENCY'; startDate: string; endDate: string; reason: string;
  status: 'Requested' | 'Approved' | 'Rejected' | 'Withdrawn'; requestedAt: string;
  decidedAt?: string | null; decisionReason?: string | null;
};
type Conflict = {
  bookingUuid: string; bookingNo?: string; client?: string; serviceDate: string; dispatchTime?: string | null;
  crewType: 'DRIVER' | 'HELPER'; crewId?: string; crewName: string; kind: 'LEAVE' | 'EMERGENCY';
};
type Filter = 'All' | 'Pending' | 'Approved' | 'Rejected';
type CrewOption = { value: string; type: 'DRIVER' | 'HELPER'; id: string; label: string };

const MAX_DAYS = 30;
const manilaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const tableDateTime = (date?: string | null) => {
  if (!date) return 'Not available';
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? 'Not available' : new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(value);
};
const dateOnly = (date: string) => {
  const parsed = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};
const leaveDates = (item: { startDate: string; endDate: string }) => item.startDate === item.endDate ? dateOnly(item.startDate) : `${dateOnly(item.startDate)} – ${dateOnly(item.endDate)}`;
const crewRole = (type: string) => type === 'HELPER' ? 'Helper' : 'Driver';
const kindLabel = (kind: string) => kind === 'EMERGENCY' ? 'Emergency' : 'Leave';
const decisionText = (item: LeaveRequest) => item.decisionReason || (item.status === 'Requested'
  ? (item.kind === 'EMERGENCY' ? 'In effect · waiting for Admin' : 'Waiting for Admin')
  : item.status === 'Approved' ? (item.kind === 'EMERGENCY' ? 'Emergency confirmed' : 'Leave approved')
    : item.status === 'Rejected' ? 'Rejected' : item.status === 'Withdrawn' ? 'Withdrawn' : '—');

function TypeLabel({ kind }: { kind: string }) {
  return kind === 'EMERGENCY'
    ? <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"><Siren size={12} aria-hidden="true" />Emergency</span>
    : <span>Leave</span>;
}

const fieldClass = 'mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 disabled:bg-slate-50 disabled:text-slate-500';

/** Same shell as the CS submission dialog: grey body, white section cards, footer actions. */
function FileRequestDialog({ crew, onClose, onFiled }: { crew: CrewOption[]; onClose: () => void; onFiled: () => void }) {
  const today = manilaToday();
  const [person, setPerson] = useState('');
  const [kind, setKind] = useState<'LEAVE' | 'EMERGENCY'>('LEAVE');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const start = kind === 'EMERGENCY' ? today : startDate;
  const days = start && endDate && endDate >= start ? Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1 : 0;

  const submit = async () => {
    const problem = !person ? 'Choose a driver or helper.'
      : !start || !endDate ? 'Choose the dates.'
        : start < today ? 'Leave cannot start in the past.'
          : endDate < start ? 'The end date must be on or after the start date.'
            : endDate > addDays(start, MAX_DAYS - 1) ? `A request can cover at most ${MAX_DAYS} days. File another request for the rest.`
              : !reason.trim() ? 'Enter a reason.' : '';
    if (problem) { setError(problem); return; }
    const chosen = crew.find((item) => item.value === person);
    if (!chosen) return;
    setSaving(true);
    try {
      await api.post('/crew-leave', { crewType: chosen.type, crewId: chosen.id, kind, startDate: start, endDate, reason: reason.trim() });
      toast.success(kind === 'EMERGENCY' ? `${chosen.label} is now on emergency leave. Admin will confirm it.` : `Leave for ${chosen.label} sent to Admin for approval.`);
      onFiled();
    } catch (requestError) {
      setError(apiProblem(requestError).message ?? 'Unable to file this request. Try again.');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="file-leave-title" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <ModalHeader plain titleId="file-leave-title" icon={CalendarOff} title="New Request" onClose={onClose} closeDisabled={saving} closeLabel="Close" />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 p-5">
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <div className="text-sm text-slate-700">
            <span id="file-leave-person">Crew member <span className="text-red-500">*</span></span>
            <Select value={person} onValueChange={(value) => { setPerson(value); setError(''); }}>
              <SelectTrigger aria-labelledby="file-leave-person" className="mt-1 h-10 rounded-lg border-slate-300 px-3 text-sm shadow-none"><SelectValue placeholder="Choose a driver or helper" /></SelectTrigger>
              <SelectContent>{crew.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} · {crewRole(item.type)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="text-sm text-slate-700">
            <span id="file-leave-type">Type <span className="text-red-500">*</span></span>
            <Select value={kind} onValueChange={(value) => { setKind(value as 'LEAVE' | 'EMERGENCY'); setError(''); }}>
              <SelectTrigger aria-labelledby="file-leave-type" className="mt-1 h-10 rounded-lg border-slate-300 px-3 text-sm shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LEAVE">Leave</SelectItem>
                <SelectItem value="EMERGENCY">Emergency</SelectItem>
              </SelectContent>
            </Select>
            {kind === 'EMERGENCY' && <span className="mt-1 flex items-center gap-1 text-xs font-medium text-red-700"><Siren size={12} aria-hidden="true" />Takes effect right away. Admin confirms it later.</span>}
          </div>
          <label className="text-sm text-slate-700">Start date <span className="text-red-500">*</span>
            <input type="date" min={today} value={start} disabled={kind === 'EMERGENCY'} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); setError(''); }} className={fieldClass} />
          </label>
          <label className="text-sm text-slate-700">
            <span className="flex items-baseline justify-between gap-2"><span>End date <span className="text-red-500">*</span></span>{days > 0 && <span className="text-xs text-slate-500">{days === 1 ? '1 day' : `${days} days`}</span>}</span>
            <input type="date" min={start} max={addDays(start, MAX_DAYS - 1)} value={endDate} onChange={(event) => { setEndDate(event.target.value); setError(''); }} className={fieldClass} />
          </label>
          <label className="text-sm text-slate-700 sm:col-span-2">Reason <span className="text-red-500">*</span>
            <textarea rows={3} maxLength={500} value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} placeholder={kind === 'EMERGENCY' ? 'What happened (e.g. taken to hospital)' : 'Why they need leave'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20" />
          </label>
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
        {error && <p role="alert" className="mr-auto text-sm font-medium text-red-700">{error}</p>}
        <button type="button" disabled={saving} onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700">Cancel</button>
        <button type="button" disabled={saving} onClick={() => void submit()} className={`inline-flex h-10 w-fit items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50 ${kind === 'EMERGENCY' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#030848] hover:bg-[#151b63]'}`}><Send size={15} />{saving ? 'Saving...' : kind === 'EMERGENCY' ? 'File emergency' : 'Send for approval'}</button>
      </footer>
    </section>
  </div>;
}

function RequestDialog({ item, onClose, onWithdraw, busy }: { item: LeaveRequest; onClose: () => void; onWithdraw: () => void; busy: boolean }) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const audit = Array.isArray(detail?.audit) ? detail.audit as CrewLeaveAudit[] : [];
  const trips = Array.isArray(detail?.affectedTrips) ? detail.affectedTrips as Conflict[] : [];
  const pending = item.status === 'Requested';
  useEffect(() => {
    let mounted = true;
    api.get<Record<string, unknown>>(`/crew-leave/${encodeURIComponent(item.id)}`)
      .then(({ data }) => { if (mounted) setDetail(data); })
      .catch(() => { if (mounted) toast.error('Unable to load request details.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [item.id]);

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="leave-dialog-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#f1f4fa] shadow-2xl">
      <ModalHeader plain titleId="leave-dialog-title" icon={ClipboardCheck} title={`${kindLabel(item.kind)} request`} onClose={onClose} closeDisabled={busy} closeLabel="Close request details" />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading details...</div> : <>
          <CrewLeaveDetails viewer="operations" request={item} audit={audit} trips={trips} />
        </>}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button type="button" disabled={busy} onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700">Close</button>{pending && <button type="button" disabled={busy} onClick={onWithdraw} className="inline-flex h-10 w-fit items-center gap-2 whitespace-nowrap rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><Undo2 size={16} />Withdraw request</button>}</footer>
    </section>
  </div>;
}

export default function OperationsForApprovals() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [crew, setCrew] = useState<CrewOption[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [filing, setFiling] = useState(false);
  const [busy, setBusy] = useState(false);
  const previousStatuses = useRef<Map<string, string> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(false);
    try {
      const [mine, flagged] = await Promise.all([
        api.get<LeaveRequest[]>('/crew-leave/mine'),
        api.get<Conflict[]>('/crew-leave/conflicts').catch(() => ({ data: [] as Conflict[] })),
      ]);
      const next = mine.data ?? [];
      const previous = previousStatuses.current;
      if (previous) next.forEach(item => {
        const old = previous.get(item.id);
        if (old && old !== item.status && (item.status === 'Approved' || item.status === 'Rejected')) {
          const verb = item.status === 'Approved' ? (item.kind === 'EMERGENCY' ? 'was confirmed' : 'was approved') : 'was rejected';
          toast('Request updated', { description: `${kindLabel(item.kind)} for ${item.crewName} ${verb}${item.decisionReason ? `: ${item.decisionReason}` : ''}` });
        }
      });
      previousStatuses.current = new Map(next.map(item => [item.id, item.status]));
      setItems(next);
      setConflicts(flagged.data ?? []);
    } catch {
      setError(true);
      if (!quiet) toast.error('Unable to load your requests.');
    } finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  const openFiling = async () => {
    setFiling(true);
    if (crew.length) return;
    try {
      const [drivers, helpers] = await Promise.all([api.get<Driver[]>('/bms/config/drivers'), api.get<Helper[]>('/bms/config/helpers')]);
      setCrew([
        ...(drivers.data ?? []).map((item) => ({ value: `DRIVER:${item.id}`, type: 'DRIVER' as const, id: item.id, label: item.fullName })),
        ...(helpers.data ?? []).map((item) => ({ value: `HELPER:${item.id}`, type: 'HELPER' as const, id: item.id, label: item.fullName })),
      ].sort((a, b) => a.label.localeCompare(b.label)));
    } catch { toast.error('Unable to load drivers and helpers.'); }
  };

  const withdraw = async () => {
    if (!selected) return;
    const message = selected.kind === 'EMERGENCY'
      ? `Withdraw the emergency for ${selected.crewName}? They become available again right away.`
      : `Withdraw the pending leave request for ${selected.crewName}?`;
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      await api.post(`/crew-leave/${encodeURIComponent(selected.id)}/withdraw`, {});
      toast.success('Request withdrawn.');
      setSelected(null); await load(true);
    } catch (requestError) {
      toast.error(apiProblem(requestError).message ?? 'Unable to withdraw this request.');
    } finally { setBusy(false); }
  };

  const shown = items.filter(item => {
    const matchStatus = filter === 'All' || (filter === 'Pending' ? item.status === 'Requested' : item.status === filter);
    const matchSearch = !search || `${item.crewName} ${item.crewEmpId} ${item.reason} ${kindLabel(item.kind)}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const visible = shown.slice((page - 1) * pageSize, page * pageSize);
  const counts: Record<Filter, number> = { All: items.length, Pending: items.filter(item => item.status === 'Requested').length, Approved: items.filter(item => item.status === 'Approved').length, Rejected: items.filter(item => item.status === 'Rejected').length };

  return <div className="space-y-5">
    <PageHeader icon={ClipboardCheck} title="FOR APPROVALS" subtitle={<>Track leave and emergency requests for drivers and helpers, and <span className="font-medium text-[#d4a72c]">Admin decisions.</span></>} subtitleClassName="mt-1 text-sm text-slate-500"
      action={<button type="button" onClick={() => void openFiling()} className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1f6e] text-white rounded-lg font-semibold text-sm"><Plus size={16} /> NEW REQUEST</button>} />
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">{([
      { status: 'Pending', value: counts.Pending, icon: Clock3, color: '#f59e0b' },
      { status: 'Approved', value: counts.Approved, icon: CheckCircle2, color: '#10b981' },
      { status: 'Rejected', value: counts.Rejected, icon: XCircle, color: '#ef4444' },
    ] as const).map(({ status, value, icon, color }) => <button key={status} type="button" onClick={() => { setFilter(status); setPage(1); }} className="w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
      <KPICard label={`${status} requests`} value={value} icon={icon} iconColor={color} variant="dashboard-compact" />
    </button>)}</div>
    {conflicts.length > 0 && <section aria-labelledby="crew-conflicts-title" className="rounded-xl border border-red-200 bg-red-50 p-3.5">
      <h2 id="crew-conflicts-title" className="flex items-center gap-2 text-sm font-medium text-red-800"><AlertTriangle size={17} aria-hidden="true" />Crew unavailable – reassign {conflicts.length === 1 ? 'this trip' : `these ${conflicts.length} trips`}</h2>
      <ul className="mt-2 space-y-1 text-sm text-red-700">{conflicts.map((item) => <li key={`${item.bookingUuid}-${item.crewId ?? item.crewName}`}><span className="font-medium">{item.bookingNo ?? 'Booking'}</span> on {dateOnly(item.serviceDate)} — {item.crewName} ({crewRole(item.crewType).toLowerCase()}) is on {item.kind === 'EMERGENCY' ? 'emergency leave' : 'leave'}</li>)}</ul>
      <Link to="/operations/scheduling" className="mt-2 inline-flex text-sm font-medium text-red-800 underline underline-offset-2">Open Scheduling to reassign</Link>
    </section>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-b-0 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><label className="relative block w-full sm:w-[536px] sm:shrink-0"><Search size={20} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search crew name, employee ID or reason..." className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20" /></label><StatusFilter options={['All', 'Pending', 'Approved', 'Rejected'] as Filter[]} value={filter} onChange={value => { setFilter(value); setPage(1); }} /></div>
    <section className="!mt-0 overflow-visible border border-slate-200 bg-white">{error ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><BellRing className="mb-2 h-7 w-7 text-amber-600" /><p className="text-sm text-slate-700">Unable to load requests.</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-[#030848] px-4 py-2 text-sm text-white">Retry</button></div> : <div className="overflow-x-auto"><table className="approval-data-table min-w-[880px] w-full table-auto text-sm"><thead><tr className="bg-[#1a1f6e]">{['Crew Member', 'Type', 'Dates', 'Status', 'Updated', 'Decision', 'Action'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-slate-500">Loading requests...</td></tr> : visible.length === 0 ? <tr><td colSpan={7} className="px-4 py-14 text-center"><CheckCheck className="mx-auto mb-2 h-7 w-7 text-emerald-600" /><p className="text-sm font-medium text-slate-800">{items.length === 0 ? 'No requests yet.' : 'No requests in this view.'}</p>{items.length === 0 && <p className="mt-1 text-sm text-slate-500">When a driver or helper calls in for leave or an emergency, file it here.</p>}</td></tr> : visible.map(item => {
      return <tr key={item.id}><td className="px-4 py-3 align-middle"><p className="font-medium text-slate-900">{item.crewName}</p><p className="text-sm text-slate-600">{item.crewEmpId} · {crewRole(item.crewType)}</p></td><td className="px-4 py-3 align-middle text-sm text-slate-700"><TypeLabel kind={item.kind} /></td><td className="whitespace-nowrap px-4 py-3 align-middle font-medium tabular-nums text-slate-900">{leaveDates(item)}</td><td className="px-4 py-3 align-middle"><CrewLeaveStatusPill status={item.status} /></td><td className="whitespace-nowrap px-4 py-3 align-middle text-slate-600">{tableDateTime(item.decidedAt ?? item.requestedAt)}</td><td className="max-w-48 px-4 py-3 align-middle text-slate-600">{decisionText(item)}</td><td className="px-4 py-3 align-middle"><button type="button" onClick={() => setSelected(item)} aria-label={`View ${item.crewName}`} title="View" className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/20"><Eye className="h-4 w-4" aria-hidden="true" /></button></td></tr>;
    })}</tbody></table></div>}{!error && <TablePagination page={page} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />}</section>
    {selected && <RequestDialog item={selected} busy={busy} onClose={() => { if (!busy) setSelected(null); }} onWithdraw={() => void withdraw()} />}
    {filing && <FileRequestDialog crew={crew} onClose={() => setFiling(false)} onFiled={() => { setFiling(false); void load(true); }} />}
  </div>;
}
