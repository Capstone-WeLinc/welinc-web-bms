import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays } from 'lucide-react';
import { DayPicker, type Matcher } from 'react-day-picker';

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  onBlur?: () => void;
  placement?: 'top' | 'bottom';
  inlineAbove?: boolean;
  popover?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  required?: boolean;
  showIcon?: boolean;
}

const fromIso = (value: string) => value ? new Date(`${value}T00:00:00`) : undefined;
const toIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function DatePicker({ id, value, onChange, min, max, placeholder = 'Select date', className = '', invalid = false, onBlur, placement = 'bottom', inlineAbove = false, popover = false, ariaLabelledBy, ariaDescribedBy, required, showIcon = true }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const selected = fromIso(value);
  const minDate = fromIso(min ?? '');
  const maxDate = fromIso(max ?? '');
  const disabledDates: Matcher[] = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];
  const [month, setMonth] = useState(selected ?? minDate ?? new Date());

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!popover && open && !rootRef.current?.contains(target) && !calendarRef.current?.contains(target)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open, onBlur, popover]);

  useEffect(() => {
    if (!open || inlineAbove || popover || !buttonRef.current) return;
    const updatePosition = () => {
      const bounds = buttonRef.current?.getBoundingClientRect();
      const calendarBounds = calendarRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const viewportPadding = 8;
      const calendarHeight = calendarBounds?.height ?? 0;
      const calendarWidth = calendarBounds?.width ?? 0;
      const preferredTop = placement === 'top' ? bounds.top - viewportPadding : bounds.bottom + viewportPadding;
      const top = placement === 'top'
        ? Math.max(preferredTop, calendarHeight + viewportPadding)
        : Math.min(preferredTop, window.innerHeight - calendarHeight - viewportPadding);
      const left = Math.min(
        Math.max(bounds.left, viewportPadding),
        Math.max(viewportPadding, window.innerWidth - calendarWidth - viewportPadding),
      );

      setPosition({ top, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, placement, inlineAbove, popover]);

  useEffect(() => {
    if (open) setMonth(selected ?? minDate ?? new Date());
  }, [open, value, min]);

  const calendar = (
    <div
      ref={calendarRef}
      data-datepicker-portal={!inlineAbove || undefined}
      style={inlineAbove || popover ? undefined : { position: 'fixed', top: position.top, left: position.left, transform: placement === 'top' ? 'translateY(-100%)' : undefined, pointerEvents: 'auto' }}
      className={`date-picker-calendar z-[100] w-[278px] shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900 ${inlineAbove ? 'mb-2 w-fit max-w-full' : ''}`}
    >
      <DayPicker
        mode="single"
        selected={selected}
        month={month}
        onMonthChange={setMonth}
        onSelect={(date) => { if (date) { onChange(toIso(date)); setOpen(false); } }}
        disabled={disabledDates}
        defaultMonth={selected ?? minDate}
        startMonth={minDate}
        endMonth={maxDate}
        showOutsideDays
        classNames={{
          root: 'relative text-sm', months: 'flex', month: 'space-y-2', month_caption: 'flex h-9 items-center justify-center font-semibold text-slate-800 dark:text-white',
          nav: 'absolute inset-x-0 top-0 flex justify-between', button_previous: 'rounded-md p-1 text-slate-500 hover:bg-slate-100', button_next: 'rounded-md p-1 text-slate-500 hover:bg-slate-100',
          weekdays: 'flex', weekday: '!bg-transparent !text-[#1a1f6e] w-9 text-center text-xs font-medium', week: 'mt-1 flex w-full', day: 'h-9 w-9 p-0 text-center',
          day_button: 'h-9 w-9 rounded-md text-sm text-slate-700 hover:bg-[#1a1f6e]/10 dark:text-gray-200', selected: '[&>button]:bg-[#1a1f6e] [&>button]:text-white hover:[&>button]:bg-[#151b4f]',
          today: '[&>button]:border [&>button]:border-[#d4a72c]', outside: 'opacity-40', disabled: 'opacity-30',
        }}
      />
    </div>
  );

  const trigger = (
      <button
        id={id}
        ref={buttonRef}
        type="button"
        onClick={popover ? undefined : () => setOpen(current => !current)}
        className={`flex h-11 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm transition-colors dark:bg-gray-900 ${
          invalid ? 'border-red-500 bg-red-50/30 text-red-700 focus:ring-red-500/20' : 'border-slate-200 text-slate-700 hover:border-slate-300 focus:ring-[#1a1f6e]/20 dark:border-gray-700 dark:text-gray-100'
        } focus:outline-none focus:ring-2`}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid}
        aria-required={required}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {showIcon && <CalendarDays size={16} className={invalid ? 'text-red-500' : 'text-[#1a1f6e]'} />}
        <span className={value ? '' : 'text-slate-400'}>{selected ? selected.toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }) : placeholder}</span>
      </button>
  );

  if (popover) return (
    <div ref={rootRef} className={className}>
      <Popover.Root open={open} onOpenChange={next => { setOpen(next); if (!next) onBlur?.(); }}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content asChild side={placement === 'top' ? 'top' : 'bottom'} align="start" sideOffset={8} collisionPadding={12} onOpenAutoFocus={event => event.preventDefault()}>
            {calendar}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {open && inlineAbove && calendar}
      {trigger}
      {open && !inlineAbove && createPortal(calendar, document.body)}
    </div>
  );
}

export default DatePicker;
