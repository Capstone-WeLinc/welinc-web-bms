import TablePagination from '../../components/ui/TablePagination';
import PageHeader from '../../components/pageheader/Pageheader';
import { useEffect, useState } from 'react';
import { Activity, CalendarClock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { DatePicker } from '../../components/ui/DatePicker';
import { StatusFilter } from '../../components/ui/ListSearchFilters';
import { tableCellClasses, tableClasses, tableHeadClasses, tableHeaderCellClasses, tableRowClasses } from '../../components/ui/StandardTable';

interface ActivityLogRow {
  id: string;
  userId: string;
  userName: string;
  email: string;
  role: string | null;
  action: string;
  ipAddress?: string | null;
  createdAt: string;
}

interface ActivityLogResponse {
  items: ActivityLogRow[];
  total: number;
  page: number;
  pageSize: number;
}


// Each filter groups the verbs the backend writes at the start of an action, e.g. "Approved reschedule request (BK-0012)".
const ACTION_FILTERS: { label: string; verbs: string[] }[] = [
  { label: 'All', verbs: [] },
  { label: 'Logins', verbs: ['Logged in'] },
  { label: 'Created', verbs: ['Created', 'Recorded'] },
  { label: 'Updated', verbs: ['Updated', 'Completed', 'Finalized', 'Reported'] },
  { label: 'Deleted', verbs: ['Deleted'] },
  { label: 'Assigned & dispatched', verbs: ['Assigned', 'Distributed', 'Released', 'Retried'] },
  { label: 'Requests', verbs: ['Requested', 'Withdrew', 'Resubmitted'] },
  { label: 'Approvals', verbs: ['Approved', 'Rejected', 'Verified', 'Refunded', 'Reviewed'] },
  { label: 'Submitted', verbs: ['Submitted'] },
];

/** Roles the activity log records for signed-in users. */
const ROLE_FILTERS = ['ADMIN', 'CUSTOMER_SUPPORT', 'OPERATIONS'];

function roleLabel(role: string | null) {
  if (role === 'ADMIN') return 'Administrator';
  if (role === 'OPERATIONS') return 'Operations';
  if (role === 'CUSTOMER_SUPPORT') return 'Customer Service';
  return role || 'User';
}

export default function ActivityLogs() {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [action, setAction] = useState('All');
  const [role, setRole] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get<ActivityLogResponse>('/activity-logs', { params: { search: search || undefined, action: ACTION_FILTERS.find((item) => item.label === action)?.verbs.join('|') || undefined, role: role === 'All' ? undefined : role, from: from || undefined, to: to || undefined, page, pageSize: pageSize === Number.MAX_SAFE_INTEGER ? 'all' : pageSize } })
      .then(({ data }) => {
        if (!mounted) return;
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => { if (mounted) toast.error('Unable to load activity logs.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [search, action, role, from, to, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="ACTIVITY LOGS"
        subtitle={<>Review system activity performed by <span className="font-semibold text-[#d4a72c]">all WeLinc users</span>.</>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<div className="flex flex-wrap gap-3 lg:max-w-[780px] lg:justify-end">
            <div className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 !bg-transparent p-2 sm:w-auto sm:flex-row sm:items-center dark:border-slate-700 dark:!bg-transparent">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">From:</span>
                <DatePicker className="w-full sm:w-[180px] [&>button]:!bg-transparent dark:[&>button]:!bg-transparent" value={from} onChange={(value) => { setFrom(value); setPage(1); }} max={to || undefined} placeholder="Select date" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">To:</span>
                <DatePicker className="w-full sm:w-[180px] [&>button]:!bg-transparent dark:[&>button]:!bg-transparent" value={to} onChange={(value) => { setTo(value); setPage(1); }} min={from || undefined} placeholder="Select date" />
              </div>
            </div>
        </div>}
      />

      <div className="overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center dark:border-slate-700">
          <div className="relative w-full lg:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search users..." aria-label="Search users" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a0f2e]/20" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusFilter
              options={[{ value: 'All', label: 'All' }, ...ROLE_FILTERS.map((role) => ({ value: role, label: roleLabel(role) }))]}
              value={role}
              onChange={(value) => { setRole(value); setPage(1); }}
              allLabel="All Roles"
              ariaLabel="Filter by role"
            />
            <StatusFilter
              options={ACTION_FILTERS.map(({ label }) => label)}
              value={action}
              onChange={(value) => { setAction(value); setPage(1); }}
              allLabel="All Actions"
              ariaLabel="Filter activity action"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`${tableClasses} min-w-[900px] table-auto`}>
            <thead className={tableHeadClasses}><tr>{['USER', 'ROLE', 'ACTION PERFORMED', 'DATE', 'TIME'].map((heading) => <th key={heading} className={tableHeaderCellClasses}>{heading}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="border-b border-[#dde4ef] px-4 py-8 text-center text-sm text-[#70747c]">Loading activity logs...</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="border-b border-[#dde4ef] px-4 py-8 text-center text-sm text-[#70747c]"><CalendarClock className="mx-auto mb-2 h-7 w-7" aria-hidden="true" />No activity logs found.</td></tr> : rows.map((row) => {
                const timestamp = new Date(row.createdAt);
                return <tr key={row.id} className={tableRowClasses}>
                  <td className={`${tableCellClasses} leading-snug`}><p className="font-semibold">{row.userName}</p><p className="text-xs text-[#70747c]">{row.email}</p></td>
                  <td className={`${tableCellClasses} leading-snug`}>{roleLabel(row.role)}</td>
                  <td className={`${tableCellClasses} leading-snug`}>{row.action}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap leading-snug`}>{timestamp.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric' })}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap leading-snug`}>{timestamp.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} totalPages={totalPages} totalItems={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
      </div>
    </div>
  );
}
