import ModalHeader from '../../components/ui/ModalHeader';
import TotalRow from '../../components/shared/TotalRow';
import TablePagination from '../../components/ui/TablePagination';
import PageHeader from '../../components/pageheader/Pageheader';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Search,
  Plus,
  MoreVertical,
  Eye,
  Download,
  ClipboardList,
  ChevronDown,
  FileSpreadsheet,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import { BookingCostSummary, buildCostLines, loadMaterialPrices } from '../../components/booking/CostSummary';
import { toast } from 'sonner';
import { exportReportExcel } from '../../lib/documents/reportExport';
import { useApp } from '../../contexts/AppContext';
import { buildJobOrderPdf, deduplicateAddress, formatJobOrderDate, formatJobOrderTime, loadJobOrderLogo } from '../../lib/documents/jobOrderDocument';
import { api } from '../../lib/api';
import { formatPhoneLocal } from '../../lib/phone';
import { createJobOrder, getJobOrders } from '../../lib/job-order';
import type { JobOrder, ScheduleEntry, Booking } from '../../lib/types';
import StatusBadge from '../../components/shared/StatusBadge';
import KPICard from '../../components/shared/KpiCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/Dropdown';


function toPesoString(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '₱0.00';
  const num = typeof n === 'string' ? Number(n.replace(/[^0-9.-]/g, '')) : n;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(item => String(item)).filter(Boolean);
    } catch {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function isUnprocessedPaymentStatus(status?: string | null): boolean {
  const normalized = status?.trim().toLowerCase();
  return !normalized || ['pending', 'unknown', 'unclassified', 'not classified', 'unprocessed', 'not processed'].includes(normalized);
}

const looksLikeRecordId = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? '').trim());
const collapseSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

function normalizeJobOrderStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'distributed') return 'Distributed';
  if (normalized === 'assigned') return 'Assigned';
  return 'Pending';
}

