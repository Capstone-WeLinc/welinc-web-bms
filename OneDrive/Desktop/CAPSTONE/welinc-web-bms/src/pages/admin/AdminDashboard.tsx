import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardList, Truck, Users, Clock3, CheckCircle2 } from 'lucide-react';
import type { Booking } from '../../lib/types';
import KPICard from '../../components/shared/KpiCard';
import StatusBadge from '../../components/shared/StatusBadge';
import { api } from '../../lib/api';

const KPI_ITEMS = [
  { label: 'Total Bookings', icon: ClipboardList, iconColor: '#1a1f6e', path: '/admin/booking', status: 'All' },
  { label: 'For Plotting', icon: CalendarDays, iconColor: '#f59e0b', path: '/admin/booking', status: 'For Plotting' },
  { label: 'Scheduled', icon: Clock3, iconColor: '#6366f1', path: '/admin/booking', status: 'Scheduled' },
  { label: 'Completed', icon: CheckCircle2, iconColor: '#10b981', path: '/admin/booking', status: 'Completed' },
  { label: 'Active Job Orders', icon: Truck, iconColor: '#0ea5e9', path: '/admin/job-orders' },
  { label: 'Available Vehicles', icon: Truck, iconColor: '#14b8a6', path: '/admin/availability' },
  { label: 'Available Drivers', icon: Users, iconColor: '#8b5cf6', path: '/admin/users' },
];

const STATUS_LABELS = ['For Plotting', 'Confirmed', 'Scheduled', 'Completed', 'Cancelled', 'Discrepancy'];
const STATUS_COLORS: Record<string, string> = {
  'For Plotting': 'bg-amber-500',
  Confirmed: 'bg-blue-500',
  Scheduled: 'bg-indigo-500',
  Completed: 'bg-emerald-500',
  Cancelled: 'bg-red-500',
  Discrepancy: 'bg-orange-500',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);

  const normalizeStatus = (status: string) =>
    status === 'For Correction' ? 'Discrepancy' : status;

  useEffect(() => {
    let mounted = true;
    api.get<Booking[]>('/booking')
      .then((response) => {
        if (mounted) setBookings(response.data ?? []);
      })
      .catch(() => {
        if (mounted) setBookings([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const analytics = useMemo(() => {
    const total = bookings.length;
    const forPlotting = bookings.filter((b) => b.status === 'For Plotting').length;
    const scheduled = bookings.filter((b) => b.status === 'Scheduled').length;
    const completed = bookings.filter((b) => b.status === 'Completed').length;
    const discrepancy = bookings.filter((b) => b.status === 'Discrepancy').length;
    const cancelled = bookings.filter((b) => b.status === 'Cancelled').length;

    return { total, forPlotting, scheduled, completed, discrepancy, cancelled };
  }, [bookings]);

  const kpis = useMemo(
    () => KPI_ITEMS.map((item) => {
      const value =
        item.label === 'Total Bookings' ? analytics.total :
        item.label === 'For Plotting' ? analytics.forPlotting :
        item.label === 'Scheduled' ? analytics.scheduled :
        item.label === 'Completed' ? analytics.completed :
        item.label === 'Flagged' ? analytics.discrepancy :
        item.label === 'Active Job Orders' ? 0 :
        item.label === 'Available Vehicles' ? 0 :
        item.label === 'Available Drivers' ? 0 :
        0;
      return { ...item, value };
    }),
    [analytics]
  );

  const statusBreakdown = useMemo(
    () => STATUS_LABELS.map((status) => ({
      label: status,
      value: bookings.filter((b) => normalizeStatus(b.status) === status).length,
      color: STATUS_COLORS[status] || 'bg-slate-400',
    })),
    [bookings]
  );

  const recentBookings = useMemo(
    () => [...bookings]
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))
      .slice(0, 8),
    [bookings]
  );

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.status ? `${item.path}${item.status !== 'All' ? `?status=${encodeURIComponent(item.status)}` : ''}` : item.path)}
            className="w-full text-left"
          >
            <KPICard
              label={item.label}
              value={item.value}
              icon={item.icon}
              iconColor={item.iconColor}
            />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Status Breakdown</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Current booking distribution by status</p>
            </div>
            <div className="rounded-2xl bg-slate-100 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {bookings.length} bookings
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {statusBreakdown.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  <div className={`${item.color} h-full`} style={{ width: `${Math.max(item.value * 10, 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Bookings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Latest bookings from the booking module</p>
          </div>
          <button
            onClick={() => navigate('/admin/booking')}
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            View all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                {['Booking ID', 'Client', 'Service', 'Date', 'Status', 'Amount'].map((column) => (
                  <th key={column} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">{booking.bookingId ?? booking.id}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{booking.client}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{booking.service}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{booking.date}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={normalizeStatus(booking.status)} />
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">{booking.amount ? `₱${Number(booking.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00'}</td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500">
                    No recent bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
