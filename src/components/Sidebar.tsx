import { useAuthStore } from '../store/authStore';
import { canSwitchSystem,switchSystemUrl } from '../lib/session/switchSystem';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { getNavItems, getRoleProfile } from '../lib/auth';
import type { NavItem, NavSection } from '../lib/auth';
import { api } from '../lib/api';
import NotificationBell from './shared/NotificationBell';

function isSection(entry: NavItem | NavSection): entry is NavSection {
  return 'type' in entry && entry.type === 'section';
}

function MainNavIcon({ icon: Icon, active = false, compact = false, hoverCircle = true }: { icon: NavItem['icon']; active?: boolean; compact?: boolean; hoverCircle?: boolean }) {
  return (
    <span className={`relative z-0 flex shrink-0 items-center justify-center ${compact ? 'h-10 w-10' : 'h-5 w-5'}`}>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${compact ? 'h-10 w-10' : 'h-12 w-12'} rounded-full transition-colors ${active ? 'bg-[#d4a72c] group-hover:bg-transparent' : hoverCircle ? 'group-hover/nav-option:bg-[#d4a72c]' : 'bg-transparent'}`}
      />
      <Icon aria-hidden="true" className={`relative z-10 h-5 w-5 ${active ? 'text-[#0a0f2e]' : hoverCircle ? 'group-hover/nav-option:text-[#0a0f2e]' : ''}`} />
    </span>
  );
}

interface SidebarGroupProps {
  label: string;
  icon: NavSection['icon'];
  items: NavSection['items'];
  expanded: boolean;
  pathname: string;
  approvalCount: number;
  submissionCount: number;
  isAdmin: boolean;
  onToggle: () => void;
  onItemClick: (path: string, parentSection: string) => void;
}

function SidebarGroup({
  label,
  icon: GroupIcon,
  items,
  expanded,
  pathname,
  approvalCount,
  submissionCount,
  isAdmin,
  onToggle,
  onItemClick,
}: SidebarGroupProps) {
  const isActive = items.some((item) => item.path !== '#' && (
    pathname === item.path || pathname.startsWith(item.path + '/')
  ));

  return (
    <div className="pt-2">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${label} menu`}
        onClick={onToggle}
        className={isAdmin
          ? `group/nav-option relative flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-left text-sm transition-[background-color,color,padding,justify-content,width,border-radius,margin] duration-200 group-hover:justify-start group-hover:px-5 hover:rounded-none ${isActive ? 'font-semibold text-[#0a0f2e] group-hover:rounded-none group-hover:bg-[#d4a72c]' : 'text-[#a8b4d9] hover:bg-white/10 hover:text-white'}`
          : 'group/nav-option flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-left text-sm text-[#a8b4d9] transition-colors group-hover:justify-start'}
      >
        {isAdmin
          ? <MainNavIcon icon={GroupIcon} active={isActive} compact hoverCircle={false} />
          : <MainNavIcon icon={GroupIcon} />}
        <span className="hidden min-w-0 flex-1 whitespace-nowrap text-sm group-hover:block">{label}</span>
        <ChevronDown aria-hidden="true" className={`hidden h-4 w-4 shrink-0 text-current transition-transform group-hover:block ${expanded ? '' : '-rotate-90'}`} />
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 pl-8">
          {items.map((item) => {
            const isActive = item.path !== '#' && (
              pathname === item.path || pathname.startsWith(item.path + '/')
            );
            const badgeCount = item.label === 'Approvals'
              ? approvalCount
              : item.label === 'For Approvals' ? submissionCount : 0;
            const ItemIcon = item.icon;

            return (
              <button
                key={item.label}
                onClick={() => onItemClick(item.path, label)}
                aria-label={item.label}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex h-10 w-full items-center justify-center gap-3 rounded-lg bg-transparent px-3 text-left text-sm transition-colors group-hover:justify-start hover:bg-transparent focus:bg-transparent active:bg-transparent ${isActive ? 'font-semibold text-[#a8b4d9]' : 'text-[#a8b4d9] hover:text-[#a8b4d9]'}`}
              >
                <ItemIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="hidden whitespace-nowrap text-sm group-hover:block">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="absolute right-2 top-1/2 flex min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#e8b800] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#0b0f4a]">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useApp();
  const sessionUser=useAuthStore(s=>s.user);
  const isAdminNav = user?.role === 'Administrator';
  const isCustomerServiceNav = user?.role === 'Customer Service';
  const isOperationsNav = user?.role === 'Operations';
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [approvalCount, setApprovalCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Dashboard: false,
    Administration: false,
    'System Configuration': false,
    'Booking Management': false,
    'Reports & Analytics': false,
  });

  useEffect(() => {
    if (user?.role !== 'Administrator' && user?.role !== 'Customer Service') return;
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (user?.role === 'Administrator') {
        api.get<{ total?: number }>('/approvals/counts').then(({ data }) => {
          if (active) setApprovalCount(Math.max(0, Number(data.total) || 0));
        }).catch(() => undefined);
      } else {
        api.get<Array<{ status: string }>>('/approvals/mine').then(({ data }) => {
          if (active) setSubmissionCount(data.filter(item => ['Pending', 'Rejected'].includes(item.status)).length);
        }).catch(() => undefined);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.role]);

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  const navEntries = useMemo(() => getNavItems(user?.role ?? null), [user?.role]);

  const handleNavClick = (path: string, parentSection?: string) => {
    if (path === '#') return;
    if (parentSection) {
      setExpandedSections((current) => ({ ...current, [parentSection]: true }));
    }
    if(/^https?:\/\//.test(path)){window.open(path,'_blank','noopener,noreferrer');return;}
    navigate(path);
  };

  return (
    // overflow-x-hidden prevents horizontal scroll on the whole layout
    <div className="flex h-screen overflow-x-hidden bg-slate-100 dark:bg-slate-900">

      {/* Keeps room for the collapsed sidebar, so the page never sits under it. */}
      <div aria-hidden="true" className="w-20 flex-shrink-0" />

      {/* Sidebar — fixed to the full top, bottom and left edges; expanding on hover floats over the page instead of pushing it. */}
      <div data-sidebar className="group fixed inset-y-0 left-0 z-40 flex w-20 flex-col overflow-hidden bg-[#030848] text-white shadow-[4px_0_16px_rgba(3,8,72,0.18)] transition-[width,box-shadow] duration-300 hover:w-64 hover:shadow-[8px_0_32px_rgba(3,8,72,0.32)]">

        {/* Logo */}
        <div className="flex h-[88px] items-center justify-center border-b border-white/10 px-3 transition-[padding,justify-content] duration-300 group-hover:justify-start group-hover:px-5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#d4a72c]">
            <img src="/logo.png" alt="WeLinc Logo" className="w-full h-full object-contain" />
          </div>
          <div className="hidden leading-none whitespace-nowrap group-hover:ml-2 group-hover:block">
            <p className="text-base font-bold">WeLinc Logistics</p>
            <p className="text-[10px] text-white/70">Booking Management System</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-2">
          {navEntries.map((entry, index) => {
            if (isSection(entry)) {
              const expanded = expandedSections[entry.label] ?? true;
              return (
                <SidebarGroup
                  key={`section-${index}`}
                  label={entry.label}
                  icon={entry.icon}
                  items={entry.items}
                  expanded={expanded}
                  pathname={location.pathname}
                  approvalCount={approvalCount}
                  submissionCount={submissionCount}
                  isAdmin={isAdminNav}
                  onToggle={() => setExpandedSections((current) => ({ ...current, [entry.label]: !expanded }))}
                  onItemClick={handleNavClick}
                />
              );
            }

            const item = entry;
            const isActive = item.path !== '#' && (
              location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            );

            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.path)}
                aria-label={item.label}
                title={item.label}
                className={`relative flex h-11 items-center justify-center text-left transition-[background-color,color,padding,justify-content,width,border-radius,margin] duration-200 group-hover:justify-start group-hover:gap-3 ${
                  isActive
                    ? 'mx-auto w-10 rounded-full bg-[#d4a72c] px-0 text-[#0a0f2e] font-semibold group-hover:mx-0 group-hover:w-full group-hover:rounded-none group-hover:px-5'
                    : 'w-full px-3 text-[#a8b4d9] hover:bg-white/10 hover:text-white group-hover:px-5'
                }`}
              >
                {item.label === 'Dashboard' || isCustomerServiceNav || isOperationsNav ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                    <item.icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                  </span>
                ) : (
                  <item.icon aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="hidden whitespace-nowrap text-sm group-hover:block">{item.label}</span>
                {(item.label === 'Approvals' && approvalCount > 0 || item.label === 'For Approvals' && submissionCount > 0) && <span className="absolute right-2 top-1/2 flex min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#e8b800] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#0b0f4a]">{(item.label === 'Approvals' ? approvalCount : submissionCount) > 99 ? '99+' : item.label === 'Approvals' ? approvalCount : submissionCount}</span>}
              </button>
            );
          })}
        </nav>

        {/* Notifications and user profile */}
        <div className="border-t border-white/10 px-3 py-3 transition-[padding] duration-300 group-hover:px-5">
          {canSwitchSystem(sessionUser) && <button type="button" onClick={()=>window.location.assign(switchSystemUrl())}>Switch system</button>}
      <NotificationBell />
          <button
            onClick={() => navigate(getRoleProfile(user?.role ?? 'Administrator'))}
            className="group/profile flex h-11 w-full items-center justify-center rounded-xl px-2 text-left transition-colors hover:bg-white/10 group-hover:justify-start group-hover:gap-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4a72c] text-xs font-bold text-[#0a0f2e]">
                {initials}
              </span>
            </span>
            <div className="hidden overflow-hidden whitespace-nowrap group-hover:block">
              <p className="truncate text-sm font-semibold group-hover/profile:text-white">{user?.fullName || 'username'}</p>
              <p className="text-xs text-white/60 truncate">{user?.role || 'Administrator'}</p>
            </div>
          </button>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Sign out"
            className="mt-1 flex h-11 w-full items-center justify-center rounded-xl px-2 text-left text-sm font-medium text-red-400 transition-colors hover:bg-white/10 hover:text-red-300 group-hover:justify-start group-hover:gap-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <LogOut aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="hidden whitespace-nowrap group-hover:block">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 min-w-0">
        {children}
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Are you sure you want to log out?</h2>
            <p className="mt-2 text-sm text-slate-600">
              You will be redirected to Login Page.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="rounded-xl bg-[#1a1f6e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#151b4f]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
