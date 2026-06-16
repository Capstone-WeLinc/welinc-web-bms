import { useState, useEffect } from 'react';
import { UserCheck, Truck, CalendarCheck, Search, CalendarDays, List, ChevronLeft, ChevronRight, MapPin, Home } from 'lucide-react';
import { SAMPLE_HELPERS, SAMPLE_BOOKINGS } from '../../lib/sample-data';
import { api } from '../../lib/api';
import type { Booking, ScheduleEntry, Vehicle, Driver } from '../../lib/types';
import StatusBadge from '@/components/shared/StatusBadge';
import KPICard from '../../components/shared/KpiCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { Label } from '../../components/ui/Label';
import { Input } from '../../components/ui/Input';


const GARAGES = ['Manila Hub', 'QC Depot', 'Cavite Branch', 'Laguna Branch'];
const DELIVERY_TYPES: Array<'Inhouse' | 'Subcon'> = ['Inhouse', 'Subcon'];


type ViewMode = 'list' | 'calendar';


const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(first).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}


function pad2(n: number) { return String(n).padStart(2, '0'); }

function normalizeBookingStatus(status: string) {
  if (status === 'For Correction') return 'Discrepancy';
  return status as Booking['status'];
}

function mapBookingToSchedule(booking: Booking): ScheduleEntry {
  const status = booking.status === 'Scheduled' || booking.status === 'Completed' ? 'Assigned' : 'Unassigned';
  return {
    id: booking.id,
    bookingId: booking.bookingId ?? booking.id,
    bookingStatus: normalizeBookingStatus(booking.status),
    client: booking.client,
    date: booking.date,
    time: booking.time ?? '',
    origin: booking.pickupAddress ?? 'Unknown pickup',
    destination: booking.deliveryAddress ?? 'Unknown delivery',
    garage: booking.garage ?? undefined,
    deliveryType: booking.deliveryType as 'Inhouse' | 'Subcon' | undefined,
    vehicleId: booking.vehicleId ?? null,
    driverId: booking.driverId ?? null,
    helperIds: Array.isArray(booking.helperIds) ? booking.helperIds : [],
    status,
  };
}


