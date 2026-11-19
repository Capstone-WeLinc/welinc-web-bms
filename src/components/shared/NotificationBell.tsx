import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, CalendarDays, CalendarX2, ClipboardCheck, ClipboardList, FilePlus2, FileSearch, FileText, IdCard, RotateCcw, Truck, UsersRound, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../lib/api';

type Role = 'Administrator' | 'Customer Service' | 'Operations';
type Notification = {
  id: string;
  role: Role;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  read: boolean;
};
type Candidate = {
  source: string;
  key: string;
  state: string;
  title: string;
  message: string;
  href: string;
  actionable: boolean;
  notifyOnFirstSync?: boolean;
};
type StoredNotifications = { notifications: Notification[]; snapshot: Record<string, string> };
type Feed<T> = { ok: true; data: T } | { ok: false; data: null };

const emptyStored: StoredNotifications = { notifications: [], snapshot: {} };

function readStored(key: string): StoredNotifications {
  try {
    const value = localStorage.getItem(key);
    if (!value) return emptyStored;
    const parsed = JSON.parse(value) as Partial<StoredNotifications>;
    return {
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      snapshot: parsed.snapshot && typeof parsed.snapshot === 'object' ? parsed.snapshot : {},
    };
  } catch {
    return emptyStored;
  }
}

async function getFeed<T>(source: string, url: string, params?: Record<string, unknown>): Promise<{ source: string } & Feed<T>> {
  try {
    const response = await api.get<T>(url, { params });
    return { source, ok: true, data: response.data };
  } catch {
    return { source, ok: false, data: null };
  }
}

function formatStatus(value: unknown) {
  return String(value ?? 'Updated').replace(/([a-z])([A-Z])/g, '$1 $2');
}

