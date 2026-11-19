import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function TablePagination({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }: TablePaginationProps) {
  const pageCount = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), pageCount);
  const shown = Math.max(0, Math.min(pageSize, totalItems - (current - 1) * pageSize));
  const pageButtons: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];

  if (pageCount <= 7) {
    for (let n = 1; n <= pageCount; n += 1) pageButtons.push(n);
  } else if (current <= 4) {
    pageButtons.push(1, 2, 3, 4, 5, 'ellipsis-end', pageCount);
  } else if (current >= pageCount - 3) {
    pageButtons.push(1, 'ellipsis-start', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount);
  } else {
    pageButtons.push(1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', pageCount);
  }

  const control = 'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30';

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-sm text-slate-500 sm:flex-row">
      <p className="whitespace-nowrap">{shown} of {totalItems} items</p>
      <nav aria-label="Table pagination" className="flex items-center justify-center gap-1">
        {pageButtons.map(item => typeof item === 'number' ? (
          <button key={item} type="button" aria-label={`Go to page ${item}`} aria-current={item === current ? 'page' : undefined} onClick={() => onPageChange(item)} className={item === current ? 'inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#030848] px-2 text-sm font-semibold text-white' : control}>{item}</button>
        ) : (
          <span key={item} aria-hidden="true" className="px-1 text-sm text-slate-500">…</span>
        ))}
      </nav>
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
        <span>Show</span>
        <Select value={pageSize === Number.MAX_SAFE_INTEGER ? 'all' : String(pageSize)} onValueChange={value => onPageSizeChange(value === 'all' ? Number.MAX_SAFE_INTEGER : Number(value))}>
          <SelectTrigger aria-label="Rows per page" className="h-9 w-[104px] rounded-xl border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-[#1a1f6e] focus:ring-[#1a1f6e]/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" className="w-fit min-w-0 rounded-xl border-slate-200 p-1 shadow-lg">
            {[8, 10, 25, 50].map(size => <SelectItem key={size} value={String(size)} className="my-0.5 rounded-lg py-2.5 text-sm font-medium">{size} rows</SelectItem>)}
            <SelectItem value="all" className="my-0.5 rounded-lg py-2.5 text-sm font-medium">All rows</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
