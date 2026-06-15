import { jwtDecode } from 'jwt-decode';
import type { User } from './types';

export interface JwtPayload {
  sub: string;
  username: string;
  system: string;
  roles: { role: string; system: string }[];
}

export type UserRole = 'Administrator' | 'Operations' | 'Customer Service';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  subtitle?: string;
}

type DemoUser = User & { password: string; contact: string; status?: string; createdAt?: string; initials?: string };

export const DEMO_USERS: DemoUser[] = [
  { fullName: 'Maria Santos', username: 'msantos', password: 'Admin@123', email: 'msantos@welinc.ph', contact: '+63 917 123 4567', role: 'Administrator', status: 'Active', createdAt: '2025-01-10', initials: 'MS' },
  { fullName: 'Juan Dela Cruz', username: 'jdelacruz', password: 'Ops@123', email: 'jdelacruz@welinc.ph', contact: '+63 918 234 5678', role: 'Operations', status: 'Active', createdAt: '2025-02-14', initials: 'JD' },
  { fullName: 'Ana Reyes', username: 'areyes', password: 'CS@123', email: 'areyes@welinc.ph', contact: '+63 919 345 6789', role: 'Customer Service', status: 'Active', createdAt: '2025-03-05', initials: 'AR' },
];

export function login(username: string, password: string): User | null {
  const user = DEMO_USERS.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem('welinc_user', JSON.stringify(user));
    return user;
  }
  return null;
}

export function logout(): void {
  localStorage.removeItem('welinc_user');
  localStorage.removeItem('token');
}

export function getCurrentUser() {
  // Prefer token-backed user reconstruction. If a valid token exists, use it.
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      const primaryRole = decoded.roles?.find(
        (role: { role: string; system: string }) => role.system === decoded.system,
      ) || decoded.roles?.[0];

      return {
        username: decoded.username,
        role: mapBackendRole(primaryRole?.role ?? ''),
        system: decoded.system,
        roles: decoded.roles,
        fullName: decoded.username,
        email: '',
      } as User;
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
        { label: 'Dashboard', path: '/admin/dashboard', icon: 'LayoutDashboard', subtitle: 'Overview & KPIs' },
        { label: 'Bookings', path: '/admin/bookings', icon: 'ClipboardList', subtitle: 'Manage requests' },
        { label: 'Scheduling', path: '/admin/scheduling', icon: 'CalendarDays', subtitle: 'Assign & plot' },
        { label: 'Job Orders', path: '/admin/job-orders', icon: 'FileText', subtitle: 'Service documents' },
        { label: 'Vehicle & Crew', path: '/admin/fleet', icon: 'Truck', subtitle: 'Availability tracking' },
        { label: 'Post-Service', path: '/admin/post-service', icon: 'ClipboardCheck', subtitle: 'After-service records' },
        { label: 'Users', path: '/admin/users', icon: 'Users', subtitle: 'Account management' },
        { label: 'Reports', path: '/admin/reports', icon: 'BarChart2', subtitle: 'Analytics & insights' },
        { label: 'Settings', path: '/admin/settings', icon: 'Settings', subtitle: 'System preferences' },
      ];
    case 'Operations':
      return [
        { label: 'Dashboard', path: '/operations/dashboard', icon: 'LayoutDashboard', subtitle: 'Overview' },
        { label: 'Scheduling', path: '/operations/scheduling', icon: 'CalendarDays', subtitle: 'Plan routes' },
        { label: 'Job Orders', path: '/operations/job-orders', icon: 'FileText', subtitle: 'Service documents' },
        { label: 'Settings', path: '/operations/settings', icon: 'Settings', subtitle: 'Preferences' },
      ];
    case 'Customer Service':
      return [
        { label: 'Dashboard', path: '/cs/dashboard', icon: 'LayoutDashboard', subtitle: 'Overview' },
        { label: 'Bookings', path: '/cs/bookings', icon: 'ClipboardList', subtitle: 'Client requests' },
        { label: 'Daily Sales', path: '/cs/daily-sales', icon: 'Receipt', subtitle: 'Sales reports' },
        { label: 'Post-Service', path: '/cs/post-service', icon: 'ClipboardCheck', subtitle: 'After-service' },
        { label: 'Reports', path: '/cs/reports', icon: 'BarChart2', subtitle: 'Analytics' },
        { label: 'Settings', path: '/cs/settings', icon: 'Settings', subtitle: 'Preferences' },
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