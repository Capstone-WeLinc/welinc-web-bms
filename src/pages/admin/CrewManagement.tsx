import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CircleCheck, Clock3, Contact, MoreVertical, Pencil, Plus, ShieldAlert, Trash2, UserCheck, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/Dropdown';
import { toast } from 'sonner';
import PageHeader from '../../components/pageheader/Pageheader';
import TablePagination from '../../components/ui/TablePagination';
import { SearchInput, StatusFilter } from '../../components/ui/ListSearchFilters';
import CrewEditDialog from '../../components/availability/CrewEditDialog';
import { loadCrew } from '../../components/availability/crewData';
import { confirm } from '../../components/shared/confirm/confirm';
import { apiProblem } from '../../lib/api-shapes';
import { deleteCrewMember, type CrewMember, type CrewRole, type CrewStatus } from '../../lib/api/crewService';

type Kind = 'drivers' | 'helpers';
type StatusChoice = 'All' | CrewStatus;

const STATUS_OPTIONS: StatusChoice[] = ['All', 'Available', 'On Duty', 'On Leave'];
const roleOf = (kind: Kind): CrewRole => (kind === 'drivers' ? 'DRIVER' : 'HELPER');
const DAY = 86_400_000;

/** A YYYY-MM-DD day shown as "18 Nov 2026". */
const formatDay = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { day: '2-digit', month: 'short', year: 'numeric' });
};
/** "+639171234567" shown as "+63 917 123 4567". */
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '');
  return /^9\d{9}$/.test(digits) ? `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : value || '-';
};
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
const daysUntil = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? Math.floor((new Date(`${value}T00:00:00`).getTime() - Date.now()) / DAY) + 1 : null);

/** The same status pill as the driver and helper cards on Vehicle & Team Availability. */
const STATUS_PILL: Record<CrewStatus, string> = {
  Available: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  'On Duty': 'border-sky-300 bg-sky-50 text-sky-700',
  'On Leave': 'border-purple-300 bg-purple-50 text-purple-700',
};

function StatusPill({ status }: { status: CrewStatus }) {
  return <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_PILL[status]}`}>{status}</span>;
}

function SummaryCard({ label, value, tone, icon: Icon, active, onClick }: { label: string; value: number; tone: string; icon: typeof Users; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-h-[96px] w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30"
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon size={24} strokeWidth={2.25} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-slate-700">{label}</span>
        <span className="mt-1 block text-[22px] font-bold leading-tight tabular-nums text-[#0b0f4a]">{value}</span>
      </span>
    </button>
  );
}

