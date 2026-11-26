import ModalHeader from '../../components/ui/ModalHeader';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import PageHeader from '../../components/pageheader/Pageheader';
import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, XCircle, AlertTriangle, CheckCircle, MoreVertical, CalendarDays, Printer, Pencil, ShieldCheck, Truck, Info, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, BookingStatus } from '../../lib/types';
import StatusBadge from '../../components/shared/StatusBadge';
import TablePagination from '../../components/ui/TablePagination';
import BookingDetailsDialog from '../../components/booking/BookingDetailsDialog';
import EditBookingDialog from '../../components/booking/EditBookingDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Textarea } from '../../components/ui/Textarea';
import { DatePicker } from '../../components/ui/DatePicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/Dropdown';
import { api } from '../../lib/api';
import { normalizeBookingStatus, formatBookingAmount, downpaymentChanged, downpaymentError, downpaymentValue } from '../../lib/booking';
import { subscribeToBookingStatusUpdates } from '../../lib/booking-sync';
import WelincReviewPanel from '../../components/booking/WelincReviewPanel';
import { SearchInput, StatusFilter } from '../../components/ui/ListSearchFilters';

type BookingFilter = BookingStatus | 'All';

const STATUS_FILTERS: BookingFilter[] = ['All', 'For Plotting', 'For Verification', 'Assigned', 'Rescheduled', 'Completed', 'Cancelled'];
const STATUS_FILTER_OPTIONS = STATUS_FILTERS.map(status => ({ value: status, label: status }));

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message || err.message || fallback;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayInputValue() {
  return toDateInputValue(new Date());
}

