import { jwtDecode } from 'jwt-decode';
import type { User } from './types';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Users,
  User as UserIcon,
  CalendarCheck,
  Truck,
  Building2,
  UserCheck,
} from 'lucide-react';

export interface JwtPayload {
  sub: string;
  email: string;
  system: string;
  roles: { role: string; system: string }[];
}

export type UserRole = 'Administrator' | 'Operations' | 'Customer Service';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  subtitle?: string;
}

export function logout(): void {
  localStorage.removeItem('welinc_user');
  localStorage.removeItem('token');
}

export function getCurrentUser(): User | null {
  // Prefer token-backed user reconstruction. If a valid token exists, use it.
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const primaryRole = decoded.roles?.find(
        (role: { role: string; system: string }) => role.system === decoded.system,
      ) || decoded.roles?.[0];

      return {
        id: decoded.sub,
        role: mapBackendRole(primaryRole?.role ?? ''),
        fullName: decoded.email,
        email: decoded.email,
        contact: '',
        status: 'Active',
        createdAt: '',
        initials: decoded.email
          .split(/[.@\s_-]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0]?.toUpperCase())
          .join(''),
      };
    } catch {
      // Invalid token should not keep a stale stored user.
      localStorage.removeItem('welinc_user');
      return null;
    }
  }

  // If there is no access token, do not treat the user as authenticated.
  localStorage.removeItem('welinc_user');
  return null;
}

export function getRoleDashboard(role: UserRole): string {
  switch (role) {
    case 'Administrator': return '/admin/dashboard';
    case 'Operations': return '/operations/dashboard';
    case 'Customer Service': return '/cs/dashboard';
    default: return '/login';
  }
}

export function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case 'Administrator':
      return [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, subtitle: 'Overview' },
        { label: 'Booking', path: '/admin/bookings', icon: ClipboardList, subtitle: 'Manage requests' },
        { label: 'Scheduling', path: '/admin/scheduling', icon: CalendarCheck, subtitle: 'Assign resources' },
        { label: 'Fleet Vehicles', path: '/admin/vehicles', icon: Truck, subtitle: 'Manage fleet' },
        { label: 'Garages', path: '/admin/garages', icon: Building2, subtitle: 'Manage garages' },
        { label: 'Drivers', path: '/admin/drivers', icon: UserCheck, subtitle: 'Manage drivers' },
        { label: 'User Management', path: '/admin/users', icon: Users, subtitle: 'Account management' },
        { label: 'Settings', path: '/admin/settings', icon: Settings, subtitle: 'System preferences' },
      ];
    case 'Operations':
      return [
        { label: 'Dashboard', path: '/operations/dashboard', icon: LayoutDashboard, subtitle: 'Overview' },
      ];
    case 'Customer Service':
      return [
        { label: 'Dashboard', path: '/cs/dashboard', icon: LayoutDashboard, subtitle: 'Overview' },
        { label: 'Bookings', path: '/cs/bookings', icon: ClipboardList, subtitle: 'Client requests' },
        { label: 'Settings', path: '/cs/settings', icon: Settings, subtitle: 'Preferences' },
      ];
    default:
      return [];
  }
}

export function mapBackendRole(role: string): UserRole {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';

    case 'OPERATIONS':
      return 'Operations';

    case 'CUSTOMER_SUPPORT':
      return 'Customer Service';

    default:
      return 'Customer Service';
  }
}