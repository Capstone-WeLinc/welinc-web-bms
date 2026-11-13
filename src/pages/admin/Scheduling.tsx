import { StatusFilter } from '../../components/ui/ListSearchFilters';
import ModalHeader from '../../components/ui/ModalHeader';
import ScheduleDetailsDialog from '../../components/shared/ScheduleDetailsDialog';
import TablePagination from '../../components/ui/TablePagination';
import PageHeader from '../../components/pageheader/Pageheader';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserCheck, Truck, CalendarCheck, CalendarDays, Search, ClipboardList, Eye, Pencil, Clock3, Warehouse, PackageCheck, TruckIcon, ContactRound, UsersRound, TriangleAlert, MoreVertical, Check, Plus, X, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { normalizeBookingStatus } from '../../lib/booking';
import type { Booking, ScheduleEntry, Vehicle, Driver, Helper } from '../../lib/types';
import KPICard from '../../components/shared/KpiCard';
import { Dialog, DialogContent } from '../../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { Label } from '../../components/ui/Label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/Dropdown';
import ScheduleCalendar, { DeliveryTypeBadge, formatScheduleAddress, isPastScheduleTime, ScheduleStatusBadge, toDateKey, type ScheduleCrew } from '../../components/scheduling/ScheduleCalendar';


const GARAGES = ['Manila Hub', 'QC Depot', 'Cavite Branch', 'Laguna Branch'];
const DELIVERY_TYPES: Array<'Inhouse' | 'Subcon'> = ['Inhouse', 'Subcon'];


type ViewMode = 'list' | 'calendar';
type TimingResult = { status: 'available' | 'blocked' | 'unverified'; message?: string };
type ResourceTiming = { vehicles: Record<string, TimingResult>; drivers: Record<string, TimingResult>; helpers: Record<string, TimingResult> };


function pad2(n: number) { return String(n).padStart(2, '0'); }

