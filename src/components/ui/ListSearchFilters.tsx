import { Search } from 'lucide-react';

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
