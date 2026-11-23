import { useAuthStore } from '../store/authStore';
import { canSwitchSystem, switchSystemUrl } from '../lib/session/switchSystem';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../contexts/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp, House, LogOut, Users } from 'lucide-react';
import { getNavItems, getRoleProfile } from '../lib/auth';
import type { NavItem, NavSection } from '../lib/auth';
import Navbar from './Navbar';

function isSection(entry: NavItem | NavSection): entry is NavSection {
  return 'type' in entry && entry.type === 'section';
}

const isItemActive = (itemPath: string, pathname: string) =>
  itemPath !== '#' && (pathname === itemPath || pathname.startsWith(itemPath + '/'));

const asideClasses =
  'group fixed inset-y-0 left-0 z-40 flex w-20 flex-col overflow-hidden border-r border-[#111a62] bg-[#020849] text-white transition-[width] duration-300 ease-out hover:w-[280px]';
const headerClasses =
  'flex h-20 shrink-0 items-center gap-0 border-b border-white/10 px-5 transition-all duration-300 group-hover:gap-3';
const logoFrameClasses =
  'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#f4c400]/80 bg-[#061056]';
const labelRevealClasses =
  'max-w-0 min-w-0 translate-x-2 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:max-w-[190px] group-hover:translate-x-0 group-hover:opacity-100';
const navClasses =
  'flex min-h-0 flex-1 flex-col space-y-2.5 overflow-y-auto overflow-x-hidden px-2 py-3 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar]:w-1.5';
const footerClasses = 'shrink-0 border-t border-white/10 bg-[#020849] px-3 py-3';
const footerButtonClasses =
  'mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-sm font-medium transition-all duration-200 group-hover:mx-0 group-hover:w-full group-hover:justify-start group-hover:gap-3 group-hover:px-3.5';

const navLinkClass = (isActive: boolean, indented: boolean) => {
  const base = `mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-md text-left text-sm font-medium tracking-tight outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#f4c400]/50 group-hover:justify-start group-hover:gap-3 group-hover:px-3 ${
    indented ? 'group-hover:ml-1.5 group-hover:mr-0 group-hover:w-[calc(100%-0.5rem)]' : 'group-hover:mx-0 group-hover:w-full'
  }`;
  return isActive
    ? `${base} bg-[#f4c400] font-semibold text-[#030737]`
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
        className={`group/header relative mx-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c400]/50 group-hover:mx-0 group-hover:h-auto group-hover:w-full group-hover:justify-between group-hover:px-2.5 group-hover:py-1.5 ${
          highlighted ? 'bg-white/[0.08] text-[#f4c400]' : 'text-[#9ba4db] hover:bg-white/5 hover:text-white'
        }`}
      >
        <span className="flex min-w-0 items-center gap-0 group-hover:gap-2.5">
          <GroupIcon
            aria-hidden="true"
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${highlighted ? 'text-[#f4c400]' : 'text-[#9ba4db] group-hover/header:text-white'}`}
            strokeWidth={2}
          />
          <span className="hidden select-none truncate text-[10.5px] font-semibold uppercase tracking-wider text-[#f4c400] group-hover:inline">
            {label}
          </span>
        </span>

        {/* Shows on the collapsed rail which closed group holds the current page. */}
        {hasActiveChild && !expanded && (
          <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#f4c400] group-hover:hidden" />
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

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [accountMenuPosition, setAccountMenuPosition] = useState<{ left: number; bottom: number } | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuPanelRef = useRef<HTMLDivElement | null>(null);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountMenuRef.current?.contains(target) || accountMenuPanelRef.current?.contains(target)) return;
      setIsAccountMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  // The menu renders on <body> so the sidebar's overflow cannot clip it; it opens upward from the account button.
  useEffect(() => {
    if (!isAccountMenuOpen) {
      setAccountMenuPosition(null);
      return;
    }
    const updatePosition = () => {
      const rect = accountMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAccountMenuPosition({ left: rect.left, bottom: Math.max(8, window.innerHeight - rect.top + 8) });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isAccountMenuOpen]);

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
          {canSwitchSystem(sessionUser) && (
            <button
              type="button"
              onClick={() => window.location.assign(switchSystemUrl())}
              aria-label="Back to home"
              title="Back to home"
              className={`${footerButtonClasses} mb-1 text-[#9ba4db] hover:bg-white/10 hover:text-white`}
            >
              <House aria-hidden="true" size={18} strokeWidth={1.8} />
              <span className={labelRevealClasses}>Back to home</span>
            </button>
          )}

          <div ref={accountMenuRef} className="relative mt-1">
            {isAccountMenuOpen && accountMenuPosition && createPortal(
              <div
                ref={accountMenuPanelRef}
                role="menu"
                aria-label="Account menu"
                className="fixed z-[70] w-56 rounded-lg border border-white/10 bg-[#061056] p-1.5 shadow-lg"
                style={{ left: accountMenuPosition.left, bottom: accountMenuPosition.bottom }}
              >
                <div className="border-b border-white/10 px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-white">{user?.fullName || 'username'}</p>
                  <p className="truncate text-xs text-[#9ba4db]">{user?.email || user?.role || 'Administrator'}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[#9ba4db] transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    navigate(getRoleProfile(user?.role ?? 'Administrator'));
                  }}
                >
                  <Users aria-hidden="true" size={16} strokeWidth={1.8} />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[#ef4444] transition-colors hover:bg-red-500/15"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut aria-hidden="true" size={16} strokeWidth={1.8} />
                  <span>Sign out</span>
                </button>
              </div>,
              document.body,
            )}

            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((open) => !open)}
              aria-label={`Account menu for ${user?.fullName || 'username'}`}
              aria-expanded={isAccountMenuOpen}
              title={user?.fullName || 'Account'}
              className="flex w-full items-center justify-center gap-0 rounded-md p-1.5 text-left transition-colors duration-200 hover:bg-white/10 group-hover:justify-start group-hover:gap-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4c400] text-xs font-bold text-[#030737]">
                {initials}
              </span>
              <span className={labelRevealClasses}>
                <span className="block max-w-[140px] truncate text-xs font-semibold leading-4 text-white">{user?.fullName || 'username'}</span>
                <span className="block text-[10px] font-medium leading-3 text-[#9ba4db]">{user?.role || 'Administrator'}</span>
              </span>
              <ChevronUp
                aria-hidden="true"
                size={14}
                className={`ml-auto hidden text-[#9ba4db] transition-transform group-hover:block ${isAccountMenuOpen ? '' : 'rotate-180'}`}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content, under the top bar with the breadcrumb and the notification bell */}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <Navbar />
        <div className="flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
