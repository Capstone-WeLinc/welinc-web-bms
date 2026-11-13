import { Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type FilterChipsProps<T extends string> = {
  options: readonly FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return <div className="relative w-full max-w-[500px]">
    <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      type="text"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-11 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#0a0f2e]/20"
    />
  </div>;
}

type StatusFilterProps<T extends string> = {
  /** Plain strings use themselves as the label; the "all" option is shown as `allLabel`. */
  options: readonly (NoInfer<T> | FilterOption<NoInfer<T>>)[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  /** The option value meaning "no status filter". */
  allValue?: NoInfer<T>;
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
};

/** One dropdown that replaces a row of status filter badges. */
export function StatusFilter<T extends string>({ options, value, onChange, allValue = 'All' as T, allLabel = 'All Status', ariaLabel = 'Filter by status', className = '' }: StatusFilterProps<T>) {
  const items = options.map(option => typeof option === 'string' ? { value: option, label: option } : option);
  return <Select value={value} onValueChange={next => onChange(next as T)}>
    <SelectTrigger aria-label={ariaLabel} className={`h-11 w-full rounded-lg border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm sm:w-[200px] ${className}`}>
      <SelectValue placeholder={allLabel} />
    </SelectTrigger>
    <SelectContent className="rounded-xl border-slate-200 p-1 shadow-[0_14px_36px_rgba(15,23,42,0.16)]">
      {items.map(item => <SelectItem
        key={item.value}
        value={item.value}
        className="my-0.5 rounded-lg py-2.5 text-sm font-medium hover:bg-[#d4a72c] hover:text-black focus:bg-[#d4a72c] focus:text-black data-[highlighted]:bg-[#d4a72c] data-[highlighted]:text-black"
      >{item.value === allValue ? allLabel : item.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}

export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  return <div className="flex flex-wrap items-center gap-2.5">
    {options.map(option => <button
      key={option.value}
      type="button"
      aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}
      className={`inline-flex h-8 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-3.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${value === option.value ? 'border-[#0a0f2e] bg-[#030848] text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >{option.label.toUpperCase()}</button>)}
  </div>;
}