export default function Scheduling() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Partial<Driver>[]>([]);
  const [search, setSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState<ScheduleEntry | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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
  const [selectedGarage, setSelectedGarage] = useState('');
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'Inhouse' | 'Subcon' | ''>('');
  const [garages, setGarages] = useState<string[]>(GARAGES);


  const filtered = schedules.filter(s =>
    s.client.toLowerCase().includes(search.toLowerCase()) ||
    s.bookingId.toLowerCase().includes(search.toLowerCase())
  );


  const totalBookings = schedules.length;
  const forPlotting = schedules.filter(s => s.status === 'Unassigned').length;
  const assigned = schedules.filter(s => s.status === 'Assigned').length;


  function getAssignedOnDate(date: string, excludeId: string) {
    return schedules.filter(s => s.date === date && s.id !== excludeId && s.status === 'Assigned');
  }


  function openAssign(entry: ScheduleEntry) {
    setAssignTarget(entry);
    setAssignTime(entry.time || '');
    setSelectedVehicle(entry.vehicleId || '');
    setSelectedDriver(entry.driverId || '');
    setSelectedHelpers(entry.helperIds || []);
    setSelectedGarage(entry.garage || '');
    setSelectedDeliveryType(entry.deliveryType || '');
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
      if (response.data && response.data.length > 0) {
        setSchedules(response.data.map(mapBookingToSchedule));
      } else {
        // No bookings from API, use sample data
        setSchedules(SAMPLE_BOOKINGS.map(mapBookingToSchedule));
        console.log('Using sample booking data for scheduling display');
      }
    } catch (error) {
      console.error('Failed to load schedules from API, using sample data', error);
      // Fallback to sample data on error
      setSchedules(SAMPLE_BOOKINGS.map(mapBookingToSchedule));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshVehicles();
    refreshDrivers();
    refreshGarages();
    loadSchedules();
  }, []);


  const currentVehicle = vehicles.find(v => v.id === selectedVehicle);
  const requiredHelpers = currentVehicle?.requiredHelpers ?? 0;


  function getAvailableVehicles() {
    if (!assignTarget) return [];
    const usedIds = getAssignedOnDate(assignTarget.date, assignTarget.id).map(s => s.vehicleId).filter(Boolean);
    return vehicles.filter(v => v.status === 'Available' && !usedIds.includes(v.id));
  }


  function getAvailableDrivers() {
    if (!assignTarget) return [];
    const usedIds = getAssignedOnDate(assignTarget.date, assignTarget.id).map(s => s.driverId).filter(Boolean);
    return drivers.filter((d) => {
      const id = d.id ?? '';
      const status = d.status ?? 'Available';
      return status === 'Available' && id && !usedIds.includes(id);
    });
  }


  function getAvailableHelpers() {
    if (!assignTarget) return [];
    const usedIds = getAssignedOnDate(assignTarget.date, assignTarget.id).flatMap(s => s.helperIds);
    return SAMPLE_HELPERS.filter(h => h.status === 'Available' && !usedIds.includes(h.id));
  }


  function handleHelperChange(idx: number, value: string) {
    setSelectedHelpers(prev => { const next = [...prev]; next[idx] = value; return next; });
  }


  async function handleAssign() {
    if (!assignTarget || !selectedVehicle || !selectedDriver) return;
    const helpers = selectedHelpers.filter(Boolean).slice(0, requiredHelpers);
    
    try {
      // Call backend assign endpoint
      const payload: any = {
        time: assignTime,
        garage: selectedGarage,
        deliveryType: selectedDeliveryType || undefined,
        vehicleId: selectedVehicle,
        driverId: selectedDriver,
      };
      if (helpers.length > 0) payload.helperIds = helpers;

      const response = await api.put(`/scheduling/${assignTarget.id}/assign`, payload);
      
      // Update local state with assigned booking
      const updatedBooking = response.data;
      const updatedSchedule = mapBookingToSchedule(updatedBooking);
      
      setSchedules(prev => prev.map(s => s.id === assignTarget.id ? updatedSchedule : s));
      setAssignTarget(null);
    } catch (error) {
      console.error('Failed to assign booking', error);
      alert('Failed to assign booking. Please try again.');
    }
  }


  const availableVehicles = assignTarget ? getAvailableVehicles() : [];
  const availableDrivers = assignTarget ? getAvailableDrivers() : [];
  const availableHelpers = assignTarget ? getAvailableHelpers() : [];


  // Calendar helpers
  const calDays = getCalendarDays(calYear, calMonth);


  function getSchedulesForDay(day: number) {
    const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}`;
    return schedules.filter(s => s.date === dateStr);
  }


  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }


  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Bookings" value={String(totalBookings)} icon={CalendarCheck} iconColor="#1a1f6e" />
        <KPICard label="For Plotting" value={String(forPlotting)} icon={Truck} iconColor="#f59e0b" />
        <KPICard label="Assigned Bookings" value={String(assigned)} icon={UserCheck} iconColor="#10b981" />
      </div>


      {/* Main Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-gray-800 gap-3 flex-wrap">
          <h3 className="font-semibold text-slate-800 dark:text-white">Booking Schedule</h3>
          <div className="flex items-center gap-2">
            {viewMode === 'list' && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search booking or client..."
                  className="pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/20 dark:text-white placeholder:text-slate-400 w-52"
                />
              </div>
            )}
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-[#1a1f6e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List size={13} /> List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 text-[#1a1f6e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <CalendarDays size={13} /> Calendar
              </button>
            </div>
          </div>
        </div>


        {/* ── List View ── */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-800">
                  {['Booking No.', 'Client Name', 'Date', 'Pickup Address', 'Delivery Address', 'Garage', 'Delivery Type', 'Status', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                {filtered.map(s => {
                  const vehicle = vehicles.find(v => v.id === s.vehicleId);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[#1a1f6e] dark:text-indigo-400">{s.bookingId}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white whitespace-nowrap">{s.client}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-gray-300 whitespace-nowrap">
                        <div className="text-xs">{s.date}</div>
                        {s.time && <div className="text-[10px] text-slate-400">{s.time}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <div className="flex items-start gap-1">
                          <MapPin size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-slate-600 dark:text-gray-300 truncate">{s.origin}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <div className="flex items-start gap-1">
                          <MapPin size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-slate-700 dark:text-gray-200 truncate">{s.destination}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.garage ? (
                          <div className="flex items-center gap-1">
                            <Home size={11} className="text-slate-400" />
                            <span className="text-xs text-slate-600 dark:text-gray-300">{s.garage}</span>
                          </div>
                        ) : (
                          vehicle?.garage ? (
                            <div className="flex items-center gap-1">
                              <Home size={11} className="text-slate-400" />
                              <span className="text-xs text-slate-600 dark:text-gray-300">{vehicle.garage}</span>
                            </div>
                          ) : <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.deliveryType ? (
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${s.deliveryType === 'Inhouse' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                            {s.deliveryType}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} size="xs" />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openAssign(s)}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${s.status === 'Unassigned' ? 'bg-[#1a1f6e] text-white hover:bg-[#151b4f]' : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-200'}`}
                        >
                          {s.status === 'Unassigned' ? 'Assign' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400 dark:text-gray-500">No schedules found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}


        {/* ── Calendar View ── */}
        {viewMode === 'calendar' && (
          <div className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                <ChevronLeft size={16} className="text-slate-600 dark:text-gray-300" />
              </button>
              <h4 className="font-semibold text-slate-800 dark:text-white text-sm">
                {MONTHS[calMonth]} {calYear}
              </h4>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                <ChevronRight size={16} className="text-slate-600 dark:text-gray-300" />
              </button>
            </div>


            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-500 dark:text-gray-400 py-1">{d}</div>
              ))}
            </div>


            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calDays.map((day, idx) => {
                if (!day) return <div key={idx} className="h-24 rounded-lg" />;
                const daySchedules = getSchedulesForDay(day);
                const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}`;
                const isToday = dateStr === now.toISOString().split('T')[0];
                return (
                  <div key={idx}
                    className={`h-24 rounded-lg border p-1.5 overflow-hidden
                      ${isToday ? 'border-[#1a1f6e] bg-[#1a1f6e]/5 dark:bg-[#1a1f6e]/20' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'}
                    `}
                  >
                    <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-[#1a1f6e] dark:text-indigo-400' : 'text-slate-600 dark:text-gray-300'}`}>
                      {day}
                    </p>
                    <div className="space-y-0.5 overflow-hidden">
                      {daySchedules.slice(0, 3).map(s => (
                        <div key={s.id}
                          className={`text-[9px] font-medium px-1 py-0.5 rounded truncate cursor-pointer
                            ${s.status === 'Assigned' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}
                          title={`${s.bookingId} — ${s.client}`}
                          onClick={() => openAssign(s)}
                        >
                          {s.client.split(' ')[0]}
                        </div>
                      ))}
                      {daySchedules.length > 3 && (
                        <div className="text-[9px] text-slate-400 pl-1">+{daySchedules.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>


            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />Assigned</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />For Plotting</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1a1f6e]" />Today</div>
            </div>
          </div>
        )}
      </div>


      {/* ─── Assignment Modal ─── */}
      <Dialog open={!!assignTarget} onOpenChange={open => { if (!open) setAssignTarget(null); }}>
        <DialogContent className="max-w-lg bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck size={18} className="text-[#1a1f6e]" />
              Assign Resources — {assignTarget?.bookingId}
            </DialogTitle>
          </DialogHeader>


          {assignTarget && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
                <p className="font-medium text-slate-700 dark:text-gray-200">{assignTarget.client}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">{assignTarget.date} • {assignTarget.origin} → {assignTarget.destination}</p>
              </div>


              {/* Time */}
              <div>
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Dispatch Time</Label>
                <Input type="time" value={assignTime} onChange={e => setAssignTime(e.target.value)} className="h-9 text-sm" />
              </div>


              {/* Garage */}
              <div>
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Garage (Vehicle Location)</Label>
                <Select value={selectedGarage} onValueChange={setSelectedGarage}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select garage..." /></SelectTrigger>
                    <SelectContent>
                      {garages.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>

              {/* Delivery Type */}
              <div>
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Delivery Type</Label>
                <Select value={selectedDeliveryType} onValueChange={value => setSelectedDeliveryType(value as 'Inhouse' | 'Subcon' | '')}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select delivery type..." /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              {/* Vehicle */}
              <div>
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">
                  Vehicle <span className="text-slate-400">({availableVehicles.length} available)</span>
                </Label>
                <Select value={selectedVehicle} onValueChange={v => { setSelectedVehicle(v); setSelectedHelpers([]); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                  <SelectContent>
                    {availableVehicles.length === 0 && <SelectItem value="none" disabled>No available vehicles</SelectItem>}
                    {availableVehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="font-medium">{v.plate}</span> — {v.alias} ({v.type}, {v.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentVehicle && (
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    Required helpers: <strong>{currentVehicle.requiredHelpers}</strong>
                  </p>
                )}
              </div>


              {/* Driver */}
              <div>
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">
                  Driver <span className="text-slate-400">({availableDrivers.length} available)</span>
                </Label>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select driver..." /></SelectTrigger>
                  <SelectContent>
                    {availableDrivers.length === 0 && <SelectItem value="none" disabled>No available drivers</SelectItem>}
                    {availableDrivers.map(d => (
                      <SelectItem key={d.id ?? (d.empId ?? Math.random().toString())} value={d.id ?? ''}>
                        {(d.fullName ?? 'Unknown')} {(d.empId ? `(${d.empId})` : '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              {/* Helpers */}
              {requiredHelpers > 0 && (
                <div>
                  <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">
                    Helpers ({requiredHelpers} required) <span className="text-slate-400">({availableHelpers.length} available)</span>
                  </Label>
                  <div className="space-y-2">
                    {Array.from({ length: requiredHelpers }).map((_, idx) => (
                      <Select key={idx} value={selectedHelpers[idx] || ''} onValueChange={v => handleHelperChange(idx, v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder={`Helper ${idx + 1}...`} /></SelectTrigger>
                        <SelectContent>
                          {availableHelpers
                            .filter(h => !selectedHelpers.includes(h.id) || selectedHelpers[idx] === h.id)
                            .map(h => <SelectItem key={h.id} value={h.id}>{h.fullName} ({h.empId})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ))}
                  </div>
                </div>
              )}


              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setAssignTarget(null)} className="px-4 py-2 text-sm bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-slate-200 cursor-pointer">Cancel</button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedVehicle || !selectedDriver}
                  className="px-4 py-2 text-sm bg-[#1a1f6e] text-white rounded-lg hover:bg-[#151b4f] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}