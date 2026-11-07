import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Eye, Pencil } from 'lucide-react';
import type { ScheduleEntry } from '../../lib/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_ENTRIES_IN_CELL = 2;

const pad2 = (value: number) => String(value).padStart(2, '0');
const localDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export function toDateKey(value: string | null | undefined) {
  if (!value) return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : localDateKey(parsed);
}

export function formatScheduleAddress(value: string) {
  const seen = new Set<string>();
  return value.split(',').map(part => part.trim()).filter(part => {
    const key = part.toLocaleLowerCase()
      .replace(/\b(?:barangay|brgy\.?)[\s-]*/g, '')
      .replace(/\s+city\b/g, '')
      .replace(/[.\s]+/g, ' ')
      .trim();
    const repeatsPreviousAddressPart = key.length >= 3 && [...seen].some(previous => previous.endsWith(` ${key}`));
    if (!part || seen.has(key) || repeatsPreviousAddressPart) return false;
    seen.add(key);
    return true;
  }).join(', ');
}

// Bookings store times as either "14:00" or "2:00 PM".
export function parseScheduleTime(value?: string) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(value?.trim() ?? '');
  if (!match) return null;
  const period = match[3]?.toUpperCase();
  const hour = Number(match[1]);
  const hour24 = period ? (hour % 12) + (period === 'PM' ? 12 : 0) : hour;
  return { minutes: hour24 * 60 + Number(match[2]), label: `${hour24 % 12 || 12}:${match[2]} ${hour24 >= 12 ? 'PM' : 'AM'}` };
}

const pickupValue = (entry: ScheduleEntry) => entry.pickupTime || entry.time;
const pickupLabel = (entry: ScheduleEntry) => parseScheduleTime(pickupValue(entry))?.label ?? (pickupValue(entry) || 'No time set');
const pluralBookings = (count: number) => `${count} ${count === 1 ? 'booking' : 'bookings'}`;

/** True when a booking's service date is already behind us (Manila calendar). */
export function isPastScheduleDate(date: string | null | undefined) {
  const key = toDateKey(date);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return Boolean(key) && key < today;
}

const MANILA_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** The current Manila date ("2026-11-07") and minutes since midnight. */
export function manilaNow(date = new Date()) {
  const parts = Object.fromEntries(MANILA_CLOCK.formatToParts(date).map(part => [part.type, part.value]));
  return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * True when a booking's service date is behind us, or it is today and its pickup time has already passed (Manila).
 * A booking with no readable time only counts as past once its date has gone by.
 */
export function isPastScheduleTime(date: string | null | undefined, time?: string | null) {
  const key = toDateKey(date);
  if (!key) return false;
  const now = manilaNow();
  if (key !== now.dateKey) return key < now.dateKey;
  const pickup = parseScheduleTime(time ?? undefined);
  return pickup !== null && pickup.minutes < now.minutes;
}

/**
 * An unassigned booking whose date, or today's pickup time, has passed shows as "Needs reschedule",
 * since it can't be assigned until CS moves it.
 */
export function ScheduleStatusBadge({ status, date, time }: { status: ScheduleEntry['status']; date?: string; time?: string }) {
  const isAssigned = status === 'Assigned';
  const needsReschedule = status === 'Unassigned' && isPastScheduleTime(date, time);
  const tone = isAssigned ? 'border-emerald-400 bg-emerald-50 text-emerald-600'
    : needsReschedule ? 'border-red-300 bg-red-50 text-red-600'
      : 'border-amber-400 bg-amber-50 text-amber-600';
  return (
    <span
      title={needsReschedule ? 'The service date has passed. Customer Service needs to reschedule this booking before it can be assigned.' : undefined}
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${tone}`}
    >
      {needsReschedule ? 'Needs reschedule' : status}
    </span>
  );
}

export function DeliveryTypeBadge({ type }: { type: 'Inhouse' | 'Subcon' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${type === 'Inhouse' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-blue-400 bg-blue-50 text-blue-600'}`}>
      {type === 'Inhouse' ? 'IN HOUSE' : 'SUBCON'}
    </span>
  );
}

export type ScheduleCrew = { truck: string; truckMissing: boolean; driver: string; helpers: string; garage: string };

type Props = {
  schedules: ScheduleEntry[];
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  canAssign: boolean;
  getCrew: (entry: ScheduleEntry) => ScheduleCrew;
  onView: (entry: ScheduleEntry) => void;
  onAssign: (entry: ScheduleEntry) => void;
};

const iconButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30';
const outlineButtonClass = 'inline-flex h-9 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30';

function DetailRow({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'muted' | 'alert' }) {
  const valueClass = tone === 'muted' ? 'text-slate-400' : tone === 'alert' ? 'font-medium text-red-700' : 'font-medium text-slate-900';
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`break-words ${valueClass}`}>{value}</dd>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">{title}</h4>
      {children}
    </div>
  );
}

const readableService = (value: string) => (value === value.toUpperCase() ? value.charAt(0) + value.slice(1).toLowerCase() : value);

