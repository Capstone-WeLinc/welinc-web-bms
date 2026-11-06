import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, CalendarRange, CheckCircle2, ChevronRight, Clock3, Inbox, LayoutDashboard, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { formatBookingAmount, normalizeBookingStatus } from '../../lib/booking';
import { formatJobOrderDate } from '../../lib/documents/jobOrderDocument';
import type { Booking } from '../../lib/types';
import KPICard from '../../components/shared/KpiCard';
import StatusBadge from '../../components/shared/StatusBadge';
import PageHeader from '../../components/pageheader/Pageheader';
import { ActionRow, SectionCard } from '../../components/shared/DashboardSections';
import { parseScheduleTime } from '../../components/scheduling/ScheduleCalendar';
import { getCustomerServiceStatus, uniqueBookings, type CustomerServiceBooking } from './CsPostService';

const BOOKINGS_PATH = '/cs/bookings';
const APPROVALS_PATH = '/cs/my-submissions';
const POST_SERVICE_PATH = '/cs/post-service';
const DAILY_SALES_PATH = '/cs/daily-sales';
const UPCOMING_DAYS = 7;
const VISIBLE_LATEST = 5;

type Submission = { id: string; type: 'booking' | 'collection' | 'refund'; subtype: string | null; bookingNo: string; client: string; submittedAt: string; status: string };
type SalesEntry = { date: string; reportStatus?: string };
type DashboardData = { bookings: Booking[]; submissions: Submission[]; postService: CustomerServiceBooking[]; sales: SalesEntry[]; salesToday: string | null };

const EMPTY_DATA: DashboardData = { bookings: [], submissions: [], postService: [], sales: [], salesToday: null };
const manilaDateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(value);
const pickupValue = (booking: Booking) => booking.preferredTime || booking.time;
const serviceDate = (booking: Booking) => String(booking.date ?? '').slice(0, 10);
const isCancelled = (booking: Booking) => normalizeBookingStatus(booking.status) === 'Cancelled';
const createdTime = (booking: Booking) => new Date(booking.createdAt ?? '').getTime() || 0;

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function requestLabel(item: Submission) {
  if (item.type === 'collection') return 'Collection';
  if (item.type === 'refund') return 'Refund';
  if (item.subtype === 'reschedule') return 'Reschedule';
  if (item.subtype === 'cancel') return 'Cancellation';
  return 'Booking request';
}

