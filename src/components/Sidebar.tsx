import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Moon, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { getNavItems, getRoleDashboard } from '../lib/auth';
import type { UserRole } from '../lib/types';

const navItemsByRole = (role: UserRole | null) => {
  if (!role) {
    return [];
  }
  return getNavItems(role);
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, toggleDarkMode } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Sidebar */}
      <div className={`relative flex flex-col bg-[#1a1f6e] text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(p => !p)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 bg-white rounded-full shadow border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/logo.png" alt="WeLinc Logo" className="w-full h-full object-contain" />
        </div>
        
        {!collapsed && (
            <div>
            <p className="text-sm font-bold">WeLinc</p>
            <p className="text-xs text-white/60">Logistics Management</p>
            </div>
        )}
        </div>

        {/* User */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => {
              if (!user) {
                navigate('/login');
                return;
              }
              switch (user.role) {
                case 'Administrator':
                  navigate('/admin/profile');
                  break;
                case 'Customer Service':
                  navigate('/cs/profile');
                  break;
                case 'Operations':
                default:
                  navigate('/operations/dashboard');
                  break;
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-4 border-b border-white/10 text-left transition-colors hover:bg-white/10"
          >
            <div className="w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center text-[#1a1f6e] font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.fullName || 'Admin'}</p>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{user?.role || 'Administrator'}</span>
            </div>
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItemsByRole(user?.role ?? null).map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0 text-white/80" />
                {!collapsed && (
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/10 py-3">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors"
          >
            <Moon className="w-5 h-5 flex-shrink-0 text-white/80" />
            {!collapsed && <span className="text-sm">Dark Mode</span>}
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0 text-white/80" />
            {!collapsed && <span className="text-sm">Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
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
                  const portalUrl = import.meta.env.VITE_PORTAL_URL || 'http://localhost:8000';
                  window.location.href = `${portalUrl}/login?logout=true`;
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