import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

type ReviewEvent = {
  eventId: string;
  bookingUuid: string | null;
  eventType: string;
  externalBookingId: string;
  occurredAt: string;
  reason: string | null;
  payload: { booking?: { customerName?: string; service?: string; date?: string } };
};

export default function WelincReviewPanel() {
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    try {
      const { data } = await api.get<ReviewEvent[]>('/integrations/welinc/review');
      setEvents(data);
      setError(false);
    } catch { setError(true); }
  }
  useEffect(() => { void load(); }, []);

  async function decide(event: ReviewEvent, action: 'apply' | 'dismiss') {
    const note = notes[event.eventId]?.trim();
    if (!note) { toast.error('Enter a review note first.'); return; }
    setBusy(event.eventId);
    try {
      await api.post(`/integrations/welinc/review/${encodeURIComponent(event.eventId)}`, { action, note });
      toast.success(action === 'apply' ? 'Welinc update applied' : 'Welinc update dismissed');
      await load();
    } catch (err) {
      const response = err as { response?: { data?: { message?: string } } };
      toast.error(response.response?.data?.message ?? 'Unable to resolve the Welinc update.');
    } finally { setBusy(null); }
  }

  async function release(event: ReviewEvent) {
    if (!event.bookingUuid || !window.confirm('Release this un-distributed assignment for Welinc review? The booking will need a new assignment if you dismiss the update.')) return;
    setBusy(event.eventId);
    try {
      await api.post(`/dispatch/assignments/${event.bookingUuid}/release`);
      toast.success('Assignment released. Review the Welinc update now.');
      await load();
    } catch (err) {
      const response = err as { response?: { data?: { message?: string } } };
      toast.error(response.response?.data?.message ?? 'Assignment cannot be released.');
    } finally { setBusy(null); }
  }

  if (!error && events.length === 0) return null;
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-5" aria-label="Welinc updates needing review">
    <div className="mb-3 flex items-center justify-between gap-4">
      <div><h2 className="text-lg font-semibold text-slate-900">Welinc updates needing review</h2>
        <p className="text-sm text-slate-600">An assigned or paid booking cannot be changed automatically. Review its work before applying or dismissing the update.</p></div>
      <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Refresh</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">Unable to load Welinc review events.</p>}
    <div className="space-y-3">{events.map((event) => <div key={event.eventId} className="rounded-lg border border-amber-200 bg-white p-4">
      <p className="font-medium text-slate-900">{event.eventType.replace('booking.', '').replace('.v1', '')} · {event.externalBookingId}</p>
      <p className="text-xs text-slate-600">Event {event.eventId} · {new Date(event.occurredAt).toLocaleString()} · {event.reason ?? 'Booking requires review'}</p>
      {event.payload.booking && <p className="mt-1 text-sm text-slate-700">{event.payload.booking.customerName} · {event.payload.booking.service} · {event.payload.booking.date}</p>}
      <label className="mt-3 block text-sm font-medium text-slate-700">Decision note
        <input value={notes[event.eventId] ?? ''} onChange={(e) => setNotes((previous) => ({ ...previous, [event.eventId]: e.target.value }))}
          maxLength={500} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Explain your decision" />
      </label>
      <div className="mt-3 flex gap-2">
        {event.bookingUuid && <button type="button" disabled={busy === event.eventId} onClick={() => void release(event)}
          className="rounded-lg border border-amber-700 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-50">Release un-distributed assignment</button>}
        <button type="button" disabled={busy === event.eventId} onClick={() => void decide(event, 'apply')}
          className="rounded-lg bg-[#202070] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Apply if now safe</button>
        <button type="button" disabled={busy === event.eventId} onClick={() => void decide(event, 'dismiss')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50">Dismiss with note</button>
      </div>
    </div>)}</div>
  </section>;
}
