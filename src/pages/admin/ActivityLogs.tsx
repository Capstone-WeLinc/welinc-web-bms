import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, ShieldAlert, SquareActivity } from 'lucide-react';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import { SearchInput, StatusFilter } from '../../components/ui/ListSearchFilters';
import { api } from '../../lib/api';

type WorkEvent = { id: string; action: string; userName: string; email: string; role?: string; createdAt: string; ipAddress?: string };
type Row = WorkEvent & { tag: string };

const ALL = 'all';

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrator', CUSTOMER_SUPPORT: 'Customer Service', CUSTOMER_SERVICE: 'Customer Service', OPERATIONS: 'Operations' };
const roleLabel = (role?: string) => (role ? ROLE_LABELS[role] ?? role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) : 'System');

const manilaDate = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const manilaTime = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(value));
/** The Manila calendar day (YYYY-MM-DD) of a timestamp, to compare with the date filters. */
const manilaDay = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const isValidDate = (value: string) => Boolean(value) && !Number.isNaN(new Date(value).getTime());

/** What each person did in BMS. Searching and filtering happen on the loaded log. */
export default function ActivityLogs() {
  const [work, setWork] = useState<WorkEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ items: WorkEvent[] }>('/activity-logs');
      setWork(data.items ?? []);
    } catch {
      setError('Activity could not be loaded. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, role, action, from, to]);

  const roleOptions = useMemo(() => {
    const labels = [...new Set(work.map(row => roleLabel(row.role)))].sort();
    return [{ value: ALL, label: 'All roles' }, ...labels.map(label => ({ value: label, label }))];
  }, [work]);
  const actionOptions = useMemo(() => [{ value: ALL, label: 'All actions' }, ...[...new Set(work.map(row => row.action))].sort().map(value => ({ value, label: value }))], [work]);

  const rows: Row[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    return work
      .map(row => ({ ...row, tag: roleLabel(row.role) }))
      .filter(row => !role || row.tag === role)
      .filter(row => !action || row.action === action)
      .filter(row => !term || [row.action, row.userName, row.email].some(text => text.toLowerCase().includes(term)))
      .filter(row => {
        if (!from && !to) return true;
        if (!isValidDate(row.createdAt)) return false;
        const day = manilaDay(row.createdAt);
        return (!from || day >= from) && (!to || day <= to);
      });
  }, [work, search, role, action, from, to]);

  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  const visible = rows.slice((page - 1) * limit, page * limit);

  const hasFilters = Boolean(search || role || action || from || to);
  const clearFilters = () => { setSearch(''); setRole(''); setAction(''); setFrom(''); setTo(''); };
  /** The dropdowns cannot hold an empty value, so "all" stands in for no filter. */
  const fromChoice = (value: string) => (value === ALL ? '' : value);
  const headings = ['User', 'Role', 'Action performed', 'Date', 'Time'];

  return (
    <div className="space-y-5">
      {/* PageHeader draws the divider under the header itself; a second border here doubled it. */}
      <PageHeader
        icon={SquareActivity}
        title="ACTIVITY LOGS"
        subtitle="Review system activity performed by all WeLinc users."
        subtitleClassName="mt-1 text-sm text-slate-600"
        action={<DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />}
      />

      <div className="!mt-0 border border-b-0 border-slate-200 bg-white p-4">
        <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users..." />
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex h-11 w-fit items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#1a1f6e] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
                <RotateCcw size={15} aria-hidden="true" />
                Clear filters
              </button>
            )}
            <StatusFilter options={roleOptions} value={role || ALL} onChange={value => setRole(fromChoice(value))} allValue={ALL} allLabel="All Roles" ariaLabel="Filter by role" />
            <StatusFilter options={actionOptions} value={action || ALL} onChange={value => setAction(fromChoice(value))} allValue={ALL} allLabel="All Actions" ariaLabel="Filter by action" className="sm:w-[216px]" />
          </div>
        </div>
      </div>

      <section className="!mt-0 overflow-visible border border-slate-200 bg-white">
        {error ? (
          <div role="alert" className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <ShieldAlert className="mb-2 h-8 w-8 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-[#030848] px-4 py-2 text-sm font-medium text-white">Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-auto text-sm">
              <thead>
                <tr className="bg-[#1a1f6e]">
                  {headings.map(heading => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white">{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && visible.length === 0 ? (
                  <tr><td colSpan={headings.length} className="px-4 py-14 text-center text-sm text-slate-500">Loading activity...</td></tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={headings.length} className="px-4 py-16 text-center">
                      <SquareActivity className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-800">No activity found</p>
                      <p className="mt-1 text-sm text-slate-500">{hasFilters ? 'Try a different search, filter or date range.' : 'Activity will appear here as people use BMS.'}</p>
                    </td>
                  </tr>
                ) : visible.map(row => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="max-w-[260px] px-4 py-3 align-middle">
                      <p className="truncate font-semibold text-slate-800">{row.userName || 'Unknown user'}</p>
                      {row.email && <p className="truncate text-xs text-slate-500">{row.email}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-800">{row.tag}</td>
                    <td className="px-4 py-3 align-middle text-slate-800">{row.action}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-800">{isValidDate(row.createdAt) ? manilaDate(row.createdAt) : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-slate-800">{isValidDate(row.createdAt) ? manilaTime(row.createdAt) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && <TablePagination page={page} totalPages={totalPages} totalItems={rows.length} pageSize={limit} onPageChange={setPage} onPageSizeChange={size => { setLimit(size); setPage(1); }} />}
      </section>
    </div>
  );
}
