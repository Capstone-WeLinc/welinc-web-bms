import DateRangeFilter from '../../components/ui/DateRangeFilter';
import PageHeader from '../../components/pageheader/Pageheader';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, XCircle, AlertTriangle, CheckCircle, CalendarDays, Printer, ShieldCheck, Truck, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, BookingStatus } from '../../lib/types';
import StatusBadge from '../../components/shared/StatusBadge';
import TablePagination from '../../components/ui/TablePagination';
import BookingDetailsDialog from '../../components/booking/BookingDetailsDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Textarea } from '../../components/ui/Textarea';
import { api } from '../../lib/api';
import { normalizeBookingStatus, formatBookingAmount } from '../../lib/booking';
import { subscribeToBookingStatusUpdates } from '../../lib/booking-sync';
import WelincReviewPanel from '../../components/booking/WelincReviewPanel';
import { SearchInput, StatusFilter } from '../../components/ui/ListSearchFilters';

type BookingFilter = BookingStatus | 'All';

const STATUS_FILTERS: BookingFilter[] = ['All', 'For Plotting', 'For Verification', 'Assigned', 'Rescheduled', 'Completed', 'Cancelled'];
const STATUS_FILTER_OPTIONS = STATUS_FILTERS.map(status => ({ value: status, label: status }));

