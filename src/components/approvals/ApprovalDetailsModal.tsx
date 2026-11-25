import { ClipboardCheck } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/Dialog';
import ModalHeader from '../ui/ModalHeader';
import ApprovalDetailCards from './ApprovalDetailCards';
import ApprovalStatusBadge from './ApprovalStatusBadge';
import type { ApprovalItem, Detail } from './approvalUtils';

/** Read-only details of a decided request, opened from the View icon on the Approvals History tab. */
export default function ApprovalDetailsModal({ item, detail, loading, onClose }: {
  item: ApprovalItem | null; detail: Detail | null; loading: boolean; onClose: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-xl border-0 bg-white p-0 text-slate-800 shadow-xl sm:rounded-xl"
      >
        <ModalHeader
          icon={ClipboardCheck}
          title="Approval details"
          subtitle={item?.bookingNo ?? '-'}
          aside={item && <ApprovalStatusBadge status={item.status} />}
          onClose={onClose}
          closeLabel="Close approval details"
        />

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f1f4fa] p-4">
          {!item || loading || !detail
            ? <p className="py-10 text-center text-sm text-slate-500">Loading details...</p>
            : <ApprovalDetailCards item={item} detail={detail} pending={false} />}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
            Close
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
