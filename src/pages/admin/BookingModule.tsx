import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Eye, Flag, XCircle, AlertTriangle, CheckCircle, Printer, FileText, Plus } from 'lucide-react';
import type { Booking, BookingStatus } from '../../lib/types';
import StatusBadge from '../../components/shared/StatusBadge';
import KPICard from '../../components/shared/KpiCard';
import NewBookingWizard from '../../components/booking/NewBookingWizard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';

type BookingFilter = BookingStatus | 'All';

const STATUS_FILTERS: BookingFilter[] = ['All', 'For Plotting', 'Confirmed', 'Scheduled', 'Completed', 'Cancelled', 'Discrepancy'];
// service/payment lists removed - data comes from backend when needed

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<BookingFilter>('All');
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [editStatus, setEditStatus] = useState<BookingStatus | ''>('');
  const [discrepancyModal, setDiscrepancyModal] = useState<Booking | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [generateJO, setGenerateJO] = useState<Booking | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const normalizeStatus = (status: string): BookingStatus =>
    status === 'For Correction' ? 'Discrepancy' : status as BookingStatus;

  const filtered = bookings.filter(b => {
    const targetId = (b.bookingId ?? b.id).toString();
    const displayedStatus = normalizeStatus(b.status);
    const matchSearch = targetId.toLowerCase().includes(search.toLowerCase()) || b.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' ? true : displayedStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const kpis = [
    { label: 'Total Bookings', value: bookings.length, color: '#1a1f6e' },
    { label: 'For Plotting', value: bookings.filter(b => b.status === 'For Plotting').length, color: '#f59e0b' },
    { label: 'Scheduled', value: bookings.filter(b => b.status === 'Scheduled').length, color: '#6366f1' },
    { label: 'Completed', value: bookings.filter(b => b.status === 'Completed').length, color: '#10b981' },
    { label: 'Discrepancy', value: bookings.filter(b => normalizeStatus(b.status) === 'Discrepancy').length, color: '#ef4444' },
    { label: 'Cancelled', value: bookings.filter(b => b.status === 'Cancelled').length, color: '#94a3b8' },
  ];

  function handleUpdateStatus() {
    if (!viewBooking || !editStatus) return;
    // Optimistic update + persist
    setBookings(prev => prev.map(b => b.id === viewBooking.id ? { ...b, status: editStatus as BookingStatus } : b));
    api.put(`/booking/${viewBooking.id}`, { status: editStatus }).catch(() => {
      // revert on failure by refetching
      api.get('/booking').then((r) => setBookings(r.data)).catch(() => {});
    });
    setViewBooking(null);
    setEditStatus('');
  }

  function handleFlagDiscrepancy() {
    if (!discrepancyModal || !discrepancyNote.trim()) return;
    setBookings(prev => prev.map(b =>
      b.id === discrepancyModal.id
        ? { ...b, status: 'Discrepancy' as BookingStatus, discrepancyNote: discrepancyNote.trim(), flagged: true }
        : b
    ));
    api.put(`/booking/${discrepancyModal.id}`, { status: 'Discrepancy', discrepancyNote: discrepancyNote.trim(), flagged: true })
      .catch(() => api.get('/booking').then((r) => setBookings(r.data)).catch(() => {}));
    setDiscrepancyModal(null);
    setDiscrepancyNote('');
  }

  function handleGenerateJO(booking: Booking) {
    setGenerateJO(booking);
  }

  async function handleNewBooking(booking: Booking) {
    // Persist booking to backend then refresh the bookings list to ensure persistence
    try {
      const payload = {
        client: booking.client,
        service: booking.service,
        date: booking.date,
        pickupAddress: booking.pickupAddress,
        deliveryAddress: booking.deliveryAddress,
        amount: booking.amount,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus ?? 'Pending',
        paymentMethod: booking.paymentMethod,
        status: booking.status ?? 'For Plotting',
      };
      await api.post('/booking', payload);
      // refetch authoritative list from server
      const r = await api.get('/booking');
      setBookings(r.data);
    } catch (err) {
      console.error('Failed to create booking', err);
      // optionally refetch to ensure UI stays in sync
      try { const r = await api.get('/booking'); setBookings(r.data); } catch (_) {}
    }
  }

  useEffect(() => {
    const status = searchParams.get('status');
    const validFilters: BookingFilter[] = ['All', 'For Plotting', 'Confirmed', 'Scheduled', 'Completed', 'Cancelled', 'Discrepancy'];
    if (status && validFilters.includes(status as BookingFilter)) {
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
    api.get('/booking')
      .then((r) => {
        if (mounted) setBookings(r.data);
      })
      .catch(() => {
        // ignore for now
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">Booking Management</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">View and manage all customer bookings</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1f6e] text-white rounded-xl font-bold text-sm hover:bg-[#151b4f] transition-colors cursor-pointer shadow-md"
        >
          <Plus size={16} /> New Booking
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <KPICard key={k.label} label={k.label} value={String(k.value)} iconColor={k.color} />
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100 dark:border-gray-800">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search booking ID or client..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/20 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => handleStatusFilterClick(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${statusFilter === s ? 'bg-[#1a1f6e] text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-200'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-800">
                {['Booking ID', 'Client', 'Service', 'Date', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-[#1a1f6e] dark:text-indigo-400 uppercase tracking-wider">{b.bookingId ?? b.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-white">{b.client}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 truncate max-w-[160px]">{b.address ?? b.deliveryAddress ?? b.pickupAddress ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300 whitespace-nowrap">{b.service}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-300 whitespace-nowrap">{b.date}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">{b.amount ? `₱${Number(b.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={normalizeStatus(b.status)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setViewBooking(b); setEditStatus(normalizeStatus(b.status)); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 hover:text-[#1a1f6e] cursor-pointer transition-colors" title="View Details">
                        <Eye size={14} />
                      </button>
                      {normalizeStatus(b.status) !== 'Cancelled' && normalizeStatus(b.status) !== 'Discrepancy' && (
                        <button onClick={() => setDiscrepancyModal(b)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-500 hover:text-rose-600 cursor-pointer transition-colors" title="Flag Discrepancy">
                          <Flag size={14} />
                        </button>
                      )}
                      {(b.status === 'Scheduled' || b.status === 'Confirmed') && (
                        <button onClick={() => handleGenerateJO(b)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-500 hover:text-emerald-600 cursor-pointer transition-colors" title="Generate Job Order">
                          <FileText size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 dark:text-gray-500">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 dark:border-gray-800 text-xs text-slate-500 dark:text-gray-400">
          Showing {filtered.length} of {bookings.length} bookings
        </div>
      </div>

      {/* ─── Booking Details Modal ─── */}
      <Dialog open={!!viewBooking} onOpenChange={open => { if (!open) { setViewBooking(null); setEditStatus(''); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-slate-800 border border-slate-200 dark:bg-white dark:text-slate-800 dark:border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-[#1a1f6e] dark:text-indigo-400">{viewBooking?.bookingId ?? viewBooking?.id}</span>
              {viewBooking && <StatusBadge status={viewBooking.status} />}
            </DialogTitle>
          </DialogHeader>

          {viewBooking && (
            <div className="space-y-5 text-sm">
              {viewBooking.discrepancyNote && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
                  <AlertTriangle size={15} className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-700 dark:text-rose-400 text-xs uppercase tracking-wide">Discrepancy Note</p>
                    <p className="text-rose-700 dark:text-rose-300 mt-0.5">{viewBooking.discrepancyNote}</p>
                  </div>
                </div>
              )}

              {/* Section: Personal Information */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 pb-1 border-b dark:border-gray-700">Personal Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Full Name" value={viewBooking.fullName || viewBooking.client} />
                  <InfoRow label="Delivery Location" value={viewBooking.deliveryLocation || '—'} />
                  <InfoRow label="Pick-up Address" value={viewBooking.pickupAddress || '—'} />
                  <InfoRow label="Delivery Address" value={viewBooking.deliveryAddress || viewBooking.address} />
                </div>
              </section>

              {/* Section: Schedule */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 pb-1 border-b dark:border-gray-700">Schedule</h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Move Date" value={viewBooking.moveDate || viewBooking.date} />
                  <InfoRow label="Preferred Time" value={viewBooking.preferredTime || '—'} />
                </div>
              </section>

              {/* Section: Items & Services */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 pb-1 border-b dark:border-gray-700">Items & Services</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <InfoRow label="Est. Number of Items" value={viewBooking.estimatedItems != null ? String(viewBooking.estimatedItems) : '—'} />
                  <InfoRow label="Service Type" value={viewBooking.service} />
                </div>
                {viewBooking.itemDetails && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Item Details</p>
                    <p className="text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-800 rounded-lg px-3 py-2">{viewBooking.itemDetails}</p>
                  </div>
                )}
                {viewBooking.specialInstructions && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Special Instructions / Details</p>
                    <p className="text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-800 rounded-lg px-3 py-2">{viewBooking.specialInstructions}</p>
                  </div>
                )}
              </section>

              {/* Section: Services Availed */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 pb-1 border-b dark:border-gray-700">Services Availed</h4>
                {viewBooking.servicesAvailed && viewBooking.servicesAvailed.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {viewBooking.servicesAvailed.map(s => (
                      <Badge key={s} variant="secondary" className="bg-[#1a1f6e]/10 text-[#1a1f6e] dark:bg-indigo-900/30 dark:text-indigo-300 border-0">{s}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-gray-500 text-xs italic">No special services selected</p>
                )}
              </section>

              {/* Section: Additional Services */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 pb-1 border-b dark:border-gray-700">Additional Services Availed</h4>
                {viewBooking.additionalServicesAvailed && viewBooking.additionalServicesAvailed.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b dark:border-gray-700">
                        <th className="pb-1.5 text-left font-semibold text-slate-500 dark:text-gray-400">Service</th>
                        <th className="pb-1.5 text-right font-semibold text-slate-500 dark:text-gray-400">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                      {viewBooking.additionalServicesAvailed.map((svc, i) => (
                        <tr key={i}>
                          <td className="py-1.5 text-slate-700 dark:text-gray-200">{svc.name}</td>
                          <td className="py-1.5 text-right font-semibold text-slate-800 dark:text-white">{svc.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-slate-400 dark:text-gray-500 text-xs italic">No additional services selected</p>
                )}
              </section>

              {/* Section: Insurance & Payment */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 pb-1 border-b dark:border-gray-700">Insurance & Payment</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">Goods in Transit Insurance</p>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${viewBooking.hasInsurance ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {viewBooking.hasInsurance ? <><CheckCircle size={12} /> Availed</> : <><XCircle size={12} /> Not Availed</>}
                    </div>
                  </div>
                  <InfoRow label="Payment Method" value={viewBooking.paymentMethod || '—'} />
                  <InfoRow label="Total Amount" value={viewBooking.totalAmount || viewBooking.amount} />
                  <InfoRow label="Payment Status" value={viewBooking.paymentStatus || '—'} />
                </div>
              </section>

              {/* Status Update */}
              <section className="pt-2 border-t dark:border-gray-700">
                {viewBooking?.status === 'Cancelled' ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 flex-1">
                      <AlertTriangle size={14} className="text-slate-500 flex-shrink-0" />
                      <p className="text-xs text-slate-600 dark:text-gray-400">This booking is <strong>Cancelled</strong> and cannot be modified.</p>
                    </div>
                    <button onClick={() => { setViewBooking(null); setEditStatus(''); }} className="px-4 py-2 text-sm bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-slate-200 whitespace-nowrap cursor-pointer transition-colors">
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 dark:text-gray-400 block mb-1.5">Update Status</label>
                      <Select value={editStatus} onValueChange={v => setEditStatus(v as BookingStatus)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {['For Plotting', 'Confirmed', 'Scheduled', 'Completed', 'Discrepancy', 'Cancelled'].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <button onClick={handleUpdateStatus} disabled={!editStatus || editStatus === viewBooking?.status} className="self-end px-4 py-2 text-sm bg-[#1a1f6e] text-white rounded-lg hover:bg-[#151b4f] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer transition-colors">
                      Update Status
                    </button>
                    <button onClick={() => { setViewBooking(null); setEditStatus(''); }} className="self-end px-4 py-2 text-sm bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-slate-200 whitespace-nowrap cursor-pointer transition-colors">
                      Close
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Flag Discrepancy Modal ─── */}
      <Dialog open={!!discrepancyModal} onOpenChange={open => { if (!open) { setDiscrepancyModal(null); setDiscrepancyNote(''); } }}>
        <DialogContent className="max-w-md bg-white text-slate-800 border border-slate-200 dark:bg-white dark:text-slate-800 dark:border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle size={18} /> Report Discrepancy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
              This will flag booking <strong>{discrepancyModal?.bookingId ?? discrepancyModal?.id}</strong> as <strong>"Discrepancy"</strong> and notify the client to correct or complete the missing details before the booking can proceed.
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-gray-300 block mb-1.5">Discrepancy Note <span className="text-red-500">*</span></label>
              <Textarea
                value={discrepancyNote}
                onChange={e => setDiscrepancyNote(e.target.value)}
                placeholder="Describe the specific discrepancy or missing information..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDiscrepancyModal(null); setDiscrepancyNote(''); }} className="px-4 py-2 text-sm bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-slate-200 whitespace-nowrap cursor-pointer">
                Cancel
              </button>
              <button onClick={handleFlagDiscrepancy} disabled={!discrepancyNote.trim()} className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer">
                Report & Return to Client
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Generate JO Modal ─── */}
      <Dialog open={!!generateJO} onOpenChange={open => { if (!open) setGenerateJO(null); }}>
        <DialogContent className="max-w-sm bg-white text-slate-800 border border-slate-200 dark:bg-white dark:text-slate-800 dark:border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer size={18} className="text-[#1a1f6e]" /> Generate Job Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-gray-300">
              Generate a Job Order document for <strong>{generateJO?.client}</strong> ({generateJO?.bookingId ?? generateJO?.id})?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGenerateJO(null)} className="px-4 py-2 text-sm bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-slate-200 whitespace-nowrap cursor-pointer">
                Cancel
              </button>
              <button onClick={() => setGenerateJO(null)} className="px-4 py-2 text-sm bg-[#1a1f6e] text-white rounded-lg hover:bg-[#151b4f] whitespace-nowrap cursor-pointer">
                Generate
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── New Booking Wizard ─── */}
      <NewBookingWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onConfirm={handleNewBooking}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="text-slate-800 dark:text-white font-medium">{value || '—'}</p>
    </div>
  );
}