/** Month overview with a readable agenda for the selected day. Shared by Admin and Operations. */
export default function ScheduleCalendar({ schedules, year, month, onMonthChange, canAssign, getCrew, onView, onAssign }: Props) {
  const today = localDateKey(new Date());
  const monthPrefix = `${year}-${pad2(month + 1)}`;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // undefined means the person hasn't chosen yet, so a day's only booking opens by itself.
  const [openEntryId, setOpenEntryId] = useState<string | null | undefined>(undefined);

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleEntry[]>();
    schedules.forEach(entry => {
      const key = toDateKey(entry.date);
      if (key.startsWith(monthPrefix)) grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    });
    grouped.forEach(entries => entries.sort((a, b) => (parseScheduleTime(pickupValue(a))?.minutes ?? Infinity) - (parseScheduleTime(pickupValue(b))?.minutes ?? Infinity)));
    return grouped;
  }, [schedules, monthPrefix]);

  const monthEntries = useMemo(() => [...entriesByDate.values()].flat(), [entriesByDate]);
  const assignedCount = monthEntries.filter(entry => entry.status === 'Assigned').length;
  const unassignedCount = monthEntries.length - assignedCount;

  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const firstBusyDate = [...entriesByDate.keys()].sort()[0];
  const activeDate = selectedDate?.startsWith(monthPrefix) ? selectedDate
    : today.startsWith(monthPrefix) ? today
    : firstBusyDate ?? `${monthPrefix}-01`;
  const activeEntries = entriesByDate.get(activeDate) ?? [];
  const [activeYear, activeMonth, activeDay] = activeDate.split('-').map(Number);
  const activeHeading = new Date(activeYear, activeMonth - 1, activeDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const selectDay = (dateKey: string) => {
    if (dateKey !== activeDate) setOpenEntryId(undefined);
    setSelectedDate(dateKey);
  };
  const shiftMonth = (delta: number) => {
    const target = new Date(year, month + delta, 1);
    setOpenEntryId(undefined);
    onMonthChange(target.getFullYear(), target.getMonth());
  };
  const goToToday = () => {
    const now = new Date();
    setOpenEntryId(undefined);
    onMonthChange(now.getFullYear(), now.getMonth());
    setSelectedDate(today);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[#1a1f6e]">{MONTHS[month]} {year}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{assignedCount} assigned</span>
            <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-500" />{unassignedCount} unassigned</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToToday} className={outlineButtonClass}>Today</button>
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className={iconButtonClass}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className={iconButtonClass}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <div className="min-w-0 px-4 pb-4">
        <div className="overflow-hidden border border-slate-200">
          <div className="grid grid-cols-7 bg-[#1a1f6e]">
            {WEEKDAYS.map(day => <div key={day} className="px-1 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-white">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {cells.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} className="min-h-[60px] bg-slate-50 sm:min-h-[132px]" />;
              const dateKey = `${monthPrefix}-${pad2(day)}`;
              const entries = entriesByDate.get(dateKey) ?? [];
              const hiddenCount = entries.length - MAX_ENTRIES_IN_CELL;
              const needsAssignment = entries.some(entry => entry.status === 'Unassigned');
              const isToday = dateKey === today;
              const isActive = dateKey === activeDate;
              return (
                <div key={dateKey} onClick={() => selectDay(dateKey)} className={`min-h-[60px] min-w-0 cursor-pointer p-1 transition-colors sm:min-h-[132px] sm:p-1.5 ${isActive ? 'bg-[#f5f6fd] shadow-[inset_0_0_0_2px_#1a1f6e]' : 'bg-white hover:bg-slate-50'}`}>
                  <div className="flex flex-col items-center gap-0.5 sm:flex-row sm:justify-between sm:gap-1">
                    <button
                      type="button"
                      aria-pressed={isActive}
                      aria-label={`${MONTHS[month]} ${day}, ${pluralBookings(entries.length)}`}
                      onClick={() => selectDay(dateKey)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 ${isToday ? 'bg-[#1a1f6e] text-white' : 'text-slate-800'}`}
                    >
                      {day}
                    </button>
                    {entries.length > 0 && (
                      <span className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${needsAssignment ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{entries.length}</span>
                    )}
                  </div>
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {entries.slice(0, MAX_ENTRIES_IN_CELL).map(entry => (
                      <button
                        key={entry.id}
                        type="button"
                        title={`${pickupLabel(entry)} - ${entry.client} (${entry.status})`}
                        aria-label={`${pickupLabel(entry)}, ${entry.client}, ${entry.status}`}
                        onClick={event => { event.stopPropagation(); setSelectedDate(dateKey); setOpenEntryId(entry.id); }}
                        className={`block w-full min-w-0 rounded-md border-l-[3px] px-1.5 py-1 text-left transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 ${entry.status === 'Assigned' ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50'}`}
                      >
                        <span className="block truncate text-xs font-semibold tabular-nums text-slate-900">{pickupLabel(entry)}</span>
                        <span className="block truncate text-xs text-slate-700">{entry.client}</span>
                      </button>
                    ))}
                    {hiddenCount > 0 && (
                      <button type="button" onClick={event => { event.stopPropagation(); selectDay(dateKey); }} className="w-full rounded px-1.5 py-0.5 text-left text-xs font-medium text-[#1a1f6e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40">
                        +{hiddenCount} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section aria-live="polite" className="space-y-3 border-t border-slate-200 bg-[#f1f4fa] p-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:rounded-l-xl xl:border-l xl:border-t-0">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">
          <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />
          {activeHeading}
          <span className="ml-2 font-normal normal-case tracking-normal text-slate-600">{pluralBookings(activeEntries.length)}</span>
        </h3>

        {activeEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/70 bg-white px-4 py-10 text-center shadow-sm">
            <CalendarDays size={22} aria-hidden="true" className="mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">No bookings on this day.</p>
          </div>
        ) : activeEntries.map(entry => {
          const isOpen = openEntryId === undefined ? activeEntries.length === 1 : openEntryId === entry.id;
          const crew = getCrew(entry);
          const dispatch = parseScheduleTime(entry.dispatchTime)?.label ?? entry.dispatchTime;
          const noCrewYet = crew.truck === 'Not assigned' && crew.driver === 'Not assigned' && crew.helpers === 'Not assigned' && crew.garage === 'Not assigned';
          return (
            <article key={entry.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isOpen ? 'border-[#1a1f6e]/40' : 'border-slate-200/70'}`}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenEntryId(isOpen ? null : entry.id)}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1a1f6e]/30"
              >
                <span className="w-[76px] shrink-0 text-[15px] font-semibold tabular-nums text-[#1a1f6e]">{pickupLabel(entry)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-medium text-slate-900">{entry.client}</span>
                  <span className="mt-1.5 block"><ScheduleStatusBadge status={entry.status} date={entry.date} time={pickupValue(entry)} /></span>
                </span>
                <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="space-y-5 border-t border-slate-200/70 p-4">
                  <DetailGroup title="Job details">
                    <dl className="space-y-1.5">
                      <DetailRow label="Booking no." value={entry.bookingNo ?? '-'} />
                      {entry.service && <DetailRow label="Service" value={readableService(entry.service)} />}
                      {dispatch && <DetailRow label="Dispatch" value={dispatch} />}
                      {entry.deliveryType && <DetailRow label="Delivery" value={entry.deliveryType === 'Inhouse' ? 'In house' : 'Subcon'} />}
                      {entry.permitRequired && <DetailRow label="Permit" value="Required" tone="alert" />}
                    </dl>
                  </DetailGroup>

                  <DetailGroup title="Route">
                    <div className="flex min-w-0 gap-3">
                      <div aria-hidden="true" className="flex w-3 shrink-0 flex-col items-center py-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#1a1f6e]" />
                        <span className="my-1 min-h-6 flex-1 border-l-2 border-dashed border-slate-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#e8b800]" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div><p className="text-sm text-slate-600">Pickup</p><p className="break-words text-sm font-medium leading-relaxed text-slate-900">{formatScheduleAddress(entry.origin)}</p></div>
                        <div><p className="text-sm text-slate-600">Drop-off</p><p className="break-words text-sm font-medium leading-relaxed text-slate-900">{formatScheduleAddress(entry.destination)}</p></div>
                      </div>
                    </div>
                  </DetailGroup>

                  <DetailGroup title="Truck and team">
                    {noCrewYet ? (
                      <p className="text-sm text-slate-600">No truck or team assigned yet.</p>
                    ) : (
                      <dl className="space-y-1.5">
                        <DetailRow label="Truck" value={crew.truck} tone={crew.truckMissing ? 'muted' : 'default'} />
                        <DetailRow label="Driver" value={crew.driver} tone={crew.driver === 'Not assigned' ? 'muted' : 'default'} />
                        <DetailRow label="Helpers" value={crew.helpers} tone={crew.helpers === 'Not assigned' ? 'muted' : 'default'} />
                        <DetailRow label="Garage" value={crew.garage} tone={crew.garage === 'Not assigned' ? 'muted' : 'default'} />
                      </dl>
                    )}
                  </DetailGroup>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canAssign && entry.status === 'Unassigned' ? (
                      <button type="button" onClick={() => onAssign(entry)} className="inline-flex h-10 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#030848] px-5 text-sm font-medium text-white hover:bg-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 focus-visible:ring-offset-2"><ClipboardList size={15} aria-hidden="true" />Assign</button>
                    ) : (
                      <button type="button" onClick={() => onView(entry)} className={outlineButtonClass}><Eye size={15} aria-hidden="true" />View</button>
                    )}
                    {canAssign && entry.status === 'Assigned' && (
                      <button type="button" onClick={() => onAssign(entry)} className={outlineButtonClass}><Pencil size={15} aria-hidden="true" />Edit</button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
      </div>
    </div>
  );
}
