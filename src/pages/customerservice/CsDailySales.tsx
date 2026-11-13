import ModalHeader from '../../components/ui/ModalHeader';
import SalesReportDetailsDialog from '../../components/shared/SalesReportDetailsDialog';
import TablePagination from '../../components/ui/TablePagination';
import { useEffect, useMemo, useState } from 'react';
import {
  Truck,
  Banknote,
  Landmark,
  Wallet,
  Diamond,
  Calculator,
  MoreVertical,
  Eye,
  FileText,
  Download,
  RotateCcw,
  Send,
  CreditCard,
} from 'lucide-react';
import { exportReportPdf } from '../../lib/documents/reportExport';
import { useApp } from '../../contexts/AppContext';
import { toast } from 'sonner';
import PageHeader from '../../components/pageheader/Pageheader';
import type { DailySalesEntry } from '../../lib/types';
import { api } from '../../lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/Dropdown';

interface DailySalesSummary {
  date: string;
  totalInHouse: number;
  totalSubcontracted: number;
  totalCash: string;
  totalBdo: string;
  totalGcash: string;
  totalXendit: string;
  totalSales: string;
}

type DraftRow = {
  bookingUuid: string; bookingId: string; bookingNo: string; clientName: string; service: string;
  completedOn: string; amount: number; method: string | null; reference: string;
};
type AwaitingRow = {
  id: string; bookingId: string; bookingNo: string; clientName: string;
  amount: number; method: string; reference: string; submittedOn: string;
};
type Worklist = { ready: DraftRow[]; awaiting: AwaitingRow[] };

const METHODS = ['Cash', 'BDO', 'GCash', 'Xendit'] as const;

/** One table row: a draft to submit, a collection awaiting Admin approval, or a verified sale. */
type TableRow =
  | { kind: 'ready'; key: string; date: string; clientName: string; bookingNo: string; amount: number; method: string | null; reference: string; draft: DraftRow }
  | { kind: 'awaiting'; key: string; date: string; clientName: string; bookingNo: string; amount: number; method: string; reference: string }
  | { kind: 'verified'; key: string; entry: DailySalesEntry };

const peso = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}


