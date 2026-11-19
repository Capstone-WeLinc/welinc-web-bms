import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { CheckCircle2, Clock3, MapPin, MessageSquare, PackageCheck, Truck } from 'lucide-react';

type TrackingStep = {
  id: 'confirmed' | 'assigned' | 'pickup' | 'transit' | 'delivery';
  title: string;
  description: string;
  state: 'complete' | 'current' | 'upcoming' | 'cancelled';
  timestamp: string | null;
};
type TrackingData = {
  bookingNo: string;
  client: string;
  service: string;
  date: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  driver: { name: string; contact: string } | null;
  vehicle: string | null;
  supportEmail: string;
  timeline: TrackingStep[];
  updatedAt: string;
};

const dateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));
const serviceDate = (value: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
}).format(new Date(`${value.slice(0, 10)}T00:00:00+08:00`));

export default function BookingTracking() {
  const { bookingId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') /* signed customer tracking capability */ ?? ''; // check-system: allow customer tracking capability is not a user login token
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId || !token) { setLoading(false); setError(true); return; }
    try {
      const response = await api.get<TrackingData>(`/public/tracking/${encodeURIComponent(bookingId)}`, { params: { token } });
      setTracking(response.data);
      setError(false);
    } catch {
      setError(true);
      setTracking(null);
    } finally { setLoading(false); }
  }, [bookingId, token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const supportEmail = tracking?.supportEmail ?? '';
  const statusTone = tracking?.status === 'Delivered' ? 'bg-emerald-500'
    : tracking?.status === 'Cancelled' ? 'bg-red-500'
      : tracking?.status === 'Pending Approval' ? 'bg-amber-500' : 'bg-emerald-500';
  const supportSubject = encodeURIComponent(`Booking support: ${tracking?.bookingNo ?? ''}`);
  const supportBody = encodeURIComponent(`Hello, I need help with booking ${tracking?.bookingNo ?? ''}.`);
  const supportHref = supportEmail ? `mailto:${supportEmail}?subject=${supportSubject}&body=${supportBody}` : undefined;

  if (loading && !tracking) return <main className="flex min-h-screen items-center justify-center bg-[#f1f4fa] p-4"><p className="text-sm text-slate-600">Loading booking tracking...</p></main>;
  if (error || !tracking) return <main className="flex min-h-screen items-center justify-center bg-[#f1f4fa] p-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"><PackageCheck className="mx-auto h-10 w-10 text-slate-400" /><h1 className="mt-3 text-xl font-semibold text-[#1a1f6e]">Tracking link unavailable</h1><p className="mt-2 text-sm text-slate-600">This link may be invalid. Please open the latest tracking email or contact support.</p></section></main>;

  return <main className="min-h-screen bg-[#f1f4fa] px-3 py-6 sm:px-5">
    <div className="mx-auto max-w-[520px] space-y-4">
      <header className="px-1">
        <h1 className="text-xl font-bold text-[#1a1f6e]">Track Your Booking</h1>
        <p className="text-sm text-slate-600">Real-time updates on your shipment</p>
      </header>

      <section className="rounded-2xl bg-[#1a1f6e] p-4 text-white shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="text-xs text-indigo-200">Booking ID</p><p className="mt-0.5 break-all text-lg font-bold">{tracking.bookingNo}</p></div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white ${statusTone}`}>{tracking.status}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-white/20 pt-3">
          <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-indigo-200">From</p><p className="mt-0.5 break-words text-sm font-medium">{tracking.pickupAddress}</p></div>
          <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-indigo-200">To</p><p className="mt-0.5 break-words text-sm font-medium">{tracking.deliveryAddress}</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#1a1f6e]">Live Tracking Status</h2><p className="mt-0.5 text-xs text-slate-500">{tracking.service} - {serviceDate(tracking.date)}</p></div><span className="text-[11px] text-slate-400">Auto-updates</span></div>
        <ol className="space-y-0">
          {tracking.timeline.map((step, index) => {
            const complete = step.state === 'complete';
            const current = step.state === 'current';
            const Icon = step.id === 'confirmed' || step.id === 'assigned' ? CheckCircle2 : step.id === 'pickup' || step.id === 'transit' ? (step.id === 'transit' ? Truck : PackageCheck) : MapPin;
            const iconTone = complete ? 'bg-emerald-100 text-emerald-700' : current ? 'bg-blue-100 text-blue-700' : step.state === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
            const lineTone = complete ? 'border-emerald-300' : current ? 'border-blue-300' : 'border-slate-200';
            return <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < tracking.timeline.length - 1 && <span className={`absolute bottom-0 left-[11px] top-7 border-l-2 ${lineTone}`} aria-hidden="true" />}
              <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconTone}`}><Icon size={14} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1 pt-0.5"><p className={`text-sm font-semibold ${complete ? 'text-[#1a1f6e]' : current ? 'text-blue-800' : 'text-slate-500'}`}>{step.title}</p><p className="mt-0.5 text-xs leading-relaxed text-slate-600">{step.description}</p>{step.timestamp && <p className="mt-1 text-[11px] text-slate-500">{dateTime(step.timestamp)}</p>}</div>
            </li>;
          })}
        </ol>
        {tracking.vehicle && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Assigned vehicle: <span className="font-medium text-slate-800">{tracking.vehicle}</span></p>}
      </section>

      <nav aria-label="Booking support actions" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a href={tracking.driver?.contact ? `tel:${tracking.driver.contact}` : undefined} aria-disabled={!tracking.driver?.contact} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm ${tracking.driver?.contact ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-50'}`}><Truck size={15} aria-hidden="true" />Contact Driver</a>
        <a href={supportHref} aria-disabled={!supportHref} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm ${supportHref ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-50'}`}><MessageSquare size={15} aria-hidden="true" />Message Support</a>
        <a href={supportHref ? `mailto:${supportEmail}?subject=${encodeURIComponent(`Change request: ${tracking.bookingNo}`)}&body=${encodeURIComponent(`Hello, I would like to request a change to booking ${tracking.bookingNo}.`)}` : undefined} aria-disabled={!supportHref} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm ${supportHref ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-50'}`}><Clock3 size={15} aria-hidden="true" />Request Change</a>
      </nav>
      <p className="px-1 text-center text-[11px] text-slate-500">Last updated {dateTime(tracking.updatedAt)}</p>
    </div>
  </main>;
}
