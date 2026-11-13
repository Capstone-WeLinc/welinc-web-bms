import { ChevronDown, Download, type LucideIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './Dropdown';

type ExportOption = { label: string; icon: LucideIcon; onSelect: () => void };

/**
 * Export button with a format menu. The menu floats above the page (so cards and scrolling
 * areas cannot cover or cut it), closes after a choice or an outside click, and works with the keyboard.
 */
export default function ExportMenu({ options, variant = 'outline' }: {
  options: ExportOption[];
  /** "primary": navy pill (Reports). "outline": white button that sits beside the All Status filter. */
  variant?: 'primary' | 'outline';
}) {
  const trigger = variant === 'primary'
    ? 'flex h-12 items-center gap-2.5 whitespace-nowrap rounded-full bg-[#1a1f6e] px-5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#0b0f4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30'
    : 'inline-flex h-11 w-fit items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30';
  const iconSize = variant === 'primary' ? 18 : 16;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`group shrink-0 ${trigger}`}>
          <Download size={iconSize} aria-hidden="true" /> Export
          <ChevronDown size={iconSize} className="transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_14px_36px_rgba(15,23,42,0.16)]">
        {options.map(({ label, icon: Icon, onSelect }) => (
          <DropdownMenuItem
            key={label}
            onSelect={onSelect}
            className="flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm text-slate-700 focus:bg-[#e0ac22] focus:text-[#172033] data-[highlighted]:bg-[#e0ac22] data-[highlighted]:text-[#172033]"
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
