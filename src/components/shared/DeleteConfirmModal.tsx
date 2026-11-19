import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';

/**
 * The One UI delete confirmation (first used on Services Offered). Every delete
 * in the system should use this so they look and behave the same.
 */
export default function DeleteConfirmModal({ open, title, itemName, deleting = false, onCancel, onConfirm, children }: {
  open: boolean;
  /** e.g. "Delete Driver" */
  title: string;
  /** Shown in bold in the default message. */
  itemName?: ReactNode;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Replaces the default "Are you sure you want to delete …?" message. */
  children?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={next => { if (!next && !deleting) onCancel(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-slate-950/50" />
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
          <DialogPrimitive.Content aria-describedby={undefined} className="pointer-events-auto max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-xl focus:outline-none">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle size={18} strokeWidth={2} aria-hidden="true" />
                <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              </div>
              <button type="button" onClick={onCancel} disabled={deleting} aria-label="Close delete dialog" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                <X size={20} />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {children ?? <>Are you sure you want to delete <strong className="font-bold text-slate-700">{itemName}</strong>? This action cannot be undone.</>}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={deleting} onClick={onCancel} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={deleting} onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Confirm Delete'}</button>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
