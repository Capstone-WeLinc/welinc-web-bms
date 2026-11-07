import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, BarChart3, CalendarDays, CalendarX2, CheckCircle2, CircleDollarSign, ClipboardList, IdCard, Inbox, LayoutDashboard, MessageSquareWarning, Truck, Wrench } from 'lucide-react';
import type { Booking, Driver, JobOrder, ScheduleEntry } from '../../lib/types';
import { subscribeToBookingStatusUpdates } from '../../lib/booking-sync';
import { api } from '../../lib/api';
import { getJobOrders } from '../../lib/job-order';
import { normalizeBookingStatus } from '../../lib/booking';
import KPICard from '../../components/shared/KpiCard';
import PageHeader from '../../components/pageheader/Pageheader';
import { ActionRow, ScheduleJobRow, SectionCard, WatchRow } from '../../components/shared/DashboardSections';
import { isPastScheduleTime, manilaNow, parseScheduleTime, ScheduleStatusBadge, toDateKey } from '../../components/scheduling/ScheduleCalendar';
import { uniqueBookings, type CustomerServiceBooking } from '../customerservice/CsPostService';
import { getLicenseExpiryStatus } from './VehicleAvailability';

const APPROVALS_PATH = '/admin/approvals';
const SCHEDULING_PATH = '/admin/scheduling';
const JOB_ORDER_PATH = '/admin/job-order';
const POST_SERVICE_PATH = '/admin/post-service';
const FLEET_PATH = '/admin/vehicle-availability';
const TREND_PERIODS = ['weekly', 'monthly', 'yearly'] as const;

type TrendPeriod = (typeof TREND_PERIODS)[number];
type ApprovalCounts = { total: number; booking: number; collection: number; refund: number; overdue: number; collectionAmount: number; refundAmount: number };
type DailySalesRecord = { date: string; status?: string; reportStatus?: string; bookingId?: string; bookingNo?: string; totalDailySales?: string | number };
type FleetVehicle = { id: string; status: string; isAssigned?: boolean };
type DashboardSchedule = ScheduleEntry & { vehicle?: { plateNumber?: string } | null; assignedDriver?: { fullName?: string } | null };
type DashboardData = {
  bookings: Booking[];
  schedules: DashboardSchedule[];
  vehicles: FleetVehicle[];
  drivers: Driver[];
  jobOrders: JobOrder[];
  postService: CustomerServiceBooking[];
  sales: DailySalesRecord[];
  approvals: ApprovalCounts;
};

const EMPTY_DATA: DashboardData = {
  bookings: [], schedules: [], vehicles: [], drivers: [], jobOrders: [], postService: [], sales: [],
  approvals: { total: 0, booking: 0, collection: 0, refund: 0, overdue: 0, collectionAmount: 0, refundAmount: 0 },
};
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const pickupValue = (schedule: ScheduleEntry) => schedule.pickupTime || schedule.time;
const serviceDate = (booking: Booking) => String(booking.date ?? '').slice(0, 10);
const keyToDate = (key: string) => new Date(`${key}T00:00:00Z`);
const dateToKey = (date: Date) => date.toISOString().slice(0, 10);
const formatUtc = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString('en-US', { timeZone: 'UTC', ...options });

