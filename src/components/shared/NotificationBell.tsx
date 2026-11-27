import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, CalendarDays, CalendarOff, CalendarX2, Siren, ClipboardCheck, ClipboardList, FilePlus2, FileSearch, FileText, IdCard, RotateCcw, Truck, UsersRound, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../lib/api';

/**
 * The bell (spec bms/0021). The backend writes a notification when something happens and keeps who
 * has read it, so read state follows the person to any browser. This only shows them: it asks
 * GET /notifications every 15 seconds while the tab is visible, and on focus.
 */
type Notification = {
  id: string;
  kind: string;
  title: string;
  message: string;
  href: string | null;
  createdAt: string;
  read: boolean;
};
type NotificationPage = { items: Notification[]; unread: number };

const REFRESH_MS = 15_000;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const NOTIFICATION_TONES = {
  red: { tile: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  indigo: { tile: 'bg-indigo-50 text-indigo-600', dot: 'bg-indigo-500' },
  violet: { tile: 'bg-violet-50 text-violet-600', dot: 'bg-violet-500' },
  emerald: { tile: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
  orange: { tile: 'bg-orange-50 text-orange-600', dot: 'bg-orange-500' },
  sky: { tile: 'bg-sky-50 text-sky-600', dot: 'bg-sky-500' },
  teal: { tile: 'bg-teal-50 text-teal-600', dot: 'bg-teal-500' },
  blue: { tile: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  amber: { tile: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  slate: { tile: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

// Checked in order, so the more specific subjects come first ("Booking cancel needs review" is a cancellation, not a generic review).
const NOTIFICATION_KINDS: { match: string[]; icon: typeof Bell; tone: keyof typeof NOTIFICATION_TONES }[] = [
  { match: ['conflict'], icon: CalendarX2, tone: 'red' },
  { match: ['emergency'], icon: Siren, tone: 'red' },
  { match: ['crew', 'leave'], icon: CalendarOff, tone: 'violet' },
  { match: ['cancel'], icon: CalendarX2, tone: 'red' },
  { match: ['reschedule'], icon: CalendarClock, tone: 'indigo' },
  { match: ['refund'], icon: RotateCcw, tone: 'violet' },
  { match: ['collection', 'payment'], icon: Wallet, tone: 'emerald' },
  { match: ['license'], icon: IdCard, tone: 'orange' },
  { match: ['team assignment', 'driver', 'helper'], icon: UsersRound, tone: 'orange' },
  { match: ['job order'], icon: Truck, tone: 'sky' },
  { match: ['post-service', 'post service'], icon: ClipboardCheck, tone: 'teal' },
  { match: ['submission'], icon: ClipboardList, tone: 'blue' },
  { match: ['schedule'], icon: CalendarDays, tone: 'indigo' },
  { match: ['new booking', 'received', 'created'], icon: FilePlus2, tone: 'blue' },
  { match: ['needs review', 'approval', 'verify'], icon: FileSearch, tone: 'amber' },
  { match: ['booking'], icon: FileText, tone: 'blue' },
];

/** The icon for each kind the backend sends; anything else falls back to the title's words. */
const KIND_STYLES: Record<string, { icon: typeof Bell; tone: keyof typeof NOTIFICATION_TONES }> = {
  'booking.received': { icon: FilePlus2, tone: 'blue' },
  'booking.needs_assignment': { icon: UsersRound, tone: 'orange' },
  'booking.cancelled': { icon: CalendarX2, tone: 'red' },
  'welinc.change_blocked': { icon: FileSearch, tone: 'amber' },
  'joborder.ready': { icon: Truck, tone: 'sky' },
  'crew.conflict': { icon: CalendarX2, tone: 'red' },
  'postservice.ready': { icon: ClipboardCheck, tone: 'teal' },
};

/** Picks an icon and colour that match what the notification is about. */
function notificationStyle(kind: string, title: string) {
  const known = KIND_STYLES[kind];
  if (known) return { icon: known.icon, ...NOTIFICATION_TONES[known.tone] };
  const value = title.toLowerCase();
  const match = NOTIFICATION_KINDS.find(entry => entry.match.some(word => value.includes(word)));
  return { icon: match?.icon ?? Bell, ...NOTIFICATION_TONES[match?.tone ?? 'slate'] };
}


const COLLAPSED_COUNT = 5;

export default function NotificationBell() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  // Ids already shown, so only notifications that arrive while the app is open pop up a toast
  const seenRef = useRef<Set<string> | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || inFlightRef.current || document.visibilityState !== 'visible') return;
    inFlightRef.current = true;
    try {
      const { data } = await api.get<NotificationPage>('/notifications');
      const items = data.items ?? [];
      const seen = seenRef.current;
      const fresh = seen ? items.filter((item) => !item.read && !seen.has(item.id)) : [];
      seenRef.current = new Set([...(seen ?? []), ...items.map((item) => item.id)]);
      setNotifications(items);
      setUnreadCount(data.unread ?? items.filter((item) => !item.read).length);
      setUpdatedAt(Date.now());
      if (fresh.length > 0) {
        toast.info(fresh.length === 1 ? fresh[0].title : `${fresh.length} new updates`, { description: fresh[0].message });
      }
    } catch {
      // Keep what is shown; the next refresh tries again
    } finally {
      inFlightRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    // A different person signed in: start clean
    seenRef.current = null;
    setNotifications([]);
    setUnreadCount(0);
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, REFRESH_MS);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const visibleNotifications = expanded ? notifications : notifications.slice(0, COLLAPSED_COUNT);
  const markAllRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    api.post('/notifications/read-all').catch(() => { void refresh(); });
  };
  const openNotification = (item: Notification) => {
    if (!item.read) {
      setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
      api.post(`/notifications/${encodeURIComponent(item.id)}/read`).catch(() => { void refresh(); });
    }
    setOpen(false);
    if (item.href) navigate(item.href);
  };

  return (
    // Lives at the right end of the top bar; the panel opens centred over the page.
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={() => { if (!open) void refresh(); setOpen((current) => !current); }}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${open ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
        {unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4a72c] px-1 text-[9px] font-bold leading-none text-[#0a0f3c]">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {/* Rendered on <body> and centred, so the sidebar cannot clip it. */}
      {open && createPortal(<div
        role="presentation"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(0,0,0,0.5)] p-4"
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      ><section
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="flex h-[min(440px,calc(100vh-24px))] w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left text-slate-900 shadow-lg"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1a1f6e] text-[#e8b800]"><Bell className="h-4 w-4" /></span>
            <h2 className="text-[15px] font-semibold text-[#0b0f4a]">Notifications</h2>
            {unreadCount > 0 && <span className="rounded-full bg-[#1a1f6e]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1a1f6e]">{unreadCount} new</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 && <button type="button" onClick={markAllRead} className="whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-semibold text-[#1a1f6e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">Mark all read</button>}
            <span className="sr-only" aria-live="polite">Updated {formatTime(new Date(updatedAt).toISOString())}</span>          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc]">
          {notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1f6e]/5 text-[#1a1f6e]/50"><Bell className="h-6 w-6" aria-hidden="true" /></span>
              <p className="text-sm font-semibold text-slate-800">You’re all caught up</p>
              <p className="mt-1 text-xs text-slate-500">New tasks and updates will appear here.</p>
            </div>
          ) : (
            <ul>
              {visibleNotifications.map((item) => {
                const style = notificationStyle(item.kind, item.title);
                const Icon = style.icon;
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => openNotification(item)} aria-label={`${item.read ? '' : 'Unread: '}${item.title}`} className="flex w-full items-start gap-3 bg-[#f8fafc] px-4 py-3 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1a1f6e]/30">
                      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tile}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-800">{item.title}</span>
                          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />{formatTime(item.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 block break-words text-sm leading-relaxed text-slate-500">{item.message}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {notifications.length > COLLAPSED_COUNT && <footer className="flex h-11 shrink-0 items-center justify-center border-t border-slate-100 bg-white px-4"><button type="button" onClick={() => setExpanded(value => !value)} className="rounded-md px-2 py-1 text-sm font-semibold text-[#1a1f6e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">{expanded ? 'Show fewer' : `View all ${notifications.length} notifications`}</button></footer>}
      </section></div>, document.body)}
    </div>
  );
}
