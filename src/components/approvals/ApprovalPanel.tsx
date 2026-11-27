import { useState } from 'react';
import { X } from 'lucide-react';
import ApprovalDetailCards from './ApprovalDetailCards';
import ApprovalStatusBadge from './ApprovalStatusBadge';
import { canDecideStatus, type ApprovalItem, type Detail } from './approvalUtils';

// The system's standard footer buttons (as in Services Offered, Edit crew and the other forms).
const secondaryButton = 'inline-flex h-10 w-fit items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = 'inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg bg-[#030848] px-5 text-sm font-semibold text-white hover:bg-[#141a6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b800] disabled:opacity-50';
const dangerButton = 'inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b800] disabled:opacity-50';

/** The Needs action side panel: its own look, with the same sections in the same order as the History details modal. */
export default function ApprovalPanel({ item, detail, loading, busy, onClose, onDecide }: {
  item: ApprovalItem; detail: Detail | null; loading: boolean; busy: boolean;
  onClose: () => void; onDecide: (decision: 'approve' | 'reject', reason?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const canDecide = canDecideStatus(item.status);
  const emergency = item.type === 'crew' && item.subtype === 'emergency';
  const approveText = item.type === 'collection' ? 'Verify' : emergency ? 'Confirm' : 'Approve';

  return <aside aria-label={`${item.bookingNo} details`} className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-[400px] flex-col border-l border-slate-200 bg-white shadow-2xl xl:absolute xl:inset-0 xl:z-auto xl:w-auto xl:max-w-none xl:rounded-xl xl:border xl:shadow-sm">
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="truncate text-base font-bold text-slate-900">{item.bookingNo}</h2>
        <ApprovalStatusBadge status={item.status} />
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Close details" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"><X size={18} /></button>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading || !detail ? <p className="px-5 py-10 text-center text-sm text-slate-500">Loading details...</p> : <>
        <ApprovalDetailCards item={item} detail={detail} pending={canDecide} variant="panel" />
        {rejecting && <section className="border-t border-slate-200 px-5 py-4">
          <label htmlFor="reject-reason" className="text-sm font-medium text-slate-700">Reason for rejection <span className="text-red-600">*</span></label>
          <textarea id="reject-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} maxLength={500} rows={3} autoFocus
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20" placeholder="Enter a reason for the submitter" />
          {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </section>}
      </>}
    </div>

    {canDecide && !loading && <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex justify-end gap-2">
        {rejecting ? <>
          <button type="button" disabled={busy} onClick={() => { setRejecting(false); setReason(''); setError(''); }} className={secondaryButton}>Back</button>
          <button type="button" disabled={busy} onClick={() => { if (!reason.trim()) { setError('Enter a reason before rejecting.'); return; } onDecide('reject', reason.trim()); }} className={dangerButton}>{busy ? 'Saving...' : 'Confirm rejection'}</button>
        </> : <>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={secondaryButton}>Reject</button>
          <button type="button" disabled={busy} onClick={() => onDecide('approve')} className={primaryButton}>{busy ? 'Saving...' : approveText}</button>
        </>}
      </div>
    </footer>}
  </aside>;
}