async function loadCandidates(role: Role): Promise<{ candidates: Candidate[]; activeSources: string[]; deletedKeys?: string[]; deletedBookingNos?: string[] }> {
  const deletions = getFeed<{ bookingNos?: string[] }>('deleted-bookings', '/integrations/welinc/notifications/deleted');
  if (role === 'Administrator') {
    const [feed, welincBookings, deletedBookings] = await Promise.all([
      getFeed<{ items?: Array<Record<string, unknown>> }>('approvals', '/approvals', { type: 'all', page: 1, limit: 100 }),
      getFeed<Array<Record<string, unknown>>>('welinc-bookings', '/integrations/welinc/notifications'),
      deletions,
    ]);
    const candidates: Candidate[] = [];
    const deletedKeys = welincBookings.ok
      ? (welincBookings.data ?? []).filter((item) => item.deleted === true)
        .map((item) => `${welincBookings.source}:${String(item.id)}`)
      : [];
    if (feed.ok) {
      candidates.push(...(feed.data?.items ?? []).map((item) => {
        const kind = String(item.type ?? 'booking');
        const subtype = item.subtype ? ` ${String(item.subtype)}` : '';
        return {
          source: feed.source,
          key: `${feed.source}:${kind}:${String(item.id)}`,
          state: `${String(item.status ?? 'Pending')}|${String(item.submittedAt ?? '')}|${String(item.summary ?? '')}`,
          title: `${kind[0]?.toUpperCase()}${kind.slice(1)}${subtype} needs review`,
          message: `${String(item.bookingNo ?? 'Booking')} · ${String(item.client ?? 'Client')}${item.summary ? ` — ${String(item.summary)}` : ''}`,
          href: `/admin/approvals?type=${encodeURIComponent(kind)}`,
          actionable: true,
        };
      }));
    }
    if (welincBookings.ok) {
      candidates.push(...(welincBookings.data ?? []).filter((item) => item.deleted !== true).map((item) => ({
        source: welincBookings.source,
        key: `${welincBookings.source}:${String(item.id)}`,
        state: `${String(item.receivedAt ?? '')}|${String(item.bookingNo ?? '')}|${String(item.client ?? '')}`,
        title: 'New booking received from Welinc',
        message: `${String(item.bookingNo ?? 'Booking')} · ${String(item.client ?? 'Client')}`,
        href: '/admin/booking',
        actionable: true,
        notifyOnFirstSync: Number.isFinite(new Date(String(item.receivedAt ?? '')).getTime()) &&
          Date.now() - new Date(String(item.receivedAt)).getTime() <= 24 * 60 * 60 * 1000,
      })));
    }
    return {
      activeSources: [feed, welincBookings, deletedBookings].filter((source) => source.ok).map((source) => source.source),
      candidates,
      deletedKeys,
      deletedBookingNos: deletedBookings.ok ? deletedBookings.data?.bookingNos ?? [] : [],
    };
  }

  if (role === 'Customer Service') {
    const [bookings, submissions, postService, deletedBookings] = await Promise.all([
      getFeed<Array<Record<string, unknown>>>('bookings', '/booking'),
      getFeed<Array<Record<string, unknown>>>('submissions', '/approvals/mine'),
      getFeed<Array<Record<string, unknown>>>('post-service', '/post-service'),
      deletions,
    ]);
    const candidates: Candidate[] = [];
    if (bookings.ok) {
      for (const item of bookings.data ?? []) {
        const status = String(item.status ?? '');
        candidates.push({
          source: bookings.source,
          key: `bookings:${String(item.id ?? item.bookingId)}`,
          state: `${status}|${String(item.updatedAt ?? item.createdAt ?? '')}`,
          title: status === 'For Verification' ? 'Booking needs review' : 'Booking updated',
          message: `${String(item.bookingNo ?? 'Booking')} · ${String(item.client ?? 'Client')} — ${formatStatus(status)}`,
          href: `/cs/bookings${status ? `?status=${encodeURIComponent(status)}` : ''}`,
          actionable: ['For Verification', 'For Plotting'].includes(status),
        });
      }
    }
    if (submissions.ok) {
      for (const item of submissions.data ?? []) {
        const status = String(item.status ?? 'Pending');
        const kind = String(item.type ?? 'submission');
        candidates.push({
          source: submissions.source,
          key: `submissions:${kind}:${String(item.id)}`,
          state: `${status}|${String(item.updatedAt ?? item.submittedAt ?? '')}|${String(item.decisionReason ?? '')}`,
          title: `Your ${kind} submission was updated`,
          message: `${String(item.bookingNo ?? 'Booking')} — ${status}${item.decisionReason ? `: ${String(item.decisionReason)}` : ''}`,
          href: '/cs/my-submissions',
          actionable: status === 'Rejected',
        });
      }
    }
    if (postService.ok) {
      for (const item of postService.data ?? []) {
        const status = String(item.postServiceStatus ?? 'Pending Review');
        candidates.push({
          source: postService.source,
          key: `post-service:${String(item.bookingId ?? item.id)}`,
          state: `${status}|${String(item.arrivalTime ?? '')}|${String(item.completionNotes ?? '')}`,
          title: 'Post-Service details ready to verify',
          message: `${String(item.bookingNo ?? 'Booking')} · ${String(item.client ?? 'Client')}`,
          href: '/cs/post-service',
          actionable: status !== 'Finalized',
        });
      }
    }
    return {
      candidates,
      activeSources: [bookings, submissions, postService, deletedBookings].filter((feed) => feed.ok).map((feed) => feed.source),
      deletedBookingNos: deletedBookings.ok ? deletedBookings.data?.bookingNos ?? [] : [],
    };
  }

  const [schedules, jobOrders, deletedBookings] = await Promise.all([
    getFeed<Array<Record<string, unknown>>>('schedules', '/scheduling'),
    getFeed<Array<Record<string, unknown>>>('job-orders', '/job-order'),
    deletions,
  ]);
  const candidates: Candidate[] = [];
  if (schedules.ok) {
    for (const item of schedules.data ?? []) {
      const status = String(item.status ?? 'Unassigned');
      candidates.push({
        source: schedules.source,
        key: `schedules:${String(item.id ?? item.bookingId)}`,
        state: `${status}|${String(item.updatedAt ?? '')}|${String(item.driverId ?? '')}|${String(Array.isArray(item.helperIds) ? item.helperIds.length : 0)}`,
        title: status === 'Unassigned' ? 'Booking needs team assignment' : 'Schedule updated',
        message: `${String(item.bookingNo ?? 'Booking')} · ${String(item.client ?? 'Client')} — ${formatStatus(status)}`,
        href: '/operations/scheduling',
        actionable: status === 'Unassigned',
      });
    }
  }
  if (jobOrders.ok) {
    for (const item of jobOrders.data ?? []) {
      const status = String(item.status ?? 'Pending');
      candidates.push({
        source: jobOrders.source,
        key: `job-orders:${String(item.id)}`,
        state: `${status}|${String(item.updatedAt ?? item.generated ?? '')}`,
        title: status === 'Pending' ? 'Job order ready to distribute' : 'Job order updated',
        message: `${String(item.jobOrderNo ?? 'Job order')} · ${String(item.bookingNo ?? item.client ?? 'Booking')} — ${formatStatus(status)}`,
        href: '/operations/job-order',
        actionable: status === 'Pending',
      });
    }
  }
  return {
    candidates,
    activeSources: [schedules, jobOrders, deletedBookings].filter((feed) => feed.ok).map((feed) => feed.source),
    deletedBookingNos: deletedBookings.ok ? deletedBookings.data?.bookingNos ?? [] : [],
  };
}

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

