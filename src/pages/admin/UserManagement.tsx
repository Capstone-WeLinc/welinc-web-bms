import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, Lock, Eye, EyeOff } from 'lucide-react';
import StatusBadge from '../../components/shared/StatusBadge';
import KPICard from '../../components/shared/KpiCard';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../lib/api';
import { mapBackendRole } from '../../lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/AlertDialog';

// Type definitions
export type UserRole = 'Administrator' | 'Operations' | 'Customer Service';
export type UserStatus = 'Active' | 'Pending' | 'Inactive' | 'Deactivated';

export interface User {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  isLocked: boolean;
  createdAt: string;
  initials: string;
}

type BackendUserRole = 'ADMIN' | 'OPERATIONS' | 'CUSTOMER_SUPPORT' | 'MECHANIC';

type BackendUser = {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
  roles: Array<{ role: BackendUserRole; system: string }>;
};

const ROLES: UserRole[] = ['Administrator', 'Operations', 'Customer Service'];
const STATUSES: UserStatus[] = ['Active'];

interface UserForm {
  fullName: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  password: string;
  confirmPassword: string;
}

const emptyForm: UserForm = {
  fullName: '', username: '', role: 'Customer Service', status: 'Active', password: '', confirmPassword: '',
};

function mapFrontendRoleToBackend(role: UserRole): BackendUserRole {
  switch (role) {
    case 'Administrator':
      return 'ADMIN';
    case 'Operations':
      return 'OPERATIONS';
    case 'Customer Service':
      return 'CUSTOMER_SUPPORT';
    default:
      return 'CUSTOMER_SUPPORT';
  }
}

function formatBackendUser(user: BackendUser): User {
  const systemRole = user.roles.find((r) => r.system === 'BMS') ?? user.roles[0];
  return {
    id: user.id,
    fullName: user.name,
    username: user.username,
    role: mapBackendRole(systemRole?.role ?? 'CUSTOMER_SUPPORT'),
    status: user.isActive ? 'Active' : 'Deactivated',
    isLocked: user.isLocked,
    createdAt: new Date(user.createdAt).toISOString().split('T')[0],
    initials: user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'WL',
  };
}

