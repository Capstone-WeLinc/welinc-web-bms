import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { CalendarDays, Check, ChevronDown, Search } from 'lucide-react';
import type { ForecastHorizon } from './types';

/** Extra words each period answers to when typed in the search box. */
const SEARCH_WORDS: Record<ForecastHorizon, string[]> = {
  nextMonth: ['next month', 'month', 'calendar month'],
  '7days': ['7', 'seven', 'week', 'next week', 'days'],
  '30days': ['30', 'thirty', 'month', 'days'],
  '90days': ['90', 'ninety', 'quarter', '3 months', 'three months', 'days'],
};

/** "Next month (Dec 2026)" also matches "dec", "december" and "2026". */
function keywordsFor(option: { id: ForecastHorizon; label: string }) {
  const words = [...SEARCH_WORDS[option.id]];
  const month = /\(([A-Za-z]{3,})\.? (\d{4})\)/.exec(option.label);
  if (month) {
    const date = new Date(`${month[1]} 1, ${month[2]}`);
    if (!Number.isNaN(date.getTime())) words.push(date.toLocaleDateString('en-US', { month: 'long' }), month[1], month[2]);
  }
  return words;
}

/**
 * Forecast period picker with a search box: type to filter the periods, then use the arrow
 * keys and Enter (or click). Radix Popover handles focus return and closing on outside click.
 */
export default function PeriodPicker({ value, options, onChange, disabled = false, fullWidth = false }: {
  value: ForecastHorizon;
  options: { id: ForecastHorizon; label: string }[];
  onChange: (value: ForecastHorizon) => void;
  disabled?: boolean;
  /** Stretch to the container (used on the start card). */
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = options.find((option) => option.id === value) ?? options[0];
  const close = () => { setOpen(false); setQuery(''); };

  // The field itself is the search box: click it and type to filter the periods below.
  return <Command label="Search forecast periods" loop shouldFilter={open}
    onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { event.preventDefault(); close(); }
      else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) setOpen(true);
    }}
    className={fullWidth ? 'w-full' : 'inline-block'}>
    <Popover.Root open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <Popover.Anchor asChild>
        <div ref={anchorRef} data-state={open ? 'open' : 'closed'} data-disabled={disabled || undefined}
          onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
          className={`group flex h-10 cursor-text items-center gap-2 ${fullWidth ? 'w-full' : 'w-64'} rounded-xl border border-slate-200 bg-white pl-3 pr-2.5 text-sm font-semibold text-[#0b0f4a] shadow-sm focus-within:ring-2 focus-within:ring-[#1a1f6e]/30 data-[disabled]:cursor-wait data-[disabled]:opacity-60 data-[state=open]:border-[#1a1f6e]/40 data-[state=open]:ring-2 data-[state=open]:ring-[#1a1f6e]/10`}>
          {open
            ? <Search size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
            : <CalendarDays size={16} className="shrink-0 text-[#d4a72c]" aria-hidden="true" />}
          <Command.Input
            ref={inputRef}
            disabled={disabled}
            value={open ? query : current?.label ?? ''}
            onValueChange={(next) => { setQuery(next); if (!open) setOpen(true); }}
            onFocus={() => { if (!disabled) setOpen(true); }}
            placeholder={current?.label ?? 'Search periods'}
            aria-label={`Forecast period: ${current?.label ?? ''}. Type to search periods.`}
            className="h-full min-w-0 flex-1 bg-transparent font-semibold text-[#0b0f4a] outline-none placeholder:font-normal placeholder:text-slate-500 disabled:cursor-wait"
          />
          <button type="button" tabIndex={-1} disabled={disabled} aria-label={open ? 'Close forecast periods' : 'Open forecast periods'}
            onClick={(event) => { event.stopPropagation(); if (open) close(); else { setOpen(true); inputRef.current?.focus(); } }}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600">
            <ChevronDown size={16} className="transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
          </button>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => { if (anchorRef.current?.contains(event.target as Node)) event.preventDefault(); }}
          className="z-50 w-[max(var(--radix-popper-anchor-width),16rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.25)] [color-scheme:light] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="px-1.5 pb-1.5 pt-2">
            <p className="px-2.5 pb-1.5 text-sm font-bold uppercase text-black">Forecast period</p>
            {/* Fixed height (room for every period) so the menu does not jump or flip sides while filtering. */}
            <Command.List label="Forecast periods" className="max-h-64 overflow-y-auto" style={{ minHeight: `${options.length * 2.25}rem` }}>
              <Command.Empty className="px-2.5 py-3 text-sm text-slate-600">No period matches “{query}”.</Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.id}
                  value={option.label}
                  keywords={keywordsFor(option)}
                  onSelect={() => { onChange(option.id); close(); inputRef.current?.blur(); }}
                  data-current={option.id === value || undefined}
                  className="flex h-9 cursor-pointer select-none items-center justify-between gap-6 rounded-lg px-2.5 text-sm text-slate-700 outline-none data-[selected=true]:bg-slate-100 data-[current]:bg-[#1a1f6e]/[0.06] data-[current]:font-semibold data-[current]:text-[#0b0f4a]"
                >
                  {option.label}
                  {option.id === value && <Check size={16} className="text-[#1a1f6e]" aria-hidden="true" />}
                </Command.Item>
              ))}
            </Command.List>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </Command>;
}