/** Picks an icon and colour that match what the notification is about. */
function notificationStyle(title: string) {
  const value = title.toLowerCase();
  const kind = NOTIFICATION_KINDS.find(entry => entry.match.some(word => value.includes(word)));
  return { icon: kind?.icon ?? Bell, ...NOTIFICATION_TONES[kind?.tone ?? 'slate'] };
}

const COLLAPSED_COUNT = 5;

export default function NotificationBell() {
  const { user } = useApp();
  const navigate = useNavigate();
  const role = user?.role as Role | undefined;
  // Keep both the account and role in the key so alerts and unread state never
  // carry over when a browser session switches between staff roles.
  const storageKey = `welinc_notifications_v1_${user?.id ?? 'guest'}_${role ?? 'unknown'}`;
  const initialStored = useMemo(() => readStored(storageKey), [storageKey]);
  const [notifications, setNotifications] = useState<Notification[]>(initialStored.notifications);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<Notification[]>(initialStored.notifications);
  const snapshotRef = useRef<Record<string, string>>(initialStored.snapshot);
  const initializedRef = useRef(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!role || inFlightRef.current || document.visibilityState !== 'visible') return;
    inFlightRef.current = true;
    try {
      const { candidates, activeSources, deletedKeys = [], deletedBookingNos = [] } = await loadCandidates(role);
      if (activeSources.length === 0) return;

      const previousSnapshot = snapshotRef.current;
      const hasWelincBaseline = previousSnapshot['welinc-bookings:__baseline__'] === 'ready';
      const activeSourceSet = new Set(activeSources);
      const nextSnapshot = Object.fromEntries(
        Object.entries(previousSnapshot).filter(([key]) => !activeSourceSet.has(key.split(':', 1)[0])),
      );
      const additions: Notification[] = [];
      const now = new Date().toISOString();
      for (const candidate of candidates) {
        const previous = previousSnapshot[candidate.key];
        const isNewCandidate = previous === undefined;
        const missedRecentWelinc = candidate.source === 'welinc-bookings' &&
          candidate.notifyOnFirstSync === true &&
          !notificationsRef.current.some((item) => item.id.startsWith(`${candidate.key}:`));
        const shouldNotify = isNewCandidate
          ? candidate.actionable && (candidate.source !== 'welinc-bookings' || hasWelincBaseline || candidate.notifyOnFirstSync)
          : previous !== candidate.state || missedRecentWelinc;
        if (shouldNotify) {
          additions.push({
            id: `${candidate.key}:${Date.now()}:${additions.length}`,
            role,
            title: previous === undefined || missedRecentWelinc ? candidate.title : 'Activity updated',
            message: candidate.message,
            href: candidate.href,
            createdAt: now,
            read: false,
          });
        }
        nextSnapshot[candidate.key] = candidate.state;
      }
      if (activeSourceSet.has('welinc-bookings')) nextSnapshot['welinc-bookings:__baseline__'] = 'ready';

      snapshotRef.current = nextSnapshot;
      setUpdatedAt(Date.now());
      const deletedKeySet = new Set(deletedKeys);
      const deletedBookingNoSet = new Set(deletedBookingNos);
      const current = notificationsRef.current.filter((item) => {
        for (const key of deletedKeySet) if (item.id.startsWith(`${key}:`)) return false;
        for (const bookingNo of deletedBookingNoSet) if (item.message.includes(bookingNo)) return false;
        return true;
      });
      const existingIds = new Set(current.map((item) => item.id));
      const fresh = additions.filter((item) => !existingIds.has(item.id));
      const next = [...fresh, ...current].slice(0, 40);
      notificationsRef.current = next;
      setNotifications(next);
      try { localStorage.setItem(storageKey, JSON.stringify({ notifications: next, snapshot: nextSnapshot })); } catch { /* Notifications still work for this session. */ }
      if ((initializedRef.current || fresh.some((item) => item.title === 'New booking received from Welinc')) && fresh.length > 0) {
        toast.info(fresh.length === 1 ? fresh[0].title : `${fresh.length} new updates`, {
          description: fresh[0].message,
        });
      }
      initializedRef.current = true;
    } finally {
      inFlightRef.current = false;
    }
  }, [role, storageKey]);

  useEffect(() => {
    const stored = readStored(storageKey);
    setNotifications(stored.notifications);
    notificationsRef.current = stored.notifications;
    snapshotRef.current = stored.snapshot;
    initializedRef.current = false;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh, storageKey]);

  // The panel opens beside the sidebar and follows its edge as it expands or collapses.
  const [panelLeft, setPanelLeft] = useState(92);
  useEffect(() => {
    if (!open) return;
    const sidebar = containerRef.current?.closest('[data-sidebar]');
    if (!sidebar) return;
    const place = () => setPanelLeft(sidebar.getBoundingClientRect().right + 12);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(sidebar);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  // Also filter at render time so any legacy or malformed shared storage
  // cannot expose another role's notifications during a role switch.
  const roleNotifications = notifications.filter((item) => item.role === role);
  const unreadCount = roleNotifications.filter((item) => !item.read).length;
  const visibleNotifications = expanded ? roleNotifications : roleNotifications.slice(0, COLLAPSED_COUNT);
  const markAllRead = () => {
    const next = notificationsRef.current.map((item) => ({ ...item, read: true }));
    notificationsRef.current = next;
    setNotifications(next);
    try { localStorage.setItem(storageKey, JSON.stringify({ notifications: next, snapshot: snapshotRef.current })); } catch { /* Ignore storage failures. */ }
  };
  const openNotification = (item: Notification) => {
    const next = notificationsRef.current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry);
    notificationsRef.current = next;
    setNotifications(next);
    try { localStorage.setItem(storageKey, JSON.stringify({ notifications: next, snapshot: snapshotRef.current })); } catch { /* Ignore storage failures. */ }
    setOpen(false);
    navigate(item.href);
  };

  return (
    // Lives in the sidebar above the profile. The panel is `fixed`, so the sidebar's
    // overflow does not clip it, and hovering it keeps the sidebar expanded.
    <div className="relative mb-1" ref={containerRef}>
      <button
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={() => { if (!open) void refresh(); setOpen((current) => !current); }}
        className={`flex h-11 w-full items-center justify-center rounded-xl px-2 text-left text-sm transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a72c]/60 group-hover:justify-start group-hover:gap-3 ${open ? 'bg-white/10 text-white' : 'text-[#a8b4d9]'}`}
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && <span className="absolute right-0.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4a72c] px-1 text-[10px] font-bold leading-none text-[#0a0f3c]">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </span>
        <span className="hidden whitespace-nowrap group-hover:block">Notifications</span>
      </button>

      {open && <section
        role="dialog"
        aria-label="Notifications"
        className="fixed bottom-3 z-[80] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left text-slate-900 shadow-lg"
        style={{
          left: panelLeft,
          boxSizing: 'border-box',
          // A fixed, standard notification-panel size, so it never grows to the screen height or shrinks to its content.
          width: `min(360px, calc(100vw - ${panelLeft + 12}px))`,
          height: 'min(440px, calc(100vh - 24px))',
        }}
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
          {roleNotifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1f6e]/5 text-[#1a1f6e]/50"><Bell className="h-6 w-6" aria-hidden="true" /></span>
              <p className="text-sm font-semibold text-slate-800">You’re all caught up</p>
              <p className="mt-1 text-xs text-slate-500">New tasks and updates will appear here.</p>
            </div>
          ) : (
            <ul>
              {visibleNotifications.map((item) => {
                const style = notificationStyle(item.title);
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
        {roleNotifications.length > COLLAPSED_COUNT && <footer className="flex h-11 shrink-0 items-center justify-center border-t border-slate-100 bg-white px-4"><button type="button" onClick={() => setExpanded(value => !value)} className="rounded-md px-2 py-1 text-sm font-semibold text-[#1a1f6e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">{expanded ? 'Show fewer' : `View all ${roleNotifications.length} notifications`}</button></footer>}
      </section>}
    </div>
  );
}