function amountOf(value: string | number | undefined) {
  if (value === undefined || value === '') return 0;
  const amount = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

/** Counts bookings by service date, across the week, month or year that today falls in. */
function buildTrend(bookings: Booking[], period: TrendPeriod, today: string) {
  const counts = new Map<string, number>();
  bookings.forEach(booking => {
    const date = serviceDate(booking);
    if (!date || normalizeBookingStatus(booking.status) === 'Cancelled') return;
    counts.set(date, (counts.get(date) ?? 0) + 1);
    counts.set(date.slice(0, 7), (counts.get(date.slice(0, 7)) ?? 0) + 1);
  });
  const now = keyToDate(today);

  if (period === 'weekly') {
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setUTCDate(monday.getUTCDate() + index);
      return day;
    });
    return {
      data: days.map(day => ({ label: formatUtc(day, { weekday: 'short', day: 'numeric' }), value: counts.get(dateToKey(day)) ?? 0 })),
      range: `${formatUtc(days[0], { month: 'short', day: 'numeric' })} - ${formatUtc(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}`,
    };
  }

  const year = now.getUTCFullYear();
  if (period === 'yearly') {
    return {
      data: Array.from({ length: 12 }, (_, index) => {
        const month = new Date(Date.UTC(year, index, 1));
        return { label: formatUtc(month, { month: 'short' }), value: counts.get(dateToKey(month).slice(0, 7)) ?? 0 };
      }),
      range: String(year),
    };
  }

  const daysInMonth = new Date(Date.UTC(year, now.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    data: Array.from({ length: daysInMonth }, (_, index) => ({
      label: String(index + 1),
      value: counts.get(dateToKey(new Date(Date.UTC(year, now.getUTCMonth(), index + 1)))) ?? 0,
    })),
    range: formatUtc(now, { month: 'long', year: 'numeric' }),
  };
}

