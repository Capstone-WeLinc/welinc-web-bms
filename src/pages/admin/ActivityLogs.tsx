import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClipboardList, ExternalLink, RotateCcw, ShieldAlert, ShieldCheck, SquareActivity } from 'lucide-react';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import DateRangeFilter from '../../components/ui/DateRangeFilter';
import { SearchInput, StatusFilter } from '../../components/ui/ListSearchFilters';
import { apiProblem } from '../../lib/api-shapes';
import { api } from '../../lib/api';
import { eventLabel, type AccountEvent, type EventCatalog } from '../../lib/account-activity';

type Tab = 'work' | 'accounts';
type WorkEvent = { id: string; action: string; userName: string; email: string; role?: string; createdAt: string; ipAddress?: string };
type Row = { id: string; action: string; userName: string; email: string; tag: string; createdAt: string; ipAddress?: string };

const ALL = 'all';

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrator', CUSTOMER_SUPPORT: 'Customer Service', CUSTOMER_SERVICE: 'Customer Service', OPERATIONS: 'Operations' };
const roleLabel = (role?: string) => (role ? ROLE_LABELS[role] ?? role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) : 'System');

/** The colour of the dot beside an action, from its first word. */
const actionTone = (action: string) => {
  const verb = action.split(' ')[0]?.toLowerCase() ?? '';
  if (/^(created|added|approved|verified|completed|signed|confirmed|restored)/.test(verb)) return 'bg-emerald-500';
  if (/^(deleted|removed|rejected|cancelled|deactivated|failed|blocked|locked|revoked)/.test(verb)) return 'bg-red-500';
  if (/^(updated|edited|changed|rescheduled|assigned|reset|renamed|moved)/.test(verb)) return 'bg-blue-500';
  return 'bg-slate-400';
};

