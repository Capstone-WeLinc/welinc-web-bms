interface PageNumbersProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function PageNumbers({ page, totalPages, onPageChange }: PageNumbersProps) {
  const count = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), count);
  const start = Math.max(1, Math.min(current - 1, count - 2));
  const pages = Array.from({ length: Math.min(3, count) }, (_, index) => start + index);
  const buttonClass = 'h-8 min-w-8 rounded-lg border border-slate-200 px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav aria-label="Table pagination" className="flex items-center gap-2">
      <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => onPageChange(current - 1)} className={buttonClass}>‹</button>
      {pages.map(number => (
        <button type="button" key={number} aria-label={`Go to page ${number}`} aria-current={number === current ? 'page' : undefined} onClick={() => onPageChange(number)} className={number === current ? 'h-8 min-w-8 rounded-lg bg-[#030848] px-2 text-sm font-semibold text-white' : buttonClass}>{number}</button>
      ))}
      <button type="button" aria-label="Next page" disabled={current === count} onClick={() => onPageChange(current + 1)} className={buttonClass}>›</button>
    </nav>
  );
}
