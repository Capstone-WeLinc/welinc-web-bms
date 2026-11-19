import { StatusFilter } from '../../components/ui/ListSearchFilters';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import ExportMenu from '../../components/ui/ExportMenu';
import ModalHeader from '../../components/ui/ModalHeader';
import TablePagination from '../../components/ui/TablePagination';
import PageHeader from '../../components/pageheader/Pageheader';
import { useState, useEffect, useMemo } from 'react';
import { Search, Eye, MoreVertical, CheckCircle, CheckCircle2, User as UserIcon, Info, TriangleAlert, FileText, FileSpreadsheet, ClipboardList, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportPostServiceExcel, toPostServiceExcelDate } from '../../lib/documents/postServiceExcel';
import type { Booking } from '../../lib/types';
import StatusBadge from '../../components/shared/StatusBadge';
import KPICard from '../../components/shared/KpiCard';
import { Dialog, DialogContent, DialogClose } from '../../components/ui/Dialog';
import { Textarea } from '../../components/ui/Textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/Dropdown';
import { api } from '../../lib/api';
import { PROTECTIVE_MATERIALS } from '../../components/booking/CostSummary';
import { notifyBookingStatusUpdated } from '../../lib/booking-sync';
import { COMPLETION_TEXT_MAX_WORDS } from '../../lib/completion-text-validation';

interface BookingWithPostService extends Booking {
  postServiceStatus?: string | null;
  arrivalTime?: string | null;
  protectiveMaterials?: string[];
  additionalMaterials?: string[];
  amountPaid?: number | null;
  completionNotes?: string | null;
  issueReported?: boolean | null;
  issueDetails?: string | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
}

type FilterTab = 'All' | 'Completed' | 'Pending Review' | 'Finalized' | 'Issue Reported';

const FILTERS: FilterTab[] = ['All', 'Completed', 'Pending Review', 'Finalized', 'Issue Reported'];

function formatDate(value?: string | null) {
  if (!value) return '-';
  return value;
}

function formatPostServiceDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1a1f6e]"><span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />{children}</h3>;
}

function Detail({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className={`mt-1 break-words text-[15px] font-medium ${muted ? 'text-slate-400' : 'text-slate-900'}`}>{value}</p></div>;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const completionCurrencyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatCompletionAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  return completionCurrencyFormatter.format(toNumber(value));
}

function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message || err.message || fallback;
}