export default function Users() {
  const { user: currentUser } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const CACHE_KEY = 'welinc_user_management_cache_v1';

  function loadCachedUsers(): User[] | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.users) ? (parsed.users as User[]) : null;
    } catch (e) {
      console.warn('[UserManagement] Failed to read cache', e);
      return null;
    }
  }

  function cacheUsers(toCache: User[]) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ users: toCache, ts: Date.now() }));
    } catch (e) {
      console.warn('[UserManagement] Failed to write cache', e);
    }
  }

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const kpis = [
    { label: 'Total Users', value: users.length, color: '#1a1f6e' },
    { label: 'Active', value: users.filter(u => u.status === 'Active').length, color: '#10b981' },
    { label: 'Pending', value: users.filter(u => u.status === 'Pending').length, color: '#f59e0b' },
    { label: 'Inactive', value: users.filter(u => u.status === 'Inactive').length, color: '#94a3b8' },
  ];

  function openAdd() {
    setEditUser(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  async function loadUsers() {
    setLoading(true);
    setActionError('');
    setLoadError('');
    try {
      const response = await api.get<BackendUser[]>('/auth/users', {
        params: { system: 'BMS' },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
      });
      const mapped = response.data.map(formatBackendUser);
      setUsers(mapped);
      cacheUsers(mapped);
    } catch (error: unknown) {
      console.error('Failed to load users', error);
      // preserve cached users if available — only clear if there is no cache
      const cached = loadCachedUsers();
      if (!cached) setUsers([]);
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      setLoadError(
        err.response?.data?.message ||
          err.message ||
          'Unable to load users. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // show cache immediately (if present) to avoid disappearing data during HMR/code edits
    const cached = loadCachedUsers();
    if (cached) setUsers(cached);
    // always attempt fresh load in background
    loadUsers();
  }, []);

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ fullName: u.fullName, username: u.username, role: u.role, status: u.status, password: '', confirmPassword: '' });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.fullName.trim() || !form.username.trim()) {
      setFormError('Full name and username are required.');
      return;
    }
    if (!editUser && !form.password) {
      setFormError('Password is required for new users.');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    // Debug: Check token availability
    const token = localStorage.getItem('token');
    console.log('[UserManagement] Token present:', !!token);
    if (token) {
      console.log('[UserManagement] Token length:', token.length);
    }

    const payload: Record<string, unknown> = {
      name: form.fullName.trim(),
      username: form.username.trim(),
      isActive: form.status === 'Active',
      roleAssignments: [
        {
          role: mapFrontendRoleToBackend(form.role),
          system: 'BMS',
        },
      ],
    };

    if (form.password) {
      payload.password = form.password;
    }

    try {
      if (!editUser) {
        console.log('[UserManagement] Creating user with payload:', payload);
        await api.post('/auth/users', payload);
      } else {
        console.log('[UserManagement] Updating user:', editUser.id, 'with payload:', payload);
        await api.patch(`/auth/users/${editUser.id}`, payload);
      }
      await loadUsers();
      setShowModal(false);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      console.error('[UserManagement] Save error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      setFormError(
        err.response?.data?.message ||
          err.message ||
          'Unable to save user. Please try again.',
      );
    }
  }

  async function handleDelete() {
    if (!deleteUser) return;
    try {
      await api.delete(`/auth/users/${deleteUser.id}`);
      await loadUsers();
    } catch (error) {
      console.error('Unable to delete user', error);
    } finally {
      setDeleteUser(null);
    }
  }

  async function handleUnlock(user: User) {
    if (!user.isLocked) return;
    setUnlockingUserId(user.id);
    setActionError('');
    try {
      await api.patch(`/auth/users/${user.id}/unlock`);
      await loadUsers();
    } catch (error: unknown) {
      console.error('Unable to unlock user', error);
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      setActionError(
        err.response?.data?.message ||
          err.message ||
          'Unable to unlock user. Please try again.',
      );
    } finally {
      setUnlockingUserId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <KPICard key={k.label} label={k.label} value={String(k.value)} iconColor={k.color} />
        ))}
      </div>
      {actionError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100 dark:border-gray-800">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/20 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <button onClick={openAdd} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[#1a1f6e] text-white text-sm rounded-lg hover:bg-[#151b4f] whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={14} /> {loading ? 'Loading...' : 'Add User'}
          </button>
        </div>

        <div className="overflow-x-auto">
          {loadError ? (
            <div className="px-4 py-12 text-center text-red-600 dark:text-red-300 text-sm">
              {loadError}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-800">
                  {['User', 'Username', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1a1f6e] flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">{u.initials}</span>
                        </div>
                        <span className="font-medium text-slate-800 dark:text-white">{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-gray-300">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-[#1a1f6e]/10 text-[#1a1f6e] dark:bg-indigo-900/30 dark:text-indigo-300 font-medium whitespace-nowrap">{u.role}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} size="xs" /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-400 whitespace-nowrap">{u.createdAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 hover:text-[#1a1f6e] cursor-pointer transition-colors" title="Edit"><Edit2 size={13} /></button>
                          <button
                          onClick={() => u.id !== currentUser?.id && setDeleteUser(u)}
                          disabled={u.id === currentUser?.id}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${u.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-600'}`}
                          title={u.id === currentUser?.id ? 'Cannot delete your own account' : 'Delete User'}
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          onClick={() => handleUnlock(u)}
                          disabled={!u.isLocked || unlockingUserId === u.id}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${u.isLocked ? 'hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 hover:text-[#1a1f6e]' : 'opacity-30 cursor-not-allowed text-slate-400 dark:text-gray-500'}`}
                          title={u.isLocked ? 'Unlock User' : 'User is not locked'}
                        >
                          <Lock size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && !loadError && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-gray-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 dark:border-gray-800 text-xs text-slate-500 dark:text-gray-400">
          Showing {filtered.length} of {users.length} users
        </div>
      </div>

      {/* ─── Add/Edit User Modal ─── */}
      <Dialog open={showModal} onOpenChange={(open: boolean) => { if (!open) setShowModal(false); }}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-gray-800 shadow-xl">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Full Name <span className="text-red-500">*</span></Label>
                <Input className="h-9 text-sm bg-white dark:bg-slate-900" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="e.g., Maria Santos" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Username <span className="text-red-500">*</span></Label>
                <Input className="h-9 text-sm bg-white dark:bg-slate-900 w-full" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="e.g., msantos" />
              </div>
              <div>
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value: string) => setForm(p => ({ ...p, role: value as UserRole }))}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-gray-700 dark:bg-slate-900 dark:text-white">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: string) => setForm(p => ({ ...p, status: value as UserStatus }))}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-gray-700 dark:bg-slate-900 dark:text-white">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white">
                    {STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Password section */}
            <div className="border-t dark:border-gray-700 pt-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {editUser ? 'Change Password (leave blank to keep current)' : 'Set Password'}
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">
                    Password {!editUser && <span className="text-red-500">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      className="h-9 text-sm pr-10 bg-white dark:bg-slate-900"
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      placeholder={editUser ? 'New password...' : 'Create password...'}
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      className="h-9 text-sm pr-10 bg-white dark:bg-slate-900"
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Re-enter password..."
                    />
                    <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-slate-200 whitespace-nowrap cursor-pointer">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-[#1a1f6e] text-white rounded-lg hover:bg-[#151b4f] whitespace-nowrap cursor-pointer">{editUser ? 'Save Changes' : 'Create User'}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open: boolean) => { if (!open) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteUser?.fullName}</strong> ({deleteUser?.username})? This action cannot be undone and will remove all access for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Deactivate Confirmation ─── */}
    </div>
  );
}