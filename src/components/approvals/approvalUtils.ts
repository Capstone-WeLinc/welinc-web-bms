import { CalendarClock, CalendarX2, FileCheck2, RotateCcw, Siren, UserRoundMinus, Wallet, type LucideIcon } from 'lucide-react';

export type ItemType = 'booking' | 'collection' | 'refund' | 'crew';
export type ApprovalItem = {
  id: string; type: ItemType; subtype: string | null; bookingId?: string;
  bookingNo: string; client: string; summary: string; amount: number | null;
  submittedAt: string; submittedBy: string; submittedByName?: string; submittedByRole?: string; status: string; decisionReason?: string | null;
  startDate?: string; endDate?: string;
  /** History only. */
  decidedAt?: string; decidedByName?: string;
};
export type AuditEvent = { action: string; actorName?: string; actorRole?: string; reason?: string | null; createdAt: string };

/** Requests waiting longer than this count as overdue (the Overdue card uses the same rule). */
export const DUE_AFTER_MS = 24 * 60 * 60 * 1000;

export const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
export const manilaDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : 'Not available';
export const manilaDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  : 'Not available';

const subtypeLabel = (value: string | null) => ({ reschedule: 'Reschedule', cancel: 'Cancellation' }[value ?? ''] ?? '');
const shortDate = (value: string) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00+08:00`));

/** One short line per row; the full text stays in the side panel (and as a hover tooltip). */
export const shortDetails = (item: ApprovalItem) => {
  if (item.type === 'crew' && item.startDate && item.endDate) {
    const days = Math.round((Date.parse(`${item.endDate}T00:00:00Z`) - Date.parse(`${item.startDate}T00:00:00Z`)) / 86400000) + 1;
    return `${item.startDate === item.endDate ? shortDate(item.startDate) : `${shortDate(item.startDate)} – ${shortDate(item.endDate)}`} · ${days === 1 ? '1 day' : `${days} days`}`;
  }
  if (item.type === 'refund') return item.summary.replace(/^Refund (requested|approved):\s*/i, '');
  if (item.type === 'booking' && item.subtype === 'cancel') return item.summary.replace(/^Cancellation (requested|approved):\s*/i, '') || 'Cancellation';
  return item.summary;
};

export const typeText = (item: ApprovalItem) => item.type === 'booking' ? (subtypeLabel(item.subtype) || 'Booking request')
  : item.type === 'collection' ? 'Collection' : item.type === 'refund' ? 'Refund'
    : item.subtype === 'emergency' ? 'Emergency' : 'Crew leave';

/** Icon and colours for each kind of request, used by the row icon, the type pill and the panel. */
export function requestStyle(item: ApprovalItem): { icon: LucideIcon; tile: string; pill: string } {
  if (item.type === 'booking') {
    return item.subtype === 'cancel'
      ? { icon: CalendarX2, tile: 'bg-orange-50 text-orange-600', pill: 'bg-orange-50 text-orange-700' }
      : item.subtype === 'reschedule'
        ? { icon: CalendarClock, tile: 'bg-indigo-50 text-indigo-600', pill: 'bg-indigo-50 text-indigo-700' }
        : { icon: FileCheck2, tile: 'bg-indigo-50 text-indigo-600', pill: 'bg-indigo-50 text-indigo-700' };
  }
  if (item.type === 'collection') return { icon: Wallet, tile: 'bg-emerald-50 text-emerald-600', pill: 'bg-emerald-50 text-emerald-700' };
  if (item.type === 'refund') return { icon: RotateCcw, tile: 'bg-rose-50 text-rose-600', pill: 'bg-rose-50 text-rose-700' };
  return item.subtype === 'emergency'
    ? { icon: Siren, tile: 'bg-red-50 text-red-600', pill: 'bg-red-50 text-red-700' }
    : { icon: UserRoundMinus, tile: 'bg-purple-50 text-purple-600', pill: 'bg-purple-50 text-purple-700' };
}

/** When a waiting request becomes overdue, and how that reads ("Due in 5h", "Overdue"). */
export function dueInfo(submittedAt: string, now = Date.now()) {
  const dueAt = new Date(new Date(submittedAt).getTime() + DUE_AFTER_MS);
  const left = dueAt.getTime() - now;
  if (left <= 0) return { dueAt, label: 'Overdue', tone: 'text-red-600' };
  const hours = Math.max(1, Math.round(left / 3600000));
  return { dueAt, label: `Due in ${hours}h`, tone: hours <= 6 ? 'text-amber-600' : 'text-slate-500' };
}

export function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?');
}

const AVATAR_TONES = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'];
/** The same person always gets the same colour. */
export function avatarTone(name?: string) {
  let hash = 0;
  for (const char of name ?? '') hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export const canDecideStatus = (status: string) => ['pending', 'requested', 'verifying'].includes(status.toLowerCase());
export const actionTitle = (action: string) => action.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