function uniqueBookings(rows: BookingWithPostService[]) {
  const seen = new Set<string>();
  return rows.filter((booking) => {
    const key = String(booking.bookingId ?? booking.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function PostService() {
  const [bookings, setBookings] = useState<BookingWithPostService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const [viewBooking, setViewBooking] = useState<BookingWithPostService | null>(null);
  const [editBooking, setEditBooking] = useState<BookingWithPostService | null>(null);

  // Edit form state
  const [arrivalTime, setArrivalTime] = useState('');
  const [arrivalHour, setArrivalHour] = useState('');
  const [arrivalMinute, setArrivalMinute] = useState('');
  const [arrivalPeriod, setArrivalPeriod] = useState<'AM' | 'PM'>('AM');
  const [additionalMaterials, setAdditionalMaterials] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [issueReported, setIssueReported] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [serviceCompleted, setServiceCompleted] = useState(true);

  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get('/post-service');
      setBookings(uniqueBookings(Array.isArray(res.data) ? res.data : []));
    } catch (error: unknown) {
      setBookings([]);
      toast.error('Failed to load Post-Service records', {
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    } finally {
      setLoading(false);
    }
  }

  function closeEdit() {
    setEditBooking(null);
    setArrivalTime('');
    setArrivalHour('');
    setArrivalMinute('');
    setArrivalPeriod('AM');
    setAdditionalMaterials([]);
    setCompletionNotes('');
    setIssueReported(false);
    setIssueDetails('');
    setServiceCompleted(true);
    setTouched({});
  }

  function handleArrivalHourChange(value: string) {
    setArrivalHour(value);
    updateArrivalTime(value, arrivalMinute, arrivalPeriod);
  }

  function handleArrivalMinuteChange(value: string) {
    setArrivalMinute(value);
    updateArrivalTime(arrivalHour, value, arrivalPeriod);
  }

  function handleArrivalPeriodChange(value: 'AM' | 'PM') {
    setArrivalPeriod(value);
    updateArrivalTime(arrivalHour, arrivalMinute, value);
  }

  function markTouched(field: string) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function updateArrivalTime(hour: string, minute: string, period: 'AM' | 'PM') {
    const parsedHour = Number(hour);
    const parsedMinute = Number(minute);
    if (parsedHour >= 1 && parsedHour <= 12 && parsedMinute >= 0 && parsedMinute <= 59) {
      setArrivalTime(`${parsedHour}:${String(parsedMinute).padStart(2, '0')} ${period}`);
    } else {
      setArrivalTime('');
    }
  }

  async function handleSave(finalize = false) {
    if (!editBooking) return;
    setSaving(true);

    const nextPostServiceStatus = issueReported
      ? 'Issue Reported'
      : finalize
      ? 'Finalized'
      : editBooking.postServiceStatus === 'Finalized'
      ? 'Finalized'
      : 'Pending Review';

    const requiredFieldsValid = serviceCompleted && Boolean(arrivalTime);
    if (!requiredFieldsValid) {
      setTouched({ serviceCompleted: true, arrivalTime: true });
      toast.error('Complete the required fields', { description: 'Service completion and arrival time are required.' });
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      postServiceStatus: nextPostServiceStatus,
      arrivalTime: arrivalTime || null,
      additionalMaterials,
      completionNotes: completionNotes.trim() || null,
      issueReported,
      issueDetails: issueReported ? issueDetails.trim() || null : null,
      status: 'Completed',
    };

    try {
      await api.put(`/post-service/${editBooking.bookingId || editBooking.id}`, payload);
      if (serviceCompleted) {
        notifyBookingStatusUpdated(editBooking.bookingId || editBooking.id, 'Completed');
      }
      toast.success(finalize ? 'Booking finalized' : 'Post-service record updated');
      closeEdit();
      loadData();
    } catch (error: unknown) {
      toast.error('Failed to save post-service record', { description: getApiErrorMessage(error, 'Please try again.') });
    } finally {
      setSaving(false);
    }
  }

  const finalizeValidation = useMemo(() => {
    const checks = {
      serviceCompleted,
      arrivalRecorded: arrivalTime !== '',
      issuesReviewed: !issueReported || (issueReported && issueDetails.trim().length > 0),
    };
    const isValid = Object.values(checks).every(Boolean);
    const missing = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => {
        switch (k) {
          case 'serviceCompleted': return 'confirm service completion';
          case 'arrivalRecorded': return 'enter arrival time';
          case 'issuesReviewed': return 'enter issue details';
          default: return k;
        }
      });
    return { isValid, missing, checks };
  }, [serviceCompleted, arrivalTime, issueReported, issueDetails]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (/^cancelled?$/i.test(String(b.status).trim())) return false;
      const targetId = (b.bookingNo ?? '').toString().toLowerCase();
      const matchSearch = targetId.includes(search.toLowerCase()) || b.client.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All'
        || (filter === 'Completed' && b.status === 'Completed')
        || (filter === 'Pending Review' && b.postServiceStatus === 'Pending Review')
        || (filter === 'Finalized' && b.postServiceStatus === 'Finalized')
        || (filter === 'Issue Reported' && b.issueReported === true);
      const bookingDate = String(b.date || '').slice(0, 10);
      const matchDateRange = (!dateFrom || bookingDate >= dateFrom)
        && (!dateTo || bookingDate <= dateTo);
      return matchSearch && matchFilter && matchDateRange;
    });
  }, [bookings, search, filter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const postServiceRecords = bookings.filter((booking) => !/^cancelled?$/i.test(String(booking.status).trim()));
  const postServiceKpis = [
    { label: 'Total Records', value: postServiceRecords.length, icon: ClipboardList, color: '#1a1f6e' },
    { label: 'Pending Review', value: postServiceRecords.filter((booking) => !booking.postServiceStatus || booking.postServiceStatus === 'Pending Review').length, icon: Clock3, color: '#f59e0b' },
    { label: 'Finalized', value: postServiceRecords.filter((booking) => booking.postServiceStatus === 'Finalized').length, icon: CheckCircle2, color: '#10b981' },
    { label: 'Issues Reported', value: postServiceRecords.filter((booking) => booking.issueReported === true).length, icon: TriangleAlert, color: '#ef4444' },
  ];

  function exportPDF() {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(7, 26, 82);
      doc.text('Post-Service Report', 14, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(85, 112, 143);
      doc.text(`Exported ${new Date().toLocaleString('en-PH')}`, 14, 22);
      autoTable(doc, {
        startY: 28,
        head: [['Booking No.', 'Client', 'Service', 'Service Date', 'Payment', 'Amount Paid', 'Status']],
        body: filtered.map((booking) => [
          booking.bookingNo || '-', booking.client || '-', booking.service || '-', formatDate(booking.date),
          booking.paymentStatus || '-', formatCompletionAmount(booking.amountPaid),
          booking.issueReported ? 'Issue Reported' : booking.postServiceStatus || 'Pending Review',
        ]),
        theme: 'grid',
        margin: { left: 14, right: 14, bottom: 16 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [226, 232, 240] },
        headStyles: { fillColor: [11, 15, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save('post-service-report.pdf');
    } catch (error) {
      console.error('Failed to export post-service report', error);
      toast.error('Unable to export post-service report');
    }
  }

  async function exportExcel() {
    try {
      await exportPostServiceExcel(filtered.map((booking) => ({
        bookingNo: booking.bookingNo || '-',
        client: booking.client || '-',
        service: booking.service || '-',
        serviceDate: toPostServiceExcelDate(booking.date) || '-',
        payment: booking.paymentStatus || '-',
        amountPaid: booking.amountPaid == null ? null : toNumber(booking.amountPaid),
        status: booking.issueReported ? 'Issue Reported' : booking.postServiceStatus || 'Pending Review',
      })));
    } catch (error) {
      console.error('Failed to export post-service report to Excel', error);
      toast.error('Unable to export post-service report');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a1f6e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserIcon}
        title="POST-SERVICE"
        subtitle={<>Review and manage completed bookings, <span className="font-medium text-[#d4a72c]">payments, and service records</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<div className="flex flex-wrap items-center justify-end gap-2">
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onClear={() => { setDateFrom(''); setDateTo(''); }} />
        </div>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {postServiceKpis.map((kpi) => <KPICard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} iconColor={kpi.color} variant="dashboard-compact" />)}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:items-center border border-b-0 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search booking No. and client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a0f2e]/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusFilter options={FILTERS} value={filter} onChange={setFilter} />
            <ExportMenu options={[{ label: 'PDF', icon: FileText, onSelect: () => { void exportPDF(); } }, { label: 'Excel', icon: FileSpreadsheet, onSelect: () => { void exportExcel(); } }]} />
          </div>
      </div>

      {/* Table Card */}
      <div className="!mt-0 overflow-hidden rounded-none border border-slate-200 bg-white">
        {/* Table */}
        <div className="overflow-x-auto">
          <table key={filter} className="w-full text-sm">
            <thead className="bg-[#1a1f6e] text-white">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Booking No.</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Service Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Payment</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Amount Paid</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((b) => {
                const statusLabel = b.issueReported ? 'Issue Reported' : b.postServiceStatus || 'Pending Review';
                return (
                  <tr key={`${filter}-${b.bookingId || b.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{b.bookingNo || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-900">{b.client}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(b.date)}</td>
                    <td className="px-4 py-2.5">
                      {b.paymentStatus ? <StatusBadge status={b.paymentStatus} size="xs" variant="outline" /> : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">
                      {b.amountPaid !== null && b.amountPaid !== undefined ? formatPeso(b.amountPaid) : '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={statusLabel} size="xs" variant="outline" />
                    </td>
                    <td className="px-4 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
                            <MoreVertical size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-fit min-w-0 whitespace-nowrap">
                          <DropdownMenuItem onClick={() => setViewBooking(b)} className="cursor-pointer">
                            <Eye size={16} className="mr-2" /> View
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {!paginated.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No post-service records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <TablePagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
      </div>

      {/* View Modal */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent hideCloseButton aria-describedby={undefined} className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
          <ModalHeader icon={ClipboardList} title="Post-service record" closeLabel="Close post-service record" />
          {viewBooking && (
            <>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
              <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <SectionHeading>Booking details</SectionHeading>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                  <Detail label="Booking no." value={viewBooking.bookingNo || 'Not recorded'} />
                  <Detail label="Client" value={viewBooking.client || 'Not recorded'} />
                  <Detail label="Service" value={viewBooking.service || 'Not recorded'} />
                  <Detail label="Service date" value={formatPostServiceDate(viewBooking.date)} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <SectionHeading>Payment</SectionHeading>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                  <div><p className="text-sm text-slate-600">Payment</p><span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${viewBooking.paymentStatus?.toLowerCase() === 'paid' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{viewBooking.paymentStatus || 'Not recorded'}</span></div>
                  <Detail label="Amount paid" value={viewBooking.amountPaid !== null && viewBooking.amountPaid !== undefined ? formatPeso(viewBooking.amountPaid) : 'Not recorded'} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <SectionHeading>Completion</SectionHeading>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                  <Detail label="Arrival time" value={viewBooking.arrivalTime || 'Not recorded'} muted={!viewBooking.arrivalTime} />
                  <div><p className="text-sm text-slate-600">Status</p><span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${viewBooking.issueReported ? 'border-red-300 bg-red-50 text-red-700' : viewBooking.postServiceStatus === 'Finalized' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>{viewBooking.issueReported ? 'Issue Reported' : viewBooking.postServiceStatus || 'Pending Review'}</span></div>
                </div>
                <div className="mt-3 rounded-xl border-l-[3px] border-[#e8b800] bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">Completion notes</p>
                  <p className={`mt-1 break-words text-sm leading-relaxed ${viewBooking.completionNotes ? 'text-slate-800' : 'text-slate-400'}`}>{viewBooking.completionNotes || 'No notes recorded.'}</p>
                </div>
              </section>

              {Array.isArray(viewBooking.additionalMaterials) && viewBooking.additionalMaterials.length > 0 && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionHeading>Trip add-ons</SectionHeading><p className="mt-3 text-sm leading-relaxed text-slate-800">{viewBooking.additionalMaterials.join(', ')}</p></section>}
              {viewBooking.issueReported && (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-4"><SectionHeading>Issue details</SectionHeading><p className="mt-3 text-sm leading-relaxed text-red-800">{viewBooking.issueDetails || 'No details provided.'}</p></section>
              )}
            </div>
            <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3"><DialogClose className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</DialogClose></footer>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editBooking} onOpenChange={closeEdit}>
        <DialogContent
          hideCloseButton
          aria-describedby={undefined}
          className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl"
        >
          {editBooking && (
            <>
              <ModalHeader
                icon={CheckCircle2}
                title="Trip completion"
                subtitle={[editBooking.bookingNo || '-', editBooking.client, editBooking.service].filter(Boolean).join(' · ')}
                closeLabel="Close trip completion"
              />

              <div className="max-h-[70vh] space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
                <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Payment method</p>
                      <p className="mt-1 text-base font-medium text-slate-900">{editBooking.paymentMethod || 'Not selected'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Booking amount</p>
                      <p className="mt-1 text-base font-medium text-slate-900">{formatCompletionAmount(editBooking.amount)}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />
                    <h3 className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">Add-ons</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Select additional protective materials requested during the trip.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {PROTECTIVE_MATERIALS.map((material) => {
                      const selected = additionalMaterials.includes(material.name);
                      return (
                        <label
                          key={material.name}
                          className={selected
                            ? 'flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-[#1a1f6e] bg-[#eef0fa] px-3 py-2.5'
                            : 'flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5'}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setAdditionalMaterials((current) => selected
                              ? current.filter((name) => name !== material.name)
                              : [...current, material.name])}
                            className="h-[18px] w-[18px] shrink-0 accent-[#1a1f6e]"
                          />
                          <span className="min-w-0 flex-1 text-sm text-slate-900">{material.name}</span>
                          <span className="shrink-0 text-sm font-medium text-[#1a1f6e]">{formatCompletionAmount(material.price)}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-[#eef0fa] px-3 py-2.5 text-sm text-[#1a1f6e]">
                    <span>
                      Add-ons {formatCompletionAmount(additionalMaterials.reduce(
                        (total, name) => total + (PROTECTIVE_MATERIALS.find((material) => material.name === name)?.price || 0),
                        0,
                      ))}
                    </span>
                    <span className="font-medium">
                      Updated total <span className="text-base font-semibold">{formatCompletionAmount(
                        toNumber(editBooking.amount) + additionalMaterials.reduce(
                          (total, name) => total + (PROTECTIVE_MATERIALS.find((material) => material.name === name)?.price || 0),
                          0,
                        ),
                      )}</span>
                    </span>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />
                    <h3 className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">
                      Arrival time <span className="text-red-600">*</span>
                    </h3>
                  </div>
                  <div
                    id="arrivalTime"
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Arrival time"
                    onBlur={() => markTouched('arrivalTime')}
                  >
                    <input
                      type="number"
                      min="1"
                      max="12"
                      inputMode="numeric"
                      value={arrivalHour}
                      onChange={(event) => handleArrivalHourChange(event.target.value)}
                      placeholder="HH"
                      aria-label="Arrival hour"
                      aria-invalid={touched.arrivalTime && !arrivalTime}
                      className={touched.arrivalTime && !arrivalTime
                        ? 'h-10 w-[70px] rounded-lg border border-red-500 bg-white px-2 text-center text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500/20'
                        : 'h-10 w-[70px] rounded-lg border border-slate-300 bg-white px-2 text-center text-sm text-slate-900 outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20'}
                    />
                    <span className="text-base font-medium text-slate-600" aria-hidden="true">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      inputMode="numeric"
                      value={arrivalMinute}
                      onChange={(event) => handleArrivalMinuteChange(event.target.value)}
                      placeholder="MM"
                      aria-label="Arrival minute"
                      aria-invalid={touched.arrivalTime && !arrivalTime}
                      className={touched.arrivalTime && !arrivalTime
                        ? 'h-10 w-[70px] rounded-lg border border-red-500 bg-white px-2 text-center text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500/20'
                        : 'h-10 w-[70px] rounded-lg border border-slate-300 bg-white px-2 text-center text-sm text-slate-900 outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20'}
                    />
                    <div className="inline-flex h-10 overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="AM or PM">
                      {(['AM', 'PM'] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          aria-pressed={arrivalPeriod === period}
                          onClick={() => handleArrivalPeriodChange(period)}
                          className={arrivalPeriod === period
                            ? 'h-10 min-w-[48px] bg-[#030848] px-3 text-sm font-medium text-white'
                            : 'h-10 min-w-[48px] bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50'}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                  {touched.arrivalTime && !arrivalTime && <p className="mt-1 text-xs text-red-600">This field is required.</p>}
                </section>

                <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />
                    <h3 className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">Trip notes</h3>
                  </div>
                  <label
                    htmlFor="serviceCompleted"
                    className="mb-3 flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
                  >
                    <input
                      id="serviceCompleted"
                      type="checkbox"
                      checked={serviceCompleted}
                      onChange={(event) => { setServiceCompleted(event.target.checked); markTouched('serviceCompleted'); }}
                      onBlur={() => markTouched('serviceCompleted')}
                      aria-invalid={touched.serviceCompleted && !serviceCompleted}
                      className="h-[18px] w-[18px] shrink-0 accent-[#1a1f6e]"
                    />
                    <span className="flex-1">Service successfully completed</span>
                    {serviceCompleted && <CheckCircle size={16} className="text-emerald-600" aria-hidden="true" />}
                  </label>
                  {touched.serviceCompleted && !serviceCompleted && <p className="mb-3 text-xs text-red-600">This field is required.</p>}

                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <input
                      id="issueReported"
                      type="checkbox"
                      checked={issueReported}
                      onChange={(event) => setIssueReported(event.target.checked)}
                      className="h-[18px] w-[18px] shrink-0 accent-amber-700"
                    />
                    <TriangleAlert size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
                    <span>Issues happened during the trip</span>
                  </label>

                  {issueReported && (
                    <div className="mt-3">
                      <label htmlFor="issueDetails" className="mb-1.5 block text-sm font-medium text-slate-700">
                        Issue details
                      </label>
                      <Textarea
                        id="issueDetails"
                        value={issueDetails}
                        onChange={(event) => setIssueDetails(event.target.value)}
                        placeholder="Describe the issue..."
                        rows={3}
                        className="w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900"
                      />
                    </div>
                  )}

                  <div className="mt-3">
                    <label htmlFor="completionNotes" className="mb-1.5 block text-sm font-medium text-slate-700">Completion notes</label>
                    <Textarea
                      id="completionNotes"
                      value={completionNotes}
                      onChange={(event) => setCompletionNotes(event.target.value)}
                      placeholder="Enter notes about the service completion..."
                      rows={3}
                      className="w-full rounded-lg border-slate-300 text-sm text-slate-900"
                    />
                    <div className="mt-1 flex justify-end text-xs text-slate-500">
                      {completionNotes.trim() ? completionNotes.trim().split(/\s+/).length : 0} / {COMPLETION_TEXT_MAX_WORDS} words
                    </div>
                  </div>
                </section>

                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  <Info size={16} className="shrink-0" aria-hidden="true" />
                  <p>Record collections separately in Daily Sales after completing the work.</p>
                </div>
                {!finalizeValidation.isValid && (
                  <p className="text-sm text-red-600">Please {finalizeValidation.missing.join(', ')} to finalize.</p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {saving ? 'Finalizing...' : 'Finalize Booking'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="inline-flex h-10 w-fit items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#030848] px-4 text-sm font-medium text-white hover:bg-[#151b4f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : <><CheckCircle2 size={16} /> Save completion</>}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
