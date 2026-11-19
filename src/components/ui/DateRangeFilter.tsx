import { X } from 'lucide-react';
import { DatePicker } from './DatePicker';

/**
 * The one From – To date filter, shown in a page header's action slot: a "Date" label, two date
 * pickers and, once a date is picked, a clear button (left out when the page clears dates elsewhere).
 */
export default function DateRangeFilter({ from, to, onFromChange, onToChange, onClear }: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <div role="group" aria-label="Date range" className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-600">Date</span>
      <DatePicker value={from} onChange={onFromChange} max={to || undefined} placeholder="From" popover className="w-[170px]" />
      <span aria-hidden="true" className="text-slate-400">–</span>
      <DatePicker value={to} onChange={onToChange} min={from || undefined} placeholder="To" popover className="w-[170px]" />
      {onClear && (from || to) && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear date filter"
          title="Clear date filter"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
