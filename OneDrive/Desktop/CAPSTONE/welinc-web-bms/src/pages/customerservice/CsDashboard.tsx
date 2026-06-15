import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Clock3 } from 'lucide-react';
import type { Booking } from '../../lib/types';
import KPICard from '../../components/shared/KpiCard';
import StatusBadge from '../../components/shared/StatusBadge';
import { api } from '../../lib/api';

export default function CsDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    let mounted = true;
    api.get<Booking[]>('/booking')
      .then((r) => { if (mounted) setBookings(r.data ?? []); })
      .catch(() => { if (mounted) setBookings([]); });
    return () => { mounted = false; };
  }, []);

  const normalizeStatus = (status: string) =>
    status === 'For Correction' ? 'Discrepancy' : status;

  const analytics = useMemo(() => {
    const total = bookings.length;
    const completed = bookings.filter((b) => normalizeStatus(b.status) === 'Completed').length;
    const discrepancy = bookings.filter((b) => normalizeStatus(b.status) === 'Discrepancy').length;
    const pendingPayments = bookings.filter((b) => {
      const status = b.paymentStatus?.toLowerCase();
      return status !== 'paid';
    }).length;
    return { total, completed, discrepancy, pendingPayments };
  }, [bookings]);

  const kpis = [
    { label: 'Total Bookings', status: 'All', icon: ClipboardList, iconColor: '#1a1f6e', value: analytics.total },
    { label: 'Completed', status: 'Completed', icon: CheckCircle2, iconColor: '#10b981', value: analytics.completed },
    { label: 'Discrepancies', status: 'Discrepancy', icon: ClipboardList, iconColor: '#ef4444', value: analytics.discrepancy },
  ];

  const monthlyCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    const year = new Date().getFullYear();
    bookings.forEach((b) => {
      const d = new Date(b.date);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === year) {
        const m = d.getMonth();
        if (m >= 0 && m < 6) counts[m] += 1;
      }
    });
    return counts;
  }, [bookings]);

  const monthlyMax = Math.max(...monthlyCounts, 1);
  const monthlyAxis = useMemo(() => {
    const rawStep = Math.ceil(monthlyMax / 4);
    const niceStep = [10, 20, 25, 50, 100, 200].find((step) => step >= rawStep) ?? Math.ceil(rawStep / 100) * 100;
    const top = niceStep * 4;
    return [top, top - niceStep, top - niceStep * 2, top - niceStep * 3, 0];
  }, [monthlyMax]);

  const recentBookings = useMemo(() => {
    return [...bookings].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0)).slice(0, 8);
  }, [bookings]);

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => navigate(`/cs/bookings${k.status !== 'All' ? `?status=${encodeURIComponent(k.status)}` : ''}`)}
            className="w-full text-left"
          >
            <KPICard label={k.label} value={k.value} icon={k.icon} iconColor={k.iconColor} />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Monthly Bookings</h2>
              <p className="text-base text-slate-600 dark:text-slate-400 mt-1">Jan - Jun {new Date().getFullYear()}</p>
            </div>
            <div className="text-base font-semibold text-slate-700 dark:text-slate-300">Total {bookings.length}</div>
          </div>
          <div className="mt-6 grid grid-cols-[auto_1fr] gap-3 items-end h-56">
            <div className="flex flex-col justify-between items-end text-sm text-slate-500 dark:text-slate-400 h-full">
              {monthlyAxis.map((value) => (
                <span key={value} className="leading-tight">{value}</span>
              ))}
            </div>
            <div className="relative h-full w-full border border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900 p-4">
              <div className="absolute inset-0 grid grid-rows-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="border-t border-slate-200 dark:border-slate-700/60" />
                ))}
              </div>
              <div className="relative z-10 h-full flex items-end gap-3">
                {['Jan','Feb','Mar','Apr','May','Jun'].map((label, index) => {
                  const value = monthlyCounts[index];
                  const height = Math.round((value / monthlyAxis[0]) * 100);
                  const currentMonth = new Date().getMonth();
                  const isActive = currentMonth === index;
                  return (
                    <div key={label} className="flex flex-col items-center gap-2 w-full">
                      <div className="flex h-full w-full items-end justify-center">
                        <div
                          className={`w-full rounded-t-3xl ${isActive ? 'bg-slate-900 dark:bg-slate-200' : 'bg-slate-700 dark:bg-slate-400'}`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Bookings</h3>
          </div>
          <button
            onClick={() => navigate('/cs/bookings')}
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            View all
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                {['Booking ID','Client','Date','Status'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentBookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{b.bookingId ?? b.id}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{b.client}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{b.date}</td>
                  <td className="px-4 py-3"><StatusBadge status={normalizeStatus(b.status)} /></td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No recent bookings.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