/** Answers two questions for Customer Service: what needs doing, and what can I tell a customer who calls? */
export default function CsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const date = manilaDateKey(new Date());
      const [bookings, submissions, postService, sales, summary] = await Promise.all([
        api.get<Booking[]>('/booking'),
        api.get<Submission[]>('/approvals/mine'),
        api.get<CustomerServiceBooking[]>('/post-service'),
        api.get<SalesEntry[]>('/daily-sales?completedOnly=true'),
        api.get<{ totalSales?: string }>(`/daily-sales/summary?date=${date}&completedOnly=true`),
      ]);
      setData({
        bookings: bookings.data ?? [],
        submissions: submissions.data ?? [],
        postService: uniqueBookings(Array.isArray(postService.data) ? postService.data : []),
        sales: sales.data ?? [],
        salesToday: summary.data?.totalSales ?? null,
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
    window.addEventListener('focus', refresh);
    const refreshId = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(refreshId);
    };
  }, [load]);

  const today = manilaDateKey(new Date());
  const yesterday = addDays(today, -1);
  const { bookings, submissions, postService, sales, salesToday } = data;

  const view = useMemo(() => {
    const active = bookings.filter(booking => !isCancelled(booking));
    const lastUpcoming = addDays(today, UPCOMING_DAYS);
    return {
      todaysBookings: active
        .filter(booking => serviceDate(booking) === today)
        .sort((a, b) => (parseScheduleTime(pickupValue(a))?.minutes ?? Infinity) - (parseScheduleTime(pickupValue(b))?.minutes ?? Infinity)),
      receivedToday: bookings.filter(booking => createdTime(booking) && manilaDateKey(new Date(createdTime(booking))) === today).length,
      nextDays: active.filter(booking => serviceDate(booking) > today && serviceDate(booking) <= lastUpcoming).length,
      latest: [...active].sort((a, b) => createdTime(b) - createdTime(a)).slice(0, VISIBLE_LATEST),
      pastDue: active.filter(booking => normalizeBookingStatus(booking.status) === 'For Plotting' && serviceDate(booking) && serviceDate(booking) < today).length,
    };
  }, [bookings, today]);

  const tasks = useMemo(() => {
    const todaysSales = sales.filter(entry => entry.date === today);
    return {
      waiting: submissions
        .filter(item => item.status === 'Pending' || item.status === 'Requested')
        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()),
      rejected: submissions.filter(item => item.status === 'Rejected').length,
      toVerify: postService.filter(booking => getCustomerServiceStatus(booking) === 'Pending Review').length,
      issues: postService.filter(booking => booking.issueReported === true && booking.postServiceStatus !== 'Finalized').length,
      salesToSubmit: todaysSales.some(entry => entry.reportStatus !== 'Submitted') ? todaysSales.length : 0,
    };
  }, [submissions, postService, sales, today]);

  const count = (value: number) => (loading ? '-' : value);
  const allCaughtUp = !tasks.rejected && !view.pastDue && !tasks.issues && !tasks.toVerify && !tasks.salesToSubmit;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="DASHBOARD"
        subtitle={<>Manage bookings, daily sales, and customer <span className="font-medium text-[#d4a72c]">service.</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
      />

      {failed && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Live data couldn't be loaded, so these numbers may be out of date.</span>
          <button type="button" onClick={() => { void load(); }} className="inline-flex h-9 w-fit items-center rounded-lg border border-red-300 bg-white px-3 font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Bookings Today" value={count(view.todaysBookings.length)} icon={CalendarDays} iconColor="#1a1f6e" variant="dashboard-compact" />
        <KPICard label={`Next ${UPCOMING_DAYS} Days`} value={count(view.nextDays)} icon={CalendarRange} iconColor="#0ea5e9" variant="dashboard-compact" />
        <KPICard label="Received Today" value={count(view.receivedToday)} icon={Inbox} iconColor="#8b5cf6" variant="dashboard-compact" />
        <KPICard label="Sales Today" value={loading ? '-' : salesToday ?? '-'} icon={Wallet} iconColor="#10b981" variant="dashboard-compact" />
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)] xl:grid-rows-[auto_1fr]">
        <SectionCard title="Today's Bookings">
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-400">Loading...</p>
          ) : view.todaysBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-600">No bookings scheduled today.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {view.todaysBookings.map(booking => (
                <li key={booking.id} className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[76px_minmax(0,1fr)_minmax(0,0.7fr)_auto]">
                  <span className="text-[15px] font-semibold tabular-nums text-[#1a1f6e]">{parseScheduleTime(pickupValue(booking))?.label ?? 'No time'}</span>
                  <span className="min-w-0">
                    <span className="block break-words text-[15px] font-medium text-slate-900">{booking.client || 'Client unavailable'}</span>
                    <span className="block text-sm tabular-nums text-slate-600">{booking.bookingNo || booking.bookingId}</span>
                  </span>
                  <span className="col-start-2 min-w-0 break-words text-sm tabular-nums text-slate-900 sm:col-start-auto">{booking.contact || 'No contact number'}</span>
                  <span className="col-start-2 sm:col-start-auto sm:justify-self-end">
                    <StatusBadge status={normalizeBookingStatus(booking.status)} size="xs" variant="outline" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="order-last min-w-0 overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm xl:order-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <h2 className="text-lg font-medium text-slate-900">Latest Bookings Received</h2>
            <button type="button" onClick={() => navigate(BOOKINGS_PATH)} className="inline-flex h-9 w-fit items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
              View all<ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-auto text-sm">
              <thead className="bg-[#1a1f6e]">
                <tr>
                  {['BOOKING NO.', 'CLIENT', 'SERVICE DATE', 'AMOUNT', 'STATUS'].map(column => (
                    <th key={column} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : view.latest.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No bookings received yet.</td></tr>
                ) : view.latest.map(booking => (
                  <tr key={booking.id} className="transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">{booking.bookingNo || '-'}</td>
                    <td className="px-4 py-3 text-slate-900">{booking.client}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-900">{serviceDate(booking) ? formatJobOrderDate(serviceDate(booking)) : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-900">{formatBookingAmount(booking.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={normalizeBookingStatus(booking.status)} size="xs" variant="outline" /></td>
                  </tr>
                ))}
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
                {tasks.rejected > 0 && <ActionRow label="Requests Rejected" detail="Fix and resend, or withdraw" value={tasks.rejected} tone="red" onClick={() => navigate(APPROVALS_PATH)} />}
                {view.pastDue > 0 && <ActionRow label="Past Date, Not Assigned" detail="Ask the customer to reschedule or cancel" value={view.pastDue} tone="red" onClick={() => navigate(`${BOOKINGS_PATH}?status=${encodeURIComponent('For Plotting')}&to=${yesterday}`)} />}
                {tasks.issues > 0 && <ActionRow label="Issues Reported" detail="Problems reported after service" value={tasks.issues} tone="amber" onClick={() => navigate(POST_SERVICE_PATH)} />}
                {tasks.toVerify > 0 && <ActionRow label="Post-Service to Verify" detail="Finished jobs to check and confirm" value={tasks.toVerify} tone="blue" onClick={() => navigate(POST_SERVICE_PATH)} />}
                {tasks.salesToSubmit > 0 && <ActionRow label="Submit Today's Sales" detail="Sales records not yet sent to Admin" value={tasks.salesToSubmit} tone="emerald" onClick={() => navigate(DAILY_SALES_PATH)} />}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Waiting for Admin">
            {tasks.waiting.length === 0 ? (
              <p className="flex items-center gap-2 py-2 text-sm text-slate-600"><Clock3 className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />{loading ? 'Loading...' : 'No requests waiting for a decision.'}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tasks.waiting.map(item => (
                  <li key={`${item.type}-${item.id}`} className="py-2.5 first:pt-0 last:pb-0">
                    <span className="block break-words text-sm font-medium text-slate-900">{item.client}</span>
                    <span className="block text-sm text-slate-600">{requestLabel(item)} · {item.bookingNo}</span>
                    <span className="block text-sm text-slate-600">Sent {formatJobOrderDate(manilaDateKey(new Date(item.submittedAt)))}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
