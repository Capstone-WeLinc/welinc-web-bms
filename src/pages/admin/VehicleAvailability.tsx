import type { ApiCrew } from '../../lib/api-shapes';
import { apiProblem } from '../../lib/api-shapes';
import { StatusFilter } from '../../components/ui/ListSearchFilters';
import PageHeader from '../../components/pageheader/Pageheader';
import { type ReactNode, useEffect, useState } from 'react';
import { AlertCircle, BusFront, CalendarDays, CheckCircle2, ChevronDown, Contact, Eye, MapPinned, MoreVertical, Pencil, Search, Trash2, Truck, User, UserCheck, UserRoundX, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import CrewEditDialog from '../../components/availability/CrewEditDialog';
import type { CrewMember, CrewRole } from '../../lib/api/crewService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/Dropdown';
import DeleteConfirmModal from '../../components/shared/DeleteConfirmModal';
import ModalHeader from '../../components/ui/ModalHeader';
import { api } from '../../lib/api';
import { formatPhoneLocal } from '../../lib/phone';
import type { CrewStatus, Driver, Helper, Vehicle, VehicleStatus } from '../../lib/types';
import { Dialog, DialogContent } from '../../components/ui/Dialog';

type ActiveTab = 'vehicles' | 'drivers' | 'helpers';

type DisplayVehicleStatus = 'Available' | 'Assigned' | 'Under Maintenance' | 'Under Repair';

type VehicleCrewMember = { id: string; name: string; initials?: string };
type VehicleAvailabilityRecord = Vehicle & {
  plateNumber?: string;
  truckTypeId?: string;
  dimensions?: string | null;
  capacityKg?: number | null;
  requiredHelpersMin?: number;
  requiredHelpersMax?: number;
  driver?: VehicleCrewMember | null;
  helpers?: VehicleCrewMember[];
  currentAssignment?: {
    bookingNumber?: string | null;
    jobOrderNumber?: string | null;
    service?: string | null;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    route?: string | null;
  } | null;
  upcomingSchedule?: Array<{ date: string; time?: string | null; bookingNumber: string; locationCode: string }>;
  statusDetails?: { reason?: string | null; since?: string | null; expectedBack?: string | null; remarks?: string | null } | null;
};

const VEHICLE_FILTERS: Array<DisplayVehicleStatus | 'All'> = ['All', 'Available', 'Assigned', 'Under Maintenance', 'Under Repair'];
const DRIVER_FILTERS: Array<CrewStatus | 'All'> = ['All', 'Available', 'On Duty', 'On Leave'];
const HELPER_FILTERS: Array<CrewStatus | 'All'> = ['All', 'Available', 'On Duty', 'On Leave'];

function displayHelperStatus(status?: string | null): CrewStatus {
  const normalized = (status || 'Available').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return normalized === 'off duty' ? 'Available' : (status || 'Available') as CrewStatus;
}

// Cards sit 2 or 3 across, so each batch is a multiple of 6 to keep every row full.
const CARD_BATCH = 12;

function normalizeHelper(helper: Helper): Helper {
  return { ...helper, status: displayHelperStatus(helper.status), initials: helper.initials || getInitials(helper.fullName) };
}

function mapVehicleStatus(status?: string): VehicleStatus {
  switch (status) {
    case 'AVAILABLE':
    case 'Available':
      return 'Available';
    case 'IN_TRANSIT':
    case 'In Transit':
      return 'In Transit';
    case 'UNDER_MAINTENANCE':
    case 'Under Maintenance':
      return 'Under Maintenance';
    case 'UNDER_REPAIR':
    case 'Under Repair':
      return 'Under Repair';
    default:
      return 'Available';
  }
}

function normalizeVehicle(vehicle: Partial<Omit<VehicleAvailabilityRecord, 'status'>> & {status?:string}): VehicleAvailabilityRecord {
  const plate = vehicle.plateNumber || vehicle.plate || '—';
  return {
    id: vehicle.id || plate,
    plate,
    alias: vehicle.alias || plate,
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    type: vehicle.type || 'Truck',
    year: vehicle.year || new Date().getFullYear(),
    capacity: vehicle.capacity || '',
    color: vehicle.color || '',
    fuel: vehicle.fuel || '',
    status: mapVehicleStatus(vehicle.status),
    requiredHelpers: vehicle.requiredHelpers || 0,
    mileage: vehicle.mileage || 0,
    regExpiry: vehicle.regExpiry || '',
    insExpiry: vehicle.insExpiry || '',
    lastMaintenance: vehicle.lastMaintenance || '',
    nextMaintenance: vehicle.nextMaintenance || '',
    driverId: vehicle.driverId || null,
    isAssigned: Boolean(vehicle.isAssigned),
    garage: vehicle.garage || '',
    truckTypeId: vehicle.truckTypeId || vehicle.type || '',
    dimensions: vehicle.dimensions || '',
    capacityKg: vehicle.capacityKg ?? null,
    requiredHelpersMin: vehicle.requiredHelpersMin ?? vehicle.requiredHelpers ?? 0,
    requiredHelpersMax: vehicle.requiredHelpersMax ?? vehicle.requiredHelpers ?? 0,
    driver: vehicle.driver || null,
    helpers: Array.isArray(vehicle.helpers) ? vehicle.helpers : [],
    currentAssignment: vehicle.currentAssignment || null,
    upcomingSchedule: Array.isArray(vehicle.upcomingSchedule) ? vehicle.upcomingSchedule : [],
    statusDetails: vehicle.statusDetails || null,
  };
}

function normalizeDriver(driver: ApiCrew): Driver {
  const fullName = driver.fullName || driver.name || '';
  return {
    id: driver.id || '',
    empId: driver.empId || '',
    fullName,
    initials: driver.initials || getInitials(fullName),
    contact: driver.contact || '',
    email: driver.email || '',
    address: driver.address || '',
    licenseNo: driver.licenseNo || driver.licenseNumber || '',
    licenseType: driver.licenseType || 'Professional',
    licenseExpiry: driver.licenseExpiry || '',
    status: displayHelperStatus(driver.status || driver.crewStatus),
    totalTrips: driver.totalTrips || 0,
    joinDate: driver.joinDate || '',
    emergencyName: driver.emergencyName || '',
    emergencyContact: driver.emergencyContact || '',
    vehicleId: driver.vehicleId || null,
  };
}

function formatContactForDisplay(contact?: string | null) {
  if (!contact?.trim()) return '';
  return formatPhoneLocal(contact);
}

function fullVehicleModel(vehicle: Vehicle) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '-';
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

// "Assigned" means booked today. A truck is free on every other date, even with a regular driver.
function getDisplayVehicleStatus(vehicle: Vehicle): DisplayVehicleStatus {
  const backendStatus = vehicle.status;
  if (backendStatus === 'Under Maintenance') return 'Under Maintenance';
  if (backendStatus === 'Under Repair') return 'Under Repair';
  if (backendStatus === 'In Transit') return 'Assigned';
  if (backendStatus === 'Available') return vehicle.isAssigned ? 'Assigned' : 'Available';
  return 'Available';
}

export default function VehicleAvailability({ canManage = true }: { canManage?: boolean }) {
  const [editTarget, setEditTarget] = useState<{ role: CrewRole; id: string } | null>(null);
  const [vehicles, setVehicles] = useState<VehicleAvailabilityRecord[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState(false);
  const [vehicleRetry, setVehicleRetry] = useState(0);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('vehicles');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [visibleCount, setVisibleCount] = useState(CARD_BATCH);

  const [viewVehicle, setViewVehicle] = useState<VehicleAvailabilityRecord | null>(null);
  const [viewDriver, setViewDriver] = useState<Driver | null>(null);
  const [viewHelper, setViewHelper] = useState<Helper | null>(null);

  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null);

  const [deleteHelper, setDeleteHelper] = useState<Helper | null>(null);

  useEffect(() => {
    let mounted = true;

    setVehiclesLoading(true);
    setVehiclesError(false);
    api.get<Array<Partial<Omit<VehicleAvailabilityRecord, 'status'>> & {status?:string}>>('/bms/config/vehicles/availability')
      .then((response) => {
        if (mounted) setVehicles((response.data ?? []).map(normalizeVehicle));
      })
      .catch((error) => {
        console.error('Failed to load vehicle availability', error);
        if (mounted) setVehiclesError(true);
      })
      .finally(() => { if (mounted) setVehiclesLoading(false); });

    api.get<ApiCrew[]>('/bms/config/drivers')
      .then((response) => {
        if (mounted && response.data.length > 0) {
          const fetched = response.data.map(normalizeDriver);
          setDrivers(prev => {
            const map = new Map(prev.map(d => [d.id, d]));
            fetched.forEach(d => map.set(d.id, d));
            return Array.from(map.values());
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load drivers, using sample data', error);
      });

    api.get<Helper[]>('/bms/config/helpers')
      .then((response) => {
        if (mounted) setHelpers((response.data ?? []).map(normalizeHelper));
      })
      .catch((error) => console.error('Failed to load helpers', error));

    return () => {
      mounted = false;
    };
  }, [vehicleRetry]);

  const activeFilters = activeTab === 'vehicles' ? VEHICLE_FILTERS : activeTab === 'helpers' ? HELPER_FILTERS : DRIVER_FILTERS;
  const searchPlaceholder = activeTab === 'vehicles'
    ? 'Search vehicles...'
    : activeTab === 'drivers'
      ? 'Search drivers...'
      : 'Search helpers...';

  const filteredVehicles = vehicles.filter((vehicle) => {
    const query = search.toLowerCase();
    const displayStatus = getDisplayVehicleStatus(vehicle);
    const matchesSearch = [
      vehicle.plate,
      vehicle.alias,
      vehicle.type,
      vehicle.brand,
      vehicle.model,
      fullVehicleModel(vehicle),
      vehicle.driver?.name || '',
      ...(vehicle.helpers || []).map(helper => helper.name),
      vehicle.garage || '',
    ].some(value => String(value || '').toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'All' || displayStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredDrivers = drivers.filter((driver) => {
    const query = search.toLowerCase();
    const matchesSearch = [
      driver.empId,
      driver.fullName,
      driver.contact,
      driver.email,
      driver.licenseNo,
      driver.licenseType,
    ].some(value => (value || '').toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'All' || displayHelperStatus(driver.status) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredHelpers = helpers.filter((helper) => {
    const query = search.toLowerCase();
    const matchesSearch = [helper.empId, helper.fullName, helper.contact]
      .some(value => value.toLowerCase().includes(query));
    const matchesStatus = statusFilter === 'All' || displayHelperStatus(helper.status) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filtered = activeTab === 'vehicles' ? filteredVehicles : activeTab === 'drivers' ? filteredDrivers : filteredHelpers;

  const paginated = filtered.slice(0, visibleCount);
  const remaining = filtered.length - paginated.length;

  // A new tab, search or filter starts again from the first batch.
  useEffect(() => {
    setVisibleCount(CARD_BATCH);
  }, [search, statusFilter, activeTab]);

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    setSearch('');
    setStatusFilter('All');
  }

  /** Show a saved edit on the card straight away, without reloading the tab. */
  function applyCrewUpdate(member: CrewMember) {
    const shared = {
      fullName: member.fullName,
      initials: getInitials(member.fullName),
      contact: member.contact,
      email: member.email,
      status: member.status,
      joinDate: member.joinDate,
      emergencyName: member.emergencyName,
      emergencyContact: member.emergencyContact,
    };
    if (member.role === 'DRIVER') {
      setDrivers(prev => prev.map(driver => driver.id === member.id
        ? { ...driver, ...shared, licenseNo: member.licenseNo, licenseType: member.licenseType, licenseExpiry: member.licenseExpiry }
        : driver));
    } else {
      setHelpers(prev => prev.map(helper => (helper.id === member.id ? { ...helper, ...shared } : helper)));
    }
  }

  async function softDeleteDriver() {
    if (!deleteDriver) return;
    await api.delete(`/bms/config/drivers/${deleteDriver.id}`);
    setDrivers(prev => prev.filter(driver => driver.id !== deleteDriver.id));
    setViewDriver(prev => (prev?.id === deleteDriver.id ? null : prev));
    toast.success('Driver deleted', { description: `${deleteDriver.fullName} was removed from the list.` });
    setDeleteDriver(null);
  }

  async function softDeleteHelper() {
    if (!deleteHelper) return;
    await api.delete(`/bms/config/helpers/${deleteHelper.id}`);
    setHelpers(prev => prev.filter(helper => helper.id !== deleteHelper.id));
    setViewHelper(prev => (prev?.id === deleteHelper.id ? null : prev));
    toast.success('Helper deleted', { description: `${deleteHelper.fullName} was removed from the list.` });
    setDeleteHelper(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCheck}
        title="VEHICLE & TEAM AVAILABILITY"
        subtitle={<>Monitor vehicle status and <span className="font-medium text-[#d4a72c]">team availability in real time</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
      />

      {/* Tabs and search, laid out like Services Offered */}
      <section className="space-y-6">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
          <TabButton active={activeTab === 'vehicles'} icon={<Truck size={17} />} label="Vehicles" onClick={() => handleTabChange('vehicles')} />
          <TabButton active={activeTab === 'drivers'} icon={<Contact size={17} />} label="Drivers" onClick={() => handleTabChange('drivers')} />
          <TabButton active={activeTab === 'helpers'} icon={<Users size={17} />} label="Helpers" onClick={() => handleTabChange('helpers')} />
        </div>
        <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
          <label className="relative block w-full lg:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#0a0f2e]/20"
            />
          </label>
          <StatusFilter options={activeFilters as string[]} value={statusFilter} onChange={setStatusFilter} />
        </div>
      </section>

      {/* Availability table */}
      <div>
        <div>
          {activeTab === 'vehicles' && (
            vehiclesLoading ? <VehicleGridSkeleton /> : vehiclesError ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/70 bg-white text-center shadow-sm">
                <AlertCircle className="h-8 w-8 text-rose-500" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-800">Vehicle data could not be loaded.</p>
                <button type="button" onClick={() => setVehicleRetry(value => value + 1)} className="rounded-lg bg-[#1a1f6e] px-4 py-2 text-sm font-medium text-white">Retry</button>
              </div>
            ) : <VehicleGrid
              vehicles={paginated as VehicleAvailabilityRecord[]}
              onView={setViewVehicle}
            />
          )}
          {activeTab === 'drivers' && (
            <DriverGrid
              drivers={paginated as Driver[]}
              truckFor={driver => vehicles.find(vehicle => vehicle.driver?.id === driver.id) ?? null}
              onView={setViewDriver}
              onEdit={driver => setEditTarget({ role: 'DRIVER', id: driver.id })}
              onDelete={setDeleteDriver}
              canManage={canManage}
            />
          )}
          {activeTab === 'helpers' && (
            <HelperGrid
              helpers={paginated as Helper[]}
              truckFor={helper => vehicles.find(vehicle => vehicle.helpers?.some(member => member.id === helper.id)) ?? null}
              onView={setViewHelper}
              onEdit={helper => setEditTarget({ role: 'HELPER', id: helper.id })}
              onDelete={setDeleteHelper}
              canManage={canManage}
            />
          )}
        </div>

        {filtered.length > 0 && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="text-sm text-slate-500">Showing {paginated.length} of {filtered.length}</p>
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setVisibleCount(count => count + CARD_BATCH)}
                className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-[#1a1f6e] shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30"
              >
                Show more
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <VehicleDetails vehicle={viewVehicle} onClose={() => setViewVehicle(null)} />
      <DriverDetails driver={viewDriver} onClose={() => setViewDriver(null)} />
      <HelperDetails helper={viewHelper} onClose={() => setViewHelper(null)} />
      <CrewEditDialog target={editTarget} onClose={() => setEditTarget(null)} onSaved={applyCrewUpdate} />

      <DeleteDialog
        title="Delete Driver"
        person={deleteDriver}
        onClose={() => setDeleteDriver(null)}
        onConfirm={softDeleteDriver}
      />
      <DeleteDialog
        title="Delete Helper"
        person={deleteHelper}
        onClose={() => setDeleteHelper(null)}
        onConfirm={softDeleteHelper}
      />
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${active ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-600'}`}
    >
      {icon}
      {label}
    </button>
  );
}

const CARD_GRID = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

/** Status pill in the same shape as the Active/Inactive pill on Services Offered. */
const STATUS_PILL: Record<DisplayVehicleStatus | CrewStatus, string> = {
  Available: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  Assigned: 'border-sky-300 bg-sky-50 text-sky-700',
  'On Duty': 'border-sky-300 bg-sky-50 text-sky-700',
  'Under Maintenance': 'border-amber-300 bg-amber-50 text-amber-700',
  'Under Repair': 'border-rose-300 bg-rose-50 text-rose-700',
  'Off Duty': 'border-rose-300 bg-rose-50 text-rose-700',
  'On Leave': 'border-purple-300 bg-purple-50 text-purple-700',
};

function StatusPill({ status }: { status: DisplayVehicleStatus | CrewStatus }) {
  return <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_PILL[status]}`}>{status}</span>;
}

type CardDetail = { label: string; value: ReactNode; muted?: boolean };

/** Services Offered card style: header (icon, name, status), labelled details, then the actions. */
function AvailabilityCard({ badge, title, status, subtitle, details, onView, onEdit, onDelete }: {
  badge: ReactNode;
  title: string;
  status: DisplayVehicleStatus | CrewStatus;
  subtitle: string;
  details: CardDetail[];
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article tabIndex={0} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-[#1a1f6e] hover:shadow-lg hover:shadow-[#1a1f6e]/15 focus-visible:-translate-y-0.5 focus-visible:border-[#1a1f6e] focus-visible:shadow-lg focus-visible:shadow-[#1a1f6e]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/20">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef0fa] text-sm font-semibold text-[#1a1f6e] transition-colors group-hover:bg-[#1a1f6e] group-hover:text-[#e8b800] group-focus-visible:bg-[#1a1f6e] group-focus-visible:text-[#e8b800]">
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-medium text-slate-900">{title}</h3>
          <p className="mt-0.5 break-words text-sm text-slate-600">{subtitle}</p>
        </div>
        <StatusPill status={status} />
        <CardActions title={title} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <dl className="mt-4 flex-1 space-y-1.5 border-t border-slate-100 pt-3">
        {details.map(detail => (
          <div key={detail.label} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 text-sm">
            <dt className="text-slate-500">{detail.label}</dt>
            <dd className={`min-w-0 break-words ${detail.muted ? 'text-slate-400' : 'font-medium text-slate-900'}`}>{detail.value}</dd>
          </div>
        ))}
      </dl>

    </article>
  );
}

/** Every card's actions grouped under one ellipsis, in the same menu style as User Management. */
function CardActions({ title, onView, onEdit, onDelete }: { title: string; onView: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const item = 'flex cursor-pointer items-center gap-3 rounded-none px-4 py-2.5 text-sm text-[#344158] focus:bg-[#f8fafc]';
  // A single action is shown as its own icon; the ellipsis is only for two or more.
  if (!onEdit && !onDelete) {
    return (
      <button type="button" onClick={onView} aria-label={`View ${title}`} title="View details" className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#070b45] transition hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
        <Eye size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${title}`} className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#070b45] transition hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
          <MoreVertical size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 min-w-0 overflow-hidden rounded-xl border border-[#dce3ed] bg-white p-0 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.22)]">
        <DropdownMenuItem onClick={onView} className={item}><Eye className="h-4 w-4" aria-hidden="true" /> View</DropdownMenuItem>
        {onEdit && <DropdownMenuItem onClick={onEdit} className={item}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</DropdownMenuItem>}
        {onDelete && <DropdownMenuItem onClick={onDelete} className="flex cursor-pointer items-center gap-3 rounded-none px-4 py-2.5 text-sm text-[#ff4040] focus:bg-[#fff1f1] focus:text-[#ff4040]"><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyCards({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-center">
      <Search size={22} className="mb-2 text-slate-400" aria-hidden="true" />
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}

const notRecorded = (value?: string | null, empty = 'Not recorded'): CardDetail['value'] => value || empty;

function VehicleGrid({
  vehicles,
  onView,
}: {
  vehicles: VehicleAvailabilityRecord[];
  onView: (vehicle: VehicleAvailabilityRecord) => void;
}) {
  if (!vehicles.length) return <EmptyCards message="No vehicles found. Try another status or search term." />;
  return (
    <div className={CARD_GRID}>
      {vehicles.map(vehicle => {
        const status = getDisplayVehicleStatus(vehicle);
        const VehicleIcon = /van|l300/i.test(vehicle.truckTypeId || vehicle.type || '') ? BusFront : Truck;
        const capacity = vehicle.capacityKg != null ? `${vehicle.capacityKg.toLocaleString()} kg` : vehicle.capacity || '';
        const model = fullVehicleModel(vehicle);
        const crew = status === 'Assigned' ? [vehicle.driver?.name, ...(vehicle.helpers ?? []).map(helper => helper.name)].filter(Boolean).join(', ') : '';
        const type = vehicle.truckTypeId || vehicle.type;
        return (
          <AvailabilityCard
            key={vehicle.id}
            badge={<VehicleIcon size={22} aria-hidden="true" />}
            title={vehicle.plate}
            status={status}
            subtitle={[model !== '-' ? model : '', vehicle.year || ''].filter(Boolean).join(' · ') || 'Model not recorded'}
            details={[
              { label: 'Type', value: notRecorded(type), muted: !type },
              { label: 'Capacity', value: notRecorded(capacity), muted: !capacity },
              { label: 'Garage', value: notRecorded(vehicle.garage), muted: !vehicle.garage },
              { label: 'Crew', value: crew || 'No crew assigned', muted: !crew },
            ]}
            onView={() => onView(vehicle)}
          />
        );
      })}
    </div>
  );
}

function VehicleGridSkeleton() {
  return <div className={CARD_GRID} aria-label="Loading">
    {Array.from({ length: 6 }, (_, index) => <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3"><div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" /><div className="min-w-0 flex-1 space-y-2 pt-1"><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div></div>
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-3 w-4/5 rounded bg-slate-100" />)}</div>
    </div>)}
  </div>;
}

function VehicleAvailabilityStatusBadge({ status }: { status: DisplayVehicleStatus }) {
  const colors: Record<DisplayVehicleStatus, string> = {
    Available: 'border-emerald-400 bg-emerald-50 text-emerald-600',
    Assigned: 'border-sky-400 bg-sky-50 text-sky-600',
    'Under Maintenance': 'border-amber-400 bg-amber-50 text-amber-600',
    'Under Repair': 'border-rose-400 bg-rose-50 text-rose-600',
  };
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${colors[status]}`}>{status}</span>;
}

/** License expiry date, flagged when it has expired or expires within 30 days. */
function LicenseExpiry({ value }: { value?: string | null }) {
  const status = getLicenseExpiryStatus(value);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="tabular-nums">{formatDriverModalDate(value)}</span>
      {(status === 'Expired' || status === 'Expiring soon') && (
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status === 'Expired' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>{status}</span>
      )}
    </span>
  );
}

function DriverGrid({
  drivers,
  truckFor,
  onView,
  onEdit,
  onDelete,
  canManage,
}: {
  drivers: Driver[];
  /** The vehicle this driver is currently assigned to, if any. */
  truckFor: (driver: Driver) => VehicleAvailabilityRecord | null;
  onView: (driver: Driver) => void;
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
  canManage: boolean;
}) {
  if (!drivers.length) return <EmptyCards message="No drivers found. Try another status or search term. New drivers are added in User Management." />;
  return (
    <div className={CARD_GRID}>
      {drivers.map(driver => {
        const truck = truckFor(driver);
        const contact = formatContactForDisplay(driver.contact);
        const plate = truck ? truck.plate || truck.plateNumber : '';
        return (
          <AvailabilityCard
            key={driver.id}
            badge={driver.initials || <UserCheck size={20} aria-hidden="true" />}
            title={driver.fullName}
            status={displayHelperStatus(driver.status)}
            subtitle={[driver.empId, driver.licenseType].filter(Boolean).join(' · ') || 'Not recorded'}
            details={[
              { label: 'Contact', value: notRecorded(contact), muted: !contact },
              { label: 'License', value: driver.licenseExpiry ? <LicenseExpiry value={driver.licenseExpiry} /> : 'Not recorded', muted: !driver.licenseExpiry },
              { label: 'Truck', value: plate || 'No truck assigned', muted: !plate },
            ]}
            onView={() => onView(driver)}
            onEdit={canManage ? () => onEdit(driver) : undefined}
            onDelete={canManage ? () => onDelete(driver) : undefined}
          />
        );
      })}
    </div>
  );
}

function HelperGrid({
  helpers,
  truckFor,
  onView,
  onEdit,
  onDelete,
  canManage,
}: {
  helpers: Helper[];
  /** The vehicle this helper is currently assigned to, if any. */
  truckFor: (helper: Helper) => VehicleAvailabilityRecord | null;
  onView: (helper: Helper) => void;
  onEdit: (helper: Helper) => void;
  onDelete: (helper: Helper) => void;
  canManage: boolean;
}) {
  if (!helpers.length) return <EmptyCards message="No helpers found. Try another status or search term. New helpers are added in User Management." />;
  return (
    <div className={CARD_GRID}>
      {helpers.map(helper => {
        const contact = formatContactForDisplay(helper.contact);
        const truck = truckFor(helper);
        const plate = truck ? truck.plate || truck.plateNumber : '';
        return (
          <AvailabilityCard
            key={helper.id}
            badge={helper.initials || <UserCheck size={20} aria-hidden="true" />}
            title={helper.fullName}
            status={displayHelperStatus(helper.status)}
            subtitle={helper.empId || 'Not recorded'}
            details={[
              { label: 'Contact', value: notRecorded(contact), muted: !contact },
              { label: 'Joined', value: helper.joinDate ? formatDriverModalDate(helper.joinDate) : 'Not recorded', muted: !helper.joinDate },
              { label: 'Truck', value: plate || 'No truck assigned', muted: !plate },
            ]}
            onView={() => onView(helper)}
            onEdit={canManage ? () => onEdit(helper) : undefined}
            onDelete={canManage ? () => onDelete(helper) : undefined}
          />
        );
      })}
    </div>
  );
}

function VehicleDetails({ vehicle, onClose }: { vehicle: VehicleAvailabilityRecord | null; onClose: () => void }) {
  const [details, setDetails] = useState<VehicleAvailabilityRecord | null>(vehicle);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!vehicle) { setDetails(null); return; }
    let active = true;
    setDetails(vehicle);
    setLoading(true);
    setFailed(false);
    api.get<VehicleAvailabilityRecord>(`/bms/config/vehicles/availability/${encodeURIComponent(vehicle.id)}/details`)
      .then(({ data }) => { if (active) setDetails(normalizeVehicle(data)); })
      .catch((error) => { console.error('Failed to load vehicle details', error); if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vehicle?.id, retry]);

  const status = details ? getDisplayVehicleStatus(details) : 'Available';
  const isVan = /van|l300/i.test(details?.truckTypeId || details?.type || '');
  const VehicleIcon = isVan ? BusFront : Truck;
  const capacity = details?.capacityKg != null ? `${details.capacityKg.toLocaleString()} kg` : details?.capacity || '-';
  const helperCount = details?.requiredHelpersMin === details?.requiredHelpersMax
    ? String(details?.requiredHelpersMax ?? details?.requiredHelpers ?? 0)
    : `${details?.requiredHelpersMin} to ${details?.requiredHelpersMax}`;

  const outOfService = status === 'Under Maintenance' || status === 'Under Repair';
  const modelName = details ? fullVehicleModel(details) : '-';
  const modelAndYear = [modelName !== '-' ? modelName : '', details?.year || ''].filter(Boolean).join(' · ');
  const crew = details ? [...(details.driver ? [{ member: details.driver, role: 'Driver' }] : []), ...(details.helpers ?? []).map(member => ({ member, role: 'Helper' }))] : [];
  const upcoming = !outOfService ? details?.upcomingSchedule ?? [] : [];

  return <Dialog open={!!vehicle} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent hideCloseButton aria-describedby={undefined} className="!flex !flex-col w-[calc(100%-2rem)] max-w-[920px] max-h-[calc(100dvh-2rem)] min-h-0 overflow-hidden rounded-2xl border-0 bg-white p-0 gap-0 shadow-xl">
      <ModalHeader icon={VehicleIcon} title="Vehicle details" subtitle={details?.plate || vehicle?.plate || undefined} closeLabel="Close vehicle details" />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
        {loading && <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">Loading latest vehicle details…</div>}
        {failed && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><span>Vehicle details could not be refreshed.</span><button type="button" onClick={() => setRetry(value => value + 1)} className="font-medium underline">Retry</button></div>}
        {details && <>
          {/* Summary: which vehicle this is, its status, and the three facts dispatch checks first. */}
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[#1a1f6e] text-[#e8b800]"><VehicleIcon className="h-6 w-6" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold text-slate-900">{details.plate || 'No plate recorded'}</p>
                  <p className="break-words text-sm text-slate-600">{[modelAndYear, details.alias].filter(Boolean).join(' · ') || 'Model not recorded'}</p>
                </div>
              </div>
              <VehicleAvailabilityStatusBadge status={status} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <VehicleStat label="Type" value={details.truckTypeId || details.type} />
              <VehicleStat label="Capacity" value={capacity} />
              <VehicleStat label="Required helpers" value={helperCount} />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <VehicleModalSectionTitle>Vehicle information</VehicleModalSectionTitle>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                  <VehicleModalField label="Brand & model" value={modelName} />
                  <VehicleModalField label="Year" value={details.year} />
                  <VehicleModalField label="Size (L x H x W)" value={details.dimensions} />
                  <VehicleModalField label="Garage" value={details.garage} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <VehicleModalSectionTitle>Documents</VehicleModalSectionTitle>
                <div className="mt-2">
                  <VehicleExpiryRow label="Registration expiry" value={details.regExpiry} />
                  <VehicleExpiryRow label="Insurance expiry" value={details.insExpiry} last />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <VehicleModalSectionTitle>Assigned crew</VehicleModalSectionTitle>
                {crew.length > 0 ? <ul className="mt-3 space-y-2.5">
                  {crew.map(({ member, role }) => <li key={`${role}-${member.id}`}><VehicleCrewRole member={member} role={role} /></li>)}
                </ul> : <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><UserRoundX className="h-4 w-4" aria-hidden="true" />No crew assigned</p>}
              </section>
            </div>

            <div className="min-w-0 space-y-3">
              {status === 'Assigned' ? <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <VehicleModalSectionTitle>Current assignment</VehicleModalSectionTitle>
                {details.currentAssignment ? <>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                    <VehicleModalField label="Booking" value={details.currentAssignment.bookingNumber} />
                    <VehicleModalField label="Job order" value={details.currentAssignment.jobOrderNumber} />
                    <VehicleModalField label="Service" value={details.currentAssignment.service} />
                    <VehicleModalField label="Schedule" value={formatAssignmentSchedule(details.currentAssignment)} />
                  </div>
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800"><MapPinned className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{details.currentAssignment.route || 'Route not recorded'}</span></div>
                </> : <p className="mt-3 text-sm text-slate-500">Assignment details are not available.</p>}
              </section> : outOfService ? <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <VehicleModalSectionTitle>Status details</VehicleModalSectionTitle>
                <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${status === 'Under Maintenance' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>This vehicle can’t be assigned until {status === 'Under Maintenance' ? 'maintenance' : 'repair'} is done.</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
                  <VehicleModalField label="Reason" value={details.statusDetails?.reason} />
                  <VehicleModalField label="Since" value={details.statusDetails?.since} />
                  <VehicleModalField label="Expected back" value={details.statusDetails?.expectedBack} />
                  <VehicleModalField label="Remarks" value={details.statusDetails?.remarks} />
                </div>
              </section> : <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <VehicleModalSectionTitle>Current assignment</VehicleModalSectionTitle>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Not assigned right now. This vehicle is free for new bookings.</span>
                </div>
              </section>}

              <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <VehicleModalSectionTitle>Upcoming schedule</VehicleModalSectionTitle>
                  {upcoming.length > 0 && <span className="rounded-full bg-[#1a1f6e]/5 px-2 py-0.5 text-xs font-semibold text-[#1a1f6e]">{upcoming.length}</span>}
                </div>
                {upcoming.length > 0 ? <ul className="mt-3 divide-y divide-slate-100">
                  {upcoming.map((entry, index) => <li key={`${entry.bookingNumber}-${index}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="w-[92px] shrink-0"><p className="text-sm font-semibold text-[#1a1f6e]">{entry.date || '-'}</p><p className="text-xs text-slate-500">{entry.time || '-'}</p></div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{entry.bookingNumber}</p>
                    {entry.locationCode && <span className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">{entry.locationCode}</span>}
                  </li>)}
                </ul> : <div className="py-5 text-center">
                  <CalendarDays className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-800">No upcoming bookings</p>
                  <p className="mt-1 text-xs text-slate-500">{outOfService ? 'Bookings can’t be scheduled on this vehicle for now.' : 'No upcoming bookings are scheduled for this vehicle.'}</p>
                </div>}
              </section>
            </div>
          </div>
        </>}
      </div>
      <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3">
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">Close</button>
      </div>
    </DialogContent>
  </Dialog>;
}

function VehicleStat({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value == null || value === '' || value === '-';
  return <div className="min-w-0 rounded-xl bg-[#f1f4fa] px-3 py-2.5">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className={`mt-0.5 truncate text-[15px] ${empty ? 'font-normal text-slate-400' : 'font-semibold text-[#0b0f4a]'}`}>{empty ? 'Not recorded' : value}</p>
  </div>;
}

/** An expiry date with the same Valid / Expiring soon / Expired pill the driver licence uses. */
function VehicleExpiryRow({ label, value, last = false }: { label: string; value?: string | null; last?: boolean }) {
  const formatted = formatDriverModalDate(value);
  const text = formatted === 'Not recorded' && value ? value : formatted;
  const expiry = getLicenseExpiryStatus(value);
  return <div className={`flex items-center justify-between gap-3 py-2.5 ${last ? '' : 'border-b border-slate-100'}`}>
    <span className="shrink-0 text-sm text-slate-600">{label}</span>
    <span className="flex flex-wrap items-center justify-end gap-2">
      <span className={`text-[15px] ${text === 'Not recorded' ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{text}</span>
      {expiry && <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${expiry === 'Expired' ? 'border-red-300 bg-red-50 text-red-700' : expiry === 'Expiring soon' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>{expiry}</span>}
    </span>
  </div>;
}

function VehicleModalSectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{children}</h3>;
}

function VehicleModalField({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value == null || value === '' || value === '-';
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className={`mt-0.5 break-words text-sm ${empty ? 'font-normal text-slate-500' : 'font-medium text-slate-900'}`}>{empty ? '-' : value}</p></div>;
}

function VehicleCrewRole({ member, role }: { member: VehicleCrewMember; role: string }) {
  return <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-medium text-[#1a1f6e]">{member.initials || getInitials(member.name)}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{member.name}</p><p className="text-sm text-slate-500">{role}</p></div></div>;
}

function formatAssignmentSchedule(assignment: NonNullable<VehicleAvailabilityRecord['currentAssignment']>) {
  const date = assignment.date || '-';
  const start = assignment.startTime || '';
  const end = assignment.endTime || '';
  return `${date}${start ? ` · ${start}${end ? ` to ${end}` : ''}` : ''}`;
}

/** Shared layout for the Driver and Helper details modals, matching the Vehicle details modal. */
function CrewDetailsDialog({ open, onClose, title, icon, reference, name, initials, subtitle, status, stats, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: LucideIcon;
  /** Shown in gold under the title, e.g. the employee ID. */
  reference?: string;
  name: string;
  initials: string;
  subtitle: string;
  status: CrewStatus;
  stats: { label: string; value: string | number | null | undefined }[];
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent hideCloseButton aria-describedby={undefined} className="!flex !flex-col w-[calc(100%-2rem)] max-w-[640px] max-h-[calc(100dvh-2rem)] min-h-0 overflow-hidden rounded-2xl border-0 bg-white p-0 gap-0 shadow-xl">
        <ModalHeader icon={icon} title={title} subtitle={reference || undefined} closeLabel={`Close ${title.toLowerCase()}`} />

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#1a1f6e] text-base font-semibold text-[#e8b800]">{initials || <User className="h-6 w-6" aria-hidden="true" />}</span>
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold text-slate-900">{name}</p>
                  <p className="break-words text-sm text-slate-600">{subtitle}</p>
                </div>
              </div>
              <CrewStatusBadge status={status} detail />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {stats.map(stat => <VehicleStat key={stat.label} label={stat.label} value={stat.value} />)}
            </div>
          </section>
          {children}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">Close</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function crewInitials(member: { initials?: string; fullName?: string } | null) {
  return member?.initials || member?.fullName?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '';
}

const recordedDate = (value?: string | null) => {
  const text = formatDriverModalDate(value);
  return text === 'Not recorded' ? '' : text;
};

const phone = (value?: string | null) => (value ? formatContactForDisplay(value) : '');

function DriverDetails({ driver, onClose }: { driver: Driver | null; onClose: () => void }) {
  return (
    <CrewDetailsDialog
      open={!!driver}
      onClose={onClose}
      title="Driver details"
      icon={Contact}
      reference={driver?.empId}
      name={driver?.fullName ?? ''}
      initials={crewInitials(driver)}
      subtitle={[driver?.empId, 'Driver'].filter(Boolean).join(' · ')}
      status={displayHelperStatus(driver?.status)}
      stats={[
        { label: 'License type', value: driver?.licenseType },
        { label: 'Total trips', value: driver?.totalTrips },
        { label: 'Join date', value: recordedDate(driver?.joinDate) },
      ]}
    >
      {driver && <>
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <VehicleModalSectionTitle>Contact details</VehicleModalSectionTitle>
          <div className="mt-2">
            <DriverContactRow label="Contact number" value={phone(driver.contact)} />
            <DriverContactRow label="Email" value={driver.email} />
            <DriverContactRow label="Address" value={driver.address} last />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <VehicleModalSectionTitle>License</VehicleModalSectionTitle>
          <div className="mt-2">
            <DriverContactRow label="License no." value={driver.licenseNo} />
            <DriverContactRow label="License type" value={driver.licenseType} />
            <VehicleExpiryRow label="License expiry" value={driver.licenseExpiry} last />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <VehicleModalSectionTitle>Emergency contact</VehicleModalSectionTitle>
          <div className="mt-2">
            <DriverContactRow label="Name" value={driver.emergencyName} />
            <DriverContactRow label="Contact number" value={phone(driver.emergencyContact)} last />
          </div>
        </section>
      </>}
    </CrewDetailsDialog>
  );
}

function DriverContactRow({ label, value, last = false }: { label: string; value: string | null | undefined; last?: boolean }) {
  const empty = !value || value === '-';
  return <div className={`flex items-start justify-between gap-3.5 py-2.5 ${last ? '' : 'border-b border-slate-100'}`}><span className="shrink-0 text-sm text-slate-600">{label}</span><span className={`max-w-[68%] break-words text-right text-[15px] ${empty ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{empty ? 'Not recorded' : value}</span></div>;
}

function formatDriverModalDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function getLicenseExpiryStatus(value?: string | null): 'Valid' | 'Expiring soon' | 'Expired' | null {
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
  const toManilaDay = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value || 0);
    return Date.UTC(part('year'), part('month') - 1, part('day'));
  };
  const daysUntilExpiry = Math.floor((toManilaDay(expiry) - toManilaDay(new Date())) / 86_400_000);
  if (daysUntilExpiry < 0) return 'Expired';
  if (daysUntilExpiry <= 30) return 'Expiring soon';
  return 'Valid';
}

function HelperDetails({ helper, onClose }: { helper: Helper | null; onClose: () => void }) {
  return (
    <CrewDetailsDialog
      open={!!helper}
      onClose={onClose}
      title="Helper details"
      icon={UserCheck}
      reference={helper?.empId}
      name={helper?.fullName ?? ''}
      initials={crewInitials(helper)}
      subtitle={[helper?.empId, 'Helper'].filter(Boolean).join(' · ')}
      status={displayHelperStatus(helper?.status)}
      stats={[
        { label: 'Contact number', value: phone(helper?.contact) },
        { label: 'Email', value: helper?.email },
        { label: 'Total trips', value: helper?.totalTrips },
        { label: 'Join date', value: recordedDate(helper?.joinDate) },
      ]}
    >
      {helper && (
        <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <VehicleModalSectionTitle>Emergency contact</VehicleModalSectionTitle>
          <div className="mt-2">
            <DriverContactRow label="Name" value={helper.emergencyName} />
            <DriverContactRow label="Contact number" value={phone(helper.emergencyContact)} last />
          </div>
        </section>
      )}
    </CrewDetailsDialog>
  );
}

function DeleteDialog({
  title,
  person,
  onClose,
  onConfirm,
}: {
  title: string;
  person: Driver | Helper | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } catch (error: unknown) {
      toast.error(apiProblem(error).message || `Unable to ${title.toLowerCase()}.`);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <DeleteConfirmModal
      open={!!person}
      title={title}
      itemName={person ? `${person.fullName}${person.empId ? ` (${person.empId})` : ''}` : ''}
      deleting={deleting}
      onCancel={onClose}
      onConfirm={() => { void confirm(); }}
    />
  );
}

function CrewStatusBadge({ status, detail = false }: { status: CrewStatus; detail?: boolean }) {
  const styles: Record<CrewStatus, string> = {
    'Available': 'border-emerald-400 text-emerald-600 bg-emerald-50',
    'On Duty': 'border-sky-400 text-sky-600 bg-sky-50',
    'Off Duty': 'border-rose-400 text-rose-600 bg-rose-50',
    'On Leave': 'border-purple-400 text-purple-600 bg-purple-50',
  };
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 ${detail ? 'text-xs font-semibold' : 'text-[10px] font-bold'} uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}
