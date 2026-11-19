import ModalHeader from '../ui/ModalHeader';
import type { ReactNode } from 'react';
import { CalendarDays, Clock3, Truck, Warehouse, ShipWheel, UsersRound, TriangleAlert } from 'lucide-react';
import type { ScheduleEntry } from '../../lib/types';
import { Dialog, DialogContent } from '../ui/Dialog';

type Props = {
  schedule: ScheduleEntry | null;
  onClose: () => void;
  vehicle?: string;
  vehicleModel?: string;
  driver?: string;
  helpers?: string;
  garage?: string;
  showDecorativeIcons?: boolean;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{children}</h3>;
}

function isEmpty(value?: string | number | null) {
  return value == null || String(value).trim() === '' || value === '-' || value === 'Not set' || value === 'Not recorded';
}

function ScheduleMetric({ label, value, icon, tone, divided = false, showIcon = true }: { label: string; value?: string; icon: ReactNode; tone: 'blue' | 'amber' | 'green'; divided?: boolean; showIcon?: boolean }) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';
  return <div className={`flex min-w-0 items-center ${showIcon ? 'gap-2' : ''} py-1 ${divided ? 'border-l border-slate-200 pl-3' : ''}`}>{showIcon && <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>}<div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className={`break-words text-sm ${isEmpty(value) ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{isEmpty(value) ? 'Not recorded' : value}</p></div></div>;
}

function AssignmentItem({ label, value, model, icon, tone, showIcon = true }: { label: string; value?: string; model?: string; icon: ReactNode; tone: 'blue' | 'violet' | 'amber' | 'green'; showIcon?: boolean }) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'violet' ? 'bg-violet-50 text-violet-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';
  return <div className={`flex min-w-0 items-start ${showIcon ? 'gap-2' : ''}`}>
    {showIcon && <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>}
    <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className={`break-words text-[15px] ${isEmpty(value) ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{isEmpty(value) ? 'Not recorded' : value}</p>{!isEmpty(model) && <p className="break-words text-sm text-slate-600">{model}</p>}</div>
  </div>;
}

function formatTime(value?: string) {
  if (!value) return undefined;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function formatScheduleDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export default function ScheduleDetailsDialog({ schedule, onClose, vehicle, vehicleModel, driver, helpers, garage, showDecorativeIcons = true }: Props) {
  const clientInitials = schedule?.client.split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0]).join('').toUpperCase() || '';
  return <Dialog open={!!schedule} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent hideCloseButton aria-describedby={undefined} className="w-[calc(100%-2rem)] max-w-[560px] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border-0 bg-white p-0 gap-0 shadow-xl">
      {schedule && <>
        <ModalHeader icon={CalendarDays} title="Schedule details" subtitle={schedule.bookingNo || undefined} closeLabel="Close schedule details" />

        <div className="max-h-[70vh] space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
          {schedule.permitRequired && <div role="alert" className="flex items-center gap-3.5 rounded-xl border border-red-300 bg-red-50 p-3.5">
            {showDecorativeIcons && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"><TriangleAlert className="h-4 w-4" aria-hidden="true" /></span>}
            <div><p className="text-sm font-medium text-red-800">Barangay pass / permit required</p><p className="text-sm text-red-700">Confirm it's secured before dispatch.</p></div>
          </div>}

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              {showDecorativeIcons && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1a1f6e] text-sm font-medium text-white">{clientInitials}</span>}
              <div className="min-w-0">{showDecorativeIcons && <p className="text-sm text-slate-600">Client</p>}<p className="break-words text-lg font-medium text-slate-900">{schedule.client || 'Not recorded'}</p><p className="text-sm text-slate-600">{schedule.bookingNo || 'Not recorded'}</p></div>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${schedule.status === 'Unassigned' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>{schedule.status}</span>
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3">
              <ScheduleMetric label="Booking date" value={formatScheduleDate(schedule.date)} icon={<CalendarDays className="h-4 w-4" />} tone="blue" showIcon={showDecorativeIcons} />
              <ScheduleMetric label="Pickup" value={formatTime(schedule.pickupTime || schedule.time)} icon={<Clock3 className="h-4 w-4" />} tone="amber" divided showIcon={showDecorativeIcons} />
              <ScheduleMetric label="Dispatch" value={formatTime(schedule.dispatchTime)} icon={<Truck className="h-4 w-4" />} tone="green" divided showIcon={showDecorativeIcons} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <SectionTitle>Route</SectionTitle>
            <div className="mt-3 flex gap-3">
              <div className="flex w-3 shrink-0 flex-col items-center py-1"><span className="h-2.5 w-2.5 rounded-full bg-[#1a1f6e]" /><span className="my-1 min-h-8 flex-1 border-l-2 border-dashed border-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-[#e8b800]" /></div>
              <div className="min-w-0 flex-1 space-y-4">
                <ScheduleAddress label="Pickup address" value={schedule.origin} />
                <ScheduleAddress label="Delivery address" value={schedule.destination} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <SectionTitle>Assignment</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-4">
              <AssignmentItem label="Garage" value={garage || schedule.garage} icon={<Warehouse className="h-4 w-4" />} tone="amber" showIcon={showDecorativeIcons} />
              <AssignmentItem label="Vehicle" value={vehicle} model={vehicleModel} icon={<Truck className="h-4 w-4" />} tone="blue" showIcon={showDecorativeIcons} />
              <AssignmentItem label="Driver" value={driver || schedule.assignedDriverName} icon={<ShipWheel className="h-4 w-4" />} tone="violet" showIcon={showDecorativeIcons} />
              <AssignmentItem label="Helper" value={helpers} icon={<UsersRound className="h-4 w-4" />} tone="green" showIcon={showDecorativeIcons} />
            </div>
          </section>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}

function ScheduleAddress({ label, value }: { label: string; value?: string | null }) {
  const empty = isEmpty(value);
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className={`break-words text-[14.5px] leading-relaxed ${empty ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{empty ? 'Not recorded' : value}</p></div>;
}
