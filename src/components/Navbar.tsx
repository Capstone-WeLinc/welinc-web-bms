import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { getNavItems, getRoleProfile } from '../lib/auth';
import type { NavEntry } from '../lib/auth';
import NotificationBell from './shared/NotificationBell';

type Crumb = { group: string; label: string };

// The group is the sidebar section that holds the page; pages outside a section fall back to "BMS".
function breadcrumbForPath(pathname: string, entries: NavEntry[], profilePath: string): Crumb {
  if (pathname === profilePath) return { group: 'Account', label: 'Profile' };

  for (const entry of entries) {
    if ('type' in entry && entry.type === 'section') {
      const item = entry.items.find((child) => child.path === pathname);
      if (item) return { group: entry.label, label: item.label };
    } else if ('path' in entry && entry.path === pathname) {
      return { group: 'BMS', label: entry.label };
    }
  }

  const segment = pathname.split('/').filter(Boolean).pop() ?? 'dashboard';
  const label = segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return { group: 'BMS', label: label || 'Dashboard' };
}

export default function Navbar() {
  const { pathname } = useLocation();
  const { user } = useApp();
  const role = user?.role ?? null;
  const entries = useMemo(() => getNavItems(role), [role]);
  const { group, label } = breadcrumbForPath(pathname, entries, role ? getRoleProfile(role) : '');

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900">
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="text-slate-500 dark:text-slate-400">{group}</li>
          <li aria-hidden="true" className="text-slate-500 dark:text-slate-400">
            <ChevronRight className="size-4" />
          </li>
          <li aria-current="page" className="truncate font-medium text-slate-900 dark:text-slate-100">
            {label}
          </li>
        </ol>
      </nav>

      <NotificationBell />
    </header>
  );
}