/** 0–23 hour and minute → "7:30 AM". */
function format12Hour(hour24: number, minute: number) {
  return `${hour24 % 12 || 12}:${pad2(minute)} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

type DispatchTimeOption = { value: string; minutes: number; keywords: string };

/** Hidden search words so "730", "730p", "7:30pm", "0730" and "19:30" all find the right time. */
function dispatchTimeOption(hour24: number, minute: number): DispatchTimeOption {
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? 'pm' : 'am';
  const mm = pad2(minute);
  return {
    value: format12Hour(hour24, minute),
    minutes: hour24 * 60 + minute,
    keywords: [`${hour12}${mm}${suffix}`, `${hour12}:${mm}${suffix}`, `${hour12}${mm}`, `${pad2(hour24)}:${mm}`, `${pad2(hour24)}${mm}`].join(' '),
  };
}

/** Dispatch times every 15 minutes across the day. */
const DISPATCH_TIME_OPTIONS: DispatchTimeOption[] = Array.from({ length: 96 }, (_, index) => dispatchTimeOption(Math.floor(index / 4), (index % 4) * 15));

const PAST_DATE_REASON = 'The service date or pickup time has passed. Customer Service needs to reschedule this booking before it can be assigned.';

/** Today in Manila, the calendar bookings are dated in. */
function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/**
 * A booking whose service date is already behind us can't be assigned or re-assigned.
 * An unassigned booking also counts as past once today's pickup time has gone by.
 */
function isPastDate(entry: ScheduleEntry) {
  if (!entry.date) return false;
  if (toDateKey(entry.date) < manilaToday()) return true;
  return entry.status === 'Unassigned' && isPastScheduleTime(entry.date, entry.pickupTime || entry.time);
}

function mapBookingToSchedule(booking: Booking): ScheduleEntry {
  const bookingData = booking as Booking & Record<string, any>;
  const bookingStatus = bookingData.bookingStatus ?? booking.status;
  const driverReference = bookingData.driverId ?? bookingData.driver_id ?? bookingData.assignedDriverId ?? bookingData.assigned_driver ?? bookingData.driver;
  const vehicleReference = bookingData.vehicleId ?? bookingData.vehicle_id ?? bookingData.assignedVehicleId ?? bookingData.assigned_vehicle;
  const normalizedStatus = String(bookingData.status ?? bookingStatus ?? '').trim().toLowerCase();
  const hasPersistedAssignment = Boolean(
    bookingData.scheduledBooking?.id
    || driverReference
    || vehicleReference
    || bookingData.dispatchTime
    || bookingData.garage
    || bookingData.deliveryType,
  );
  const status = hasPersistedAssignment || normalizedStatus === 'assigned' || normalizedStatus === 'scheduled'
    ? 'Assigned'
    : 'Unassigned';
  const assignedDriverName = bookingData.assignedDriver?.fullName ?? bookingData.assignedDriver?.name ?? bookingData.driver?.fullName ?? bookingData.driver?.name;
  return {
    id: booking.id,
    bookingId: booking.bookingId ?? booking.id,
    bookingNo: booking.bookingNo,
    bookingStatus: normalizeBookingStatus(bookingStatus),
    client: booking.client,
    service: booking.serviceType ?? booking.service,
    date: toDateKey(booking.date),
    time: bookingData.pickupTime ?? booking.preferredTime ?? booking.time ?? '',
    pickupTime: bookingData.pickupTime ?? booking.preferredTime ?? booking.time ?? '',
    dispatchTime: bookingData.dispatchTime ?? booking.dispatchTime ?? '',
    origin: booking.pickupAddress ?? 'Unknown pickup',
    destination: booking.deliveryAddress ?? 'Unknown delivery',
    garage: booking.garage ?? undefined,
    deliveryType: booking.deliveryType as 'Inhouse' | 'Subcon' | undefined,
    vehicleId: typeof vehicleReference === 'object' ? vehicleReference?.id ?? null : vehicleReference ?? null,
    driverId: typeof driverReference === 'object'
      ? driverReference?.id ?? driverReference?.driverId ?? driverReference?.driver_id ?? driverReference?.empId ?? null
      : driverReference ?? null,
    helperIds: Array.isArray(booking.helperIds) ? booking.helperIds : [],
    permitRequired: Boolean(bookingData.permitRequired ?? bookingData.permit_required),
    preferredTruck: booking.selectedTruck?.name || booking.selectedTruck?.truckTypeId
      ? { name: booking.selectedTruck.name ?? '', truckTypeId: booking.selectedTruck.truckTypeId ?? '' }
      : null,
    assignedDriverName,
    status,
  };
}


export default function Scheduling({ canAssign = true }: { canAssign?: boolean }) {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Partial<Driver>[]>([]);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [search, setSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState<ScheduleEntry | null>(null);
  const [viewTarget, setViewTarget] = useState<ScheduleEntry | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [_isLoading, setIsLoading] = useState(true);
  const [_loadError, setLoadError] = useState<string | null>(null);


  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());


  // Assignment form state
  const [assignTime, setAssignTime] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([]);
  const [helperSlotCount, setHelperSlotCount] = useState(1);
  const [selectedGarage, setSelectedGarage] = useState('');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'Inhouse' | 'Subcon' | ''>('');
  const [garages, setGarages] = useState<string[]>(GARAGES);
  const [assignmentTouched, setAssignmentTouched] = useState<Record<string, boolean>>({});
  const [resourceTiming, setResourceTiming] = useState<ResourceTiming | null>(null);
  const [timingCheckFailed, setTimingCheckFailed] = useState(false);
  const [travelConfirmed, setTravelConfirmed] = useState(false);


  const filtered = schedules.filter(s => {
    const matchSearch = s.client.toLowerCase().includes(search.toLowerCase()) ||
      (s.bookingNo ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' ? true : s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);


  const forPlotting = schedules.filter(s => s.bookingStatus === 'For Plotting').length;
  const assigned = schedules.filter(s => s.status === 'Assigned').length;
  const unassigned = schedules.filter(s => s.status === 'Unassigned').length;


  // The dashboard's Assign button lands here with the booking to open. Clearing it stops a refresh reopening the dialog.
  const location = useLocation();
  const navigate = useNavigate();
  const assignBookingId = (location.state as { assignBookingId?: string } | null)?.assignBookingId;
  useEffect(() => {
    if (!assignBookingId) return;
    const entry = schedules.find(schedule => schedule.id === assignBookingId);
    if (!entry) return;
    navigate(location.pathname, { replace: true, state: null });
    openAssign(entry);
  }, [assignBookingId, schedules]);

  // A truck or crew member is only taken on the dates they're booked, and can take a
  // second job that day when the times and distance allow it. The backend decides this.
  useEffect(() => {
    if (!assignTarget) return;
    let cancelled = false;
    setResourceTiming(null);
    setTimingCheckFailed(false);
    setTravelConfirmed(false);
    api.get<ResourceTiming>(`/scheduling/${assignTarget.id}/resource-timing`)
      .then(({ data }) => { if (!cancelled) setResourceTiming(data); })
      .catch(() => { if (!cancelled) setTimingCheckFailed(true); });
    return () => { cancelled = true; };
  }, [assignTarget?.id]);


  function openAssign(entry: ScheduleEntry) {
    if (!canAssign) {
      openView(entry);
      return;
    }
    if (isPastDate(entry)) {
      toast.error(PAST_DATE_REASON);
      openView(entry);
      return;
    }
    setAssignTarget(entry);
    // Dispatch time is independent from the customer's preferred pickup time.
    const existingDispatchTime = entry.dispatchTime || '';
    const timeParts = existingDispatchTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const apiTimeParts = existingDispatchTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    // Normalise to the "7:30 AM" format used by the time list.
    const displayTime = apiTimeParts
      ? format12Hour(Number(apiTimeParts[1]), Number(apiTimeParts[2]))
      : timeParts
        ? `${Number(timeParts[1])}:${timeParts[2]} ${timeParts[3].toUpperCase()}`
        : '';
    setAssignTime(displayTime);
    setSelectedVehicle(entry.vehicleId || '');
    const assignedDriver = getScheduleDriver(entry);
    setSelectedDriver(assignedDriver?.id || entry.driverId || '');
    setSelectedHelpers(entry.helperIds || []);
    setHelperSlotCount(Math.max(1, entry.helperIds?.length ?? 0));
    setSelectedGarage(entry.garage || '');
    setSelectedDeliveryType(entry.deliveryType || '');
    setAssignmentTouched({});
  }

  function openView(entry: ScheduleEntry) {
    setViewTarget(entry);
  }

  function getScheduleDriver(entry: ScheduleEntry) {
    return drivers.find(driver => driver.id === entry.driverId || driver.empId === entry.driverId || driver.fullName === entry.assignedDriverName);
  }

  function handleStatusFilter(filter: 'All' | 'Assigned' | 'Unassigned' | 'Calendar') {
    if (filter === 'Calendar') {
      // Stay on the displayed month while it has anything to plot or review.
      const bookingDates = schedules
        .map(schedule => toDateKey(schedule.date))
        .filter(Boolean)
        .sort();
      const displayedMonth = `${calYear}-${pad2(calMonth + 1)}`;
      const hasBookingInDisplayedMonth = bookingDates.some(date => date.startsWith(displayedMonth));
      if (!hasBookingInDisplayedMonth && bookingDates.length > 0) {
        const [year, month] = bookingDates[0].split('-').map(Number);
        setCalYear(year);
        setCalMonth(month - 1);
      }
      setViewMode('calendar');
    } else {
      setViewMode('list');
      setStatusFilter(filter);
    }
  }

  function mapVehicleStatus(status: string) {
    switch (status) {
      case 'AVAILABLE':
        return 'Available';
      case 'UNDER_MAINTENANCE':
        return 'Under Maintenance';
      case 'UNDER_REPAIR':
        return 'Under Repair';
      default:
        return status as Vehicle['status'];
    }
  }

  async function refreshVehicles() {
    try {
      const response = await api.get<any[]>('/bms/config/vehicles');
      setVehicles(response.data.map((vehicle) => ({
        id: vehicle.id,
        plate: vehicle.plateNumber || vehicle.plate,
        alias: vehicle.alias || vehicle.plateNumber || vehicle.plate,
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        type: vehicle.type || 'Truck',
        year: vehicle.year || 2020,
        capacity: vehicle.capacity || '',
        color: vehicle.color || 'White',
        fuel: vehicle.fuel || 'Diesel',
        status: mapVehicleStatus(vehicle.status),
        requiredHelpers: vehicle.requiredHelpers || 1,
        mileage: vehicle.mileage || 0,
        regExpiry: vehicle.regExpiry || '',
        insExpiry: vehicle.insExpiry || '',
        lastMaintenance: vehicle.lastMaintenance || '',
        nextMaintenance: vehicle.nextMaintenance || '',
        driverId: vehicle.driverId || null,
        garage: vehicle.garage || '',
      })));
    } catch (error) {
      console.error('Failed to load vehicles', error);
    }
  }

  async function refreshGarages() {
    try {
      const response = await api.get<any[]>('/bms/config/garages');
      setGarages(response.data.map(g => g.name));
    } catch (error) {
      console.error('Failed to load garages', error);
    }
  }

  async function refreshDrivers() {
    try {
      const response = await api.get<Partial<Driver>[]>('/bms/config/drivers');
      setDrivers(response.data);
    } catch (error) {
      console.error('Failed to load drivers', error);
    }
  }

  async function loadSchedules() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await api.get<Booking[]>('/scheduling');
      setSchedules((response.data ?? []).map(mapBookingToSchedule));
    } catch (error) {
      console.error('Failed to load schedules from API', error);
      setSchedules([]);
      setLoadError('Unable to load live scheduling data.');
      toast.error('Unable to load live scheduling data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshVehicles();
    refreshDrivers();
    refreshHelpers();
    refreshGarages();
    loadSchedules();

    // Admin and Operations share this module. Refresh when returning to the
    // page and periodically so assignments made from either role stay in sync.
    const refresh = () => loadSchedules();
    window.addEventListener('focus', refresh);
    const refreshId = window.setInterval(refresh, 15_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(refreshId);
    };
  }, []);


  const currentVehicle = vehicles.find(v => v.id === selectedVehicle);
  const requiredHelpers = currentVehicle?.requiredHelpers ?? 0;
  // Minimum number of helper fields that must be filled; users may add more via "Add Another Helper".
  const minHelperSlots = Math.max(1, requiredHelpers);
  const helperSlots = Math.max(minHelperSlots, helperSlotCount);
  // A permit booking is filed under its truck and crew, so once assigned only time, garage and delivery type can change.
  const crewLocked = Boolean(assignTarget?.permitRequired && assignTarget.status === 'Assigned');


  function getAvailableVehicles() {
    if (!assignTarget) return [];
    return vehicles.filter(v => v.status === 'Available');
  }


  function getAvailableDrivers() {
    if (!assignTarget) return [];
    return drivers.filter((d) => {
      const id = d.id ?? '';
      const isCurrentDriver = id === assignTarget.driverId || d.empId === assignTarget.driverId || d.fullName === assignTarget.assignedDriverName;
      return id && (d.status === 'Available' || d.status === 'On Duty' || !d.status || isCurrentDriver);
    });
  }


  function getAvailableHelpers() {
    if (!assignTarget) return [];
    return helpers.filter(h => h.status !== 'On Leave' || assignTarget.helperIds.includes(h.id));
  }

  const timingNote = (result?: TimingResult) => (result?.status === 'blocked' ? ` - ${result.message}` : '');
  const selectedTiming = [
    resourceTiming?.vehicles[selectedVehicle],
    resourceTiming?.drivers[selectedDriver],
    ...selectedHelpers.slice(0, helperSlots).map(helperId => resourceTiming?.helpers[helperId]),
  ].filter((result): result is TimingResult => Boolean(result));
  const blockedMessages = [...new Set(selectedTiming.filter(result => result.status === 'blocked').map(result => result.message ?? ''))];
  const unverifiedMessages = [...new Set(selectedTiming.filter(result => result.status === 'unverified').map(result => result.message ?? ''))];


  function handleHelperChange(idx: number, value: string) {
    setSelectedHelpers(prev => { const next = [...prev]; next[idx] = value; return next; });
  }

  function handleAddHelperSlot() {
    setHelperSlotCount(helperSlots + 1);
  }

  function handleRemoveHelperSlot(idx: number) {
    setSelectedHelpers(prev => prev.slice(0, helperSlots).filter((_, index) => index !== idx));
    setHelperSlotCount(Math.max(1, helperSlots - 1));
  }


  async function handleAssign() {
    if (!canAssign || !assignTarget) return;
    const requiredHelperValues = selectedHelpers.slice(0, minHelperSlots);
    const nextTouched: Record<string, boolean> = {
      time: true, garage: true, deliveryType: true, vehicle: true, driver: true,
    };
    for (let index = 0; index < minHelperSlots; index += 1) nextTouched[`helper-${index}`] = true;
    if (!assignTime || !selectedGarage || !selectedDeliveryType || !selectedVehicle || !selectedDriver || requiredHelperValues.filter(Boolean).length < minHelperSlots) {
      setAssignmentTouched(nextTouched);
      toast.error('Please complete all required assignment fields.');
      return;
    }
    const helpers = [...new Set(selectedHelpers.slice(0, helperSlots).filter(Boolean))];
    
    try {
      // Call backend assign endpoint
      const timeParts = assignTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!timeParts) {
        toast.error('Enter a valid dispatch time.');
        return;
      }
      let hour24 = Number(timeParts[1]) % 12;
      if (timeParts[3].toUpperCase() === 'PM') hour24 += 12;
      const payload: any = {
        dispatchTime: `${pad2(hour24)}:${timeParts[2]}`,
        garage: selectedGarage,
        deliveryType: selectedDeliveryType || undefined,
        vehicleId: selectedVehicle,
        driverId: selectedDriver,
      };
      payload.helperIds = helpers;
      payload.travelConfirmed = travelConfirmed;

      await api.put(`/scheduling/${assignTarget.id}/assign`, payload);
      await loadSchedules();
      toast.success(assignTarget.status === 'Assigned'
        ? 'An assignment was updated successfully.'
        : 'A booking was assigned succesfully.');
      setAssignTarget(null);
    } catch (error) {
      console.error('Failed to assign booking', error);
      const responseMessage = (error as any)?.response?.data?.message;
      alert(Array.isArray(responseMessage) ? responseMessage.join('\n') : responseMessage || 'Failed to assign booking. Please try again.');
    }
  }


  const availableVehicles = assignTarget ? getAvailableVehicles() : [];
  const availableDrivers = assignTarget ? getAvailableDrivers() : [];
  const availableHelpers = assignTarget ? getAvailableHelpers() : [];
  // Keep an existing off-grid time (e.g. 7:20 AM) selectable alongside the 15-minute list.
  const savedTime = assignTime.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  const dispatchTimeOptions = savedTime && !DISPATCH_TIME_OPTIONS.some(option => option.value === assignTime)
    ? [...DISPATCH_TIME_OPTIONS, dispatchTimeOption((Number(savedTime[1]) % 12) + (savedTime[3] === 'PM' ? 12 : 0), Number(savedTime[2]))].sort((a, b) => a.minutes - b.minutes)
    : DISPATCH_TIME_OPTIONS;


  function getScheduleCrew(entry: ScheduleEntry): ScheduleCrew {
    const vehicle = vehicles.find(item => item.id === entry.vehicleId);
    const helperNames = (entry.helperIds ?? []).map(id => helpers.find(helper => helper.id === id || helper.empId === id)?.fullName).filter(Boolean);
    return {
      truck: vehicle ? [vehicle.plate, vehicle.model].filter(Boolean).join(' · ') : entry.vehicleId ? 'Vehicle no longer in fleet' : 'Not assigned',
      truckMissing: !vehicle,
      driver: getScheduleDriver(entry)?.fullName ?? entry.assignedDriverName ?? 'Not assigned',
      helpers: helperNames.join(', ') || 'Not assigned',
      garage: entry.garage ?? vehicle?.garage ?? 'Not assigned',
    };
  }

  const touchAssignmentField = (field: string) => setAssignmentTouched(current => ({ ...current, [field]: true }));
  const assignmentFieldError = (field: string, value: unknown) => assignmentTouched[field] && !value;

  async function refreshHelpers() {
    try {
      const response = await api.get<Helper[]>('/bms/config/helpers');
      setHelpers(response.data ?? []);
    } catch (error) {
      console.error('Failed to load helpers', error);
    }
  }


  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarCheck} title="SCHEDULING" subtitle={<>Schedule bookings and assigns <span className="font-medium text-[#d4a72c]">trucks and teams</span>.</>} subtitleClassName="mt-1 text-sm text-slate-500" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KPICard label="For Plotting" value={forPlotting} icon={Truck} iconColor="#f59e0b" variant="dashboard-compact" />
        <KPICard label="Assigned Bookings" value={assigned} icon={UserCheck} iconColor="#10b981" variant="dashboard-compact" />
        <KPICard label="Unassigned Bookings" value={unassigned} icon={ClipboardList} iconColor="#94a3b8" variant="dashboard-compact" />
      </div>

      {/* Search + Filters sit on top of the table as one connected card. */}
      <div>
      <div className={`flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${viewMode === 'calendar' ? 'mb-4' : 'border-b-0'}`}>
        {viewMode === 'list' ? (
          <div className="relative w-full lg:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search booking no. or client..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0a0f2e]/20 placeholder:text-slate-400"
            />
          </div>
        ) : (
          <div />
        )}
        <div className="flex gap-2 flex-wrap items-center">
          <StatusFilter options={['All', 'Assigned', 'Unassigned'] as const} value={statusFilter} onChange={handleStatusFilter} />
          <button
            type="button"
            aria-pressed={viewMode === 'calendar'}
            onClick={() => viewMode === 'calendar' ? setViewMode('list') : handleStatusFilter('Calendar')}
            className={`inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm font-medium shadow-sm transition-colors ${
              viewMode === 'calendar' ? 'border-[#1a1f6e] bg-[#1a1f6e] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Calendar
          </button>
        </div>
      </div>

      {/* Main Card */}
      {/* The calendar view shows the calendar and the day details as two separate cards. */}
      <div className={viewMode === 'calendar' ? '' : 'rounded-none border border-slate-200 bg-white overflow-hidden'}>
        {/* ── List View ── */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full table-auto text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-[#1a1f6e]">
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Booking No.</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Client</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Service Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Truck</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Team</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Pickup Address</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Delivery Address</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Branch</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Delivery Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-white uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map(s => {
                  const vehicle = vehicles.find(v => v.id === s.vehicleId);
                  const driver = getScheduleDriver(s);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 align-top">
                        <span className="inline-block min-w-[190px] pr-6 text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">{s.bookingNo ?? '-'}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="min-w-[160px] text-sm font-semibold text-slate-900 truncate block">{s.client}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="inline-block min-w-[110px] text-sm text-slate-700 tabular-nums whitespace-nowrap">{s.date}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className={`inline-block min-w-[110px] text-sm whitespace-nowrap ${vehicle ? 'text-slate-700' : 'text-slate-500'}`}>{vehicle ? `${vehicle.plate} - ${vehicle.alias}` : 'Not assigned'}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className={`inline-block min-w-[110px] text-sm whitespace-nowrap ${driver ? 'text-slate-700' : 'text-slate-500'}`}>{driver ? driver.fullName : 'Not assigned'}</span>
                      </td>
                      <td className="max-w-[200px] px-4 py-2.5 align-top">
                        <span className="block max-w-[200px] truncate text-sm text-slate-700" title={s.origin}>{s.origin}</span>
                      </td>
                      <td className="max-w-[200px] px-4 py-2.5 align-top">
                        <span className="block max-w-[200px] truncate text-sm text-slate-700" title={s.destination}>{s.destination}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className={`text-sm truncate block ${s.garage ?? vehicle?.garage ? 'text-slate-700' : 'text-slate-500'}`}>{s.garage ?? vehicle?.garage ?? '-'}</span>
                      </td>
                      <td className="px-4 py-2.5 align-top [&>span]:!text-xs">
                        {s.deliveryType ? <DeliveryTypeBadge type={s.deliveryType} /> : <span className="text-sm text-slate-500">-</span>}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <ScheduleStatusBadge status={s.status} date={s.date} time={s.pickupTime || s.time} />
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label="Row actions" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-fit min-w-0 rounded-xl border-slate-200 bg-white p-1 shadow-lg">
                              {!canAssign ? (
                                <DropdownMenuItem onSelect={() => openView(s)} className="w-fit gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700"><Eye className="h-4 w-4" /> View</DropdownMenuItem>
                              ) : isPastDate(s) ? (
                                // "Needs reschedule": Assign/Edit stays visible but disabled, with the reason in a note below.
                                <div className="w-64">
                                  <DropdownMenuItem onSelect={() => openView(s)} className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700"><Eye className="h-4 w-4" /> View</DropdownMenuItem>
                                  <DropdownMenuItem disabled className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700">{s.status === 'Unassigned' ? <><ClipboardList className="h-4 w-4" /> Assign</> : <><Pencil className="h-4 w-4" /> Edit</>}</DropdownMenuItem>
                                  <div className="mx-1 my-1 h-px bg-slate-100" aria-hidden="true" />
                                  <p role="note" className="m-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-800">
                                    <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span>Service date or pickup time has passed. CS needs to reschedule this booking first.</span>
                                  </p>
                                </div>
                              ) : s.status === 'Unassigned' ? (
                                <DropdownMenuItem onSelect={() => openAssign(s)} className="w-fit gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700"><ClipboardList className="h-4 w-4" /> Assign</DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onSelect={() => openView(s)} className="w-fit gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700"><Eye className="h-4 w-4" /> View</DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => openAssign(s)} className="w-fit gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700"><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-400">No schedules found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {viewMode === 'list' && (
          <TablePagination page={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
        )}

        {/* ── Calendar View ── */}
        {viewMode === 'calendar' && (
          <ScheduleCalendar
            schedules={schedules}
            year={calYear}
            month={calMonth}
            onMonthChange={(year, month) => { setCalYear(year); setCalMonth(month); }}
            canAssign={canAssign}
            getCrew={getScheduleCrew}
            onView={openView}
            onAssign={openAssign}
            layout="split"
          />
        )}
      </div>
      </div>


      {/* ─── Assignment Modal ─── */}
      {canAssign && <Dialog open={!!assignTarget} onOpenChange={open => { if (!open) { setAssignTarget(null); setAssignmentTouched({}); } }}>
        <DialogContent hideCloseButton className="gap-0 w-[calc(100%-2rem)] max-w-[760px] max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
          {assignTarget && (
            <>
              <ModalHeader
                icon={UserCheck}
                title="Assign resources"
                subtitle={assignTarget.bookingNo || undefined}
                onClose={() => { setAssignTarget(null); setAssignmentTouched({}); }}
                closeLabel="Close assign resources"
              />

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
                {assignTarget.permitRequired && (
                  <div className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-3.5" role="alert">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                      <TriangleAlert className="h-4 w-4 text-red-700" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-red-800">Barangay pass / permit required</p>
                      <p className="mt-0.5 text-sm text-red-700">This booking requires a barangay pass or permit. Please verify it before dispatching the assigned resources.</p>
                      {crewLocked && <p className="mt-1.5 text-sm font-medium text-red-800">The truck, driver and helpers are locked because the permit is filed under them. You can still change the dispatch time, garage and delivery type.</p>}
                    </div>
                  </div>
                )}

                <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-lg font-medium text-slate-900">{assignTarget.client}</p>
                      <p className={`mt-0.5 text-sm ${assignTarget.preferredTruck ? 'text-slate-600' : 'text-slate-400'}`}>
                        Preferred truck: <span className={assignTarget.preferredTruck ? 'font-medium text-slate-900' : ''}>{assignTarget.preferredTruck ? assignTarget.preferredTruck.name || assignTarget.preferredTruck.truckTypeId : 'Not chosen'}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-slate-600">Pickup time <span className="font-medium text-slate-900">{assignTarget.time || 'Not set'}</span></p>
                      <span className="text-sm font-medium text-slate-700">
                        {new Date(`${assignTarget.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="relative mt-4 space-y-3 pl-6">
                    <span className="absolute bottom-3 left-[5px] top-2 border-l-2 border-dashed border-slate-300" aria-hidden="true" />
                    <div className="relative">
                      <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-[#1a1f6e]" aria-hidden="true" />
                      <p className="text-sm text-slate-600">Pickup address</p>
                      <p className="text-sm leading-relaxed text-slate-900">{formatScheduleAddress(assignTarget.origin)}</p>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-[#e8b800]" aria-hidden="true" />
                      <p className="text-sm text-slate-600">Delivery address</p>
                      <p className="text-sm leading-relaxed text-slate-900">{formatScheduleAddress(assignTarget.destination)}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-xs font-medium tracking-wider text-[#1a1f6e]">
                    <span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />DISPATCH
                  </h3>
                  <div className="grid grid-cols-1 gap-x-[18px] gap-y-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 block text-[13px] font-medium text-slate-700">Dispatch time <span className="text-red-600">*</span></Label>
                      <Select value={assignTime} onValueChange={setAssignTime}>
                        <SelectTrigger onBlur={() => touchAssignmentField('time')} aria-label="Dispatch time" aria-required="true" aria-invalid={assignmentFieldError('time', assignTime)} className={`h-[42px] justify-start rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-none [&>span]:flex-1 [&>svg:last-child]:ml-auto ${assignmentFieldError('time', assignTime) ? 'border-red-500' : ''}`}>
                          <Clock3 className="mr-2 h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden="true" /><SelectValue placeholder="Select or type a time" />
                        </SelectTrigger>
                        <SelectContent>
                          {dispatchTimeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value} keywords={option.keywords}>{option.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {assignmentFieldError('time', assignTime) ? <p className="mt-1.5 text-sm font-medium text-red-600">Dispatch time is required.</p> : <p className="mt-1.5 text-sm text-slate-600">Truck departure from garage</p>}
                    </div>

                    <div>
                      <Label className="mb-1.5 block text-[13px] font-medium text-slate-700">Delivery type <span className="text-red-600">*</span></Label>
                      <Select value={selectedDeliveryType} onValueChange={value => setSelectedDeliveryType(value as 'Inhouse' | 'Subcon' | '')}>
                        <SelectTrigger onBlur={() => touchAssignmentField('deliveryType')} aria-required="true" aria-invalid={assignmentFieldError('deliveryType', selectedDeliveryType)} className={`h-[42px] justify-start rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 [&>span]:flex-1 [&>span]:text-left [&>svg:last-child]:ml-auto ${assignmentFieldError('deliveryType', selectedDeliveryType) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}>
                          <PackageCheck className="mr-2 h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden="true" /><SelectValue placeholder="Select or type a delivery type" />
                        </SelectTrigger>
                        <SelectContent>{DELIVERY_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select>
                      {assignmentFieldError('deliveryType', selectedDeliveryType) && <p className="mt-1 text-sm font-medium text-red-600">Delivery type is required.</p>}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-xs font-medium tracking-wider text-[#1a1f6e]">
                    <span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />RESOURCES
                  </h3>
                  <div className="grid grid-cols-1 gap-x-[18px] gap-y-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 block text-[13px] font-medium text-slate-700">Garage (vehicle location) <span className="text-red-600">*</span></Label>
                      <Select value={selectedGarage} onValueChange={setSelectedGarage}>
                        <SelectTrigger onBlur={() => touchAssignmentField('garage')} aria-required="true" aria-invalid={assignmentFieldError('garage', selectedGarage)} className={`h-[42px] justify-start rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 [&>span]:flex-1 [&>span]:text-left [&>svg:last-child]:ml-auto ${assignmentFieldError('garage', selectedGarage) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}>
                          <Warehouse className="mr-2 h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden="true" /><SelectValue placeholder="Select or type a garage" />
                        </SelectTrigger>
                        <SelectContent>{garages.map(garage => <SelectItem key={garage} value={garage}>{garage}</SelectItem>)}</SelectContent>
                      </Select>
                      {assignmentFieldError('garage', selectedGarage) && <p className="mt-1 text-sm font-medium text-red-600">Garage is required.</p>}
                    </div>

                    <div>
                      <Label className="mb-1.5 block text-[13px] font-medium text-slate-700">Vehicle <span className="text-red-600">*</span></Label>
                      <Select disabled={crewLocked} value={selectedVehicle} onValueChange={value => { setSelectedVehicle(value); setSelectedHelpers([]); setHelperSlotCount(1); }}>
                        <SelectTrigger onBlur={() => touchAssignmentField('vehicle')} aria-required="true" aria-invalid={assignmentFieldError('vehicle', selectedVehicle)} className={`h-[42px] justify-start rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 [&>span]:flex-1 [&>span]:text-left [&>svg:last-child]:ml-auto ${assignmentFieldError('vehicle', selectedVehicle) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}>
                          <TruckIcon className="mr-2 h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden="true" /><SelectValue placeholder="Select or type a vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVehicles.length === 0 && <SelectItem value="none" disabled>No available vehicles</SelectItem>}
                          {availableVehicles.map(vehicle => {
                            const brandModel = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
                            const capacity = Number(vehicle.capacity) > 0 ? `, ${vehicle.capacity}` : '';
                            return (
                              <SelectItem key={vehicle.id} value={vehicle.id} disabled={resourceTiming?.vehicles[vehicle.id]?.status === 'blocked' && vehicle.id !== selectedVehicle}>
                                <span className="font-medium">{vehicle.plate}</span> <span>&middot;</span> {brandModel || 'Model not recorded'} ({vehicle.type}{capacity}){timingNote(resourceTiming?.vehicles[vehicle.id])}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {assignmentFieldError('vehicle', selectedVehicle) && <p className="mt-1 text-sm font-medium text-red-600">Vehicle is required.</p>}
                      {currentVehicle && <p className="mt-1.5 text-sm text-slate-600">Required helpers: {currentVehicle.requiredHelpers}</p>}
                    </div>

                    <div>
                      <Label className="mb-1.5 block text-[13px] font-medium text-slate-700">Driver <span className="text-red-600">*</span></Label>
                      <Select disabled={crewLocked} value={selectedDriver} onValueChange={setSelectedDriver}>
                        <SelectTrigger onBlur={() => touchAssignmentField('driver')} aria-required="true" aria-invalid={assignmentFieldError('driver', selectedDriver)} className={`h-[42px] justify-start rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 [&>span]:flex-1 [&>span]:text-left [&>svg:last-child]:ml-auto ${assignmentFieldError('driver', selectedDriver) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}>
                          <ContactRound className="mr-2 h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden="true" /><SelectValue placeholder="Select or type a driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDrivers.length === 0 && <SelectItem value="none" disabled>No available drivers</SelectItem>}
                          {availableDrivers.map(driver => (
                            <SelectItem key={driver.id ?? (driver.empId ?? Math.random().toString())} value={driver.id ?? ''} disabled={resourceTiming?.drivers[driver.id ?? '']?.status === 'blocked' && driver.id !== selectedDriver}>
                              {(driver.fullName ?? 'Unknown')} {driver.empId ? `(${driver.empId})` : ''}{timingNote(resourceTiming?.drivers[driver.id ?? ''])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {assignmentFieldError('driver', selectedDriver) && <p className="mt-1 text-sm font-medium text-red-600">Driver is required.</p>}
                    </div>

                    <div>
                      <Label className="mb-1.5 block text-[13px] font-medium text-slate-700">Helper <span className="text-red-600">*</span></Label>
                      <div className="space-y-2">
                        {Array.from({ length: helperSlots }).map((_, index) => (
                          <div key={index}>
                            <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                            <Select disabled={crewLocked} value={selectedHelpers[index] || ''} onValueChange={value => handleHelperChange(index, value)}>
                              <SelectTrigger onBlur={() => touchAssignmentField(`helper-${index}`)} aria-label={`Helper ${index + 1}`} aria-required={index < minHelperSlots} aria-invalid={assignmentFieldError(`helper-${index}`, selectedHelpers[index])} className={`h-[42px] justify-start rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 shadow-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 [&>span]:flex-1 [&>span]:text-left [&>svg:last-child]:ml-auto ${assignmentFieldError(`helper-${index}`, selectedHelpers[index]) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}>
                                <UsersRound className="mr-2 h-[18px] w-[18px] shrink-0 text-slate-500" aria-hidden="true" /><SelectValue placeholder="Select or type a helper" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableHelpers.filter(helper => !selectedHelpers.includes(helper.id) || selectedHelpers[index] === helper.id).map(helper => <SelectItem key={helper.id} value={helper.id} disabled={resourceTiming?.helpers[helper.id]?.status === 'blocked' && selectedHelpers[index] !== helper.id}>{helper.fullName} ({helper.empId}){timingNote(resourceTiming?.helpers[helper.id])}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            </div>
                            {!crewLocked && helperSlots > minHelperSlots && (
                              <button type="button" onClick={() => handleRemoveHelperSlot(index)} aria-label={`Remove helper ${index + 1}`} title="Remove helper" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600">
                                <X className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            </div>
                            {index < minHelperSlots && assignmentFieldError(`helper-${index}`, selectedHelpers[index]) && <p className="mt-1 text-sm font-medium text-red-600">Helper {index + 1} is required.</p>}
                          </div>
                        ))}
                      </div>
                      {!crewLocked && <button type="button" onClick={handleAddHelperSlot} disabled={helperSlots >= availableHelpers.length} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#1a1f6e]/40 px-3 py-2 text-sm font-medium text-[#1a1f6e] hover:bg-[#1a1f6e]/5 disabled:cursor-not-allowed disabled:opacity-50">
                        <Plus className="h-4 w-4" aria-hidden="true" /> Add Another Helper
                      </button>}
                    </div>
                  </div>

                  {timingCheckFailed && (
                    <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      Other bookings on this date couldn't be checked yet. They'll be checked again when you confirm.
                    </p>
                  )}
                  {blockedMessages.length > 0 && (
                    <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-medium">This selection can't make it in time</p>
                        {blockedMessages.map(message => <p key={message} className="mt-0.5">{message}</p>)}
                      </div>
                    </div>
                  )}
                  {blockedMessages.length === 0 && unverifiedMessages.length > 0 && (
                    <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="flex items-start gap-2 font-medium"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Timing couldn't be checked</p>
                      {unverifiedMessages.map(message => <p key={message} className="ml-6 mt-0.5">{message}</p>)}
                      <label className="ml-6 mt-2 flex cursor-pointer items-start gap-2 font-medium">
                        <input type="checkbox" checked={travelConfirmed} onChange={event => setTravelConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a1f6e]" />
                        I checked the timing and this assignment can make it.
                      </label>
                    </div>
                  )}
                </section>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
                <button type="button" onClick={() => { setAssignTarget(null); setAssignmentTouched({}); }} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={handleAssign} disabled={!assignTime || !selectedGarage || !selectedDeliveryType || !selectedVehicle || !selectedDriver || selectedHelpers.slice(0, helperSlots).filter(Boolean).length < helperSlots || blockedMessages.length > 0 || (unverifiedMessages.length > 0 && !travelConfirmed)} className="inline-flex h-10 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#030848] px-4 text-sm font-medium text-white hover:bg-[#141a6b] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                  <Check className="h-4 w-4" aria-hidden="true" />Confirm assignment
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>}

      {/* ─── Read-only Schedule Details ─── */}
      <ScheduleDetailsDialog
        schedule={viewTarget}
        onClose={() => setViewTarget(null)}
        showDecorativeIcons={false}
        vehicle={vehicles.find(v => v.id === viewTarget?.vehicleId)?.plate}
        vehicleModel={(() => { const vehicle = vehicles.find(v => v.id === viewTarget?.vehicleId); return vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(' ') : undefined; })()}
        garage={vehicles.find(v => v.id === viewTarget?.vehicleId)?.garage}
        driver={viewTarget ? getScheduleDriver(viewTarget)?.fullName : undefined}
        helpers={viewTarget?.helperIds.map(id => helpers.find(helper => helper.id === id || helper.empId === id)?.fullName).filter(Boolean).join(', ')}
      />
    </div>
  );
}

