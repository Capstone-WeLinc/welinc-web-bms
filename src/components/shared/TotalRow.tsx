import type { ReactNode } from 'react';

/**
 * The One UI total line for modals (first used in the booking and job order cost
 * summary): a divider, "Total" on the left, and the amount in navy on the right.
 * Every total shown in a modal should use this.
 */
export default function TotalRow({ label = 'Total', value, note }: {
  label?: ReactNode;
  value: ReactNode;
  /** Optional small line under the label, e.g. "12 invoices recorded". */
  note?: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
      <span className="min-w-0">
        <span className="block text-base font-medium text-slate-900">{label}</span>
        {note && <span className="block text-xs text-slate-500">{note}</span>}
      </span>
      <span className="shrink-0 text-right text-[22px] font-medium tabular-nums text-[#1a1f6e]">{value}</span>
    </div>
  );
}