function todayInManila(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

const SUMMARY_ITEMS = [
  { label: 'TOTAL IN-HOUSE', key: 'totalInHouse', icon: Truck, color: '#1a1f6e' },
  { label: 'TOTAL SUBCONTRACTED', key: 'totalSubcontracted', icon: Truck, color: '#6366f1' },
  { label: 'TOTAL CASH', key: 'totalCash', icon: Banknote, color: '#10b981' },
  { label: 'TOTAL BDO', key: 'totalBdo', icon: Landmark, color: '#0ea5e9' },
  { label: 'TOTAL GCASH', key: 'totalGcash', icon: Wallet, color: '#3b82f6' },
  { label: 'TOTAL XENDIT', key: 'totalXendit', icon: Diamond, color: '#8b5cf6' },
  { label: 'TOTAL SALES', key: 'totalSales', icon: Calculator, color: '#d4a72c' },
];

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="min-w-0 h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex h-full min-w-0 items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold leading-4 text-slate-700 dark:text-slate-200">{label.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</p>
          <p className="mt-1 break-words text-xl font-bold leading-tight tabular-nums text-[#0b0f4a] dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ViewDialog({ entry, open, onClose }: { entry: DailySalesEntry | null; open: boolean; onClose: () => void }) {
  return <SalesReportDetailsDialog entry={open ? entry : null} onClose={onClose} />;
}

export default function CsDailySales() {
  const { user } = useApp();
  const [entries, setEntries] = useState<DailySalesEntry[]>([]);
  const [summary, setSummary] = useState<DailySalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [viewEntry, setViewEntry] = useState<DailySalesEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [worklist, setWorklist] = useState<Worklist>({ ready: [], awaiting: [] });
  const [methodChoices, setMethodChoices] = useState<Record<string, string>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [refundEntry, setRefundEntry] = useState<DailySalesEntry | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSaving, setRefundSaving] = useState(false);

  const today = useMemo(todayInManila, []);

  async function requestRefund(event: React.FormEvent) {
    event.preventDefault();
    if (!refundEntry || !refundAmount || !refundReason.trim()) return;
    setRefundSaving(true);
    try {
      await api.post(`/collections/${encodeURIComponent(refundEntry.id)}/refund-requests`, { amount: refundAmount, reason: refundReason.trim() });
      toast.success('Refund request submitted for Admin approval.');
      setRefundEntry(null); setRefundAmount(''); setRefundReason('');
      setRefreshToken(value => value + 1);
    } catch (error: any) { toast.error(error?.response?.data?.message || 'Unable to submit refund request.'); }
    finally { setRefundSaving(false); }
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      api.get<DailySalesEntry[]>('/daily-sales?completedOnly=true'),
      api.get<DailySalesSummary>(`/daily-sales/summary?date=${today}&completedOnly=true`),
      api.get<Worklist>('/daily-sales/drafts'),
    ])
      .then(([entriesRes, summaryRes, worklistRes]) => {
        if (mounted) {
          setEntries(entriesRes.data ?? []);
          setSummary(summaryRes.data ?? null);
          setWorklist({ ready: worklistRes.data?.ready ?? [], awaiting: worklistRes.data?.awaiting ?? [] });
        }
      })
      .catch(() => {
        if (mounted) {
          toast.error('Failed to load daily sales reports');
          setEntries([]);
          setSummary(null);
          setWorklist({ ready: [], awaiting: [] });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [today, refreshToken]);

  const methodFor = (draft: DraftRow) => methodChoices[draft.bookingUuid] || draft.method;
  const readyToSubmit = worklist.ready.filter((draft) => methodFor(draft));
  const missingMethod = worklist.ready.length - readyToSubmit.length;

  /** Sends every Daily Sales draft to Collection Approval in one step. */
  async function submitForApproval() {
    if (!worklist.ready.length) {
      toast.error('There are no records to submit.');
      return;
    }
    if (!readyToSubmit.length) {
      toast.error('Choose a payment method for the records first.', { description: 'Use the row menu to set the method.' });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post<{ submitted: number; skipped: Array<{ bookingNo: string; reason: string }> }>(
        '/daily-sales/submit-collections',
        { items: worklist.ready.map((draft) => ({ bookingUuid: draft.bookingUuid, method: methodFor(draft) ?? undefined })) },
      );
      if (data.submitted) toast.success(`${data.submitted} ${data.submitted === 1 ? 'record was' : 'records were'} submitted for collection approval.`);
      if (data.skipped?.length) {
        toast.warning(`${data.skipped.length} ${data.skipped.length === 1 ? 'record was' : 'records were'} not submitted`, {
          description: data.skipped.slice(0, 3).map((item) => `${item.bookingNo}: ${item.reason}`).join(' · '),
        });
      }
      setMethodChoices({});
      setRefreshToken((value) => value + 1);
    } catch (error: any) {
      console.error('Failed to submit records for collection approval', error);
      toast.error(error?.response?.data?.message || 'Failed to submit records for collection approval.');
    } finally {
      setSubmitting(false);
    }
  }

  const rows = useMemo<TableRow[]>(() => [
    ...worklist.ready.map((draft): TableRow => ({
      kind: 'ready', key: `ready-${draft.bookingUuid}`, date: draft.completedOn, clientName: draft.clientName,
      bookingNo: draft.bookingNo, amount: draft.amount, method: methodChoices[draft.bookingUuid] || draft.method,
      reference: draft.reference, draft,
    })),
    ...worklist.awaiting.map((item): TableRow => ({
      kind: 'awaiting', key: `awaiting-${item.id}`, date: item.submittedOn, clientName: item.clientName,
      bookingNo: item.bookingNo, amount: item.amount, method: item.method, reference: item.reference,
    })),
    ...entries.map((entry): TableRow => ({ kind: 'verified', key: `verified-${entry.id}`, entry })),
  ], [worklist, entries, methodChoices]);

  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [rows, safePage, rowsPerPage]);

  /** Same report PDF as the Admin Reports tabs (Job Order style), in landscape for the sales columns. */
  async function downloadSalesReportPdf() {
    if (!entries.length) {
      toast.error('There are no sales records to export.');
      return;
    }
    const dateLabel = (value?: string | null) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
      return match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
        : value || '-';
    };
    const sum = (getValue: (entry: DailySalesEntry) => string | number | null | undefined) =>
      entries.reduce((total, entry) => total + Math.round(toNumber(getValue(entry)) * 100), 0) / 100;
    const dates = entries.map((entry) => entry.date).filter(Boolean).sort();
    const period = dates.length ? (dates[0] === dates[dates.length - 1] ? dateLabel(dates[0]) : `${dateLabel(dates[0])} to ${dateLabel(dates[dates.length - 1])}`) : 'All recorded sales';
    try {
      await exportReportPdf({
        reportName: 'Daily Sales Report',
        fileStem: 'daily-sales-report',
        period,
        filters: [],
        generatedBy: user?.fullName || 'Customer Service',
        generatedAt: new Date(),
        landscape: true,
        sections: [
          {
            kind: 'metrics', title: `Today's summary · ${dateLabel(today)}`, items: [
              { label: 'In-house trips', value: summary ? summary.totalInHouse : null, format: 'number' },
              { label: 'Subcontracted trips', value: summary ? summary.totalSubcontracted : null, format: 'number' },
              { label: 'Total sales', value: summary ? toNumber(summary.totalSales) : null, format: 'peso' },
              { label: 'Cash', value: summary ? toNumber(summary.totalCash) : null, format: 'peso' },
              { label: 'BDO', value: summary ? toNumber(summary.totalBdo) : null, format: 'peso' },
              { label: 'GCash', value: summary ? toNumber(summary.totalGcash) : null, format: 'peso' },
              { label: 'Xendit', value: summary ? toNumber(summary.totalXendit) : null, format: 'peso' },
            ],
          },
          {
            kind: 'table', title: 'Sales entries', note: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`,
            columns: [
              { header: 'Date', key: 'date' },
              { header: 'Client', key: 'client' },
              { header: 'Booking no.', key: 'bookingNo' },
              { header: 'Amount', key: 'amount', format: 'peso' },
              { header: 'Cash', key: 'cash', format: 'peso' },
              { header: 'BDO', key: 'bdo', format: 'peso' },
              { header: 'GCash', key: 'gcash', format: 'peso' },
              { header: 'Xendit', key: 'xendit', format: 'peso' },
              { header: 'Paid on', key: 'paidOn' },
              { header: 'Invoice', key: 'invoice' },
            ],
            rows: entries.map((entry) => ({
              date: dateLabel(entry.date),
              client: entry.clientName || '-',
              bookingNo: entry.bookingNo || '-',
              amount: toNumber(entry.amount),
              cash: toNumber(entry.cashPayment),
              bdo: toNumber(entry.bdoPayment),
              gcash: toNumber(entry.gcashPayment),
              xendit: toNumber(entry.xenditPayment),
              paidOn: entry.dateOfPayment ? dateLabel(entry.dateOfPayment) : '-',
              invoice: entry.traceNo || '-',
            })),
            totals: {
              amount: sum((entry) => entry.amount),
              cash: sum((entry) => entry.cashPayment),
              bdo: sum((entry) => entry.bdoPayment),
              gcash: sum((entry) => entry.gcashPayment),
              xendit: sum((entry) => entry.xenditPayment),
            },
          },
        ],
      });
      toast.success('Sales report downloaded.');
    } catch (error) {
      console.error('Failed to create the sales report PDF', error);
      toast.error('Unable to create the sales report PDF.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="DAILY SALES REPORT"
        subtitle={<>Create and manage daily sales <span className="font-medium text-[#d4a72c]">reports and collections</span>.</>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<div className="flex flex-row gap-2">
          <button
            type="button"
            onClick={submitForApproval}
            disabled={loading || submitting || worklist.ready.length === 0}
            title={submitting ? 'Submitting...' : worklist.ready.length === 0 ? 'No records to submit' : `Submit ${worklist.ready.length} ${worklist.ready.length === 1 ? 'record' : 'records'} for collection approval`}
            aria-label={submitting ? 'Submitting records for collection approval' : 'Submit records for collection approval'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1a1f6e] text-white transition-colors hover:bg-[#151b4f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={downloadSalesReportPdf}
            disabled={loading || entries.length === 0}
            title="Download PDF"
            aria-label="Download PDF"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#d4a72c] text-white shadow-sm transition-colors hover:bg-[#bc9221] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>}
      />

      {!loading && worklist.ready.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span className="font-semibold">{worklist.ready.length} {worklist.ready.length === 1 ? 'record is' : 'records are'} ready to submit.</span>{' '}
          Review them below, then use the Submit button to send them for collection approval.
          {missingMethod > 0 && <> {missingMethod} {missingMethod === 1 ? 'record needs' : 'records need'} a payment method — set it from the row menu.</>}
        </div>
      )}

      {/* Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Daily Sales Summary - {summary?.date ? new Date(summary.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : today}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {SUMMARY_ITEMS.map((item) => (
            <SummaryCard
              key={item.key}
              label={item.label}
              value={summary ? (summary[item.key as keyof DailySalesSummary] as string | number) : '-'}
              icon={item.icon}
              color={item.color}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-none border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full table-auto text-sm">
            <thead className="bg-[#1a1f6e]">
              <tr>
                {[
                  'DATE',
                  'CLIENT',
                  'AMOUNT',
                  'CASH',
                  'BDO',
                  'GCASH',
                  'XENDIT',
                  'DATE OF PAYMENT',
                  'INVOICE NO.',
                  'ACTION',
                ].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    Loading daily sales reports...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    No daily sales records yet. Verified Post-Service records will appear here.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const cell = 'px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap';
                  if (row.kind !== 'verified') {
                    const methodCell = (name: string) => <td key={name} className={cell}>{row.method === name ? peso(row.amount) : '-'}</td>;
                    return (
                      <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className={cell}>{row.date}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-900 dark:text-white">{row.clientName}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{row.bookingNo || '-'}</p>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{peso(row.amount)}</td>
                        {METHODS.map(methodCell)}
                        <td className={cell}>{row.kind === 'ready' && !row.method ? <span className="text-amber-700">Method needed</span> : '-'}</td>
                        <td className={cell}>{row.reference}</td>
                        <td className="px-4 py-2.5">
                          {row.kind === 'ready' ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" aria-label={`Actions for ${row.bookingNo}`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                  <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {METHODS.map((name) => (
                                  <DropdownMenuItem key={name} onClick={() => setMethodChoices((current) => ({ ...current, [row.draft.bookingUuid]: name }))}>
                                    <CreditCard className="mr-2 h-4 w-4" />Paid by {name}{row.method === name ? ' ✓' : ''}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : <span className="px-2 text-slate-400">-</span>}
                        </td>
                      </tr>
                    );
                  }
                  const entry = row.entry;
                  return (
                  <tr
                    key={row.key}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white">{entry.clientName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{entry.bookingNo || '-'}</p>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {entry.amount}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">
                      {toNumber(entry.cashPayment) !== 0 ? entry.cashPayment : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">
                      {toNumber(entry.bdoPayment) !== 0 ? entry.bdoPayment : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">
                      {toNumber(entry.gcashPayment) !== 0 ? entry.gcashPayment : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">
                      {toNumber(entry.xenditPayment) !== 0 ? entry.xenditPayment : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">
                      {entry.dateOfPayment}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">
                      {entry.traceNo}
                    </td>
                    <td className="px-4 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewEntry(entry)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {toNumber(entry.amount) > 0 && <DropdownMenuItem onClick={() => { setRefundEntry(entry); setRefundAmount(String(toNumber(entry.amount))); setRefundReason(''); }}>
                            <RotateCcw className="mr-2 h-4 w-4" />Request refund
                          </DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <TablePagination page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
      </div>

      <ViewDialog entry={viewEntry} open={!!viewEntry} onClose={() => setViewEntry(null)} />
      {refundEntry && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !refundSaving) setRefundEntry(null); }}>
        <form onSubmit={requestRefund} role="dialog" aria-modal="true" aria-labelledby="refund-request-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-[#f1f4fa] shadow-2xl">
          <ModalHeader plain titleId="refund-request-title" icon={RotateCcw} title="Request refund" subtitle={`${refundEntry.bookingNo} · ${refundEntry.clientName}`} onClose={() => setRefundEntry(null)} closeDisabled={refundSaving} closeLabel="Close request refund" />
          <div className="space-y-4 p-4"><p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">This submits a request for Admin approval. It does not issue the refund now.</p><label className="block text-sm font-medium text-slate-700">Refund amount (PHP)<input required type="number" min="0.01" max={toNumber(refundEntry.amount)} step="0.01" value={refundAmount} onChange={event => setRefundAmount(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/20" /></label><label className="block text-sm font-medium text-slate-700">Reason<input required maxLength={500} value={refundReason} onChange={event => setRefundReason(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/20" placeholder="Reason for the refund" /></label></div>
          <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button type="button" disabled={refundSaving} onClick={() => setRefundEntry(null)} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-700">Cancel</button><button type="submit" disabled={refundSaving || !refundAmount || !refundReason.trim()} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg bg-[#030848] px-4 text-sm font-medium text-white disabled:bg-slate-100 disabled:text-slate-400">{refundSaving ? 'Submitting...' : 'Submit request'}</button></footer>
        </form>
      </div>}
    </div>
  );
}
