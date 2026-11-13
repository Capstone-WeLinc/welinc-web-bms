import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, CircleHelp, HardHat, Lightbulb, RotateCcw, Truck, UserRound, Wrench } from 'lucide-react';
import type { ForecastDashboard, ResourceKey } from './types';
import { EmptyState, LegendDot, Panel, StatCard } from './shared';
import { CHART_BOX, RESOURCE_COLORS, axisTick, formatDate, formatRange, gridStroke, num, tooltipStyle } from './format';

const ICONS = { trucks: Truck, drivers: UserRound, helpers: HardHat } as const;

type RecKind = ForecastDashboard['resources']['recommendations'][number]['kind'] | 'general';
/** How each kind of recommendation looks: urgent ones stand out, "all clear" is calm. */
const REC_STYLE: Record<RecKind, { label: string; Icon: typeof Truck; border: string; iconBg: string; tag: string }> = {
  shortage: { label: 'Urgent', Icon: AlertTriangle, border: 'border-red-500', iconBg: 'bg-red-100 text-red-600', tag: 'bg-red-100 text-red-700' },
  maintenance: { label: 'Maintenance', Icon: Wrench, border: 'border-amber-500', iconBg: 'bg-amber-100 text-amber-700', tag: 'bg-amber-100 text-amber-800' },
  return: { label: 'Follow up', Icon: RotateCcw, border: 'border-blue-500', iconBg: 'bg-blue-100 text-blue-700', tag: 'bg-blue-100 text-blue-800' },
  coverage: { label: 'All clear', Icon: CheckCircle2, border: 'border-emerald-500', iconBg: 'bg-emerald-100 text-emerald-700', tag: 'bg-emerald-100 text-emerald-800' },
  general: { label: 'Suggestion', Icon: Lightbulb, border: 'border-[#1a1f6e]', iconBg: 'bg-[#1a1f6e]/10 text-[#1a1f6e]', tag: 'bg-[#1a1f6e]/10 text-[#1a1f6e]' },
};

export default function ResourcePlanningTab({ data }: { data: ForecastDashboard }) {
  const plan = data.resources;
  const known = plan.status === 'ok';
  const hasAvailability = !plan.availabilityError;
  const byKey = Object.fromEntries(plan.resources.map((r) => [r.key, r])) as Partial<Record<ResourceKey, (typeof plan.resources)[number]>>;
  const shortages = plan.resources.filter((r) => r.shortage > 0);
  const unknown = !known || !hasAvailability;
  // Every recommendation the planner found (shortages first, then maintenance and
  // returns; "coverage" only when nothing needs action). Fall back to the system
  // insight only when the planner had nothing to say (e.g. availability unknown).
  const recommendations: { kind: RecKind; text: string }[] = plan.recommendations.length
    ? plan.recommendations.map((r) => ({ kind: r.kind, text: r.text }))
    : data.systemInsights.recommendedActions.slice(0, 1).map((a) => ({ kind: 'general' as const, text: a.action }));

  const kpi = (key: ResourceKey, label: string) => {
    const r = byKey[key];
    return <StatCard label={label} icon={ICONS[key]} accent={RESOURCE_COLORS[key]} value={r ? num(r.peakRequired) : 'N/A'} muted={!r}
      description={r ? (hasAvailability ? `${r.usableOnPeak} available on ${formatDate(r.peakDate)}` : `Busiest day ${formatDate(r.peakDate)}`) : 'Not enough crew records'} />;
  };

  const trend = plan.weekly.map((week) => ({ label: formatRange(week.start, week.end), trucks: week.required?.trucks ?? null, drivers: week.required?.drivers ?? null, helpers: week.required?.helpers ?? null }));

  return <div className="space-y-5">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpi('trucks', 'Estimated Trucks')}
      {kpi('drivers', 'Drivers Needed')}
      {kpi('helpers', 'Helpers Needed')}
      <StatCard label="Potential Shortage" icon={unknown ? CircleHelp : shortages.length ? AlertTriangle : CheckCircle2} accent={unknown ? '#64748b' : shortages.length ? '#d97706' : '#059669'}
        value={unknown ? 'Unknown' : shortages.length ? shortages.map((r) => r.label).join(', ') : 'None'} muted={unknown}
        tone={unknown ? undefined : shortages.length ? 'warning' : 'positive'}
        description={unknown ? (known ? 'Availability could not be loaded' : 'Not enough crew records') : shortages.length ? shortages.map((r) => `−${r.shortage} on ${formatDate(r.worstShortageDate)}`).join(' · ') : 'Enough trucks and crew'} />
    </div>

    {!known ? <EmptyState text={plan.message ?? 'Resource requirements cannot be estimated.'} /> : <>
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-5">
        <Panel title="Resource Requirements Trend" className="xl:col-span-3"
          action={<div className="flex flex-wrap gap-3"><LegendDot color={RESOURCE_COLORS.trucks} label="Trucks" /><LegendDot color={RESOURCE_COLORS.drivers} label="Drivers" dashed /><LegendDot color={RESOURCE_COLORS.helpers} label="Helpers" /></div>}>
          <div className={CHART_BOX}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 12, right: 16, bottom: 4, left: -16 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} minTickGap={16} />
                <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                {(['trucks', 'drivers', 'helpers'] as const).map((key) => <Line key={key} dataKey={key} name={key[0].toUpperCase() + key.slice(1)} stroke={RESOURCE_COLORS[key]} strokeWidth={2} strokeDasharray={key === 'drivers' ? '6 4' : undefined} dot={{ r: key === 'drivers' ? 3 : 4, fill: '#fff', strokeWidth: 2 }} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Resource Breakdown" className="xl:col-span-2">
          <div className="flex flex-1 flex-col justify-center gap-7">
            {plan.resources.map((r) => {
              const ratio = hasAvailability && r.usableOnPeak > 0 ? Math.min(100, (r.peakRequired / r.usableOnPeak) * 100) : 0;
              const Icon = ICONS[r.key];
              return <div key={r.key} className="flex items-center gap-4">
                <Icon size={24} className="shrink-0 text-[#1a1f6e]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{r.label}</p>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio)} aria-label={`${r.label}: needed as a share of available`}>
                    <div className={`h-full rounded-full ${r.shortage > 0 ? 'bg-amber-500' : ''}`} style={{ width: `${ratio}%`, ...(r.shortage > 0 ? {} : { backgroundColor: RESOURCE_COLORS[r.key] }) }} />
                  </div>
                </div>
                <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-[#0b0f4a]">
                  {hasAvailability && r.utilizationPct !== null ? `${r.utilizationPct}%` : `${r.peakRequired} needed`}
                </span>
              </div>;
            })}
          </div>
        </Panel>
      </div>

      {recommendations.length > 0 && <Panel title={recommendations.length === 1 ? 'Recommendation' : 'Recommendations'}
        action={<span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><Lightbulb size={18} className="text-[#d4a72c]" aria-hidden="true" />{recommendations.length} {recommendations.length === 1 ? 'item' : 'items'}</span>}>
        <ul className={`grid grid-cols-1 gap-3 ${recommendations.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {recommendations.map((rec, index) => {
            const style = REC_STYLE[rec.kind];
            return <li key={`${index}-${rec.text}`} className={`flex items-start gap-3 rounded-xl border-l-4 bg-slate-50/70 p-4 ${style.border}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}><style.Icon size={18} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${style.tag}`}>{style.label}</span>
                <p className="mt-1.5 text-sm leading-6 text-slate-700">{rec.text}</p>
              </div>
            </li>;
          })}
        </ul>
      </Panel>}
    </>}
  </div>;
}