/** Edit and Delete grouped under one ellipsis, in the same menu style as the crew cards on Vehicle & Team Availability. */
function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  const item = 'flex cursor-pointer items-center gap-3 rounded-none px-4 py-2.5 text-sm text-[#344158] focus:bg-[#f8fafc]';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-[#070b45] transition hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30">
          <MoreVertical size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 min-w-0 overflow-hidden rounded-xl border border-[#dce3ed] bg-white p-0 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.22)]">
        <DropdownMenuItem onClick={onEdit} className={item}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="flex cursor-pointer items-center gap-3 rounded-none px-4 py-2.5 text-sm text-[#ff4040] focus:bg-[#fff1f1] focus:text-[#ff4040]"><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

/** License number, type and expiry; expired and soon-to-expire licenses are flagged. */
function LicenseCell({ member }: { member: CrewMember }) {
  const left = daysUntil(member.licenseExpiry);
  const tone = left === null ? 'text-slate-500' : left < 0 ? 'text-red-700' : left <= 30 ? 'text-amber-700' : 'text-slate-500';
  return (
    <div className="min-w-0">
      <p className="font-medium tabular-nums text-slate-900">{member.licenseNo || '-'}</p>
      <p className={`flex items-center gap-1 text-xs ${tone}`}>
        {left !== null && left <= 30 && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {member.licenseType || 'Professional'} · {left === null ? 'No expiry date' : left < 0 ? `Expired ${formatDay(member.licenseExpiry)}` : `Expires ${formatDay(member.licenseExpiry)}`}
      </p>
    </div>
  );
}

export default function CrewManagement() {
  const [kind, setKind] = useState<Kind>('drivers');
  const [crew, setCrew] = useState<Record<Kind, CrewMember[]>>({ drivers: [], helpers: [] });
  const [loaded, setLoaded] = useState<Record<Kind, boolean>>({ drivers: false, helpers: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusChoice>('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [editTarget, setEditTarget] = useState<{ role: CrewRole; id: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const [drivers, helpers] = await Promise.allSettled([loadCrew('DRIVER'), loadCrew('HELPER')]);
    setCrew(old => ({
      drivers: drivers.status === 'fulfilled' ? drivers.value : old.drivers,
      helpers: helpers.status === 'fulfilled' ? helpers.value : old.helpers,
    }));
    setLoaded({ drivers: drivers.status === 'fulfilled', helpers: helpers.status === 'fulfilled' });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setError(!loading && !loaded[kind]); }, [loading, loaded, kind]);

  const rows = crew[kind];
  const counts = useMemo(() => ({
    total: rows.length,
    available: rows.filter(row => row.status === 'Available').length,
    onDuty: rows.filter(row => row.status === 'On Duty').length,
    onLeave: rows.filter(row => row.status === 'On Leave').length,
  }), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter(row => status === 'All' || row.status === status)
      .filter(row => !term || [row.fullName, row.empId, row.email, row.contact, row.licenseNo].some(text => text.toLowerCase().includes(term)))
      .sort((a, b) => a.empId.localeCompare(b.empId, undefined, { numeric: true }));
  }, [rows, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const visible = filtered.slice((page - 1) * limit, page * limit);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const chooseKind = (next: Kind) => { setKind(next); setSearch(''); setStatus('All'); setPage(1); };
  const chooseStatus = (next: StatusChoice) => { setStatus(next); setPage(1); };
  const noun = kind === 'drivers' ? 'driver' : 'helper';
  const Noun = kind === 'drivers' ? 'Driver' : 'Helper';

  /** Show a saved add or edit straight away, without reloading the list. */
  const applySaved = (member: CrewMember) => {
    const key: Kind = member.role === 'DRIVER' ? 'drivers' : 'helpers';
    setCrew(old => ({ ...old, [key]: old[key].some(row => row.id === member.id) ? old[key].map(row => (row.id === member.id ? member : row)) : [...old[key], member] }));
  };

  const remove = async (member: CrewMember) => {
    const confirmed = await confirm({
      title: `Delete ${noun}?`,
      description: `${member.fullName} (${member.empId}) will be removed from the team list and can no longer be assigned to bookings. Past job records keep their name.`,
      confirmText: 'Delete',
      tone: 'destructive',
    });
    if (!confirmed) return;
    try {
      await deleteCrewMember(member.role, member.id);
      setCrew(old => ({ ...old, [kind]: old[kind].filter(row => row.id !== member.id) }));
      toast.success(`${Noun} deleted`, { description: `${member.fullName} was removed from the list.` });
    } catch (requestError: unknown) {
      toast.error(apiProblem(requestError).message || `Unable to delete the ${noun}.`);
    }
  };

  const cards = [
    { label: `Total ${kind}`, value: counts.total, tone: 'bg-indigo-50 text-indigo-700', icon: Users, target: 'All' as StatusChoice },
    { label: 'Available', value: counts.available, tone: 'bg-emerald-50 text-emerald-700', icon: CircleCheck, target: 'Available' as StatusChoice },
    { label: 'On duty', value: counts.onDuty, tone: 'bg-blue-50 text-blue-700', icon: Clock3, target: 'On Duty' as StatusChoice },
    { label: 'On leave', value: counts.onLeave, tone: 'bg-purple-50 text-purple-700', icon: UserCheck, target: 'On Leave' as StatusChoice },
  ];
  const headings = ['Employee ID', 'Name', 'Contact', 'Status', 'Join date', ...(kind === 'drivers' ? ['License'] : []), 'Actions'];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={UserCheck}
        title="TEAM MANAGEMENT"
        subtitle={<>Manage driver and helper dispatch profiles. <span className="font-medium text-[#b8860b]">Sign-in accounts are managed in the portal.</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={
          <button
            type="button"
            onClick={() => setEditTarget({ role: roleOf(kind), id: null })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1a1f6e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#141a6b] sm:w-auto"
          >
            <Plus size={16} aria-hidden="true" />
            ADD {noun.toUpperCase()}
          </button>
        }
      />

      <div role="tablist" aria-label="Team member type" className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
        <TabButton active={kind === 'drivers'} icon={<Contact size={17} aria-hidden="true" />} label="Drivers" onClick={() => chooseKind('drivers')} />
        <TabButton active={kind === 'helpers'} icon={<Users size={17} aria-hidden="true" />} label="Helpers" onClick={() => chooseKind('helpers')} />
      </div>

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => <SummaryCard key={card.label} {...card} value={loading ? 0 : card.value} active={status === card.target} onClick={() => chooseStatus(card.target)} />)}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 border border-b-0 border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <SearchInput value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder={`Search ${noun} name, employee ID, email or contact...`} />
        <StatusFilter options={STATUS_OPTIONS} value={status} onChange={chooseStatus} allValue="All" allLabel="All Status" ariaLabel={`Filter ${kind} by status`} />
      </div>

      <section className="!mt-0 overflow-visible border border-slate-200 bg-white">
        {error ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <ShieldAlert className="mb-2 h-8 w-8 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">The {kind} list could not be loaded.</p>
            <button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-[#030848] px-4 py-2 text-sm font-medium text-white">Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-auto text-sm">
              <thead>
                <tr className="bg-[#1a1f6e]">
                  {headings.map(heading => <th key={heading} scope="col" className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white ${heading === 'Actions' ? 'text-center' : 'text-left'}`}>{heading}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={headings.length} className="px-4 py-14 text-center text-sm text-slate-500">Loading {kind}...</td></tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={headings.length} className="px-4 py-16 text-center">
                      <Users className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-800">{rows.length === 0 ? `No ${kind} yet` : `No ${kind} match your filters`}</p>
                      <p className="mt-1 text-sm text-slate-500">{rows.length === 0 ? `Add a ${noun} to start assigning them to bookings.` : 'Try a different search or status.'}</p>
                    </td>
                  </tr>
                ) : visible.map(member => (
                  <tr key={member.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 align-middle font-medium tabular-nums text-[#1a1f6e]">{member.empId || '-'}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef0fa] text-xs font-semibold text-[#1a1f6e]">{initialsOf(member.fullName) || '?'}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{member.fullName}</p>
                          <p className="truncate text-xs text-slate-500">{member.email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-slate-700">{formatPhone(member.contact)}</td>
                    <td className="px-4 py-3 align-middle"><StatusPill status={member.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums text-slate-700">{formatDay(member.joinDate)}</td>
                    {kind === 'drivers' && <td className="px-4 py-3 align-middle"><LicenseCell member={member} /></td>}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-center">
                        <RowActions name={member.fullName} onEdit={() => setEditTarget({ role: member.role, id: member.id })} onDelete={() => void remove(member)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && <TablePagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={limit} onPageChange={setPage} onPageSizeChange={size => { setLimit(size); setPage(1); }} />}
      </section>

      <CrewEditDialog target={editTarget} onClose={() => setEditTarget(null)} onSaved={applySaved} />
    </div>
  );
}
