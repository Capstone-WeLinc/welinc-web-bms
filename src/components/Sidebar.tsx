import { useAuthStore } from '../store/authStore';
import { canSwitchSystem, switchSystemUrl } from '../lib/session/switchSystem';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, LayoutGrid, LogOut } from 'lucide-react';
import { getNavItems, getRoleProfile } from '../lib/auth';
import type { NavItem, NavSection } from '../lib/auth';
import NotificationBell from './shared/NotificationBell';

function isSection(entry: NavItem | NavSection): entry is NavSection {
  return 'type' in entry && entry.type === 'section';
}

const isItemActive = (itemPath: string, pathname: string) =>
  itemPath !== '#' && (pathname === itemPath || pathname.startsWith(itemPath + '/'));

// The sidebar keeps the plain `group` name: NotificationBell reveals its label with `group-hover:`.
const asideClasses =
  'group fixed inset-y-0 left-0 z-40 flex w-20 flex-col overflow-hidden border-r border-[#111a62] bg-[#020849] text-white shadow-[10px_0_32px_rgba(2,8,73,0.28)] transition-[width,box-shadow] duration-300 ease-out hover:w-[280px] hover:shadow-[18px_0_42px_rgba(2,8,73,0.34)]';
const headerClasses =
  'flex h-20 shrink-0 items-center gap-0 border-b border-white/10 px-5 transition-all duration-300 group-hover:gap-3';
const logoFrameClasses =
  'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#f4c400]/80 bg-[#061056] shadow-[0_0_0_1px_rgba(244,196,0,0.15)]';
const labelRevealClasses =
  'max-w-0 min-w-0 translate-x-2 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:max-w-[190px] group-hover:translate-x-0 group-hover:opacity-100';
const navClasses =
  'flex min-h-0 flex-1 flex-col space-y-2.5 overflow-y-auto overflow-x-hidden px-2 py-3 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar]:w-1.5';
// No backdrop-blur here: it would trap the bell's fixed-position popup inside the sidebar.
const footerClasses = 'shrink-0 border-t border-white/10 bg-[#020849] px-3 py-3';
const footerButtonClasses =
  'mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-sm font-semibold transition-all duration-200 group-hover:mx-0 group-hover:w-full group-hover:justify-start group-hover:gap-3 group-hover:px-3.5';

const navLinkClass = (isActive: boolean, indented: boolean) => {
  const base = `mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-left text-sm font-medium tracking-tight transition-all duration-200 group-hover:justify-start group-hover:gap-3 group-hover:px-3 ${
    indented ? 'group-hover:ml-1.5 group-hover:mr-0 group-hover:w-[calc(100%-0.5rem)]' : 'group-hover:mx-0 group-hover:w-full'
  }`;
  return isActive
    ? `${base} bg-[#f4c400] font-bold text-[#030737] shadow-[0_4px_16px_rgba(244,196,0,0.25)]`
    : `${base} text-[#9ba4db] hover:bg-white/10 hover:text-white`;
};

interface NavLinkButtonProps {
  item: NavItem;
  pathname: string;
  indented?: boolean;
  onClick: (path: string) => void;
}

function NavLinkButton({ item, pathname, indented = false, onClick }: NavLinkButtonProps) {
  const isActive = isItemActive(item.path, pathname);
  const ItemIcon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(item.path)}
      aria-label={item.label}
      title={item.label}
      aria-current={isActive ? 'page' : undefined}
      className={navLinkClass(isActive, indented)}
    >
      <ItemIcon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
      <span className={labelRevealClasses}>{item.label}</span>
    </button>
  );
}

interface SidebarGroupProps {
  section: NavSection;
  expanded: boolean;
  pathname: string;
  onToggle: () => void;
  onItemClick: (path: string) => void;
}