/** Answers three questions for the Admin: what needs my decision, how is the business doing, and where is the team stuck? */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('weekly');

  const load = useCallback(async () => {
    try {
      const [bookings, schedules, vehicles, drivers, jobOrders, postService, sales, approvals] = await Promise.all([
        api.get<Booking[]>('/booking'),
        api.get<DashboardSchedule[]>('/scheduling'),
        api.get<FleetVehicle[]>('/bms/config/vehicles'),
        api.get<Driver[]>('/bms/config/drivers'),
        getJobOrders(),
        api.get<CustomerServiceBooking[]>('/post-service'),
        api.get<DailySalesRecord[]>('/daily-sales'),
        api.get<ApprovalCounts>('/approvals/counts'),
      ]);
      setData({
        bookings: bookings.data ?? [],
        schedules: schedules.data ?? [],
        vehicles: vehicles.data ?? [],
        drivers: drivers.data ?? [],
        jobOrders,
        postService: uniqueBookings(Array.isArray(postService.data) ? postService.data : []),
        sales: sales.data ?? [],
        approvals: { ...EMPTY_DATA.approvals, ...approvals.data },
      });
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
    const unsubscribe = subscribeToBookingStatusUpdates(refresh);
    window.addEventListener('focus', refresh);
    const refreshId = window.setInterval(refresh, 15000);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
      window.clearInterval(refreshId);
    };
  }, [load]);

  const today = manilaNow().dateKey;
  const { bookings, schedules, vehicles, drivers, jobOrders, postService, sales, approvals } = data;

  const revenue = useMemo(() => {
    // Only sales reports CS has submitted count, and never a cancelled booking's.
    const liveBookings = new Set(bookings
      .filter(booking => normalizeBookingStatus(booking.status) !== 'Cancelled')
      .flatMap(booking => [booking.id, booking.bookingId, booking.bookingNo].filter((key): key is string => Boolean(key))));
    const submitted = sales.filter(record =>
      (record.status === 'Submitted' || record.reportStatus === 'Submitted')
      && [record.bookingId, record.bookingNo].some(key => Boolean(key && liveBookings.has(key))));
    const total = (prefix: string) => submitted
      .filter(record => String(record.date ?? '').startsWith(prefix))
      .reduce((sum, record) => sum + amountOf(record.totalDailySales), 0);
    return { today: total(today), month: total(today.slice(0, 7)) };
  }, [bookings, sales, today]);

  // Unassigned and its date or today's pickup time has passed: CS has to reschedule it, so it leaves Today's Jobs
  // and counts as "Past Date, Not Assigned" instead.
  const isPastUnassigned = (schedule: ScheduleEntry) => schedule.status === 'Unassigned' && isPastScheduleTime(schedule.date, pickupValue(schedule));

  const todaysJobs = useMemo(() => schedules
    .filter(schedule => toDateKey(schedule.date) === today && !isPastUnassigned(schedule))
    .sort((a, b) => (parseScheduleTime(pickupValue(a))?.minutes ?? Infinity) - (parseScheduleTime(pickupValue(b))?.minutes ?? Infinity)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [schedules, today]);

  const watch = useMemo(() => ({
    pastDue: schedules.filter(isPastUnassigned).length,
    toDistribute: jobOrders.filter(order => order.status === 'Pending').length,
    issues: postService.filter(booking => booking.issueReported === true && booking.postServiceStatus !== 'Finalized').length,
    outOfService: vehicles.filter(vehicle => vehicle.status === 'UNDER_MAINTENANCE' || vehicle.status === 'UNDER_REPAIR').length,
    licenses: drivers.filter(driver => ['Expired', 'Expiring soon'].includes(getLicenseExpiryStatus(driver.licenseExpiry) ?? '')).length,
  }), [schedules, jobOrders, postService, vehicles, drivers, today]);

  const trend = useMemo(() => buildTrend(bookings, trendPeriod, today), [bookings, trendPeriod, today]);
  const trendTotal = trend.data.reduce((sum, item) => sum + item.value, 0);
  const trucksAvailable = vehicles.filter(vehicle => vehicle.status === 'AVAILABLE' && !vehicle.isAssigned).length;

  // Saved job orders still know the plate after a truck leaves the fleet.
  const truckFor = (schedule: DashboardSchedule) => schedule.vehicle?.plateNumber
    ?? jobOrders.find(order => order.bookingId === schedule.bookingId || order.bookingId === schedule.id)?.truck;

  const shown = (value: string | number) => (loading ? '-' : value);
  const watchItems = [
    { label: 'Past Date, Not Assigned', detail: 'Service date passed with no truck or team', value: watch.pastDue, icon: CalendarX2, tone: 'red' as const, onClick: () => navigate(SCHEDULING_PATH) },
    { label: 'Job Orders Not Distributed', detail: 'Not yet handed to drivers', value: watch.toDistribute, icon: ClipboardList, tone: 'blue' as const, onClick: () => navigate(JOB_ORDER_PATH) },
    { label: 'Issues Reported', detail: 'Problems reported after service', value: watch.issues, icon: MessageSquareWarning, tone: 'amber' as const, onClick: () => navigate(POST_SERVICE_PATH) },
    { label: 'Trucks Out of Service', detail: 'Under maintenance or repair', value: watch.outOfService, icon: Wrench, tone: 'orange' as const, onClick: () => navigate(FLEET_PATH) },
    { label: 'Driver Licenses', detail: 'Expired or expiring soon', value: watch.licenses, icon: IdCard, tone: 'violet' as const, onClick: () => navigate(FLEET_PATH) },
  ];
  const allClear = watchItems.every(item => item.value === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="DASHBOARD"
        subtitle={<>Monitor operations, reports, and system <span className="font-medium text-[#d4a72c]">activity.</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
      />

      {failed && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Live data couldn't be loaded, so these numbers may be out of date.</span>
          <button type="button" onClick={() => { void load(); }} className="inline-flex h-9 w-fit items-center rounded-lg border border-red-300 bg-white px-3 font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Daily Revenue" value={shown(peso.format(revenue.today))} icon={CircleDollarSign} iconColor="#10b981" variant="dashboard-compact" />
        <KPICard label="Monthly Revenue" value={shown(peso.format(revenue.month))} icon={BarChart3} iconColor="#0ea5e9" variant="dashboard-compact" />
        <KPICard label="Jobs Today" value={shown(todaysJobs.length)} icon={CalendarDays} iconColor="#1a1f6e" variant="dashboard-compact" />
        <KPICard label="Trucks Available Today" value={shown(`${trucksAvailable} of ${vehicles.length}`)} icon={Truck} iconColor="#8b5cf6" variant="dashboard-compact" />
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)] xl:grid-rows-[auto_1fr]">
        <SectionCard title="Today's Jobs">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-400">Loading...</p>
          ) : todaysJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-600">No jobs scheduled today.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todaysJobs.map(schedule => (
                <ScheduleJobRow
                  key={schedule.id}
                  time={parseScheduleTime(pickupValue(schedule))?.label ?? 'No time'}
                  client={schedule.client}
                  reference={schedule.bookingNo || schedule.bookingId}
                  isUnassigned={schedule.status === 'Unassigned'}
                  truck={truckFor(schedule)}
                  driver={schedule.assignedDriver?.fullName ?? schedule.assignedDriverName}
                  trailing={<ScheduleStatusBadge status={schedule.status} />}
                />
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="order-last min-w-0 xl:order-none">
          <SectionCard
            title="Booking Trends"
            action={(
              <div className="inline-flex shrink-0 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Booking trend period">
                {TREND_PERIODS.map((period, index) => (
                  <button
                    key={period}
                    type="button"
                    role="radio"
                    aria-checked={trendPeriod === period}
                    tabIndex={trendPeriod === period ? 0 : -1}
                    onClick={() => setTrendPeriod(period)}
                    onKeyDown={event => {
                      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                      event.preventDefault();
                      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + TREND_PERIODS.length) % TREND_PERIODS.length;
                      setTrendPeriod(TREND_PERIODS[next]);
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
                    }}
                    className={`inline-flex h-9 w-fit shrink-0 items-center whitespace-nowrap rounded-md px-3 text-xs font-semibold capitalize transition-colors ${trendPeriod === period ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-600'}`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            )}
          >
            <p className="text-sm text-slate-600">Bookings by service date, {trend.range}</p>
            {!loading && trendTotal === 0 ? (
              <div className="mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 text-center">
                <Inbox className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
                <p className="text-sm text-slate-600">No bookings in this period.</p>
              </div>
            ) : (
              <div className="mt-4 h-[220px]" role="img" aria-label={`${trendTotal} bookings by service date, ${trend.range}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend.data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} minTickGap={8} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f1f4fa' }} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="value" name="Bookings" fill="#1a1f6e" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <SectionCard title="Action Required">
            {!loading && approvals.total === 0 ? (
              <p className="flex items-center gap-2 py-4 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />No approvals waiting for you.</p>
            ) : (
              <div className="space-y-2.5">
                {approvals.booking > 0 && <ActionRow label="Reschedules & Cancellations" detail="Requests to approve or reject" value={approvals.booking} tone="blue" onClick={() => navigate(`${APPROVALS_PATH}?type=booking`)} />}
                {approvals.collection > 0 && <ActionRow label="Collections to Verify" detail={`${peso.format(approvals.collectionAmount)} waiting for verification`} value={approvals.collection} tone="amber" onClick={() => navigate(`${APPROVALS_PATH}?type=collection`)} />}
                {approvals.refund > 0 && <ActionRow label="Refunds to Approve" detail={`${peso.format(approvals.refundAmount)} requested`} value={approvals.refund} tone="emerald" onClick={() => navigate(`${APPROVALS_PATH}?type=refund`)} />}
                {approvals.overdue > 0 && <p className="flex items-center gap-2 pt-1 text-sm font-medium text-red-700"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{approvals.overdue} waiting over 24 hours</p>}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Keep an Eye On">
            {!loading && allClear ? (
              <p className="flex items-center gap-2 py-2 text-sm text-slate-600"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />Nothing to flag right now.</p>
            ) : (
              <ul className="-mx-2 space-y-0.5">
                {watchItems.filter(item => item.value > 0).map(item => <WatchRow key={item.label} {...item} />)}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
