import { useAuthStore } from '../store/authStore';
import { signOutFlow } from './session/signOutFlow';
import type { User } from './types';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  User as UserIcon,
  CalendarCheck,
  Truck,
  UserCheck,
  BarChart3,
  Banknote,
  Layers3,
  ClipboardCheck,
  CheckCheck,
  SquareActivity,
  Settings2,
  WalletCards,
} from 'lucide-react';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: { role: string; system: string }[];
  exp?: number;
}

export type UserRole = 'Administrator' | 'Operations' | 'Customer Service';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  subtitle?: string;
}

export interface NavSection {
  type: 'section';
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export type NavEntry = NavItem | NavSection;

export function logout(): void { void signOutFlow({ask:true}); }
export function getCurrentUser(): User | null {
  const user=useAuthStore.getState().user;
  if(!user)return null;
  return mapBackendUser({id:user.id,name:user.name,username:user.email,email:user.email,roles:user.roles,contact:null,profilePicture:null,deletionRequestStatus:'NONE',isActive:true,isLocked:false,lockedAt:null,createdAt:'',updatedAt:''});
}

export function getRoleDashboard(role: UserRole): string {
  switch (role) {
    case 'Administrator': return '/admin/dashboard';
    case 'Operations': return '/operations/dashboard';
    case 'Customer Service': return '/cs/dashboard';
    default: return '/login';
  }
}

export function getRoleProfile(role: UserRole): string {
  switch (role) {
    case 'Administrator': return '/admin/profile';
    case 'Operations': return '/operations/profile';
    case 'Customer Service': return '/cs/profile';
    default: return '/login';
  }
}

export function getNavItems(role: UserRole): NavEntry[] {
  switch (role) {
    case 'Administrator':
      return [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        {
          type: 'section', label: 'Administration', icon: ClipboardCheck, items: [
            { label: 'Approvals', path: '/admin/approvals', icon: CheckCheck },
            { label: 'User Accounts', path: `${import.meta.env.VITE_PORTAL_URL}/admin/people?system=BMS`, icon: Users },
            { label: 'Team Management', path: '/admin/crew', icon: UserCheck },
            { label: 'Activity Logs', path: '/admin/activity-logs', icon: SquareActivity },
          ],
        },
        {
          type: 'section', label: 'System Configuration', icon: Settings2, items: [
            { label: 'Services Offered', path: '/admin/services-offered', icon: Layers3 },
          ],
        },
        {
          type: 'section', label: 'Booking Management', icon: CalendarCheck, items: [
            { label: 'Booking', path: '/admin/booking', icon: Truck },
            { label: 'Scheduling', path: '/admin/scheduling', icon: CalendarCheck },
            { label: 'Job Order', path: '/admin/job-order', icon: ClipboardList },
            { label: 'Vehicle & Team Availability', path: '/admin/vehicle-availability', icon: UserCheck },
            { label: 'Post-Service', path: '/admin/post-service', icon: UserIcon },
          ],
        },
        {
          type: 'section', label: 'Reports & Analytics', icon: WalletCards, items: [
            { label: 'Sales Report', path: '/admin/sales-report', icon: Banknote },
            { label: 'Analytics & Reports', path: '/admin/reports', icon: BarChart3 },
          ],
        },
      ];
    case 'Operations':
      return [
        { label: 'Dashboard', path: '/operations/dashboard', icon: LayoutDashboard, subtitle: 'Overview' },
        // By priority: crew leave/emergencies first (someone may already be unavailable), then the dispatch flow.
        { label: 'For Approvals', path: '/operations/for-approvals', icon: ClipboardCheck, subtitle: 'Leave & emergencies' },
        { label: 'Scheduling', path: '/operations/scheduling', icon: CalendarCheck, subtitle: 'Assign trucks & teams' },
        { label: 'Job Order', path: '/operations/job-order', icon: ClipboardList, subtitle: 'Generate & distribute' },
        { label: 'Vehicle & Team Availability', path: '/operations/vehicle-availability', icon: UserCheck, subtitle: 'View availability' },
      ];
    case 'Customer Service':
      return [
        { label: 'Dashboard', path: '/cs/dashboard', icon: LayoutDashboard, subtitle: 'Overview' },
        { label: 'For Approvals', path: '/cs/my-submissions', icon: ClipboardCheck, subtitle: 'Approval status' },
        { label: 'Bookings', path: '/cs/bookings', icon: ClipboardList, subtitle: 'Client requests' },
        { label: 'Daily Sales', path: '/cs/daily-sales', icon: BarChart3, subtitle: 'Sales reports' },
        { label: 'Post Service', path: '/cs/post-service', icon: UserIcon, subtitle: 'Service confirmation' },
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

export interface BackendUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  contact: string | null;
  profilePicture: string | null;
  deletionRequestStatus: string;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: { role: string; system: string }[];
}

export function mapBackendUser(backendUser: BackendUser): User {
  const fullName = backendUser.name || backendUser.email || backendUser.username;
  const roleAssignment = backendUser.roles?.find(role=>role.system==='BMS');
  const role = mapBackendRole(roleAssignment?.role ?? '');
  return {
    id: backendUser.id,
    fullName,
    username: backendUser.username,
    email: backendUser.email || '',
    contact: backendUser.contact || '',
    profilePicture: backendUser.profilePicture,
    role,
    status: backendUser.isActive ? 'Active' : 'Inactive',
    createdAt: backendUser.createdAt,
    initials: fullName
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join(''),
    deletionRequestStatus: backendUser.deletionRequestStatus,
  };
}