const manilaDate = (value: string) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const manilaTime = (value: string) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
/** The Manila calendar day (YYYY-MM-DD) of a timestamp, to compare with the date filters. */
const manilaDay = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
const isValidDate = (value: string) => Boolean(value) && !Number.isNaN(new Date(value).getTime());

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 ${active ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-600 hover:text-[#1a1f6e]'}`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function ActivityLogs() {
  const [tab, setTab] = useState<Tab>('work');
  const [work, setWork] = useState<WorkEvent[]>([]);
  const [accounts, setAccounts] = useState<AccountEvent[]>([]);
  const [catalog, setCatalog] = useState<EventCatalog>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    void api.get<EventCatalog>('/auth/activity/catalog', { sessionCall: true }).then(res => setCatalog(res.data)).catch(() => {});
  }, []);

  // Account search runs on the server, so wait until typing pauses (and two letters, as the API asks).
  useEffect(() => {
    const term = search.trim();
    const timer = window.setTimeout(() => setAccountSearch(term.length >= 2 ? term : ''), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (more = false) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'work') {
        const { data } = await api.get<{ items: WorkEvent[] }>('/activity-logs');
        setWork(data.items ?? []);
      } else {
        const { data } = await api.get<{ data: AccountEvent[]; nextCursor: string | null }>('/auth/activity', {
          params: {
            limit: 50,
            ...(more && cursor ? { cursor } : {}),
            ...(accountSearch ? { q: accountSearch } : {}),
            ...(category ? { category } : {}),
            ...(type ? { type } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          },
        });
        setAccounts(old => (more ? [...old, ...data.data] : data.data));
        setCursor(data.nextCursor);
      }
    } catch (requestError: unknown) {
      setError(apiProblem(requestError).code === 'ADMIN_CODE_REQUIRED'
        ? 'Confirm your sign-in in the portal to view account activity.'
        : 'Activity could not be loaded. Please retry.');
    } finally {
      setLoading(false);
    }
    // `cursor` is read only for "Show more"; a new filter always starts from the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, accountSearch, category, type, from, to]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, search, role, category, type, from, to]);

  const roleOptions = useMemo(() => {
    const labels = [...new Set(work.map(row => roleLabel(row.role)))].sort();
    return [{ value: ALL, label: 'All roles' }, ...labels.map(label => ({ value: label, label }))];
  }, [work]);

  const rows: Row[] = useMemo(() => {
    if (tab === 'accounts') {
      return accounts.map(event => ({
        id: event.id,
        action: eventLabel(catalog, event, true),
        userName: event.user?.name ?? 'Unknown user',
        email: event.user?.email ?? '',
        tag: catalog?.categories.find(item => item.code === event.category)?.label ?? event.category ?? 'Account',
        createdAt: event.at ?? event.createdAt ?? '',
        ipAddress: event.address,
      }));
    }
    const term = search.trim().toLowerCase();
    return work
      .map(row => ({ ...row, tag: roleLabel(row.role) }))
      .filter(row => !role || row.tag === role)
      .filter(row => !term || [row.action, row.userName, row.email].some(text => text.toLowerCase().includes(term)))
      .filter(row => {
        if (!from && !to) return true;
        if (!isValidDate(row.createdAt)) return false;
        const day = manilaDay(row.createdAt);
        return (!from || day >= from) && (!to || day <= to);
      });
  }, [tab, accounts, catalog, work, search, role, from, to]);

  // Both tabs page with the shared table pagination. Account activity arrives from the server in
  // batches, so while more is available one extra page is offered, and opening it loads the next batch.
  const moreAccounts = tab === 'accounts' && Boolean(cursor);
  const totalPages = Math.max(1, Math.ceil(rows.length / limit) + (moreAccounts ? 1 : 0));
  const visible = rows.slice((page - 1) * limit, page * limit);
  useEffect(() => {
    if (moreAccounts && !loading && !error && page * limit > rows.length) void load(true);
  }, [moreAccounts, loading, error, page, limit, rows.length, load]);

  const hasFilters = Boolean(search || role || category || type || from || to);
  const clearFilters = () => { setSearch(''); setAccountSearch(''); setRole(''); setCategory(''); setType(''); setFrom(''); setTo(''); };
  const chooseTab = (next: Tab) => { setTab(next); clearFilters(); };

  const typeOptions = [{ value: ALL, label: 'All events' }, ...(catalog?.types.filter(item => !category || item.category === category).map(item => ({ value: item.code, label: item.labelAdmin })) ?? [])];
  const categoryOptions = [{ value: ALL, label: 'All categories' }, ...(catalog?.categories.map(item => ({ value: item.code, label: item.label })) ?? [])];
  /** The dropdowns cannot hold an empty value, so "all" stands in for no filter. */
  const fromChoice = (value: string) => (value === ALL ? '' : value);
  const headings = ['Person', 'Date & time', tab === 'work' ? 'Role' : 'Category', 'Activity', 'IP address'];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={SquareActivity}
        title="ACTIVITY LOGS"
        subtitle={<>Track what each person did in BMS and <span className="font-medium text-[#b8860b]">sign-in activity on BMS accounts.</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />}
      />

      <div role="tablist" aria-label="Activity source" className="!mt-0 inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
        <TabButton active={tab === 'work'} icon={<ClipboardList size={17} aria-hidden="true" />} label="BMS work" onClick={() => chooseTab('work')} />
        <TabButton active={tab === 'accounts'} icon={<ShieldCheck size={17} aria-hidden="true" />} label="Accounts" onClick={() => chooseTab('accounts')} />
      </div>

      <div className="border border-b-0 border-slate-200 bg-white p-4">
        <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or activity..." />
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex h-11 w-fit items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#1a1f6e] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
                <RotateCcw size={15} aria-hidden="true" />
                Clear filters
              </button>
            )}
            {tab === 'work'
              ? <StatusFilter options={roleOptions} value={role || ALL} onChange={value => setRole(fromChoice(value))} allValue={ALL} allLabel="All roles" ariaLabel="Filter by role" />
              : <>
                <StatusFilter options={categoryOptions} value={category || ALL} onChange={value => { setCategory(fromChoice(value)); setType(''); }} allValue={ALL} allLabel="All categories" ariaLabel="Filter by category" />
                <StatusFilter options={typeOptions} value={type || ALL} onChange={value => setType(fromChoice(value))} allValue={ALL} allLabel="All events" ariaLabel="Filter by event type" />
              </>}
          </div>
        </div>
      </div>

      <section className="!mt-0 overflow-visible border border-slate-200 bg-white">
        {error ? (
          <div role="alert" className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <ShieldAlert className="mb-2 h-8 w-8 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">{error}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => void load()} className="rounded-lg bg-[#030848] px-4 py-2 text-sm font-medium text-white">Retry</button>
              {tab === 'accounts' && (
                <a href={`${import.meta.env.VITE_PORTAL_URL}/admin`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Open portal <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
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
                    <td className="px-4 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef0fa] text-xs font-semibold text-[#1a1f6e]">{initialsOf(row.userName) || '?'}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{row.userName || 'Unknown user'}</p>
                          {row.email && <p className="truncate text-xs text-slate-500">{row.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums">
                      {isValidDate(row.createdAt)
                        ? <><p className="font-medium text-slate-900">{manilaDate(row.createdAt)}</p><p className="text-xs text-slate-500">{manilaTime(row.createdAt)}</p></>
                        : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-700">{row.tag}</td>
                    <td className="px-4 py-3 align-middle">
                      <span className="flex items-start gap-2 text-slate-800">
                        <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${actionTone(row.action)}`} />
                        <span className="break-words">{row.action}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle font-mono text-xs text-slate-500">{row.ipAddress || '-'}</td>
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