export default function OperationsJobOrder({ showKpis = false }: { showKpis?: boolean }) {
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [helpers, setHelpers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Distributed'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [viewJobOrder, setViewJobOrder] = useState<JobOrder | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      getJobOrders(),
      api.get<ScheduleEntry[]>('/job-order/assigned-bookings'),
      api.get<Booking[]>('/booking'),
      api.get<any[]>('/bms/config/vehicles'),
      api.get<any[]>('/bms/config/drivers'),
      api.get<any[]>('/bms/config/helpers'),
    ])
      .then(([jobOrders, sRes, bRes, vRes, dRes, hRes]) => {
        if (mounted) {
          setJobOrders(jobOrders);
          setSchedules(sRes.data ?? []);
          setBookings(bRes.data ?? []);
          setVehicles(vRes.data ?? []);
          setDrivers(dRes.data ?? []);
          setHelpers(hRes.data ?? []);
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load job orders');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const refresh = async () => {
    setJobOrders(await getJobOrders());
  };

  const filtered = useMemo(() => {
    return jobOrders.filter((jo) => {
      const q = search.toLowerCase();
      const matchSearch = (jo.jobOrderNo || jo.id).toLowerCase().includes(q) || jo.client.toLowerCase().includes(q) || (jo.bookingNo ?? '').toLowerCase().includes(q);
      const jobStatus = normalizeJobOrderStatus(String(jo.status || '')).toLowerCase();
      const matchStatus = statusFilter === 'All'
        ? true
        : jobStatus === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [jobOrders, search, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, safePage, rowsPerPage]);

  const availableSchedules = useMemo(() => {
    const existingBookingIds = new Set(jobOrders.map((jo) => jo.bookingId));
    return schedules.filter((s) => s.status === 'Assigned' && !existingBookingIds.has(s.bookingId));
  }, [schedules, jobOrders]);

  function getScheduleForJobOrder(jobOrder: JobOrder) {
    return schedules.find(schedule => schedule.bookingId === jobOrder.bookingId);
  }

  function getBookingForJobOrder(jobOrder: JobOrder) {
    return bookings.find(booking => booking.bookingId === jobOrder.bookingId || booking.id === jobOrder.bookingId);
  }

  function getVehicleLabel(schedule?: ScheduleEntry) {
    const scheduleData = schedule as ScheduleEntry & Record<string, any>;
    const assignedVehicle = scheduleData?.vehicle || scheduleData?.assignedVehicle;
    if (!schedule?.vehicleId && !assignedVehicle) return '-';
    const vehicle = vehicles.find(item => item.id === schedule?.vehicleId);
    if (vehicle) return `${vehicle.plateNumber || vehicle.plate || schedule.vehicleId} — ${vehicle.alias || vehicle.model || ''}`;
    if (assignedVehicle) return `${assignedVehicle.plateNumber || assignedVehicle.plate || schedule?.vehicleId || '-'} — ${assignedVehicle.alias || assignedVehicle.model || ''}`;
    return String(schedule?.vehicleId || '-');
  }

  function getDriverLabel(schedule?: ScheduleEntry) {
    const scheduleData = schedule as ScheduleEntry & Record<string, any>;
    const assignedDriver = scheduleData?.assignedDriver || scheduleData?.driver;
    if (!schedule?.driverId && !assignedDriver) return '-';
    const driver = drivers.find(item => item.id === schedule?.driverId || item.empId === schedule?.driverId);
    return driver?.fullName || driver?.name || assignedDriver?.fullName || assignedDriver?.name || String(schedule?.driverId || '-');
  }

  function getJobOrderDetails(jobOrder: JobOrder) {
    const schedule = getScheduleForJobOrder(jobOrder);
    const booking = getBookingForJobOrder(jobOrder);
    const jobOrderData = jobOrder as JobOrder & Record<string, any>;
    const scheduleData = schedule as (ScheduleEntry & Record<string, any>) | undefined;
    const assignedVehicle = scheduleData?.vehicle || scheduleData?.assignedVehicle || jobOrderData.vehicle || jobOrderData.assignedVehicle;
    const vehicle = schedule?.vehicleId ? vehicles.find(item => item.id === schedule.vehicleId) : undefined;
    const assignedDriver = scheduleData?.assignedDriver || scheduleData?.driver || jobOrderData.assignedDriver || jobOrderData.driver;
    const assignedHelpers = Array.isArray(scheduleData?.assignedHelpers) ? scheduleData.assignedHelpers : Array.isArray(jobOrderData.helpers) ? jobOrderData.helpers : [];
    const helperIds = toTextList(schedule?.helperIds || jobOrderData.helperIds);
    const helperNames = helperIds.map(id => {
      const helper = assignedHelpers.find((item: any) => item.id === id || item.empId === id)
        || helpers.find((item: any) => item.id === id || item.empId === id);
      return helper?.fullName || helper?.name || (looksLikeRecordId(id) ? 'Name unavailable' : id);
    });
    const vehicleRecord = vehicle || assignedVehicle;
    const savedTruck = String(jobOrder.truck ?? '').trim();
    const vehiclePlate = vehicleRecord?.plateNumber || vehicleRecord?.plate || (savedTruck && savedTruck !== '-' && !looksLikeRecordId(savedTruck) ? savedTruck : 'Not set');
    const driverName = assignedDriver?.fullName || assignedDriver?.name || schedule?.assignedDriverName || getDriverLabel(schedule);
    const itemDetails = booking?.itemDetails?.trim();
    const estimatedItems = booking?.estimatedItems ? `${booking.estimatedItems} pcs` : '';
    const totalAmount = toNumber(jobOrder.totalAmount) || toNumber(booking?.amount);
    const cashPaid = toNumber(booking?.amountCashCod);
    const onlinePaid = toNumber(booking?.amountOnline);
    const paymentMethod = String(booking?.paymentMethod || booking?.requestedPaymentMethod || jobOrderData.paymentMethod || '').trim();
    const isCashPayment = ['cash', 'cod', 'cash on delivery'].includes(paymentMethod.toLowerCase());
    const methodAmount = isCashPayment ? totalAmount : Math.max(onlinePaid, cashPaid);
    const recordedPaidAmount = cashPaid + onlinePaid;
    const amountDue = recordedPaidAmount > 0 ? Math.max(0, totalAmount - recordedPaidAmount) : totalAmount;
    return {
      jobOrder,
      schedule,
      booking,
      date: schedule?.date || booking?.date || jobOrderData.date || jobOrder.serviceDate || '-',
      pickupTime: schedule?.pickupTime || booking?.preferredTime || jobOrderData.preferredTime || '-',
      dispatchTime: schedule?.dispatchTime || scheduleData?.time || jobOrderData.time || '-',
      client: collapseSpaces(String(booking?.fullName || booking?.client || jobOrderData.client || jobOrder.client || '')),
      contact: booking?.contact || jobOrderData.contact || '-',
      pickupAddress: booking?.pickupAddress || jobOrderData.pickupAddress || schedule?.origin || '-',
      dropOffAddress: booking?.deliveryAddress || jobOrderData.deliveryAddress || schedule?.destination || '-',
      specialInstructions: booking?.specialInstructions || jobOrderData.specialInstructions || 'None',
      protectiveMaterials: toTextList(booking?.protectiveMaterials || jobOrderData.protectiveMaterials),
      pickupLandmark: booking?.pickupLandmark?.trim() || undefined,
      dropOffLandmark: booking?.deliveryLandmark?.trim() || undefined,
      service: booking?.serviceType || booking?.service || '-',
      items: [estimatedItems, itemDetails].filter(Boolean).join(' - ') || '-',
      permitRequired: Boolean(booking?.permitRequired ?? schedule?.permitRequired),
      insurance: booking ? (booking.hasInsurance ? 'Yes' : 'No') : 'Not set',
      vehiclePlate,
      vehicleModel: vehicleRecord?.model || vehicleRecord?.alias || '',
      garage: schedule?.garage || booking?.garage || vehicleRecord?.garage || '',
      driver: !driverName || driverName === '-' || looksLikeRecordId(driverName) ? 'Not set' : driverName,
      helpers: helperNames,
      totalAmount,
      cashPaid: isCashPayment ? methodAmount : cashPaid,
      onlinePaid: isCashPayment ? 0 : methodAmount,
      paidAmount: recordedPaidAmount,
      amountDue,
      paymentMethod: paymentMethod || 'Not set',
      isCashPayment,
      paymentStatus: jobOrder.paymentStatus || booking?.paymentStatus || jobOrderData.paymentStatus || 'Pending',
      status: normalizeJobOrderStatus(String(jobOrder.status || '')),
    };
  }

  async function handleGenerate() {
    if (!selectedScheduleId) {
      toast.error('Please select a scheduled booking');
      return;
    }
    const schedule = schedules.find((s) => s.id === selectedScheduleId);
    if (!schedule) return;
    const booking = bookings.find((b) => b.bookingId === schedule.bookingId || b.id === schedule.bookingId);

    setGenerating(true);
    try {
      await createJobOrder({
        bookingId: schedule.bookingId,
        bookingNo: schedule.bookingNo ?? booking?.bookingNo,
        client: schedule.client,
        serviceDate: schedule.date,
        truck: vehicles.find(vehicle => vehicle.id === schedule.vehicleId)?.plateNumber || schedule.vehicleId || '-',
        team: schedule.team || '1',
        totalAmount: booking?.amount ? String(toNumber(booking.amount)) : undefined,
        paymentStatus: (booking?.paymentStatus as 'Paid' | 'Pending' | 'Partial') || 'Pending',
        status: 'Pending',
      });
      toast.success('Job order generated successfully');
      setShowGenerateDialog(false);
      setSelectedScheduleId('');
      await refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate job order');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(jo: JobOrder) {
    try {
      const details = getJobOrderDetails(jo);
      const jobOrderNo = jo.jobOrderNo || 'Job Order';
      const [logo, materialPrices] = await Promise.all([loadJobOrderLogo(), loadMaterialPrices()]);
      const doc = buildJobOrderPdf({
        logo,
        jobOrderNo,
        bookingNo: jo.bookingNo ?? '-',
        date: formatJobOrderDate(details.date),
        pickupTime: formatJobOrderTime(details.pickupTime),
        dispatchTime: formatJobOrderTime(details.dispatchTime),
        vehiclePlate: details.vehiclePlate,
        vehicleModel: details.vehicleModel,
        garage: details.garage,
        driver: details.driver,
        helpers: details.helpers,
        pickupAddress: deduplicateAddress(details.pickupAddress),
        pickupLandmark: details.pickupLandmark,
        dropOffAddress: deduplicateAddress(details.dropOffAddress),
        dropOffLandmark: details.dropOffLandmark,
        client: details.client,
        contact: details.contact,
        service: details.service,
        items: details.items,
        specialInstructions: details.specialInstructions,
        permitRequired: details.permitRequired,
        costLines: details.booking
          ? buildCostLines(details.booking, details.totalAmount, materialPrices)
          : details.protectiveMaterials.map(label => ({ label, value: 'Not listed', muted: true })),
        paymentMethod: details.paymentMethod,
        paymentStatus: isUnprocessedPaymentStatus(details.paymentStatus) ? 'Not set' : details.paymentStatus,
        isCashPayment: details.isCashPayment,
        totalAmount: details.totalAmount,
        amountDue: details.amountDue,
      });
      doc.save(`${jobOrderNo}.pdf`);
    } catch (error) {
      console.error('Failed to download job order', error);
      toast.error('Unable to download job order');
    }
  }

  /** Same branded workbook as the Reports exports: a Summary sheet, then the job orders on their own sheet. */
  async function exportExcel() {
    const rows = filtered.map((jo) => {
      const schedule = getScheduleForJobOrder(jo);
      const booking = getBookingForJobOrder(jo);
      const details = getJobOrderDetails(jo);
      const driver = getDriverLabel(schedule);
      return {
        jobOrderNo: jo.jobOrderNo || '-',
        bookingNo: jo.bookingNo || '-',
        client: jo.client || '-',
        date: formatJobOrderDate(schedule?.date || booking?.date || jo.serviceDate || ''),
        truck: jo.truck && jo.truck !== '-' ? jo.truck : getVehicleLabel(schedule),
        driver: driver !== '-' ? driver : jo.team || '-',
        totalAmount: toNumber(jo.totalAmount) > 0 ? toNumber(jo.totalAmount) : toNumber(booking?.amount ?? jo.totalAmount),
        payment: details.paymentStatus,
        status: normalizeJobOrderStatus(jo.status),
      };
    });
    const pending = rows.filter((row) => row.status.toLowerCase() === 'pending').length;
    const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);
    const today = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
    try {
      await exportReportExcel({
        reportName: 'Job Order Report',
        fileStem: 'job-order-report',
        period: `As of ${today}`,
        filters: [
          { label: 'Status', value: statusFilter === 'All' ? 'All statuses' : statusFilter },
          ...(search.trim() ? [{ label: 'Search', value: search.trim() }] : []),
        ],
        generatedBy: user?.fullName || 'Operations',
        generatedAt: new Date(),
        sections: [
          {
            kind: 'metrics', title: 'Summary', items: [
              { label: 'Job orders', value: rows.length, format: 'number' },
              { label: 'Pending distribution', value: pending, format: 'number', note: 'Not yet handed to drivers' },
              { label: 'Distributed', value: rows.length - pending, format: 'number' },
              { label: 'Total amount', value: totalAmount, format: 'peso', note: 'Across the job orders listed' },
            ],
          },
          {
            kind: 'table', title: 'Job orders', emptyText: 'No job orders match the current filters.',
            columns: [
              { header: 'Job order no.', key: 'jobOrderNo', width: 22 },
              { header: 'Booking no.', key: 'bookingNo', width: 22 },
              { header: 'Client', key: 'client', width: 28 },
              { header: 'Service date', key: 'date', width: 20 },
              { header: 'Truck', key: 'truck', width: 20 },
              { header: 'Driver', key: 'driver', width: 24 },
              { header: 'Total amount', key: 'totalAmount', format: 'peso', width: 18 },
              { header: 'Payment', key: 'payment', width: 14 },
              { header: 'Status', key: 'status', width: 16 },
            ],
            rows,
            totals: { totalAmount },
          },
        ],
      });
    } catch (error) {
      console.error('Failed to export job orders to Excel', error);
      toast.error('Unable to export job orders');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="JOB ORDER"
        subtitle={<>Generate, distribute, and manage job <span className="font-medium text-[#d4a72c]">orders for scheduled bookings</span>.</>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowGenerateDialog(true)}
            className="inline-flex items-center justify-center rounded-xl bg-[#1a1f6e] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#141a6b]"
          >
            <Plus className="mr-2 h-4 w-4" />
            DISTRIBUTE JOB ORDER
          </button>
          <details className="group relative shrink-0">
            <summary className="inline-flex h-[42px] w-fit cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-50 mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-200/70 bg-white p-1 shadow-lg">
              <button type="button" onClick={exportExcel} className="inline-flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 text-left text-sm text-slate-700 transition-colors hover:bg-[#e0ac22] hover:text-[#172033] focus-visible:bg-[#e0ac22] focus-visible:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30"><FileSpreadsheet className="h-4 w-4" aria-hidden="true" />Excel</button>
            </div>
          </details>
        </div>}
      />

      {showKpis && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KPICard label="Total Job Orders" value={jobOrders.length} icon={ClipboardList} iconColor="#1a1f6e" variant="dashboard-compact" />
        <KPICard label="Pending" value={jobOrders.filter(order => normalizeJobOrderStatus(order.status) === 'Pending').length} icon={Clock3} iconColor="#f59e0b" variant="dashboard-compact" />
        <KPICard label="Distributed" value={jobOrders.filter(order => normalizeJobOrderStatus(order.status) === 'Distributed').length} icon={CheckCircle2} iconColor="#10b981" variant="dashboard-compact" />
      </div>}

      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search booking no. and client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a72c]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'Pending', 'Distributed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`cursor-pointer whitespace-nowrap rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  statusFilter === tab
                    ? 'border-[#1a1f6e] bg-[#1a1f6e] text-white'
                    : 'border-slate-200 bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
      </div>

      {/* Table */}
      <div className="rounded-none border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full table-auto text-sm">
            <thead className="bg-[#1a1f6e]">
              <tr>
                {['JOB ORDER NO.', 'BOOKING NO.', 'CLIENT', 'DATE', 'TRUCK', 'DRIVER', 'TOTAL AMOUNT', 'PAYMENT', 'STATUS', 'ACTIONS'].map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">No job orders found.</td></tr>
              ) : (
                paginated.map((jo) => {
                  const schedule = getScheduleForJobOrder(jo);
                  const booking = getBookingForJobOrder(jo);
                  const driverLabel = getDriverLabel(schedule);
                  return (
                  <tr key={jo.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{jo.jobOrderNo || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">{jo.bookingNo ?? '-'}</td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300">{jo.client}</td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">{schedule?.date || booking?.date || jo.serviceDate}</td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">{jo.truck && jo.truck !== '-' ? jo.truck : getVehicleLabel(schedule)}</td>
                    <td className="px-4 py-2.5 text-slate-900 dark:text-slate-300 whitespace-nowrap">{driverLabel !== '-' ? driverLabel : jo.team || '-'}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">{toPesoString(toNumber(jo.totalAmount) > 0 ? jo.totalAmount : booking?.amount ?? jo.totalAmount)}</td>
                    <td className="px-4 py-2.5">{isUnprocessedPaymentStatus(jo.paymentStatus || booking?.paymentStatus) ? '-' : <StatusBadge status={jo.paymentStatus || booking?.paymentStatus || 'Pending'} variant="job-order-payment" />}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={normalizeJobOrderStatus(jo.status)} variant="job-order-status" /></td>
                    <td className="px-4 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <MoreVertical className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewJobOrder(jo)}>
                            <Eye className="w-4 h-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(jo)}>
                            <Download className="w-4 h-4 mr-2" /> Download (PDF)
                          </DropdownMenuItem>
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
        <TablePagination page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
      </div>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Distribute Job Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select an assigned scheduled booking to distribute a job order.
            </p>
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
              {availableSchedules.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 text-center">No assigned bookings available.</p>
              ) : (
                availableSchedules.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedScheduleId(s.id)}
                    className={`w-full text-left p-3 transition-colors ${
                      selectedScheduleId === s.id ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{s.bookingNo ?? '-'}</p>
                    <p className="text-xs text-slate-500">{s.client} • {s.date}</p>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !selectedScheduleId}
              className="w-full rounded-xl bg-[#030848] hover:bg-[#151b4f] text-white font-semibold py-2.5 disabled:opacity-60"
            >
              {generating ? 'Generating...' : 'Generate Job Order'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewJobOrder} onOpenChange={() => setViewJobOrder(null)}>
        <DialogContent hideCloseButton aria-describedby={undefined} className="w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] max-w-[680px] overflow-y-auto rounded-xl border-0 bg-white p-0 gap-0 shadow-xl dark:bg-slate-900 sm:rounded-xl">
          {viewJobOrder && (() => {
            const details = getJobOrderDetails(viewJobOrder);
            const booking = getBookingForJobOrder(viewJobOrder);
            const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
            return (
              <div className="bg-[#f1f4fa]">
                <ModalHeader
                  icon={ClipboardList}
                  title="Job order details"
                  subtitle={details.jobOrder.jobOrderNo || 'Job order'}
                  aside={<StatusBadge status={details.status} variant="job-order-status" />}
                  closeLabel="Close job order details"
                />
                <div className="space-y-3 p-4">
                  <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <JobOrderSectionTitle>Client details</JobOrderSectionTitle>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <JobOrderDetail label="Booking no." value={details.jobOrder.bookingNo ?? '-'} />
                      <JobOrderDetail label="Client" value={details.client} />
                      <JobOrderDetail label="Contact number" value={formatPhoneLocal(details.contact)} />
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <JobOrderSectionTitle>Schedule</JobOrderSectionTitle>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <JobOrderDetail label="Date" value={formatJobOrderDate(details.date)} />
                      <JobOrderDetail label="Pickup time" value={formatJobOrderTime(details.pickupTime)} />
                      <JobOrderDetail label="Dispatch time" value={formatJobOrderTime(details.dispatchTime)} />
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <JobOrderSectionTitle>Vehicle and crew</JobOrderSectionTitle>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <JobOrderDetail label="Driver" value={details.driver} />
                      <JobOrderDetail label="Vehicle" value={`${details.vehiclePlate}${details.vehicleModel ? ` · ${details.vehicleModel}` : ''}`} />
                      <JobOrderDetail label="Helper/s" value={details.helpers.join(', ') || 'None'} />
                      {details.garage && <JobOrderDetail label="Garage" value={details.garage} />}
                    </div>
                  </section>
                  {(details.permitRequired || details.specialInstructions !== 'None') && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-amber-800">Important notes</h3>
                    {details.permitRequired && <p className="mt-2 text-[15px] font-medium text-red-700">Barangay / subdivision permit required</p>}
                    {details.specialInstructions !== 'None' && <p className="mt-2 break-words text-[15px] text-amber-900">{details.specialInstructions}</p>}
                  </section>}
                  <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <JobOrderSectionTitle>Route</JobOrderSectionTitle>
                    <div className="mt-3 flex gap-3">
                      <div className="flex w-3 shrink-0 flex-col items-center py-1"><span className="h-2.5 w-2.5 rounded-full bg-[#1a1f6e]" /><span className="my-1 min-h-8 flex-1 border-l-2 border-dashed border-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-[#e8b800]" /></div>
                      <div className="min-w-0 flex-1 space-y-4">
                        <JobOrderAddress label="Pickup address" value={deduplicateAddress(details.pickupAddress)} landmark={details.pickupLandmark} />
                        <JobOrderAddress label="Drop-off address" value={deduplicateAddress(details.dropOffAddress)} landmark={details.dropOffLandmark} />
                      </div>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <JobOrderSectionTitle>Job details</JobOrderSectionTitle>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <JobOrderDetail label="Service" value={details.service} />
                      <JobOrderDetail label="Items" value={details.items} />
                      {!booking && details.protectiveMaterials.length > 0 && <JobOrderDetail label="Protective materials" value={details.protectiveMaterials.join(', ')} />}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <JobOrderSectionTitle>Insurance &amp; payment</JobOrderSectionTitle>
                    <div className="mt-3 space-y-2.5">
                      <JobOrderPaymentRow divided label="Insurance" value={details.insurance} />
                      <JobOrderPaymentRow label="Payment Method" value={details.paymentMethod} />
                      {!booking && <TotalRow value={money.format(details.totalAmount)} />}
                    </div>
                  </section>
                  {booking && <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <JobOrderSectionTitle>Payment details</JobOrderSectionTitle>
                    <div className="mt-3"><BookingCostSummary booking={booking} total={details.totalAmount} /></div>
                  </section>}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobOrderDetail({ label, value }: { label: string; value?: string | number | null }) {
  const muted = !value || value === '-' || value === 'Not set' || value === 'None';
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className={`mt-0.5 break-words text-[15px] font-medium ${muted ? 'font-normal text-slate-400' : 'text-slate-900'}`}>{value || 'Not set'}</p></div>;
}

function JobOrderSectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{children}</h3>;
}

function JobOrderAddress({ label, value, landmark }: { label: string; value: string; landmark?: string }) {
  const muted = !value || value === '-';
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className={`mt-0.5 break-words text-[14.5px] leading-relaxed ${muted ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{value || 'Not set'}</p>{landmark && <p className="mt-0.5 break-words text-sm text-slate-600">Landmark / Map Pin: {landmark}</p>}</div>;
}

function JobOrderPaymentRow({ label, value, divided = false }: { label: string; value: string; divided?: boolean }) {
  const muted = value === 'Not set' || value === 'None';
  return <div className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 ${divided ? 'border-b border-slate-100 pb-2.5' : ''}`}><span className="text-sm text-slate-600">{label}</span><span className={`break-words text-[15px] ${muted ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{value}</span></div>;
}
