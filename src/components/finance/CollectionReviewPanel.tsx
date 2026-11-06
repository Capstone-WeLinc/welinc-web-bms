import { useEffect, useState } from 'react';
import { Check, Clock3, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

type Collection = {
  id: string; bookingNo: string; clientName: string; amount: string; method: string;
  reference: string; status: string; businessDate: string;
};
type PendingRefund = { id: string; collectionId: string; amount: string; reason: string; projectionError: string | null };

const PHP_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
function formatPeso(value: string | number) {
  const amount = Number(value);
  return PHP_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
}

export default function CollectionReviewPanel({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<Collection[]>([]);
  const [pendingRefunds, setPendingRefunds] = useState<PendingRefund[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    Promise.all([api.get<Collection[]>('/collections/pending'), api.get<PendingRefund[]>('/collections/refunds/pending')])
      .then(([collections, refunds]) => { setItems(collections.data); setPendingRefunds(refunds.data); })
      .catch(() => toast.error('Unable to load collections'));
  }
  useEffect(refresh, []);

  async function act(path: string, id: string, body?: unknown) {
    setBusy(id);
    try {
      await api.post(path, body);
      refresh(); onChanged();
      toast.success('Collection updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to update collection');
    } finally { setBusy(null); }
  }

  return (
    <section className="rounded-xl border border-slate-200/70 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-sm font-semibold text-slate-900">Collection review and refunds</h2>
      </div>
      <div className="mt-3 space-y-2">
        {pendingRefunds.map((item) => <div key={item.id} className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p><strong>Refund needs retry</strong> &middot; {formatPeso(item.amount)} &middot; {item.reason}</p>
          {item.projectionError && <p className="mt-1 text-sm text-amber-800">{item.projectionError}</p>}
          <button disabled={busy === item.id} onClick={() => act('/collections/refunds/' + item.id + '/retry', item.id)} className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 text-xs font-medium text-amber-900 disabled:opacity-50"><RotateCcw size={16} aria-hidden="true" />Retry refund sync</button>
        </div>)}
        {items.length === 0 && <p className="text-sm text-slate-500">No collections awaiting verification.</p>}
        {items.map((item) => {
          const pending = ['PENDING', 'VERIFYING'].includes(item.status);
          const badgeClass = 'border-amber-300 bg-amber-50 text-amber-800';

          return <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.bookingNo}</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{item.method}</span>
                </div>
                <p className="text-sm text-slate-600">&middot; {item.clientName}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums text-slate-900">{formatPeso(item.amount)}</p>
                </div>
                <span className={'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase ' + badgeClass}>
                  <Clock3 size={14} aria-hidden="true" />
                  {item.status}
                </span>
              </div>
              {pending && <div className="flex items-center gap-1">
                <button disabled={busy === item.id} onClick={() => act('/collections/' + item.id + '/verify', item.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 disabled:opacity-50"><Check size={16} aria-hidden="true" />Verify</button>
                {item.status === 'PENDING' && <button disabled={busy === item.id} onClick={() => act('/collections/' + item.id + '/reject', item.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 disabled:opacity-50"><X size={16} aria-hidden="true" />Reject</button>}
              </div>}
            </div>
          </div>;
        })}
      </div>
    </section>
  );
}
