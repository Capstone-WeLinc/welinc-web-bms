import ModalHeader from '../../components/ui/ModalHeader';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import { StatusBadge } from '../../components/ui/StandardTable';
import KPICard from '../../components/shared/KpiCard';
import { ArrowRight, BellRing, Check, CheckCheck, CheckCircle2, ClipboardCheck, Clock3, RotateCcw, Search, Send, X, XCircle } from 'lucide-react';

type Submission = { id: string; type: 'booking' | 'collection' | 'refund'; subtype: string | null; bookingId?: string; bookingNo: string; client: string; summary: string; amount: number | null; submittedAt: string; submittedBy: string; submittedByName?: string; submittedByRole?: string; status: string; decisionReason?: string | null };
type ApprovalAudit = { actorName?: string; actorRole?: string; action: string; reason?: string | null; createdAt: string };
type Filter = 'All' | 'Pending' | 'Approved' | 'Rejected';
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const dateTime = (date?: string) => {
  if (!date) return 'Not available';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Not available';
  const datePart = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(value);
  const timePart = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(value);
  return `${datePart}, ${timePart}`;
};
const tableDateTime = (date?: string) => {
  if (!date) return 'Not available';
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? 'Not available' : new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(value);
};
const dateOnly = (date?: unknown) => {
  if (!date) return 'Not available';
  const value = String(date);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+08:00`) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};
const displayAddress = (value: unknown) => {
  const parts = String(value ?? '').split(',').map(part => part.trim()).filter(Boolean);
  return parts.filter((part, index) => parts.findIndex(other => other.toLowerCase() === part.toLowerCase()) === index).join(', ') || 'Not available';
};
const approvedStatuses = ['Approved', 'Verified', 'Refunded'];
const pendingStatuses = ['Pending', 'Requested'];
const typeLabel = (item: Submission) => item.type === 'booking' ? `Booking - ${item.subtype ?? 'request'}` : item.type === 'collection' ? 'Collection' : 'Refund';
const statusLabel = (status: string) => status === 'Requested' ? 'Pending' : status;

function StatusPill({ status }: { status: string }) {
  const normalized = statusLabel(status);
  if (approvedStatuses.includes(normalized)) {
    return <span className="inline-flex min-w-24 justify-center rounded-full border border-[#30c967] bg-[#dcfce7] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#22ad4f]">{normalized}</span>;
  }
  return <StatusBadge status={normalized} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{children}</h3>;
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className="mt-0.5 break-words text-[15px] font-medium text-slate-900">{value}</p></div>;
}

function SubmissionDialog({ item, onClose, onAction, busy }: { item: Submission; onClose: () => void; onAction: (action: 'withdraw' | 'resubmit', fields: Record<string, string>) => void; busy: boolean }) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(item.amount === null ? '' : String(item.amount));
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const booking = detail?.booking && typeof detail.booking === 'object' ? detail.booking as Record<string, unknown> : {};
  const before = detail?.payloadBefore && typeof detail.payloadBefore === 'object' ? detail.payloadBefore as Record<string, unknown> : {};
  const after = detail?.payloadAfter && typeof detail.payloadAfter === 'object' ? detail.payloadAfter as Record<string, unknown> : {};
  const collection = detail?.collection && typeof detail.collection === 'object' ? detail.collection as Record<string, unknown> : {};
  const audit = Array.isArray(detail?.audit) ? detail.audit as ApprovalAudit[] : [];
  const rejected = item.status === 'Rejected';
  const pending = pendingStatuses.includes(item.status);
  const fields = Object.keys(after).filter(field => {
    const value = after[field];
    return value !== null && value !== undefined && !(typeof value === 'string' && (!value.trim() || value.trim().toLowerCase() === 'not set'));
  });
  const changeTitle = item.subtype === 'reschedule' ? 'Reschedule request' : item.subtype === 'cancel' ? 'Cancellation request' : typeLabel(item);
  const formatChange = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return 'Not set';
    if (field.toLowerCase().includes('date')) return dateOnly(value);
    if (field.toLowerCase().includes('amount')) return currency.format(Number(value));
    return String(value);
  };
  const stepStyle = (action: string) => action === 'approved' || action === 'verified' ? 'bg-emerald-50 text-emerald-700' : action === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-[#eef0fa] text-[#1a1f6e]';
  const stepTitleStyle = (action: string) => action === 'approved' || action === 'verified' ? 'text-emerald-700' : action === 'rejected' ? 'text-red-700' : 'text-slate-900';
  const actionTitle = (action: string) => action.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  useEffect(() => {
    let mounted = true;
    api.get<Record<string, unknown>>(`/approvals/${item.type}/${encodeURIComponent(item.id)}`)
      .then(({ data }) => {
        if (!mounted) return;
        setDetail(data);
        if (typeof data.method === 'string') setMethod(data.method);
        if (typeof data.reference === 'string') setReference(data.reference);
        if (data.amount !== undefined) setAmount(String(data.amount));
        if (typeof data.reason === 'string') setReason(data.reason);
      }).catch(() => { if (mounted) toast.error('Unable to load submission details.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [item.id, item.type]);

  const submitResubmit = () => {
    setError('');
    if (item.type === 'collection' && (!amount || !method || !reference.trim())) { setError('Enter the amount, payment method, and reference.'); return; }
    if (item.type === 'refund' && (!amount || !reason.trim())) { setError('Enter the refund amount and reason.'); return; }
    onAction('resubmit', { amount, method, reference: reference.trim(), reason: reason.trim() });
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="submission-dialog-title" className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#f1f4fa] shadow-2xl`}>
      <ModalHeader plain titleId="submission-dialog-title" icon={ClipboardCheck} title={changeTitle} subtitle={item.bookingNo || undefined} onClose={onClose} closeDisabled={busy} closeLabel="Close submission details" />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading details...</div> : <>
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><SectionLabel>Request summary</SectionLabel><StatusPill status={item.status} /></div><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4"><SummaryField label="Client" value={item.client} /><SummaryField label="Booking amount" value={currency.format(item.amount ?? Number(booking.amount ?? 0))} /></div>{item.type === 'refund' && <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.summary}</p>}</section>
          {item.type === 'booking' && <>
            {fields.length > 0 && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Requested change</SectionLabel><div className="mt-3 overflow-x-auto"><table className="submission-change-table w-full min-w-[420px] text-sm"><thead className="text-left text-slate-500"><tr><th className="py-2 pr-3 font-medium">Field</th><th className="py-2 pr-3 font-medium">Current</th><th className="py-2 font-medium">Requested</th></tr></thead><tbody className="divide-y divide-slate-100">{fields.map(field => <tr key={field}><td className="py-2 pr-3 font-medium capitalize text-slate-700">{field.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`)}</td><td className="py-2 pr-3 text-slate-500 line-through">{formatChange(field, before[field])}</td><td className="py-2"><span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 font-medium text-emerald-700"><ArrowRight size={15} />{formatChange(field, after[field])}</span></td></tr>)}</tbody></table></div></section>}
            <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Booking details</SectionLabel><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4"><SummaryField label="Service" value={String(booking.service ?? 'Not available')} />{!fields.includes('date') && <SummaryField label="Booking date" value={dateOnly(booking.date)} />}</div><div className="relative mt-4 space-y-3 pl-5"><span className="absolute bottom-3 left-[5px] top-2 border-l-2 border-dashed border-slate-300" /><div className="relative"><span className="absolute -left-5 top-1 h-3 w-3 rounded-full bg-[#1a1f6e] ring-2 ring-white" /><p className="text-sm font-medium text-slate-700">Pickup address</p><p className="text-sm leading-relaxed text-slate-700">{displayAddress(booking.pickupAddress)}</p></div><div className="relative"><span className="absolute -left-5 top-1 h-3 w-3 rounded-full bg-[#e8b800] ring-2 ring-white" /><p className="text-sm font-medium text-slate-700">Delivery address</p><p className="text-sm leading-relaxed text-slate-700">{displayAddress(booking.deliveryAddress ?? booking.address)}</p></div></div></section>
          </>}
          {item.type === 'collection' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Collection details</SectionLabel><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4"><SummaryField label="Payment method" value={String(detail?.method ?? 'Not available')} /><SummaryField label="Reference" value={String(detail?.reference ?? 'Not available')} /></div></section>}
          {item.type === 'refund' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Refund details</SectionLabel><div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4"><SummaryField label="Reason" value={String(detail?.reason ?? 'Not available')} /><SummaryField label="Payment method" value={String(collection.method ?? 'Not available')} /><SummaryField label="Payment reference" value={String(collection.reference ?? 'Not available')} /></div></section>}
          {rejected && <section className="rounded-xl border border-red-200 bg-red-50 p-3.5"><p className="text-sm font-medium text-red-800">Admin decision</p><p className="mt-1 text-sm text-red-700">{item.decisionReason || 'The item was rejected. You can correct it and resubmit.'}</p></section>}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionLabel>Status timeline</SectionLabel><ol className="mt-3">{audit.length ? audit.map((event, index) => { const action = event.action.toLowerCase(); const approval = action === 'approved' || action === 'verified'; const rejection = action === 'rejected'; const submitted = ['submitted', 'resubmitted'].includes(action); const Icon = approval ? Check : rejection ? X : Send; const name = event.actorName ?? detail?.[submitted ? 'submittedByName' : 'decidedByName']; return <li key={`${event.action}-${event.createdAt}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">{index < audit.length - 1 && <span className="absolute bottom-0 left-[10px] top-6 border-l-2 border-slate-200" />}<span className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${stepStyle(action)}`}><Icon size={13} /></span><div className="min-w-0"><p className={`text-[14.5px] font-medium ${stepTitleStyle(action)}`}>{actionTitle(event.action)}</p><p className="text-sm text-slate-600">by {String(name ?? 'Unknown user')} &middot; {dateTime(event.createdAt)}</p>{event.reason && <p className={`mt-2 rounded-lg p-3 text-sm ${rejection ? 'bg-red-50 text-red-700' : 'text-slate-600'}`}>{event.reason}</p>}</div></li>; }) : <li className="flex gap-3"><span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#eef0fa] text-[#1a1f6e]"><Send size={13} /></span><div><p className="text-[14.5px] font-medium text-slate-900">Submitted</p><p className="text-sm text-slate-600">by {String(detail?.submittedByName ?? 'Unknown user')} &middot; {dateTime(item.submittedAt)}</p></div></li>}</ol></section>
          {rejected && item.type === 'collection' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4"><h3 className="text-sm font-semibold text-slate-900">Fix and resubmit collection</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm text-slate-700">Amount<input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="text-sm text-slate-700">Method<select value={method} onChange={event => setMethod(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{['Cash', 'BDO', 'GCash', 'Xendit'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm text-slate-700">Reference<input value={reference} onChange={event => setReference(event.target.value)} maxLength={100} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label></div>{error && <p className="mt-2 text-sm text-red-700">{error}</p>}<button type="button" disabled={busy} onClick={submitResubmit} className="mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-[#030848] px-3.5 text-sm font-medium text-white disabled:opacity-50"><RotateCcw size={15} />Resubmit</button></section>}
          {rejected && item.type === 'refund' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4"><h3 className="text-sm font-semibold text-slate-900">Fix and resubmit refund</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-700">Amount<input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label><label className="text-sm text-slate-700">Reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label></div>{error && <p className="mt-2 text-sm text-red-700">{error}</p>}<button type="button" disabled={busy} onClick={submitResubmit} className="mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-[#030848] px-3.5 text-sm font-medium text-white disabled:opacity-50"><RotateCcw size={15} />Resubmit</button></section>}
          {rejected && item.type === 'booking' && <section className="rounded-2xl border border-slate-200/70 bg-white p-4"><p className="text-sm text-slate-600">Review the rejection reason, then resubmit the same request details.</p><button type="button" disabled={busy} onClick={submitResubmit} className="mt-3 inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-[#030848] px-3.5 text-sm font-medium text-white disabled:opacity-50"><RotateCcw size={15} />Resubmit request</button></section>}
        </>}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button type="button" disabled={busy} onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700">Close</button>{pending && <button type="button" disabled={busy} onClick={() => onAction('withdraw', {})} className="inline-flex h-10 w-fit items-center gap-2 whitespace-nowrap rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><X size={16} />Withdraw request</button>}</footer>
    </section>
  </div>;
}

export default function MySubmissions() {
  const [items, setItems] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const previousStatuses = useRef<Map<string, string> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(false);
    try {
      const { data } = await api.get<Submission[]>('/approvals/mine');
      const next = data ?? [];
      const previous = previousStatuses.current;
      if (previous) next.forEach(item => {
        const old = previous.get(`${item.type}:${item.id}`);
        if (old && old !== item.status && !pendingStatuses.includes(item.status)) {
          const verb = item.status === 'Verified' ? 'was verified' : item.status === 'Approved' || item.status === 'Refunded' ? 'was approved' : item.status === 'Rejected' ? 'was rejected' : `was updated to ${item.status}`;
          toast(item.type === 'collection' && item.status === 'Verified' ? 'Collection verified' : 'Submission updated', { description: `${item.bookingNo} ${verb}${item.decisionReason ? `: ${item.decisionReason}` : ''}` });
        }
      });
      previousStatuses.current = new Map(next.map(item => [`${item.type}:${item.id}`, item.status]));
      setItems(next);
    } catch {
      setError(true);
      if (!quiet) toast.error('Unable to load your submissions.');
    } finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  const action = async (kind: 'withdraw' | 'resubmit', fields: Record<string, string>) => {
    if (!selected) return;
    if (kind === 'withdraw' && !window.confirm(`Withdraw the pending ${selected.type} request for ${selected.bookingNo}?`)) return;
    setBusy(true);
    try {
      await api.post(`/approvals/${selected.type}/${encodeURIComponent(selected.id)}/${kind}`, fields);
      toast.success(kind === 'withdraw' ? 'Request withdrawn.' : 'Submission resubmitted.');
      setSelected(null); await load(true);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(typeof message === 'string' ? message : 'Unable to update this submission.');
    } finally { setBusy(false); }
  };

  const shown = items.filter(item => {
    const matchStatus = filter === 'All' || (filter === 'Pending' ? pendingStatuses.includes(item.status) : filter === 'Approved' ? approvedStatuses.includes(item.status) : item.status === filter);
    const matchSearch = !search || `${item.bookingNo} ${item.client} ${item.summary}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });
  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const visible = shown.slice((page - 1) * pageSize, page * pageSize);
  const counts: Record<Filter, number> = { All: items.length, Pending: items.filter(item => pendingStatuses.includes(item.status)).length, Approved: items.filter(item => approvedStatuses.includes(item.status)).length, Rejected: items.filter(item => item.status === 'Rejected').length };

  return <div className="space-y-5">
    <PageHeader icon={ClipboardCheck} title="FOR APPROVALS" subtitle={<>Track reschedule and cancellation requests, collections, and <span className="font-medium text-[#d4a72c]">refund decisions.</span></>} subtitleClassName="mt-1 text-sm text-slate-500" />
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">{([
      { status: 'Pending', value: counts.Pending, icon: Clock3, color: '#f59e0b' },
      { status: 'Approved', value: counts.Approved, icon: CheckCircle2, color: '#10b981' },
      { status: 'Rejected', value: counts.Rejected, icon: XCircle, color: '#ef4444' },
    ] as const).map(({ status, value, icon, color }) => <button key={status} type="button" onClick={() => { setFilter(status); setPage(1); }} className="w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
      <KPICard label={`${status} submissions`} value={value} icon={icon} iconColor={color} variant="dashboard-compact" />
    </button>)}</div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="relative block w-full sm:w-[536px] sm:shrink-0"><Search size={20} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search booking no. or client..." className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20" /></label><div className="flex flex-wrap gap-2">{(['All', 'Pending', 'Approved', 'Rejected'] as Filter[]).map(value => <button key={value} type="button" onClick={() => { setFilter(value); setPage(1); }} className={`cursor-pointer whitespace-nowrap rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${filter === value ? 'border-[#1a1f6e] bg-[#1a1f6e] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{value.toUpperCase()}</button>)}</div></div>
    <section className="overflow-visible bg-white">{error ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><BellRing className="mb-2 h-7 w-7 text-amber-600" /><p className="text-sm text-slate-700">Unable to load submissions.</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-[#030848] px-4 py-2 text-sm text-white">Retry</button></div> : <div className="overflow-x-auto"><table className="approval-data-table min-w-[1020px] w-full table-auto text-sm"><thead><tr className="bg-[#1a1f6e]">{['Type', 'Booking / Client', 'Details', 'Amount', 'Status', 'Updated', 'Decision', 'Action'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-slate-500">Loading submissions...</td></tr> : visible.length === 0 ? <tr><td colSpan={8} className="px-4 py-14 text-center"><CheckCheck className="mx-auto mb-2 h-7 w-7 text-emerald-600" /><p className="text-sm font-medium text-slate-800">No submissions in this view.</p></td></tr> : visible.map(item => {
      return <tr key={`${item.type}-${item.id}`}><td className="px-4 py-3 align-middle text-sm text-slate-700">{typeLabel(item)}</td><td className="px-4 py-3 align-middle"><p className="font-medium text-slate-900">{item.bookingNo}</p><p className="text-sm text-slate-600">{item.client}</p></td><td className="break-words px-4 py-3 align-middle text-sm text-slate-700">{item.summary}{item.status === 'Rejected' && item.decisionReason && <p className="mt-1 line-clamp-1 text-sm text-red-700">Reason: {item.decisionReason}</p>}</td><td className="whitespace-nowrap px-4 py-3 align-middle font-medium tabular-nums text-slate-900">{item.amount === null ? '-' : currency.format(item.amount)}</td><td className="px-4 py-3 align-middle"><StatusPill status={item.status} /></td><td className="whitespace-nowrap px-4 py-3 align-middle text-slate-600">{tableDateTime(item.submittedAt)}</td><td className="max-w-48 px-4 py-3 align-middle text-slate-600">{item.decisionReason || (pendingStatuses.includes(item.status) ? 'Waiting for Admin' : approvedStatuses.includes(item.status) ? 'Submission approved' : item.status === 'Rejected' ? 'Changes requested' : '—')}</td><td className="px-4 py-3 align-middle"><button type="button" onClick={() => setSelected(item)} className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View</button></td></tr>;
    })}</tbody></table></div>}{!error && <TablePagination page={page} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={value => { setPageSize(value); setPage(1); }} />}</section>
    {selected && <SubmissionDialog item={selected} busy={busy} onClose={() => { if (!busy) setSelected(null); }} onAction={(kind, fields) => void action(kind, fields)} />}
  </div>;
}
