import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Page numbers with ellipses, the same pattern as the table pagination. */
function pageItems(current: number, count: number): (number | 'ellipsis-start' | 'ellipsis-end')[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis-end', count];
  if (current >= count - 3) return [1, 'ellipsis-start', count - 4, count - 3, count - 2, count - 1, count];
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', count];
}

/**
 * Pagination for card grids (spec bms/0017): sits in its own white card below the grid,
 * with the range shown, previous/next and page numbers.
 */
export default function CardPagination({ page, pageSize, totalItems, itemLabel = 'items', onPageChange }: {
  page: number;
  pageSize: number;
  totalItems: number;
  /** Plural noun for the range text, e.g. "vehicles". */
  itemLabel?: string;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(totalItems, current * pageSize);
  const arrow = 'inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
  const number = 'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30';

  return (
    <div className="flex flex-col items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-2.5 shadow-sm sm:flex-row">
      <p className="whitespace-nowrap text-sm text-slate-500">
        Showing <span className="font-medium text-slate-800">{first}–{last}</span> of <span className="font-medium text-slate-800">{totalItems}</span> {itemLabel}
      </p>
      <nav aria-label={`${itemLabel} pages`} className="flex items-center gap-0.5">
        <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => onPageChange(current - 1)} className={arrow}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pageItems(current, pageCount).map(item => typeof item === 'number' ? (
          <button key={item} type="button" aria-label={`Go to page ${item}`} aria-current={item === current ? 'page' : undefined} onClick={() => onPageChange(item)} className={item === current ? 'inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#030848] px-2 text-sm font-semibold text-white' : number}>{item}</button>
        ) : (
          <span key={item} aria-hidden="true" className="px-0.5 text-sm text-slate-500">…</span>
        ))}
        <button type="button" aria-label="Next page" disabled={current === pageCount} onClick={() => onPageChange(current + 1)} className={arrow}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
