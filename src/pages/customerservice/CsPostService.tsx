import { StatusFilter } from '../../components/ui/ListSearchFilters';
import ExportMenu from '../../components/ui/ExportMenu';
import ModalHeader from '../../components/ui/ModalHeader';
import TablePagination from '../../components/ui/TablePagination';
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  ClipboardList,
  Edit3,
  Eye,
  MoreVertical,
  Search,
  Info,
  TriangleAlert,
  WalletCards,
  XCircle,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportPostServiceExcel, toPostServiceExcelDate } from '../../lib/documents/postServiceExcel';
import type { Booking } from '../../lib/types';
import StatusBadge from '../../components/shared/StatusBadge';
import KPICard from '../../components/shared/KpiCard';
import { Textarea } from '../../components/ui/Textarea';
import { Dialog, DialogContent, DialogClose } from '../../components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/Dropdown';
import { api } from '../../lib/api';
import { PROTECTIVE_MATERIALS } from '../../components/booking/CostSummary';
import { DatePicker } from '../../components/ui/DatePicker';
import PageHeader from '../../components/pageheader/Pageheader';
import { notifyBookingStatusUpdated } from '../../lib/booking-sync';
import { COMPLETION_TEXT_MAX_WORDS, validateCompletionText } from '../../lib/completion-text-validation';

export interface CustomerServiceBooking extends Booking {
  postServiceStatus?: string | null;
}

type FilterTab = 'All' | 'Completed' | 'Pending Review' | 'Finalized' | 'Issue Reported';

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
const FILTERS: FilterTab[] = ['All', 'Completed', 'Pending Review', 'Finalized', 'Issue Reported'];

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message || err.message || fallback;
}

function formatAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const amount = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount)
    ? `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : String(value);
}

const completionCurrencyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function formatCompletionAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const amount = numericAmount(value);
  return Number.isFinite(amount) ? completionCurrencyFormatter.format(amount) : String(value);
}

function numericAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 0;
  const amount = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

export function uniqueBookings(rows: CustomerServiceBooking[]) {
  const seen = new Set<string>();
  return rows.filter((booking) => {
    if (/^cancelled?$/i.test(String(booking.status).trim())) return false;
    const key = String(booking.bookingId ?? booking.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatArrivalTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (/^1970-01-01T/.test(value)) {
    const hour = date.getUTCHours() % 12 || 12;
    const period = date.getUTCHours() >= 12 ? 'PM' : 'AM';
    return `${hour}:${String(date.getUTCMinutes()).padStart(2, '0')} ${period}`;
  }
  return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatTimeOnly(value: string) {
  const timeMatch = value.match(/(?:T|\s)(\d{2}:\d{2})/);
  const time = timeMatch?.[1] ?? value.match(/^(\d{1,2}:\d{2})/)?.[1];
  if (!time) return value;
  const date = new Date(value);
  const isStoredTimeOnly = /^1970-01-01T/.test(value) && !Number.isNaN(date.getTime());
  const [rawHour, minute] = isStoredTimeOnly
    ? [date.getUTCHours(), date.getUTCMinutes()]
    : time.split(':').map(Number);
  const period = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function getCustomerServiceStatus(booking: CustomerServiceBooking) {
  if (booking.issueReported) return 'Issue Reported';
  if (booking.postServiceStatus === 'Finalized') return 'Finalized';
  if (booking.status === 'Completed') return 'Completed';
  return booking.postServiceStatus || 'Pending Review';
}

function PostServiceDetails({ booking }: { booking: CustomerServiceBooking }) {
  const status = getCustomerServiceStatus(booking);
  const arrival = formatArrivalTime(booking.arrivalTime);
  return <>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <SectionHeading>Booking details</SectionHeading>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
          <Detail label="Booking no." value={booking.bookingNo || 'Not recorded'} />
          <Detail label="Client" value={booking.client || 'Not recorded'} />
          <Detail label="Service" value={booking.service || 'Not recorded'} />
          <Detail label="Service date" value={formatPostServiceDate(booking.date)} />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <SectionHeading>Payment</SectionHeading>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
          <div><p className="text-sm text-slate-600">Payment</p><span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${booking.paymentStatus?.toLowerCase() === 'paid' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{booking.paymentStatus || 'Not recorded'}</span>{booking.paymentMethod && <p className="mt-1 text-sm text-slate-500">{booking.paymentMethod}</p>}</div>
          <Detail label="Amount paid" value={booking.amountPaid !== null && booking.amountPaid !== undefined ? formatAmount(booking.amountPaid) : 'Not recorded'} />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <SectionHeading>Completion</SectionHeading>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
          <Detail label="Arrival time" value={arrival !== '-' ? arrival : 'Not recorded'} muted={arrival === '-'} />
          <div><p className="text-sm text-slate-600">Status</p><span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${booking.issueReported ? 'border-red-300 bg-red-50 text-red-700' : status === 'Finalized' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>{status}</span></div>
        </div>
        <div className="mt-3 rounded-xl border-l-[3px] border-[#e8b800] bg-slate-50 p-3"><p className="text-sm text-slate-600">Completion notes</p><p className={`mt-1 break-words text-sm leading-relaxed ${booking.completionNotes ? 'text-slate-800' : 'text-slate-400'}`}>{booking.completionNotes || 'No notes recorded.'}</p></div>
      </section>
      {Array.isArray(booking.additionalMaterials) && booking.additionalMaterials.length > 0 && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"><SectionHeading>Trip add-ons</SectionHeading><p className="mt-3 text-sm leading-relaxed text-slate-800">{booking.additionalMaterials.join(', ')}</p></section>}
      {booking.issueReported && <section className="rounded-2xl border border-red-200 bg-red-50 p-4"><SectionHeading>Issue details</SectionHeading><p className="mt-3 text-sm leading-relaxed text-red-800">{booking.issueDetails || 'No details provided.'}</p></section>}
    </div>
    <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3"><DialogClose className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</DialogClose></footer>
  </>;
}

export default function CsPostService() {
  const [bookings, setBookings] = useState<CustomerServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [selectedBooking, setSelectedBooking] = useState<CustomerServiceBooking | null>(null);
  const [viewBooking, setViewBooking] = useState<CustomerServiceBooking | null>(null);

  const [additionalMaterials, setAdditionalMaterials] = useState<string[]>([]);
  const [arrivalTime, setArrivalTime] = useState('');
  const [arrivalHour, setArrivalHour] = useState('');
  const [arrivalMinute, setArrivalMinute] = useState('');
  const [arrivalPeriod, setArrivalPeriod] = useState<'AM' | 'PM'>('AM');
  const [issueReported, setIssueReported] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const completionNotesValidation = useMemo(() => validateCompletionText(completionNotes), [completionNotes]);
  const issueDetailsValidation = useMemo(() => validateCompletionText(issueDetails), [issueDetails]);

  async function loadBookings() {
    setLoading(true);
    try {
      const response = await api.get<CustomerServiceBooking[]>('/post-service');
      setBookings(uniqueBookings(Array.isArray(response.data) ? response.data : []));
    } catch (error: unknown) {
      setBookings([]);
      toast.error('Unable to load Post-Service records', {
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, dateFrom, dateTo]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      const searchValue = String(booking.bookingNo ?? '').toLowerCase();
      const matchSearch = !query || searchValue.includes(query) || booking.client.toLowerCase().includes(query);

      const matchFilter = filter === 'All'
        || (filter === 'Completed' && booking.status === 'Completed')
        || (filter === 'Pending Review' && getCustomerServiceStatus(booking) === 'Pending Review')
        || (filter === 'Finalized' && getCustomerServiceStatus(booking) === 'Finalized')
        || (filter === 'Issue Reported' && booking.issueReported === true);

      const bookingDate = String(booking.date || '').slice(0, 10);
      const matchDateRange = (!dateFrom || bookingDate >= dateFrom)
        && (!dateTo || bookingDate <= dateTo);

      return matchSearch && matchFilter && matchDateRange;
    });
  }, [bookings, search, filter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBookings = filteredBookings.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const postServiceRecords = bookings.filter((booking) => !/^cancelled?$/i.test(String(booking.status).trim()));
  const postServiceKpis = [
    { label: 'Total Records', value: postServiceRecords.length, icon: ClipboardList, color: '#1a1f6e' },
    { label: 'Pending Review', value: postServiceRecords.filter((booking) => getCustomerServiceStatus(booking) === 'Pending Review').length, icon: Clock3, color: '#f59e0b' },
    { label: 'Finalized', value: postServiceRecords.filter((booking) => getCustomerServiceStatus(booking) === 'Finalized').length, icon: CheckCircle2, color: '#10b981' },
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
        body: filteredBookings.map((booking) => [
          booking.bookingNo || '-', booking.client || '-', booking.service || '-', booking.date || '-',
          booking.paymentStatus || '-', formatCompletionAmount(booking.amountPaid), getCustomerServiceStatus(booking),
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
      await exportPostServiceExcel(filteredBookings.map((booking) => ({
        bookingNo: booking.bookingNo || '-',
        client: booking.client || '-',
        service: booking.service || '-',
        serviceDate: toPostServiceExcelDate(booking.date) || '-',
        payment: booking.paymentStatus || '-',
        amountPaid: booking.amountPaid == null ? null : numericAmount(booking.amountPaid),
        status: getCustomerServiceStatus(booking),
      })));
    } catch (error) {
      console.error('Failed to export post-service report to Excel', error);
      toast.error('Unable to export post-service report');
    }
  }

  function openCompletion(booking: CustomerServiceBooking) {
    setSelectedBooking(booking);
    setAdditionalMaterials(Array.isArray(booking.additionalMaterials) ? booking.additionalMaterials : []);
    const existingArrivalTime = booking.arrivalTime ? formatTimeOnly(booking.arrivalTime) : '';
    const timeParts = existingArrivalTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    setArrivalTime(existingArrivalTime);
    setArrivalHour(timeParts?.[1] ?? '');
    setArrivalMinute(timeParts?.[2] ?? '');
    setArrivalPeriod((timeParts?.[3]?.toUpperCase() as 'AM' | 'PM') ?? 'AM');
    setIssueReported(Boolean(booking.issueReported));
    setIssueDetails(booking.issueDetails || '');
    setCompletionNotes(booking.completionNotes || '');
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

  function closeCompletion() {
    if (saving) return;
    setSelectedBooking(null);
  }

  async function saveCompletion() {
    if (!selectedBooking) return;

    if (!arrivalTime || (issueReported && !issueDetails.trim())) {
      toast.error('Complete the required details', {
        description: 'Enter the arrival time and issue details when applicable.',
      });
      return;
    }

    if (completionNotesValidation.error || (issueReported && issueDetailsValidation.error)) {
      toast.error('Invalid trip completion text', {
        description: completionNotesValidation.error || issueDetailsValidation.error || undefined,
      });
      return;
    }

    setSaving(true);
    const payload = {
      additionalMaterials,
      arrivalTime,
      issueReported,
      issueDetails: issueReported ? issueDetails.trim() : null,
      completionNotes: completionNotes.trim() || null,
      postServiceStatus: issueReported ? 'Issue Reported' : 'Completed',
      status: 'Completed',
    };

    try {
      await api.put(`/post-service/${selectedBooking.bookingId ?? selectedBooking.id}`, payload);
      notifyBookingStatusUpdated(selectedBooking.bookingId ?? selectedBooking.id, 'Completed');
      toast.success('Post-service completion saved', {
        description: `${selectedBooking.bookingNo ?? '-'} is successfully updated and marked as completed.`,
      });
      closeCompletion();
      await loadBookings();
    } catch (error: unknown) {
      toast.error('Unable to save completion', {
        description: getApiErrorMessage(error, 'Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  }

  function calculateUpdatedAmount() {
    if (!selectedBooking) return 0;

    const additionalMaterialsTotal = additionalMaterials.reduce(
      (total, name) => total + (PROTECTIVE_MATERIALS.find((material) => material.name === name)?.price || 0),
      0,
    );

    return numericAmount(selectedBooking.amount) + additionalMaterialsTotal;
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#1a1f6e]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={WalletCards}
        title="POST-SERVICE"
        subtitle={<>Review and manage completed bookings, <span className="font-medium text-[#d4a72c]">payments, and service records</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-transparent p-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">From:</span>
            <DatePicker value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} className="min-w-[150px] [&>button]:!bg-transparent dark:[&>button]:!bg-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">To:</span>
            <DatePicker value={dateTo} min={dateFrom || undefined} onChange={setDateTo} className="min-w-[150px] [&>button]:!bg-transparent dark:[&>button]:!bg-transparent" />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#0a0f2e]"
              title="Clear date filter"
              aria-label="Clear date filter"
            >
              <XCircle size={16} />
            </button>
          )}
          </div>
        </div>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {postServiceKpis.map((kpi) => <KPICard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} iconColor={kpi.color} variant="dashboard-compact" />)}
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:items-center border border-b-0 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search booking No. and client..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a0f2e]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <StatusFilter options={FILTERS} value={filter} onChange={setFilter} />
            <ExportMenu options={[{ label: 'PDF', icon: FileText, onSelect: () => { void exportPDF(); } }, { label: 'Excel', icon: FileSpreadsheet, onSelect: () => { void exportExcel(); } }]} />

        </div>
      </div>

      <div className="!mt-0 overflow-hidden rounded-none border border-slate-200 bg-white">
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
              {paginatedBookings.map((booking) => {
                const statusLabel = getCustomerServiceStatus(booking);
                return (
                  <tr key={`${filter}-${booking.bookingId || booking.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{booking.bookingNo || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-900">{booking.client}</td>
                    <td className="px-4 py-2.5 text-slate-500">{booking.date || '-'}</td>
                    <td className="px-4 py-2.5">
                      {booking.paymentStatus ? <StatusBadge status={booking.paymentStatus} size="xs" variant="outline" /> : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900">
                      {booking.amountPaid !== null && booking.amountPaid !== undefined ? formatAmount(booking.amountPaid) : '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={statusLabel} size="xs" variant="outline" />
                    </td>
                    <td className="px-4 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Booking actions">
                            <MoreVertical size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-fit min-w-0 whitespace-nowrap">
                          <DropdownMenuItem onClick={() => setViewBooking(booking)} className="cursor-pointer">
                            <Eye size={16} className="mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCompletion(booking)} className="cursor-pointer">
                            <Edit3 size={16} className="mr-2" /> Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}

              {!paginatedBookings.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No post-service records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination page={safePage} totalPages={totalPages} totalItems={filteredBookings.length} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
      </div>

      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent hideCloseButton aria-describedby={undefined} className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl sm:rounded-2xl">
          <ModalHeader icon={ClipboardList} title="Post-service record" closeLabel="Close post-service record" />
          {viewBooking && <PostServiceDetails booking={viewBooking} />}
        </DialogContent>
      </Dialog>

      {selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCompletion();
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="trip-completion-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <ModalHeader
              plain
              titleId="trip-completion-title"
              icon={CheckCircle2}
              title="Trip completion"
              subtitle={[selectedBooking.bookingNo ?? '-', selectedBooking.client, selectedBooking.service].filter(Boolean).join(' · ')}
              onClose={closeCompletion}
              closeLabel="Close trip completion"
            />

            <div className="max-h-[70vh] space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Payment method</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{selectedBooking.paymentMethod || 'Not selected'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Booking amount</p>
                    <p className="mt-1 text-base font-medium text-slate-900">{formatCompletionAmount(selectedBooking.totalAmount ?? selectedBooking.amount)}</p>
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
                          onChange={() =>
                            setAdditionalMaterials((current) =>
                              selected ? current.filter((name) => name !== material.name) : [...current, material.name],
                            )
                          }
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
                    Updated total <span className="text-base font-semibold">{formatCompletionAmount(calculateUpdatedAmount())}</span>
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
                <div id="arrivalTime" className="flex flex-wrap items-center gap-2" role="group" aria-label="Arrival time">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    inputMode="numeric"
                    value={arrivalHour}
                    onChange={(event) => {
                      setArrivalHour(event.target.value);
                      updateArrivalTime(event.target.value, arrivalMinute, arrivalPeriod);
                    }}
                    placeholder="HH"
                    aria-label="Arrival hour"
                    className="h-10 w-[70px] rounded-lg border border-slate-300 bg-white px-2 text-center text-sm text-slate-900 outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20"
                  />
                  <span className="text-base font-medium text-slate-600" aria-hidden="true">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    inputMode="numeric"
                    value={arrivalMinute}
                    onChange={(event) => {
                      setArrivalMinute(event.target.value);
                      updateArrivalTime(arrivalHour, event.target.value, arrivalPeriod);
                    }}
                    placeholder="MM"
                    aria-label="Arrival minute"
                    className="h-10 w-[70px] rounded-lg border border-slate-300 bg-white px-2 text-center text-sm text-slate-900 outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20"
                  />
                  <div className="inline-flex h-10 overflow-hidden rounded-lg border border-slate-300" role="group" aria-label="AM or PM">
                    {(['AM', 'PM'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        aria-pressed={arrivalPeriod === period}
                        onClick={() => {
                          setArrivalPeriod(period);
                          updateArrivalTime(arrivalHour, arrivalMinute, period);
                        }}
                        className={arrivalPeriod === period
                          ? 'h-10 min-w-[48px] bg-[#030848] px-3 text-sm font-medium text-white'
                          : 'h-10 min-w-[48px] bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50'}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />
                  <h3 className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">Trip notes</h3>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  <input
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
                      Issue details <span className="text-red-600">*</span>
                    </label>
                    <Textarea
                      id="issueDetails"
                      value={issueDetails}
                      onChange={(event) => setIssueDetails(event.target.value)}
                      placeholder="Describe what happened during the trip..."
                      rows={3}
                      aria-invalid={Boolean(issueDetailsValidation.error)}
                      className={issueDetailsValidation.error
                        ? 'w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900 border-red-500 focus-visible:ring-red-500'
                        : 'w-full rounded-lg border-slate-300 bg-white text-sm text-slate-900'}
                    />
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <p className="text-sm text-red-600">{issueDetailsValidation.error}</p>
                      <span className={issueDetailsValidation.wordCount > COMPLETION_TEXT_MAX_WORDS ? 'text-sm font-medium text-red-600' : 'text-xs text-slate-500'}>
                        {issueDetailsValidation.wordCount} / {COMPLETION_TEXT_MAX_WORDS} words
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <label htmlFor="completionNotes" className="mb-1.5 block text-sm font-medium text-slate-700">Completion notes</label>
                  <Textarea
                    id="completionNotes"
                    value={completionNotes}
                    onChange={(event) => setCompletionNotes(event.target.value)}
                    placeholder="Add any final notes for the operations team..."
                    rows={3}
                    aria-invalid={Boolean(completionNotesValidation.error)}
                    className={completionNotesValidation.error
                      ? 'w-full rounded-lg border-slate-300 text-sm text-slate-900 border-red-500 focus-visible:ring-red-500'
                      : 'w-full rounded-lg border-slate-300 text-sm text-slate-900'}
                  />
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <p className="text-sm text-red-600">{completionNotesValidation.error}</p>
                    <span className={completionNotesValidation.wordCount > COMPLETION_TEXT_MAX_WORDS ? 'text-sm font-medium text-red-600' : 'text-xs text-slate-500'}>
                      {completionNotesValidation.wordCount} / {COMPLETION_TEXT_MAX_WORDS} words
                    </span>
                  </div>
                </div>
              </section>

              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <Info size={16} className="shrink-0" aria-hidden="true" />
                <p>Record collections separately in Daily Sales after completing the work.</p>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                onClick={closeCompletion}
                className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCompletion}
                disabled={saving}
                className="inline-flex h-10 w-fit items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#030848] px-4 text-sm font-medium text-white hover:bg-[#151b4f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : <><CheckCircle2 size={16} /> Save completion</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
