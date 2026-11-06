import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, ContactRound, LayoutDashboard, Truck, UsersRound, Wrench } from 'lucide-react';
import { api } from '../../lib/api';
import { getJobOrders } from '../../lib/job-order';
import { formatJobOrderDate } from '../../lib/documents/jobOrderDocument';
import type { Driver, Helper, JobOrder, ScheduleEntry } from '../../lib/types';
import KPICard from '../../components/shared/KpiCard';
import StatusBadge from '../../components/shared/StatusBadge';
import PageHeader from '../../components/pageheader/Pageheader';
import { ActionRow, ScheduleJobRow, SectionCard } from '../../components/shared/DashboardSections';
import { parseScheduleTime, ScheduleStatusBadge, toDateKey } from '../../components/scheduling/ScheduleCalendar';

const SCHEDULING_PATH = '/operations/scheduling';
const JOB_ORDER_PATH = '/operations/job-order';
const VISIBLE_JOB_ORDERS = 5;
const UPCOMING_DAYS = 7;

type FleetVehicle = {
  id: string;
  plateNumber: string;
  status: string;
  isAssigned?: boolean;
  statusReason?: string | null;
  expectedBackAt?: string | null;
};
type DashboardSchedule = ScheduleEntry & {
  vehicle?: { plateNumber?: string } | null;
  assignedDriver?: { fullName?: string } | null;
};
type DashboardData = { schedules: DashboardSchedule[]; vehicles: FleetVehicle[]; drivers: Driver[]; helpers: Helper[]; jobOrders: JobOrder[] };

const EMPTY_DATA: DashboardData = { schedules: [], vehicles: [], drivers: [], helpers: [], jobOrders: [] };
const pad2 = (value: number) => String(value).padStart(2, '0');
const localDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const pickupValue = (schedule: ScheduleEntry) => schedule.pickupTime || schedule.time;

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day + days));
}

