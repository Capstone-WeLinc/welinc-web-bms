import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';

type BookingOption = { id: string; bookingId: string; bookingNo: string; client: string; status: string; amount: number | string | null };

export default function CollectionEntryPanel({ onCreated }: { onCreated: () => void }) {
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<BookingOption[]>('/collections/eligible-bookings').then(({ data }) => setBookings(data))
      .catch(() => toast.error('Unable to load bookings for collection entry'));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post('/collections', { idempotencyKey: key, bookingId, amount, method, reference: reference.trim() });
      toast.success('Collection recorded for Admin verification');
      setAmount(''); setReference(''); setKey(crypto.randomUUID());
      try {
        const { data } = await api.get<BookingOption[]>('/collections/eligible-bookings');
        setBookings(data);
      } catch { /* Keep the current options if refreshing the list fails. */ }
      onCreated();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to record collection');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-[#0a0f2e]">Record a collection</h2>
      <p className="mt-1 text-sm text-slate-500">Only Admin verified collections appear in daily sales. Work completion alone does not record payment.</p>
      <div className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="collection-booking" className="text-sm font-medium leading-5 text-slate-700">Booking</label>
          <div>
            <Select required value={bookingId} onValueChange={(value) => { setBookingId(value); setKey(crypto.randomUUID()); }}>
              <SelectTrigger id="collection-booking" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-0 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20">
                <SelectValue placeholder="Choose a booking" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 p-1 shadow-[0_14px_36px_rgba(15,23,42,0.16)]">
                {bookings.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="my-0.5 rounded-lg py-2.5 text-sm font-medium hover:bg-[#d4a72c] hover:text-black focus:bg-[#d4a72c] focus:text-black data-[highlighted]:bg-[#d4a72c] data-[highlighted]:text-black data-[state=checked]:bg-[#d4a72c] data-[state=checked]:text-black">
                    {item.bookingNo} - {item.client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="collection-amount" className="text-sm font-medium leading-5 text-slate-700">Amount collected (PHP)</label>
          <input id="collection-amount" required type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); setKey(crypto.randomUUID()); }} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="collection-method" className="text-sm font-medium leading-5 text-slate-700">Payment method</label>
          <div>
            <Select value={method} onValueChange={(value) => { setMethod(value); setKey(crypto.randomUUID()); }}>
              <SelectTrigger id="collection-method" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-0 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 p-1 shadow-[0_14px_36px_rgba(15,23,42,0.16)]">
                {['Cash', 'BDO', 'GCash', 'Xendit'].map((name) => (
                  <SelectItem key={name} value={name} className="my-0.5 rounded-lg py-2.5 text-sm font-medium hover:bg-[#d4a72c] hover:text-black focus:bg-[#d4a72c] focus:text-black data-[highlighted]:bg-[#d4a72c] data-[highlighted]:text-black data-[state=checked]:bg-[#d4a72c] data-[state=checked]:text-black">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="collection-reference" className="text-sm font-medium leading-5 text-slate-700">Receipt or transaction reference</label>
          <input id="collection-reference" required maxLength={100} value={reference} onChange={(event) => { setReference(event.target.value); setKey(crypto.randomUUID()); }} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20" />
        </div>
      <button type="submit" disabled={saving} className="inline-flex h-10 w-fit shrink-0 items-center whitespace-nowrap rounded-lg bg-[#1a1f6e] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Record collection'}</button>
      </div>
    </form>
  );
}