function SidebarGroup({ section, expanded, pathname, onToggle, onItemClick }: SidebarGroupProps) {
  const { label, icon: GroupIcon, items } = section;
  const hasActiveChild = items.some((item) => isItemActive(item.path, pathname));
  const highlighted = expanded || hasActiveChild;
  const groupId = `nav-group-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={groupId}
        aria-label={`${label} menu`}
        title={label}
        className={`group/header relative mx-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-left transition-all duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c400]/50 group-hover:mx-0 group-hover:h-auto group-hover:w-full group-hover:justify-between group-hover:px-2.5 group-hover:py-1.5 ${
          highlighted ? 'bg-white/[0.08] text-[#f4c400]' : 'text-[#9ba4db] hover:bg-white/5 hover:text-white'
        }`}
      >
        <span className="flex min-w-0 items-center gap-0 group-hover:gap-2.5">
          <GroupIcon
            aria-hidden="true"
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${highlighted ? 'text-[#f4c400]' : 'text-[#9ba4db] group-hover/header:text-white'}`}
            strokeWidth={2}
          />
          <span className="hidden select-none truncate text-[10.5px] font-extrabold uppercase tracking-wider text-[#f4c400] group-hover:inline">
            {label}
          </span>
        </span>

        {/* Shows on the collapsed rail which closed group holds the current page. */}
        {hasActiveChild && !expanded && (
          <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#f4c400] shadow-[0_0_8px_#f4c400] group-hover:hidden" />
        )}

        <ChevronDown
          aria-hidden="true"
          className={`hidden h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:inline ${
            expanded ? 'rotate-0 text-[#f4c400]' : '-rotate-90 text-[#9ba4db]/70 group-hover/header:text-white'
          }`}
          strokeWidth={2.2}
        />
      </button>

      <div
        id={groupId}
        className={`grid transition-[grid-template-rows,opacity] duration-[250ms] ease-in-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <ul className="m-0 list-none space-y-0.5 p-0 pt-0.5">
            {items.map((item) => (
              <li key={item.label}>
                <NavLinkButton item={item} pathname={pathname} indented onClick={onItemClick} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useApp();
  const sessionUser = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  const navEntries = useMemo(() => getNavItems(user?.role ?? null), [user?.role]);

  const findActiveSection = useCallback(
    (pathname: string) =>
      navEntries.find((entry): entry is NavSection =>
        isSection(entry) && entry.items.some((item) => isItemActive(item.path, pathname)),
      )?.label ?? null,
    [navEntries],
  );

  // Only one group is open at a time, starting with the one that holds the current page.
  const [expandedSection, setExpandedSection] = useState<string | null>(() => findActiveSection(location.pathname));

  // Open the matching group when the page changes; manual toggles are kept until then.
  const lastPathRef = useRef(location.pathname);
  useEffect(() => {
    if (lastPathRef.current === location.pathname) return;
    lastPathRef.current = location.pathname;
    const active = findActiveSection(location.pathname);
    if (active) setExpandedSection(active);
  }, [location.pathname, findActiveSection]);

  const handleNavClick = (path: string) => {
    if (path === '#') return;
    if (/^https?:\/\//.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(path);
  };

  let sectionCount = 0;

  return (
    // overflow-x-hidden prevents horizontal scroll on the whole layout
    <div className="flex h-screen overflow-x-hidden bg-slate-100 dark:bg-slate-900">

      {/* Keeps room for the collapsed sidebar, so the page never sits under it. */}
      <div aria-hidden="true" className="w-20 flex-shrink-0" />

      {/* Fixed to the left edge; expanding on hover floats over the page instead of pushing it. */}
      <aside data-sidebar className={asideClasses}>
        <div className={headerClasses}>
          <div className={logoFrameClasses}>
            <img src="/logo.png" alt="WeLinc Logo" className="h-full w-full object-contain" />
          </div>
          <div className={labelRevealClasses}>
            <p className="text-base font-extrabold leading-5 text-white">WeLinc Logistics</p>
            <p className="mt-0.5 text-[10px] font-medium leading-3 text-[#9ba4db]">Booking Management (BMS)</p>
          </div>
        </div>

        <nav className={navClasses}>
          {navEntries.map((entry) => {
            if (!isSection(entry)) {
              return (
                <NavLinkButton key={entry.label} item={entry} pathname={location.pathname} onClick={handleNavClick} />
              );
            }

            const showSeparator = sectionCount > 0;
            sectionCount += 1;
            return (
              <div key={`section-${entry.label}`}>
                {showSeparator && <div aria-hidden="true" className="mx-2 mb-2.5 border-t border-white/5" />}
                <SidebarGroup
                  section={entry}
                  expanded={expandedSection === entry.label}
                  pathname={location.pathname}
                  onToggle={() => setExpandedSection((current) => (current === entry.label ? null : entry.label))}
                  onItemClick={handleNavClick}
                />
              </div>
            );
          })}
        </nav>

        <div className={footerClasses}>
          <div className="mb-2">
            <NotificationBell />
          </div>

          <button
            type="button"
            onClick={() => navigate(getRoleProfile(user?.role ?? 'Administrator'))}
            title="Profile"
            className="mb-2.5 flex w-full items-center justify-center gap-0 rounded-lg p-1.5 text-left transition-all duration-200 hover:bg-white/10 group-hover:justify-start group-hover:gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4c400] text-xs font-extrabold text-[#030737] shadow-sm">
              {initials}
            </span>
            <span className={labelRevealClasses}>
              <span className="block max-w-[140px] truncate text-xs font-bold leading-4 text-white">{user?.fullName || 'username'}</span>
              <span className="block text-[10px] font-medium leading-3 text-[#9ba4db]">{user?.role || 'Administrator'}</span>
            </span>
          </button>

          {canSwitchSystem(sessionUser) && (
            <button
              type="button"
              onClick={() => window.location.assign(switchSystemUrl())}
              aria-label="Switch system"
              title="Switch system"
              className={`${footerButtonClasses} mb-1 text-[#9ba4db] hover:bg-white/10 hover:text-white`}
            >
              <LayoutGrid aria-hidden="true" size={18} strokeWidth={1.8} />
              <span className={labelRevealClasses}>Switch system</span>
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign Out"
            className={`${footerButtonClasses} text-[#ef4444] hover:bg-red-500/15`}
          >
            <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
            <span className={labelRevealClasses}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  );
}