/** The one-action button style used in table rows (same as Scheduling, spec bms/0016). */
const SINGLE_ACTION_CLASS = 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30';

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateFilterValue(value?: string | null) {
  if (!value) return '';
  const isoDate = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoDate) return isoDate[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toDateInputValue(date);
}

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<BookingFilter>('All');
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [discrepancyModal, setDiscrepancyModal] = useState<Booking | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [generateJO, setGenerateJO] = useState<Booking | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const filtered = bookings.filter(b => {
    const targetId = (b.bookingNo ?? '').toString();
    const displayedStatus = normalizeBookingStatus(b.status);
    const bookingDate = toDateFilterValue(b.date);
    const matchSearch = targetId.toLowerCase().includes(search.toLowerCase()) || b.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' ? true : displayedStatus === statusFilter;
    const matchDateRange = (!dateFrom && !dateTo) || (
      Boolean(bookingDate) &&
      (!dateFrom || bookingDate >= dateFrom) &&
      (!dateTo || bookingDate <= dateTo)
    );
    return matchSearch && matchStatus && matchDateRange;
  });


  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const kpis = [
    { label: 'For Plotting', value: bookings.filter(b => normalizeBookingStatus(b.status) === 'For Plotting').length, color: '#f59e0b', icon: CalendarDays },
    { label: 'Assigned', value: bookings.filter(b => normalizeBookingStatus(b.status) === 'Assigned').length, color: '#6366f1', icon: Clock3 },
    { label: 'For Verification', value: bookings.filter(b => normalizeBookingStatus(b.status) === 'For Verification').length, color: '#8b5cf6', icon: ShieldCheck },
    { label: 'Rescheduled', value: bookings.filter(b => normalizeBookingStatus(b.status) === 'Rescheduled').length, color: '#06b6d4', icon: CalendarDays },
    { label: 'Completed', value: bookings.filter(b => normalizeBookingStatus(b.status) === 'Completed').length, color: '#10b981', icon: CheckCircle },
    { label: 'Cancelled', value: bookings.filter(b => normalizeBookingStatus(b.status) === 'Cancelled').length, color: '#94a3b8', icon: XCircle },
  ];

  function handleFlagDiscrepancy() {
    if (!discrepancyModal || !discrepancyNote.trim()) return;
    setBookings(prev => prev.map(b =>
      b.id === discrepancyModal.id
        ? { ...b, status: 'For Plotting' as BookingStatus, discrepancyNote: discrepancyNote.trim(), flagged: true }
        : b
    ));
    api.put(`/booking/${discrepancyModal.id}`, { status: 'For Plotting', discrepancyNote: discrepancyNote.trim(), flagged: true, ...(discrepancyModal.version && { expectedVersion: discrepancyModal.version }) })
      .catch(() => api.get('/booking').then((r) => setBookings(r.data)).catch(() => {}));
    setDiscrepancyModal(null);
    setDiscrepancyNote('');
    toast.success('Booking flagged', { description: `${discrepancyModal.bookingNo ?? '-'} was returned to client for correction.` });
  }

  useEffect(() => {
    const status = searchParams.get('status');
    if (status && STATUS_FILTERS.includes(status as BookingFilter)) {
      setStatusFilter(status as BookingFilter);
    } else {
      setStatusFilter('All');
    }
  }, [searchParams]);

  function handleStatusFilterClick(status: BookingFilter) {
    setStatusFilter(status);
    if (status === 'All') {
      setSearchParams({});
    } else {
      setSearchParams({ status });
    }
  }

  useEffect(() => {
    let mounted = true;
    const refreshBookings = () => {
      api.get<Booking[]>('/booking')
        .then((response) => {
          if (mounted) setBookings(response.data ?? []);
        })
        .catch(() => {});
    };
    refreshBookings();
    const unsubscribe = subscribeToBookingStatusUpdates(refreshBookings);
    window.addEventListener('focus', refreshBookings);
    const refreshId = window.setInterval(refreshBookings, 5000);
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('focus', refreshBookings);
      window.clearInterval(refreshId);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <PageHeader
        icon={Truck}
        title="BOOKING"
        subtitle={<>View and manage all customer <span className="font-medium text-[#d4a72c]">bookings</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onClear={() => { setDateFrom(''); setDateTo(''); }} />
        </div>}
      />

      <WelincReviewPanel />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="flex min-h-[96px] min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18`, color }}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-5 text-slate-700">{label}</p>
              <p className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-[#0b0f4a]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-b-0 border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <SearchInput value={search} onChange={setSearch} placeholder="Search booking no. or client..." />
        <StatusFilter options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={handleStatusFilterClick} />
      </div>

      {/* Table Card */}
      <div className="!mt-0 rounded-none border border-slate-200 bg-white overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full table-auto font-sans text-sm">
            <thead>
              <tr className="bg-[#1a1f6e]">
                {['Booking No.', 'Client', 'Service', 'Date', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-white uppercase tracking-wide ${['Booking No.', 'Date', 'Amount', 'Actions'].includes(h) ? 'w-px whitespace-nowrap' : h === 'Service' ? 'whitespace-nowrap' : ''} ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(b => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="w-px whitespace-nowrap px-4 py-2.5 pr-6 align-middle">
                    <span className="whitespace-nowrap text-sm font-medium tabular-nums text-slate-900">{b.bookingNo ?? '-'}</span>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <p className="truncate text-sm font-medium leading-tight text-slate-900">{b.client}</p>
                    <p className="max-w-[360px] truncate text-sm leading-tight text-slate-500" title={b.address ?? b.deliveryAddress ?? b.pickupAddress ?? '?'}>{b.address ?? b.deliveryAddress ?? b.pickupAddress ?? '?'}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 align-middle text-sm text-slate-900">{b.service}</td>
                  <td className="w-px whitespace-nowrap px-4 py-2.5 align-middle text-sm text-slate-900 tabular-nums">{b.date}</td>
                  <td className="w-px whitespace-nowrap px-4 py-2.5 align-middle text-right text-sm font-medium text-slate-900 tabular-nums">{formatBookingAmount(b.amount)}</td>
                  <td className="px-4 py-2.5 align-middle text-sm">
                    <StatusBadge status={normalizeBookingStatus(b.status)} size="xs" variant="outline" />
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-2.5 align-middle text-sm">
                    {/* Admin only views bookings here (spec bms/0021); one action, so no ⋮ menu (spec bms/0016) */}
                    <button type="button" onClick={() => setViewBooking(b)} aria-label={`View ${b.bookingNo ?? 'booking'}`} title="View" className={SINGLE_ACTION_CLASS}>
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">No bookings found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <TablePagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
      </div>

      <BookingDetailsDialog booking={viewBooking} onClose={() => setViewBooking(null)} />

      {/* ─── Flag Discrepancy Modal ─── */}
      <Dialog open={!!discrepancyModal} onOpenChange={open => { if (!open) { setDiscrepancyModal(null); setDiscrepancyNote(''); } }}>
        <DialogContent className="max-w-md bg-white text-slate-800 border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle size={18} /> Report Discrepancy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-sm text-rose-700">
              This will flag booking <strong>{discrepancyModal?.bookingNo ?? '-'}</strong> as <strong>"For Plotting"</strong> and notify the client to correct or complete the missing details before the booking can proceed.
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">Discrepancy Note <span className="text-red-500">*</span></label>
              <Textarea
                value={discrepancyNote}
                onChange={e => setDiscrepancyNote(e.target.value)}
                placeholder="Describe the specific discrepancy or missing information..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDiscrepancyModal(null); setDiscrepancyNote(''); }} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-semibold">
                Cancel
              </button>
              <button onClick={handleFlagDiscrepancy} disabled={!discrepancyNote.trim()} className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold">
                Report & Return to Client
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Generate JO Modal ─── */}
      <Dialog open={!!generateJO} onOpenChange={open => { if (!open) setGenerateJO(null); }}>
        <DialogContent className="max-w-sm bg-white text-slate-800 border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer size={18} className="text-[#0a0f2e]" /> Generate Job Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Generate a Job Order document for <strong>{generateJO?.client}</strong> ({generateJO?.bookingNo ?? '-'})?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGenerateJO(null)} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-semibold">
                Cancel
              </button>
              <button onClick={() => setGenerateJO(null)} className="px-4 py-2 text-sm bg-[#030848] text-white rounded-lg hover:bg-[#151b4f] font-semibold">
                Generate
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
