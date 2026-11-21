import { apiProblem } from '../../lib/api-shapes';
import { StatusFilter } from '../../components/ui/ListSearchFilters';
import ModalHeader from '../../components/ui/ModalHeader';
import ScheduleDetailsDialog from '../../components/shared/ScheduleDetailsDialog';
import TablePagination from '../../components/ui/TablePagination';
import { useEffect, useMemo, useState } from 'react';
import { Search, CalendarDays, List, Eye, Pencil, UserCheck, ChevronLeft, ChevronRight, MoreVertical, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import type { ScheduleEntry, Vehicle, Driver, Booking, Helper } from '../../lib/types';
import StatusBadge from '../../components/shared/StatusBadge';
import {
  Dialog,
  DialogContent,
} from '../../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/Dropdown';

const GARAGES = ['Manila Hub', 'QC Depot', 'Cavite Branch', 'Laguna Branch'];
const DELIVERY_TYPES: Array<'Inhouse' | 'Subcon'> = ['Inhouse', 'Subcon'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type AssignmentField = 'time' | 'vehicle' | 'driver' | 'garage' | 'deliveryType' | 'helpers';
const EMPTY_ASSIGNMENT_TOUCHED: Record<AssignmentField, boolean> = {
  time: false, vehicle: false, driver: false, garage: false, deliveryType: false, helpers: false,
};

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(first).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

export default function OperationsScheduling() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const [assignTarget, setAssignTarget] = useState<ScheduleEntry | null>(null);
  const [viewTarget, setViewTarget] = useState<ScheduleEntry | null>(null);
  const [assignTime, setAssignTime] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>([]);
  const [helperSlotCount, setHelperSlotCount] = useState(1);
  const [selectedGarage, setSelectedGarage] = useState('');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'Inhouse' | 'Subcon' | ''>('');
  const [assigning, setAssigning] = useState(false);
  const [assignmentTouched, setAssignmentTouched] = useState<Record<AssignmentField, boolean>>(EMPTY_ASSIGNMENT_TOUCHED);
  const currentVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicle);
  // Minimum number of helper fields that must be filled; users may add more via "Add Another Helper".
  const minHelperSlots = Math.max(1, currentVehicle?.requiredHelpers ?? 1);
  const helperSlots = Math.max(minHelperSlots, helperSlotCount);
  const assignableHelpers = helpers.filter((helper) => helper.status === 'Available' || selectedHelpers.includes(helper.id));
  // Crew leave (spec bms/0003): who is away on the trip's date, and which trips still have someone on leave.
  const [crewLeave, setCrewLeave] = useState<Array<{ crewId: string; crewName: string; startDate: string; endDate: string; kind: string }>>([]);
  const [crewConflicts, setCrewConflicts] = useState<Array<{ bookingUuid: string; crewName: string; kind: string }>>([]);
  const assignDate = String(assignTarget?.date ?? '').slice(0, 10);
  const leaveOn = (crewId: string) => crewLeave.find((item) => item.crewId === crewId && assignDate >= item.startDate && assignDate <= item.endDate);
  const leaveNote = (crewId: string) => { const away = leaveOn(crewId); return away ? ` — on ${away.kind === 'EMERGENCY' ? 'emergency leave' : 'leave'} until ${away.endDate}` : ''; };

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      api.get<ScheduleEntry[]>('/scheduling'),
      api.get<Vehicle[]>('/bms/config/vehicles'),
      api.get<Driver[]>('/bms/config/drivers'),
      api.get<Booking[]>('/booking'),
      api.get<Helper[]>('/bms/config/helpers'),
    ])
      .then(([sRes, vRes, dRes, bRes, hRes]) => {
        if (mounted) {
          setSchedules(sRes.data ?? []);
          setVehicles(vRes.data ?? []);
          setDrivers(dRes.data ?? []);
          setBookings(bRes.data ?? []);
          setHelpers(hRes.data ?? []);
        }
      })
      .catch(() => {
        if (mounted) toast.error('Failed to load scheduling data');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    // Leave data only adds warnings; the page still works if it can't load.
    Promise.all([api.get('/crew-leave/active'), api.get('/crew-leave/conflicts')])
      .then(([active, conflicts]) => {
        if (!mounted) return;
        setCrewLeave(Array.isArray(active.data) ? active.data : []);
        setCrewConflicts(Array.isArray(conflicts.data) ? conflicts.data : []);
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = s.client.toLowerCase().includes(q) || (s.bookingNo ?? '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' ? true : s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [schedules, search, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage, rowsPerPage]);



  const calendarDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const schedulesByDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    schedules.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [schedules]);

  async function handleAssign() {
    if (!assignTarget) return;
    const allTouched = { time: true, vehicle: true, driver: true, garage: true, deliveryType: true, helpers: true };
    if (!assignTime || !selectedVehicle || !selectedDriver || !selectedGarage || !selectedDeliveryType || selectedHelpers.slice(0, minHelperSlots).filter(Boolean).length < minHelperSlots) {
      setAssignmentTouched(allTouched);
      toast.error('Please complete all required assignment fields');
      return;
    }
    setAssigning(true);
    try {
      await api.put(`/scheduling/${assignTarget.id}/assign`, {
        vehicleId: selectedVehicle || undefined,
        driverId: selectedDriver || undefined,
        garage: selectedGarage || undefined,
        deliveryType: selectedDeliveryType || undefined,
        dispatchTime: assignTime || undefined,
        helperIds: [...new Set(selectedHelpers.slice(0, helperSlots).filter(Boolean))],
      });
      toast.success('Truck and team assigned');
      setAssignTarget(null);
      // Refresh
      const { data } = await api.get<ScheduleEntry[]>('/scheduling');
      setSchedules(data ?? []);
    } catch (err: unknown) {
      toast.error(apiProblem(err).message || 'Failed to assign booking');
    } finally {
      setAssigning(false);
    }
  }

  function openAssign(s: ScheduleEntry) {
    setAssignTarget(s);
    setAssignTime(s.dispatchTime || '');
    setSelectedVehicle(s.vehicleId || '');
    setSelectedDriver(s.driverId || '');
    setSelectedHelpers(s.helperIds || []);
    setHelperSlotCount(Math.max(1, s.helperIds?.length ?? 0));
    setSelectedGarage(s.garage || '');
    setSelectedDeliveryType(s.deliveryType || '');
    setAssignmentTouched(EMPTY_ASSIGNMENT_TOUCHED);
  }

  const touchAssignmentField = (field: AssignmentField) => {
    setAssignmentTouched((current) => ({ ...current, [field]: true }));
  };

  const fieldError = (field: AssignmentField, value: string) => assignmentTouched[field] && !value;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0a0f2e] tracking-tight">SCHEDULING</h1>
          <p className="text-sm text-slate-500 mt-1">
            Schedule bookings and assigns <span className="text-[#d4a72c] font-medium">trucks and teams</span>.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search booking no. or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a0f2e]/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <StatusFilter options={['All', 'Assigned', 'Unassigned'] as const} value={statusFilter} onChange={setStatusFilter} />
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#1a1f6e] text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg ${viewMode === 'calendar' ? 'bg-[#1a1f6e] text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-600'}`}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="rounded-none border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full table-auto text-sm">
              <thead className="bg-[#1a1f6e]">
                <tr>
                  {['BOOKING NO.', 'CLIENT', 'SERVICE DATE', 'TRUCK', 'TEAM', 'PICKUP ADDRESS', 'DELIVERY ADDRESS', 'BRANCH', 'DELIVERY TYPE', 'STATUS', 'ACTIONS'].map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">No schedules found.</td></tr>
                ) : (
                  paginated.map((s) => {
                    const booking = bookings.find((b) => b.bookingId === s.bookingId || b.id === s.bookingId);
                    const truck = vehicles.find((v) => v.id === s.vehicleId)?.plate || s.truck || null;
                    const driver = drivers.find((d) => d.id === s.driverId);
                    const team = s.team || (driver ? driver.fullName : null);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="min-w-[190px] pr-6 px-4 py-2.5 text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">{s.bookingNo ?? booking?.bookingNo ?? '-'}</td>
                        <td className="min-w-[160px] px-4 py-2.5 text-sm font-semibold text-slate-900">{s.client}</td>
                        <td className="min-w-[110px] px-4 py-2.5 text-sm text-slate-900 tabular-nums whitespace-nowrap">{s.date}</td>
                        <td className={`min-w-[110px] px-4 py-2.5 text-sm whitespace-nowrap ${truck ? 'text-slate-700' : 'text-slate-500'}`}>{truck || 'Not assigned'}</td>
                        <td className={`min-w-[110px] px-4 py-2.5 text-sm whitespace-nowrap ${team ? 'text-slate-700' : 'text-slate-500'}`}>{team || 'Not assigned'}</td>
                        <td className="max-w-[200px] px-4 py-2.5 text-sm text-slate-900" title={s.origin}><span className="block max-w-[200px] truncate">{s.origin}</span></td>
                        <td className="max-w-[200px] px-4 py-2.5 text-sm text-slate-900" title={s.destination}><span className="block max-w-[200px] truncate">{s.destination}</span></td>
                        <td className={`px-4 py-2.5 text-sm whitespace-nowrap ${s.garage ? 'text-slate-700' : 'text-slate-500'}`}>{s.garage || '-'}</td>
                        <td className="px-4 py-2.5">
                          {s.deliveryType ? (
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                              s.deliveryType === 'Inhouse' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {s.deliveryType === 'Inhouse' ? 'IN HOUSE' : 'SUBCON'}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={s.status} />
                          {crewConflicts.some((item) => item.bookingUuid === s.id) && (
                            <span title={crewConflicts.filter((item) => item.bookingUuid === s.id).map((item) => `${item.crewName} is on ${item.kind === 'EMERGENCY' ? 'emergency leave' : 'leave'}`).join('\n')}
                              className="mt-1 block w-fit whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              Crew unavailable – reassign
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" aria-label="Row actions" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-36 rounded-xl border-slate-200 bg-white p-1 shadow-lg">
                            {s.status === 'Unassigned' ? (
                              <DropdownMenuItem onSelect={() => openAssign(s)} className="gap-2 rounded-lg px-3 py-2 text-sm text-slate-700">
                                <UserCheck className="h-4 w-4" /> Assign
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onSelect={() => setViewTarget(s)} className="gap-2 rounded-lg px-3 py-2 text-sm text-slate-700"><Eye className="h-4 w-4" /> View</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => openAssign(s)} className="gap-2 rounded-lg px-3 py-2 text-sm text-slate-700"><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                              </>
                            )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <TablePagination page={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={rowsPerPage} onPageChange={setCurrentPage} onPageSizeChange={size => { setRowsPerPage(size); setCurrentPage(1); }} />
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {MONTHS[calMonth]} {calYear}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
                  else setCalMonth((m) => m - 1);
                }}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
                  else setCalMonth((m) => m + 1);
                }}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden">
            {DAYS_SHORT.map((d) => (
              <div key={d} className="bg-slate-50 dark:bg-slate-900 p-3 text-center text-xs font-semibold text-slate-500 uppercase">
                {d}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              const dateStr = day ? `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}` : '';
              const daySchedules = dateStr ? schedulesByDate[dateStr] || [] : [];
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-800 min-h-[100px] p-2"
                >
                  {day && (
                    <>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{day}</span>
                      <div className="mt-1 space-y-1">
                        {daySchedules.slice(0, 3).map((s) => (
                          <div
                            key={s.id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 truncate cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                            onClick={() => setViewTarget(s)}
                          >
                            {s.client}
                          </div>
                        ))}
                        {daySchedules.length > 3 && (
                          <div className="text-[10px] text-slate-500">+{daySchedules.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={() => { setAssignTarget(null); setAssignmentTouched(EMPTY_ASSIGNMENT_TOUCHED); }}>
        <DialogContent hideCloseButton aria-describedby={undefined} className="!flex !flex-col w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] min-h-0 overflow-hidden rounded-2xl border-0 bg-white p-0 gap-0 shadow-xl">
          <ModalHeader
            icon={UserCheck}
            title={assignTarget?.status === 'Assigned' ? 'Edit assignment' : 'Assign booking'}
            subtitle={assignTarget?.bookingNo || undefined}
            closeLabel="Close assign booking"
          />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <Label>Booking <span className="text-red-500">*</span></Label>
              <Input value={assignTarget?.bookingNo || '-'} disabled />
            </div>
            <div>
              <Label htmlFor="assignment-time">Time <span className="text-red-500">*</span></Label>
              <Input id="assignment-time" type="time" required value={assignTime} onChange={(e) => setAssignTime(e.target.value)} onBlur={() => touchAssignmentField('time')} aria-invalid={fieldError('time', assignTime)} className={fieldError('time', assignTime) ? 'border-red-500 focus-visible:ring-red-500' : ''} />
              {fieldError('time', assignTime) && <p className="mt-1 text-xs font-medium text-red-600">Time is required.</p>}
            </div>
            <div>
              <Label>Truck <span className="text-red-500">*</span></Label>
              <Select value={selectedVehicle} onValueChange={(value) => { setSelectedVehicle(value); setSelectedHelpers([]); setHelperSlotCount(1); }}>
                <SelectTrigger onBlur={() => touchAssignmentField('vehicle')} aria-required="true" aria-invalid={fieldError('vehicle', selectedVehicle)} className={fieldError('vehicle', selectedVehicle) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}>
                  <SelectValue placeholder="Select or type a truck" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.filter((v) => v.status === 'Available' || v.id === selectedVehicle).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plateNumber || v.plate} ({v.alias || v.model})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError('vehicle', selectedVehicle) && <p className="mt-1 text-xs font-medium text-red-600">Truck is required.</p>}
            </div>
            <div>
              <Label>Driver / Team <span className="text-red-500">*</span></Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger onBlur={() => touchAssignmentField('driver')} aria-required="true" aria-invalid={fieldError('driver', selectedDriver)} className={fieldError('driver', selectedDriver) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}>
                  <SelectValue placeholder="Select or type a driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id} disabled={!!leaveOn(d.id)}>{d.fullName}{leaveNote(d.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError('driver', selectedDriver) && <p className="mt-1 text-xs font-medium text-red-600">Driver / Team is required.</p>}
              {selectedDriver && leaveOn(selectedDriver) && <p className="mt-1 text-xs font-medium text-red-600">This driver is on leave on {assignDate}. Choose someone else.</p>}
            </div>
            {Array.from({ length: helperSlots }, (_, index) => {
              const required = index < minHelperSlots;
              const showError = required && assignmentTouched.helpers && !selectedHelpers[index];
              return (
                <div key={index}>
                  <Label>Helper {helperSlots > 1 ? index + 1 : ''} {required ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-500">(optional)</span>}</Label>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select value={selectedHelpers[index] || ''} onValueChange={(value) => setSelectedHelpers((current) => {
                        const next = [...current];
                        next[index] = value;
                        return next;
                      })}>
                        <SelectTrigger onBlur={() => touchAssignmentField('helpers')} aria-required={required} aria-invalid={showError} className={showError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}>
                          <SelectValue placeholder="Select or type a helper" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableHelpers.filter((helper) => !selectedHelpers.includes(helper.id) || selectedHelpers[index] === helper.id).map((helper) => (
                            <SelectItem key={helper.id} value={helper.id} disabled={!!leaveOn(helper.id)}>{helper.fullName}{leaveNote(helper.id)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {helperSlots > minHelperSlots && (
                      <button type="button" onClick={() => {
                        setSelectedHelpers((current) => current.slice(0, helperSlots).filter((_, i) => i !== index));
                        setHelperSlotCount(Math.max(1, helperSlots - 1));
                      }} aria-label={`Remove helper ${index + 1}`} title="Remove helper" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {showError && <p className="mt-1 text-xs font-medium text-red-600">Helper is required.</p>}
                  {selectedHelpers[index] && leaveOn(selectedHelpers[index]) && <p className="mt-1 text-xs font-medium text-red-600">This helper is on leave on {assignDate}. Choose someone else.</p>}
                </div>
              );
            })}
            <div>
              <button type="button" onClick={() => setHelperSlotCount(helperSlots + 1)} disabled={helperSlots >= assignableHelpers.length} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-400 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add Another Helper
              </button>
            </div>
            <div>
              <Label>Garage / Branch <span className="text-red-500">*</span></Label>
              <Select value={selectedGarage} onValueChange={setSelectedGarage}>
                <SelectTrigger onBlur={() => touchAssignmentField('garage')} aria-required="true" aria-invalid={fieldError('garage', selectedGarage)} className={fieldError('garage', selectedGarage) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}>
                  <SelectValue placeholder="Select or type a garage" />
                </SelectTrigger>
                <SelectContent>
                  {GARAGES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError('garage', selectedGarage) && <p className="mt-1 text-xs font-medium text-red-600">Garage / Branch is required.</p>}
            </div>
            <div>
              <Label>Delivery Type <span className="text-red-500">*</span></Label>
              <Select value={selectedDeliveryType} onValueChange={(v) => setSelectedDeliveryType(v as 'Inhouse' | 'Subcon')}>
                <SelectTrigger onBlur={() => touchAssignmentField('deliveryType')} aria-required="true" aria-invalid={fieldError('deliveryType', selectedDeliveryType)} className={fieldError('deliveryType', selectedDeliveryType) ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}>
                  <SelectValue placeholder="Select or type a delivery type" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError('deliveryType', selectedDeliveryType) && <p className="mt-1 text-xs font-medium text-red-600">Delivery Type is required.</p>}
            </div>
            <button
              onClick={handleAssign}
              disabled={assigning}
              className="w-full rounded-xl bg-[#1a1f6e] hover:bg-[#151b4f] text-white font-semibold py-2.5 disabled:opacity-60"
            >
              {assigning ? 'Saving...' : assignTarget?.status === 'Assigned' ? 'Update Assignment' : 'Assign Booking'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <ScheduleDetailsDialog
        schedule={viewTarget}
        onClose={() => setViewTarget(null)}
        vehicle={(() => { const vehicle = vehicles.find(v => v.id === viewTarget?.vehicleId); return vehicle?.plate || vehicle?.plateNumber; })()}
        vehicleModel={(() => { const vehicle = vehicles.find(v => v.id === viewTarget?.vehicleId); return vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(' ') : undefined; })()}
        garage={vehicles.find(v => v.id === viewTarget?.vehicleId)?.garage}
        driver={drivers.find(d => d.id === viewTarget?.driverId)?.fullName}
        helpers={viewTarget?.helperIds?.map(id => helpers.find(helper => helper.id === id || helper.empId === id)?.fullName).filter(Boolean).join(', ')}
      />
    </div>
  );
}