function maxAdvanceBookingDate() {
  const max = new Date();
  max.setFullYear(max.getFullYear() + 1);
  return toDateInputValue(max);
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
  const [editTouched, setEditTouched] = useState<Set<string>>(new Set());
  const touchEdit = (key: string) => setEditTouched(previous => new Set(previous).add(key));
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [editOriginal, setEditOriginal] = useState<Booking | null>(null);
  const [savingBooking, setSavingBooking] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [discrepancyModal, setDiscrepancyModal] = useState<Booking | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [generateJO, setGenerateJO] = useState<Booking | null>(null);
  const [cancelModal, setCancelModal] = useState<Booking | null>(null);

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

  async function handleReschedule() {
    if (!rescheduleBooking || !rescheduleDate) return;
    const booking = rescheduleBooking;
    const previousDate = booking.date;
    const previousStatus = booking.status;
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, date: rescheduleDate, moveDate: rescheduleDate, status: 'Rescheduled' as BookingStatus, vehicleId: null, driverId: null, helperIds: [], garage: null, deliveryType: null } : b));
    try {
      await api.put(`/booking/${booking.id}`, { date: rescheduleDate, status: 'Rescheduled', ...(booking.version && { expectedVersion: booking.version }) });
      toast.success('Booking rescheduled', { description: `${booking.bookingNo ?? '-'} moved to ${rescheduleDate}.` });
      setRescheduleBooking(null);
      setRescheduleDate('');
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Unable to reschedule booking.');
      toast.error('Unable to reschedule booking', { description: message });
      try {
        const r = await api.get('/booking');
        setBookings(r.data);
      } catch {
        setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, date: previousDate, moveDate: previousDate, status: previousStatus } : b));
      }
    }
  }

  async function handleCancelBooking(booking: Booking) {
    const previous = booking.status;
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'Cancelled' } : b));
    setCancelModal(null);
    try {
      await api.put(`/booking/${booking.id}`, { status: 'Cancelled', ...(booking.version && { expectedVersion: booking.version }) });
      toast.success('Booking cancelled', { description: `${booking.bookingNo ?? '-'} was cancelled.` });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Unable to cancel booking.');
      toast.error('Unable to cancel booking', { description: message });
      try {
        const r = await api.get('/booking');
        setBookings(r.data);
      } catch {
        setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: previous } : b));
      }
    }
  }

  const editError = (key: string) => {
    if (!editBooking) return '';
    const value = key === 'name' ? editBooking.fullName || editBooking.client : key === 'date' ? toDateFilterValue(editBooking.date) : key === 'service' ? editBooking.service : key === 'email' ? editBooking.email : key === 'contact' ? editBooking.contact : key === 'pickup' ? editBooking.pickupAddress : key === 'delivery' ? editBooking.deliveryAddress || editBooking.address : key === 'items' ? editBooking.itemDetails : key === 'status' ? editBooking.status : '';
    if (['name', 'service', 'date', 'email', 'contact', 'pickup', 'delivery', 'items'].includes(key) && !value?.trim()) return 'This field is required.';
    if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'The email address entered is invalid';
    if (key === 'contact' && value && !/^(?:\+63|0)9\d{9}$/.test(value)) return 'Enter a valid Philippine mobile number.';
    if (key === 'downpayment') return downpaymentError(editBooking);
    return '';
  };
  const hasEditBookingChanges = Boolean(editBooking && editOriginal && (
    editBooking.client !== editOriginal.client
    || (editBooking.fullName || editBooking.client) !== (editOriginal.fullName || editOriginal.client)
    || (editBooking.contact || undefined) !== (editOriginal.contact || undefined)
    || (editBooking.email || undefined) !== (editOriginal.email || undefined)
    || editBooking.service !== editOriginal.service
    || toDateFilterValue(editBooking.date) !== toDateFilterValue(editOriginal.date)
    || (editBooking.address || editBooking.deliveryAddress || undefined) !== (editOriginal.address || editOriginal.deliveryAddress || undefined)
    || (editBooking.pickupAddress || undefined) !== (editOriginal.pickupAddress || undefined)
    || (editBooking.deliveryAddress || undefined) !== (editOriginal.deliveryAddress || undefined)
    || (editBooking.itemDetails || undefined) !== (editOriginal.itemDetails || undefined)
    || (editBooking.specialInstructions || undefined) !== (editOriginal.specialInstructions || undefined)
    || Boolean(editBooking.permitRequired) !== Boolean(editOriginal.permitRequired)
    || downpaymentChanged(editBooking, editOriginal)
  ));

  async function handleUpdateBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editBooking || savingBooking) return;
    setEditTouched(new Set(['name', 'service', 'date', 'email', 'contact', 'pickup', 'delivery', 'items', 'downpayment']));
    if (['name', 'service', 'date', 'email', 'contact', 'pickup', 'delivery', 'items', 'downpayment'].some(key => editError(key))) return;

    setSavingBooking(true);
    const id = editBooking.id;
    const payload = {
      ...(editBooking.version && { expectedVersion: editBooking.version }),
      client: editBooking.client,
      fullName: editBooking.fullName || editBooking.client,
      contact: editBooking.contact || undefined,
      email: editBooking.email || undefined,
      service: editBooking.service,
      date: toDateFilterValue(editBooking.date),
      address: editBooking.address || editBooking.deliveryAddress || undefined,
      pickupAddress: editBooking.pickupAddress || undefined,
      deliveryAddress: editBooking.deliveryAddress || undefined,
      itemDetails: editBooking.itemDetails || undefined,
      specialInstructions: editBooking.specialInstructions || undefined,
      permitRequired: Boolean(editBooking.permitRequired),
      ...(downpaymentChanged(editBooking, editOriginal ?? editBooking) && { downpayment: downpaymentValue(editBooking) }),
    };
    try {
      const response = await api.put<Booking>(`/booking/${id}`, payload);
      const updatedBooking = response.data;
      setBookings(prev => prev.map(booking => booking.id === id ? updatedBooking : booking));
      setViewBooking(prev => prev?.id === id ? updatedBooking : prev);
      setEditBooking(null);
      setEditOriginal(null);
      toast.success('A booking was updated successfully.');
      api.get<Booking[]>('/booking').then(response => setBookings(response.data ?? [])).catch(() => {});
    } catch (error: unknown) {
      toast.error('Unable to update booking', { description: getApiErrorMessage(error, 'Please try again.') });
    } finally {
      setSavingBooking(false);
    }
  }

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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button aria-label="Row actions" className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-900 transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-auto min-w-0 bg-white border border-slate-200 shadow-lg"
                      >
                        <DropdownMenuItem onClick={() => setViewBooking(b)} className="cursor-pointer flex items-center gap-2 text-slate-700 text-sm">
                          <Eye size={14} /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditTouched(new Set()); setEditOriginal({ ...b }); setEditBooking({ ...b }); }} className="cursor-pointer flex items-center gap-2 text-slate-700 text-sm">
                          <Pencil size={14} /> Edit
                        </DropdownMenuItem>
                        {normalizeBookingStatus(b.status) !== 'Cancelled' && (
                          <DropdownMenuItem onClick={() => { setRescheduleBooking(b); setRescheduleDate(b.date); }} className="cursor-pointer flex items-center gap-2 text-slate-700 text-sm">
                            <CalendarDays size={14} /> Reschedule
                          </DropdownMenuItem>
                        )}
                        {normalizeBookingStatus(b.status) !== 'Cancelled' && (
                          <DropdownMenuItem onClick={() => setCancelModal(b)} className="cursor-pointer flex items-center gap-2 text-red-600 text-sm focus:bg-[#fff1f1] focus:text-red-600">
                            <XCircle size={14} /> Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      <EditBookingDialog
        booking={editBooking}
        onChange={update => setEditBooking(prev => prev ? update(prev) : prev)}
        touched={editTouched}
        onTouch={touchEdit}
        getError={editError}
        dateValue={editBooking ? toDateFilterValue(editBooking.date) : ''}
        canEditDate={true}
        saving={savingBooking}
        canSubmit={hasEditBookingChanges}
        onSubmit={handleUpdateBooking}
        onClose={() => { setEditBooking(null); setEditOriginal(null); }}
      />

      {/* ─── Reschedule Modal ─── */}
      <Dialog open={!!rescheduleBooking} onOpenChange={open => { if (!open) { setRescheduleBooking(null); setRescheduleDate(''); } }}>
        <DialogContent hideCloseButton className="gap-0 w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border-0 bg-transparent p-0 shadow-xl">
          <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white">
            <ModalHeader title="Reschedule booking" subtitle={rescheduleBooking?.bookingNo ?? '—'} closeLabel="Close reschedule booking" />

            <div className="space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                <Info size={16} className="shrink-0" aria-hidden="true" />
                <p>Only the booking date can be changed.</p>
              </div>

              <section className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200/70 bg-white p-4">
                <div>
                  <p className="text-sm text-slate-600">Client</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{rescheduleBooking?.client ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Current date</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{rescheduleBooking?.date ? new Date(`${toDateFilterValue(rescheduleBooking.date)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <label id="reschedule-date-label" htmlFor="admin-reschedule-date" className="mb-2 block text-sm font-medium text-slate-700">New date</label>
                <DatePicker
                  id="admin-reschedule-date"
                  popover
                  required
                  ariaLabelledBy="reschedule-date-label"
                  className="[&>button]:!h-[42px] [&>button]:!rounded-lg [&>button]:!border-slate-300 [&>button]:!bg-white [&>button]:!px-3 [&>button]:!text-sm [&>button]:!text-slate-900 [&>button]:focus:!border-[#1a1f6e] [&>button]:focus:!ring-2 [&>button]:focus:!ring-[#1a1f6e]/20"
                  value={rescheduleDate}
                  onChange={setRescheduleDate}
                  min={todayInputValue()}
                  max={maxAdvanceBookingDate()}
                  placement="top"
                  placeholder="Select a new date"
                />
              </section>
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
              <button type="button" onClick={() => { setRescheduleBooking(null); setRescheduleDate(''); }} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReschedule}
                disabled={!rescheduleDate || rescheduleDate === toDateFilterValue(rescheduleBooking?.date)}
                className="inline-flex h-10 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#030848] px-4 text-sm font-medium text-white hover:bg-[#141a6b] disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <CalendarDays size={16} aria-hidden="true" /> Save date
              </button>
            </footer>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirmation Modal ─── */}
      <Dialog open={!!cancelModal} onOpenChange={open => { if (!open) setCancelModal(null); }}>
        <DialogContent hideCloseButton className="max-w-sm bg-white text-slate-800 border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={18} /> Cancel Booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel booking <strong>{cancelModal?.bookingNo ?? '-'}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCancelModal(null)} className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-semibold">
                Cancel
              </button>
              <button onClick={() => cancelModal && handleCancelBooking(cancelModal)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">
                Confirm Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
