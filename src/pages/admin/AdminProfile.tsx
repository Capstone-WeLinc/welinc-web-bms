import { useApp } from '../../contexts/AppContext';
import { ShieldCheck, CircleCheck, User as UserIcon } from 'lucide-react';

export default function AdminProfile() {
  const { user } = useApp();
  const initials = user?.fullName
    ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';
  const status = (user as any)?.status || 'Active';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#1a1f6e] text-3xl font-semibold text-white shadow-lg shadow-slate-200/30 dark:shadow-black/30">
              {initials}
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{user?.fullName || 'Administrator'}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user?.role || 'Administrator'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              <CircleCheck className="h-4 w-4" />
              {status}
            </span>
            
          </div>
        </div>
      </div>

      <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-slate-500 dark:text-slate-400">Profile Details</p>
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">Account Information</h1>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#1a1f6e] shadow-sm dark:bg-slate-800">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Email Address</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{user?.email || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#1a1f6e] shadow-sm dark:bg-slate-800">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Role</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{user?.role || 'Administrator'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