/** Answers two questions for Operations: what needs doing, and are there trucks and crew to do it? */
export default function OperationsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [schedules, vehicles, drivers, helpers, jobOrders] = await Promise.all([
        api.get<DashboardSchedule[]>('/scheduling'),
        api.get<FleetVehicle[]>('/bms/config/vehicles'),
        api.get<Driver[]>('/bms/config/drivers'),
        api.get<Helper[]>('/bms/config/helpers'),
        getJobOrders(),
      ]);
      setData({ schedules: schedules.data ?? [], vehicles: vehicles.data ?? [], drivers: drivers.data ?? [], helpers: helpers.data ?? [], jobOrders });
      setFailed(false);
    } catch {
      // Keep the last good numbers on screen, and say they may be out of date.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('focus', refresh);
    const refreshId = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(refreshId);
    };
  }, [load]);

  const today = localDateKey(new Date());
  const { schedules, vehicles, drivers, helpers, jobOrders } = data;

  const work = useMemo(() => {
    const unassigned = schedules.filter(schedule => schedule.status === 'Unassigned').map(schedule => toDateKey(schedule.date));
    const lastUpcoming = addDays(today, UPCOMING_DAYS);
    return {
      todaysJobs: schedules
        .filter(schedule => toDateKey(schedule.date) === today)
        .sort((a, b) => (parseScheduleTime(pickupValue(a))?.minutes ?? Infinity) - (parseScheduleTime(pickupValue(b))?.minutes ?? Infinity)),
      pastDue: unassigned.filter(date => date < today).length,
      dueToday: unassigned.filter(date => date === today).length,
      dueSoon: unassigned.filter(date => date > today && date <= lastUpcoming).length,
      toDistribute: jobOrders
        .filter(order => order.status === 'Pending')
        .sort((a, b) => toDateKey(a.serviceDate).localeCompare(toDateKey(b.serviceDate))),
    };
  }, [schedules, jobOrders, today]);

  const capacity = useMemo(() => ({
    trucksAvailable: vehicles.filter(vehicle => vehicle.status === 'AVAILABLE' && !vehicle.isAssigned).length,
    outOfService: vehicles.filter(vehicle => vehicle.status === 'UNDER_MAINTENANCE' || vehicle.status === 'UNDER_REPAIR'),
    driversAvailable: drivers.filter(driver => driver.status === 'Available').length,
    helpersAvailable: helpers.filter(helper => helper.status === 'Available').length,
  }), [vehicles, drivers, helpers]);

  // Saved job orders still know the plate after a truck leaves the fleet.
  const truckFor = (schedule: DashboardSchedule) => schedule.vehicle?.plateNumber
    ?? jobOrders.find(order => order.bookingId === schedule.bookingId || order.bookingId === schedule.id)?.truck;

  const count = (value: number) => (loading ? '-' : value);
  // Past-date bookings are CS's to reschedule or cancel, so they don't count against Ops being caught up.
  const allCaughtUp = !work.dueToday && !work.dueSoon && !work.toDistribute.length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="DASHBOARD"
        subtitle={<>Coordinate schedules, job orders, and fleet <span className="font-medium text-[#d4a72c]">availability.</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
      />

      {failed && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Live data couldn't be loaded, so these numbers may be out of date.</span>
          <button type="button" onClick={() => { void load(); }} className="inline-flex h-9 w-fit items-center rounded-lg border border-red-300 bg-white px-3 font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Jobs Today" value={count(work.todaysJobs.length)} icon={CalendarDays} iconColor="#1a1f6e" variant="dashboard-compact" />
        <KPICard label="Trucks Available Today" value={loading ? '-' : `${capacity.trucksAvailable} of ${vehicles.length}`} icon={Truck} iconColor="#10b981" variant="dashboard-compact" />
        <KPICard label="Drivers Available Today" value={count(capacity.driversAvailable)} icon={ContactRound} iconColor="#0ea5e9" variant="dashboard-compact" />
        <KPICard label="Helpers Available Today" value={count(capacity.helpersAvailable)} icon={UsersRound} iconColor="#8b5cf6" variant="dashboard-compact" />
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)] xl:grid-rows-[auto_1fr]">
        <SectionCard title="Today's Jobs">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-400">Loading...</p>
          ) : work.todaysJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-600">No jobs scheduled today.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {work.todaysJobs.map(schedule => {
                const isUnassigned = schedule.status === 'Unassigned';
                return (
                  <ScheduleJobRow
                    key={schedule.id}
                    time={parseScheduleTime(pickupValue(schedule))?.label ?? 'No time'}
                    client={schedule.client}
                    reference={schedule.bookingNo || schedule.bookingId}
                    isUnassigned={isUnassigned}
                    truck={truckFor(schedule)}
                    driver={schedule.assignedDriver?.fullName ?? schedule.assignedDriverName}
                    trailing={isUnassigned ? (
                      <button type="button" onClick={() => navigate(SCHEDULING_PATH, { state: { assignBookingId: schedule.id } })} aria-label={`Assign ${schedule.client}`} className="inline-flex h-9 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#030848] px-4 text-sm font-medium text-white hover:bg-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 focus-visible:ring-offset-2">
                        <ClipboardList size={15} aria-hidden="true" />Assign
                      </button>
                    ) : <ScheduleStatusBadge status={schedule.status} />}
                  />
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="order-last min-w-0 overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm xl:order-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <h2 className="text-lg font-medium text-slate-900">Job Orders to Distribute</h2>
            {work.toDistribute.length > 0 && (
              <button type="button" onClick={() => navigate(JOB_ORDER_PATH)} className="inline-flex h-9 w-fit items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
                View all ({work.toDistribute.length})<ChevronRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-auto text-sm">
              <thead className="bg-[#1a1f6e]">
                <tr>
                  {['JOB ORDER NO.', 'SERVICE DATE', 'CLIENT', 'TRUCK', 'DRIVER', 'STATUS'].map(column => (
                    <th key={column} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : work.toDistribute.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No job orders waiting to be distributed.</td></tr>
                ) : work.toDistribute.slice(0, VISIBLE_JOB_ORDERS).map(order => {
                  const serviceDate = toDateKey(order.serviceDate);
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">{order.jobOrderNo || order.id}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-900">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {formatJobOrderDate(serviceDate)}
                          {serviceDate < today && <span className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">Past date</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-900">{order.client}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">{order.truck || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">{order.team || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} variant="job-order-status" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <SectionCard title="Action Required">
            {!loading && allCaughtUp ? (
              <p className="flex items-center gap-2 py-4 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />You're all caught up.</p>
            ) : (
              <div className="space-y-2.5">
                {work.dueToday > 0 && <ActionRow label="Assign Today" detail="Today's jobs with no truck or team" value={work.dueToday} tone="amber" onClick={() => navigate(SCHEDULING_PATH)} />}
                {work.dueSoon > 0 && <ActionRow label={`Next ${UPCOMING_DAYS} Days`} detail="Upcoming jobs still to assign" value={work.dueSoon} tone="blue" onClick={() => navigate(SCHEDULING_PATH)} />}
                {work.toDistribute.length > 0 && <ActionRow label="Distribute Job Orders" detail="Ready to hand to drivers" value={work.toDistribute.length} tone="emerald" onClick={() => navigate(JOB_ORDER_PATH)} />}
              </div>
            )}
            {!loading && work.pastDue > 0 && (
              <div className="mt-2.5">
                <ActionRow label="Past Date, Waiting on CS" detail="Customer needs to reschedule or cancel" value={work.pastDue} tone="red" onClick={() => navigate(SCHEDULING_PATH)} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Trucks Out of Service">
            {capacity.outOfService.length === 0 ? (
              <p className="flex items-center gap-2 py-2 text-sm text-slate-600"><Truck className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />{loading ? 'Loading...' : 'All trucks are in service.'}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {capacity.outOfService.map(vehicle => {
                  const isRepair = vehicle.status === 'UNDER_REPAIR';
                  const expectedBack = vehicle.expectedBackAt ? formatJobOrderDate(String(vehicle.expectedBackAt)) : null;
                  return (
                    <li key={vehicle.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Wrench className={`mt-0.5 h-4 w-4 shrink-0 ${isRepair ? 'text-rose-600' : 'text-amber-600'}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{vehicle.plateNumber}</span>
                        <span className="block break-words text-sm text-slate-600">{vehicle.statusReason || (isRepair ? 'Under repair' : 'Under maintenance')}</span>
                        <span className="block text-sm text-slate-600">{expectedBack ? `Expected back ${expectedBack}` : 'No return date'}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

    </div>
  );
}
